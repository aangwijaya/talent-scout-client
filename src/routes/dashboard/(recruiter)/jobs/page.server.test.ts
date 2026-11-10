import { isHttpError } from '@sveltejs/kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi } from '$lib/server/api/mock';
import { ApiError } from '$lib/server/api/types';

vi.mock('$lib/server/api', () => ({ api: mockApi }));

const { load } = await import('./+page.server');

afterEach(() => {
	vi.restoreAllMocks();
});

describe('jobs load', () => {
	it('returns the jobs with their apply_url and application_count', async () => {
		const data = await Promise.resolve(load({} as never));
		expect(data?.jobs.length).toBeGreaterThan(0);
		for (const job of data?.jobs ?? []) {
			expect(job.apply_url).toMatch(/\/apply\//);
			expect(typeof job.application_count).toBe('number');
		}
	});

	it("turns an API failure into an error with the API's status and message", async () => {
		vi.spyOn(mockApi, 'listJobs').mockRejectedValue(
			new ApiError(503, 'internal_error', 'The API is down')
		);
		const thrown = await Promise.resolve(load({} as never)).catch((e: unknown) => e);
		expect(isHttpError(thrown) && thrown.status).toBe(503);
		expect(isHttpError(thrown) && thrown.body.message).toBe('The API is down');
	});
});
