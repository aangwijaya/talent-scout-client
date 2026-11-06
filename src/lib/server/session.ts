import type { Cookies } from '@sveltejs/kit';
import type { LoginResponse } from './api/types';

export const SESSION_COOKIE = 'ts_session';

export interface RecruiterSession {
	token: string;
	/** Epoch milliseconds. */
	expiresAt: number;
}

const COOKIE_PATH = '/';

/**
 * The cookie value is `<expiresAt>.<access_token>`, because the token is opaque to this app. The
 * expiry only decides when to drop the cookie; the Go API still validates the token itself.
 * `secure` is left to Kit's default: on, except in dev and on http://localhost.
 */
export function setSessionCookie(
	cookies: Cookies,
	{ access_token, expires_at }: LoginResponse
): void {
	const expiresAt = Date.parse(expires_at);
	cookies.set(SESSION_COOKIE, `${expiresAt}.${access_token}`, {
		path: COOKIE_PATH,
		httpOnly: true,
		sameSite: 'lax',
		maxAge: Math.floor((expiresAt - Date.now()) / 1000)
	});
}

export function clearSessionCookie(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE, { path: COOKIE_PATH });
}

/** Returns the session in the cookie; an expired or malformed cookie is cleared. */
export function readSession(cookies: Cookies): RecruiterSession | null {
	const value = cookies.get(SESSION_COOKIE);
	if (!value) return null;

	const separator = value.indexOf('.');
	const expiresAt = Number(value.slice(0, separator));
	const token = value.slice(separator + 1);
	if (separator > 0 && token && expiresAt > Date.now()) return { token, expiresAt };

	clearSessionCookie(cookies);
	return null;
}
