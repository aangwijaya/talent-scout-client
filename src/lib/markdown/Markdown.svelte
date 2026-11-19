<script lang="ts">
	import { renderMarkdown } from './render';

	type Props = { source: string; id?: string; class?: string };

	let { source, id, class: className }: Props = $props();

	const html = $derived(renderMarkdown(source).html);
</script>

<!-- `renderMarkdown` escapes raw HTML and allows only http, https and mailto links. -->
<!-- eslint-disable-next-line svelte/no-at-html-tags -->
<div {id} class={['md', className]}>{@html html}</div>

<style>
	.md :global(h2),
	.md :global(h3) {
		margin: 20px 0 8px;
		font-size: 16px;
		font-weight: 600;
		line-height: 1.4;
		color: var(--color-ink);
		scroll-margin-top: 24px;
	}
	.md :global(:is(h2, h3):first-child) {
		margin-top: 0;
	}
	.md :global(:is(p, ul, ol)) {
		margin: 0 0 12px;
		font-size: 15px;
		line-height: 1.6;
		color: var(--color-muted);
	}
	.md :global(:is(p, ul, ol):last-child) {
		margin-bottom: 0;
	}
	.md :global(ul) {
		list-style: disc;
		padding-left: 20px;
	}
	.md :global(ol) {
		list-style: decimal;
		padding-left: 20px;
	}
	.md :global(li + li) {
		margin-top: 4px;
	}
	.md :global(li > :is(ul, ol)) {
		margin: 4px 0 0;
	}
	.md :global(strong) {
		font-weight: 600;
		color: var(--color-body);
	}
	.md :global(a) {
		color: var(--color-brand);
		text-decoration: underline;
		text-underline-offset: 2px;
		overflow-wrap: anywhere;
	}
	.md :global(a:focus-visible) {
		outline: 2px solid var(--color-focus);
		outline-offset: 2px;
		border-radius: 2px;
	}
	.md :global(code) {
		font-family: var(--font-mono);
		font-size: 13px;
		background: var(--color-subtle);
		border-radius: 6px;
		padding: 1px 6px;
	}
</style>
