import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import CopyButton from './CopyButton.svelte';

describe('CopyButton', () => {
	it('is a 44px square when icon-only, with a mouse too', () => {
		// Button's own h-9/px-4 come later in the built CSS than size-11/px-0, so the icon-only sizes
		// must be important or a mouse user gets a 44x36 pill.
		const body = render(CopyButton, {
			props: { value: 'https://x.test/apply/1', ariaLabel: 'Copy apply link', iconOnly: true }
		}).body;
		const button = body.match(/<button[^>]*>/)?.[0] ?? '';
		expect(button).toContain('size-11!');
		expect(button).toContain('px-0!');
	});
});
