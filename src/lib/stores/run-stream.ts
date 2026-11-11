// The live run stream with the manual reconnect of docs/EVENTS.md §4 (#14): no automatic retry;
// `reconnect()` mints a fresh `sse_token` and reopens with `since_seq=<last seq received>`.
import { openRunStream, runStreamUrl, type RunEvent } from '$lib/events';

export type ConnectionStatus = 'connecting' | 'live' | 'lost' | 'reconnecting' | 'ended';

export type RunConnection = {
	open: (sseToken: string, sinceSeq: number) => void;
	reconnect: () => Promise<void>;
	close: () => void;
};

export function createRunConnection({
	streamUrl,
	mintToken,
	onEvent,
	onStatus
}: {
	streamUrl: string;
	mintToken: () => Promise<string>;
	onEvent: (event: RunEvent) => void;
	onStatus: (status: ConnectionStatus) => void;
}): RunConnection {
	let lastSeq = 0;
	let stop: (() => void) | null = null;

	function open(sseToken: string, sinceSeq: number) {
		stop?.();
		lastSeq = Math.max(lastSeq, sinceSeq);
		onStatus('connecting');
		stop = openRunStream(runStreamUrl(streamUrl, sseToken, sinceSeq), {
			onOpen: () => onStatus('live'),
			onEvent: (event) => {
				// The server replays `seq > since_seq`; skip anything already applied.
				if (event.seq <= lastSeq) return;
				lastSeq = event.seq;
				onEvent(event);
				if (event.event === 'run.completed' || event.event === 'run.failed') onStatus('ended');
			},
			onConnectionError: () => onStatus('lost')
		});
	}

	async function reconnect() {
		onStatus('reconnecting');
		let token: string;
		try {
			token = await mintToken();
		} catch {
			onStatus('lost');
			return;
		}
		open(token, lastSeq);
	}

	return { open, reconnect, close: () => stop?.() };
}
