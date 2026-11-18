<script lang="ts">
	import InterviewerAvatar from './InterviewerAvatar.svelte';

	type Props = { first: boolean };

	let { first }: Props = $props();

	const COPY = {
		firstLabel: 'The interviewer is preparing your first question',
		label: 'The interviewer is typing',
		firstCaption: 'Preparing your first question…'
	};
</script>

<div class="flex flex-col gap-1">
	<div class="flex items-end gap-2">
		<InterviewerAvatar />
		<div
			role="status"
			aria-label={first ? COPY.firstLabel : COPY.label}
			class="flex items-center gap-[5px] rounded-panel rounded-bl-card border border-line bg-card px-4 py-[15px] shadow-card"
		>
			{#each [0, 200, 400] as delay (delay)}
				<span
					data-dot
					class="size-[7px] rounded-full bg-helper opacity-60 motion-safe:animate-[typing-dot_1.2s_ease-in-out_infinite]"
					style:animation-delay="{delay}ms"
				></span>
			{/each}
		</div>
	</div>
	{#if first}
		<p class="pl-9 text-caption text-helper sm:pl-10" aria-hidden="true">{COPY.firstCaption}</p>
	{/if}
</div>

<style>
	@keyframes -global-typing-dot {
		0%,
		100% {
			opacity: 0.25;
		}
		50% {
			opacity: 1;
		}
	}
</style>
