<script lang="ts">
	import Network from '@lucide/svelte/icons/network';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Button from '$lib/components/Button.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ServerError from '../../ServerError.svelte';
</script>

<svelte:head><title>Graph run · Talent Scout</title></svelte:head>

{#if page.status === 404}
	<div class="rounded-panel bg-wash">
		<EmptyState
			icon={Network}
			level={1}
			title="Graph run not found"
			description="No graph run has this ID. Open a run from an application review instead."
		>
			{#snippet action()}
				<Button href={resolve('/dashboard/(recruiter)/jobs')}>Back to jobs</Button>
			{/snippet}
		</EmptyState>
	</div>
{:else}
	<ServerError title="Couldn't load this graph run" />
{/if}
