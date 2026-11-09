import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openSessionStream, replayEvents, type RunEvent, type SessionEvent } from './events';
import { MOCK_RUN_ID, mockRunEvents } from './mock';

class FakeEventSource {
	static last: FakeEventSource;
	listeners = new Map<string, ((e: Event) => void)[]>();
	closed = false;
	constructor(readonly url: string) {
		FakeEventSource.last = this;
	}
	addEventListener(type: string, fn: (e: Event) => void) {
		this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
	}
	close() {
		this.closed = true;
	}
	emit(type: string, data?: unknown) {
		const e =
			data === undefined ? new Event(type) : new MessageEvent(type, { data: JSON.stringify(data) });
		for (const fn of this.listeners.get(type) ?? []) fn(e);
	}
}

describe('openSessionStream', () => {
	beforeEach(() => vi.stubGlobal('EventSource', FakeEventSource));
	afterEach(() => vi.unstubAllGlobals());

	const envelope = { run_id: 'r', seq: 1, ts: 't', node_id: null, attempt: null };

	it('parses named events, and closes on session.ended', () => {
		const seen: SessionEvent[] = [];
		openSessionStream('http://api.test/s/events', { onEvent: (e) => seen.push(e) });
		const es = FakeEventSource.last;
		es.emit('message.delta', { ...envelope, data: { message_id: 'm', delta: 'Hi' } });
		expect(seen[0]).toMatchObject({ event: 'message.delta', data: { delta: 'Hi' } });
		expect(es.closed).toBe(false);
		es.emit('session.ended', { ...envelope, data: { finish_reason: 'completed' } });
		expect(seen[1].event).toBe('session.ended');
		expect(es.closed).toBe(true);
	});

	it('reports a reconnect only on a later open, not the first', () => {
		const onReconnect = vi.fn();
		openSessionStream('u', { onEvent: () => {}, onReconnect });
		const es = FakeEventSource.last;
		es.emit('open');
		expect(onReconnect).not.toHaveBeenCalled();
		es.emit('error');
		es.emit('open');
		expect(onReconnect).toHaveBeenCalledOnce();
	});

	it('resolves ready on the first open, and close() stops the stream', async () => {
		const stream = openSessionStream('u', { onEvent: () => {} });
		FakeEventSource.last.emit('open');
		await expect(stream.ready).resolves.toBeUndefined();
		stream.close();
		expect(FakeEventSource.last.closed).toBe(true);
	});
});

const events = mockRunEvents[MOCK_RUN_ID].slice(0, 3);

describe('replayEvents', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

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

	it.each([
		['300 ms', 0, 300],
		['800 ms', 1, 800]
	])('waits at least %s between events by default', (_name, random, delay) => {
		vi.spyOn(Math, 'random').mockReturnValue(random);
		const onEvent = vi.fn();
		replayEvents(events, onEvent);
		vi.advanceTimersByTime(delay - 1);
		expect(onEvent).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
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
