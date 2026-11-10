<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';
	import Link from '@lucide/svelte/icons/link';
	import type { ComponentProps } from 'svelte';
	import Button from './Button.svelte';

	type Props = {
		value: string;
		label?: string;
		/** Names the target when the visible label does not, e.g. "Copy apply link for <job>". */
		ariaLabel?: string;
		announcement?: string;
		icon?: 'copy' | 'link';
		variant?: 'neutral' | 'secondary';
		size?: ComponentProps<typeof Button>['size'];
		class?: string;
	};

	let {
		value,
		label = 'Copy link',
		ariaLabel,
		announcement = 'Link copied to the clipboard.',
		icon = 'copy',
		variant = 'neutral',
		size = 'md',
		class: className
	}: Props = $props();
	let status = $state<'idle' | 'copied' | 'failed'>('idle');
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			status = 'copied';
		} catch {
			status = 'failed';
		}
		clearTimeout(timer);
		timer = setTimeout(() => (status = 'idle'), 2000);
	}

	const Icon = $derived(icon === 'link' ? Link : Copy);
	const iconSize = $derived(size === 'sm' ? 14 : 16);
</script>

<Button
	{variant}
	{size}
	onclick={copy}
	aria-label={ariaLabel}
	class={[className, status === 'copied' && 'border-success! text-success-text!']}
>
	{#if status === 'copied'}
		<Check size={iconSize} aria-hidden="true" /> Copied
	{:else}
		<Icon size={iconSize} aria-hidden="true" />
		{status === 'failed' ? 'Copy failed' : label}
	{/if}
</Button>
<span class="sr-only" aria-live="polite">{status === 'copied' ? announcement : ''}</span>
