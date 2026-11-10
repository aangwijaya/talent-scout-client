<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import InlineError from '$lib/components/InlineError.svelte';
</script>

<svelte:head><title>Error · Talent Scout</title></svelte:head>

<div class="flex flex-col gap-4">
	<InlineError message={page.error?.message ?? 'Something went wrong'} />
	<a href={resolve('/dashboard/(recruiter)/jobs')} class="text-body-sm text-muted hover:text-ink"
		>← Back to jobs</a
	>
</div>
