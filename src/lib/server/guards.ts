import { redirect, type RequestEvent } from '@sveltejs/kit';
import { SESSION_COOKIE, type RecruiterSession } from './session';

export const DASHBOARD_PATH = '/dashboard';
export const LOGIN_PATH = '/dashboard/login';
export const LOGOUT_PATH = '/dashboard/logout';
export const HOME_PATH = '/dashboard/jobs';
const PARSE_BASE = 'http://relative.invalid';
const REASON_PARAM = 'reason';
const SESSION_ENDED = 'session_ended';

/**
 * Returns a same-origin path that is safe to redirect to, or null. Parsing the way a browser does
 * catches `//evil.example`, `/\evil.example`, and tabs or newlines that browsers strip. Checking
 * the parsed path catches `/..//evil.example`, which only normalizes to `//evil.example`.
 */
export function normalizeRefererPath(value: string | null | undefined): string | null {
	if (!value?.startsWith('/')) return null;

	const url = URL.parse(value, PARSE_BASE);
	if (url?.origin !== PARSE_BASE || url.pathname.startsWith('//')) return null;
	return url.pathname + url.search + url.hash;
}

/**
 * Prefers the route id: Kit matches routes on the decoded path, so `/%64ashboard/jobs` reaches a
 * recruiter route although its `url.pathname` does not start with `/dashboard`.
 */
export function isRecruiterRoute({ route, url }: Pick<RequestEvent, 'route' | 'url'>): boolean {
	const path = route.id ?? url.pathname;
	if (path === LOGIN_PATH) return false;
	return path === DASHBOARD_PATH || path.startsWith(`${DASHBOARD_PATH}/`);
}

/** True for any path under `/dashboard`, the login page included. */
export function isDashboardRoute({ route, url }: Pick<RequestEvent, 'route' | 'url'>): boolean {
	return [route.id, url.pathname].some(
		(path) => path === DASHBOARD_PATH || path?.startsWith(`${DASHBOARD_PATH}/`)
	);
}

/**
 * A path worth returning to after login, or null. Login and logout are dropped: a logout posted
 * from a stale tab would otherwise sign the recruiter out again right after they sign in.
 */
function returnPath(value: string | null | undefined): string | null {
	const path = normalizeRefererPath(value);
	if (!path) return null;
	const pathname = new URL(path, PARSE_BASE).pathname;
	return pathname === LOGIN_PATH || pathname === LOGOUT_PATH ? null : path;
}

/** Where the login action sends the recruiter: `redirectTo` when it is safe, else the jobs list. */
export function loginRedirectTarget(redirectTo: string | null | undefined): string {
	return returnPath(redirectTo) ?? HOME_PATH;
}

/** True when login was reached because a session was cleared, so it can say the session ended. */
export function sessionEndedNotice(url: URL): boolean {
	return url.searchParams.get(REASON_PARAM) === SESSION_ENDED;
}

/**
 * Redirects to login, coming back to the requested path afterwards. `sessionEnded` is for a
 * session that was just cleared (a 401 or an expired cookie), never for a first visit.
 */
export function redirectToLogin(url: URL, { sessionEnded = false } = {}): never {
	const params = new URLSearchParams();
	const redirectTo = returnPath(url.pathname + url.search);
	if (redirectTo) params.set('redirectTo', redirectTo);
	if (sessionEnded) params.set(REASON_PARAM, SESSION_ENDED);
	const query = params.toString();
	redirect(303, query ? `${LOGIN_PATH}?${query}` : LOGIN_PATH);
}

/** The browser sent a session cookie; `readSession` has already dropped it if it was invalid. */
function sentSessionCookie(request: Request): boolean {
	return (request.headers.get('cookie') ?? '')
		.split(';')
		.some((pair) => pair.trim().startsWith(`${SESSION_COOKIE}=`));
}

export function requireRecruiter({
	locals,
	url,
	request
}: Pick<RequestEvent, 'locals' | 'url' | 'request'>): RecruiterSession {
	return locals.recruiter ?? redirectToLogin(url, { sessionEnded: sentSessionCookie(request) });
}
