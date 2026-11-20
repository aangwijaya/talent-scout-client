// Copy and display rules for the advisory answer-authenticity card and the per-answer entry line.
import type { Authenticity, MessageEntry } from '$lib/server/api/types';

export type AuthenticityTone = Authenticity['level'] | 'unassessed';

const LEVELS: Record<AuthenticityTone, { label: string; summary: string }> = {
	likely: {
		label: 'Likely concern',
		summary:
			"Some answers may not be in the applicant's own words. Read them in the transcript before you decide."
	},
	possible: {
		label: 'Possible concern',
		summary: 'One signal stands out, but it has an ordinary explanation too.'
	},
	none: { label: 'No concern', summary: 'All answers were typed at a normal pace.' },
	unassessed: {
		label: 'Not assessed',
		summary: 'The check did not run or did not finish. Review the transcript as usual.'
	}
};

export const AUTHENTICITY_ADVISORY =
	'Advisory only. It never changes a score or rejects anyone; you decide.';

const checkedFormat = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	day: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23',
	timeZone: 'UTC'
});

export function authenticityView(authenticity: Authenticity | null) {
	const tone: AuthenticityTone = authenticity?.level ?? 'unassessed';
	return {
		...LEVELS[tone],
		tone,
		reasons: authenticity?.reasons ?? [],
		checked: authenticity
			? `Checked ${checkedFormat.format(new Date(authenticity.assessed_at))}.`
			: null
	};
}

/** The mono line under an applicant answer, or `null` when no entry was recorded. */
export function entryLine(entry: MessageEntry | null) {
	if (!entry) return null;
	const { pasted_chars: pasted, typed_chars: typed } = entry;
	const seconds = Math.max(1, Math.round(entry.duration_ms / 1000));
	const mostlyPasted = pasted > typed;
	return {
		text: mostlyPasted
			? `Pasted ${pasted} · typed ${typed} chars · ${seconds} s`
			: `Typed ${typed} · pasted ${pasted} chars · ${seconds} s`,
		label: `${pasted} characters pasted, ${typed} typed, in ${seconds} seconds`,
		pasted: mostlyPasted
	};
}
