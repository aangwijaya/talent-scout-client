<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';
	import Button from './Button.svelte';

	type Props = { value: string; label?: string };

	let { value, label = 'Copy link' }: Props = $props();
	let status = $state<'idle' | 'copied' | 'failed'>('idle');

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			status = 'copied';
		} catch {
			status = 'failed';
		}
		setTimeout(() => (status = 'idle'), 2000);
	}
</script>

<Button onclick={copy}>
	{#if status === 'copied'}
		<Check size={16} aria-hidden="true" /> Copied
	{:else}
		<Copy size={16} aria-hidden="true" />
		{status === 'failed' ? 'Copy failed' : label}
	{/if}
</Button>
<span class="sr-only" aria-live="polite">{status === 'copied' ? 'Link copied' : ''}</span>
