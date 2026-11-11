// Fixed two-row layout of the run graph (DESIGN.md §4): every node is 200×64 at 100% zoom on a
// 1072×400 canvas. Edge paths are fixed too, so loops never cross or hide behind a node.
import type { RunEvent } from '$lib/events';
import type { NodeId, NodeType } from '$lib/server/api/types';
import type { NodeState, NodeVisual } from '$lib/stores/graph';

export const NODE_WIDTH = 200;
export const NODE_HEIGHT = 64;
export const CANVAS_WIDTH = 1072;
export const CANVAS_HEIGHT = 400;

export const NODE_POSITIONS: Record<NodeId, { x: number; y: number }> = {
	planner: { x: 40, y: 96 },
	plan_check: { x: 304, y: 96 },
	interviewer: { x: 568, y: 96 },
	judge: { x: 832, y: 96 },
	guard: { x: 832, y: 288 },
	scorer: { x: 568, y: 288 },
	evidence_check: { x: 304, y: 288 },
	recruiter_gate: { x: 40, y: 288 }
};

export const NODE_NAMES: Record<NodeId, string> = {
	planner: 'Planner',
	plan_check: 'Plan check',
	interviewer: 'Interviewer',
	judge: 'Judge',
	guard: 'Guard',
	scorer: 'Scorer',
	evidence_check: 'Evidence check',
	recruiter_gate: 'Recruiter gate'
};

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
	splitter: 'splitter',
	worker: 'worker',
	gate: 'gate',
	code: 'code',
	human_gate: 'human gate'
};

export const VISUAL_LABELS: Record<Exclude<NodeVisual, 'retry'>, string> = {
	idle: 'Idle',
	running: 'Running',
	passed: 'Passed',
	failed: 'Failed',
	skipped: 'Skipped',
	gate: 'Your review'
};

export function statusLabel(node: NodeState): string {
	if (node.visual !== 'retry') return VISUAL_LABELS[node.visual];
	return node.maxAttempts ? `Retry ${node.attempt}/${node.maxAttempts}` : 'Retry';
}

/** `z-ai/glm-5.3-flash` → `glm-5.3-flash`. */
export const shortModel = (model: string) => model.slice(model.lastIndexOf('/') + 1);

export type EdgeGeometry = { path: string; label: string; labelX: number; labelY: number };

// Top row: y 96–160, thirds at 117/128/139. Bottom row: y 288–352, thirds at 309/320/331.
// Each label sits beside its line so the line and arrowhead stay visible: centred 18px above a
// horizontal segment, 18px below the two lower-third return lines, and right of the verdict line.
export const EDGE_GEOMETRY: Record<string, EdgeGeometry> = {
	'planner>planner': {
		path: 'M100,96 L100,52 L180,52 L180,96',
		label: 'retry',
		labelX: 140,
		labelY: 34
	},
	'planner>plan_check': { path: 'M240,117 L304,117', label: 'planned', labelX: 272, labelY: 99 },
	'plan_check>planner': { path: 'M304,139 L240,139', label: 'invalid', labelX: 272, labelY: 157 },
	'plan_check>interviewer': { path: 'M504,128 L568,128', label: 'valid', labelX: 536, labelY: 110 },
	'interviewer>judge': { path: 'M768,128 L832,128', label: 'answer', labelX: 800, labelY: 110 },
	'interviewer>interviewer': {
		path: 'M628,96 L628,52 L708,52 L708,96',
		label: 'retry',
		labelX: 668,
		labelY: 34
	},
	'judge>guard': { path: 'M932,160 L932,288', label: 'verdict', labelX: 971, labelY: 224 },
	'guard>interviewer': {
		path: 'M872,288 L872,240 L668,240 L668,160',
		label: 'follow_up · next_topic',
		labelX: 770,
		labelY: 222
	},
	'guard>scorer': { path: 'M832,320 L768,320', label: 'finish', labelX: 800, labelY: 302 },
	'scorer>evidence_check': { path: 'M568,309 L504,309', label: 'scored', labelX: 536, labelY: 291 },
	'evidence_check>scorer': { path: 'M504,331 L568,331', label: 'retry', labelX: 536, labelY: 349 },
	'evidence_check>recruiter_gate': {
		path: 'M304,320 L240,320',
		label: 'scored',
		labelX: 272,
		labelY: 302
	}
};

const integer = new Intl.NumberFormat('en-US');
export const formatCount = (n: number) => integer.format(n);
export const formatNodeCost = (usd: number) => `$${usd.toFixed(5)}`;
export const formatDuration = (ms: number) => `${(ms / 1000).toFixed(2)} s`;

/** "+m:ss" from `run.started`. */
export function relativeTime(ts: string, startedAt: string | null): string {
	if (!startedAt) return '+0:00';
	const seconds = Math.max(0, Math.round((Date.parse(ts) - Date.parse(startedAt)) / 1000));
	return `+${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** One summary line per event for the timeline (the text alternative to the graph). */
export function eventSummary(event: RunEvent, formatRunCost: (usd: number) => string): string {
	switch (event.event) {
		case 'run.started':
			return `${event.data.nodes.length} nodes · ${event.data.edges.length} edges`;
		case 'node.started':
			return `${NODE_NAMES[event.node_id]} · attempt ${event.attempt ?? 1}`;
		case 'node.completed':
			return event.data.output_summary;
		case 'node.failed':
			return `${event.data.error}, ${event.data.will_retry ? 'will retry' : 'no retry left'}`;
		case 'node.skipped':
			return event.data.reason;
		case 'check.passed':
			return event.data.check;
		case 'check.failed': {
			const reasons = event.data.errors.map(({ reason }) => reason).join(', ');
			return reasons ? `${event.data.check} · ${reasons}` : event.data.check;
		}
		case 'loop.retry':
			return `attempt ${event.data.attempt} of ${event.data.max_attempts} · ${event.data.reason}`;
		case 'edge.traversed':
			return `${NODE_NAMES[event.data.from]} → ${NODE_NAMES[event.data.to]} · ${event.data.label}`;
		case 'topic.changed':
			return `Topic ${event.data.position} active · ${event.data.title}`;
		case 'message.completed': {
			const { role, kind } = event.data.message;
			return role === 'applicant'
				? 'Applicant answered'
				: `Interviewer sent the ${kind.replace('_', '-')}`;
		}
		case 'run.completed':
			return `${event.data.status} · ${formatRunCost(event.data.cost_usd)}`;
		case 'run.failed':
			return event.data.error;
	}
}
