<script lang="ts">
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Button from '$lib/components/Button.svelte';
	import Logo from '$lib/components/Logo.svelte';

	// Login and any route outside the dashboard; /apply and /s keep their own error screens.
	const notFound = $derived(page.status === 404);
	const COPY = $derived(
		notFound
			? {
					title: 'Page not found',
					description: 'The link may be old or mistyped. Sign in to open the dashboard.'
				}
			: {
					title: 'Something went wrong',
					description: "This page couldn't load. Try again in a moment."
				}
	);
</script>

<svelte:head><title>{COPY.title} · Talent Scout</title></svelte:head>

<main class="flex min-h-dvh flex-col items-center justify-center gap-6 bg-canvas p-4 sm:p-6">
	<Logo />
	<div
		class="w-full max-w-[400px] rounded-panel border border-line bg-card p-6 shadow-panel sm:p-8"
	>
		<h1 class="text-heading-sm font-semibold text-ink">{COPY.title}</h1>
		<p class="mt-1 text-body-sm text-muted">{COPY.description}</p>
		<p class="mt-3 font-mono text-caption text-muted">Error {page.status}</p>
		<div class="mt-6 flex flex-col gap-3 sm:flex-row">
			<Button href={resolve('/dashboard/login')} variant="primary" size="lg">Go to sign in</Button>
			{#if !notFound}
				<Button onclick={() => invalidateAll()} size="lg">
					<RotateCcw size={16} aria-hidden="true" /> Try again
				</Button>
			{/if}
		</div>
	</div>
</main>
