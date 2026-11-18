// Pure helpers behind AnswerBox, kept apart so they can be tested without a DOM.

export const MAX_ANSWER = 2000;
const COUNTER_FROM = 1500;
const format = (n: number) => n.toLocaleString('en-US');

/** The character counter under the answer box, or `null` while it stays hidden. */
export function answerCounter(length: number): { text: string; atLimit: boolean } | null {
	if (length < COUNTER_FROM) return null;
	const atLimit = length >= MAX_ANSWER;
	const text = `${format(length)} / ${format(MAX_ANSWER)}`;
	return { text: atLimit ? `${text} · limit reached` : text, atLimit };
}

export function canSend(draft: string, locked: boolean): boolean {
	return !locked && draft.trim().length > 0 && draft.length <= MAX_ANSWER;
}

type Field = { scrollHeight: number; style: { height: string; overflowY: string } };

/** Fits the textarea to its content up to `maxPx`, then lets it scroll inside. */
export function autosize(el: Field, maxPx: number): void {
	el.style.height = 'auto';
	const height = Math.min(el.scrollHeight, maxPx);
	el.style.height = `${height}px`;
	el.style.overflowY = el.scrollHeight > maxPx ? 'auto' : 'hidden';
}
