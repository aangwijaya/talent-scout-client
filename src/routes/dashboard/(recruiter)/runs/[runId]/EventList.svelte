<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Check from '@lucide/svelte/icons/check';
	import Circle from '@lucide/svelte/icons/circle';
	import List from '@lucide/svelte/icons/list';
	import Loader from '@lucide/svelte/icons/loader';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Minus from '@lucide/svelte/icons/minus';
	import Play from '@lucide/svelte/icons/play';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import X from '@lucide/svelte/icons/x';
	import type { Component } from 'svelte';
	import type { RunEvent } from '$lib/events';
	import { eventSummary, relativeTime } from '$lib/components/graph-layout';
	import { formatCost } from '$lib/components/review';

	type Props = {
		events: readonly RunEvent[];
		startedAt: string | null;
		onpick: (event: RunEvent, index: number) => void;
	};

	let { events, startedAt, onpick }: Props = $props();

	const ICONS: Record<RunEvent['event'], [Component, string]> = {
		'run.started': [Play, 'text-brand'],
		'node.started': [Loader, 'text-brand'],
		'node.completed': [Check, 'text-success-text'],
		'node.failed': [X, 'text-danger-text'],
		'node.skipped': [Minus, 'text-muted'],
		'check.passed': [Check, 'text-success-text'],
		'check.failed': [X, 'text-danger-text'],
		'loop.retry': [RotateCcw, 'text-warning-text'],
		'edge.traversed': [ArrowRight, 'text-muted'],
		'topic.changed': [List, 'text-muted'],
		'message.completed': [MessageSquare, 'text-muted'],
		'run.completed': [Check, 'text-success-text'],
		'run.failed': [X, 'text-danger-text']
	};

	const newestFirst = $derived(events.map((event, index) => ({ event, index })).reverse());
</script>

<section aria-labelledby="events-title" class="flex min-h-0 flex-1 flex-col">
	<div class="flex items-baseline justify-between gap-2 px-6 pt-4 pb-2">
		<h2 id="events-title" class="text-body-sm font-semibold text-ink">Events</h2>
		<p class="text-caption text-muted">Newest first · {events.length} received</p>
	</div>
	{#if events.length === 0}
		<p class="flex items-center gap-2 px-6 pb-6 text-body-sm text-muted">
			<Circle size={12} aria-hidden="true" /> No events yet.
		</p>
	{:else}
		<ol class="max-h-[560px] overflow-y-auto px-3 pb-4">
			{#each newestFirst as { event, index }, i (event.seq)}
				{@const [Icon, color] = ICONS[event.event]}
				<li>
					<button
						type="button"
						aria-current={i === 0 ? 'step' : undefined}
						onclick={() => onpick(event, index)}
						class={[
							'grid w-full cursor-pointer grid-cols-[2.5rem_1rem_1fr_auto] items-start gap-2 rounded-card px-3 py-2 text-left outline-hidden hover:bg-subtle focus-visible:ring-2 focus-visible:ring-focus',
							i === 0 && 'bg-wash'
						]}
					>
						<span class="font-mono text-caption text-muted">{event.seq}</span>
						<Icon size={16} aria-hidden="true" class={[color, 'mt-px']} />
						<span class="min-w-0">
							<span class="block font-mono text-caption text-ink">{event.event}</span>
							<span class="block text-caption [overflow-wrap:anywhere] text-muted"
								>{eventSummary(event, formatCost)}</span
							>
						</span>
						<span class="font-mono text-caption text-muted"
							>{relativeTime(event.ts, startedAt)}</span
						>
					</button>
				</li>
			{/each}
		</ol>
	{/if}
</section>
