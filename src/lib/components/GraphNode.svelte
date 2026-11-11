<script lang="ts" module>
	import type { NodeId } from '$lib/server/api/types';
	import type { NodeState } from '$lib/stores/graph';

	export type GraphNodeData = {
		node: NodeState;
		selected: boolean;
		onselect: (id: NodeId) => void;
	};
</script>

<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import Check from '@lucide/svelte/icons/check';
	import Circle from '@lucide/svelte/icons/circle';
	import Code from '@lucide/svelte/icons/code';
	import Loader from '@lucide/svelte/icons/loader';
	import Minus from '@lucide/svelte/icons/minus';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import UserCheck from '@lucide/svelte/icons/user-check';
	import X from '@lucide/svelte/icons/x';
	import { NODE_NAMES, NODE_TYPE_LABELS, shortModel, statusLabel } from './graph-layout';

	let { data }: { data: GraphNodeData } = $props();

	const node = $derived(data.node);
	const isCode = $derived(node.type === 'code');
	const label = $derived(statusLabel(node));

	// DESIGN.md §2.2 with the 2026-11-11 changes. Tints sit on the `bg-card` base below, so the
	// fills are opaque over the `wash` canvas.
	const styles = {
		idle: { box: 'border border-line', text: 'text-helper', icon: 'text-helper' },
		running: {
			box: 'border-2 border-brand bg-wash shadow-glow',
			text: 'text-brand',
			icon: 'text-brand'
		},
		passed: {
			box: 'border border-success bg-success/10',
			text: 'text-success-text',
			icon: 'text-success-text'
		},
		failed: {
			box: 'border border-danger bg-danger/10',
			text: 'text-danger-text',
			icon: 'text-danger-text'
		},
		retry: {
			box: 'border-2 border-dashed border-warning bg-warning/10',
			text: 'text-warning-text',
			icon: 'text-warning-text'
		},
		skipped: {
			box: 'border border-dashed border-helper bg-subtle',
			text: 'text-muted',
			icon: 'text-muted'
		},
		gate: { box: 'border border-brand', text: 'text-brand', icon: 'text-brand' }
	};
	const icons = {
		idle: Circle,
		running: Loader,
		passed: Check,
		failed: X,
		retry: RotateCcw,
		skipped: Minus,
		gate: UserCheck
	};

	const style = $derived(styles[node.visual]);
	const Icon = $derived(node.type === 'human_gate' ? UserCheck : icons[node.visual]);
	const model = $derived(isCode ? 'no model' : node.model ? shortModel(node.model) : null);
	const ariaLabel = $derived(
		[
			NODE_NAMES[node.id],
			NODE_TYPE_LABELS[node.type],
			label,
			node.retryBadge ? `attempt ${node.retryBadge}` : null
		]
			.filter(Boolean)
			.join(', ')
	);
</script>

<Handle type="target" position={Position.Left} class="!invisible" />
<Handle type="source" position={Position.Right} class="!invisible" />
<button
	type="button"
	aria-pressed={data.selected}
	aria-label={ariaLabel}
	onclick={() => data.onselect(node.id)}
	class={[
		'relative block h-16 w-[200px] cursor-pointer rounded-panel bg-card text-left shadow-card outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
		data.selected && 'ring-2 ring-ink ring-offset-2'
	]}
>
	<span
		class={[
			'flex h-full flex-col justify-center gap-0.5 rounded-panel px-3',
			style.box,
			isCode && 'border-dashed'
		]}
	>
		<span class="flex items-center gap-1.5">
			<Icon
				size={16}
				aria-hidden="true"
				class={[style.icon, 'shrink-0', node.visual === 'running' && 'motion-safe:animate-spin']}
			/>
			<span class="truncate text-body-sm font-semibold text-ink">{NODE_NAMES[node.id]}</span>
			{#if isCode}<Code size={12} aria-hidden="true" class="shrink-0 text-muted" />{/if}
		</span>
		<span class="truncate text-caption text-muted">
			<span class={['font-medium', style.text]}>{label}</span>
			· {NODE_TYPE_LABELS[node.type]}{#if model}
				· <span class="font-mono">{model}</span>{/if}
		</span>
	</span>
	{#if node.retryBadge}
		<span class="absolute -top-2 -right-2 rounded-full bg-card" aria-hidden="true">
			<span
				class="block rounded-full border border-warning bg-warning/10 px-1.5 font-mono text-caption text-warning-text"
				>×{node.retryBadge}</span
			>
		</span>
	{/if}
</button>
