import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { replayEvents, type RunEvent } from './events';
import { MOCK_RUN_ID, mockRunEvents } from './mock';

const events = mockRunEvents[MOCK_RUN_ID].slice(0, 3);

describe('replayEvents', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('delivers events in order, one delay at a time, then reports completion', () => {
		const seen: RunEvent[] = [];
		const onDone = vi.fn();
		replayEvents(events, (event) => seen.push(event), { delayMs: () => 100, onDone });

		expect(seen).toEqual([]);
		vi.advanceTimersByTime(100);
		expect(seen).toEqual(events.slice(0, 1));
		expect(onDone).not.toHaveBeenCalled();
		vi.advanceTimersByTime(200);
		expect(seen).toEqual(events);
		expect(onDone).toHaveBeenCalledOnce();
	});

	it('waits 300–800 ms between events by default', () => {
		const onEvent = vi.fn();
		replayEvents(events, onEvent);
		vi.advanceTimersByTime(299);
		expect(onEvent).not.toHaveBeenCalled();
		vi.advanceTimersByTime(501);
		expect(onEvent).toHaveBeenCalledOnce();
	});

	it('stops delivering once cancelled', () => {
		const onEvent = vi.fn();
		const onDone = vi.fn();
		const stop = replayEvents(events, onEvent, { delayMs: () => 100, onDone });
		vi.advanceTimersByTime(100);
		stop();
		vi.advanceTimersByTime(1000);
		expect(onEvent).toHaveBeenCalledOnce();
		expect(onDone).not.toHaveBeenCalled();
	});
});
