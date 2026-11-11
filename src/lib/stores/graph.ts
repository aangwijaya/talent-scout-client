// Graph-run state for /dashboard/runs/[runId]: a pure fold over run events (docs/EVENTS.md §4,
// §6), so a replay position is just `reduceRun(base, events.slice(0, n))`.
import type { EdgeLabel, RunEvent } from '$lib/events';
import type { GraphRun, NodeId, NodeType, RunStatus } from '$lib/server/api/types';

export type NodeVisual = 'idle' | 'running' | 'passed' | 'failed' | 'retry' | 'skipped' | 'gate';

export type NodeState = {
	id: NodeId;
	type: NodeType;
	visual: NodeVisual;
	/** The attempt of the latest `node.started` or `loop.retry`. */
	attempt: number | null;
	maxAttempts: number | null;
	/** Set by `loop.retry` and kept after the node passes. */
	retryBadge: number | null;
	retryReason: string | null;
	/** Count of `node.started`, across attempts and visits. */
	runs: number;
	model: string | null;
	inputSummary: string | null;
	outputSummary: string | null;
	error: string | null;
	tokensIn: number | null;
	tokensOut: number | null;
	durationMs: number | null;
	costUsd: number | null;
	skipReason: string | null;
	/** The judge failed with no retry left, and the run went on with the default verdict (§6.3). */
	defaultedVerdict: boolean;
};

export type EdgeState = {
	id: string;
	from: NodeId;
	to: NodeId;
	taken: boolean;
	/** Loops back: `plan_check → planner`, `interviewer → interviewer`, `evidence_check → scorer`. */
	retryPath: boolean;
	lastLabel: EdgeLabel | null;
};

export type RunState = {
	status: RunStatus;
	error: string | null;
	nodes: Record<NodeId, NodeState>;
	edges: EdgeState[];
	latestEdgeId: string | null;
	/** The node of the latest node-level event; the panel follows it unless one is pinned. */
	activeNodeId: NodeId | null;
	lastSeq: number;
	startedAt: string | null;
	sessionId: string;
	tokensIn: number;
	tokensOut: number;
	costUsd: number;
};

export const NODE_IDS = [
	'planner',
	'plan_check',
	'interviewer',
	'judge',
	'guard',
	'scorer',
	'evidence_check',
	'recruiter_gate'
] as const satisfies readonly NodeId[];

const RETRY_PATHS = new Set(['plan_check>planner', 'interviewer>interviewer', 'evidence_check>scorer']);

export const edgeId = (from: NodeId, to: NodeId) => `${from}>${to}`;

function edgeState(from: NodeId, to: NodeId): EdgeState {
	const id = edgeId(from, to);
	return { id, from, to, taken: false, retryPath: RETRY_PATHS.has(id), lastLabel: null };
}

function idleNode(id: NodeId, type: NodeType): NodeState {
	return {
		id,
		type,
		visual: 'idle',
		attempt: null,
		maxAttempts: null,
		retryBadge: null,
		retryReason: null,
		runs: 0,
		model: null,
		inputSummary: null,
		outputSummary: null,
		error: null,
		tokensIn: null,
		tokensOut: null,
		durationMs: null,
		costUsd: null,
		skipReason: null,
		defaultedVerdict: false
	};
}

/** The state before any event: every node idle, every edge untaken, from the run snapshot. */
export function initialRunState(run: Pick<GraphRun, 'session_id' | 'nodes' | 'edges'>): RunState {
	const nodes = Object.fromEntries(
		run.nodes.map((node) => [node.id, idleNode(node.id, node.type)])
	) as Record<NodeId, NodeState>;
	return {
		status: 'running',
		error: null,
		nodes,
		edges: run.edges.map(({ from, to }) => edgeState(from, to)),
		latestEdgeId: null,
		activeNodeId: null,
		lastSeq: 0,
		startedAt: null,
		sessionId: run.session_id,
		tokensIn: 0,
		tokensOut: 0,
		costUsd: 0
	};
}

/** Applies one event. Returns a new state; `state` is not changed. */
export function applyRunEvent(state: RunState, event: RunEvent): RunState {
	const next: RunState = { ...state, nodes: { ...state.nodes }, lastSeq: event.seq };
	const patch = (id: NodeId, change: Partial<NodeState>) => {
		next.nodes[id] = { ...(next.nodes[id] ?? idleNode(id, 'worker')), ...change };
		next.activeNodeId = id;
	};

	switch (event.event) {
		case 'run.started':
			next.startedAt = event.ts;
			next.sessionId = event.data.session_id;
			for (const node of event.data.nodes) next.nodes[node.id] ??= idleNode(node.id, node.type);
			next.edges = event.data.edges.map(
				({ from, to }) =>
					state.edges.find(({ id }) => id === edgeId(from, to)) ?? edgeState(from, to)
			);
			break;
		case 'node.started':
			patch(event.node_id, {
				visual: 'running',
				attempt: event.attempt,
				runs: state.nodes[event.node_id].runs + 1,
				model: event.data.model,
				inputSummary: event.data.input_summary,
				outputSummary: null,
				error: null,
				tokensIn: null,
				tokensOut: null,
				durationMs: null,
				costUsd: null,
				defaultedVerdict: false
			});
			break;
		case 'node.completed':
			patch(event.node_id, {
				visual: 'passed',
				outputSummary: event.data.output_summary,
				tokensIn: event.data.tokens_in,
				tokensOut: event.data.tokens_out,
				durationMs: event.data.duration_ms,
				costUsd: event.data.cost_usd
			});
			next.tokensIn += event.data.tokens_in;
			next.tokensOut += event.data.tokens_out;
			next.costUsd += event.data.cost_usd;
			break;
		case 'node.failed':
			patch(event.node_id, {
				visual: 'failed',
				error: event.data.error,
				defaultedVerdict: event.node_id === 'judge' && !event.data.will_retry
			});
			break;
		case 'node.skipped':
			patch(event.node_id, { visual: 'skipped', skipReason: event.data.reason });
			break;
		case 'check.passed':
			patch(event.node_id, { visual: 'passed' });
			break;
		case 'check.failed':
			patch(event.node_id, {
				visual: 'failed',
				error: event.data.errors.map(({ reason }) => reason).join(', ') || event.data.check
			});
			break;
		case 'loop.retry':
			patch(event.node_id, {
				visual: 'retry',
				attempt: event.data.attempt,
				maxAttempts: event.data.max_attempts,
				retryBadge: event.data.attempt,
				retryReason: event.data.reason
			});
			break;
		case 'edge.traversed': {
			const { from, to, label } = event.data;
			const id = edgeId(from, to);
			next.edges = state.edges.some((edge) => edge.id === id)
				? state.edges.map((edge) => (edge.id === id ? { ...edge, taken: true, lastLabel: label } : edge))
				: [...state.edges, { ...edgeState(from, to), taken: true, lastLabel: label }];
			next.latestEdgeId = id;
			if (to === 'recruiter_gate') patch(to, { visual: 'gate' });
			break;
		}
		case 'run.completed':
			next.status = event.data.status;
			next.tokensIn = event.data.total_tokens_in;
			next.tokensOut = event.data.total_tokens_out;
			next.costUsd = event.data.cost_usd;
			break;
		case 'run.failed':
			next.status = 'failed';
			next.error = event.data.error;
			break;
		case 'topic.changed':
		case 'message.completed':
			break;
	}
	return next;
}

export function reduceRun(initial: RunState, events: readonly RunEvent[]): RunState {
	return events.reduce(applyRunEvent, initial);
}
