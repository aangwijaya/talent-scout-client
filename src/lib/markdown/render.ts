import MarkdownIt, { type Token } from 'markdown-it';

export type Heading = { id: string; text: string; level: 2 | 3 };

// The `zero` preset parses nothing but paragraphs; only the elements a job description needs are
// switched on. `html: false` escapes raw HTML, and images, autolinks and bare URLs stay text.
const md = new MarkdownIt('zero', { html: false, linkify: false, breaks: true }).enable([
	'heading',
	'list',
	'emphasis',
	'link',
	'backticks',
	'newline',
	'escape',
	'entity'
]);

// A link with any other scheme (or a relative one) is not parsed, so it renders as its own text.
md.validateLink = (url) => /^(https?:|mailto:)/i.test(url.trim());

function slugify(text: string): string {
	const slug = text
		.normalize('NFKD')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
	return slug || 'section';
}

function plainText(inline: Token): string {
	return (inline.children ?? [])
		.filter((child) => child.type === 'text' || child.type === 'code_inline')
		.map((child) => child.content)
		.join('');
}

/** Renders job description markdown to sanitised HTML, plus its headings for a table of contents. */
export function renderMarkdown(source: string): { html: string; headings: Heading[] } {
	const tokens = md.parse(source, {});
	const headings: Heading[] = [];
	const seen = new Map<string, number>();

	tokens.forEach((token, i) => {
		if (token.type === 'heading_open' || token.type === 'heading_close') {
			// The card title is the page's h2 level, so `#` and `##` both become h2, deeper ones h3.
			token.tag = Number(token.tag.slice(1)) <= 2 ? 'h2' : 'h3';
		}
		if (token.type === 'heading_open') {
			const text = plainText(tokens[i + 1]);
			// Prefixed so a heading such as "Apply" can't clash with an id elsewhere on the page.
			const base = `jd-${slugify(text)}`;
			const count = (seen.get(base) ?? 0) + 1;
			seen.set(base, count);
			const id = count === 1 ? base : `${base}-${count}`;
			token.attrSet('id', id);
			headings.push({ id, text, level: token.tag === 'h2' ? 2 : 3 });
		}
		if (token.type === 'inline') {
			for (const child of token.children ?? []) {
				if (child.type === 'link_open') {
					child.attrSet('target', '_blank');
					child.attrSet('rel', 'noopener noreferrer');
				}
			}
		}
	});

	return { html: md.renderer.render(tokens, md.options, {}), headings };
}
