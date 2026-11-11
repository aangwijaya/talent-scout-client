import { describe, expect, it } from 'vitest';
import type { RunEvent } from '$lib/events';
import {
	MOCK_JUDGE_OUTAGE_RUN_ID,
	MOCK_MANUAL_RETRY_RUN_ID,
	MOCK_PLANNER_FAILED_RUN_ID,
	MOCK_PLANNER_RETRY_RUN_ID,
	MOCK_RUN_ID,
	mockRunEvents
} from '$lib/mock';
import { graphRunSnapshot } from '$lib/server/api/fixtures';
import { applyRunEvent, initialRunState, reduceRun, type RunState } from './graph';

function initial(runId: string): RunState {
	const snapshot = graphRunSnapshot(runId);
	if (!snapshot) throw new Error(runId);
	return initialRunState(snapshot);
}

function replay(runId: string, count?: number): RunState {
	return reduceRun(initial(runId), mockRunEvents[runId].slice(0, count));
}

/** Replays up to and including the first event that matches. */
function replayUntil(runId: string, match: (event: RunEvent) => boolean): RunState {
	const index = mockRunEvents[runId].findIndex(match);
	expect(index).toBeGreaterThan(-1);
	return replay(runId, index + 1);
}

const visuals = (state: RunState) =>
	Object.fromEntries(Object.values(state.nodes).map((node) => [node.id, node.visual]));

describe('initialRunState', () => {
	it('starts with 8 idle nodes, untaken edges, and a running run', () => {
		const state = initial(MOCK_RUN_ID);
		expect(Object.keys(state.nodes)).toHaveLength(8);
		expect(Object.values(state.nodes).every((node) => node.visual === 'idle')).toBe(true);
		expect(state.edges.every((edge) => !edge.taken)).toBe(true);
		expect(state.status).toBe('running');
		expect(state.latestEdgeId).toBeNull();
	});

	it('marks the three loop-back edges as retry paths', () => {
		const retry = initial(MOCK_RUN_ID)
			.edges.filter((edge) => edge.retryPath)
			.map((edge) => edge.id);
		expect(retry.sort()).toEqual(
			['evidence_check>scorer', 'interviewer>interviewer', 'plan_check>planner'].sort()
		);
	});
});

describe('applyRunEvent', () => {
	it('node.started → running, node.completed → passed with metrics', () => {
		const running = replayUntil(MOCK_RUN_ID, (e) => e.event === 'node.started');
		expect(running.nodes.planner).toMatchObject({ visual: 'running', attempt: 1, runs: 1 });
		expect(running.activeNodeId).toBe('planner');
		const passed = replayUntil(MOCK_RUN_ID, (e) => e.event === 'node.completed');
		expect(passed.nodes.planner.visual).toBe('passed');
		expect(passed.nodes.planner.tokensIn).toBeGreaterThan(0);
		expect(passed.nodes.planner.durationMs).toBeGreaterThan(0);
	});

	it('check.failed → failed on the code node, loop.retry → retry with a badge on the target', () => {
		const checkFailed = replayUntil(MOCK_RUN_ID, (e) => e.event === 'check.failed');
		expect(checkFailed.nodes.evidence_check.visual).toBe('failed');
		const retry = replayUntil(MOCK_RUN_ID, (e) => e.event === 'loop.retry');
		expect(retry.nodes.scorer).toMatchObject({
			visual: 'retry',
			attempt: 2,
			maxAttempts: 3,
			retryBadge: 2
		});
		expect(retry.nodes.scorer.retryReason).toBeTruthy();
	});

	it('edge.traversed → taken and latest', () => {
		const state = replayUntil(MOCK_RUN_ID, (e) => e.event === 'edge.traversed');
		expect(state.latestEdgeId).toBe('planner>plan_check');
		expect(state.edges.find((edge) => edge.id === 'planner>plan_check')).toMatchObject({
			taken: true,
			lastLabel: 'planned'
		});
		expect(state.edges.filter((edge) => edge.taken)).toHaveLength(1);
	});

	it('node.failed → failed, and a later node.started of the same node → running again', () => {
		const state = replayUntil(MOCK_JUDGE_OUTAGE_RUN_ID, (e) => e.event === 'node.failed');
		expect(state.nodes.judge).toMatchObject({ visual: 'failed', error: 'timeout' });
		expect(state.nodes.judge.defaultedVerdict).toBe(false);
		const again = replay(MOCK_JUDGE_OUTAGE_RUN_ID, state.lastSeq + 1);
		expect(again.nodes.judge).toMatchObject({ visual: 'running', attempt: 2, error: null });
	});

	it('keeps running sums of node.completed until run.completed sets the totals', () => {
		const events = mockRunEvents[MOCK_RUN_ID];
		const beforeEnd = replay(MOCK_RUN_ID, events.length - 1);
		const completed = events.filter((e) => e.event === 'node.completed');
		const tokensIn = completed.reduce((sum, e) => sum + e.data.tokens_in, 0);
		expect(beforeEnd.tokensIn).toBe(tokensIn);
		expect(beforeEnd.status).toBe('running');
		const end = applyRunEvent(beforeEnd, events.at(-1) as RunEvent);
		expect(end.status).toBe('succeeded');
		const last = events.at(-1);
		if (last?.event !== 'run.completed') expect.unreachable();
		expect(end.tokensIn).toBe(last.data.total_tokens_in);
		expect(end.costUsd).toBe(last.data.cost_usd);
	});

	it('takes the run.completed totals even when they differ from the node.completed sums', () => {
		const events = mockRunEvents[MOCK_RUN_ID];
		const last = events.at(-1);
		if (last?.event !== 'run.completed') expect.unreachable();
		const beforeEnd = replay(MOCK_RUN_ID, events.length - 1);
		const totals = {
			total_tokens_in: beforeEnd.tokensIn + 1234,
			total_tokens_out: beforeEnd.tokensOut + 567,
			cost_usd: beforeEnd.costUsd + 0.0042
		};
		const end = applyRunEvent(beforeEnd, { ...last, data: { ...last.data, ...totals } });
		expect(end.tokensIn).toBe(totals.total_tokens_in);
		expect(end.tokensOut).toBe(totals.total_tokens_out);
		expect(end.costUsd).toBe(totals.cost_usd);
	});

	it('does not change the state it is given', () => {
		const before = initial(MOCK_RUN_ID);
		const copy = structuredClone(before);
		reduceRun(before, mockRunEvents[MOCK_RUN_ID]);
		expect(before).toEqual(copy);
	});
});

describe('§6.1 success with the scorer retry', () => {
	const state = replay(MOCK_RUN_ID);

	it('passes every machine node, keeps the ×2 badge, and opens the human gate', () => {
		expect(visuals(state)).toEqual({
			planner: 'passed',
			plan_check: 'passed',
			interviewer: 'passed',
			judge: 'passed',
			guard: 'passed',
			scorer: 'passed',
			evidence_check: 'passed',
			recruiter_gate: 'gate'
		});
		expect(state.nodes.scorer.retryBadge).toBe(2);
		expect(state.status).toBe('succeeded');
		expect(state.latestEdgeId).toBe('evidence_check>recruiter_gate');
	});
});

describe('§6.2 planner failure', () => {
	const state = replay(MOCK_PLANNER_FAILED_RUN_ID);

	it('fails the run and skips the downstream nodes', () => {
		expect(state.status).toBe('failed');
		expect(state.error).toBe('planner_invalid_after_retries');
		for (const id of ['interviewer', 'judge', 'guard', 'scorer', 'evidence_check'] as const) {
			expect(state.nodes[id]).toMatchObject({ visual: 'skipped', skipReason: 'run_failed' });
		}
		expect(state.nodes.plan_check.visual).toBe('failed');
		expect(state.nodes.planner.retryBadge).toBe(2);
		expect(state.edges.find((edge) => edge.id === 'plan_check>planner')?.taken).toBe(true);
	});
});

describe('§6.3 judge exception', () => {
	const isFinalJudgeFailure = (e: RunEvent) =>
		e.event === 'node.failed' && e.node_id === 'judge' && !e.data.will_retry;

	it('shows the judge failed with the default verdict, and the run keeps running', () => {
		const state = replayUntil(MOCK_JUDGE_OUTAGE_RUN_ID, isFinalJudgeFailure);
		expect(state.nodes.judge).toMatchObject({ visual: 'failed', defaultedVerdict: true });
		expect(state.status).toBe('running');
		expect(state.error).toBeNull();
	});

	it('runs guard and interviewer after it, and never skips or fails the downstream nodes', () => {
		const events = mockRunEvents[MOCK_JUDGE_OUTAGE_RUN_ID];
		const failure = events.findIndex(isFinalJudgeFailure);
		const after = events.slice(failure + 1);
		expect(after.some((e) => e.event === 'node.skipped' || e.event === 'run.failed')).toBe(false);

		const guardDone = replayUntil(
			MOCK_JUDGE_OUTAGE_RUN_ID,
			(e) => e.seq > failure + 1 && e.event === 'node.completed' && e.node_id === 'guard'
		);
		expect(guardDone.nodes.guard.visual).toBe('passed');
		expect(guardDone.edges.find((edge) => edge.id === 'judge>guard')?.taken).toBe(true);

		const end = replay(MOCK_JUDGE_OUTAGE_RUN_ID);
		expect(end.status).toBe('succeeded');
		expect(Object.values(end.nodes).some((node) => node.visual === 'skipped')).toBe(false);
	});
});

describe('manual planner retry (EVENTS.md §6.4)', () => {
	const isPlannerLoop = (e: RunEvent) =>
		e.event === 'edge.traversed' && e.data.from === 'planner' && e.data.to === 'planner';

	it('lights up the planner self-loop and badges the planner', () => {
		const state = replayUntil(MOCK_PLANNER_RETRY_RUN_ID, isPlannerLoop);
		expect(state.latestEdgeId).toBe('planner>planner');
		expect(state.edges.find((edge) => edge.id === 'planner>planner')).toMatchObject({
			taken: true,
			lastLabel: 'retry'
		});
		expect(state.nodes.planner).toMatchObject({
			visual: 'retry',
			attempt: 3,
			maxAttempts: 4,
			retryBadge: 3,
			retryReason: 'llm_unavailable'
		});
		expect(state.status).toBe('running');
	});

	it('runs planner and plan_check at attempt 3, then finishes the run', () => {
		const planned = replayUntil(
			MOCK_PLANNER_RETRY_RUN_ID,
			(e) => e.event === 'node.completed' && e.node_id === 'plan_check'
		);
		expect(planned.nodes.planner).toMatchObject({ visual: 'passed', attempt: 3, runs: 3 });
		expect(planned.nodes.plan_check).toMatchObject({ visual: 'passed', attempt: 3, runs: 1 });

		const end = replay(MOCK_PLANNER_RETRY_RUN_ID);
		expect(end.status).toBe('succeeded');
		expect(end.edges.find((edge) => edge.id === 'planner>planner')?.taken).toBe(true);
	});
});

describe('manual interviewer retry (server#9)', () => {
	it('takes the self-loop edge and makes it the latest', () => {
		const state = replayUntil(
			MOCK_MANUAL_RETRY_RUN_ID,
			(e) =>
				e.event === 'edge.traversed' && e.data.from === 'interviewer' && e.data.to === 'interviewer'
		);
		expect(state.latestEdgeId).toBe('interviewer>interviewer');
		expect(state.edges.find((edge) => edge.id === 'interviewer>interviewer')).toMatchObject({
			taken: true,
			retryPath: true,
			lastLabel: 'retry'
		});
		expect(state.nodes.interviewer).toMatchObject({
			visual: 'retry',
			attempt: 3,
			maxAttempts: 4,
			retryBadge: 3,
			retryReason: 'llm_unavailable'
		});
		expect(state.status).toBe('running');
	});

	it('runs the interviewer again at attempt 3 and finishes the run', () => {
		const rerun = replayUntil(
			MOCK_MANUAL_RETRY_RUN_ID,
			(e) => e.event === 'node.completed' && e.node_id === 'interviewer' && e.attempt === 3
		);
		expect(rerun.nodes.interviewer).toMatchObject({ visual: 'passed', attempt: 3 });

		const end = replay(MOCK_MANUAL_RETRY_RUN_ID);
		expect(end.status).toBe('succeeded');
		expect(end.nodes.interviewer.visual).toBe('passed');
		expect(end.nodes.interviewer.runs).toBe(4);
	});
});
