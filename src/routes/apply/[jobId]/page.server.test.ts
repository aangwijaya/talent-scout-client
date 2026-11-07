import { isActionFailure, isHttpError, type RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '$lib/server/api/types';

const api = vi.hoisted(() => ({ getPublicJob: vi.fn(), apply: vi.fn() }));
vi.mock('$lib/server/api', () => ({ api }));

const { actions, load } = await import('./+page.server');

const JOB_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const job = { id: JOB_ID, title: 'Senior Frontend Engineer', description: 'JD', status: 'open' };

function validForm() {
	const data = new FormData();
	data.set('name', 'Budi Santoso');
	data.set('email', 'budi@example.com');
	data.set('cv', new File([new Uint8Array(10)], 'cv.pdf', { type: 'application/pdf' }));
	return data;
}

function event(body?: FormData) {
	const url = `http://app.test/apply/${JOB_ID}`;
	const request = body ? new Request(url, { method: 'POST', body }) : new Request(url);
	return { params: { jobId: JOB_ID }, request } as unknown as RequestEvent;
}

const runLoad = (e: RequestEvent) => Promise.resolve(load(e as never));
const runAction = (e: RequestEvent) => Promise.resolve(actions.default(e as never));

beforeEach(() => {
	vi.resetAllMocks();
});

describe('load', () => {
	it('returns the public job', async () => {
		api.getPublicJob.mockResolvedValue(job);
		await expect(runLoad(event())).resolves.toEqual({ job });
		expect(api.getPublicJob).toHaveBeenCalledWith(JOB_ID);
	});

	it('turns a missing job into a friendly 404', async () => {
		api.getPublicJob.mockRejectedValue(new ApiError(404, 'not_found', 'job not found'));
		const thrown = await runLoad(event()).catch((e: unknown) => e);
		expect(isHttpError(thrown, 404)).toBe(true);
		expect((thrown as { body: { message: string } }).body.message).toMatch(/job/i);
	});
});

describe('apply action', () => {
	it('forwards the multipart form and returns the API message', async () => {
		api.apply.mockResolvedValue({ application_id: 'a', status: 'invited', message: 'Thanks!' });
		await expect(runAction(event(validForm()))).resolves.toEqual({ message: 'Thanks!' });
		const [jobId, sent] = api.apply.mock.calls[0] as [string, FormData];
		expect(jobId).toBe(JOB_ID);
		expect(sent.get('name')).toBe('Budi Santoso');
		expect(sent.get('cv')).toBeInstanceOf(File);
	});

	it('rejects an oversized CV without calling the API', async () => {
		const data = validForm();
		const big = new Uint8Array(2 * 1024 * 1024 + 1);
		data.set('cv', new File([big], 'cv.pdf', { type: 'application/pdf' }));
		const result = await runAction(event(data));
		expect(isActionFailure(result)).toBe(true);
		expect(result).toMatchObject({
			status: 400,
			data: { errors: { cv: expect.stringMatching(/2 MB/) }, values: { name: 'Budi Santoso' } }
		});
		expect(api.apply).not.toHaveBeenCalled();
	});

	it.each([
		[409, 'already_applied'],
		[413, 'file_too_large'],
		[409, 'invalid_state'],
		[429, 'rate_limited'],
		[404, 'not_found'],
		[400, 'invalid_file']
	] as const)('shows friendly copy for %i %s', async (status, code) => {
		api.apply.mockRejectedValue(new ApiError(status, code, 'raw server text'));
		const result = await runAction(event(validForm()));
		expect(isActionFailure(result)).toBe(true);
		expect(result).toMatchObject({ status, data: { error: expect.any(String) } });
		expect(JSON.stringify(result)).not.toContain('raw server text');
		expect(JSON.stringify(result)).not.toContain('Something went wrong');
	});

	it('rethrows errors that are not contract errors', async () => {
		api.apply.mockRejectedValue(new Error('network down'));
		await expect(runAction(event(validForm()))).rejects.toThrow('network down');
	});
});
