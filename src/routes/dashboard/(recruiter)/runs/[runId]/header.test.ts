import { describe, expect, it } from 'vitest';
import { MOCK_RUN_ID, mockRunEvents } from '$lib/mock';
import { graphRunSnapshot } from '$lib/server/api/fixtures';
import { initialRunState, reduceRun } from '$lib/stores/graph';
import { receivedSeq, runHeader } from './header';

const snapshot = graphRunSnapshot(MOCK_RUN_ID)!;
const events = mockRunEvents[MOCK_RUN_ID];
const at = (count: number) =>
	runHeader(reduceRun(initialRunState(snapshot), events.slice(0, count)));

describe('runHeader', () => {
	it('takes the status and the totals from the same state', () => {
		const end = at(events.length);
		expect(end.status).toBe('succeeded');
		expect(end.cost).not.toBe('$0.0000');

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
