import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The browser tab icon is the header logo (Logo.svelte): a brand-blue circle with a white user-check.
describe('favicon', () => {
	it('app.html links the SVG favicon', () => {
		const html = readFileSync('src/app.html', 'utf8');
		expect(html).toMatch(
			/<link rel="icon" type="image\/svg\+xml" href="%sveltekit\.assets%\/favicon\.svg" \/>/
		);
	});

	it('the favicon is the brand-blue logo mark', () => {
		const svg = readFileSync('static/favicon.svg', 'utf8');
		expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
		expect(svg).toContain('fill="#145aff"');
		expect(svg).toContain('m16 11 2 2 4-4');
	});
});
