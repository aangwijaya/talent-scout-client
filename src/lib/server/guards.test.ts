import { isRedirect, type RequestEvent } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import {
	isRecruiterRoute,
	LOGIN_PATH,
	loginRedirectTarget,
	normalizeRefererPath,
	redirectToLogin,
	requireRecruiter,
	sessionEndedNotice
} from './guards';

describe('normalizeRefererPath', () => {
	it.each([
		['/dashboard/jobs', '/dashboard/jobs'],
		['/dashboard/jobs?status=review#top', '/dashboard/jobs?status=review#top'],
		['/dashboard/a/../jobs', '/dashboard/jobs'],
		['/%2F/evil.example', '/%2F/evil.example']
	])('keeps the relative path %s', (input, expected) => {
		expect(normalizeRefererPath(input)).toBe(expected);
	});

	it.each([
		[null],
		[undefined],
		[''],
		['dashboard/jobs'],
		['https://evil.example/'],
		['javascript:alert(1)'],
		['//evil.example'],
		['/\\evil.example'],
		['\\\\evil.example'],
		['/\t/evil.example'],
		['/\n/evil.example'],
		[' //evil.example'],
		['/..//evil.example'],
		['/.//evil.example'],
		['//[']
	])('rejects %j', (input) => {
		expect(normalizeRefererPath(input)).toBeNull();
	});
});

describe('isRecruiterRoute', () => {
	const check = (id: string | null, path: string) =>
		isRecruiterRoute({
			route: { id } as RequestEvent['route'],
			url: new URL(path, 'http://app.test')
		});

	it.each([
		['/dashboard', '/dashboard'],
		['/dashboard/logout', '/dashboard/logout'],
		['/dashboard/(recruiter)/jobs', '/dashboard/jobs'],
		['/dashboard/(recruiter)/runs/[runId]/sse-token', '/dashboard/runs/1/sse-token'],
		['/dashboard/(recruiter)/jobs', '/%64ashboard/jobs'],
		[null, '/dashboard/unknown']
	])('guards route %s at %s', (id, path) => {
		expect(check(id, path)).toBe(true);
	});

	it.each([
		['/dashboard/login', '/dashboard/login'],
		['/', '/'],
		['/apply/[jobId]', '/apply/1'],
		['/s/[token]', '/s/dashboard'],
		[null, '/dashboards'],
		[null, '/unknown']
	])('leaves route %s at %s open', (id, path) => {
		expect(check(id, path)).toBe(false);
	});
});

describe('requireRecruiter', () => {
	const location = (path: string, cookie?: string): string => {
		const url = new URL(path, 'http://app.test');
		try {
			requireRecruiter({
				locals: { recruiter: null },
				url,
				request: new Request(url, { headers: cookie ? { cookie } : {} })
			});
		} catch (error) {
			if (isRedirect(error) && error.status === 303) return error.location;
			throw error;
		}
		return expect.unreachable('expected a redirect');
	};

	it('returns the session when there is one', () => {
		const recruiter = { token: 't', expiresAt: 1 };
		const url = new URL('http://app.test/');
		expect(requireRecruiter({ locals: { recruiter }, url, request: new Request(url) })).toBe(
			recruiter
		);
	});

	it('redirects to login and keeps the path and query', () => {
		expect(location('/dashboard/jobs?status=review')).toBe(
			'/dashboard/login?redirectTo=%2Fdashboard%2Fjobs%3Fstatus%3Dreview'
		);
	});

	it('drops a path that is unsafe to redirect to', () => {
		expect(location('http://app.test//evil.example')).toBe('/dashboard/login');
	});

	it('drops the logout path, so signing in does not log the recruiter out again', () => {
		expect(location('/dashboard/logout')).toBe(LOGIN_PATH);
	});

	it('marks the session as ended when the request carried a cookie that is no longer valid', () => {
		expect(location('/dashboard/jobs', 'theme=light; ts_session=1.expired')).toBe(
			'/dashboard/login?redirectTo=%2Fdashboard%2Fjobs&reason=session_ended'
		);
		expect(location('/dashboard/logout', 'ts_session=1.expired')).toBe(
			`${LOGIN_PATH}?reason=session_ended`
		);
	});

	it('does not mark a first visit without a session cookie as ended', () => {
		expect(location('/dashboard/jobs', 'not_ts_session=1')).not.toContain('reason=');
		expect(location('/dashboard/jobs')).not.toContain('reason=');
	});
});

describe('redirectToLogin', () => {
	const location = (sessionEnded?: boolean): string => {
		try {
			redirectToLogin(new URL('http://app.test/dashboard/jobs/1'), { sessionEnded });
		} catch (error) {
			if (isRedirect(error)) return error.location;
			throw error;
		}
		return expect.unreachable('expected a redirect');
	};

	it('adds the session-ended reason only when asked, as after a 401', () => {
		expect(location(true)).toBe(
			'/dashboard/login?redirectTo=%2Fdashboard%2Fjobs%2F1&reason=session_ended'
		);
		expect(location()).toBe('/dashboard/login?redirectTo=%2Fdashboard%2Fjobs%2F1');
	});
});

describe('sessionEndedNotice', () => {
	const notice = (search: string) =>
		sessionEndedNotice(new URL(`http://app.test/dashboard/login${search}`));

	it('is true only for the reason the guard adds', () => {
		expect(notice('?reason=session_ended')).toBe(true);
		expect(notice('')).toBe(false);
		expect(notice('?reason=other')).toBe(false);
	});
});

describe('loginRedirectTarget', () => {
	it.each([
		[null, '/dashboard/jobs'],
		['', '/dashboard/jobs'],
		['//evil.example', '/dashboard/jobs'],
		['/dashboard/logout', '/dashboard/jobs'],
		['/dashboard/logout?x=1', '/dashboard/jobs'],
		['/dashboard/login', '/dashboard/jobs'],
		['/dashboard/jobs/1?status=review', '/dashboard/jobs/1?status=review']
	])('maps %s to %s', (value, expected) => {
		expect(loginRedirectTarget(value)).toBe(expected);
	});
});
