import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import { MOCK_RUN_ID, MOCK_RUNNING_RUN_ID } from '$lib/mock';
import { graphRunSnapshot } from '$lib/server/api/fixtures';

vi.mock('$app/paths', () => ({
	resolve: (route: string, params: Record<string, string> = {}) =>
		route
			.replace('/(recruiter)', '')
			.replace(/\[(\w+)\]/g, (_: string, key: string) => params[key] ?? '')
}));

const { default: Page } = await import('./+page.svelte');

function page(runId: string, from: string | null = null): string {
	const run = graphRunSnapshot(runId);
	if (!run) throw new Error(runId);
	return render(Page, { props: { data: { run, stream: null, from }, params: { runId } } as never })
		.body;
}

/** The opening tag of the Live toggle. */
const liveButton = (body: string) =>
	body.match(/<button[^>]*>(?:(?!<\/button>)[\s\S])*Live/)?.[0] ?? '';
const DISABLED = /\sdisabled(=""|[\s>])/;

describe('graph run page', () => {
	it('disables Live for an ended run, explains why, and opens in Replay', () => {
		const body = page(MOCK_RUN_ID);
		const live = liveButton(body);
		expect(live).toMatch(DISABLED);
		expect(live).toContain('aria-describedby="live-ended"');
		expect(body).toContain('id="live-ended"');
		expect(body).toContain('The run has ended, so only replay is available.');
		expect(body).toMatch(/aria-pressed="true"[^>]*>Replay/);
		expect(body).toContain('Replay position');
	});

	it('opens a running run in Live, with Live enabled', () => {
		const body = page(MOCK_RUNNING_RUN_ID);
		const live = liveButton(body);
		expect(live).not.toMatch(DISABLED);
		expect(live).toContain('aria-pressed="true"');
		expect(body).not.toContain('only replay is available');
		expect(body).toContain('role="status"');
	});

	it('shows the loading skeleton until the first event arrives', () => {
		expect(page(MOCK_RUN_ID)).toContain('aria-label="Loading graph run"');
	});

	it('links back to the application review it came from, or to jobs', () => {
		const from = '11111111-2222-4333-8444-555555555555';
		expect(page(MOCK_RUN_ID, from)).toContain(`href="/dashboard/applications/${from}"`);
		expect(page(MOCK_RUN_ID)).toContain('href="/dashboard/jobs"');
	});

	it('draws Play filled, 18px ghost icons, tight buttons and wider gaps around the slider', () => {
		const body = page(MOCK_RUN_ID);
		const play = body.match(/<button[^>]*aria-label="Play"[\s\S]*?<\/button>/)?.[0] ?? '';
		expect(play).toMatch(/<svg[^>]*fill="currentColor"/);
		for (const label of ['First event', 'Previous event', 'Next event']) {
			const button =
				body.match(new RegExp(`<button[^>]*aria-label="${label}"[\\s\\S]*?</button>`))?.[0] ?? '';
			expect(button, label).toMatch(/<svg[^>]*width="18"/);
		}
		expect(body).toMatch(/<div class="flex items-center gap-1"[^>]*>\s*<button[^>]*First event/);
		expect(body).toMatch(/class="flex flex-wrap items-center gap-3"[^>]*>\s*<div[^>]*gap-1/);
	});

	it('fills the layout without a 100vw breakout', () => {
		const body = page(MOCK_RUN_ID);
		expect(body).not.toMatch(/w-screen|50vw|-mt-\d|mb-\[-/);
	});

	it('shows the header status and totals as skeletons while the events load', () => {
		const body = page(MOCK_RUN_ID);
		const header = body.match(/<header[\s\S]*?<\/header>/)?.[0] ?? '';
		for (const text of ['Running', 'Succeeded', 'Failed', '$0', '0 in']) {
			expect(header, text).not.toContain(text);
		}
		expect(header).toMatch(/aria-hidden="true"[^>]*motion-safe:animate-pulse/);
	});

	it('numbers the Live status from received events only, not the snapshot', () => {
		const run = graphRunSnapshot(MOCK_RUNNING_RUN_ID);
		expect(run?.last_seq).toBeGreaterThan(0);
		const status =
			page(MOCK_RUNNING_RUN_ID).match(/<p role="status"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? '';
		expect(status).not.toContain(`#${run?.last_seq}`);
	});

	it('shows the short run id and session id in mono', () => {
		const body = page(MOCK_RUN_ID);
		expect(body).toContain(MOCK_RUN_ID.slice(0, 8));
		expect(body).toMatch(/<h1[^>]*class="[^"]*text-heading-sm font-semibold/);
	});
});
