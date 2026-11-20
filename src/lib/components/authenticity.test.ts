import { describe, expect, it } from 'vitest';
import { authenticityView, entryLine } from './authenticity';

describe('authenticityView', () => {
	const assessed_at = '2026-11-05T14:12:00Z';

	it('maps each level to its pill, summary and tone', () => {
		expect(authenticityView({ level: 'likely', reasons: ['r'], assessed_at })).toMatchObject({
			label: 'Likely concern',
			tone: 'likely',
			summary: expect.stringMatching(/^Some answers may not be in the applicant's own words/),
			reasons: ['r'],
			checked: 'Checked Nov 5, 14:12.'
		});
		expect(authenticityView({ level: 'possible', reasons: [], assessed_at })).toMatchObject({
			label: 'Possible concern',
			tone: 'possible',
			summary: 'One signal stands out, but it has an ordinary explanation too.'
		});
		expect(authenticityView({ level: 'none', reasons: [], assessed_at })).toMatchObject({
			label: 'No concern',
			tone: 'none',
			summary: 'All answers were typed at a normal pace.'
		});
	});

	it('shows "Not assessed" without a check time for null', () => {
		expect(authenticityView(null)).toEqual({
			label: 'Not assessed',
			tone: 'unassessed',
			summary: 'The check did not run or did not finish. Review the transcript as usual.',
			reasons: [],
			checked: null
		});
	});
});

describe('entryLine', () => {
	it('leads with pasted, amber, when more was pasted than typed', () => {
		expect(entryLine({ pasted_chars: 412, typed_chars: 3, duration_ms: 2_400 })).toEqual({
			text: 'Pasted 412 · typed 3 chars · 2 s',
			label: '412 characters pasted, 3 typed, in 2 seconds',
			pasted: true
		});
	});

	it('leads with typed, grey, otherwise (a tie counts as typed)', () => {
		expect(entryLine({ pasted_chars: 0, typed_chars: 186, duration_ms: 41_600 })).toEqual({
			text: 'Typed 186 · pasted 0 chars · 42 s',
			label: '0 characters pasted, 186 typed, in 42 seconds',
			pasted: false
		});
		expect(entryLine({ pasted_chars: 5, typed_chars: 5, duration_ms: 1_000 })?.pasted).toBe(false);
	});

	it('shows at least one second', () => {
		expect(entryLine({ pasted_chars: 1, typed_chars: 0, duration_ms: 0 })?.text).toBe(
			'Pasted 1 · typed 0 chars · 1 s'
		);
	});

	it('renders nothing for a null entry', () => {
		expect(entryLine(null)).toBeNull();
	});
});
