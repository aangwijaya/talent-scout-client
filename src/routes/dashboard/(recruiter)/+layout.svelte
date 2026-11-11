<script lang="ts">
	import LogOut from '@lucide/svelte/icons/log-out';
	import { resolve } from '$app/paths';
	import { navigating, page } from '$app/state';
	import type { Snippet } from 'svelte';
	import Logo from '$lib/components/Logo.svelte';
	import TableSkeleton from '$lib/components/TableSkeleton.svelte';

	let { children }: { children: Snippet } = $props();

	const JOBS_ROUTES = ['/dashboard/(recruiter)/jobs', '/dashboard/(recruiter)/jobs/[jobId]'];

	const jobsActive = $derived(page.url.pathname.startsWith('/dashboard/jobs'));
	// Moving to another table page: show its skeleton until the load returns. A filter change on
	// the same page is handled by the page itself, which keeps its header.
	const loadingTable = $derived(
		navigating.to?.route.id != null &&
			navigating.to.route.id !== page.route.id &&
			JOBS_ROUTES.includes(navigating.to.route.id)
	);

	// The graph run page spans the whole window; every other page keeps the 1200px column.
	const fullWidth = $derived(page.route.id === '/dashboard/(recruiter)/runs/[runId]');

	const touch = 'max-sm:min-h-11 max-sm:min-w-11';
</script>

<div class="min-h-dvh bg-canvas">
	<header class="h-14 border-b border-line bg-card">
		<nav
			aria-label="Main"
			class="mx-auto flex h-full max-w-[1200px] items-center gap-2 px-4 sm:gap-6 sm:px-6"
		>
			<a
				href={resolve('/dashboard/(recruiter)/jobs')}
				class={[
					'flex items-center rounded-full focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:outline-hidden',
					touch
				]}
			>
				<Logo />
			</a>
			<a
				href={resolve('/dashboard/(recruiter)/jobs')}
				aria-current={jobsActive ? 'page' : undefined}
				class={[
					'flex h-8 items-center justify-center rounded-full px-3 text-body-sm font-medium focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:outline-hidden',
					touch,
					jobsActive ? 'bg-wash text-brand' : 'text-muted hover:bg-subtle hover:text-ink'
				]}>Jobs</a
			>
			<form method="POST" action="/dashboard/logout" class="ml-auto">
				<button
					type="submit"
					aria-label="Log out"
					class={[
						'flex h-9 cursor-pointer items-center justify-center gap-2 rounded-full px-3 text-body-sm font-medium text-muted hover:bg-subtle focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:outline-hidden',
						touch
					]}
				>
					<LogOut size={16} aria-hidden="true" />
					<span class="max-sm:hidden">Log out</span>
				</button>
			</form>
		</nav>
	</header>
	<main class={fullWidth ? '' : 'mx-auto max-w-[1200px] p-4 sm:p-6'}>
		{#if loadingTable}
			<div class="mb-6 flex flex-col gap-2" aria-hidden="true">
				<span class="block h-7 w-48 rounded-full bg-subtle motion-safe:animate-pulse"></span>
				<span class="block h-4 w-72 max-w-full rounded-full bg-subtle motion-safe:animate-pulse"
				></span>
			</div>
			<TableSkeleton label="Loading" />
		{:else}
			{@render children()}
		{/if}
	</main>
</div>
