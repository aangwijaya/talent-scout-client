import { describe, expect, it } from 'vitest';
import { setClientIpHeaders } from './client-ip';

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
