<script lang="ts">
	import { formatScore } from './format';

	let { score }: { score: number | null } = $props();

	const value = $derived(formatScore(score));
</script>

{#if value === null}
	<span class="font-mono text-muted">—</span>
{:else}
	<span class="whitespace-nowrap">
		<span class="font-mono text-ink">{value}</span>
		<span class="text-caption text-muted">/ 5</span>
	</span>
{/if}
