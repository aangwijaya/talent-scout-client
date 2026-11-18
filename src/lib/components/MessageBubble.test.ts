import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import MessageBubble from './MessageBubble.svelte';

describe('MessageBubble', () => {
	it('hides a streaming reply from assistive tech, so the live region skips every delta', () => {
		const { body } = render(MessageBubble, {
			props: { role: 'assistant', content: 'Tell me', streaming: true }
		});
		expect(body).toMatch(/^(<!--[^>]*-->)*<div[^>]*aria-hidden="true"/);
	});

	it('exposes a completed message', () => {
		const { body } = render(MessageBubble, { props: { role: 'assistant', content: 'Done' } });
		expect(body).not.toMatch(/^(<!--[^>]*-->)*<div[^>]*aria-hidden/);
		expect(body).toMatch(/<p[^>]*>Done/);
	});

	it('shows the interviewer avatar, hidden from assistive tech, only on interviewer messages', () => {
		const assistant = render(MessageBubble, { props: { role: 'assistant', content: 'Q' } }).body;
		const applicant = render(MessageBubble, { props: { role: 'applicant', content: 'A' } }).body;
		expect(assistant).toMatch(/<span[^>]*bg-wash[^>]*aria-hidden="true"/);
		expect(applicant).not.toContain('bg-wash');
	});

	it('animates the caret only for users who allow motion', () => {
		const { body } = render(MessageBubble, {
			props: { role: 'assistant', content: 'x', streaming: true }
		});
		expect(body).toContain('motion-safe:animate-pulse');
		expect(body).not.toMatch(/[\s"]animate-pulse/);
	});
});
