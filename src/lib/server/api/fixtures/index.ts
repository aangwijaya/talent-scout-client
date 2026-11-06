import {
	MOCK_NEEDS_MANUAL_RUN_ID,
	MOCK_PLANNER_FAILED_RUN_ID,
	MOCK_RUN_ID,
	MOCK_RUNNING_RUN_ID,
	MOCK_SESSION_ID,
	MOCK_TOPIC_ID,
	mockMessages,
	mockRunEvents
} from '$lib/mock';
import type {
	ApplicationDetail,
	ApplicationStatus,
	ApplicationSummary,
	GraphRun,
	Job,
	NodeId,
	NodeStatus,
	NodeType,
	PublicJob,
	RubricCriterion,
	Score,
	SessionStatus,
	Topic
} from '../types';

const CREATED_AT = '2026-11-04T06:00:00Z';
const LATER = '2026-11-11T06:00:00Z';

export const MOCK_JOB_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
export const MOCK_CLOSED_JOB_ID = '5ab27c91-6e34-4d18-a2f0-9d1c3e5b7a60';

export const MOCK_PASSWORD = 'mock-password';
export const MOCK_ACCESS_TOKEN = 'mock-access-token';
export const MOCK_CV_TEXT = 'Rani Putri. Senior frontend engineer with six years of Svelte work.';

/** A real session token never looks like these; each one selects a contract session state. */
export const MOCK_TOKENS = {
	invited: 'mock-invited',
	active: 'mock-active',
	expired: 'mock-expired',
	completed: 'mock-completed'
} as const;

export const MOCK_APPLICATION_IDS = {
	review: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
	needsManual: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed',
	invited: '6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b',
	inSession: '7d444840-9dc0-41d8-b6f8-0a2c1d7e5f40',
	shortlisted: '110ec58a-a0f2-4ac4-8393-c866d813b8d1',
	failed: 'c9bf9e57-1685-4c89-bafb-ff5af830be8a'
} as const;

const rubric: RubricCriterion[] = [
	{
		key: 'frontend_depth',
		label: 'Frontend depth',
		description: 'Svelte/React, state, performance',
		weight: 2
	},
	{
		key: 'communication',
		label: 'Communication',
		description: 'Explains tradeoffs clearly',
		weight: 1
	},
	{
		key: 'system_design',
		label: 'System design',
		description: 'Structures larger features',
		weight: 2
	}
];

const jobDescription =
	'Build the recruiter dashboard and applicant chat in SvelteKit, and own frontend quality with the team.';

export const jobs: Job[] = [
	{
		id: MOCK_JOB_ID,
		title: 'Senior Frontend Engineer',
		description: jobDescription,
		rubric,
		status: 'open',
		apply_url: `https://talentscout.vercel.app/apply/${MOCK_JOB_ID}`,
		application_count: 6,
		created_at: CREATED_AT,
		updated_at: CREATED_AT
	}
];

export const publicJobs: PublicJob[] = [
	{
		id: MOCK_JOB_ID,
		title: 'Senior Frontend Engineer',
		description: jobDescription,
		status: 'open'
	},
	{
		id: MOCK_CLOSED_JOB_ID,
		title: 'Staff Backend Engineer',
		description: 'This role is no longer accepting applications.',
		status: 'closed'
	}
];

function summary(
	id: string,
	name: string,
	status: ApplicationStatus,
	session_status: SessionStatus | null,
	overall_score: number | null
): ApplicationSummary {
	const email = `${name.split(' ')[0].toLowerCase()}@example.com`;
	return {
		id,
		job_id: MOCK_JOB_ID,
		name,
		email,
		status,
		session_status,
		overall_score,
		created_at: CREATED_AT
	};
}

const topics: Topic[] = [
	{
		id: MOCK_TOPIC_ID,
		position: 1,
		title: 'State management',
		goal: 'Check how the applicant structures shared state',
		rubric_keys: ['frontend_depth', 'communication', 'system_design'],
		status: 'done',
		follow_up_count: 1
	}
];

const [, firstAnswer, , secondAnswer] = mockMessages;

const validScores: Score[] = [
	{
		rubric_key: 'frontend_depth',
		score: 4,
		rationale: 'Moved shared state out of pages for a concrete reason.',
		status: 'valid',
		attempts: 2,
		evidence: [{ message_id: firstAnswer.id, quote: 'I moved the state into a separate store' }]
	},
	{
		rubric_key: 'communication',
		score: 3,
		rationale: 'Explained the tradeoff before making the change.',
		status: 'valid',
		attempts: 2,
		evidence: [{ message_id: secondAnswer.id, quote: 'I explained the tradeoff to the team' }]
	}
];

const systemDesignValid: Score = {
	rubric_key: 'system_design',
	score: 3,
	rationale: 'Noticed the prop chain and reduced it.',
	status: 'valid',
	attempts: 2,
	evidence: [{ message_id: secondAnswer.id, quote: 'Props were crossing four layers' }]
};

const systemDesignManual: Score = {
	rubric_key: 'system_design',
	score: null,
	rationale: 'No exact quote supports a score after three attempts.',
	status: 'needs_manual',
	attempts: 3,
	evidence: []
};

function endedSession(finish_reason: 'completed' | 'failed') {
	return {
		id: MOCK_SESSION_ID,
		status: 'completed' as const,
		expires_at: LATER,
		started_at: '2026-11-04T06:30:00Z',
		ended_at: '2026-11-04T06:45:00Z',
		finish_reason,
		question_count: 2
	};
}

type DetailParts = Partial<Omit<ApplicationDetail, 'application' | 'job' | 'cv_text'>>;

function detail(application: ApplicationSummary, parts: DetailParts = {}): ApplicationDetail {
	return {
		application,
		job: { id: MOCK_JOB_ID, title: 'Senior Frontend Engineer', rubric },
		cv_text: MOCK_CV_TEXT,
		decision: null,
		session: null,
		graph_run: null,
		topics: [],
		messages: [],
		scores: [],
		...parts
	};
}

const finishedRun = (id: string) => ({
	topics,
	messages: [...mockMessages],
	session: endedSession('completed'),
	graph_run: { id, status: 'succeeded' as const, cost_usd: 0.0041 }
});

export const applications: ApplicationDetail[] = [
	detail(summary(MOCK_APPLICATION_IDS.review, 'Rani Putri', 'review', 'completed', 3.4), {
		...finishedRun(MOCK_RUN_ID),
		scores: [...validScores, systemDesignValid]
	}),
	detail(summary(MOCK_APPLICATION_IDS.needsManual, 'Dimas Pratama', 'review', 'completed', 3.67), {
		...finishedRun(MOCK_NEEDS_MANUAL_RUN_ID),
		scores: [...validScores, systemDesignManual]
	}),
	detail(summary(MOCK_APPLICATION_IDS.invited, 'Sari Wulandari', 'invited', 'invited', null), {
		session: {
			id: MOCK_SESSION_ID,
			status: 'invited',
			expires_at: LATER,
			started_at: null,
			ended_at: null,
			finish_reason: null,
			question_count: 0
		}
	}),
	detail(summary(MOCK_APPLICATION_IDS.inSession, 'Bayu Saputra', 'in_session', 'active', null), {
		topics: [{ ...topics[0], status: 'active', follow_up_count: 0 }],
		messages: mockMessages.slice(0, 1),
		session: {
			id: MOCK_SESSION_ID,
			status: 'active',
			expires_at: LATER,
			started_at: '2026-11-04T06:30:00Z',
			ended_at: null,
			finish_reason: null,
			question_count: 1
		},
		graph_run: { id: MOCK_RUNNING_RUN_ID, status: 'running', cost_usd: 0.0012 }
	}),
	detail(
		summary(MOCK_APPLICATION_IDS.shortlisted, 'Maya Lestari', 'shortlisted', 'completed', 3.4),
		{
			...finishedRun(MOCK_RUN_ID),
			scores: [...validScores, systemDesignValid],
			decision: { value: 'shortlist', note: 'Strong on state management.', decided_at: LATER }
		}
	),
	detail(summary(MOCK_APPLICATION_IDS.failed, 'Adi Nugroho', 'failed', 'completed', null), {
		session: endedSession('failed'),
		graph_run: { id: MOCK_PLANNER_FAILED_RUN_ID, status: 'failed', cost_usd: 0.0008 }
	})
];

const nodeTypes: [NodeId, NodeType][] = [
	['planner', 'splitter'],
	['plan_check', 'code'],
	['interviewer', 'worker'],
	['judge', 'gate'],
	['guard', 'code'],
	['scorer', 'worker'],
	['evidence_check', 'code'],
	['recruiter_gate', 'human_gate']
];

/** Rebuilds what `GET /graph-runs/{runId}` reports once a run's replay data has all happened. */
export function graphRunSnapshot(runId: string): GraphRun | undefined {
	const events = mockRunEvents[runId];
	if (!events) return undefined;

	const statuses = new Map<NodeId, NodeStatus>();
	const attempts = new Map<NodeId, number>();
	const models = new Map<NodeId, string | null>();
	let edges: GraphRun['edges'] = [];
	let session_id = MOCK_SESSION_ID;
	let status: GraphRun['status'] = 'running';
	let total_tokens_in = 0;
	let total_tokens_out = 0;
	let cost_usd = 0;

	for (const event of events) {
		switch (event.event) {
			case 'run.started':
				edges = event.data.edges;
				session_id = event.data.session_id;
				break;
			case 'node.started':
				statuses.set(event.node_id, 'running');
				attempts.set(event.node_id, event.attempt ?? 1);
				models.set(event.node_id, event.data.model);
				break;
			case 'node.completed':
				statuses.set(event.node_id, 'succeeded');
				total_tokens_in += event.data.tokens_in;
				total_tokens_out += event.data.tokens_out;
				cost_usd += event.data.cost_usd;
				break;
			case 'node.failed':
				statuses.set(event.node_id, 'failed');
				break;
			case 'node.skipped':
				statuses.set(event.node_id, 'skipped');
				break;
			case 'run.completed':
				status = event.data.status;
				break;
			case 'run.failed':
				status = 'failed';
				break;
		}
	}

	return {
		id: runId,
		session_id,
		status,
		nodes: nodeTypes.map(([id, type]) => ({
			id,
			type,
			status: statuses.get(id) ?? 'pending',
			attempts: attempts.get(id) ?? 0,
			model: models.get(id) ?? null
		})),
		edges,
		last_seq: events.length,
		total_tokens_in,
		total_tokens_out,
		cost_usd: Number(cost_usd.toFixed(6))
	};
}
