<script lang="ts">
	import Loader from '@lucide/svelte/icons/loader';
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	type Common = {
		variant?: 'primary' | 'secondary' | 'neutral' | 'destructive';
		/** `lg` is the 44px touch target required on applicant pages (DESIGN.md §4). */
		size?: 'md' | 'lg';
		children: Snippet;
	};
	type ButtonProps = Common & HTMLButtonAttributes & { href?: undefined; loading?: boolean };
	type LinkProps = Common & HTMLAnchorAttributes & { href: string; loading?: undefined };
	type Props = ButtonProps | LinkProps;

	let {
		variant = 'neutral',
		size = 'md',
		loading = false,
		class: className,
		children,
		...rest
	}: Props = $props();

	const variants = {
		primary: 'border-brand bg-brand text-card hover:bg-brand/90',
		secondary: 'border-brand bg-card text-brand hover:bg-wash',
		neutral: 'border-line bg-card text-body hover:bg-subtle',
		destructive: 'border-danger bg-card text-danger-text hover:bg-danger/10'
	};
	const sizes = { md: 'h-9', lg: 'h-11' };
	const classes = $derived([
		'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border px-4 text-body-sm font-medium outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-line disabled:bg-subtle disabled:text-helper',
		variants[variant],
		sizes[size],
		className
	]);
</script>

{#if rest.href !== undefined}
	<a {...rest} class={classes}>{@render children()}</a>
{:else}
	<button
		type="button"
		{...rest}
		disabled={rest.disabled || loading}
		aria-busy={loading || undefined}
		class={classes}
	>
		{#if loading}
			<Loader size={16} aria-hidden="true" class="motion-safe:animate-spin" />
		{/if}
		{@render children()}
	</button>
{/if}
