import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import type { Job } from '$lib/server/api/types';

vi.mock('$app/paths', () => ({
	resolve: (route: string, params: Record<string, string> = {}) =>
		route
			.replace('/(recruiter)', '')
			.replace(/\[(\w+)\]/g, (_: string, key: string) => params[key] ?? '')
}));

const { default: Page } = await import('./+page.svelte');

const job = {
	id: 'job-1',
	title: 'Senior Frontend Engineer',
	status: 'open',
	apply_url: 'https://talentscout.vercel.app/apply/job-1',
	application_count: 3,
	description: 'About the role',
	rubric: [],
	created_at: '2026-11-04T10:00:00Z'
} as unknown as Job;

const page = (jobs: Job[]) => render(Page, { props: { data: { jobs }, params: {} } as never }).body;

describe('jobs page', () => {
	it('shows the empty state as an h2 with one New job action', () => {
		const body = page([]);
		expect(body).toMatch(/<h2[^>]*>No jobs yet<\/h2>/);
		expect(body).toContain('Create a job and share its apply link to start screening.');
		expect(body).toContain('lucide-briefcase');
		expect(body.match(/href="\/dashboard\/jobs\/new"/g)).toHaveLength(2);
	});

	it('keeps the six-column table for 1024px and up and a list row below it', () => {
		const body = page([job]);
		expect(body).toMatch(/<div class="[^"]*max-lg:hidden[^"]*"><table/);
		expect(body).toMatch(/<ul class="[^"]*lg:hidden/);
		expect(body).toContain('3 applicants · Open · Nov 4, 2026');
		expect(body.match(/aria-label="Copy apply link for Senior Frontend Engineer"/g)).toHaveLength(
			2
		);
	});

	it('uses muted, not helper, for secondary text in the rows', () => {
		const rows = page([job]).split('<tbody>')[1];
		// `disabled:text-helper` on a disabled button is fine; plain `text-helper` text is not.
		expect(rows).not.toMatch(/[\s"]text-helper/);
	});
});
