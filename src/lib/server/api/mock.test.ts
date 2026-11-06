import { MOCK_PLANNER_FAILED_RUN_ID, MOCK_RUN_ID } from '$lib/mock';
import { describe, expect, it } from 'vitest';
import {
	MOCK_APPLICATION_IDS,
	MOCK_CLOSED_JOB_ID,
	MOCK_JOB_ID,
	MOCK_PASSWORD,
	MOCK_TOKENS
} from './fixtures';
import { mockApi } from './mock';

const form = new FormData();

describe('mockApi', () => {
	it('accepts only the mock password', async () => {
		await expect(mockApi.login(MOCK_PASSWORD)).resolves.toHaveProperty('access_token');
		await expect(mockApi.login('wrong')).rejects.toMatchObject({
			status: 401,
			code: 'unauthorized'
		});
	});

	it('runs the apply path and its contract errors', async () => {
		await expect(mockApi.apply(MOCK_JOB_ID, form)).resolves.toMatchObject({ status: 'invited' });
		await expect(mockApi.apply(MOCK_CLOSED_JOB_ID, form)).rejects.toMatchObject({
			status: 409,
			code: 'invalid_state'
		});
		await expect(mockApi.apply('missing', form)).rejects.toMatchObject({ code: 'not_found' });
	});

	it('still shows a closed job on the public endpoint', async () => {
		await expect(mockApi.getPublicJob(MOCK_CLOSED_JOB_ID)).resolves.toMatchObject({
			status: 'closed'
		});
	});

	it('filters applicants by status', async () => {
		const { items } = await mockApi.listApplications(MOCK_JOB_ID, { status: 'review' });
		expect(items.length).toBeGreaterThan(0);
		expect(items.every(({ status }) => status === 'review')).toBe(true);
	});

	it('maps session tokens to the contract states', async () => {
		await expect(mockApi.getSession(MOCK_TOKENS.invited)).resolves.toMatchObject({
			status: 'invited',
			deadline_at: null
		});
		await expect(mockApi.getSession(MOCK_TOKENS.expired)).rejects.toMatchObject({
			status: 410,
			code: 'session_expired'
		});
		await expect(mockApi.getSession(MOCK_TOKENS.completed)).rejects.toMatchObject({
			status: 410,
			code: 'session_completed'
		});
		await expect(mockApi.getSession('missing')).rejects.toMatchObject({
			status: 404,
			code: 'session_not_found'
		});
	});

	it('starts an invited session once, with a deadline in the future', async () => {
		const session = await mockApi.startSession(MOCK_TOKENS.invited);
		expect(session.status).toBe('active');
		expect(Date.parse(session.deadline_at ?? '')).toBeGreaterThan(Date.now());
		await expect(mockApi.startSession(MOCK_TOKENS.active)).rejects.toMatchObject({
			status: 409,
			code: 'session_already_started'
		});
	});

	it('allows a decision only from review onwards, without storing it', async () => {
		const decided = await mockApi.decide(MOCK_APPLICATION_IDS.review, { decision: 'reject' });
		expect(decided.status).toBe('rejected');
		const { application } = await mockApi.getApplication(MOCK_APPLICATION_IDS.review);
		expect(application.status).toBe('review');
		await expect(
			mockApi.decide(MOCK_APPLICATION_IDS.invited, { decision: 'shortlist' })
		).rejects.toMatchObject({ status: 409, code: 'invalid_state' });
	});

	it('issues invites only for invited sessions or failed applications', async () => {
		await expect(mockApi.resendInvite(MOCK_APPLICATION_IDS.invited)).resolves.toHaveProperty(
			'invite_url'
		);
		await expect(mockApi.resendInvite(MOCK_APPLICATION_IDS.failed)).resolves.toHaveProperty(
			'invite_url'
		);
		await expect(mockApi.resendInvite(MOCK_APPLICATION_IDS.review)).rejects.toMatchObject({
			status: 409,
			code: 'invalid_state'
		});
	});

	it('reports run snapshots that match their replay data', async () => {
		await expect(mockApi.getGraphRun(MOCK_RUN_ID)).resolves.toMatchObject({ status: 'succeeded' });
		const failed = await mockApi.getGraphRun(MOCK_PLANNER_FAILED_RUN_ID);
		expect(failed.status).toBe('failed');
		expect(failed.nodes.find(({ id }) => id === 'interviewer')?.status).toBe('skipped');
		await expect(mockApi.getGraphRun('missing')).rejects.toMatchObject({ code: 'not_found' });
	});

	it('serves a PDF and has no SSE URL', async () => {
		const cv = await mockApi.getCv(MOCK_APPLICATION_IDS.review);
		expect(cv.headers.get('Content-Type')).toBe('application/pdf');
		expect(mockApi.sseBaseUrl()).toBeNull();
	});
});
