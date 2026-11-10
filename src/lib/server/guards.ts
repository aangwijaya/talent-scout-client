import { redirect, type RequestEvent } from '@sveltejs/kit';
import type { RecruiterSession } from './session';

export const DASHBOARD_PATH = '/dashboard';
export const LOGIN_PATH = '/dashboard/login';
export const LOGOUT_PATH = '/dashboard/logout';
export const HOME_PATH = '/dashboard/jobs';
const PARSE_BASE = 'http://relative.invalid';

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

/** Redirects to login, coming back to the requested path afterwards. */
export function redirectToLogin(url: URL): never {
	const redirectTo = returnPath(url.pathname + url.search);
	redirect(
		303,
		redirectTo ? `${LOGIN_PATH}?redirectTo=${encodeURIComponent(redirectTo)}` : LOGIN_PATH
	);
}

export function requireRecruiter({
	locals,
	url
}: Pick<RequestEvent, 'locals' | 'url'>): RecruiterSession {
	return locals.recruiter ?? redirectToLogin(url);
}
