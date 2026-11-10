import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import type { ApplicationSummary, Job } from '$lib/server/api/types';

vi.mock('$app/paths', () => ({
	resolve: (route: string, params: Record<string, string> = {}) =>
		route
			.replace('/(recruiter)', '')
			.replace(/\[(\w+)\]/g, (_: string, key: string) => params[key] ?? '')
}));
vi.mock('$app/state', () => ({
	navigating: { to: null },
	page: { route: { id: '/dashboard/(recruiter)/jobs/[jobId]' } }
}));

const { default: Page } = await import('./+page.svelte');

const STATUSES = [
	'applied',
	'invited',
	'in_session',
	'scoring',
	'review',
	'shortlisted',
	'rejected',
	'failed'
] as const;

const job = {
	id: 'job-1',
	title: 'Senior Frontend Engineer',
	status: 'open',
	apply_url: 'https://talentscout.vercel.app/apply/job-1',
	application_count: 1
} as Job;

const longName = 'Aleksandra Wiśniewska-Kowalczyk';
const application: ApplicationSummary = {
	id: 'app-1',
	job_id: 'job-1',
	name: longName,
	email: 'aleksandra.wisniewska-kowalczyk@example-company-with-a-long-domain.com',
	status: 'review',
	session_status: 'completed',
	overall_score: 4.5,
	created_at: '2026-11-04T10:00:00Z'
};

function page(
	applications: ApplicationSummary[],
	status: (typeof STATUSES)[number] | null = null
): string {
	const data = { job, applications, status, statuses: STATUSES };
	return render(Page, { props: { data, params: { jobId: 'job-1' } } as never }).body;
}

describe('applicants page', () => {
	it('renders each applicant in the table and in the phone list, never truncated', () => {
		const body = page([application]);
		expect(body.split(longName)).toHaveLength(3);
		expect(body).toContain('sm:hidden');
		expect(body).toContain('min-h-11');
		expect(body).not.toContain('truncate');
		expect(body).toContain('[overflow-wrap:anywhere]');
		expect(body).toContain('4.50');
		expect(body).toContain('Completed');
		expect(body).toContain('Nov 4, 2026');
	});

	it('labels the filter pills as a group and marks the active one', () => {
		const body = page([application], 'review');
		expect(body).toContain('role="group" aria-label="Filter by status"');
		expect(body.match(/aria-pressed="true"/g)).toHaveLength(1);
	});

	it('shows the no-applicants empty state with the copy action', () => {
		const body = page([]);
		expect(body).toContain('No applicants yet');
		expect(body).toContain('lucide-users');
		expect(body).toContain('Copy apply link');
	});

	it('shows the no-match empty state with a way back to all applicants', () => {
		const body = page([], 'shortlisted');
		expect(body).toContain('No shortlisted applicants');
		expect(body).toContain('lucide-search');
		expect(body).toMatch(/href="\/dashboard\/jobs\/job-1"[^>]*>(<!---->)*Show all applicants/);
	});
});
