import Briefcase from '@lucide/svelte/icons/briefcase';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import EmptyState from './EmptyState.svelte';
import InlineError from './InlineError.svelte';

describe('EmptyState', () => {
	it('renders its title as an h2 by default and an h1 on an error page', () => {
		const props = { icon: Briefcase, title: 'No jobs yet', description: 'Create one.' };
		expect(render(EmptyState, { props }).body).toMatch(/<h2[^>]*>No jobs yet<\/h2>/);
		expect(render(EmptyState, { props: { ...props, level: 1 as const } }).body).toMatch(
			/<h1[^>]*>No jobs yet<\/h1>/
		);
	});
});

describe('InlineError', () => {
	it('renders its title as a heading, never a paragraph', () => {
		const props = { title: "Couldn't load this page", message: 'Server error' };
		expect(render(InlineError, { props }).body).toMatch(/<h2[^>]*>Couldn't load this page<\/h2>/);
		expect(render(InlineError, { props: { ...props, level: 1 as const } }).body).toMatch(
			/<h1[^>]*>Couldn't load this page<\/h1>/
		);
	});
});
