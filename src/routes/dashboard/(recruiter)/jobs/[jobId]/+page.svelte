<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Search from '@lucide/svelte/icons/search';
	import Users from '@lucide/svelte/icons/users';
	import { resolve } from '$app/paths';
	import { navigating, page } from '$app/state';
	import Button from '$lib/components/Button.svelte';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import OverallScore from '$lib/components/OverallScore.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import TableSkeleton from '$lib/components/TableSkeleton.svelte';
	import { formatDate, sessionLabel } from '$lib/components/format';
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
	const jobStatus = { open: 'Open', closed: 'Closed' } as const;

	const COPY = {
		copyLink: 'Copy apply link',
		copied: 'Apply link copied to the clipboard.',
		filterLabel: 'Filter by status',
		noneTitle: 'No applicants yet',
		noneDescription: 'Share the apply link and applications will show up here.',
		noMatchDescription: 'Try another status, or show everyone who applied.',
		showAll: 'Show all applicants',
		loading: 'Loading applicants'
	};

	const filters = $derived([
		{ status: null, label: 'All' },
		...data.statuses.map((status) => ({ status, label: labels[status] }))
	]);
	const count = $derived(data.job.application_count);
	const allHref = $derived(resolve('/dashboard/(recruiter)/jobs/[jobId]', { jobId: data.job.id }));
	// A filter change re-runs this page's load; show the skeleton in place of the rows meanwhile.
	const loading = $derived(navigating.to?.route.id === page.route.id);

	const applicationHref = (applicationId: string) =>
		resolve('/dashboard/(recruiter)/applications/[applicationId]', { applicationId });
</script>

<svelte:head><title>{data.job.title} · Applicants · Talent Scout</title></svelte:head>

{#snippet copyLink(className: string)}
	<CopyButton
		value={data.job.apply_url}
		label={COPY.copyLink}
		icon="link"
		variant="secondary"
		announcement={COPY.copied}
		class={className}
	/>
{/snippet}

{#snippet empty()}
	{#if data.status}
		<EmptyState
			icon={Search}
			title="No {labels[data.status].toLowerCase()} applicants"
			description={COPY.noMatchDescription}
		>
			{#snippet action()}
				<Button href={allHref}>{COPY.showAll}</Button>
			{/snippet}
		</EmptyState>
	{:else}
		<EmptyState icon={Users} title={COPY.noneTitle} description={COPY.noneDescription}>
			{#snippet action()}
				{@render copyLink('')}
			{/snippet}
		</EmptyState>
	{/if}
{/snippet}

<nav aria-label="Breadcrumb" class="text-body-sm">
	<ol class="flex flex-wrap items-center gap-1">
		<li>
			<a href={resolve('/dashboard/(recruiter)/jobs')} class="text-muted hover:text-ink">Jobs</a>
		</li>
		<li aria-hidden="true" class="text-helper"><ChevronRight size={14} /></li>
		<li aria-current="page" class="[overflow-wrap:anywhere] text-ink">{data.job.title}</li>
	</ol>
</nav>

<div class="mt-2 mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
	<div class="min-w-0">
		<h1 class="text-heading-sm [overflow-wrap:anywhere] text-ink">{data.job.title}</h1>
		<p class="mt-1 text-body-sm text-muted">
			<span class="font-mono">{count}</span>
			{count === 1 ? 'applicant' : 'applicants'} · {jobStatus[data.job.status]}
		</p>
	</div>
	{@render copyLink('shrink-0 max-sm:h-11 max-sm:w-full')}
</div>

<!-- A GET form: each pill submits its status, and "All" submits none. -->
<form method="GET" class="mb-4">
	<div
		role="group"
		aria-label={COPY.filterLabel}
		class="-mx-1 flex gap-2 overflow-x-auto p-1 sm:flex-wrap"
	>
		{#each filters as filter (filter.label)}
			{@const active = filter.status === data.status}
			<button
				name={filter.status ? 'status' : undefined}
				value={filter.status ?? undefined}
				aria-pressed={active}
				class={[
					'h-9 shrink-0 cursor-pointer rounded-full border px-3 text-body-sm font-medium whitespace-nowrap focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-hidden sm:h-8',
					active
						? 'border-brand bg-wash text-brand'
						: 'border-line bg-card text-muted hover:bg-subtle'
				]}
			>
				{filter.label}
			</button>
		{/each}
	</div>
</form>

{#if loading}
	<TableSkeleton label={COPY.loading} />
{:else}
	<div class="overflow-x-auto rounded-panel border border-line bg-card max-sm:hidden">
		<table class="w-full text-left text-body-sm">
			<thead class="bg-subtle text-caption text-muted uppercase">
				<tr>
					<th scope="col" class="px-4 py-3 font-medium">Applicant</th>
					<th scope="col" class="px-4 py-3 font-medium">Status</th>
					<th scope="col" class="px-4 py-3 font-medium">Session</th>
					<th scope="col" class="px-4 py-3 text-right font-medium">Overall score</th>
					<th scope="col" class="px-4 py-3 font-medium">Applied</th>
				</tr>
			</thead>
			<tbody>
				{#each data.applications as application (application.id)}
					<tr class="border-t border-line hover:bg-wash">
						<td class="min-w-56 px-4 py-2.5">
							<a
								href={applicationHref(application.id)}
								class="rounded-sm font-medium [overflow-wrap:anywhere] text-ink hover:text-brand focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-hidden"
							>
								{application.name}
							</a>
							<span class="block text-caption [overflow-wrap:anywhere] text-helper"
								>{application.email}</span
							>
						</td>
						<td class="px-4 py-2.5"><StatusBadge status={application.status} /></td>
						<td class="px-4 py-2.5 whitespace-nowrap text-muted">
							{sessionLabel(application.session_status)}
						</td>
						<td class="px-4 py-2.5 text-right">
							<OverallScore score={application.overall_score} />
						</td>
						<td class="px-4 py-2.5 whitespace-nowrap text-muted">
							{formatDate(application.created_at)}
						</td>
					</tr>
				{:else}
					<tr><td colspan="5">{@render empty()}</td></tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Below 640px the table becomes a list: each row is one link with a 44px touch target. -->
	<ul class="overflow-hidden rounded-panel border border-line bg-card sm:hidden">
		{#each data.applications as application (application.id)}
			<li class="border-line not-first:border-t">
				<a
					href={applicationHref(application.id)}
					class="flex min-h-11 items-start justify-between gap-3 px-4 py-3 hover:bg-wash focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-hidden focus-visible:ring-inset"
				>
					<span class="flex min-w-0 flex-col gap-1">
						<span class="font-medium [overflow-wrap:anywhere] text-ink">{application.name}</span>
						<span class="text-caption [overflow-wrap:anywhere] text-helper"
							>{application.email}</span
						>
						<StatusBadge status={application.status} />
					</span>
					<span class="shrink-0 text-right"><OverallScore score={application.overall_score} /></span
					>
				</a>
			</li>
		{:else}
			<li>{@render empty()}</li>
		{/each}
	</ul>
{/if}
