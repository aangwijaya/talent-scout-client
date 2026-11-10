<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import Button from '$lib/components/Button.svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="min-h-dvh bg-canvas">
	<header class="h-14 border-b border-line bg-card">
		<nav class="mx-auto flex h-full max-w-[1200px] items-center gap-6 px-6">
			<a href={resolve('/dashboard/(recruiter)/jobs')} class="font-semibold text-ink"
				>Talent Scout</a
			>
			<a
				href={resolve('/dashboard/(recruiter)/jobs')}
				class="text-body-sm text-muted hover:text-ink">Jobs</a
			>
			<form method="POST" action="/dashboard/logout" class="ml-auto">
				<Button type="submit">Log out</Button>
			</form>
		</nav>
	</header>
	<main class="mx-auto max-w-[1200px] p-6">
		{@render children()}
	</main>
</div>
