import { describe, expect, it } from 'vitest';
import { ApiError } from '$lib/server/api/types';
import { applyErrorMessage } from './errors';

describe('applyErrorMessage', () => {
	it('explains the rate limit without blaming the applicant', () => {
		const message = applyErrorMessage(
			new ApiError(429, 'rate_limited', 'too many requests from 203.0.113.7')
		);
		expect(message).toMatch(/too many applications/i);
		expect(message).toMatch(/try again later/i);
		expect(message).not.toContain('203.0.113.7');
	});

	it('falls back to a generic message for errors it does not know', () => {
		expect(applyErrorMessage(new Error('boom'))).toBe(
			'Something went wrong. Please try again in a moment.'
		);
	});
});
