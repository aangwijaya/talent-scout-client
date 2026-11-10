<script lang="ts">
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Button from './Button.svelte';

	type Props = {
		message: string;
		/** With a title, the message becomes the muted detail under it (the dashboard API banner). */
		title?: string;
		onretry?: () => void;
	};

	let { message, title, onretry }: Props = $props();
</script>

<div
	role="alert"
	class="flex flex-wrap items-center gap-3 rounded-card border border-danger bg-card p-3 text-danger-text"
>
	<TriangleAlert size={16} aria-hidden="true" class="shrink-0 self-start sm:self-center" />
	<div class="min-w-0 flex-1 [overflow-wrap:anywhere]">
		{#if title}
			<p class="font-medium">{title}</p>
			<p class="text-muted">{message}</p>
		{:else}
			<p>{message}</p>
		{/if}
	</div>
	{#if onretry}
		<Button onclick={onretry}><RotateCcw size={16} aria-hidden="true" /> Try again</Button>
	{/if}
</div>
