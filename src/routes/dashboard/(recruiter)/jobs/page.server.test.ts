import { describe, expect, it, vi } from 'vitest';
import { mockApi } from '$lib/server/api/mock';

vi.mock('$lib/server/api', () => ({ api: mockApi }));

const { load } = await import('./+page.server');

describe('jobs load', () => {
	it('returns the jobs with their apply_url and application_count', async () => {
		const data = await Promise.resolve(load({} as never));
		expect(data?.jobs.length).toBeGreaterThan(0);
		for (const job of data?.jobs ?? []) {
			expect(job.apply_url).toMatch(/\/apply\//);
			expect(typeof job.application_count).toBe('number');
		}
	});
});
