<script lang="ts">
	import type { RubricCriterion, Score } from '$lib/server/api/types';
	import EvidenceQuote from './EvidenceQuote.svelte';
	import StatusBadge from './StatusBadge.svelte';
	import { attemptsText } from './review';

	const SEGMENTS = [1, 2, 3, 4, 5];

	type Props = {
		criterion: RubricCriterion;
		/** Missing when the scorer produced nothing for this criterion; shown as needing review. */
		score: Score | undefined;
		onjump: (messageId: string) => void;
	};

	let { criterion, score, onjump }: Props = $props();

	const value = $derived(score?.status === 'valid' ? score.score : null);
	const meta = $derived(
		[`Weight ${criterion.weight}`, score && attemptsText(score)].filter(Boolean).join(' · ')
	);
</script>

<article
	class="flex flex-col gap-3 rounded-card border border-line bg-card p-4 shadow-card"
	aria-labelledby="criterion-{criterion.key}"
>
	<header class="flex items-start justify-between gap-3">
		<div class="min-w-0">
			<h3 id="criterion-{criterion.key}" class="text-subheading font-semibold text-ink">
				{criterion.label}
			</h3>
			<p class="text-caption text-helper">{meta}</p>
		</div>
		{#if value === null}
			<span role="img" class="font-mono text-2xl text-helper" aria-label="No score">—</span>
		{:else}
			<span
				role="img"
				class="font-mono text-2xl whitespace-nowrap text-ink"
				aria-label="{value} out of 5"
			>
				{value}/5
			</span>
		{/if}
	</header>

	{#if value === null}
		<div><StatusBadge status="needs_manual" /></div>
	{:else}
		<div class="flex gap-1" aria-hidden="true">
			{#each SEGMENTS as segment (segment)}
				<span class={['h-1.5 flex-1 rounded-full', segment <= value ? 'bg-brand' : 'bg-subtle']}
				></span>
			{/each}
		</div>
	{/if}

	{#if score?.rationale}
		<p class="text-body-sm text-muted">{score.rationale}</p>
	{/if}

	{#each score?.evidence ?? [] as evidence, index (index)}
		<EvidenceQuote {evidence} {onjump} />
	{/each}
</article>
