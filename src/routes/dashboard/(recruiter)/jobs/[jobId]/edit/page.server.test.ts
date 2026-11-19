import { isActionFailure, isHttpError, isRedirect } from '@sveltejs/kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jobs } from '$lib/server/api/fixtures';
import { mockApi } from '$lib/server/api/mock';
import { ApiError } from '$lib/server/api/types';

vi.mock('$lib/server/api', () => ({ api: mockApi }));

const { actions, load } = await import('./+page.server');

afterEach(() => {
	vi.restoreAllMocks();
});

const job = jobs[0];

function form(title: string, rubricKeys: string[] = job.rubric.map(({ key }) => key)): FormData {
	const data = new FormData();
	data.set('title', title);
	data.set('description', job.description);
	data.set('status', 'closed');
	rubricKeys.forEach((key, i) => {
		const source = job.rubric[i] ?? job.rubric[0];
		data.set(`rubric[${i}].key`, key);
		data.set(`rubric[${i}].label`, source.label);
		data.set(`rubric[${i}].description`, source.description);
		data.set(`rubric[${i}].weight`, String(source.weight));
	});
	return data;
}

const submit = (data: FormData, jobId = job.id) =>
	actions.default({
		params: { jobId },
		request: new Request('http://x', { method: 'POST', body: data })
	} as never);

describe('edit job', () => {
	it('locks the rubric when the job has applications', async () => {
		const data = await Promise.resolve(load({ params: { jobId: job.id } } as never));
		expect(data?.job.id).toBe(job.id);
		expect(data?.locked).toBe(job.application_count > 0);
		expect(data?.locked).toBe(true);
	});

	it('404s for an unknown job', async () => {
		const thrown = await Promise.resolve(load({ params: { jobId: 'nope' } } as never)).catch(
			(e: unknown) => e
		);
		expect(isHttpError(thrown) && thrown.status).toBe(404);
	});

	it('leaves rubric out of the PATCH body when the job has applications', async () => {
		const spy = vi.spyOn(mockApi, 'updateJob');
		// Even a broken rubric in the form is ignored: the lock comes from the API, not the form.
		const thrown = await submit(form('Renamed job', ['1bad'])).catch((e: unknown) => e);
		expect(spy).toHaveBeenCalledWith(job.id, {
			title: 'Renamed job',
			description: job.description,
			status: 'closed'
		});
		expect(isRedirect(thrown) && thrown.location).toBe(`/dashboard/jobs/${job.id}?saved=updated`);
	});

	it('sends the rubric when the job has no applications', async () => {
		vi.spyOn(mockApi, 'getJob').mockResolvedValue({ ...job, application_count: 0 });
		const spy = vi.spyOn(mockApi, 'updateJob');
		await submit(form('Renamed job')).catch(() => null);
		expect(spy.mock.calls[0][1].rubric).toEqual(job.rubric);
	});

	it('maps a server details.field onto that input', async () => {
		vi.spyOn(mockApi, 'updateJob').mockRejectedValue(
			new ApiError(400, 'validation_failed', 'title is taken', { field: 'title' })
		);
		const result = await submit(form('Renamed job'));
		expect(isActionFailure(result) && result.data.errors).toEqual({ title: 'title is taken' });
	});
});
