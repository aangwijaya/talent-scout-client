<script lang="ts">
	import { page } from '$app/state';
	import Card from '$lib/components/Card.svelte';

	const FALLBACK = 'Something went wrong while loading your session. Please try again in a moment.';
	const message = $derived(
		page.status === 404 || page.status === 410 ? page.error?.message : FALLBACK
	);
</script>

<svelte:head>
	<title>Screening session · Talent Scout</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="min-h-dvh bg-canvas px-4 py-16 text-body">
	<Card class="mx-auto flex max-w-[640px] flex-col gap-2 p-8 text-center">
		<h1 class="text-subheading font-semibold text-ink">We can't open this session</h1>
		<p role="alert" class="text-muted">{message ?? FALLBACK}</p>
	</Card>
</main>
