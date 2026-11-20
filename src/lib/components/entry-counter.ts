// How one answer was entered (FR-15): characters pasted or dropped versus typed, and the time
// from the first input to Send. Only counted and sent; the applicant never sees it.
import type { MessageEntry } from '$lib/server/api/types';

/** Upper bound of every `entry` field in the contract. */
export const ENTRY_MAX = 10_000_000;
const PASTED = new Set(['insertFromPaste', 'insertFromDrop']);

const clamp = (n: number) => Math.min(ENTRY_MAX, Math.max(0, Math.round(n)));

export type EntryCounter = ReturnType<typeof createEntryCounter>;

export function createEntryCounter(now: () => number = Date.now) {
	let pasted = 0;
	let typed = 0;
	let startedAt: number | null = null;

	return {
		/** One `input` event: its `inputType` and how many characters it inserted. */
		record(inputType: string, inserted: number): void {
			startedAt ??= now();
			if (inserted <= 0) return;
			if (PASTED.has(inputType)) pasted += inserted;
			else typed += inserted;
		},
		snapshot(): MessageEntry | null {
			if (startedAt === null) return null;
			return {
				pasted_chars: clamp(pasted),
				typed_chars: clamp(typed),
				duration_ms: clamp(now() - startedAt)
			};
		},
		reset(): void {
			pasted = 0;
			typed = 0;
			startedAt = null;
		}
	};
}
