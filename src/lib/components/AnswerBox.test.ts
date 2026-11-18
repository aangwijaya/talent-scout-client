import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import AnswerBox from './AnswerBox.svelte';

const base = { locked: false, reconnecting: false };

describe('AnswerBox', () => {
	it('starts at three rows with no manual resize', () => {
		const { body } = render(AnswerBox, { props: { ...base, value: '' } });
		expect(body).toMatch(/<textarea[^>]*rows="3"/);
		expect(body).toContain('resize-none');
		expect(body).toContain('maxlength="2000"');
	});

	it('hides the counter below 1,500 characters', () => {
		const { body } = render(AnswerBox, { props: { ...base, value: 'x'.repeat(1499) } });
		expect(body).not.toContain('/ 2,000');
	});

	it('links the counter to the textarea from 1,500', () => {
		const { body } = render(AnswerBox, { props: { ...base, value: 'x'.repeat(1500) } });
		expect(body).toMatch(/<textarea[^>]*aria-describedby="answer-counter"/);
		expect(body).toMatch(/id="answer-counter"[^>]*>[\s\S]*1,500 \/ 2,000/);
	});

	it('turns the counter red at the limit and still allows sending', () => {
		const { body } = render(AnswerBox, { props: { ...base, value: 'x'.repeat(2000) } });
		expect(body).toContain('limit reached');
		expect(body).toContain('text-danger-text');
		expect(body).toMatch(/<button[^>]*aria-label="Send"/);
		expect(body).not.toMatch(/<button[^>]*disabled/);
	});

	it('blocks sending above 2,000 characters', () => {
		const { body } = render(AnswerBox, { props: { ...base, value: 'x'.repeat(2001) } });
		expect(body).toMatch(/<button[^>]*disabled/);
	});

	it('locks the box while waiting for the interviewer', () => {
		const { body } = render(AnswerBox, { props: { ...base, locked: true, value: 'draft' } });
		expect(body).toMatch(/<textarea[^>]*disabled/);
		expect(body).toContain('You can answer once the question arrives');
	});

	it('keeps the draft and labels Send while reconnecting', () => {
		const { body } = render(AnswerBox, {
			props: { ...base, reconnecting: true, value: 'my draft' }
		});
		expect(body).toContain('my draft');
		expect(body).toContain('aria-label="Send (waiting for the connection)"');
		expect(body).toMatch(/<button[^>]*disabled/);
	});
});
