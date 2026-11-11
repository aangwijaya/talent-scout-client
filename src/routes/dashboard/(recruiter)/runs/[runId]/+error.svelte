<script lang="ts">
	import Network from '@lucide/svelte/icons/network';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import Button from '$lib/components/Button.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import InlineError from '$lib/components/InlineError.svelte';
</script>

<svelte:head><title>Graph run · Talent Scout</title></svelte:head>

{#if page.status === 404}
	<div class="rounded-panel bg-wash">
		<EmptyState
			icon={Network}
			title="Graph run not found"
			description="No graph run has this ID. Open a run from an application review instead."
		>
			{#snippet action()}
				<Button href={resolve('/dashboard/(recruiter)/jobs')}>Back to jobs</Button>
			{/snippet}
		</EmptyState>
	</div>
{:else}
	<InlineError
		title="Couldn't load this graph run"
		message={page.error?.message ?? 'Something went wrong'}
		onretry={() => invalidateAll()}
	/>
{/if}
