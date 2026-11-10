<script lang="ts">
	import type { Component, Snippet } from 'svelte';

	type Props = { icon: Component; title: string; description: string; action?: Snippet };

	let { icon: Icon, title, description, action }: Props = $props();
</script>

<!-- DESIGN.md §3 empty state: 32px helper icon, subheading title, one muted sentence, one action. -->
<div class="flex flex-col items-center gap-2 px-4 py-10 text-center">
	<Icon size={32} aria-hidden="true" class="text-helper" />
	<p class="text-subheading font-semibold text-ink">{title}</p>
	<p class="max-w-sm text-body-sm text-muted">{description}</p>
	{#if action}
		<div class="mt-2">{@render action()}</div>
	{/if}
</div>
