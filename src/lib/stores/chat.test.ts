import { describe, expect, it } from 'vitest';
import type { SessionEvent } from '$lib/events';
import type { Message, SessionInfo } from '$lib/server/api/types';
import {
	answerHeld,
	initialChat,
	inputLocked,
	rebuildChat,
	reduceChat,
	releaseHeld,
	sendingAnswer
} from './chat';

const session: SessionInfo = {
	status: 'invited',
	job_title: 'Senior Frontend Engineer',
	applicant_name: 'Rani',
	expires_at: '2026-11-20T00:00:00Z',
	started_at: null,
	deadline_at: null,
	max_minutes: 15,
	topic_count: null,
	question_count: 0,
	max_questions: 15,
	current_topic: null
};

const opening: Message = {
	id: 'm1',
	role: 'assistant',
	kind: 'question',
	topic_id: 't1',
	content: 'Tell me about a project.',
	created_at: '2026-11-09T10:00:00Z'
};

let seq = 0;
function ev<E extends SessionEvent['event']>(
	event: E,
	data: Extract<SessionEvent, { event: E }>['data']
): SessionEvent {
	return {
		event,
		data,
		run_id: 'r',
		seq: ++seq,
		ts: '2026-11-09T10:00:00Z',
		node_id: null,
		attempt: null
	} as SessionEvent;
}

describe('reduceChat', () => {
	it('locks input before the opening message and unlocks on message.completed', () => {
		let chat = initialChat(session, []);
		expect(chat.awaiting).toBe(true);
		chat = reduceChat(chat, ev('message.delta', { message_id: 'm1', delta: 'Tell me ' }));
		chat = reduceChat(chat, ev('message.delta', { message_id: 'm1', delta: 'about' }));
		expect(chat.streaming).toEqual({ message_id: 'm1', text: 'Tell me about' });
		expect(chat.awaiting).toBe(true);
		chat = reduceChat(chat, ev('message.completed', { message: opening }));
		expect(chat.streaming).toBeNull();
		expect(chat.messages).toEqual([opening]);
		expect(chat.awaiting).toBe(false);
	});

	it('renders message.completed content, replacing the streamed chunks', () => {
		let chat = initialChat(session, []);
		chat = reduceChat(chat, ev('message.delta', { message_id: 'm1', delta: 'garbled' }));
		chat = reduceChat(chat, ev('message.completed', { message: opening }));
		expect(chat.messages[0].content).toBe(opening.content);
	});

	it("keeps input locked on the applicant's own message.completed until the AI replies", () => {
		const answer: Message = { ...opening, id: 'm2', role: 'applicant', kind: 'answer' };
		let chat = sendingAnswer(initialChat(session, [opening]), answer);
		chat = reduceChat(chat, ev('message.completed', { message: answer }));
		expect(chat.awaiting).toBe(true);
		const reply: Message = { ...opening, id: 'm3' };
		chat = reduceChat(chat, ev('message.completed', { message: reply }));
		expect(chat.awaiting).toBe(false);
	});

	// EVENTS.md: a retryable `error` (llm_unavailable) waits for POST /retry; a send then is 409.
	it('keeps the input locked while a retryable error waits for Retry', () => {
		const opening0 = initialChat({ ...session, status: 'active' }, []);
		expect(
			inputLocked(
				reduceChat(
					opening0,
					ev('error', { code: 'llm_unavailable', message: 'x', retryable: true })
				)
			)
		).toBe(true);

		const answer: Message = { ...opening, id: 'm2', role: 'applicant', kind: 'answer' };
		let chat = sendingAnswer(initialChat(session, [opening]), answer);
		chat = reduceChat(chat, ev('message.completed', { message: answer }));
		chat = reduceChat(
			chat,
			ev('error', { code: 'llm_unavailable', message: 'x', retryable: true })
		);
		expect(inputLocked(chat)).toBe(true);
	});

	it('ignores a duplicate message.completed', () => {
		let chat = initialChat(session, [opening]);
		chat = reduceChat(chat, ev('message.completed', { message: opening }));
		expect(chat.messages).toHaveLength(1);
	});

	it('applies session.updated', () => {
		const chat = reduceChat(
			initialChat(session, []),
			ev('session.updated', {
				status: 'active',
				deadline_at: '2026-11-09T10:15:00Z',
				question_count: 3,
				max_questions: 15,
				current_topic: { position: 2, title: 'State', total: 4 }
			})
		);
		expect(chat.status).toBe('active');
		expect(chat.deadline_at).toBe('2026-11-09T10:15:00Z');
		expect(chat.current_topic).toEqual({ position: 2, title: 'State', total: 4 });
	});

	it('ends the session and locks input on session.ended', () => {
		const chat = reduceChat(
			initialChat(session, [opening]),
			ev('session.ended', { finish_reason: 'failed' })
		);
		expect(chat.finish_reason).toBe('failed');
		expect(chat.awaiting).toBe(true);
	});

	it('keeps input locked on a retryable error and records it', () => {
		const chat = reduceChat(
			initialChat(session, []),
			ev('error', { code: 'llm_unavailable', message: 'x', retryable: true })
		);
		expect(chat.error).toEqual({ retryable: true });
		expect(chat.awaiting).toBe(true);
	});
});

describe('sendingAnswer', () => {
	it('appends the answer, locks input, and clears an earlier error', () => {
		const answer: Message = { ...opening, id: 'm2', role: 'applicant', kind: 'answer' };
		const chat = sendingAnswer({ ...initialChat(session, [opening]), error: null }, answer);
		expect(chat.messages.map((m) => m.id)).toEqual(['m1', 'm2']);
		expect(chat.awaiting).toBe(true);
	});

	it('does not duplicate an answer the stream already delivered as message.completed', () => {
		const answer: Message = { ...opening, id: 'm2', role: 'applicant', kind: 'answer' };
		let chat = reduceChat(
			initialChat(session, [opening]),
			ev('message.completed', { message: answer })
		);
		chat = sendingAnswer(chat, answer);
		expect(chat.messages.map((m) => m.id)).toEqual(['m1', 'm2']);
		expect(chat.awaiting).toBe(true);
	});

	it('keeps the AI reply last and input unlocked when the reply arrived before the action result', () => {
		const answer: Message = { ...opening, id: 'm2', role: 'applicant', kind: 'answer' };
		const reply: Message = { ...opening, id: 'm3' };
		let chat = reduceChat(
			initialChat(session, [opening]),
			ev('message.completed', { message: answer })
		);
		chat = reduceChat(chat, ev('message.completed', { message: reply }));
		chat = sendingAnswer(chat, answer);
		expect(chat.messages.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
		expect(chat.awaiting).toBe(false);
	});

	it('stays locked after session.ended even if the answer was already known', () => {
		const answer: Message = { ...opening, id: 'm2', role: 'applicant', kind: 'answer' };
		let chat = reduceChat(
			initialChat(session, [opening]),
			ev('message.completed', { message: answer })
		);
		chat = reduceChat(chat, ev('message.completed', { message: { ...opening, id: 'm3' } }));
		chat = reduceChat(chat, ev('session.ended', { finish_reason: 'completed' }));
		chat = sendingAnswer(chat, answer);
		expect(chat.awaiting).toBe(true);
	});
});

describe('rebuildChat', () => {
	it('replaces the transcript from GET /messages and drops streamed chunks', () => {
		let chat = initialChat({ ...session, status: 'active' }, []);
		chat = reduceChat(chat, ev('message.delta', { message_id: 'm1', delta: 'half' }));
		chat = rebuildChat(chat, [opening]);
		expect(chat.streaming).toBeNull();
		expect(chat.messages).toEqual([opening]);
		expect(chat.awaiting).toBe(false);
	});

	it('stays locked when the last message is the applicant answer', () => {
		const answer: Message = { ...opening, id: 'm2', role: 'applicant', kind: 'answer' };
		const chat = rebuildChat(initialChat({ ...session, status: 'active' }, []), [opening, answer]);
		expect(chat.awaiting).toBe(true);
	});
});

describe('answer lock and draft (client#63)', () => {
	const answer: Message = { ...opening, id: 'm2', role: 'applicant', kind: 'answer' };

	it('keeps the input locked from Start until the opening message.completed', () => {
		let chat = initialChat({ ...session, status: 'active' }, []);
		expect(inputLocked(chat)).toBe(true);
		chat = reduceChat(chat, ev('message.delta', { message_id: 'm1', delta: 'Tell me' }));
		expect(inputLocked(chat)).toBe(true);
		chat = reduceChat(chat, ev('message.completed', { message: opening }));
		expect(inputLocked(chat)).toBe(false);
	});

	it('locks again after a send until the next assistant message.completed', () => {
		let chat = { ...initialChat({ ...session, status: 'active' }, [opening]), draft: 'my answer' };
		chat = sendingAnswer(chat, answer);
		expect(chat.draft).toBe('');
		expect(inputLocked(chat)).toBe(true);
		chat = reduceChat(chat, ev('message.completed', { message: answer }));
		expect(inputLocked(chat)).toBe(true);
		chat = reduceChat(chat, ev('message.completed', { message: { ...opening, id: 'm3' } }));
		expect(inputLocked(chat)).toBe(false);
	});

	it('a 409 invalid_state keeps the draft and holds the input in the waiting state', () => {
		let chat = {
			...initialChat({ ...session, status: 'active' }, [opening]),
			draft: 'my first answer'
		};
		chat = answerHeld(chat);
		expect(chat.draft).toBe('my first answer');
		expect(chat.messages).toEqual([opening]);
		expect(chat.held).toBe(true);
		expect(inputLocked(chat)).toBe(true);
		// A late event must not unlock the box over the held draft.
		chat = reduceChat(chat, ev('message.completed', { message: { ...opening, id: 'm3' } }));
		expect(inputLocked(chat)).toBe(true);
		chat = releaseHeld(chat);
		expect(chat.draft).toBe('my first answer');
		expect(inputLocked(chat)).toBe(false);
	});

	it('session.ended clears a held answer and stays locked', () => {
		let chat = answerHeld({ ...initialChat(session, [opening]), draft: 'x' });
		chat = reduceChat(chat, ev('session.ended', { finish_reason: 'time_limit' }));
		expect(chat.held).toBe(false);
		expect(inputLocked(chat)).toBe(true);
	});
});
