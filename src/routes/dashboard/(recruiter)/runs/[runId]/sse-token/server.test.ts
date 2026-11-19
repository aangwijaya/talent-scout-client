import { redirect } from '@sveltejs/kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MOCK_RUN_ID } from '$lib/mock';
import { mockApi } from '$lib/server/api/mock';
import { ApiError } from '$lib/server/api/types';

vi.mock('$lib/server/api', () => ({ api: mockApi }));

const { POST } = await import('./+server');

afterEach(() => {
	vi.restoreAllMocks();
});

const call = () => POST({ params: { runId: MOCK_RUN_ID } } as never);

describe('POST sse-token', () => {
	it('returns a fresh sse_token', async () => {
		const res = await call();
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ sse_token: 'mock-sse-token' });
	});

	it('answers a JSON 401 when the API rejects the token and the API layer redirects to login', async () => {
		vi.spyOn(mockApi, 'mintSseToken').mockImplementation(() =>
			redirect(303, '/dashboard/login?reason=session_ended')
		);
		const res = await call();
		expect(res.status).toBe(401);
		expect(res.headers.get('content-type')).toContain('application/json');
		expect(await res.json()).toEqual({
			error: { code: 'unauthorized', message: 'Sign in again' }
		});
	});

	it('rethrows other API failures as an HTTP error', async () => {
		vi.spyOn(mockApi, 'mintSseToken').mockRejectedValue(
			new ApiError(404, 'not_found', 'Run not found')
		);
		await expect(call()).rejects.toMatchObject({ status: 404 });
	});
});
