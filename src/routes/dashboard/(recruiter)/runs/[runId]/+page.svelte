<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Check from '@lucide/svelte/icons/check';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Loader from '@lucide/svelte/icons/loader';
	import Pause from '@lucide/svelte/icons/pause';
	import Play from '@lucide/svelte/icons/play';
	import SkipBack from '@lucide/svelte/icons/skip-back';
	import WifiOff from '@lucide/svelte/icons/wifi-off';
	import X from '@lucide/svelte/icons/x';
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Button from '$lib/components/Button.svelte';
	import GraphView from '$lib/components/GraphView.svelte';
	import type { RunEvent } from '$lib/events';
	import { mockRunEvents } from '$lib/mock';
	import type { NodeId } from '$lib/server/api/types';
	import { initialRunState, reduceRun } from '$lib/stores/graph';
	import {
		createRunConnection,
		eventSourceOpener,
		loginSearch,
		mockReplayOpener,
		requestSseToken,
		type ConnectionStatus
	} from '$lib/stores/run-stream';
	import {
		connectionAlertText,
		isRunEnded,
		liveStatusText,
		showConnectionAlert,
		switchMode,
		type ViewMode
	} from '$lib/stores/run-view';
	import EventList from './EventList.svelte';
	import { receivedSeq, runHeader } from './header';
	import NodeDetail from './NodeDetail.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const PLAY_MS = 700;

	let events = $state.raw<RunEvent[]>([]);
	let connection = $state<ConnectionStatus>('connecting');
	// Live for a running run, else Replay at the last event; the effect below resets it per run.
	let mode = $state<ViewMode>(untrack(() => data.run.status) === 'running' ? 'live' : 'replay');
	/** Events shown in Replay; null follows the newest. */
	let position = $state<number | null>(null);
	let playing = $state(false);
	let pinned = $state<NodeId | null>(null);
	let reconnect = $state<(() => Promise<void>) | null>(null);

	const initial = $derived(initialRunState(data.run));
	const full = $derived(reduceRun(initial, events));
	const shownCount = $derived(mode === 'live' ? events.length : (position ?? events.length));
	const shown = $derived(events.slice(0, shownCount));
	const run = $derived(reduceRun(initial, shown));
	const ended = $derived(isRunEnded(data.run.status, full.status, connection));
	const lastSeq = $derived(receivedSeq(events));
	const header = $derived(runHeader(run));
	const detailId = $derived(pinned ?? run.activeNodeId ?? 'planner');
	const loading = $derived(events.length === 0 && !showConnectionAlert(connection));

	const backHref = $derived(
		data.from
			? resolve('/dashboard/(recruiter)/applications/[applicationId]', { applicationId: data.from })
			: resolve('/dashboard/(recruiter)/jobs')
	);

	$effect(() => {
		const { run: snapshot, stream } = data;
		events = [];
		position = null;
		pinned = null;
		mode = snapshot.status === 'running' ? 'live' : 'replay';
		const append = (event: RunEvent) => (events = [...events, event]);

		const live = createRunConnection({
			// Mock mode: a running run arrives gradually, an ended one is already complete.
			openStream: stream
				? eventSourceOpener(stream.url)
				: mockReplayOpener(mockRunEvents[snapshot.id] ?? [], {
						gradual: snapshot.status === 'running'
					}),
			mintToken: () =>
				requestSseToken(
					resolve('/dashboard/(recruiter)/runs/[runId]/sse-token', { runId: snapshot.id })
				),
			onEvent: append,
			onStatus: (status) => (connection = status),
			// A full load: the session is gone, so nothing on this page is worth keeping.
			onSignedOut: () =>
				location.assign(
					`${resolve('/dashboard/login')}?${loginSearch(page.url.pathname + page.url.search)}`
				)
		});
		// The mock opener delivers an ended run synchronously; `append` reads `events`.
		untrack(() => live.open(stream?.sse_token ?? '', 0));
		reconnect = live.reconnect;
		return live.close;
	});

	$effect(() => {
		if (!playing) return;
		const timer = setInterval(() => {
			const next = (position ?? events.length) + 1;
			if (next >= events.length) {
				position = events.length;
				playing = false;
			} else position = next;
		}, PLAY_MS);
		return () => clearInterval(timer);
	});

	function setMode(requested: ViewMode) {
		const next = switchMode(requested, { ended, eventCount: events.length });
		if (!next) return;
		({ mode, position } = next);
		playing = false;
	}

	function seek(to: number) {
		position = Math.min(Math.max(to, 1), events.length);
		pinned = null;
	}

	function togglePlay() {
		if (!playing && shownCount >= events.length) position = 1;
		playing = !playing;
	}

	function pickEvent(event: RunEvent, index: number) {
		if (mode === 'replay') {
			playing = false;
			seek(index + 1);
		} else if (event.node_id) pinned = event.node_id;
	}

	let reconnecting = $derived(connection === 'reconnecting');

	const dateTime = new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		timeZone: 'UTC'
	});
	const startedLabel = $derived(
		full.startedAt ? `${dateTime.format(new Date(full.startedAt))} UTC` : null
	);
	const statusBadge = $derived(
		header.status === 'running'
			? { label: 'Running', icon: Loader, cls: 'bg-wash text-brand', spin: true }
			: header.status === 'succeeded'
				? { label: 'Succeeded', icon: Check, cls: 'bg-success/10 text-success-text', spin: false }
				: { label: 'Failed', icon: X, cls: 'bg-danger/10 text-danger-text', spin: false }
	);
	const skeleton = 'inline-block rounded-full bg-subtle align-middle motion-safe:animate-pulse';
	const pressed = 'bg-card text-ink shadow-card';
	const iconButton =
		'inline-flex size-9 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-subtle focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-hidden disabled:cursor-not-allowed disabled:text-helper';
</script>

<svelte:head><title>Graph run · Talent Scout</title></svelte:head>

<div>
	<header class="border-b border-line bg-card px-6 pt-3 pb-4">
		<a
			href={backHref}
			class="inline-flex items-center gap-1 rounded-sm text-body-sm font-medium text-brand hover:underline focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-hidden"
		>
			<ArrowLeft size={16} aria-hidden="true" />
			{data.from ? 'Application review' : 'Jobs'}
		</a>
		<div class="mt-2 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
			<div class="min-w-0">
				<div class="flex flex-wrap items-center gap-2">
					<h1 class="text-heading-sm font-semibold text-ink">Graph run</h1>
					<span class="font-mono text-body-sm text-muted">{data.run.id.slice(0, 8)}</span>
					{#if loading}
						<span aria-hidden="true" class={[skeleton, 'h-6 w-20']}></span>
					{:else}
						<span
							class={[
								'inline-flex items-center gap-1 rounded-full px-2 py-1 text-caption font-medium',
								statusBadge.cls
							]}
						>
							<statusBadge.icon
								size={12}
								aria-hidden="true"
								class={statusBadge.spin ? 'motion-safe:animate-spin' : ''}
							/>
							{statusBadge.label}
						</span>
					{/if}
				</div>
				<p class="mt-1 text-body-sm text-muted">
					Session <span class="font-mono">{data.run.session_id.slice(0, 8)}</span>{#if startedLabel}
						· started {startedLabel}{/if}
				</p>
			</div>
			<dl class="flex flex-wrap gap-x-6 gap-y-1 text-body-sm">
				<div class="flex gap-1.5">
					<dt class="text-muted">Cost</dt>
					<dd class="font-mono text-ink">
						{#if loading}<span aria-hidden="true" class={[skeleton, 'h-4 w-16']}
							></span>{:else}{header.cost}{/if}
					</dd>
				</div>
				<div class="flex gap-1.5">
					<dt class="text-muted">Tokens</dt>
					<dd class="font-mono text-ink">
						{#if loading}<span aria-hidden="true" class={[skeleton, 'h-4 w-28']}
							></span>{:else}{header.tokens}{/if}
					</dd>
				</div>
			</dl>
		</div>

		<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
			<div class="inline-flex rounded-full bg-subtle p-1" role="group" aria-label="View mode">
				<button
					type="button"
					aria-pressed={mode === 'live'}
					aria-describedby={ended ? 'live-ended' : undefined}
					disabled={ended}
					onclick={() => setMode('live')}
					class={[
						'inline-flex h-8 cursor-pointer items-center gap-2 rounded-full px-3 text-body-sm font-medium focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-hidden disabled:cursor-not-allowed',
						mode === 'live' ? pressed : 'text-muted'
					]}
				>
					<span
						aria-hidden="true"
						class={[
							'size-2 rounded-full',
							!ended && connection === 'live'
								? 'bg-brand-soft motion-safe:animate-pulse'
								: 'bg-helper'
						]}
					></span>
					Live
				</button>
				<button
					type="button"
					aria-pressed={mode === 'replay'}
					onclick={() => setMode('replay')}
					class={[
						'inline-flex h-8 cursor-pointer items-center rounded-full px-3 text-body-sm font-medium focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-hidden',
						mode === 'replay' ? pressed : 'text-muted'
					]}>Replay</button
				>
			</div>
			{#if ended}
				<p id="live-ended" class="text-caption text-muted">
					The run has ended, so only replay is available.
				</p>
			{/if}

			{#if mode === 'replay'}
				<div class="flex flex-wrap items-center gap-3">
					<div class="flex items-center gap-1">
						<button
							type="button"
							aria-label="First event"
							class={iconButton}
							disabled={shownCount <= 1}
							onclick={() => seek(1)}><SkipBack size={18} aria-hidden="true" /></button
						>
						<button
							type="button"
							aria-label="Previous event"
							class={iconButton}
							disabled={shownCount <= 1}
							onclick={() => seek(shownCount - 1)}
							><ChevronLeft size={18} aria-hidden="true" /></button
						>
						<button
							type="button"
							aria-label={playing ? 'Pause' : 'Play'}
							disabled={events.length === 0}
							onclick={togglePlay}
							class="inline-flex size-9 cursor-pointer items-center justify-center rounded-full bg-brand text-card hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:bg-subtle disabled:text-helper"
						>
							{#if playing}<Pause size={16} fill="currentColor" aria-hidden="true" />{:else}<Play
									size={16}
									fill="currentColor"
									aria-hidden="true"
								/>{/if}
						</button>
						<button
							type="button"
							aria-label="Next event"
							class={iconButton}
							disabled={shownCount >= events.length}
							onclick={() => seek(shownCount + 1)}
							><ChevronRight size={18} aria-hidden="true" /></button
						>
					</div>
					<label class="sr-only" for="replay-position">Replay position</label>
					<input
						id="replay-position"
						type="range"
						min="1"
						max={Math.max(events.length, 1)}
						value={shownCount}
						disabled={events.length === 0}
						oninput={(e) => {
							playing = false;
							seek(Number(e.currentTarget.value));
						}}
						class="w-40 accent-brand"
					/>
					<span class="text-caption text-muted">
						Event <span class="font-mono">{shown.at(-1)?.seq ?? 0}</span> of
						<span class="font-mono">{lastSeq}</span>
					</span>
				</div>
			{:else}
				<p role="status" class="text-caption text-muted">
					{liveStatusText(connection, ended, lastSeq)}
				</p>
			{/if}
		</div>
	</header>

	{#if showConnectionAlert(connection)}
		<div
			role="alert"
			class="flex flex-wrap items-center gap-3 border-b border-warning bg-card px-6 py-3 text-body-sm"
		>
			<span class="-mx-6 -my-3 flex flex-1 flex-wrap items-center gap-3 bg-warning/10 px-6 py-3">
				<WifiOff size={16} aria-hidden="true" class="shrink-0 text-warning-text" />
				<span class="min-w-0 flex-1 text-body">
					{connectionAlertText(mode, lastSeq)}
				</span>
				<Button size="sm" loading={reconnecting} onclick={() => reconnect?.()}>
					{reconnecting ? 'Reconnecting…' : 'Reconnect'}
				</Button>
			</span>
		</div>
	{/if}
	{#if run.status === 'failed'}
		<div role="alert" class="border-b border-danger bg-card text-body-sm">
			<p class="flex items-center gap-2 bg-danger/10 px-6 py-3 text-danger-text">
				<X size={16} aria-hidden="true" class="shrink-0" />
				<span class="[overflow-wrap:anywhere]">
					The run failed with <code class="font-mono">{run.error}</code>. The nodes after it were
					skipped.
				</span>
			</p>
		</div>
	{/if}

	<div class="flex flex-wrap">
		<section aria-label="Graph" class="min-w-0 shrink grow-[999] basis-[640px] bg-wash pt-6">
			{#if loading}
				<div role="status" aria-label="Loading graph run" class="overflow-x-auto">
					<div class="relative mx-auto h-[400px] w-[1072px]">
						{#each [40, 304, 568, 832] as x (x)}
							{#each [96, 288] as y (y)}
								<span
									class="absolute h-16 w-[200px] rounded-panel bg-subtle motion-safe:animate-pulse"
									style:left="{x}px"
									style:top="{y}px"
								></span>
							{/each}
						{/each}
					</div>
				</div>
			{:else}
				<GraphView {run} selectedId={pinned} onselect={(id) => (pinned = id)} />
			{/if}
		</section>
		<aside
			class="flex max-h-[calc(100dvh-3.5rem)] min-w-0 grow basis-[360px] flex-col border-l border-line bg-card"
		>
			{#if loading}
				<div class="flex flex-col gap-3 p-6" aria-hidden="true">
					{#each [48, 32, 64, 40, 56] as w (w)}
						<span class="h-4 rounded-full bg-subtle motion-safe:animate-pulse" style:width="{w}%"
						></span>
					{/each}
				</div>
			{:else}
				<NodeDetail
					node={run.nodes[detailId]}
					pinned={pinned !== null}
					applicationId={data.from}
					onfollow={() => (pinned = null)}
				/>
				<EventList events={shown} startedAt={full.startedAt} onpick={pickEvent} />
			{/if}
		</aside>
	</div>
</div>
