import { isActionFailure, isRedirect, type RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '$lib/server/api/types';

const api = vi.hoisted(() => ({ login: vi.fn() }));
vi.mock('$lib/server/api', () => ({ api }));

const { actions, load } = await import('./+page.server');

const EXPIRES_AT = new Date(Date.now() + 3_600_000).toISOString();

function event(
	options: { password?: string; redirectTo?: string; recruiter?: object; reason?: string } = {}
) {
	const url = new URL('http://app.test/dashboard/login');
	if (options.redirectTo) url.searchParams.set('redirectTo', options.redirectTo);
	if (options.reason) url.searchParams.set('reason', options.reason);
	const body = new FormData();
	if (options.password !== undefined) body.set('password', options.password);
	return {
		url,
		request: new Request(url, { method: 'POST', body }),
		cookies: { set: vi.fn(), delete: vi.fn() },
		locals: { recruiter: options.recruiter ?? null }
	} as unknown as RequestEvent & { cookies: { set: ReturnType<typeof vi.fn> } };
}

const settle = (run: () => unknown) =>
	Promise.resolve()
		.then(run)
		.catch((thrown: unknown) => thrown);

beforeEach(() => {
	vi.resetAllMocks();
});

describe('load', () => {
	it('sends a recruiter who is already signed in to the jobs list', async () => {
		const thrown = await settle(() =>
			load(event({ recruiter: { token: 't', expiresAt: 1 } }) as never)
		);
		expect(isRedirect(thrown) && thrown.location).toBe('/dashboard/jobs');
	});

	it('leaves out the session-ended notice on a plain first visit', async () => {
		await expect(settle(() => load(event() as never))).resolves.toEqual({ sessionEnded: false });
	});

	it('shows the session-ended notice after the guard cleared a session', async () => {
		await expect(settle(() => load(event({ reason: 'session_ended' }) as never))).resolves.toEqual({
			sessionEnded: true
		});
	});
});

describe('login action', () => {
	it('stores the token only in the httpOnly cookie and redirects to redirectTo', async () => {
		api.login.mockResolvedValue({ access_token: 'secret-token', expires_at: EXPIRES_AT });
		const e = event({ password: 'pw', redirectTo: '/dashboard/jobs/1' });
		const thrown = await settle(() => actions.default(e as never));

		expect(api.login).toHaveBeenCalledWith('pw');
		expect(isRedirect(thrown) && thrown.location).toBe('/dashboard/jobs/1');
		const [name, value, options] = e.cookies.set.mock.calls[0];
		expect(name).toBe('ts_session');
		expect(value).toBe(`${Date.parse(EXPIRES_AT)}.secret-token`);
		expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
	});

	it('ignores a logout redirectTo from a stale tab', async () => {
		api.login.mockResolvedValue({ access_token: 'secret-token', expires_at: EXPIRES_AT });
		const thrown = await settle(() =>
			actions.default(event({ password: 'pw', redirectTo: '/dashboard/logout' }) as never)
		);
		expect(isRedirect(thrown) && thrown.location).toBe('/dashboard/jobs');
	});

	it('returns a 400 failure for an empty password without calling the API', async () => {
		const result = await settle(() => actions.default(event({ password: '' }) as never));
		expect(isActionFailure(result) && result.status).toBe(400);
		expect(api.login).not.toHaveBeenCalled();
	});

	it('returns a 401 failure for a wrong password and sets no cookie', async () => {
		api.login.mockRejectedValue(new ApiError(401, 'unauthorized', 'Wrong password'));
		const e = event({ password: 'nope' });
		const result = await settle(() => actions.default(e as never));
		expect(isActionFailure(result) && result.status).toBe(401);
		expect(isActionFailure(result) && result.data).toEqual({
			error: 'That password is not correct.'
		});
		expect(e.cookies.set).not.toHaveBeenCalled();
	});

	it('returns a generic failure for other API errors', async () => {
		api.login.mockRejectedValue(new ApiError(429, 'rate_limited', 'slow down'));
		const result = await settle(() => actions.default(event({ password: 'pw' }) as never));
		expect(isActionFailure(result) && result.status).toBe(429);
		expect(isActionFailure(result) && JSON.stringify(result.data)).not.toContain('token');
	});
});
