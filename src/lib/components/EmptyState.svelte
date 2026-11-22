<script lang="ts">
	import type { Component, Snippet } from 'svelte';

	type Props = {
		icon: Component;
		title: string;
		description: string;
		/** 1 on an error page, where the title is the page's only heading. */
		level?: 1 | 2;
		action?: Snippet;
	};

	let { icon: Icon, title, description, level = 2, action }: Props = $props();
</script>

<!-- DESIGN.md §3 empty state: 32px helper icon, subheading title, one muted sentence, one action. -->
<div class="flex flex-col items-center gap-2 px-4 py-10 text-center">
	<Icon size={32} aria-hidden="true" class="text-helper" />
	{#if level === 1}
		<h1 class="text-subheading font-medium text-ink">{title}</h1>
	{:else}
		<h2 class="text-subheading font-medium text-ink">{title}</h2>
	{/if}
	<p class="max-w-sm text-body-sm text-muted">{description}</p>
	{#if action}
		<div class="mt-2">{@render action()}</div>
	{/if}
</div>
