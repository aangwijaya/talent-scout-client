<script lang="ts">
	import { page } from '$app/state';
	import Card from '$lib/components/Card.svelte';

	const FALLBACK = 'Something went wrong while loading this job. Please try again in a moment.';
	const message = $derived(page.status === 404 ? page.error?.message : FALLBACK);
</script>

<svelte:head>
	<title>Apply · Talent Scout</title>
</svelte:head>

<main class="min-h-screen bg-canvas px-4 py-16 text-body">
	<Card class="mx-auto flex max-w-[640px] flex-col gap-2 p-8 text-center">
		<h1 class="text-subheading font-semibold text-ink">We can't show this job</h1>
		<p role="alert" class="text-muted">{message ?? FALLBACK}</p>
	</Card>
</main>
