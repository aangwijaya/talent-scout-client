<script lang="ts">
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/Button.svelte';
	import {
		NODE_NAMES,
		NODE_TYPE_LABELS,
		formatCount,
		formatDuration,
		formatNodeCost,
		statusLabel
	} from '$lib/components/graph-layout';
	import type { NodeState } from '$lib/stores/graph';

	type Props = {
		node: NodeState;
		pinned: boolean;
		/** The application the recruiter came from (`?from=`), for the human gate's link. */
		applicationId: string | null;
		onfollow: () => void;
	};

	let { node, pinned, applicationId, onfollow }: Props = $props();

	const isCode = $derived(node.type === 'code');
	const isGate = $derived(node.type === 'human_gate');
	const badge = {
		idle: 'bg-subtle text-muted',
		running: 'bg-wash text-brand',
		passed: 'bg-success/10 text-success-text',
		failed: 'bg-danger/10 text-danger-text',
		retry: 'bg-warning/10 text-warning-text',
		skipped: 'bg-subtle text-muted',
		gate: 'bg-wash text-brand'
	};
	const dot = {
		idle: 'bg-helper',
		running: 'bg-brand',
		passed: 'bg-success',
		failed: 'bg-danger',
		retry: 'bg-warning',
		skipped: 'bg-helper',
		gate: 'bg-brand'
	};
	const nodeName = (id: string) => NODE_NAMES[id as keyof typeof NODE_NAMES] ?? id;
</script>

<section aria-labelledby="node-detail-title" class="border-b border-line p-6">
	<div class="flex flex-wrap items-start justify-between gap-2">
		<div class="min-w-0">
			<h2 id="node-detail-title" class="text-subheading font-semibold text-ink">
				{NODE_NAMES[node.id]}
			</h2>
			<p class="text-caption text-muted">
				<span class="font-mono">{node.id}</span> · {NODE_TYPE_LABELS[node.type]}
			</p>
		</div>
		<span
			class={[
				'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-caption font-medium',
				badge[node.visual]
			]}
		>
			<span class={['size-1.5 rounded-full', dot[node.visual]]} aria-hidden="true"></span>
			{statusLabel(node)}
		</span>
	</div>

	{#if pinned}
		<Button size="sm" class="mt-3" onclick={onfollow}>Follow the active node</Button>
	{:else}
		<p class="mt-3 text-caption text-muted">
			Following the active node. Select a node to pin it here.
		</p>
	{/if}

	{#if node.visual === 'retry'}
		<p
			class="mt-3 flex gap-2 rounded-card border border-warning bg-warning/10 p-3 text-body-sm [overflow-wrap:anywhere] text-warning-text"
		>
			<TriangleAlert size={16} aria-hidden="true" class="mt-0.5 shrink-0" />
			<span>
				{nodeName(node.id === 'planner' ? 'plan_check' : 'evidence_check')} sent this node back: {node.retryReason}.
				Attempt {node.attempt} of {node.maxAttempts} starts next.
			</span>
		</p>
	{:else if node.defaultedVerdict}
		<p
			class="mt-3 flex gap-2 rounded-card border border-warning bg-warning/10 p-3 text-body-sm text-warning-text"
		>
			<TriangleAlert size={16} aria-hidden="true" class="mt-0.5 shrink-0" />
			<span>
				The judge failed after its retry, so the run went on with the safe default verdict:
				sufficient.
			</span>
		</p>
	{/if}

	{#if isGate}
		<p class="mt-3 text-body-sm text-muted">
			{#if node.visual === 'gate'}
				Scoring is done. The application is waiting for your decision.
			{:else}
				This human gate records no events. It opens after evidence check passes, and you decide on
				the application review page.
			{/if}
		</p>
		{#if applicationId}
			<a
				href={resolve('/dashboard/(recruiter)/applications/[applicationId]', { applicationId })}
				class="mt-2 inline-block rounded-sm text-body-sm font-medium text-brand hover:underline focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-hidden"
				>Open the application review →</a
			>
		{/if}
	{:else if node.visual === 'idle'}
		<p class="mt-3 text-body-sm text-muted">Not run yet.</p>
	{:else if node.visual === 'skipped'}
		<p class="mt-3 text-body-sm text-muted">
			Skipped: the run ended before this node ({node.skipReason}).
		</p>
	{/if}

	{#if !isGate && node.runs > 0}
		<dl class="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body-sm">
			<dt class="text-muted">Model</dt>
			<dd class="[overflow-wrap:anywhere] text-body">
				{#if isCode}Code node, no model{:else}<span class="font-mono">{node.model ?? '—'}</span
					>{/if}
			</dd>
			<dt class="text-muted">Attempt</dt>
			<dd class="text-body">
				{node.attempt ?? 1}{#if node.maxAttempts}&nbsp;of {node.maxAttempts}{/if}
			</dd>
			{#if node.runs > 1}
				<dt class="text-muted">Runs so far</dt>
				<dd class="text-body">{node.runs}</dd>
			{/if}
			{#if !isCode && node.tokensIn !== null && node.tokensOut !== null}
				<dt class="text-muted">Tokens</dt>
				<dd class="font-mono text-body">
					{formatCount(node.tokensIn)} in · {formatCount(node.tokensOut)} out
				</dd>
			{/if}
			<dt class="text-muted">Duration</dt>
			<dd class="font-mono text-body">
				{node.visual === 'running'
					? 'running…'
					: node.durationMs !== null
						? formatDuration(node.durationMs)
						: '—'}
			</dd>
			{#if !isCode && node.costUsd !== null}
				<dt class="text-muted">Cost</dt>
				<dd class="font-mono text-body">{formatNodeCost(node.costUsd)}</dd>
			{/if}
			{#if node.inputSummary}
				<dt class="text-muted">Input</dt>
				<dd class="[overflow-wrap:anywhere] text-body">{node.inputSummary}</dd>
			{/if}
			{#if node.outputSummary}
				<dt class="text-muted">Output</dt>
				<dd class="[overflow-wrap:anywhere] text-body">{node.outputSummary}</dd>
			{/if}
			{#if node.error}
				<dt class="text-muted">Error</dt>
				<dd class="font-mono [overflow-wrap:anywhere] text-danger-text">{node.error}</dd>
			{/if}
		</dl>
	{/if}
</section>
