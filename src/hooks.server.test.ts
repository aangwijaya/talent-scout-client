import { isRedirect, type RequestEvent } from '@sveltejs/kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handle, handleError, handleFetch } from './hooks.server';

vi.mock('$app/env/private', () => ({
	API_BASE_URL: 'http://api.test:8080',
	BFF_SHARED_SECRET: 'bff-secret-value'
}));

const FUTURE = Date.now() + 60_000;
const API = 'http://api.test:8080/api/v1';

function fakeEvent(options: { routeId?: string | null; path?: string; cookie?: string } = {}) {
	const { routeId = null, path = '/', cookie } = options;
	return {
		route: { id: routeId },
		url: new URL(path, 'http://app.test'),
		locals: {},
		request: new Request(new URL(path, 'http://app.test')),
		cookies: { get: () => cookie, delete: vi.fn() }
	} as unknown as RequestEvent;
}

describe('handle', () => {
	const run = (event: RequestEvent) => {
		const resolve = vi.fn(async () => new Response('ok'));
		handle({ event, resolve });
		return { resolve };
	};

	it('redirects a recruiter route without a session, before anything resolves', () => {
		const event = fakeEvent({
			routeId: '/dashboard/(recruiter)/jobs',
			path: '/dashboard/jobs?status=review'
		});
		const resolve = vi.fn();
		try {
			handle({ event, resolve });
			expect.unreachable('expected a redirect');
		} catch (error) {
			if (!isRedirect(error)) throw error;
			expect(error.status).toBe(303);
			expect(error.location).toBe(
				'/dashboard/login?redirectTo=%2Fdashboard%2Fjobs%3Fstatus%3Dreview'
			);
		}
		expect(resolve).not.toHaveBeenCalled();
	});

	it('resolves a recruiter route with a session and exposes it on locals', () => {
		const event = fakeEvent({
			routeId: '/dashboard/(recruiter)/jobs',
			path: '/dashboard/jobs',
			cookie: `${FUTURE}.tok`
		});
		const { resolve } = run(event);
		expect(resolve).toHaveBeenCalledOnce();
		expect(event.locals.recruiter).toEqual({ token: 'tok', expiresAt: FUTURE });
	});

	it.each([
		['/dashboard/login', '/dashboard/login'],
		['/apply/[jobId]', '/apply/1'],
		['/s/[token]', '/s/abc']
	])('resolves %s without a session', (routeId, path) => {
		const event = fakeEvent({ routeId, path });
		const { resolve } = run(event);
		expect(resolve).toHaveBeenCalledOnce();
		expect(event.locals.recruiter).toBeNull();
	});
});

describe('handleFetch', () => {
	async function sent(request: Request, token: string | null = 'tok') {
		const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response('ok'));
		const event = {
			locals: { recruiter: token ? { token, expiresAt: FUTURE } : null },
			getClientAddress: () => '203.0.113.7'
		};
		await handleFetch({ event: event as unknown as RequestEvent, request, fetch });
		return fetch.mock.calls[0][0] as Request;
	}

	it('adds the Bearer token for API requests', async () => {
		const request = await sent(new Request(`${API}/jobs`));
		expect(request.headers.get('authorization')).toBe('Bearer tok');
	});

	it("replaces the browser's Authorization and drops its cookies on API requests", async () => {
		const request = await sent(
			new Request(`${API}/jobs`, {
				headers: { authorization: 'Bearer browser', cookie: 'ts_session=browser' }
			})
		);
		expect(request.headers.get('authorization')).toBe('Bearer tok');
		expect(request.headers.get('cookie')).toBeNull();
		// Kit adds cookies back after this hook unless credentials are omitted.
		expect(request.credentials).toBe('omit');
	});

	it('sends no Authorization to the API without a session', async () => {
		const request = await sent(
			new Request(`${API}/jobs/1/public`, { headers: { authorization: 'Bearer browser' } }),
			null
		);
		expect(request.headers.get('authorization')).toBeNull();
	});

	it.each([
		['another host', 'https://other.example/x'],
		['a host sharing the prefix', 'http://api.test.evil.example:8080/x'],
		['another port', 'http://api.test:9090/x'],
		['another scheme', 'https://api.test:8080/x'],
		['the API origin in a query', 'https://other.example/?u=http://api.test:8080/']
	])('never sends the token to %s', async (_name, url) => {
		const request = await sent(new Request(url));
		expect(request.headers.get('authorization')).toBeNull();
	});

	it('forwards the client address and the BFF secret to the API, replacing browser values', async () => {
		const request = await sent(
			new Request(`${API}/jobs/1/applications`, {
				method: 'POST',
				headers: { 'x-forwarded-for': '6.6.6.6', 'x-bff-secret': 'forged' }
			}),
			null
		);
		expect(request.headers.get('x-forwarded-for')).toBe('203.0.113.7');
		expect(request.headers.get('x-bff-secret')).toBe('bff-secret-value');
	});

	it.each([
		['another host', 'https://other.example/x'],
		['another port', 'http://api.test:9090/x']
	])('sends neither the client address nor the secret to %s', async (_name, url) => {
		const request = await sent(new Request(url));
		expect(request.headers.get('x-forwarded-for')).toBeNull();
		expect(request.headers.get('x-bff-secret')).toBeNull();
	});

	it('keeps the method and a multipart body', async () => {
		const form = new FormData();
		form.set('name', 'Budi');
		const request = await sent(
			new Request(`${API}/jobs/1/applications`, { method: 'POST', body: form })
		);
		expect(request.method).toBe('POST');
		expect((await request.formData()).get('name')).toBe('Budi');
	});
});

type HandleErrorInput = Parameters<typeof handleError>[0];

describe('handleError', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	function logged(error: unknown, event: RequestEvent) {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		const result = handleError({ kind: 'unknown', error, event });
		return { result, line: String(log.mock.calls[0][0]) };
	}

	it('returns a generic message and logs the method and route id', () => {
		const { result, line } = logged(
			new Error('boom'),
			fakeEvent({ routeId: '/s/[token]', path: '/s/applicant-token' })
		);
		expect(result).toEqual({ message: 'Something went wrong' });
		expect(line).toContain('GET /s/[token]');
		expect(line).toContain('boom');
		expect(line).not.toContain('applicant-token');
	});

	it.each([
		['app', { message: 'This session has expired' }],
		['framework', { status: 404, message: 'Not Found' }]
	] as const)('keeps the message of %s errors and does not log them', (kind, error) => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(handleError({ kind, error, event: fakeEvent() } as HandleErrorInput)).toBeUndefined();
		expect(log).not.toHaveBeenCalled();
	});

	it('redacts credentials and the current session token from the log', () => {
		const event = fakeEvent();
		event.locals.recruiter = { token: 'session-value', expiresAt: FUTURE };
		const { line } = logged(
			new Error(
				'failed: session-value Authorization: Bearer abc cookie: ts_session=def x-bff-secret: ghi GET /e?sse_token=jkl'
			),
			event
		);
		for (const secret of ['session-value', 'abc', 'def', 'ghi', 'jkl']) {
			expect(line).not.toContain(secret);
		}
	});

	it('redacts the bare BFF secret value from the log', () => {
		const { line } = logged(new Error('upstream echoed bff-secret-value'), fakeEvent());
		expect(line).not.toContain('bff-secret-value');
	});

	it('copes with thrown values that are not errors, and with no session on locals yet', () => {
		const { result, line } = logged('plain failure', fakeEvent());
		expect(result).toEqual({ message: 'Something went wrong' });
		expect(line).toContain('plain failure');
	});
});
