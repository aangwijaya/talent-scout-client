<script lang="ts">
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Button from '$lib/components/Button.svelte';
	import InlineError from '$lib/components/InlineError.svelte';

	/** The banner title, e.g. "Couldn't load jobs". */
	let { title }: { title: string } = $props();
</script>

<!-- A dashboard error that is not a 404: page h1, the API banner with its reason, two ways out. -->
<div class="flex flex-col gap-4">
	<h1 class="text-heading-sm font-semibold text-ink">Something went wrong</h1>
	<InlineError {title} message={page.error?.message ?? 'Something went wrong'} />
	<div class="flex flex-wrap gap-3">
		<Button onclick={() => invalidateAll()}>
			<RotateCcw size={16} aria-hidden="true" /> Try again
		</Button>
		<Button href={resolve('/dashboard/(recruiter)/jobs')} variant="secondary">Back to jobs</Button>
	</div>
</div>
