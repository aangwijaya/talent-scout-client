// Applicant chat state as a pure reducer; the page keeps one copy in `$state` per visit.
import type { SessionEvent } from '$lib/events';
import type {
	CurrentTopic,
	FinishReason,
	Message,
	SessionInfo,
	SessionStatus
} from '$lib/server/api/types';

export type ChatState = {
	status: SessionStatus;
	deadline_at: string | null;
	question_count: number;
	max_questions: number;
	current_topic: CurrentTopic | null;
	messages: Message[];
	/** The AI reply being streamed; replaced by `message.completed`. */
	streaming: { message_id: string; text: string } | null;
	/** Input is locked while the AI owes a reply, or once the session has ended. */
	awaiting: boolean;
	finish_reason: FinishReason | null;
	error: { retryable: boolean } | null;
};

const lastIsAssistant = (messages: readonly Message[]) => messages.at(-1)?.role === 'assistant';

export function initialChat(session: SessionInfo, messages: readonly Message[]): ChatState {
	return {
		status: session.status,
		deadline_at: session.deadline_at,
		question_count: session.question_count,
		max_questions: session.max_questions,
		current_topic: session.current_topic,
		messages: [...messages],
		streaming: null,
		awaiting: !lastIsAssistant(messages),
		finish_reason: null,
		error: null
	};
}

/** After a reconnect: the transcript from `GET /messages` wins, half-streamed text is dropped. */
export function rebuildChat(chat: ChatState, messages: readonly Message[]): ChatState {
	return {
		...chat,
		messages: [...messages],
		streaming: null,
		awaiting: chat.finish_reason !== null || !lastIsAssistant(messages)
	};
}

/** The action result can lose the race to the stream's `message.completed` for the same answer. */
export function sendingAnswer(chat: ChatState, answer: Message): ChatState {
	const known = chat.messages.some((m) => m.id === answer.id);
	const messages = known ? chat.messages : [...chat.messages, answer];
	return {
		...chat,
		messages,
		awaiting: chat.finish_reason !== null || !lastIsAssistant(messages),
		error: null
	};
}

export function reduceChat(chat: ChatState, event: SessionEvent): ChatState {
	switch (event.event) {
		case 'session.updated': {
			const { status, deadline_at, question_count, max_questions, current_topic } = event.data;
			return { ...chat, status, deadline_at, question_count, max_questions, current_topic };
		}
		case 'message.delta': {
			const { message_id, delta } = event.data;
			const text = chat.streaming?.message_id === message_id ? chat.streaming.text : '';
			return { ...chat, streaming: { message_id, text: text + delta }, error: null };
		}
		case 'message.completed': {
			const { message } = event.data;
			const known = chat.messages.some((m) => m.id === message.id);
			return {
				...chat,
				messages: known ? chat.messages : [...chat.messages, message],
				streaming: null,
				awaiting: chat.finish_reason !== null || message.role !== 'assistant',
				error: null
			};
		}
		case 'session.ended':
			return {
				...chat,
				finish_reason: event.data.finish_reason,
				streaming: null,
				awaiting: true,
				error: null
			};
		case 'error':
			return { ...chat, streaming: null, error: { retryable: event.data.retryable } };
	}
}
