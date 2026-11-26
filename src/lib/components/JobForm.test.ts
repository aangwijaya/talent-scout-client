import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import type { JobValues } from './job-form';

vi.mock('$app/forms', () => ({ applyAction: vi.fn(), enhance: () => ({}) }));
vi.mock('$app/paths', () => ({ resolve: (route: string) => route.replace('/(recruiter)', '') }));
vi.mock('$app/state', () => ({ page: { url: new URL('http://app.test/dashboard/jobs/new') } }));

const { default: JobForm } = await import('./JobForm.svelte');
const { default: SpokenEnglishHint } = await import('./SpokenEnglishHint.svelte');

const values = (spoken: boolean): JobValues => ({
	title: 'Support Lead',
	description: 'x'.repeat(60),
	status: 'open',
	spoken_english_required: spoken,
	rubric: []
});

const body = (props: Partial<Parameters<typeof JobForm>[1]> & { initial: JobValues }) =>
	render(JobForm, { props: { mode: 'create', cancelHref: '/dashboard/jobs', ...props } }).body;

const switchTag = (html: string) =>
	html.match(/<input[^>]*name="spoken_english_required"[^>]*>/)?.[0] ?? '';

const CAPTION = 'Up to 2 minutes per answer, 20 minutes per interview.';
const NOTE = 'Changing this applies to invites sent after you save.';

describe('JobForm spoken English switch', () => {
	it('is a real checkbox with role="switch", off by default for a new job', () => {
		const html = body({ initial: values(false) });
		const input = switchTag(html);
		expect(input).toContain('type="checkbox"');
		expect(input).toContain('role="switch"');
		expect(input).not.toMatch(/\schecked/);
		expect(html).toContain('Spoken English interview');
		expect(html).not.toContain(CAPTION);
	});

	it('starts on, with the limits caption, when the job has it on', () => {
		const html = body({ initial: values(true) });
		expect(switchTag(html)).toMatch(/\schecked/);
		expect(html).toContain(CAPTION);
	});

	it('shows the sessions note on edit only when the job has applications', () => {
		const edit = { mode: 'edit' as const, initial: values(false) };
		expect(body({ ...edit, applicantCount: 2, locked: true })).toContain(
			`${NOTE} The 2 interviews already sent keep their mode.`
		);
		expect(body({ ...edit, applicantCount: 0 })).not.toContain(NOTE);
		expect(body({ initial: values(false) })).not.toContain(NOTE);
	});
});

describe('SpokenEnglishHint', () => {
	it('renders the reason as text, never HTML', () => {
		const html = render(SpokenEnglishHint, {
			props: { reason: '<img src=x onerror=alert(1)>Calls', onTurnOn: () => {} }
		}).body;
		expect(html).toContain('AI suggests turning this on.');
		expect(html).toContain('&lt;img src=x onerror=alert(1)>Calls');
		expect(html).not.toContain('<img');
		expect(html).toMatch(/<button[^>]*>[\s\S]*Turn on/);
	});
});
