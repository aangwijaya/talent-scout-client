import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	keepSessionStream,
	openSessionStream,
	replayEvents, type RunEvent, type SessionEvent } from './events';
import { MOCK_RUN_ID, mockRunEvents } from './mock';

class FakeEventSource {
	static last: FakeEventSource;
	static CONNECTING = 0;
	static OPEN = 1;
	static CLOSED = 2;
	listeners = new Map<string, ((e: Event) => void)[]>();
	closed = false;
	readyState = 0;
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
	emitRaw(type: string, data: string) {
		for (const fn of this.listeners.get(type) ?? []) fn(new MessageEvent(type, { data }));
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

	it('reports a connection error once the browser gives up (CLOSED)', () => {
		const onConnectionError = vi.fn();
		openSessionStream('u', { onEvent: () => {}, onConnectionError });
		const es = FakeEventSource.last;
		es.readyState = FakeEventSource.CLOSED;
		es.emit('error');
		expect(onConnectionError).toHaveBeenCalledOnce();
	});

	it('leaves a transient drop (CONNECTING) to the browser reconnect', () => {
		const onConnectionError = vi.fn();
		openSessionStream('u', { onEvent: () => {}, onConnectionError });
		const es = FakeEventSource.last;
		es.readyState = FakeEventSource.CONNECTING;
		es.emit('error');
		expect(onConnectionError).not.toHaveBeenCalled();
		expect(es.closed).toBe(false);
	});

	it('resolves ready on the first open, and close() stops the stream', async () => {
		const stream = openSessionStream('u', { onEvent: () => {} });
		FakeEventSource.last.emit('open');
		await expect(stream.ready).resolves.toBeUndefined();
		stream.close();
		expect(FakeEventSource.last.closed).toBe(true);
	});

	it('skips an event whose data is not valid JSON, and keeps delivering', () => {
		const seen: SessionEvent[] = [];
		openSessionStream('u', { onEvent: (e) => seen.push(e) });
		const es = FakeEventSource.last;
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(() => es.emitRaw('message.delta', '{not json')).not.toThrow();
		expect(() => es.emitRaw('message.delta', '')).not.toThrow();
		es.emit('message.delta', { ...envelope, data: { message_id: 'm', delta: 'ok' } });
		expect(seen).toHaveLength(1);
		expect(seen[0]).toMatchObject({ data: { delta: 'ok' } });
	});
});

describe('keepSessionStream', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal('EventSource', FakeEventSource);
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	const giveUp = () => {
		const es = FakeEventSource.last;
		es.readyState = FakeEventSource.CLOSED;
		es.emit('error');
		return es;
	};

	it('reopens the stream after the browser gives up, once the rebuild settles', async () => {
		const rebuild = vi.fn(async () => {});
		const onReady = vi.fn();
		keepSessionStream('u', { onEvent: () => {}, rebuild, onReady, retryMs: 5000 });
		FakeEventSource.last.emit('open');
		expect(onReady).toHaveBeenLastCalledWith(true);
		const first = giveUp();
		expect(onReady).toHaveBeenLastCalledWith(false);
		await vi.advanceTimersByTimeAsync(5000);
		expect(rebuild).toHaveBeenCalledOnce();
		expect(FakeEventSource.last).not.toBe(first);
		FakeEventSource.last.emit('open');
		expect(onReady).toHaveBeenLastCalledWith(true);
	});

	it('keeps reconnecting when the rebuild fails', async () => {
		const rebuild = vi.fn(() => Promise.reject(new Error('503')));
		keepSessionStream('u', { onEvent: () => {}, rebuild, retryMs: 5000 });
		const first = giveUp();
		await vi.advanceTimersByTimeAsync(5000);
		expect(FakeEventSource.last).not.toBe(first);
	});

	it('never reconnects after stop(), even when the rebuild settles later', async () => {
		let settle: () => void = () => {};
		const rebuild = vi.fn(() => new Promise<void>((resolve) => (settle = resolve)));
		const { stop } = keepSessionStream('u', { onEvent: () => {}, rebuild, retryMs: 5000 });
		const first = giveUp();
		stop();
		settle();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(FakeEventSource.last).toBe(first);
		expect(first.closed).toBe(true);
	});

	it('cancels a scheduled reconnect on stop()', async () => {
		const { stop } = keepSessionStream('u', {
			onEvent: () => {},
			rebuild: async () => {},
			retryMs: 5000
		});
		const first = giveUp();
		await vi.advanceTimersByTimeAsync(0);
		stop();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(FakeEventSource.last).toBe(first);
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
