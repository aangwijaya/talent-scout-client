<script lang="ts">
	import { resolve } from '$app/paths';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const labels = {
		applied: 'Applied',
		invited: 'Invited',
		in_session: 'In session',
		scoring: 'Scoring',
		review: 'Review',
		shortlisted: 'Shortlisted',
		rejected: 'Rejected',
		failed: 'Failed'
	} as const;

	const filters = $derived([
		{ status: null, label: 'All' },
		...data.statuses.map((status) => ({
			status,
			label: labels[status]
		}))
	]);
</script>

<svelte:head><title>{data.job.title} · Applicants · Talent Scout</title></svelte:head>

<a href={resolve('/dashboard/(recruiter)/jobs')} class="text-body-sm text-muted hover:text-ink"
	>← Jobs</a
>
<h1 class="mt-2 mb-6 text-heading-sm text-ink">{data.job.title}</h1>

<!-- A GET form: each pill submits its status, and "All" submits none. -->
<form method="GET" aria-label="Filter by status" class="mb-4 flex flex-wrap gap-2">
	{#each filters as filter (filter.label)}
		{@const active = filter.status === data.status}
		<button
			name={filter.status ? 'status' : undefined}
			value={filter.status ?? undefined}
			aria-pressed={active}
			class={[
				'cursor-pointer rounded-full border px-3 py-1 text-body-sm font-medium focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-hidden',
				active
					? 'border-brand bg-wash text-brand'
					: 'border-line bg-card text-muted hover:bg-subtle'
			]}
		>
			{filter.label}
		</button>
	{/each}
</form>

<div class="overflow-x-auto rounded-panel border border-line bg-card">
	<table class="w-full text-left text-body-sm">
		<thead class="bg-subtle text-caption text-muted uppercase">
			<tr>
				<th scope="col" class="px-4 py-3 font-medium">Name</th>
				<th scope="col" class="px-4 py-3 font-medium">Status</th>
				<th scope="col" class="px-4 py-3 text-right font-medium">Overall score</th>
			</tr>
		</thead>
		<tbody>
			{#each data.applications as application (application.id)}
				<tr class="h-11 border-t border-line hover:bg-wash">
					<td class="px-4 py-2">
						<a
							href={resolve('/dashboard/(recruiter)/applications/[applicationId]', {
								applicationId: application.id
							})}
							class="font-medium text-ink hover:text-brand"
						>
							{application.name}
						</a>
						<span class="block text-caption text-helper">{application.email}</span>
					</td>
					<td class="px-4 py-2"><StatusBadge status={application.status} /></td>
					<td class="px-4 py-2 text-right font-mono">
						{application.overall_score?.toFixed(1) ?? '—'}
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan="3" class="px-4 py-10 text-center text-muted">
						{data.status
							? `No applicants with status “${labels[data.status]}”.`
							: 'No applicants yet.'}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
