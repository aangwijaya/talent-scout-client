import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Markdown from './Markdown.svelte';
import { renderMarkdown } from './render';

describe('renderMarkdown', () => {
	it('never renders raw HTML', () => {
		const { html } = renderMarkdown(
			'Hello <script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n<a href="https://x.dev">a</a>'
		);
		expect(html).not.toMatch(/<script|<img|<a href="https:\/\/x\.dev"/);
		expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
		expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
	});

	it('renders only http, https and mailto links, as plain text otherwise', () => {
		const { html } = renderMarkdown(
			'[a](javascript:alert(1)) [b](data:text/html,x) [c](vbscript:x) [d](JaVaScRiPt:alert(1)) [e](/relative)'
		);
		expect(html).not.toContain('<a');
		expect(html).toContain('[a](javascript:alert(1))');

		const safe = renderMarkdown(
			'[site](https://x.dev) [mail](mailto:hr@x.dev) [old](http://x.dev)'
		);
		expect(safe.html).toContain(
			'<a href="https://x.dev" target="_blank" rel="noopener noreferrer">site</a>'
		);
		expect(safe.html).toContain('href="mailto:hr@x.dev"');
		expect(safe.html).toContain('href="http://x.dev"');
	});

	it('does not turn images, autolinks or bare URLs into elements', () => {
		expect(renderMarkdown('![x](https://x.dev/a.png)').html).not.toContain('<img');
		const { html } = renderMarkdown('<javascript:alert(1)> <https://x.dev> www.x.dev');
		expect(html).not.toContain('<a');
	});

	it('renders headings, lists, emphasis and inline code', () => {
		const { html, headings } = renderMarkdown(
			'# About the role\n\nWe **build** _things_ with `svelte`.\n\n## What you do\n\n- one\n- two\n\n### Nice to have\n\n1. first\n2. second'
		);
		expect(html).toContain('<h2 id="jd-about-the-role">About the role</h2>');
		expect(html).toContain('<h2 id="jd-what-you-do">What you do</h2>');
		expect(html).toContain('<h3 id="jd-nice-to-have">Nice to have</h3>');
		expect(html).toContain('<strong>build</strong>');
		expect(html).toContain('<em>things</em>');
		expect(html).toContain('<code>svelte</code>');
		expect(html).toContain('<ul>\n<li>one</li>');
		expect(html).toContain('<ol>\n<li>first</li>');
		expect(headings).toEqual([
			{ id: 'jd-about-the-role', text: 'About the role', level: 2 },
			{ id: 'jd-what-you-do', text: 'What you do', level: 2 },
			{ id: 'jd-nice-to-have', text: 'Nice to have', level: 3 }
		]);
	});

	it('keeps heading ids unique and readable', () => {
		const { headings } = renderMarkdown('## Perks & benefits!\n\n## Perks & benefits!\n\n## 💡');
		expect(headings.map((h) => h.id)).toEqual([
			'jd-perks-benefits',
			'jd-perks-benefits-2',
			'jd-section'
		]);
	});

	it('never reuses an id when a heading text ends in a number', () => {
		const { headings } = renderMarkdown('## Perks\n\n## Perks\n\n## Perks 2');
		const ids = headings.map((h) => h.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).toEqual(['jd-perks', 'jd-perks-2', 'jd-perks-2-2']);
	});

	it('keeps the line breaks of plain text', () => {
		const { html } = renderMarkdown('Line one\nLine two\n\nNew paragraph');
		expect(html).toBe('<p>Line one<br>\nLine two</p>\n<p>New paragraph</p>\n');
	});
});

describe('Markdown.svelte', () => {
	it('renders the sanitised markup inside an md wrapper', () => {
		const { body } = render(Markdown, {
			props: { source: '## Hi\n\n<script>alert(1)</script>' }
		});
		expect(body).toContain('class="md');
		expect(body).toContain('<h2 id="jd-hi">Hi</h2>');
		expect(body).not.toContain('<script>');
	});
});
