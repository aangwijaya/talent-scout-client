import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/paths', () => ({
	resolve: (route: string) => route.replace('/(recruiter)', '')
}));
vi.mock('$app/navigation', () => ({ invalidateAll: () => Promise.resolve() }));
const state = vi.hoisted(() => ({
	page: {
		status: 500,
		error: { message: 'Server error' } as { message: string } | null,
		route: { id: '/dashboard/(recruiter)/applications/[applicationId]' as string | null }
	}
}));
vi.mock('$app/state', () => state);

const { default: DashboardError } = await import('./+error.svelte');
const { default: RunError } = await import('./runs/[runId]/+error.svelte');
const { default: RootError } = await import('../../+error.svelte');

describe('dashboard and graph run error pages', () => {
	it.each(['dashboard', 'graph run'])(
		'%s: gives a server error an h1, the banner, Try again and Back to jobs',
		(name) => {
			state.page.status = 500;
			const body = name === 'dashboard' ? render(DashboardError).body : render(RunError).body;
			expect(body.match(/<h1/g)).toHaveLength(1);
			expect(body).toMatch(/<h1[^>]*>Something went wrong<\/h1>/);
			expect(body).toMatch(/<h2[^>]*>Couldn't load/);
			expect(body).toContain('Server error');
			expect(body).toContain('Try again');
			expect(body).toMatch(/href="\/dashboard\/jobs"[^>]*>(<!---->)*Back to jobs/);
		}
	);
});

describe('not found in the dashboard', () => {
	it('keeps the empty state with its title as the h1', () => {
		state.page.status = 404;
		state.page.route.id = '/dashboard/(recruiter)/jobs/[jobId]';
		expect(render(DashboardError).body).toMatch(/<h1[^>]*>This job doesn't exist<\/h1>/);
		state.page.route.id = '/dashboard/(recruiter)/runs/[runId]';
		expect(render(RunError).body).toMatch(/<h1[^>]*>Graph run not found<\/h1>/);
	});
});

describe('root error page', () => {
	it('says page not found for a 404 with one sign-in action', () => {
		state.page.status = 404;
		const body = render(RootError).body;
		expect(body).toMatch(/<h1[^>]*>Page not found<\/h1>/);
		expect(body).toContain('404');
		expect(body).toMatch(/href="\/dashboard\/login"[^>]*>(<!---->)*Go to sign in/);
		expect(body).not.toContain('Try again');
	});

	it('offers Try again as well for a server error', () => {
		state.page.status = 500;
		const body = render(RootError).body;
		expect(body).toMatch(/<h1[^>]*>Something went wrong<\/h1>/);
		expect(body).toContain('500');
		expect(body).toContain('Try again');
	});
});
