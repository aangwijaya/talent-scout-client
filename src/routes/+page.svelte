<script lang="ts">
	import Button from '$lib/components/Button.svelte';

	const copy = {
		name: 'Talent Scout',
		description:
			'Applicants chat with an AI screener for about 15 minutes. You review the transcript, scores with evidence quotes, and the agent graph as it runs, then decide who moves forward.',
		cta: 'Open recruiter dashboard'
	};
</script>

<svelte:head>
	<title>{copy.name}</title>
	<meta name="description" content={copy.description} />
</svelte:head>

<main class="min-h-dvh bg-linear-to-b from-wash to-canvas">
	<div class="mx-auto flex max-w-[720px] flex-col items-start gap-6 px-6 py-18">
		<h1 class="text-heading font-semibold text-ink">{copy.name}</h1>
		<p class="max-w-prose text-base text-muted">{copy.description}</p>
		<Button href="/dashboard" variant="primary" size="lg">{copy.cta}</Button>
	</div>
</main>
