import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import { MOCK_APPLICATION_IDS, applications } from '$lib/server/api/fixtures';
import type { ApplicationDetail } from '$lib/server/api/types';

vi.mock('$app/paths', () => ({
	resolve: (route: string, params: Record<string, string> = {}) =>
		route
			.replace('/(recruiter)', '')
			.replace(/\[(\w+)\]/g, (_: string, key: string) => params[key] ?? '')
}));
vi.mock('$app/forms', () => ({ enhance: () => ({}) }));
vi.mock('$app/navigation', () => ({ invalidateAll: async () => {} }));

const { default: Page } = await import('./+page.svelte');

type Ids = keyof typeof MOCK_APPLICATION_IDS;

function fixture(id: Ids): ApplicationDetail {
	const found = applications.find((d) => d.application.id === MOCK_APPLICATION_IDS[id]);
	if (!found) throw new Error(id);
	return found;
}

function page(detail: ApplicationDetail, form: Record<string, unknown> | null = null): string {
	const params = { applicationId: detail.application.id };
	return render(Page, { props: { data: { detail }, form, params } as never }).body;
}

describe('review page, scored application', () => {
	const detail = fixture('review');
	const body = page(detail);

	it('renders the header with breadcrumb, badge, meta, links and actions', () => {
		expect(body).toMatch(/<h1[^>]*class="[^"]*text-heading-sm font-semibold/);
		expect(body).toContain(`href="/dashboard/jobs/${detail.job.id}"`);
		expect(body).toContain('Review');
		expect(body).toContain(detail.application.email);
		expect(body).toContain('Session completed · 2 questions · 15 min');
		expect(body).toContain('$0.0041');
		expect(body).toContain(`href="/dashboard/applications/${detail.application.id}/cv"`);
		expect(body).toContain(`href="/dashboard/runs/${detail.graph_run?.id}"`);
		expect(body).toContain('Shortlist');
		expect(body).toContain('Reject');
		expect(body).not.toContain('Get invite link');
	});

	it('gives every bubble its message id and marks quoted evidence', () => {
		for (const message of detail.messages) expect(body).toContain(`id="${message.id}"`);
		expect(body).toContain('<mark');
		expect(body).toContain('I moved the state into a separate store');
		expect(body).toContain('AI interviewer · Opening');
		expect(body).toContain('Topic 1');
	});

	it('renders a ScoreCard per criterion with score, bar, rationale and evidence link', () => {
		expect(body).toContain('aria-label="4 out of 5"');
		expect(body).toContain('scored on attempt 2 of 3');
		expect(body).toContain('<blockquote');
		const evidence = detail.scores[0].evidence[0];
		expect(body).toContain(`href="#${evidence.message_id}"`);
		expect(body).toContain('Jump to message');
		expect(body).toContain('OVERALL SCORE');
		expect(body).toContain('3.40');
	});

	it('offers transcript and scores tabs for narrow screens', () => {
		expect(body).toContain('role="tablist"');
		expect(body.match(/role="tab"/g)).toHaveLength(2);
	});
});

describe('review page, needs manual review', () => {
	const body = page(fixture('needsManual'));

	it('shows the badge, the dash and the left-out note', () => {
		expect(body).toContain('Needs manual review');
		expect(body).toContain('gave up after 3 attempts');
		expect(body).toContain('1 criterion needs manual review and is left out');
		expect(body).toContain('Scores · 1 needs review');
	});
});

describe('review page, decisions', () => {
	it('shows the decision banner instead of the actions', () => {
		const body = page(fixture('shortlisted'));
		expect(body).toContain('role="status"');
		expect(body).toMatch(/Shortlisted [a-z0-9 ]+/);
		expect(body).toContain('Strong on state management.');
		expect(body).toContain('Change to reject');
		expect(body).not.toContain('Confirm shortlist');
	});

	it('shows the result of a decision made right now', () => {
		const body = page(fixture('review'), {
			status: 'rejected',
			decision: { value: 'reject', note: '', decided_at: new Date().toISOString() }
		});
		expect(body).toContain('Rejected just now');
		expect(body).toContain('No note.');
		expect(body).toContain('Change to shortlist');
	});

	it('explains a 409 from the decision action', () => {
		const body = page(fixture('review'), { decisionError: 'invalid_state' });
		expect(body).toContain("Couldn't save the decision");
		expect(body).toContain('This application is not ready for a decision yet.');
		expect(body).toContain('Reload');
	});
});

describe('review page, other states', () => {
	it('invited: no transcript yet, a Get invite link action and the new link once made', () => {
		const detail = fixture('invited');
		expect(page(detail)).toContain("The screening hasn't started");
		const body = page(detail, {
			invite: {
				session_id: 's',
				expires_at: '2026-11-18T06:00:00Z',
				invite_url: 'https://talentscout.vercel.app/s/new-token'
			}
		});
		expect(body).toContain('Get invite link');
		expect(body).toContain('New invite link');
		expect(body).toContain('https://talentscout.vercel.app/s/new-token');
		expect(body).toContain('Expires Nov 18, 2026');
		expect(body).not.toContain('Confirm shortlist');
		expect(body).not.toMatch(/>\s*Shortlist\s*</);
	});

	it('email mode: confirms the invite was sent', () => {
		const body = page(fixture('invited'), {
			invite: { session_id: 's', expires_at: '2026-11-18T06:00:00Z', invite_url: null }
		});
		expect(body).toContain('New invite sent by email.');
	});

	it('failed: alert banner with a graph link and Get invite link', () => {
		const detail = fixture('failed');
		const body = page(detail);
		expect(body).toContain('role="alert"');
		expect(body).toContain('The screening could not finish');
		expect(body).toContain("Adi's screening ended with a system error");
		expect(body).toContain(`href="/dashboard/runs/${detail.graph_run?.id}"`);
		expect(body).toContain('Get invite link');
	});

	it('in session: progress banner, transcript so far, no decision', () => {
		const detail = fixture('inSession');
		const body = page(detail);
		expect(body).toContain('Screening in progress');
		expect(body).toContain('Watch the graph live');
		expect(body).toContain(`id="${detail.messages[0].id}"`);
		expect(body).not.toMatch(/>\s*Shortlist\s*</);
	});

	it('scoring: explains the wait and shows skeleton cards', () => {
		const base = fixture('review');
		const body = page({
			...base,
			application: { ...base.application, status: 'scoring', overall_score: null },
			scores: []
		});
		expect(body).toContain('The AI is scoring the transcript.');
		expect(body).toContain('aria-busy="true"');
		expect(body).not.toMatch(/>\s*Shortlist\s*</);
	});
});
