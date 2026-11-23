import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('src/app.html', 'utf8');

describe('app.html', () => {
	it('lets safe-area insets work and never blocks zoom', () => {
		const viewport = html.match(/<meta name="viewport" content="([^"]+)"/)?.[1] ?? '';
		expect(viewport).toContain('width=device-width');
		expect(viewport).toContain('viewport-fit=cover');
		expect(viewport).not.toMatch(/user-scalable|maximum-scale/);
	});

	it('sets the browser theme colour to the canvas token', () => {
		expect(html).toContain('<meta name="theme-color" content="#fcfcfc"');
	});
});
