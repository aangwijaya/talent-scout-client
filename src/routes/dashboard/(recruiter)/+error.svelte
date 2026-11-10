<script lang="ts">
	import Briefcase from '@lucide/svelte/icons/briefcase';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import InlineError from '$lib/components/InlineError.svelte';

	const title = $derived(
		page.route.id === '/dashboard/(recruiter)/jobs'
			? "Couldn't load jobs"
			: page.route.id === '/dashboard/(recruiter)/jobs/[jobId]'
				? "Couldn't load applicants"
				: "Couldn't load this page"
	);
	const notFound = $derived(page.status === 404 && page.route.id?.endsWith('/jobs/[jobId]'));
</script>

<svelte:head><title>Error · Talent Scout</title></svelte:head>

{#if notFound}
	<Card class="mx-auto mt-10 max-w-md">
		<EmptyState
			icon={Briefcase}
			title="This job doesn't exist"
			description="The link may be old. Pick a job from the list instead."
		>
			{#snippet action()}
				<Button href={resolve('/dashboard/(recruiter)/jobs')}>Back to jobs</Button>
			{/snippet}
		</EmptyState>
	</Card>
{:else}
	<InlineError
		{title}
		message={page.error?.message ?? 'Something went wrong'}
		onretry={() => invalidateAll()}
	/>
{/if}
