<script lang="ts">
	import InterviewerAvatar from './InterviewerAvatar.svelte';

	type Props = { role: 'assistant' | 'applicant'; content: string; streaming?: boolean };

	let { role, content, streaming = false }: Props = $props();
</script>

<!-- A streaming reply stays hidden from the live region until message.completed replaces it. -->
<div
	class={['flex items-end gap-2', role === 'applicant' ? 'justify-end' : 'justify-start']}
	aria-hidden={streaming || undefined}
>
	{#if role === 'assistant'}<InterviewerAvatar />{/if}
	<p
		class={[
			'max-w-[85%] rounded-panel px-4 py-3 text-base whitespace-pre-line',
			role === 'applicant'
				? 'rounded-br-card bg-brand text-card'
				: 'rounded-bl-card border border-line bg-card text-body shadow-card'
		]}
	>
		{content}{#if streaming}<span
				class="ml-0.5 inline-block h-4 w-1.5 bg-helper align-middle motion-safe:animate-pulse"
			></span>{/if}
	</p>
</div>
