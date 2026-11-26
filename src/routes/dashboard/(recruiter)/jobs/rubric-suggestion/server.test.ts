import { redirect } from '@sveltejs/kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi } from '$lib/server/api/mock';
import { ApiError } from '$lib/server/api/types';

vi.mock('$lib/server/api', () => ({ api: mockApi }));

const { POST } = await import('./+server');

afterEach(() => {
	vi.restoreAllMocks();
});

const call = (body: unknown) =>
	POST({
		request: new Request('http://x', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	} as never);

const input = { title: 'Frontend Engineer', description: 'Build the dashboard. '.repeat(4) };

describe('POST rubric-suggestion', () => {
	it('passes only the title and description to the API and returns its rubric', async () => {
		const spy = vi.spyOn(mockApi, 'suggestRubric');
		const res = await call({ ...input, extra: 'dropped' });
		expect(spy).toHaveBeenCalledWith(input);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.ok).toBe(true);
		expect(body.rubric.length).toBeGreaterThanOrEqual(3);
	});

	it('passes on the spoken English suggestion and its reason', async () => {
		vi.spyOn(mockApi, 'suggestRubric').mockResolvedValue({
			rubric: [],
			spoken_english_required: true,
			spoken_english_reason: 'Daily calls with US customers'
		});
		const body = await (await call(input)).json();
		expect(body).toMatchObject({
			ok: true,
			spoken_english_required: true,
			spoken_english_reason: 'Daily calls with US customers'
		});
	});

	it('reads a suggestion without the spoken English fields as false', async () => {
		// A server older than S-V2 (server#107) still answers without these fields, though the
		// contract now requires them; cast so the test keeps covering that answer.
		vi.spyOn(mockApi, 'suggestRubric').mockResolvedValue({ rubric: [] } as unknown as Awaited<
			ReturnType<typeof mockApi.suggestRubric>
		>);
		const body = await (await call(input)).json();
		expect(body).toMatchObject({ spoken_english_required: false, spoken_english_reason: '' });
	});

	it('the mock suggests spoken English with a reason', async () => {
		const suggestion = await mockApi.suggestRubric(input);
		expect(suggestion.spoken_english_required).toBe(true);
		expect(suggestion.spoken_english_reason).toBeTruthy();
	});

	it('returns 429 with the Retry-After seconds', async () => {
		vi.spyOn(mockApi, 'suggestRubric').mockRejectedValue(
			new ApiError(429, 'rate_limited', 'slow down', null, 125)
		);
		const res = await call(input);
		expect(res.status).toBe(429);
		expect(await res.json()).toEqual({ ok: false, status: 429, retry_after_seconds: 125 });
	});

	it('returns 502 when the model fails', async () => {
		vi.spyOn(mockApi, 'suggestRubric').mockRejectedValue(
			new ApiError(502, 'llm_unavailable', 'model down')
		);
		const res = await call(input);
		expect(res.status).toBe(502);
		expect(await res.json()).toEqual({ ok: false, status: 502, retry_after_seconds: null });
	});

	it('answers a JSON 401 when the API rejects the token and the API layer redirects to login', async () => {
		vi.spyOn(mockApi, 'suggestRubric').mockImplementation(() =>
			redirect(303, '/dashboard/login?reason=session_ended')
		);
		const res = await call(input);
		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ ok: false, status: 401, retry_after_seconds: null });
	});

	it('rejects a body that is not a title and description', async () => {
		const res = await call({ title: 1 });
		expect(res.status).toBe(400);
	});
});
