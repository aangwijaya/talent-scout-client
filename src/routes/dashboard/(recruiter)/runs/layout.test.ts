import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
	page: {
		route: { id: '' },
		url: new URL('http://localhost/dashboard/jobs'),
		error: null as { message: string } | null
	},
	navigating: { to: null }
}));
vi.mock('$app/state', () => state);
vi.mock('$app/paths', () => ({ resolve: (route: string) => route.replace('/(recruiter)', '') }));

const { default: Layout } = await import('../+layout.svelte');

const children = createRawSnippet(() => ({ render: () => '<p>child</p>' }));

function mainTag(routeId: string, error: { message: string } | null = null): string {
	state.page.route.id = routeId;
	state.page.error = error;
	const body = render(Layout, { props: { children } }).body;
	return body.match(/<main[^>]*>/)?.[0] ?? '';
}

describe('recruiter layout', () => {
	it('keeps table and review pages in the 1200px column', () => {
		for (const id of [
			'/dashboard/(recruiter)/jobs',
			'/dashboard/(recruiter)/applications/[applicationId]'
		]) {
			expect(mainTag(id), id).toContain('max-w-[1200px]');
		}
	});

	it('lets the graph run page use the full width, with no padding to break out of', () => {
		const main = mainTag('/dashboard/(recruiter)/runs/[runId]');
		expect(main).not.toContain('max-w-');
		expect(main).not.toMatch(/\bp-\d/);
	});

	it('keeps the run route error page (404 or load failure) in the padded column', () => {
		const main = mainTag('/dashboard/(recruiter)/runs/[runId]', { message: 'Not found' });
		expect(main).toContain('max-w-[1200px]');
		expect(main).toMatch(/\bp-4\b/);
	});
});
