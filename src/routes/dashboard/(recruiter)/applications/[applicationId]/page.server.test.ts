import { isActionFailure, isHttpError } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { mockApi } from '$lib/server/api/mock';
import { MOCK_APPLICATION_IDS } from '$lib/server/api/fixtures';

vi.mock('$lib/server/api', () => ({ api: mockApi }));

const { load, actions } = await import('./+page.server');
const { GET } = await import('./cv/+server');

const UNKNOWN = '00000000-0000-4000-8000-000000000000';

function form(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
}

function act(
	name: 'decide' | 'invite',
	applicationId: string,
	fields: Record<string, string> = {}
) {
	const request = new Request('http://app.test/', { method: 'POST', body: form(fields) });
	return Promise.resolve(actions[name]({ params: { applicationId }, request } as never));
}

describe('review load', () => {
	it('returns the application detail', async () => {
		const data = await Promise.resolve(
			load({ params: { applicationId: MOCK_APPLICATION_IDS.review } } as never)
		);
		expect(data?.detail.application.id).toBe(MOCK_APPLICATION_IDS.review);
	});

	it('turns an unknown application into a 404', async () => {
		const thrown = await Promise.resolve(
			load({ params: { applicationId: UNKNOWN } } as never)
		).catch((e: unknown) => e);
		expect(isHttpError(thrown) && thrown.status).toBe(404);
	});
});

describe('decide action', () => {
	it('returns the new status and the decision', async () => {
		const result = await act('decide', MOCK_APPLICATION_IDS.review, {
			decision: 'shortlist',
			note: 'Strong answers.'
		});
		expect(result).toMatchObject({
			status: 'shortlisted',
			decision: { value: 'shortlist', note: 'Strong answers.' }
		});
	});

	it('rejects an unknown decision or a note over 1000 characters', async () => {
		const bogus = await act('decide', MOCK_APPLICATION_IDS.review, { decision: 'maybe' });
		expect(isActionFailure(bogus) && bogus.status).toBe(400);
		const long = await act('decide', MOCK_APPLICATION_IDS.review, {
			decision: 'reject',
			note: 'x'.repeat(1001)
		});
		expect(isActionFailure(long) && long.status).toBe(400);
	});

	it('reports a 409 invalid_state as a decision error', async () => {
		const result = await act('decide', MOCK_APPLICATION_IDS.invited, { decision: 'reject' });
		expect(isActionFailure(result) && result.status).toBe(409);
		expect(isActionFailure(result) && result.data).toMatchObject({
			decisionError: 'invalid_state'
		});
	});
});

describe('invite action', () => {
	it('returns the new invite', async () => {
		const result = await act('invite', MOCK_APPLICATION_IDS.invited);
		expect(result).toMatchObject({ invite: { invite_url: expect.stringContaining('/s/') } });
	});

	it('reports a 409 as an invite error', async () => {
		const result = await act('invite', MOCK_APPLICATION_IDS.review);
		expect(isActionFailure(result) && result.status).toBe(409);
	});
});

describe('CV route', () => {
	it('streams the PDF from the API', async () => {
		const response = await GET({ params: { applicationId: MOCK_APPLICATION_IDS.review } } as never);
		expect(response.headers.get('content-type')).toBe('application/pdf');
		expect(response.headers.get('content-disposition')).toContain('inline');
		expect(await response.text()).toContain('%PDF');
	});

	it('turns an unknown application into a 404', async () => {
		const thrown = await Promise.resolve(
			GET({ params: { applicationId: UNKNOWN } } as never)
		).catch((e: unknown) => e);
		expect(isHttpError(thrown) && thrown.status).toBe(404);
	});
});
