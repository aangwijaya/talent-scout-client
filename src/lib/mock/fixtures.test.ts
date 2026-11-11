import type { RunEvent, StreamEvent } from '$lib/events';
import { applications, graphRunSnapshot, jobs } from '$lib/server/api/fixtures';
import { describe, expect, it } from 'vitest';
import {
	MOCK_JUDGE_OUTAGE_RUN_ID,
	MOCK_MANUAL_RETRY_RUN_ID,
	MOCK_NEEDS_MANUAL_RUN_ID,
	MOCK_NODE_FAILED_RUN_ID,
	MOCK_PLANNER_FAILED_RUN_ID,
	MOCK_RUN_ID,
	mockMessages,
	mockRunEvents,
	mockSessionTurns
} from '.';

/** Required `data` keys per event, from docs/EVENTS.md §3–§5. JSON cannot be type-checked. */
const PAYLOAD_KEYS: Record<StreamEvent['event'], string[]> = {
	'session.updated': ['status', 'deadline_at', 'question_count', 'max_questions', 'current_topic'],
	'message.delta': ['message_id', 'delta'],
	'message.completed': ['message'],
	'session.ended': ['finish_reason'],
	error: ['code', 'message', 'retryable'],
	'run.started': ['session_id', 'nodes', 'edges'],
	'run.completed': [
		'status',
		'finish_reason',
		'total_tokens_in',
		'total_tokens_out',
		'cost_usd',
		'needs_manual_count'
	],
	'run.failed': ['error'],
	'node.started': ['model', 'input_summary'],
	'node.completed': ['output_summary', 'tokens_in', 'tokens_out', 'duration_ms', 'cost_usd'],
	'node.failed': ['error', 'will_retry'],
	'node.skipped': ['reason'],
	'check.passed': ['check', 'details'],
	'check.failed': ['check', 'errors'],
	'loop.retry': ['attempt', 'max_attempts', 'reason', 'feedback'],
	'edge.traversed': ['from', 'to', 'label'],
	'topic.changed': ['topic_id', 'position', 'title', 'status']
};

function expectValidEnvelope(event: StreamEvent, seq: number) {
	expect(Object.keys(event).sort()).toEqual(
		['attempt', 'data', 'event', 'node_id', 'run_id', 'seq', 'ts'].sort()
	);
	expect(event.seq).toBe(seq);
	expect(new Date(event.ts).toISOString()).toBeTruthy();
	expect(Object.keys(event.data).sort()).toEqual([...PAYLOAD_KEYS[event.event]].sort());
}

function compact(events: readonly RunEvent[]): string[] {
	return events.map((event) => {
		const node = event.node_id
			? `(${event.node_id}${event.attempt ? `#${event.attempt}` : ''})`
			: '';
		if (event.event === 'edge.traversed') {
			const { from, to, label } = event.data;
			return `edge ${from}>${to} ${label}`;
		}
		return `${event.event}${node}`;
	});
}

const node = (name: string, attempt = 1) => [
	`node.started(${name}#${attempt})`,
	`node.completed(${name}#${attempt})`
];

const planOk = [
	'run.started',
	...node('planner'),
	'edge planner>plan_check planned',
	...node('plan_check'),
	'check.passed(plan_check#1)',
	'topic.changed(plan_check#1)',
	'edge plan_check>interviewer valid'
];

const interviewerTurn = [
	'node.started(interviewer#1)',
	'message.completed(interviewer#1)',
	'node.completed(interviewer#1)',
	'message.completed(interviewer)',
	'edge interviewer>judge answer'
];

const chat = [
	...interviewerTurn,
	...node('judge'),
	'edge judge>guard verdict',
	...node('guard'),
	'edge guard>interviewer follow_up',
	...interviewerTurn,
	...node('judge'),
	'edge judge>guard verdict',
	...node('guard'),
	'edge guard>scorer finish'
];

const scoreInvalid = (attempt: number) => [
	...node('scorer', attempt),
	'edge scorer>evidence_check scored',
	...node('evidence_check', attempt),
	`check.failed(evidence_check#${attempt})`
];

const retry = (attempt: number) => [
	`loop.retry(scorer#${attempt})`,
	'edge evidence_check>scorer retry'
];

const skipped = (...names: string[]) => names.map((name) => `node.skipped(${name})`);

describe('run replay data', () => {
	it.each(Object.entries(mockRunEvents))('%s has valid envelopes and payloads', (runId, events) => {
		events.forEach((event, index) => {
			expectValidEnvelope(event, index + 1);
			expect(event.run_id).toBe(runId);
		});
	});

	it('follows §6.1 for a successful run', () => {
		expect(compact(mockRunEvents[MOCK_RUN_ID])).toEqual([
			...planOk,
			...chat,
			...scoreInvalid(1),
			...retry(2),
			...node('scorer', 2),
			'edge scorer>evidence_check scored',
			...node('evidence_check', 2),
			'check.passed(evidence_check#2)',
			'edge evidence_check>recruiter_gate scored',
			'run.completed'
		]);
	});

	it('follows §6.2 for a planner failure', () => {
		const attempt = (n: number) => [
			...node('planner', n),
			'edge planner>plan_check planned',
			...node('plan_check', n),
			`check.failed(plan_check#${n})`
		];
		expect(compact(mockRunEvents[MOCK_PLANNER_FAILED_RUN_ID])).toEqual([
			'run.started',
			...attempt(1),
			'loop.retry(planner#2)',
			'edge plan_check>planner invalid',
			...attempt(2),
			...skipped('interviewer', 'judge', 'guard', 'scorer', 'evidence_check'),
			'run.failed'
		]);
	});

	it('follows §6.3 for a transport retry and a permanent failure', () => {
		expect(compact(mockRunEvents[MOCK_NODE_FAILED_RUN_ID])).toEqual([
			...planOk,
			...interviewerTurn,
			'node.started(judge#1)',
			'node.failed(judge#1)',
			...node('judge', 2),
			'edge judge>guard verdict',
			...node('guard'),
			'edge guard>interviewer follow_up',
			...interviewerTurn,
			'node.started(judge#1)',
			'node.failed(judge#1)',
			'node.started(judge#2)',
			'node.failed(judge#2)',
			...skipped('guard', 'scorer', 'evidence_check'),
			'run.failed'
		]);
	});

	it('follows §6.3 when the final evidence check still fails', () => {
		const events = mockRunEvents[MOCK_NEEDS_MANUAL_RUN_ID];
		expect(compact(events)).toEqual([
			...planOk,
			...chat,
			...scoreInvalid(1),
			...retry(2),
			...scoreInvalid(2),
			...retry(3),
			...scoreInvalid(3),
			'edge evidence_check>recruiter_gate scored',
			'run.completed'
		]);
		expect(events.at(-1)?.data).toMatchObject({ needs_manual_count: 1 });
	});

	it('follows §6.3 for the judge exception: the run goes on with the default verdict', () => {
		const success = compact(mockRunEvents[MOCK_RUN_ID]);
		const events = mockRunEvents[MOCK_JUDGE_OUTAGE_RUN_ID];
		expect(compact(events)).toEqual([
			...planOk,
			...interviewerTurn,
			'node.started(judge#1)',
			'node.failed(judge#1)',
			'node.started(judge#2)',
			'node.failed(judge#2)',
			'edge judge>guard verdict',
			...node('guard'),
			'topic.changed(guard#1)',
			'edge guard>interviewer next_topic',
			...success.slice(success.indexOf('edge guard>interviewer follow_up') + 1)
		]);
		const failures = events.flatMap((e) => (e.event === 'node.failed' ? [e.data] : []));
		expect(failures).toEqual([
			{ error: 'timeout', will_retry: true },
			{ error: 'timeout', will_retry: false }
		]);
		expect(events.at(-1)?.event).toBe('run.completed');
	});

	it('replays a manual interviewer retry over the self-loop edge (server#9)', () => {
		const success = compact(mockRunEvents[MOCK_RUN_ID]);
		const resume = success.indexOf('node.started(interviewer#1)', success.indexOf('edge guard>interviewer follow_up'));
		expect(compact(mockRunEvents[MOCK_MANUAL_RETRY_RUN_ID])).toEqual([
			...success.slice(0, resume),
			'node.started(interviewer#1)',
			'node.failed(interviewer#1)',
			'node.started(interviewer#2)',
			'node.failed(interviewer#2)',
			'edge interviewer>interviewer retry',
			...success.slice(resume)
		]);
	});

	it('lists the interviewer self-loop in every run.started', () => {
		for (const events of Object.values(mockRunEvents)) {
			const started = events[0];
			if (started.event !== 'run.started') expect.unreachable('a run starts with run.started');
			expect(started.data.edges).toContainEqual({ from: 'interviewer', to: 'interviewer' });
			expect(started.data.edges).toHaveLength(11);
		}
	});

	it('never emits node events for the human gate', () => {
		for (const events of Object.values(mockRunEvents)) {
			expect(events.some((event) => event.node_id === 'recruiter_gate')).toBe(false);
		}
	});

	it('snapshots agree with the replay they summarize', () => {
		for (const [runId, events] of Object.entries(mockRunEvents)) {
			const snapshot = graphRunSnapshot(runId);
			expect(snapshot?.last_seq).toBe(events.length);
			expect(snapshot?.nodes).toHaveLength(8);
			expect(snapshot?.nodes.find(({ id }) => id === 'recruiter_gate')?.status).toBe('pending');
		}
	});
});

describe('session replay data', () => {
	const deadline = '2026-11-04T06:45:00Z';
	const turns = mockSessionTurns(deadline);

	it('has valid envelopes with increasing seq across turns', () => {
		turns.flat().forEach((event, index) => expectValidEnvelope(event, index + 1));
	});

	it('streams each reply word by word, and the words rebuild the final text', () => {
		for (const turn of turns.slice(0, -1)) {
			const completed = turn.at(-1);
			if (completed?.event !== 'message.completed') {
				expect.unreachable('a turn must end with message.completed');
			}
			const deltas = turn.flatMap((event) =>
				event.event === 'message.delta' ? [event.data.delta] : []
			);
			expect(deltas.length).toBeGreaterThan(1);
			expect(deltas.every((delta) => delta.trim().split(/\s+/).length === 1)).toBe(true);
			expect(deltas.join('')).toBe(completed.data.message.content);
		}
	});

	it('uses the given deadline and ends the session last', () => {
		expect(turns[0][0].data).toMatchObject({ status: 'active', deadline_at: deadline });
		expect(turns.at(-1)?.at(-1)).toMatchObject({
			event: 'session.ended',
			data: { finish_reason: 'completed' }
		});
	});

	it('never sends scores or assessment events to the applicant', () => {
		const allowed = ['session.updated', 'message.delta', 'message.completed', 'session.ended'];
		expect(turns.flat().every(({ event }) => allowed.includes(event))).toBe(true);
	});
});

describe('REST fixtures', () => {
	const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

	it('uses v4 UUIDs for ids', () => {
		const ids = [
			...jobs.map(({ id }) => id),
			...applications.map(({ application }) => application.id),
			...mockMessages.map(({ id }) => id),
			...Object.keys(mockRunEvents)
		];
		for (const id of ids) expect(id).toMatch(UUID);
	});

	it('quotes evidence exactly from applicant messages in the same transcript', () => {
		const evidence = applications.flatMap(({ messages, scores }) =>
			scores.flatMap(({ evidence }) => evidence.map((item) => ({ messages, ...item })))
		);
		expect(evidence.length).toBeGreaterThan(0);
		for (const { messages, message_id, quote } of evidence) {
			const message = messages.find(({ id }) => id === message_id);
			expect(message?.role).toBe('applicant');
			expect(message?.content).toContain(quote);
		}
	});

	it('nulls the score only for needs_manual', () => {
		for (const { scores } of applications) {
			for (const score of scores) {
				expect(score.score === null).toBe(score.status === 'needs_manual');
			}
		}
	});

	it('computes overall_score as the weighted average of valid scores', () => {
		for (const { application, job, scores } of applications) {
			const valid = scores.flatMap(({ rubric_key, score }) => {
				const weight = job.rubric.find(({ key }) => key === rubric_key)?.weight;
				return score !== null && weight ? [{ score, weight }] : [];
			});
			if (valid.length === 0) {
				expect(application.overall_score).toBeNull();
				continue;
			}
			const total = valid.reduce((sum, { score, weight }) => sum + score * weight, 0);
			const weights = valid.reduce((sum, { weight }) => sum + weight, 0);
			expect(application.overall_score).toBeCloseTo(total / weights, 1);
		}
	});

	it('links each application to a run with the same status', () => {
		for (const { graph_run } of applications) {
			if (graph_run) expect(graphRunSnapshot(graph_run.id)?.status).toBe(graph_run.status);
		}
	});

	it('counts the applicants on the job', () => {
		expect(jobs[0].application_count).toBe(applications.length);
	});
});
