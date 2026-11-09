// Event types from docs/EVENTS.md. The EventSource wrapper (sse_token, reconnect) arrives in #10/#14.
import type {
	CurrentTopic,
	FinishReason,
	Message,
	NodeId,
	NodeType,
	RunStatus,
	SessionStatus,
	TopicStatus
} from '$lib/server/api/types';

/** `event` is the SSE `event:` line; the other fields are its JSON `data:` envelope. */
type Envelope<Name extends string, Data, Node extends NodeId | null = NodeId | null> = {
	event: Name;
	run_id: string;
	seq: number;
	ts: string;
	node_id: Node;
	attempt: number | null;
	data: Data;
};

export type MessageCompletedEvent = Envelope<'message.completed', { message: Message }>;

export type SessionEvent =
	| Envelope<
			'session.updated',
			{
				status: SessionStatus;
				deadline_at: string | null;
				question_count: number;
				max_questions: number;
				current_topic: CurrentTopic | null;
			}
	  >
	| Envelope<'message.delta', { message_id: string; delta: string }>
	| MessageCompletedEvent
	| Envelope<'session.ended', { finish_reason: FinishReason }>
	| Envelope<'error', { code: string; message: string; retryable: boolean }>;

export type EdgeLabel =
	| 'planned'
	| 'invalid'
	| 'valid'
	| 'question'
	| 'answer'
	| 'verdict'
	| 'follow_up'
	| 'next_topic'
	| 'finish'
	| 'retry'
	| 'scored';

export type RunEvent =
	| Envelope<
			'run.started',
			{
				session_id: string;
				nodes: { id: NodeId; type: NodeType }[];
				edges: { from: NodeId; to: NodeId }[];
			},
			null
	  >
	| Envelope<'node.started', { model: string | null; input_summary: string }, NodeId>
	| Envelope<
			'node.completed',
			{
				output_summary: string;
				tokens_in: number;
				tokens_out: number;
				duration_ms: number;
				cost_usd: number;
			},
			NodeId
	  >
	| Envelope<'node.failed', { error: string; will_retry: boolean }, NodeId>
	| Envelope<'node.skipped', { reason: string }, NodeId>
	| Envelope<'check.passed', { check: string; details: Record<string, unknown> }, NodeId>
	| Envelope<
			'check.failed',
			{ check: string; errors: { rubric_key?: string; reason: string; quote?: string }[] },
			NodeId
	  >
	| Envelope<
			'loop.retry',
			{ attempt: number; max_attempts: number; reason: string; feedback: string },
			NodeId
	  >
	| Envelope<'edge.traversed', { from: NodeId; to: NodeId; label: EdgeLabel }, null>
	| Envelope<
			'topic.changed',
			{ topic_id: string; position: number; title: string; status: TopicStatus },
			NodeId
	  >
	| MessageCompletedEvent
	| Envelope<
			'run.completed',
			{
				status: RunStatus;
				finish_reason: FinishReason;
				total_tokens_in: number;
				total_tokens_out: number;
				cost_usd: number;
				needs_manual_count: number;
			},
			null
	  >
	| Envelope<'run.failed', { error: string }, null>;

export type StreamEvent = SessionEvent | RunEvent;

const SESSION_EVENT_NAMES = [
	'session.updated',
	'message.delta',
	'message.completed',
	'session.ended',
	'error'
] as const satisfies readonly SessionEvent['event'][];

export type SessionStream = { ready: Promise<void>; close: () => void };

/**
 * Opens the applicant session stream (public token in the path, no credentials). The browser
 * reconnects on its own with `Last-Event-ID`; the replay has no `message.delta`, so
 * `onReconnect` lets the page rebuild the transcript from `GET /messages`. Closes on
 * `session.ended`. `ready` resolves on the first open, so the page can `POST /start` after it.
 */
export function openSessionStream(
	url: string,
	{ onEvent, onReconnect }: { onEvent: (event: SessionEvent) => void; onReconnect?: () => void }
): SessionStream {
	const source = new EventSource(url);
	let opened = false;
	let markReady: () => void = () => {};
	const ready = new Promise<void>((resolve) => (markReady = resolve));

	source.addEventListener('open', () => {
		if (opened) onReconnect?.();
		opened = true;
		markReady();
	});
	for (const name of SESSION_EVENT_NAMES) {
		source.addEventListener(name, (raw) => {
			// The browser's own connection errors also fire `error`, without data.
			if (!(raw instanceof MessageEvent) || typeof raw.data !== 'string') return;
			const event = { ...JSON.parse(raw.data), event: name } as SessionEvent;
			onEvent(event);
			if (name === 'session.ended') source.close();
		});
	}
	return { ready, close: () => source.close() };
}

function defaultDelayMs(): number {
	return 300 + Math.random() * 500;
}

/**
 * Mock mode's stand-in for an `EventSource`: delivers `events` one at a time, each after
 * `delayMs()` (300–800 ms by default). Returns a function that stops the replay.
 */
export function replayEvents<E extends StreamEvent>(
	events: readonly E[],
	onEvent: (event: E) => void,
	{ delayMs = defaultDelayMs, onDone }: { delayMs?: () => number; onDone?: () => void } = {}
): () => void {
	let timer: ReturnType<typeof setTimeout>;
	const deliver = (index: number) => {
		if (index === events.length) {
			onDone?.();
			return;
		}
		timer = setTimeout(() => {
			onEvent(events[index]);
			deliver(index + 1);
		}, delayMs());
	};
	deliver(0);
	return () => clearTimeout(timer);
}
