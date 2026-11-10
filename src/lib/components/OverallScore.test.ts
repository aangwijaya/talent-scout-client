import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import OverallScore from './OverallScore.svelte';

describe('OverallScore', () => {
	it('shows two decimals followed by "/ 5"', () => {
		const { body } = render(OverallScore, { props: { score: 4.5 } });
		expect(body).toContain('4.50');
		expect(body).toContain('/ 5');
	});

	it('shows a dash and no suffix for a missing score', () => {
		const { body } = render(OverallScore, { props: { score: null } });
		expect(body).toContain('—');
		expect(body).not.toContain('/ 5');
	});
});
