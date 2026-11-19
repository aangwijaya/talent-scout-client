<script lang="ts">
	import Briefcase from '@lucide/svelte/icons/briefcase';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Plus from '@lucide/svelte/icons/plus';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/Button.svelte';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { formatDate, withoutScheme } from '$lib/components/format';
	import { JOB_LIMIT, LIMIT_MESSAGE } from '$lib/components/job-form';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const COPY = {
		title: 'Jobs',
		description: "Share a job's apply link with candidates. Open a job to see its applicants.",
		copied: 'Apply link copied to the clipboard.',
		empty: 'No jobs yet',
		emptyDescription: 'Create a job to get an apply link to share.',
		newJob: 'New job',
		edit: 'Edit'
	};

	const criteria = (count: number) => `${count} rubric ${count === 1 ? 'criterion' : 'criteria'}`;
	const atLimit = $derived(data.jobs.length >= JOB_LIMIT);
</script>

<svelte:head><title>Jobs · Talent Scout</title></svelte:head>

<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
	<div>
		<h1 class="text-heading-sm font-semibold text-ink">{COPY.title}</h1>
		<p class="mt-1 text-body-sm text-muted">{COPY.description}</p>
	</div>
	<div class="flex flex-col gap-1.5 sm:items-end">
		{#if atLimit}
			<Button
				variant="primary"
				disabled
				aria-disabled="true"
				aria-describedby="job-count"
				class="h-10 max-sm:h-11"
			>
				<Plus size={16} aria-hidden="true" />{COPY.newJob}
			</Button>
		{:else}
			<Button
				href={resolve('/dashboard/(recruiter)/jobs/new')}
				variant="primary"
				aria-describedby="job-count"
				class="h-10 max-sm:h-11"
			>
				<Plus size={16} aria-hidden="true" />{COPY.newJob}
			</Button>
		{/if}
		<p id="job-count" class="text-caption text-helper">
			{#if atLimit}{LIMIT_MESSAGE}{:else}<span class="font-mono">{data.jobs.length}</span> of {JOB_LIMIT}
				jobs{/if}
		</p>
	</div>
</div>

<div class="overflow-x-auto rounded-panel border border-line bg-card">
	<table class="w-full text-left text-body-sm">
		<thead class="bg-subtle text-caption text-muted uppercase">
			<tr>
				<th scope="col" class="px-4 py-3 font-medium">Job</th>
				<th scope="col" class="px-4 py-3 font-medium">Status</th>
				<th scope="col" class="px-4 py-3 text-right font-medium">Applicants</th>
				<th scope="col" class="px-4 py-3 font-medium">Apply link</th>
				<th scope="col" class="px-4 py-3 font-medium">Created</th>
				<th scope="col" class="px-4 py-3"><span class="sr-only">Actions</span></th>
			</tr>
		</thead>
		<tbody>
			{#each data.jobs as job (job.id)}
				<tr class="border-t border-line hover:bg-wash">
					<td class="min-w-56 px-4 py-2.5">
						<a
							href={resolve('/dashboard/(recruiter)/jobs/[jobId]', { jobId: job.id })}
							class="inline-flex items-center gap-1 rounded-sm font-medium text-ink hover:text-brand focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-hidden"
						>
							<span class="[overflow-wrap:anywhere]">{job.title}</span>
							<ChevronRight size={16} aria-hidden="true" class="shrink-0" />
						</a>
						<span class="block text-caption text-helper">{criteria(job.rubric.length)}</span>
					</td>
					<td class="px-4 py-2.5"><StatusBadge status={job.status} /></td>
					<td class="px-4 py-2.5 text-right font-mono text-ink">{job.application_count}</td>
					<td class="px-4 py-2.5">
						<div class="flex items-center gap-3">
							<span
								title={job.apply_url}
								class="max-w-64 truncate font-mono text-caption text-muted"
							>
								{withoutScheme(job.apply_url)}
							</span>
							<CopyButton
								value={job.apply_url}
								label="Copy"
								size="sm"
								ariaLabel="Copy apply link for {job.title}"
								announcement={COPY.copied}
							/>
						</div>
					</td>
					<td class="px-4 py-2.5 whitespace-nowrap text-muted">{formatDate(job.created_at)}</td>
					<td class="px-4 py-2.5 text-right">
						<a
							href={resolve('/dashboard/(recruiter)/jobs/[jobId]/edit', { jobId: job.id })}
							aria-label="Edit {job.title}"
							class="rounded-sm text-body-sm font-medium text-brand hover:underline focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-hidden"
							>{COPY.edit}</a
						>
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan="6">
						<EmptyState icon={Briefcase} title={COPY.empty} description={COPY.emptyDescription} />
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
