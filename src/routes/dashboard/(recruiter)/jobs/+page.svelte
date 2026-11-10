<script lang="ts">
	import Briefcase from '@lucide/svelte/icons/briefcase';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { resolve } from '$app/paths';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { formatDate, withoutScheme } from '$lib/components/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const COPY = {
		title: 'Jobs',
		description: "Share a job's apply link with candidates. Open a job to see its applicants.",
		copied: 'Apply link copied to the clipboard.',
		empty: 'No jobs yet',
		emptyDescription: 'Jobs show up here once they are created on the server.'
	};

	const criteria = (count: number) => `${count} rubric ${count === 1 ? 'criterion' : 'criteria'}`;
</script>

<svelte:head><title>Jobs · Talent Scout</title></svelte:head>

<div class="mb-6">
	<h1 class="text-heading-sm font-semibold text-ink">{COPY.title}</h1>
	<p class="mt-1 text-body-sm text-muted">{COPY.description}</p>
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
				</tr>
			{:else}
				<tr>
					<td colspan="5">
						<EmptyState icon={Briefcase} title={COPY.empty} description={COPY.emptyDescription} />
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
