<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLDivElement> & {
		variant?: 'card' | 'panel';
		children: Snippet;
	};

	let { variant = 'card', class: className, children, ...rest }: Props = $props();

	const variants = {
		card: 'rounded-card p-4 shadow-card',
		panel: 'rounded-panel shadow-panel'
	};
</script>

<div {...rest} class={['border border-line bg-card', variants[variant], className]}>
	{@render children()}
</div>
