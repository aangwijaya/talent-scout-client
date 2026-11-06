<script lang="ts">
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Button from './Button.svelte';

	type Props = { message: string; onretry?: () => void };

	let { message, onretry }: Props = $props();
</script>

<div
	class="flex flex-wrap items-center gap-3 rounded-card border border-danger bg-card p-3 text-danger-text"
>
	<TriangleAlert size={16} aria-hidden="true" class="shrink-0" />
	<p role="alert" class="min-w-0 flex-1">{message}</p>
	{#if onretry}
		<Button onclick={onretry}>Try again</Button>
	{/if}
</div>
