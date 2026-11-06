import { describe, expect, it } from 'vitest';
import { redact } from './redact';

describe('redact', () => {
	it.each([
		['Authorization: Bearer s3cret'],
		['bearer s3cret'],
		['cookie: ts_session=s3cret'],
		['ts_session=s3cret; Path=/'],
		['{"access_token":"s3cret"}'],
		["'x-bff-secret' => 's3cret'"],
		['x-bff-secret: s3cret'],
		['GET http://api.test/graph-runs/1/events?sse_token=s3cret&since_seq=2'],
		['GET http://api.test/api/v1/sessions/s3cret/messages failed'],
		['GET /s/s3cret failed']
	])('removes the credential from %s', (text) => {
		expect(redact(text)).not.toContain('s3cret');
	});

	it('removes known secret values wherever they appear', () => {
		expect(redact('unexpected value s3cret here', ['s3cret'])).toBe(
			'unexpected value [redacted] here'
		);
	});

	it('leaves ordinary text readable', () => {
		expect(redact('TypeError: x is not a function\n    at load (src/a.ts:1:2)')).toBe(
			'TypeError: x is not a function\n    at load (src/a.ts:1:2)'
		);
	});
});
