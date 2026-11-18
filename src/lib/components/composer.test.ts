import { describe, expect, it } from 'vitest';
import { answerCounter, autosize, canSend, MAX_ANSWER } from './composer';

describe('answerCounter', () => {
	it('stays hidden below 1,500 characters', () => {
		expect(answerCounter(1499)).toBeNull();
	});

	it('shows the count from 1,500', () => {
		expect(answerCounter(1742)).toEqual({ text: '1,742 / 2,000', atLimit: false });
	});

	it('marks the limit at 2,000', () => {
		expect(answerCounter(MAX_ANSWER)).toEqual({
			text: '2,000 / 2,000 · limit reached',
			atLimit: true
		});
	});
});

describe('canSend', () => {
	it('allows exactly 2,000 characters and blocks anything above', () => {
		expect(canSend('x'.repeat(2000), false)).toBe(true);
		expect(canSend('x'.repeat(2001), false)).toBe(false);
	});

	it('blocks a blank draft or a locked box', () => {
		expect(canSend('  \n', false)).toBe(false);
		expect(canSend('hi', true)).toBe(false);
	});
});

describe('autosize', () => {
	const field = (scrollHeight: number) => ({
		scrollHeight,
		style: { height: '', overflowY: '' }
	});

	it('grows the box to fit its content', () => {
		const el = field(180);
		autosize(el, 300);
		expect(el.style.height).toBe('180px');
		expect(el.style.overflowY).toBe('hidden');
	});

	it('stops at the max height and scrolls inside', () => {
		const el = field(900);
		autosize(el, 300);
		expect(el.style.height).toBe('300px');
		expect(el.style.overflowY).toBe('auto');
	});
});
