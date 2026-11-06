import { mockMessages } from '$lib/mock';
import {
	MOCK_ACCESS_TOKEN,
	MOCK_APPLICATION_IDS,
	MOCK_PASSWORD,
	MOCK_TOKENS,
	applications,
	graphRunSnapshot,
	jobs,
	publicJobs
} from './fixtures';
import { ApiError, type ApplicationDetail, type SessionInfo, type TalentScoutApi } from './types';

const MINUTE_MS = 60_000;
const MAX_MINUTES = 15;

function inMs(ms: number): string {
	return new Date(Date.now() + ms).toISOString();
}

function notFound(): ApiError {
	return new ApiError(404, 'not_found', 'Not found');
}

function findApplication(id: string): ApplicationDetail {
	const found = applications.find((detail) => detail.application.id === id);
	if (!found) throw notFound();
	return found;
}

function activeSession(): SessionInfo {
	const now = Date.now();
	return {
		...sessionBase(),
		status: 'active',
		started_at: new Date(now).toISOString(),
		deadline_at: new Date(now + MAX_MINUTES * MINUTE_MS).toISOString(),
		topic_count: 1,
		question_count: 1,
		current_topic: { position: 1, title: 'State management', total: 1 }
	};
}

function sessionBase(): SessionInfo {
	return {
		status: 'invited',
		job_title: jobs[0].title,
		applicant_name: 'Rani Putri',
		expires_at: inMs(7 * 24 * 60 * MINUTE_MS),
		started_at: null,
		deadline_at: null,
		max_minutes: MAX_MINUTES,
		topic_count: null,
		question_count: 0,
		max_questions: 15,
		current_topic: null
	};
}

/** Applies the session-token errors shared by every `/sessions/{token}` endpoint. */
function requireLiveToken(token: string): void {
	if (token === MOCK_TOKENS.expired) {
		throw new ApiError(410, 'session_expired', 'This session link has expired');
	}
	if (token === MOCK_TOKENS.completed) {
		throw new ApiError(410, 'session_completed', 'This session has already finished');
	}
	if (token !== MOCK_TOKENS.invited && token !== MOCK_TOKENS.active) {
		throw new ApiError(404, 'session_not_found', 'Session not found');
	}
}

/**
 * Stateless on purpose: no request or user state at module level, so a write returns the new
 * state without storing it, and the next read returns the fixture again.
 */
export const mockApi: TalentScoutApi = {
	login: async (password) => {
		if (password !== MOCK_PASSWORD) throw new ApiError(401, 'unauthorized', 'Wrong password');
		return { access_token: MOCK_ACCESS_TOKEN, expires_at: inMs(12 * 60 * MINUTE_MS) };
	},
	mintSseToken: async (runId) => {
		if (!graphRunSnapshot(runId)) throw notFound();
		return { sse_token: 'mock-sse-token', expires_at: inMs(MINUTE_MS) };
	},

	listJobs: async () => ({ items: jobs, next_cursor: null }),
	getJob: async (jobId) => {
		const job = jobs.find(({ id }) => id === jobId);
		if (!job) throw notFound();
		return job;
	},
	getPublicJob: async (jobId) => {
		const job = publicJobs.find(({ id }) => id === jobId);
		if (!job) throw notFound();
		return job;
	},

	apply: async (jobId) => {
		const job = publicJobs.find(({ id }) => id === jobId);
		if (!job) throw notFound();
		if (job.status === 'closed') throw new ApiError(409, 'invalid_state', 'This job is closed');
		return {
			application_id: MOCK_APPLICATION_IDS.invited,
			status: 'invited',
			message: 'Thanks! Your application was received. The recruiter will send your screening link.'
		};
	},
	listApplications: async (jobId, query) => {
		if (!jobs.some(({ id }) => id === jobId)) throw notFound();
		const items = applications
			.map((detail) => detail.application)
			.filter(({ status }) => !query?.status || status === query.status);
		return { items, next_cursor: null };
	},
	getApplication: async (id) => findApplication(id),
	getCv: async (id) => {
		findApplication(id);
		return new Response('%PDF-1.4 mock CV', { headers: { 'Content-Type': 'application/pdf' } });
	},
	decide: async (id, { decision }) => {
		const { application } = findApplication(id);
		if (!['review', 'shortlisted', 'rejected'].includes(application.status)) {
			throw new ApiError(409, 'invalid_state', 'This application is not ready for a decision');
		}
		return { ...application, status: decision === 'shortlist' ? 'shortlisted' : 'rejected' };
	},
	resendInvite: async (id) => {
		const { application, session } = findApplication(id);
		if (application.status !== 'failed' && session?.status !== 'invited') {
			throw new ApiError(409, 'invalid_state', 'This application cannot get a new invite');
		}
		return {
			session_id: crypto.randomUUID(),
			expires_at: inMs(7 * 24 * 60 * MINUTE_MS),
			invite_url: `https://talentscout.vercel.app/s/${MOCK_TOKENS.invited}`
		};
	},

	getSession: async (token) => {
		requireLiveToken(token);
		return token === MOCK_TOKENS.active ? activeSession() : sessionBase();
	},
	startSession: async (token) => {
		requireLiveToken(token);
		if (token === MOCK_TOKENS.active) {
			throw new ApiError(409, 'session_already_started', 'This session has already started');
		}
		return activeSession();
	},
	listMessages: async (token) => {
		requireLiveToken(token);
		return { items: token === MOCK_TOKENS.active ? mockMessages.slice(0, 1) : [] };
	},
	sendMessage: async (token, content) => {
		requireLiveToken(token);
		return {
			message: {
				id: crypto.randomUUID(),
				role: 'applicant',
				kind: 'answer',
				topic_id: mockMessages[0].topic_id,
				content,
				created_at: new Date().toISOString()
			},
			awaiting: 'assistant'
		};
	},
	retrySession: async (token) => {
		requireLiveToken(token);
		return { status: 'retrying' };
	},

	getGraphRun: async (runId) => {
		const run = graphRunSnapshot(runId);
		if (!run) throw notFound();
		return run;
	},

	sseBaseUrl: () => null
};
