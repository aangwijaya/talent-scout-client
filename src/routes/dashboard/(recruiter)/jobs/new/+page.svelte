<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { resolve } from '$app/paths';
	import JobForm from '$lib/components/JobForm.svelte';
	import { JOB_LIMIT, LIMIT_MESSAGE } from '$lib/components/job-form';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const jobsHref = resolve('/dashboard/(recruiter)/jobs');
	const atLimit = $derived(data.jobCount >= JOB_LIMIT);
	const blank = { title: '', description: '', status: 'open' as const, rubric: [] };
</script>

<svelte:head><title>New job · Talent Scout</title></svelte:head>

<div class="mx-auto max-w-[880px]">
	<nav aria-label="Breadcrumb" class="text-body-sm">
		<ol class="flex flex-wrap items-center gap-1">
			<li>
				<a
					href={jobsHref}
					class="rounded-sm text-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:outline-hidden"
					>Jobs</a
				>
			</li>
			<li aria-hidden="true" class="text-helper"><ChevronRight size={14} /></li>
			<li aria-current="page" class="text-ink">New job</li>
		</ol>
	</nav>
	<h1 class="mt-2 mb-6 text-heading-sm font-semibold text-ink">New job</h1>

	<JobForm
		mode="create"
		initial={form?.values ?? blank}
		errors={form?.errors ?? (atLimit ? { form: LIMIT_MESSAGE } : undefined)}
		cancelHref={jobsHref}
	/>
</div>
