import type { Cookies } from '@sveltejs/kit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSessionCookie, readSession, setSessionCookie } from './session';

const NOW = Date.parse('2026-11-07T00:00:00Z');
const EXPIRES_AT = '2026-11-07T12:00:00Z';

function fakeCookies(value?: string) {
	return {
		get: vi.fn(() => value),
		set: vi.fn(),
		delete: vi.fn()
	} as unknown as Cookies & { set: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
}

describe('session cookie', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('sets an httpOnly lax cookie whose max-age is the token TTL', () => {
		const cookies = fakeCookies();
		setSessionCookie(cookies, { access_token: 'abc.def', expires_at: EXPIRES_AT });
		expect(cookies.set).toHaveBeenCalledWith('ts_session', `${Date.parse(EXPIRES_AT)}.abc.def`, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 12 * 60 * 60
		});
	});

	it('leaves `secure` to the Kit default, so it stays on in production', () => {
		const cookies = fakeCookies();
		setSessionCookie(cookies, { access_token: 't', expires_at: EXPIRES_AT });
		expect(cookies.set.mock.calls[0][2]).not.toHaveProperty('secure');
	});

	it('reads back what it wrote, keeping dots in the token', () => {
		const cookies = fakeCookies(`${Date.parse(EXPIRES_AT)}.abc.def`);
		expect(readSession(cookies)).toEqual({
			token: 'abc.def',
			expiresAt: Date.parse(EXPIRES_AT)
		});
		expect(cookies.delete).not.toHaveBeenCalled();
	});

	it('returns null without touching anything when there is no cookie', () => {
		const cookies = fakeCookies();
		expect(readSession(cookies)).toBeNull();
		expect(cookies.delete).not.toHaveBeenCalled();
	});

	it.each([
		['expired', `${NOW - 1}.token`],
		['expiring now', `${NOW}.token`],
		['without a separator', 'token'],
		['without an expiry', '.token'],
		['with a non-numeric expiry', 'soon.token'],
		['without a token', `${NOW + 1000}.`]
	])('clears a cookie that is %s', (_name, value) => {
		const cookies = fakeCookies(value);
		expect(readSession(cookies)).toBeNull();
		expect(cookies.delete).toHaveBeenCalledWith('ts_session', { path: '/' });
	});

	it('clears the cookie on the same path it was set on', () => {
		const cookies = fakeCookies();
		clearSessionCookie(cookies);
		expect(cookies.delete).toHaveBeenCalledWith('ts_session', { path: '/' });
	});
});
