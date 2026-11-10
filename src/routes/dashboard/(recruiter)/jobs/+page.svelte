<script lang="ts">
	import { resolve } from '$app/paths';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const jobStatus = { open: 'Open', closed: 'Closed' } as const;
</script>

<svelte:head><title>Jobs · Talent Scout</title></svelte:head>

<h1 class="mb-6 text-heading-sm text-ink">Jobs</h1>

<div class="overflow-x-auto rounded-panel border border-line bg-card">
	<table class="w-full text-left text-body-sm">
		<thead class="bg-subtle text-caption text-muted uppercase">
			<tr>
				<th scope="col" class="px-4 py-3 font-medium">Title</th>
				<th scope="col" class="px-4 py-3 font-medium">Status</th>
				<th scope="col" class="px-4 py-3 text-right font-medium">Applicants</th>
				<th scope="col" class="px-4 py-3 font-medium">Apply link</th>
			</tr>
		</thead>
		<tbody>
			{#each data.jobs as job (job.id)}
				<tr class="h-11 border-t border-line hover:bg-wash">
					<td class="px-4 py-2">
						<a
							href={resolve('/dashboard/(recruiter)/jobs/[jobId]', { jobId: job.id })}
							class="font-medium text-ink hover:text-brand"
						>
							{job.title}
						</a>
					</td>
					<td class="px-4 py-2 text-muted">{jobStatus[job.status]}</td>
					<td class="px-4 py-2 text-right font-mono">{job.application_count}</td>
					<td class="px-4 py-2">
						<div class="flex items-center gap-3">
							<span class="max-w-64 truncate font-mono text-caption text-muted">
								{job.apply_url}
							</span>
							<CopyButton value={job.apply_url} />
						</div>
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan="4" class="px-4 py-10 text-center text-muted">No jobs yet.</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
