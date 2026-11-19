import { isActionFailure, isRedirect, type ActionFailure } from '@sveltejs/kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi } from '$lib/server/api/mock';
import { ApiError, type Job } from '$lib/server/api/types';
import { LIMIT_MESSAGE } from '$lib/components/job-form';

vi.mock('$lib/server/api', () => ({ api: mockApi }));

const { actions, load } = await import('./+page.server');

afterEach(() => {
	vi.restoreAllMocks();
});

const RUBRIC = [
	['frontend_depth', 'Frontend depth', 'Svelte, state and performance', '2'],
	['communication', 'Communication', 'Explains tradeoffs clearly', '1'],
	['system_design', 'System design', 'Structures larger features', '3']
];

function form(overrides: Record<string, string> = {}): FormData {
	const data = new FormData();
	data.set('title', 'Staff Engineer');
	data.set('description', 'Lead the platform team. '.repeat(4));
	data.set('status', 'open');
	RUBRIC.forEach(([key, label, description, weight], i) => {
		data.set(`rubric[${i}].key`, key);
		data.set(`rubric[${i}].label`, label);
		data.set(`rubric[${i}].description`, description);
		data.set(`rubric[${i}].weight`, weight);
	});
	for (const [name, value] of Object.entries(overrides)) data.set(name, value);
	return data;
}

type Failure = { values: { title: string; rubric: unknown[] }; errors: Record<string, string> };

const submit = async (data: FormData) =>
	(await actions.default({
		request: new Request('http://x', { method: 'POST', body: data })
	} as never)) as ActionFailure<Failure>;

describe('new job', () => {
	it('loads the job count for the 20-job cap', async () => {
		const data = await Promise.resolve(load({} as never));
		expect(data?.jobCount).toBe(1);
	});

	it('creates the job with the contract body and redirects to its applicants page', async () => {
		const spy = vi.spyOn(mockApi, 'createJob');
		const thrown = await submit(form()).catch((e: unknown) => e);
		expect(spy).toHaveBeenCalledWith({
			title: 'Staff Engineer',
			description: 'Lead the platform team. '.repeat(4),
			status: 'open',
			rubric: RUBRIC.map(([key, label, description, weight]) => ({
				key,
				label,
				description,
				weight: Number(weight)
			}))
		});
		expect(isRedirect(thrown) && thrown.status).toBe(303);
		expect(isRedirect(thrown) && thrown.location).toMatch(
			/^\/dashboard\/jobs\/[^/]+\?saved=created$/
		);
	});

	it('fails with field errors before calling the API when the form breaks the rules', async () => {
		const spy = vi.spyOn(mockApi, 'createJob');
		const result = await submit(form({ title: 'ab', 'rubric[1].key': '1bad' }));
		expect(spy).not.toHaveBeenCalled();
		expect(isActionFailure(result)).toBe(true);
		expect(result.status).toBe(400);
		expect(Object.keys(result.data.errors)).toEqual(
			expect.arrayContaining(['title', 'rubric[1].key'])
		);
	});

	it('maps a server details.field onto that input', async () => {
		vi.spyOn(mockApi, 'createJob').mockRejectedValue(
			new ApiError(400, 'validation_failed', 'key is taken', { field: 'rubric[2].key' })
		);
		const result = await submit(form());
		expect(result.data.errors).toEqual({ 'rubric[2].key': 'key is taken' });
	});

	it('shows the 20-job message on 409', async () => {
		vi.spyOn(mockApi, 'createJob').mockRejectedValue(
			new ApiError(409, 'invalid_state', 'too many jobs')
		);
		const result = await submit(form());
		expect(result.status).toBe(409);
		expect(result.data.errors).toEqual({ form: LIMIT_MESSAGE });
	});

	it('keeps the submitted values on failure', async () => {
		const result = await submit(form({ title: 'ab' }));
		expect(result.data.values.rubric).toHaveLength(3);
		expect(result.data.values.title).toBe('ab');
	});

	it('returns a Job from the mock create', async () => {
		const job: Job = await mockApi.createJob({
			title: 'Staff Engineer',
			description: 'x'.repeat(60),
			rubric: []
		});
		expect(job.status).toBe('open');
	});
});
