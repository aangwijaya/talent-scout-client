// Browser-safe replay data. JSON imports widen string unions, so the cast below cannot be checked
// by the compiler; `fixtures.test.ts` validates every file against docs/EVENTS.md instead.
import type { RunEvent, SessionEvent } from '$lib/events';
import type { Message } from '$lib/server/api/types';
import nodeFailed from './run-events-node-failed.json';
import needsManual from './run-events-needs-manual.json';
import plannerFailed from './run-events-planner-failed.json';
import running from './run-events-running.json';
import succeeded from './run-events.json';

export const MOCK_RUN_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
export const MOCK_NEEDS_MANUAL_RUN_ID = '1d3f5a7b-9c2e-4a6d-8f10-3b5d7f9a1c30';
export const MOCK_PLANNER_FAILED_RUN_ID = '4a8c2e6f-1b3d-4f5a-9e70-5c7a9b1d3f40';
export const MOCK_NODE_FAILED_RUN_ID = '8e2a4c6d-3f5b-4a7c-b190-6d8f0a2c4e50';
export const MOCK_RUNNING_RUN_ID = '2c4e6a8b-5d7f-4b9a-a1c3-7e9b1d3f5a60';
export const MOCK_SESSION_ID = '6f1c2a54-8d3e-4b7a-9c21-0a5e7d3b1f10';
export const MOCK_TOPIC_ID = '2b7e9c10-4f6a-4d28-8e13-7c9a1d5f3e20';

const asRunEvents = (events: unknown) => events as RunEvent[];

/** Replay data per run, in the order of docs/EVENTS.md §6. */
export const mockRunEvents: Readonly<Record<string, readonly RunEvent[]>> = {
	[MOCK_RUN_ID]: asRunEvents(succeeded),
	[MOCK_NEEDS_MANUAL_RUN_ID]: asRunEvents(needsManual),
	[MOCK_PLANNER_FAILED_RUN_ID]: asRunEvents(plannerFailed),
	[MOCK_NODE_FAILED_RUN_ID]: asRunEvents(nodeFailed),
	[MOCK_RUNNING_RUN_ID]: asRunEvents(running)
};

/** The transcript of the successful run: opening, answer, follow-up, answer. */
export const mockMessages: readonly Message[] = mockRunEvents[MOCK_RUN_ID].flatMap((event) =>
	event.event === 'message.completed' ? [event.data.message] : []
);

const assistantMessages = mockMessages.filter((message) => message.role === 'assistant');
const MAX_QUESTIONS = 15;
const CURRENT_TOPIC = { position: 1, title: 'State management', total: 1 };

/**
 * The session stream for one chat, grouped by AI turn. Replay turn 0 after `start` and turn N
 * after the applicant's Nth answer; the last turn ends the session. `deadlineAt` is a parameter
 * because a fixed timestamp would already be in the past when the countdown starts.
 */
export function mockSessionTurns(deadlineAt: string): SessionEvent[][] {
	let seq = 0;
	const envelope = () => ({
		run_id: MOCK_RUN_ID,
		seq: ++seq,
		ts: new Date().toISOString(),
		node_id: null,
		attempt: null
	});
	const updated = (questionCount: number): SessionEvent => ({
		...envelope(),
		event: 'session.updated',
		data: {
			status: 'active',
			deadline_at: deadlineAt,
			question_count: questionCount,
			max_questions: MAX_QUESTIONS,
			current_topic: CURRENT_TOPIC
		}
	});

	const turns = assistantMessages.map((message, index): SessionEvent[] => [
		updated(index + 1),
		...(message.content.match(/\S+\s*/g) ?? []).map((delta): SessionEvent => ({
			...envelope(),
			event: 'message.delta',
			data: { message_id: message.id, delta }
		})),
		{ ...envelope(), event: 'message.completed', data: { message } }
	]);

	return [
		...turns,
		[{ ...envelope(), event: 'session.ended', data: { finish_reason: 'completed' } }]
	];
}
