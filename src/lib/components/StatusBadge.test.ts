import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import StatusBadge from './StatusBadge.svelte';

describe('StatusBadge', () => {
	it.each([
		['applied', 'Applied', 'circle', 'text-muted'],
		['invited', 'Invited', 'mail', 'text-muted'],
		['in_session', 'In session', 'message-circle', 'text-brand'],
		['scoring', 'Scoring', 'hourglass', 'text-warning-text'],
		['review', 'Review', 'eye', 'text-brand'],
		['shortlisted', 'Shortlisted', 'check', 'text-success-text'],
		['rejected', 'Rejected', 'x', 'text-danger-text'],
		['failed', 'Failed', 'triangle-alert', 'text-danger-text'],
		['open', 'Open', 'check', 'text-success-text'],
		['closed', 'Closed', 'circle', 'text-muted']
	] as const)('shows %s with its label, icon and tone', (status, label, icon, text) => {
		const { body } = render(StatusBadge, { props: { status } });
		expect(body).toContain(label);
		expect(body).toContain(`lucide-${icon} `);
		expect(body).toContain(text);
	});

	it('does not spin the in_session icon, which is not a running node', () => {
		const { body } = render(StatusBadge, { props: { status: 'in_session' } });
		expect(body).not.toContain('animate-spin');
	});
});
