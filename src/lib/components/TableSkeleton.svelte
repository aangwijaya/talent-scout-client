<script lang="ts">
	type Props = { label: string; rows?: number };

	let { label, rows = 3 }: Props = $props();

	const block = 'block rounded-full bg-subtle motion-safe:animate-pulse';
</script>

<!-- Sized like the real cells: name over email, a badge, a score (DESIGN.md §3 loading state). -->
<div
	aria-busy="true"
	aria-label={label}
	role="status"
	class="overflow-hidden rounded-panel border border-line bg-card"
>
	<div class="h-10 bg-subtle"></div>
	{#each { length: rows }, row (row)}
		<div class="flex min-h-11 items-center gap-6 border-t border-line px-4 py-3">
			<div class="flex min-w-0 flex-1 flex-col gap-2">
				<span class={[block, 'h-3.5 w-40 max-w-full']}></span>
				<span class={[block, 'h-3 w-56 max-w-full']}></span>
			</div>
			<span class={[block, 'h-6 w-20']}></span>
			<span class={[block, 'h-3.5 w-14 max-sm:hidden']}></span>
		</div>
	{/each}
</div>
