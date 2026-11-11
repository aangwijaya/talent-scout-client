import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunEvent } from '$lib/events';
import { createRunConnection, type ConnectionStatus } from './run-stream';

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

describe('createRunConnection', () => {
	beforeEach(() => {
		FakeEventSource.all = [];
		vi.stubGlobal('EventSource', FakeEventSource);
	});
	afterEach(() => vi.unstubAllGlobals());

	function setup(mintToken = vi.fn(async () => 'fresh-token')) {
		const events: RunEvent[] = [];
		const statuses: ConnectionStatus[] = [];
		const connection = createRunConnection({
			streamUrl: STREAM,
			mintToken,
			onEvent: (event) => events.push(event),
			onStatus: (status) => statuses.push(status)
		});
		return { connection, events, statuses, mintToken };
	}

	it('opens with the sse_token and since_seq, and closes after run.completed', () => {
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

	it('stops on a connection error with no automatic retry', () => {
		const { connection, statuses } = setup();
		connection.open('t', 0);
		latest().emit('error');
		expect(latest().closed).toBe(true);
		expect(statuses.at(-1)).toBe('lost');
		expect(FakeEventSource.all).toHaveLength(1);
	});

	it('reconnects with a fresh token and since_seq = the last seq received', async () => {
		const { connection, statuses, mintToken } = setup();
		connection.open('old-token', 0);
		for (const seq of [1, 2, 3]) {
			latest().emit('topic.changed', {
				...envelope(seq),
				node_id: 'plan_check',
				data: { topic_id: 't', position: 1, title: 'T', status: 'active' }
			});
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
	});

	it('ignores replayed events it already has after a reconnect', async () => {
		const { connection, events } = setup();
		connection.open('t', 0);
		latest().emit('run.started', {
			...envelope(1),
			data: { session_id: 's', nodes: [], edges: [] }
		});
		latest().emit('error');
		await connection.reconnect();
		latest().emit('run.started', {
			...envelope(1),
			data: { session_id: 's', nodes: [], edges: [] }
		});
		expect(events).toHaveLength(1);
	});

	it('goes back to lost when minting the token fails', async () => {
		const { connection, statuses } = setup(vi.fn(async () => Promise.reject(new Error('401'))));
		connection.open('t', 0);
		latest().emit('error');
		await connection.reconnect();
		expect(statuses.slice(-2)).toEqual(['reconnecting', 'lost']);
		expect(FakeEventSource.all).toHaveLength(1);
	});
});
