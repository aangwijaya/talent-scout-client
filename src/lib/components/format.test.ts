import { describe, expect, it } from 'vitest';
import { formatDate, formatScore, sessionLabel, withoutScheme } from './format';

describe('formatScore', () => {
	it.each([
		[4.5, '4.50'],
		[3, '3.00'],
		[2.456, '2.46'],
		[0, '0.00']
	])('shows %s with two decimals', (score, text) => {
		expect(formatScore(score)).toBe(text);
	});

	it('returns null for a missing score', () => {
		expect(formatScore(null)).toBeNull();
	});
});

describe('formatDate', () => {
	it('formats an ISO timestamp as "Nov 4, 2026" in UTC', () => {
		expect(formatDate('2026-11-04T23:30:00Z')).toBe('Nov 4, 2026');
	});
});

describe('sessionLabel', () => {
	it.each([
		['invited', 'Not started'],
		['active', 'In progress'],
		['completed', 'Completed'],
		['expired', 'Expired'],
		['revoked', 'Revoked'],
		[null, '—']
	] as const)('labels %s as %s', (status, label) => {
		expect(sessionLabel(status)).toBe(label);
	});
});

describe('withoutScheme', () => {
	it('drops the scheme from an apply URL', () => {
		expect(withoutScheme('https://talentscout.vercel.app/apply/1')).toBe(
			'talentscout.vercel.app/apply/1'
		);
	});
});
