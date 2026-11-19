<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { resolve } from '$app/paths';
	import JobForm from '$lib/components/JobForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const jobHref = $derived(resolve('/dashboard/(recruiter)/jobs/[jobId]', { jobId: data.job.id }));
	const count = $derived(data.job.application_count);
</script>

<svelte:head><title>Edit {data.job.title} · Talent Scout</title></svelte:head>

<div class="mx-auto max-w-[880px]">
	<nav aria-label="Breadcrumb" class="text-body-sm">
		<ol class="flex flex-wrap items-center gap-1">
			<li>
				<a href={resolve('/dashboard/(recruiter)/jobs')} class="text-muted hover:text-ink">Jobs</a>
			</li>
			<li aria-hidden="true" class="text-helper"><ChevronRight size={14} /></li>
			<li>
				<a href={jobHref} class="[overflow-wrap:anywhere] text-muted hover:text-ink"
					>{data.job.title}</a
				>
			</li>
			<li aria-hidden="true" class="text-helper"><ChevronRight size={14} /></li>
			<li aria-current="page" class="text-ink">Edit</li>
		</ol>
	</nav>
	<div class="mt-2 mb-6 flex items-baseline justify-between gap-4">
		<h1 class="text-[28px] leading-tight font-semibold text-ink">Edit job</h1>
		<p class="text-body-sm text-muted">
			<span class="font-mono">{count}</span>
			{count === 1 ? 'applicant' : 'applicants'}
		</p>
	</div>

	{#key data.job.id}
		<JobForm
			mode="edit"
			initial={form?.values ?? data.job}
			locked={data.locked}
			applicantCount={count}
			errors={form?.errors}
			cancelHref={jobHref}
		/>
	{/key}
</div>
