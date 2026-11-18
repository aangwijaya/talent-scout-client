import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import TypingIndicator from './TypingIndicator.svelte';

describe('TypingIndicator', () => {
	it('announces the first question with a caption', () => {
		const { body } = render(TypingIndicator, { props: { first: true } });
		expect(body).toContain('role="status"');
		expect(body).toContain('aria-label="The interviewer is preparing your first question"');
		expect(body).toContain('Preparing your first question…');
		expect(body.match(/data-dot/g)).toHaveLength(3);
	});

	it('announces later replies without a caption', () => {
		const { body } = render(TypingIndicator, { props: { first: false } });
		expect(body).toContain('aria-label="The interviewer is typing"');
		expect(body).not.toContain('Preparing your first question');
	});

	it('animates the dots only for users who allow motion', () => {
		const { body } = render(TypingIndicator, { props: { first: false } });
		expect(body).toContain('motion-safe:animate-[typing-dot');
		expect(body).not.toMatch(/[\s"]animate-\[/);
		expect(body).toContain('opacity-60');
	});
});
