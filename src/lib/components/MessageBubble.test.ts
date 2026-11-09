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
		expect(body).not.toContain('aria-hidden');
	});

	it('animates the caret only for users who allow motion', () => {
		const { body } = render(MessageBubble, {
			props: { role: 'assistant', content: 'x', streaming: true }
		});
		expect(body).toContain('motion-safe:animate-pulse');
		expect(body).not.toMatch(/[\s"]animate-pulse/);
	});
});
