import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { Authenticity } from '$lib/server/api/types';
import AuthenticityCard from './AuthenticityCard.svelte';

const assessed_at = '2026-11-05T14:12:00Z';
const ADVISORY = 'Advisory only. It never changes a score or rejects anyone; you decide.';

const card = (authenticity: Authenticity | null) =>
	render(AuthenticityCard, { props: { authenticity } }).body;

describe('AuthenticityCard', () => {
	it('renders a likely concern with an amber border, reasons as text and the check time', () => {
		const body = card({
			level: 'likely',
			reasons: ['Two answers were pasted in full.', '<b>not html</b>'],
			assessed_at
		});
		expect(body).toMatch(/<section[^>]*aria-labelledby="authenticity-heading"/);
		expect(body).toContain('Answer authenticity');
		expect(body).toContain('Likely concern');
		expect(body).toMatch(/<section[^>]*border-warning/);
		expect(body).toContain('text-warning-text');
		expect(body).toContain('<li>Two answers were pasted in full.</li>');
		expect(body).toContain('&lt;b>not html&lt;/b>');
		expect(body).toContain(ADVISORY);
		expect(body).toContain('Checked Nov 5, 14:12.');
	});

	it('renders possible and none with a plain border and no list for empty reasons', () => {
		const possible = card({ level: 'possible', reasons: [], assessed_at });
		expect(possible).toContain('Possible concern');
		expect(possible).toMatch(/<section[^>]*border-line/);
		expect(possible).not.toContain('<ul');

		const none = card({ level: 'none', reasons: [], assessed_at });
		expect(none).toContain('No concern');
		expect(none).toContain('text-success-text');
		expect(none).toContain('All answers were typed at a normal pace.');
	});

	it('renders null as "Not assessed" without a check time', () => {
		const body = card(null);
		expect(body).toContain('Not assessed');
		expect(body).toContain('The check did not run or did not finish.');
		expect(body).toContain(ADVISORY);
		expect(body).not.toContain('Checked');
	});
});
