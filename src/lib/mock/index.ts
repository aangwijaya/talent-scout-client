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

export const MOCK_JUDGE_OUTAGE_RUN_ID = '5b7d9f1a-2c4e-4a6b-8d0f-9a1c3e5b7d70';
export const MOCK_MANUAL_RETRY_RUN_ID = '9d1f3b5c-7e9a-4c2d-b4f6-0b2d4f6a8c80';

/**
 * server#9 added the interviewer self-loop (the applicant's manual retry) to `run.started.edges`,
 * after the JSON files were recorded; it is inserted here, after `guard → interviewer`.
 */
function withSelfLoop(event: RunEvent): RunEvent {
	if (event.event !== 'run.started') return event;
	const edges = event.data.edges.flatMap((edge) =>
		edge.from === 'guard' && edge.to === 'interviewer'
			? [edge, { from: 'interviewer' as const, to: 'interviewer' as const }]
			: [edge]
	);
	return { ...event, data: { ...event.data, edges } };
}

const asRunEvents = (events: unknown) => (events as RunEvent[]).map(withSelfLoop);

const successRun = asRunEvents(succeeded);

type EventOf<Name extends RunEvent['event']> = Extract<RunEvent, { event: Name }>;

function find<Name extends RunEvent['event']>(
	name: Name,
	match: (event: EventOf<Name>) => boolean = () => true,
	from = 0
): number {
	const index = successRun.findIndex(
		(event, i) => i >= from && event.event === name && match(event as EventOf<Name>)
	);
	if (index < 0) throw new Error(`run-events.json has no ${name}`);
	return index;
}

const at = <Name extends RunEvent['event']>(name: Name, index: number) =>
	successRun[index] as EventOf<Name>;

const failed = (
	started: EventOf<'node.started'>,
	attempt: number,
	will_retry: boolean
): RunEvent => ({
	...started,
	event: 'node.failed',
	attempt,
	data: { error: 'timeout', will_retry }
});

/** Gives a derived replay its own run id, `seq` 1…n, and a `ts` 2 s apart from the first event. */
function renumber(runId: string, events: readonly RunEvent[]): RunEvent[] {
	const start = Date.parse(events[0].ts);
	return events.map((event, index) => ({
		...event,
		run_id: runId,
		seq: index + 1,
		ts: new Date(start + index * 2000).toISOString()
	}));
}

/** §6.3 judge exception: both judge attempts fail, the run goes on with the default verdict. */
function judgeOutage(): RunEvent[] {
	const judgeIndex = find('node.started', (e) => e.node_id === 'judge');
	const judge = at('node.started', judgeIndex);
	const verdict = find('edge.traversed', (e) => e.data.from === 'judge');
	const guardIndex = find('node.started', (e) => e.node_id === 'guard');
	const guardDone = at(
		'node.completed',
		find('node.completed', (e) => e.node_id === 'guard')
	);
	const followUp = find('edge.traversed', (e) => e.data.from === 'guard');
	const topic = at('topic.changed', find('topic.changed'));
	return renumber(MOCK_JUDGE_OUTAGE_RUN_ID, [
		...successRun.slice(0, judgeIndex),
		judge,
		failed(judge, 1, true),
		{ ...judge, attempt: 2 },
		failed(judge, 2, false),
		successRun[verdict],
		successRun[guardIndex],
		{ ...guardDone, data: { ...guardDone.data, output_summary: 'next_topic' } },
		{
			...topic,
			node_id: 'guard',
			data: {
				topic_id: '3c8f0d21-5a7b-4e39-9f24-8d0b2e6a4f31',
				position: 2,
				title: 'Testing strategy',
				status: 'active'
			}
		},
		{
			...at('edge.traversed', followUp),
			data: { from: 'guard', to: 'interviewer', label: 'next_topic' }
		},
		...successRun.slice(followUp + 1)
	]);
}

/**
 * server#9: the interviewer fails its transport retry, the applicant presses retry
 * (`POST /sessions/{token}/retry`), and the interviewer runs again over its self-loop.
 */
function manualRetry(): RunEvent[] {
	const followUp = find('edge.traversed', (e) => e.data.from === 'guard');
	const index = find('node.started', (e) => e.node_id === 'interviewer', followUp);
	const started = at('node.started', index);
	return renumber(MOCK_MANUAL_RETRY_RUN_ID, [
		...successRun.slice(0, index),
		started,
		failed(started, 1, true),
		{ ...started, attempt: 2 },
		failed(started, 2, false),
		{
			...successRun[followUp],
			event: 'edge.traversed',
			node_id: null,
			attempt: null,
			data: { from: 'interviewer', to: 'interviewer', label: 'retry' }
		},
		...successRun.slice(index)
	]);
}

/** Replay data per run, in the order of docs/EVENTS.md §6. */
export const mockRunEvents: Readonly<Record<string, readonly RunEvent[]>> = {
	[MOCK_RUN_ID]: successRun,
	[MOCK_NEEDS_MANUAL_RUN_ID]: asRunEvents(needsManual),
	[MOCK_PLANNER_FAILED_RUN_ID]: asRunEvents(plannerFailed),
	[MOCK_NODE_FAILED_RUN_ID]: asRunEvents(nodeFailed),
	[MOCK_RUNNING_RUN_ID]: asRunEvents(running),
	[MOCK_JUDGE_OUTAGE_RUN_ID]: judgeOutage(),
	[MOCK_MANUAL_RETRY_RUN_ID]: manualRetry()
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
