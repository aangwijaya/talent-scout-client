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
		/** A round 44px icon button; `ariaLabel` names it. */
		iconOnly?: boolean;
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
		iconOnly = false,
		class: className
	}: Props = $props();
	const COPY_FAILED = 'Copy failed. The clipboard is not available.';
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
	class={[
		iconOnly && 'size-11 shrink-0 px-0',
		className,
		status === 'copied' && 'border-success! text-success-text!'
	]}
>
	{#if status === 'copied'}
		<Check size={iconSize} aria-hidden="true" />
		<span class={iconOnly ? 'sr-only' : undefined}>Copied</span>
	{:else}
		<Icon size={iconSize} aria-hidden="true" />
		<span class={iconOnly ? 'sr-only' : undefined}
			>{status === 'failed' ? 'Copy failed' : label}</span
		>
	{/if}
</Button>
<span class="sr-only" aria-live="polite"
	>{status === 'copied' ? announcement : status === 'failed' ? COPY_FAILED : ''}</span
>
