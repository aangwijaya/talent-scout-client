import type { RequestEvent } from '@sveltejs/kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleError } from '../../hooks.server';
import { setClientIpHeaders } from './client-ip';

vi.mock('$app/env/private', () => ({
	API_BASE_URL: 'http://api.test:8080',
	BFF_SHARED_SECRET: 'bff-secret-value'
}));

const client = { getClientAddress: () => '203.0.113.7' };

describe('setClientIpHeaders', () => {
	it('replaces browser values with the client address and the secret', () => {
		const headers = new Headers({ 'x-forwarded-for': '6.6.6.6', 'x-bff-secret': 'forged' });
		setClientIpHeaders(headers, client, 'bff-secret-value');
		expect(headers.get('x-forwarded-for')).toBe('203.0.113.7');
		expect(headers.get('x-bff-secret')).toBe('bff-secret-value');
	});

	it('drops a forged secret when none is configured', () => {
		const headers = new Headers({ 'x-bff-secret': 'forged' });
		setClientIpHeaders(headers, client, undefined);
		expect(headers.get('x-bff-secret')).toBeNull();
	});
});

describe('handleError', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('redacts the bare BFF secret value from the log', () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		const event = {
			route: { id: '/apply/[jobId]' },
			locals: { recruiter: null },
			request: new Request('http://app.test/apply/1')
		} as unknown as RequestEvent;
		handleError({ kind: 'unknown', error: new Error('upstream echoed bff-secret-value'), event });
		expect(String(log.mock.calls[0][0])).not.toContain('bff-secret-value');
	});
});
