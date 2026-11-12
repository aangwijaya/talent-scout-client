// The live run stream and its reconnect (docs/EVENTS.md §4). The client reconnects by itself:
// after a connection error it mints a fresh `sse_token` and reopens with `since_seq=<last seq>`,
// after 1 s, 2 s, then 4 s. After three failed attempts it stays `lost` until `reconnect()`.
import { openRunStream, replayEvents, runStreamUrl, type RunEvent } from '$lib/events';

export type ConnectionStatus = 'connecting' | 'live' | 'lost' | 'reconnecting' | 'ended';

export type StreamHandlers = {
	onOpen: () => void;
	onEvent: (event: RunEvent) => void;
	onConnectionError: () => void;
};

/** Opens the run stream from `since_seq`; returns a function that closes it. */
export type StreamOpener = (
	sseToken: string,
	sinceSeq: number,
	handlers: StreamHandlers
) => () => void;

export type RunConnection = {
	open: (sseToken: string, sinceSeq: number) => void;
	reconnect: () => Promise<void>;
	close: () => void;
};

const RETRY_DELAYS_MS = [1000, 2000, 4000];

export function eventSourceOpener(streamUrl: string): StreamOpener {
	return (sseToken, sinceSeq, handlers) =>
		openRunStream(runStreamUrl(streamUrl, sseToken, sinceSeq), handlers);
}

/** Mock mode: replays `events` after `since_seq`, gradually for a running run, else at once. */
export function mockReplayOpener(
	events: readonly RunEvent[],
	{ gradual }: { gradual: boolean }
): StreamOpener {
	return (_sseToken, sinceSeq, { onOpen, onEvent }) => {
		const rest = events.filter((event) => event.seq > sinceSeq);
		onOpen();
		if (gradual) return replayEvents(rest, onEvent);
		rest.forEach(onEvent);
		return () => {};
	};
}

/**
 * Mints a token through the page's `./sse-token` endpoint. Returns null when signed out: the
 * guard's 303 is followed to the login page, so a redirected, non-2xx, or non-JSON response means
 * the session is gone. A network failure throws.
 */
export async function requestSseToken(
	url: string,
	fetchFn: typeof fetch = fetch
): Promise<string | null> {
	const res = await fetchFn(url, { method: 'POST' });
	const isJson = res.headers.get('content-type')?.includes('application/json') ?? false;
	if (res.redirected || !res.ok || !isJson) return null;
	return ((await res.json()) as { sse_token: string }).sse_token;
}

/** The login page query: return to `path` afterwards and say the session ended. */
export function loginSearch(path: string): string {
	return new URLSearchParams({ redirectTo: path, reason: 'session_ended' }).toString();
}

export function createRunConnection({
	openStream,
	mintToken,
	onEvent,
	onStatus,
	onSignedOut
}: {
	openStream: StreamOpener;
	/** A fresh `sse_token`, or null when signed out. */
	mintToken: () => Promise<string | null>;
	onEvent: (event: RunEvent) => void;
	onStatus: (status: ConnectionStatus) => void;
	onSignedOut: () => void;
}): RunConnection {
	let lastSeq = 0;
	let failedAttempts = 0;
	let ended = false;
	let closed = false;
	let stop: (() => void) | null = null;
	let retryTimer: ReturnType<typeof setTimeout> | null = null;

	function cancelRetry() {
		if (retryTimer !== null) clearTimeout(retryTimer);
		retryTimer = null;
	}

	function lost() {
		onStatus('lost');
		if (closed || ended || failedAttempts >= RETRY_DELAYS_MS.length) return;
		retryTimer = setTimeout(() => {
			retryTimer = null;
			failedAttempts += 1;
			void reconnect();
		}, RETRY_DELAYS_MS[failedAttempts]);
	}

	function open(sseToken: string, sinceSeq: number) {
		stop?.();
		lastSeq = Math.max(lastSeq, sinceSeq);
		onStatus('connecting');
		stop = openStream(sseToken, sinceSeq, {
			onOpen: () => {
				failedAttempts = 0;
				onStatus('live');
			},
			onEvent: (event) => {
				// The server replays `seq > since_seq`; skip anything already applied.
				if (event.seq <= lastSeq) return;
				lastSeq = event.seq;
				onEvent(event);
				if (event.event === 'run.completed' || event.event === 'run.failed') {
					ended = true;
					onStatus('ended');
				}
			},
			onConnectionError: () => {
				if (!ended) lost();
			}
		});
	}

	async function reconnect() {
		cancelRetry();
		onStatus('reconnecting');
		let token: string | null;
		try {
			token = await mintToken();
		} catch {
			if (!closed) lost();
			return;
		}
		if (closed) return;
		if (token === null) {
			closed = true;
			onSignedOut();
			return;
		}
		open(token, lastSeq);
	}

	function close() {
		closed = true;
		cancelRetry();
		stop?.();
	}

	return { open, reconnect, close };
}
