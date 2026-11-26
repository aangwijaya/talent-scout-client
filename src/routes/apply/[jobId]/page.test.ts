import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import type { PublicJob } from '$lib/server/api/types';

vi.mock('$app/forms', () => ({ enhance: () => ({}) }));

const { default: Page } = await import('./+page.svelte');

const LINE = "The interview is spoken, in English. You'll need a microphone, or you can answer in text.";

const page = (spoken: boolean) => {
	const job: PublicJob = {
		id: 'job-1',
		title: 'Support Lead',
		description: 'Help customers on calls.',
		status: 'open',
		spoken_english_required: spoken
	};
	const props = { data: { job, demo: false }, form: null, params: { jobId: 'job-1' } };
	return render(Page, { props: props as never }).body;
};

describe('apply page', () => {
	it('says the interview is spoken, under the title, only when the job has it on', () => {
		const html = page(true).replaceAll('&#39;', "'");
		const afterTitle = html.split('</h1>')[1];
		expect(afterTitle).toMatch(/text-muted[^>]*>[\s\S]*lucide-mic/);
		expect(afterTitle).toContain(LINE);
		expect(page(false)).not.toContain('The interview is spoken');
	});
});
