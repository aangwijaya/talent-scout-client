import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunEvent } from '$lib/events';
import {
	createRunConnection,
	eventSourceOpener,
	loginPathFor,
	mockReplayOpener,
	requestSseToken,
	type ConnectionStatus,
	type StreamHandlers
} from './run-stream';

class FakeEventSource {
	static all: FakeEventSource[] = [];
	static CLOSED = 2;
	listeners = new Map<string, ((e: Event) => void)[]>();
	closed = false;
	readyState = 0;
	constructor(readonly url: string) {
		FakeEventSource.all.push(this);
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

const latest = () => FakeEventSource.all.at(-1) as FakeEventSource;
const STREAM = 'http://api.test/api/v1/graph-runs/r1/events';
const envelope = (seq: number) => ({ run_id: 'r1', seq, ts: 't', node_id: null, attempt: null });

const topicEvent = (seq: number): RunEvent => ({
	event: 'topic.changed',
	...envelope(seq),
	node_id: 'plan_check',
	data: { topic_id: 't', position: 1, title: 'T', status: 'active' }
});
const runFailed = (seq: number): RunEvent => ({
	event: 'run.failed',
	...envelope(seq),
	data: { error: 'x' }
});

describe('createRunConnection over EventSource', () => {
	beforeEach(() => {
		FakeEventSource.all = [];
		vi.stubGlobal('EventSource', FakeEventSource);
	});
	afterEach(() => vi.unstubAllGlobals());

	function setup(mintToken = vi.fn(async (): Promise<string | null> => 'fresh-token')) {
		const events: RunEvent[] = [];
		const statuses: ConnectionStatus[] = [];
		const connection = createRunConnection({
			openStream: eventSourceOpener(STREAM),
			mintToken,
			onEvent: (event) => events.push(event),
			onStatus: (status) => statuses.push(status),
			onSignedOut: () => {}
		});
		return { connection, events, statuses, mintToken };
	}

	it('opens with the sse_token and since_seq, and closes after run.failed', () => {
		const { connection, events, statuses } = setup();
		connection.open('first-token', 0);
		const url = new URL(latest().url);
		expect(url.origin + url.pathname).toBe(STREAM);
		expect(url.searchParams.get('sse_token')).toBe('first-token');
		expect(url.searchParams.get('since_seq')).toBe('0');
		latest().emit('open');
		latest().emit('edge.traversed', {
			...envelope(1),
			data: { from: 'planner', to: 'plan_check', label: 'planned' }
		});
		expect(events[0]).toMatchObject({ event: 'edge.traversed', seq: 1 });
		latest().emit('run.failed', { ...envelope(2), data: { error: 'x' } });
		expect(latest().closed).toBe(true);
		expect(statuses).toEqual(['connecting', 'live', 'ended']);
	});

	it('closes the EventSource on an error, so the browser never retries a stale token', () => {
		const { connection, statuses } = setup();
		connection.open('t', 0);
		latest().emit('error');
		expect(latest().closed).toBe(true);
		expect(statuses.at(-1)).toBe('lost');
		expect(FakeEventSource.all).toHaveLength(1);
		connection.close();
	});

	it('reconnects with a fresh token and since_seq = the last seq received', async () => {
		const { connection, statuses, mintToken } = setup();
		connection.open('old-token', 0);
		for (const seq of [1, 2, 3]) {
			const { event, ...payload } = topicEvent(seq);
			latest().emit(event, payload);
		}
		latest().emit('error');

		const done = connection.reconnect();
		expect(statuses.at(-1)).toBe('reconnecting');
		await done;
		expect(mintToken).toHaveBeenCalledOnce();
		const url = new URL(latest().url);
		expect(url.searchParams.get('sse_token')).toBe('fresh-token');
		expect(url.searchParams.get('since_seq')).toBe('3');
		expect(FakeEventSource.all).toHaveLength(2);
		connection.close();
	});

	it('goes back to lost when minting the token fails', async () => {
		const { connection, statuses } = setup(vi.fn(async () => Promise.reject(new Error('network'))));
		connection.open('t', 0);
		latest().emit('error');
		await connection.reconnect();
		expect(statuses.slice(-2)).toEqual(['reconnecting', 'lost']);
		expect(FakeEventSource.all).toHaveLength(1);
		connection.close();
	});
});

/** A stand-in for the stream opener: records every open and lets the test drive its handlers. */
function fakeOpener() {
	const opens: { token: string; sinceSeq: number; handlers: StreamHandlers }[] = [];
	const openStream = vi.fn((token: string, sinceSeq: number, handlers: StreamHandlers) => {
		opens.push({ token, sinceSeq, handlers });
		return () => {};
	});
	return { opens, openStream, last: () => opens[opens.length - 1] };
}

describe('createRunConnection: automatic reconnect', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	function setup(mintToken = vi.fn(async (): Promise<string | null> => 'fresh')) {
		const opener = fakeOpener();
		const events: RunEvent[] = [];
		const statuses: ConnectionStatus[] = [];
		const onSignedOut = vi.fn();
		const connection = createRunConnection({
			openStream: opener.openStream,
			mintToken,
			onEvent: (event) => events.push(event),
			onStatus: (status) => statuses.push(status),
			onSignedOut
		});
		return { connection, opener, events, statuses, mintToken, onSignedOut };
	}

	it('retries after 1 s, then 2 s, then 4 s, and stays lost after 3 failed attempts', async () => {
		const { connection, opener, statuses } = setup();
		connection.open('first', 0);
		opener.last().handlers.onConnectionError();
		expect(statuses.at(-1)).toBe('lost');

		for (const delay of [1000, 2000, 4000]) {
			const before = opener.opens.length;
			await vi.advanceTimersByTimeAsync(delay - 1);
			expect(opener.opens).toHaveLength(before);
			await vi.advanceTimersByTimeAsync(1);
			expect(opener.opens).toHaveLength(before + 1);
			opener.last().handlers.onConnectionError();
		}

		await vi.advanceTimersByTimeAsync(60_000);
		expect(opener.opens).toHaveLength(4);
		expect(statuses.at(-1)).toBe('lost');
	});

	it('counts a failed mint as a failed attempt', async () => {
		const mintToken = vi.fn(async (): Promise<string | null> => {
			throw new Error('network');
		});
		const { connection, opener, statuses } = setup(mintToken);
		connection.open('first', 0);
		opener.last().handlers.onConnectionError();
		await vi.advanceTimersByTimeAsync(1000 + 2000 + 4000 + 60_000);
		expect(mintToken).toHaveBeenCalledTimes(3);
		expect(opener.opens).toHaveLength(1);
		expect(statuses.at(-1)).toBe('lost');
	});

	it('resets the attempt counter after a successful open', async () => {
		const { connection, opener } = setup();
		connection.open('first', 0);
		opener.last().handlers.onConnectionError();
		await vi.advanceTimersByTimeAsync(1000);
		opener.last().handlers.onConnectionError();
		await vi.advanceTimersByTimeAsync(2000);
		expect(opener.opens).toHaveLength(3);

		opener.last().handlers.onOpen();
		opener.last().handlers.onConnectionError();
		await vi.advanceTimersByTimeAsync(999);
		expect(opener.opens).toHaveLength(3);
		await vi.advanceTimersByTimeAsync(1);
		expect(opener.opens).toHaveLength(4);
	});

	it('cancels a pending retry on close()', async () => {
		const { connection, opener, mintToken } = setup();
		connection.open('first', 0);
		opener.last().handlers.onConnectionError();
		connection.close();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(mintToken).not.toHaveBeenCalled();
		expect(opener.opens).toHaveLength(1);
	});

	it('does not open a stream when close() lands while a token is being minted', async () => {
		let resolveMint: (token: string) => void = () => {};
		const mintToken = vi.fn(() => new Promise<string | null>((r) => (resolveMint = r)));
		const { connection, opener } = setup(mintToken);
		connection.open('first', 0);
		opener.last().handlers.onConnectionError();
		await vi.advanceTimersByTimeAsync(1000);
		connection.close();
		resolveMint('late');
		await vi.advanceTimersByTimeAsync(0);
		expect(opener.opens).toHaveLength(1);
	});

	it('stops retrying and reports signed out when the mint says so', async () => {
		const mintToken = vi.fn(async (): Promise<string | null> => null);
		const { connection, opener, onSignedOut } = setup(mintToken);
		connection.open('first', 0);
		opener.last().handlers.onConnectionError();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(mintToken).toHaveBeenCalledOnce();
		expect(onSignedOut).toHaveBeenCalledOnce();
		expect(opener.opens).toHaveLength(1);
	});

	it('does not retry once the run has ended', async () => {
		const { connection, opener, statuses } = setup();
		connection.open('first', 0);
		opener.last().handlers.onEvent(runFailed(1));
		opener.last().handlers.onConnectionError();
		expect(statuses.at(-1)).toBe('ended');
		await vi.advanceTimersByTimeAsync(60_000);
		expect(opener.opens).toHaveLength(1);
	});

	it('reopens from the last seq and drops events it already has', async () => {
		const { connection, opener, events } = setup();
		connection.open('first', 0);
		opener.last().handlers.onOpen();
		for (const seq of [1, 2, 3]) opener.last().handlers.onEvent(topicEvent(seq));
		opener.last().handlers.onConnectionError();
		await vi.advanceTimersByTimeAsync(1000);
		expect(opener.last()).toMatchObject({ token: 'fresh', sinceSeq: 3 });
		for (const seq of [2, 3, 4]) opener.last().handlers.onEvent(topicEvent(seq));
		expect(events.map((e) => e.seq)).toEqual([1, 2, 3, 4]);
	});
});

describe('requestSseToken', () => {
	const respond = (body: string, init: ResponseInit, redirected = false) => {
		const res = new Response(body, init);
		if (redirected) Object.defineProperty(res, 'redirected', { value: true });
		return vi.fn(async (): Promise<Response> => res);
	};
	const JSON_HEADERS = { 'content-type': 'application/json' };
	const HTML_HEADERS = { 'content-type': 'text/html' };

	it('returns the token from a JSON response', async () => {
		const fetchFn = respond(JSON.stringify({ sse_token: 'abc' }), { headers: JSON_HEADERS });
		await expect(requestSseToken('/dashboard/runs/r1/sse-token', fetchFn)).resolves.toBe('abc');
		expect(fetchFn).toHaveBeenCalledWith('/dashboard/runs/r1/sse-token', { method: 'POST' });
	});

	it('treats the guard redirect to the login page as signed out', async () => {
		const fetchFn = respond('<html>login</html>', { headers: HTML_HEADERS }, true);
		await expect(requestSseToken('/x', fetchFn)).resolves.toBeNull();
	});

	it('treats a redirected JSON response as signed out', async () => {
		const fetchFn = respond(JSON.stringify({ sse_token: 'abc' }), { headers: JSON_HEADERS }, true);
		await expect(requestSseToken('/x', fetchFn)).resolves.toBeNull();
	});

	it('treats a non-JSON response as signed out', async () => {
		const fetchFn = respond('<html>login</html>', { headers: HTML_HEADERS });
		await expect(requestSseToken('/x', fetchFn)).resolves.toBeNull();
	});

	it('treats a non-2xx status as signed out', async () => {
		const fetchFn = respond(JSON.stringify({ message: 'no' }), {
			status: 401,
			headers: JSON_HEADERS
		});
		await expect(requestSseToken('/x', fetchFn)).resolves.toBeNull();
	});

	it('lets a network failure throw, so it counts as a failed attempt', async () => {
		const fetchFn = vi.fn(async (): Promise<Response> => {
			throw new TypeError('Failed to fetch');
		});
		await expect(requestSseToken('/x', fetchFn)).rejects.toThrow('Failed to fetch');
	});
});

describe('loginPathFor', () => {
	it('returns to the current path after login and says the session ended', () => {
		const url = new URL(loginPathFor('/dashboard/runs/r1?from=a'), 'http://x');
		expect(url.pathname).toBe('/dashboard/login');
		expect(url.searchParams.get('redirectTo')).toBe('/dashboard/runs/r1?from=a');
		expect(url.searchParams.get('reason')).toBe('session_ended');
	});
});

describe('mockReplayOpener', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});
	const fixture = [topicEvent(1), topicEvent(2), runFailed(3)];

	function drive(gradual: boolean) {
		const events: RunEvent[] = [];
		const statuses: ConnectionStatus[] = [];
		const connection = createRunConnection({
			openStream: mockReplayOpener(fixture, { gradual }),
			mintToken: async () => 'mock',
			onEvent: (event) => events.push(event),
			onStatus: (status) => statuses.push(status),
			onSignedOut: () => {}
		});
		connection.open('', 0);
		return { connection, events, statuses };
	}

	it('delivers an ended run at once', () => {
		const { events, statuses } = drive(false);
		expect(events.map((e) => e.seq)).toEqual([1, 2, 3]);
		expect(statuses.at(-1)).toBe('ended');
	});

	it('delivers a running run gradually, and close() stops it', async () => {
		vi.spyOn(Math, 'random').mockReturnValue(0);
		const { connection, events, statuses } = drive(true);
		expect(statuses.at(-1)).toBe('live');
		expect(events).toHaveLength(0);
		await vi.advanceTimersByTimeAsync(300);
		expect(events.map((e) => e.seq)).toEqual([1]);
		connection.close();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(events).toHaveLength(1);
	});

	it('delivers only the events after since_seq on a reopen', () => {
		const opened: RunEvent[] = [];
		mockReplayOpener(fixture, { gradual: false })('', 2, {
			onOpen: () => {},
			onEvent: (event) => opened.push(event),
			onConnectionError: () => {}
		});
		expect(opened.map((e) => e.seq)).toEqual([3]);
	});
});
