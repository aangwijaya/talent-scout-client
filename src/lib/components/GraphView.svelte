<script lang="ts">
	import { SvelteFlow, type Edge, type Node } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/base.css';
	import Check from '@lucide/svelte/icons/check';
	import Circle from '@lucide/svelte/icons/circle';
	import Loader from '@lucide/svelte/icons/loader';
	import Minus from '@lucide/svelte/icons/minus';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import X from '@lucide/svelte/icons/x';
	import type { NodeId } from '$lib/server/api/types';
	import type { RunState } from '$lib/stores/graph';
	import GraphEdge, { type GraphEdgeData } from './GraphEdge.svelte';
	import GraphNode, { type GraphNodeData } from './GraphNode.svelte';
	import {
		CANVAS_HEIGHT,
		CANVAS_WIDTH,
		EDGE_GEOMETRY,
		NODE_HEIGHT,
		NODE_POSITIONS,
		NODE_WIDTH
	} from './graph-layout';

	type Props = { run: RunState; selectedId: NodeId | null; onselect: (id: NodeId) => void };

	let { run, selectedId, onselect }: Props = $props();

	const nodeTypes = { status: GraphNode };
	const edgeTypes = { fixed: GraphEdge };

	const nodes = $derived(
		Object.values(run.nodes).map((node): Node<GraphNodeData> => ({
			id: node.id,
			type: 'status',
			position: NODE_POSITIONS[node.id],
			width: NODE_WIDTH,
			height: NODE_HEIGHT,
			data: { node, selected: node.id === selectedId, onselect },
			draggable: false,
			connectable: false,
			selectable: false
		}))
	);
	const edges = $derived(
		run.edges.flatMap((edge): Edge<GraphEdgeData>[] => {
			const geometry = EDGE_GEOMETRY[edge.id];
			if (!geometry) return [];
			return [
				{
					id: edge.id,
					source: edge.from,
					target: edge.to,
					type: 'fixed',
					data: {
						geometry,
						taken: edge.taken,
						latest: edge.id === run.latestEdgeId,
						retryPath: edge.retryPath
					},
					selectable: false,
					focusable: false
				}
			];
		})
	);

	const legend = [
		{ label: 'Idle', icon: Circle, chip: 'border-line', icn: 'text-helper' },
		{ label: 'Running', icon: Loader, chip: 'border-brand bg-wash', icn: 'text-brand' },
		{
			label: 'Passed',
			icon: Check,
			chip: 'border-success bg-success/10',
			icn: 'text-success-text'
		},
		{
			label: 'Retry',
			icon: RotateCcw,
			chip: 'border-dashed border-warning bg-warning/10',
			icn: 'text-warning-text'
		},
		{ label: 'Failed', icon: X, chip: 'border-danger bg-danger/10', icn: 'text-danger-text' },
		{
			label: 'Skipped',
			icon: Minus,
			chip: 'border-dashed border-helper bg-subtle',
			icn: 'text-muted'
		}
	];
	const lines = [
		{ label: 'Not taken yet', cls: 'border-helper border-t-[1.5px]' },
		{ label: 'Taken', cls: 'border-brand-soft border-t-2' },
		{ label: 'Latest', cls: 'border-brand border-t-[2.5px]' },
		{ label: 'Retry path', cls: 'border-warning border-t-2 border-dashed' }
	];
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- The canvas keeps 100% zoom, so on narrow screens keyboard users scroll it sideways. -->
<div
	role="region"
	aria-label="Graph of the run. The event list is a text version."
	tabindex="0"
	class="overflow-x-auto outline-hidden focus-visible:ring-2 focus-visible:ring-focus"
>
	<div class="mx-auto" style:width="{CANVAS_WIDTH}px" style:height="{CANVAS_HEIGHT}px">
		<SvelteFlow
			{nodes}
			{edges}
			{nodeTypes}
			{edgeTypes}
			initialViewport={{ x: 0, y: 0, zoom: 1 }}
			proOptions={{ hideAttribution: true }}
			minZoom={1}
			maxZoom={1}
			translateExtent={[
				[0, 0],
				[CANVAS_WIDTH, CANVAS_HEIGHT]
			]}
			nodesDraggable={false}
			nodesConnectable={false}
			elementsSelectable={false}
			nodesFocusable={false}
			edgesFocusable={false}
			zoomOnScroll={false}
			zoomOnPinch={false}
			zoomOnDoubleClick={false}
			preventScrolling={false}
			style="background: transparent"
		/>
	</div>
</div>

<div class="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 pb-4 text-caption text-muted">
	{#each legend as item (item.label)}
		<span class="inline-flex items-center gap-1 rounded-full bg-card">
			<span class={['inline-flex items-center gap-1 rounded-full border px-2', item.chip]}>
				<item.icon size={12} aria-hidden="true" class={item.icn} />
				{item.label}
			</span>
		</span>
	{/each}
	{#each lines as line (line.label)}
		<span class="inline-flex items-center gap-1.5">
			<span class={['inline-block w-6', line.cls]} aria-hidden="true"></span>
			{line.label}
		</span>
	{/each}
</div>
