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
		await realApi.sendMessage('t', 'hello');
		expect(event.fetch).toHaveBeenCalledTimes(3);
		for (const [, init] of event.fetch.mock.calls) {
			const headers = new Headers(init?.headers);
			expect(headers.get('x-forwarded-for')).toBe('203.0.113.7');
			expect(headers.get('x-bff-secret')).toBe('bff-secret-value');
		}
	});

	it('sends JSON bodies and the status filter', async () => {
		event.fetch.mockImplementation(async () => json(200, { items: [] }));
		await realApi.sendMessage('t', 'hello');
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
			location: '/dashboard/login?redirectTo=%2Fdashboard%2Fjobs%3Fstatus%3Dreview&reason=session_ended'
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
});
