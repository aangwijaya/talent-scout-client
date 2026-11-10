import type { SessionStatus } from '$lib/server/api/types';

const dateFormat = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	day: 'numeric',
	year: 'numeric',
	timeZone: 'UTC'
});

/** "Nov 4, 2026", in UTC so the server render and the browser agree. */
export function formatDate(iso: string): string {
	return dateFormat.format(new Date(iso));
}

/** Two decimals, or null when there is no score yet. */
export function formatScore(score: number | null): string | null {
	return score === null ? null : score.toFixed(2);
}

const sessionLabels: Record<SessionStatus, string> = {
	invited: 'Not started',
	active: 'In progress',
	completed: 'Completed',
	expired: 'Expired',
	revoked: 'Revoked'
};

export function sessionLabel(status: SessionStatus | null): string {
	return status ? sessionLabels[status] : '—';
}

export function withoutScheme(url: string): string {
	return url.replace(/^[a-z][a-z\d+.-]*:\/\//i, '');
}
