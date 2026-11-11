<script lang="ts">
	import type { Message, Score, Topic } from '$lib/server/api/types';
	import { evidenceByMessage, groupByTopic, highlight, speakerLabel } from './review';

	type Props = {
		messages: readonly Message[];
		topics: readonly Topic[];
		scores: readonly Score[];
		applicantName: string;
		/** The message a "Jump to message" link pointed at; highlighted for 2 seconds. */
		highlighted: string | null;
	};

	let { messages, topics, scores, applicantName, highlighted }: Props = $props();

	const groups = $derived(groupByTopic(messages, topics));
	const quotes = $derived(evidenceByMessage(scores));
</script>

<section class="rounded-panel border border-line bg-card" aria-labelledby="transcript-heading">
	<header
		class="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5"
	>
		<h2 id="transcript-heading" class="text-subheading font-semibold text-ink">Transcript</h2>
		{#if quotes.size > 0}
			<p class="flex items-center gap-2 text-caption text-helper">
				Quoted as evidence:
				<mark class="border-b-2 border-brand bg-brand/10 px-0.5 text-body">sample</mark>
			</p>
		{/if}
	</header>

	<!-- The region scrolls on its own, so it takes focus for keyboard scrolling. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		role="region"
		aria-label="Transcript messages"
		tabindex="0"
		class="flex max-h-[calc(100dvh-12rem)] flex-col gap-4 overflow-y-auto p-4 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-hidden sm:p-5"
	>
		{#each groups as group, index (index)}
			{#if group.topic}
				<div class="flex items-center gap-2 text-caption text-muted">
					<span class="rounded-full bg-subtle px-2 py-0.5 font-medium whitespace-nowrap">
						Topic {group.topic.position}
					</span>
					<span class="min-w-0 [overflow-wrap:anywhere]">{group.topic.title}</span>
					<span class="h-px flex-1 bg-line" aria-hidden="true"></span>
				</div>
			{/if}
			{#each group.messages as message (message.id)}
				{@const mine = message.role === 'applicant'}
				<div class={['flex flex-col gap-1', mine ? 'items-end' : 'items-start']}>
					<p class="text-caption text-helper">{speakerLabel(message, applicantName)}</p>
					<p
						id={message.id}
						tabindex="-1"
						class={[
							'max-w-[85%] scroll-mt-4 px-4 py-3 text-base [overflow-wrap:anywhere] whitespace-pre-line text-body outline-2 outline-offset-2 motion-safe:transition-colors',
							mine
								? 'rounded-panel rounded-tr-sm bg-wash'
								: 'rounded-panel rounded-tl-sm border border-line bg-card',
							highlighted === message.id ? 'bg-warning/10! outline-warning' : 'outline-transparent'
						]}
					>
						{#if mine}
							{#each highlight(message.content, quotes.get(message.id) ?? []) as segment, i (i)}
								{#if segment.quoted}<mark class="border-b-2 border-brand bg-brand/10 text-body"
										>{segment.text}</mark
									>{:else}{segment.text}{/if}
							{/each}
						{:else}
							{message.content}
						{/if}
					</p>
				</div>
			{/each}
		{/each}
	</div>
</section>
