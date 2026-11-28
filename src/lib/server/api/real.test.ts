import { isRedirect } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { realApi } from './real';
import { ApiError } from './types';

const event = vi.hoisted(() => ({
	fetch: vi.fn<typeof fetch>(),
	cookies: { delete: vi.fn() },
	getClientAddress: () => '203.0.113.7',
	url: new URL('http://app.test/dashboard/jobs?status=review')
}));

vi.mock('$app/server', () => ({ getRequestEvent: () => event }));
vi.mock('$app/env/private', () => ({
	API_BASE_URL: 'http://api.test',
	BFF_SHARED_SECRET: 'bff-secret-value'
}));

function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), { status });
}

async function caught(promise: Promise<unknown>): Promise<unknown> {
	return promise.then(
		() => expect.unreachable('expected a rejection'),
		(error: unknown) => error
	);
}

describe('realApi', () => {
	beforeEach(() => {
		event.fetch.mockReset();
		event.cookies.delete.mockReset();
	});

	it('calls the versioned base URL through the request fetch and encodes path segments', async () => {
		event.fetch.mockResolvedValue(json(200, { status: 'invited' }));
		await realApi.getSession('a/b');
		expect(event.fetch.mock.calls[0][0]).toBe('http://api.test/api/v1/sessions/a%2Fb');
	});

	it('forwards the client address and the BFF secret on every API request', async () => {
		event.fetch.mockImplementation(async () => json(200, {}));
		await realApi.getPublicJob('j');
		await realApi.apply('j', new FormData());
		await realApi.sendMessage('t', { content: 'hello' });
		expect(event.fetch).toHaveBeenCalledTimes(3);
		for (const [, init] of event.fetch.mock.calls) {
			const headers = new Headers(init?.headers);
			expect(headers.get('x-forwarded-for')).toBe('203.0.113.7');
			expect(headers.get('x-bff-secret')).toBe('bff-secret-value');
		}
	});

	it('sends the answer entry in the message body only when there is one', async () => {
		event.fetch.mockImplementation(async () => json(200, {}));
		const entry = { pasted_chars: 40, typed_chars: 2, duration_ms: 1_200 };
		await realApi.sendMessage('t', { content: 'hello', entry });
		await realApi.sendMessage('t', { content: 'hi' });
		const bodies = event.fetch.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
		expect(bodies).toEqual([{ content: 'hello', entry }, { content: 'hi' }]);
	});

	it('creates, edits and suggests with the contract methods and paths', async () => {
		event.fetch.mockImplementation(async () => json(200, {}));
		const rubric = [{ key: 'k1', label: 'L1', description: 'description', weight: 1 }];
		await realApi.createJob({
			title: 't',
			description: 'd',
			rubric,
			spoken_english_required: false
		});
		await realApi.updateJob('a/b', { title: 't', spoken_english_required: true });
		await realApi.suggestRubric({ title: 't', description: 'd' });
		const calls = event.fetch.mock.calls.map(([url, init]) => [url, init?.method, init?.body]);
		expect(calls).toEqual([
			[
				'http://api.test/api/v1/jobs',
				'POST',
				JSON.stringify({ title: 't', description: 'd', rubric, spoken_english_required: false })
			],
			[
				'http://api.test/api/v1/jobs/a%2Fb',
				'PATCH',
				'{"title":"t","spoken_english_required":true}'
			],
			['http://api.test/api/v1/jobs/rubric-suggestion', 'POST', '{"title":"t","description":"d"}']
		]);
	});

	it('keeps Retry-After seconds on a rate-limited error', async () => {
		event.fetch.mockResolvedValue(
			new Response(JSON.stringify({ error: { code: 'rate_limited', message: 'wait' } }), {
				status: 429,
				headers: { 'Retry-After': '125' }
			})
		);
		const error = await caught(realApi.suggestRubric({ title: 't', description: 'd' }));
		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).retryAfterSeconds).toBe(125);
	});

	it('sends JSON bodies and the status filter', async () => {
		event.fetch.mockImplementation(async () => json(200, { items: [] }));
		await realApi.sendMessage('t', { content: 'hello' });
		const [, init] = event.fetch.mock.calls[0];
		expect(init?.method).toBe('POST');
		expect(init?.body).toBe('{"content":"hello"}');

		await realApi.listApplications('j', { status: 'review' });
		expect(event.fetch.mock.calls[1][0]).toBe(
			'http://api.test/api/v1/jobs/j/applications?status=review'
		);
	});

	it('leaves the multipart Content-Type to fetch so the boundary is set', async () => {
		event.fetch.mockResolvedValue(json(201, { application_id: 'a' }));
		const form = new FormData();
		await realApi.apply('j', form);
		const [, init] = event.fetch.mock.calls[0];
		expect(init?.body).toBe(form);
		expect(new Headers(init?.headers).get('content-type')).toBeNull();
	});

	it('parses the contract error format', async () => {
		event.fetch.mockResolvedValue(
			json(409, {
				error: { code: 'already_applied', message: 'Already applied', details: { field: 'email' } }
			})
		);
		const error = await caught(realApi.getJob('j'));
		expect(error).toBeInstanceOf(ApiError);
		expect(error).toMatchObject({
			status: 409,
			code: 'already_applied',
			message: 'Already applied',
			details: { field: 'email' }
		});
	});

	it.each([
		['a non-JSON body', new Response('<html>Bad gateway</html>', { status: 502 })],
		['an unknown code', json(500, { error: { code: 'nope', message: 'x' } })]
	])('falls back to internal_error on %s', async (_name, response) => {
		event.fetch.mockResolvedValue(response);
		const error = await caught(realApi.listJobs());
		expect(error).toMatchObject({ status: response.status, code: 'internal_error' });
	});

	it('turns a network failure into an ApiError without leaking the cause', async () => {
		event.fetch.mockRejectedValue(new TypeError('connect ECONNREFUSED api.test'));
		const error = await caught(realApi.listJobs());
		expect(error).toMatchObject({ status: 502, code: 'internal_error' });
		expect((error as Error).message).not.toContain('api.test');
	});

	it('on a 401 clears the session cookie and redirects to login with the session-ended notice', async () => {
		event.fetch.mockResolvedValue(json(401, { error: { code: 'unauthorized', message: 'No' } }));
		const error = await caught(realApi.listJobs());
		expect(event.cookies.delete).toHaveBeenCalledWith('ts_session', { path: '/' });
		expect(isRedirect(error)).toBe(true);
		expect(error).toMatchObject({
			status: 303,
			location:
				'/dashboard/login?redirectTo=%2Fdashboard%2Fjobs%3Fstatus%3Dreview&reason=session_ended'
		});
	});

	it('reports a wrong password as an error instead of redirecting', async () => {
		event.fetch.mockResolvedValue(json(401, { error: { code: 'unauthorized', message: 'No' } }));
		const error = await caught(realApi.login('wrong'));
		expect(error).toMatchObject({ status: 401, code: 'unauthorized' });
		expect(event.cookies.delete).not.toHaveBeenCalled();
	});

	it('returns the raw response for the CV so it can be streamed', async () => {
		const pdf = new Response('%PDF', { headers: { 'Content-Type': 'application/pdf' } });
		event.fetch.mockResolvedValue(pdf);
		expect(await realApi.getCv('a')).toBe(pdf);
	});

	it('exposes the SSE base URL', () => {
		expect(realApi.sseBaseUrl()).toBe('http://api.test/api/v1');
	});

	it('starts with recording_consent only when it is given', async () => {
		event.fetch.mockImplementation(async () => json(200, {}));
		await realApi.startSession('t', true);
		await realApi.startSession('t', false);
		await realApi.startSession('t');
		const bodies = event.fetch.mock.calls.map(([, init]) => init?.body);
		expect(bodies).toEqual([
			'{"recording_consent":true}',
			'{"recording_consent":false}',
			undefined
		]);
		expect(event.fetch.mock.calls[0][0]).toBe('http://api.test/api/v1/sessions/t/start');
	});

	it('posts a spoken answer as audio_id and entry, without any content', async () => {
		event.fetch.mockImplementation(async () => json(202, {}));
		const entry = {
			pasted_chars: 0,
			typed_chars: 0,
			duration_ms: 20_000,
			mode: 'spoken' as const,
			start_latency_ms: 900,
			speaking_ms: 17_500,
			rerecord_count: 1
		};
		await realApi.sendMessage('t', { audio_id: 'a1', entry });
		const body = JSON.parse(String(event.fetch.mock.calls[0][1]?.body));
		expect(body).toEqual({ audio_id: 'a1', entry });
	});

	it('uploads a recording as multipart to the session audio path', async () => {
		event.fetch.mockResolvedValue(json(200, { audio_id: 'a1', transcript: 'hi' }));
		const form = new FormData();
		form.set('audio', new File([new Uint8Array(4)], 'answer.webm', { type: 'audio/webm' }));
		await expect(realApi.uploadAudio('a/b', form)).resolves.toMatchObject({ audio_id: 'a1' });
		const [url, init] = event.fetch.mock.calls[0];
		expect(url).toBe('http://api.test/api/v1/sessions/a%2Fb/audio');
		expect(init?.method).toBe('POST');
		expect(init?.body).toBe(form);
	});
});
