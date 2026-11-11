<script lang="ts" module>
	import type { EdgeGeometry } from './graph-layout';

	export type GraphEdgeData = {
		geometry: EdgeGeometry;
		taken: boolean;
		latest: boolean;
		retryPath: boolean;
	};
</script>

<script lang="ts">
	// Draws its own fixed path from `graph-layout.ts` instead of xyflow's handle positions, so the
	// interviewer self-loop and the paired loops never overlap a node or each other.
	let { id, data }: { id: string; data?: GraphEdgeData } = $props();

	const state = $derived(data?.latest ? 'latest' : data?.taken ? 'taken' : 'idle');
	const markerId = $derived(`arrow-${id.replace(/[^a-z_]/g, '-')}`);
</script>

{#if data}
	<defs>
		<marker
			id={markerId}
			viewBox="0 0 10 10"
			refX="9"
			refY="5"
			markerWidth="8"
			markerHeight="8"
			markerUnits="userSpaceOnUse"
			orient="auto-start-reverse"
		>
			<path
				d="M0,0 L10,5 L0,10 z"
				class="graph-edge-head"
				data-state={state}
				data-retry={data.retryPath}
			/>
		</marker>
	</defs>
	<path
		d={data.geometry.path}
		fill="none"
		marker-end="url(#{markerId})"
		class="graph-edge"
		data-edge={id}
		data-state={state}
		data-retry={data.retryPath}
	/>
	<foreignObject
		x={data.geometry.labelX - 80}
		y={data.geometry.labelY - 11}
		width="160"
		height="22"
		class="pointer-events-none overflow-visible"
	>
		<div class="flex h-full items-center justify-center">
			<span
				class="rounded-full border border-line bg-card px-2 font-sans text-caption leading-[18px] whitespace-nowrap text-muted"
				>{data.geometry.label}</span
			>
		</div>
	</foreignObject>
{/if}

<style>
	.graph-edge {
		stroke: var(--color-helper);
		stroke-width: 1.5px;
	}
	.graph-edge-head {
		fill: var(--color-helper);
	}
	.graph-edge[data-retry='true'] {
		stroke: var(--color-warning);
		stroke-dasharray: 6 4;
	}
	.graph-edge-head[data-retry='true'] {
		fill: var(--color-warning);
	}
	.graph-edge[data-state='taken'] {
		stroke: var(--color-brand-soft);
		stroke-width: 2px;
	}
	.graph-edge-head[data-state='taken'] {
		fill: var(--color-brand-soft);
	}
	.graph-edge[data-state='latest'] {
		stroke: var(--color-brand);
		stroke-width: 2.5px;
		stroke-dasharray: 6 4;
	}
	.graph-edge-head[data-state='latest'] {
		fill: var(--color-brand);
	}
	@media (prefers-reduced-motion: no-preference) {
		.graph-edge[data-state='latest'] {
			animation: graph-edge-dash 600ms linear infinite;
		}
	}
	@keyframes graph-edge-dash {
		to {
			stroke-dashoffset: -10;
		}
	}
</style>
