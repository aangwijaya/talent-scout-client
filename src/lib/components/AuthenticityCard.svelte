<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Minus from '@lucide/svelte/icons/minus';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import type { Authenticity } from '$lib/server/api/types';
	import { AUTHENTICITY_ADVISORY, authenticityView, type AuthenticityTone } from './authenticity';

	type Props = { authenticity: Authenticity | null };

	let { authenticity }: Props = $props();

	const view = $derived(authenticityView(authenticity));

	const PILLS: Record<AuthenticityTone, string> = {
		likely: 'bg-warning/10 text-warning-text',
		possible: 'bg-subtle text-muted',
		none: 'bg-success/10 text-success-text',
		unassessed: 'bg-subtle text-muted'
	};
	const ICONS = { likely: TriangleAlert, possible: CircleAlert, none: Check, unassessed: Minus };
	const Icon = $derived(ICONS[view.tone]);
</script>

<section
	class={[
		'flex flex-col gap-2.5 rounded-panel border bg-card p-4 shadow-card',
		view.tone === 'likely' ? 'border-warning' : 'border-line'
	]}
	aria-labelledby="authenticity-heading"
>
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h2
			id="authenticity-heading"
			class="text-caption font-medium tracking-[0.04em] text-muted uppercase"
		>
			Answer authenticity
		</h2>
		<span
			class={[
				'inline-flex items-center gap-1 rounded-full px-2 py-1 text-caption font-medium',
				PILLS[view.tone]
			]}
		>
			<Icon size={12} strokeWidth={2.5} aria-hidden="true" />{view.label}
		</span>
	</div>
	<p class="text-body-sm text-muted">{view.summary}</p>
	{#if view.reasons.length > 0}
		<ul class="flex list-disc flex-col gap-1 pl-5 text-body-sm text-ink">
			{#each view.reasons as reason, i (i)}<li>{reason}</li>{/each}
		</ul>
	{/if}
	<p class="text-caption text-helper">
		{view.checked ? `${AUTHENTICITY_ADVISORY} ${view.checked}` : AUTHENTICITY_ADVISORY}
	</p>
</section>
