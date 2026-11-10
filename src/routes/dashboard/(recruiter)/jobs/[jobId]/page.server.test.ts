import { isHttpError } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { mockApi } from '$lib/server/api/mock';
import { MOCK_JOB_ID } from '$lib/server/api/fixtures';

vi.mock('$lib/server/api', () => ({ api: mockApi }));

const { load } = await import('./+page.server');

function run(jobId: string, search = '') {
	const url = new URL(`http://app.test/dashboard/jobs/${jobId}${search}`);
	return Promise.resolve(load({ params: { jobId }, url } as never));
}

describe('applicants load', () => {
	it('returns the job and all applicants without a filter', async () => {
		const data = await run(MOCK_JOB_ID);
		expect(data?.job.id).toBe(MOCK_JOB_ID);
		expect(data?.status).toBeNull();
		expect(data?.applications.length).toBeGreaterThan(1);
	});

	it('filters applicants by a valid status', async () => {
		const data = await run(MOCK_JOB_ID, '?status=review');
		expect(data?.status).toBe('review');
		expect(data?.applications.length).toBeGreaterThan(0);
		expect(data?.applications.every((a) => a.status === 'review')).toBe(true);
	});

	it('ignores an unknown status', async () => {
		const data = await run(MOCK_JOB_ID, '?status=bogus');
		expect(data?.status).toBeNull();
	});

	it('turns an unknown job into a 404', async () => {
		const thrown = await run('00000000-0000-4000-8000-000000000000').catch((e: unknown) => e);
		expect(isHttpError(thrown) && thrown.status).toBe(404);
	});
});
