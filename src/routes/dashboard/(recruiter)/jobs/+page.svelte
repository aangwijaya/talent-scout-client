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
		emptyDescription: 'Create a job and share its apply link to start screening.',
		newJob: 'New job',
		edit: 'Edit'
	};

	const STATUS = { open: 'Open', closed: 'Closed' } as const;

	const criteria = (count: number) => `${count} rubric ${count === 1 ? 'criterion' : 'criteria'}`;
	const summary = (job: PageProps['data']['jobs'][number]) =>
		`${job.application_count} ${job.application_count === 1 ? 'applicant' : 'applicants'} · ${STATUS[job.status]} · ${formatDate(job.created_at)}`;
	const jobHref = (jobId: string) => resolve('/dashboard/(recruiter)/jobs/[jobId]', { jobId });
	const atLimit = $derived(data.jobs.length >= JOB_LIMIT);
</script>

<svelte:head><title>Jobs · Talent Scout</title></svelte:head>

<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
	<div>
		<h1 class="text-heading-sm font-semibold text-ink">{COPY.title}</h1>
		<p class="mt-1 text-body-sm text-muted">{COPY.description}</p>
	</div>
	<div class="flex flex-col gap-1.5 sm:items-end">
		<!-- With no jobs the empty state's New job is the screen's one primary action (DESIGN.md). -->
		{#if data.jobs.length > 0 && atLimit}
			<Button
				variant="primary"
				disabled
				aria-disabled="true"
				aria-describedby="job-count"
				class="h-10 max-sm:h-11"
			>
				<Plus size={16} aria-hidden="true" />{COPY.newJob}
			</Button>
		{:else if data.jobs.length > 0}
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

{#snippet empty()}
	<EmptyState icon={Briefcase} title={COPY.empty} description={COPY.emptyDescription}>
		{#snippet action()}
			<Button href={resolve('/dashboard/(recruiter)/jobs/new')} variant="primary">
				<Plus size={16} aria-hidden="true" />{COPY.newJob}
			</Button>
		{/snippet}
	</EmptyState>
{/snippet}

{#if data.jobs.length === 0}
	<div class="overflow-hidden rounded-panel border border-line bg-card">
		<div class="h-10 bg-subtle" aria-hidden="true"></div>
		<div class="border-t border-line">{@render empty()}</div>
	</div>
{:else}
	<!-- Below 1024px each job is one list row (no sideways scroll); Edit lives on the job page. -->
	<ul class="overflow-hidden rounded-panel border border-line bg-card lg:hidden">
		{#each data.jobs as job (job.id)}
			<li
				class="flex items-center gap-2 pr-2 not-first:border-t not-first:border-line hover:bg-wash"
			>
				<a
					href={jobHref(job.id)}
					class="flex min-h-11 min-w-0 flex-1 items-center gap-3 py-3 pl-4 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-hidden focus-visible:ring-inset"
				>
					<span class="flex min-w-0 flex-1 flex-col gap-0.5">
						<span class="truncate font-medium text-ink">{job.title}</span>
						<span class="text-caption text-muted">{summary(job)}</span>
					</span>
					<ChevronRight size={16} aria-hidden="true" class="shrink-0 text-muted" />
				</a>
				<CopyButton
					value={job.apply_url}
					iconOnly
					icon="link"
					ariaLabel="Copy apply link for {job.title}"
					announcement={COPY.copied}
				/>
			</li>
		{/each}
	</ul>

	<div class="overflow-x-auto rounded-panel border border-line bg-card max-lg:hidden">
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
							<span class="block text-caption text-muted">{criteria(job.rubric.length)}</span>
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
				{/each}
			</tbody>
		</table>
	</div>
{/if}
