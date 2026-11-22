import { describe, expect, it } from 'vitest';
import { formatCount } from '$lib/components/graph-layout';
import { formatCost } from '$lib/components/review';
import { MOCK_RUN_ID, mockRunEvents } from '$lib/mock';
import { graphRunSnapshot } from '$lib/server/api/fixtures';
import { initialRunState, reduceRun } from '$lib/stores/graph';
import { announcement, latestAnnouncement, receivedSeq, runHeader } from './header';

const snapshot = graphRunSnapshot(MOCK_RUN_ID)!;
const events = mockRunEvents[MOCK_RUN_ID];
const at = (count: number) =>
	runHeader(reduceRun(initialRunState(snapshot), events.slice(0, count)));

describe('runHeader', () => {
	it('takes the status and the totals from the same state', () => {
		const end = at(events.length);
		expect(end.status).toBe('succeeded');
		const completed = events.at(-1);
		if (completed?.event !== 'run.completed')
			throw new Error('the mock run must end with run.completed');
		expect(end.cost).toBe(formatCost(completed.data.cost_usd));
		expect(end.tokens).toBe(
			`${formatCount(completed.data.total_tokens_in)} in · ${formatCount(completed.data.total_tokens_out)} out`
		);

		// Stepping the replay back: the badge follows the totals instead of staying Succeeded.
		const middle = at(Math.floor(events.length / 2));
		expect(middle.status).toBe('running');
		expect(middle.cost).not.toBe(end.cost);
		expect(middle.tokens).not.toBe(end.tokens);
	});
});

describe('receivedSeq', () => {
	it('is 0 before the first event, then the seq of the newest one', () => {
		expect(receivedSeq([])).toBe(0);
		expect(receivedSeq(events.slice(0, 3))).toBe(events[2].seq);
	});
});

describe('announcement', () => {
	it('names node starts and the end of the run, and stays quiet on edges and checks', () => {
		const said = events.map(announcement);
		expect(said).toContain('planner started');
		expect(said).toContain('plan check started');
		expect(said.at(-1)).toBe('Run completed');
		events.forEach((event, i) => {
			if (event.event === 'edge.traversed' || event.event.startsWith('check.'))
				expect(said[i]).toBeNull();
		});
	});

	it('says failures and retries with the attempt', () => {
		const base = { run_id: 'r', seq: 1, ts: '', attempt: 2, node_id: 'judge' as const };
		expect(
			announcement({ ...base, event: 'node.failed', data: { error: 'x', will_retry: true } })
		).toBe('judge failed, retrying');
		expect(
			announcement({
				...base,
				event: 'loop.retry',
				data: { attempt: 2, max_attempts: 3, reason: 'r', feedback: 'f' }
			})
		).toBe('judge retry, attempt 2 of 3');
		expect(
			announcement({ ...base, node_id: null, event: 'run.failed', data: { error: 'boom' } })
		).toBe('Run failed');
	});

	it('picks the newest announceable event of a batch', () => {
		expect(latestAnnouncement([])).toBeNull();
		expect(latestAnnouncement(events)).toBe('Run completed');
	});
});
