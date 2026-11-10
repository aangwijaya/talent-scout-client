<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import FileText from '@lucide/svelte/icons/file-text';
	import Link from '@lucide/svelte/icons/link';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import Network from '@lucide/svelte/icons/network';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import X from '@lucide/svelte/icons/x';
	import { tick } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/Button.svelte';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import ScoreCard from '$lib/components/ScoreCard.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import Transcript from '$lib/components/Transcript.svelte';
	import { formatDate, formatScore } from '$lib/components/format';
	import {
		canDecide,
		canGetInvite,
		firstName,
		formatCost,
		manualReviewNote,
		minutesSince,
		relativeTime,
		sessionMeta
	} from '$lib/components/review';
	import type { DecisionValue } from '$lib/server/api/types';
	import type { PageProps } from './$types';

	const NOTE_MAX = 1000;
	const HIGHLIGHT_MS = 2000;

	let { data, form }: PageProps = $props();

	const detail = $derived(data.detail);
	const application = $derived(detail.application);
	const name = $derived(firstName(application.name));
	const status = $derived(form?.status ?? application.status);
	const decision = $derived(form?.decision ?? detail.decision);
	const invite = $derived(form?.invite);
	const graphRun = $derived(detail.graph_run);
	const now = Date.now();

	const scoreByKey = $derived(new Map(detail.scores.map((score) => [score.rubric_key, score])));
	const manualCount = $derived(
		canDecide(status)
			? detail.job.rubric.filter(({ key }) => scoreByKey.get(key)?.status !== 'valid').length
			: 0
	);
	const showScores = $derived(canDecide(status) || status === 'scoring');
	const hasTranscript = $derived(detail.messages.length > 0);
	const sessionLine = $derived(sessionMeta(detail.session));

	const runHref = $derived(
		graphRun ? resolve('/dashboard/(recruiter)/runs/[runId]', { runId: graphRun.id }) : null
	);
	const cvHref = $derived(
		resolve('/dashboard/(recruiter)/applications/[applicationId]/cv', {
			applicationId: application.id
		})
	);
	const selfHref = $derived(
		resolve('/dashboard/(recruiter)/applications/[applicationId]', {
			applicationId: application.id
		})
	);

	let panel = $state<DecisionValue | null>(null);
	let note = $state('');
	let deciding = $state(false);
	let inviting = $state(false);
	let tab = $state<'transcript' | 'scores'>('transcript');
	let highlighted = $state<string | null>(null);
	let highlightTimer: ReturnType<typeof setTimeout> | undefined;

	async function openPanel(value: DecisionValue) {
		panel = value;
		note = '';
		await tick();
		document.getElementById('decision-note')?.focus();
	}

	const submitDecision: SubmitFunction = () => {
		deciding = true;
		return async ({ result, update }) => {
			deciding = false;
			if (result.type === 'success') panel = null;
			await update({ reset: false });
		};
	};

	const submitInvite: SubmitFunction = () => {
		inviting = true;
		return async ({ update }) => {
			inviting = false;
			await update({ reset: false });
		};
	};

	async function jump(messageId: string) {
		tab = 'transcript';
		await tick();
		const target = document.getElementById(messageId);
		if (!target) return;
		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
		target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
		target.focus({ preventScroll: true });
		highlighted = messageId;
		clearTimeout(highlightTimer);
		highlightTimer = setTimeout(() => (highlighted = null), HIGHLIGHT_MS);
	}

	/** Arrow keys move between the two tabs (WAI-ARIA tabs pattern). */
	async function switchTab(event: KeyboardEvent) {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		event.preventDefault();
		tab = tab === 'transcript' ? 'scores' : 'transcript';
		await tick();
		document.getElementById(`tab-${tab}`)?.focus();
	}

	const tabs = $derived([
		{ id: 'transcript', label: 'Transcript' },
		{ id: 'scores', label: manualCount > 0 ? `Scores · ${manualCount} needs review` : 'Scores' }
	] as const);
</script>

<svelte:head><title>{application.name} · Talent Scout</title></svelte:head>

<div class="flex flex-col gap-6">
	<header class="flex flex-col gap-4">
		<nav aria-label="Breadcrumb">
			<ol class="flex flex-wrap items-center gap-1 text-body-sm text-helper">
				<li>
					<a
						class="inline-flex min-h-6 items-center hover:text-brand hover:underline"
						href={resolve('/dashboard/(recruiter)/jobs')}>Jobs</a
					>
				</li>
				<li aria-hidden="true">›</li>
				<li>
					<a
						class="inline-flex min-h-6 items-center hover:text-brand hover:underline"
						href={resolve('/dashboard/(recruiter)/jobs/[jobId]', { jobId: detail.job.id })}
						>{detail.job.title}</a
					>
				</li>
				<li aria-hidden="true">›</li>
				<li aria-current="page" class="text-muted">{application.name}</li>
			</ol>
		</nav>

		<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
			<div class="flex min-w-0 flex-col gap-2">
				<div class="flex flex-wrap items-center gap-3">
					<h1 class="text-heading-sm font-semibold [overflow-wrap:anywhere] text-ink">
						{application.name}
					</h1>
					<StatusBadge {status} />
				</div>
				<p class="flex flex-wrap gap-x-3 gap-y-1 text-body-sm text-muted">
					<span class="[overflow-wrap:anywhere]">{application.email}</span>
					<span>Applied {formatDate(application.created_at)}</span>
					{#if sessionLine}<span>{sessionLine}</span>{/if}
					{#if graphRun}
						<span>Cost <span class="font-mono text-ink">{formatCost(graphRun.cost_usd)}</span></span
						>
					{/if}
				</p>
				<p class="flex flex-wrap gap-x-4 text-body-sm font-medium">
					<a
						href={cvHref}
						target="_blank"
						rel="noopener"
						class="inline-flex min-h-11 items-center gap-1.5 text-brand hover:underline lg:min-h-6"
					>
						<FileText size={16} aria-hidden="true" /> CV (PDF)
					</a>
					{#if runHref}
						<a
							href={runHref}
							class="inline-flex min-h-11 items-center gap-1.5 text-brand hover:underline lg:min-h-6"
						>
							<Network size={16} aria-hidden="true" /> View graph run
						</a>
					{/if}
				</p>
			</div>

			<div class="flex flex-col gap-2 lg:items-end">
				{#if canDecide(status) && !decision}
					<div class="grid grid-cols-2 gap-2 lg:flex">
						<Button
							variant="primary"
							size="lg"
							class="lg:h-9"
							onclick={() => openPanel('shortlist')}
						>
							<Check size={16} aria-hidden="true" /> Shortlist
						</Button>
						<Button
							variant="destructive"
							size="lg"
							class="lg:h-9"
							onclick={() => openPanel('reject')}
						>
							<X size={16} aria-hidden="true" /> Reject
						</Button>
					</div>
				{/if}
				{#if canGetInvite(status, detail.session?.status ?? null)}
					<form method="POST" action="?/invite" use:enhance={submitInvite}>
						<Button
							type="submit"
							variant="secondary"
							size="lg"
							class="w-full lg:h-9"
							loading={inviting}
						>
							<Link size={16} aria-hidden="true" /> Get invite link
						</Button>
					</form>
				{/if}
			</div>
		</div>
	</header>

	{#if decision && canDecide(status)}
		{@const shortlisted = decision.value === 'shortlist'}
		<div
			role="status"
			class={[
				'flex flex-wrap items-start justify-between gap-3 rounded-card border bg-card p-4',
				shortlisted ? 'border-success' : 'border-danger'
			]}
		>
			<div class="min-w-0">
				<p
					class={[
						'flex items-center gap-2 font-medium',
						shortlisted ? 'text-success-text' : 'text-danger-text'
					]}
				>
					{#if shortlisted}<Check size={16} aria-hidden="true" />{:else}<X
							size={16}
							aria-hidden="true"
						/>{/if}
					{`${shortlisted ? 'Shortlisted' : 'Rejected'} ${relativeTime(decision.decided_at, now)}`}
				</p>
				<p class="mt-1 text-body-sm [overflow-wrap:anywhere] text-muted">
					{decision.note ? `“${decision.note}”` : 'No note.'}
				</p>
			</div>
			<Button onclick={() => openPanel(shortlisted ? 'reject' : 'shortlist')}>
				{shortlisted ? 'Change to reject' : 'Change to shortlist'}
			</Button>
		</div>
	{/if}

	{#if form?.decisionError}
		<div
			role="alert"
			class="flex flex-wrap items-center gap-3 rounded-card border border-danger bg-card p-3 text-danger-text"
		>
			<TriangleAlert size={16} aria-hidden="true" class="shrink-0" />
			<div class="min-w-0 flex-1">
				<p class="font-medium">Couldn't save the decision</p>
				<p class="text-muted">
					{form.decisionError === 'invalid_state'
						? 'This application is not ready for a decision yet. Reload to see its current status.'
						: 'Choose shortlist or reject, and keep the note to 1000 characters or fewer.'}
				</p>
			</div>
			{#if form.decisionError === 'invalid_state'}
				<Button href={selfHref}>Reload</Button>
			{/if}
		</div>
	{/if}

	{#if panel}
		{@const shortlist = panel === 'shortlist'}
		<form
			method="POST"
			action="?/decide"
			use:enhance={submitDecision}
			class={[
				'flex flex-col gap-3 rounded-card border bg-card p-4',
				shortlist ? 'border-brand' : 'border-danger'
			]}
		>
			<h2 class="text-subheading font-semibold text-ink">
				{shortlist ? 'Shortlist' : 'Reject'}
				{application.name}?
			</h2>
			<input type="hidden" name="decision" value={panel} />
			<div class="flex flex-col gap-1">
				<label for="decision-note" class="text-body-sm font-medium text-body">
					Note (optional, shown to your team only)
				</label>
				<textarea
					id="decision-note"
					name="note"
					rows="3"
					maxlength={NOTE_MAX}
					bind:value={note}
					aria-describedby="decision-note-count"
					class="rounded-input border border-line bg-card px-3 py-3 text-body outline-hidden placeholder:text-helper focus-visible:ring-2 focus-visible:ring-focus"
				></textarea>
				<p id="decision-note-count" class="self-end font-mono text-caption text-helper">
					{note.length} / {NOTE_MAX}
				</p>
			</div>
			<div class="flex flex-wrap gap-2">
				<Button
					type="submit"
					size="lg"
					class="lg:h-9"
					variant={shortlist ? 'primary' : 'destructive'}
					loading={deciding}
				>
					{shortlist ? 'Confirm shortlist' : 'Confirm reject'}
				</Button>
				<Button size="lg" class="lg:h-9" onclick={() => (panel = null)}>Cancel</Button>
			</div>
		</form>
	{/if}

	{#if invite}
		{#if invite.invite_url}
			<div role="status" class="flex flex-col gap-2 rounded-card bg-wash p-4">
				<p class="font-medium text-ink">New invite link</p>
				<div class="flex flex-wrap items-center gap-2">
					<p
						class="min-w-0 flex-1 rounded-card border border-line bg-card px-3 py-2 font-mono text-caption [overflow-wrap:anywhere] text-body"
					>
						{invite.invite_url}
					</p>
					<CopyButton value={invite.invite_url} label="Copy" size="sm" />
				</div>
				<p class="text-body-sm text-muted">
					Expires {formatDate(invite.expires_at)}. Any earlier link for {name} no longer works. Send this
					one yourself; it is shown only now.
				</p>
			</div>
		{:else}
			<div role="status" class="rounded-card border border-success bg-card p-4">
				<p class="flex items-center gap-2 font-medium text-success-text">
					<Check size={16} aria-hidden="true" /> New invite sent by email.
				</p>
				<p class="mt-1 text-body-sm text-muted">
					It expires {formatDate(invite.expires_at)}. Any earlier link no longer works.
				</p>
			</div>
		{/if}
	{/if}

	{#if form?.inviteError}
		<div
			role="alert"
			class="flex items-center gap-3 rounded-card border border-danger bg-card p-3 text-danger-text"
		>
			<TriangleAlert size={16} aria-hidden="true" class="shrink-0" />
			<p><span class="font-medium">Couldn't get a new invite link.</span> {form.inviteError}</p>
		</div>
	{/if}

	{#if status === 'failed'}
		<div role="alert" class="rounded-card border border-danger bg-card p-4">
			<p class="flex items-center gap-2 font-medium text-danger-text">
				<TriangleAlert size={16} aria-hidden="true" /> The screening could not finish
			</p>
			<p class="mt-1 text-body-sm text-muted">
				{name}'s screening ended with a system error, so there are no scores. Get a new invite link
				to let {name} try again.
			</p>
			{#if runHref}
				<a
					href={runHref}
					class="mt-2 inline-flex min-h-6 text-body-sm font-medium text-brand hover:underline"
				>
					See where it failed in the graph run →
				</a>
			{/if}
		</div>
	{:else if status === 'in_session'}
		<div class="flex flex-wrap items-center gap-3 rounded-card border border-brand bg-wash p-4">
			<LoaderCircle size={16} aria-hidden="true" class="text-brand motion-safe:animate-spin" />
			<p class="flex-1 text-body-sm text-body">
				Screening in progress.{#if detail.session?.started_at}
					Started {minutesSince(detail.session.started_at, now)} minutes ago.{/if}
			</p>
			{#if runHref}
				<a
					href={runHref}
					class="inline-flex min-h-6 items-center text-body-sm font-medium text-brand hover:underline"
				>
					Watch the graph live →
				</a>
			{/if}
		</div>
	{:else if status === 'scoring'}
		<p class="rounded-card border border-line bg-card p-4 text-body-sm text-muted">
			The AI is scoring the transcript. Refresh in a minute, or watch it in the graph run.
		</p>
	{/if}

	{#if !showScores}
		{#if hasTranscript}
			<Transcript
				messages={detail.messages}
				topics={detail.topics}
				scores={detail.scores}
				applicantName={application.name}
				{highlighted}
			/>
		{:else if status === 'applied' || status === 'invited'}
			<div
				class="flex flex-col items-center gap-2 rounded-panel border border-dashed border-line px-6 py-12 text-center"
			>
				<MessageCircle size={32} aria-hidden="true" class="text-helper" />
				<p class="text-subheading font-semibold text-ink">The screening hasn't started</p>
				<p class="text-body-sm text-muted">
					The transcript and scores appear here after {name} finishes.
				</p>
			</div>
		{/if}
	{:else}
		<div
			role="tablist"
			aria-label="Review sections"
			class="grid grid-cols-2 gap-1 rounded-full bg-subtle p-1 lg:hidden"
		>
			{#each tabs as item (item.id)}
				<button
					type="button"
					role="tab"
					id="tab-{item.id}"
					aria-controls="panel-{item.id}"
					aria-selected={tab === item.id}
					tabindex={tab === item.id ? 0 : -1}
					onclick={() => (tab = item.id)}
					onkeydown={switchTab}
					class={[
						'h-10 cursor-pointer rounded-full px-3 text-body-sm font-medium outline-hidden focus-visible:ring-2 focus-visible:ring-focus',
						tab === item.id ? 'bg-card text-ink shadow-card' : 'text-muted'
					]}
				>
					{item.label}
				</button>
			{/each}
		</div>

		<div class="lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
			<div
				role="tabpanel"
				id="panel-transcript"
				aria-labelledby="tab-transcript"
				class={['lg:col-span-7', tab !== 'transcript' && 'max-lg:hidden']}
			>
				<Transcript
					messages={detail.messages}
					topics={detail.topics}
					scores={detail.scores}
					applicantName={application.name}
					{highlighted}
				/>
			</div>

			<div
				role="tabpanel"
				id="panel-scores"
				aria-labelledby="tab-scores"
				class={[
					'flex flex-col gap-4 lg:sticky lg:top-6 lg:col-span-5',
					tab !== 'scores' && 'max-lg:hidden'
				]}
			>
				{#if status === 'scoring'}
					<div aria-busy="true" aria-label="Scores loading" class="flex flex-col gap-4">
						{#each [1, 2] as skeleton (skeleton)}
							<div class="flex flex-col gap-3 rounded-card border border-line bg-card p-4">
								<div class="h-5 w-1/2 rounded-full bg-subtle motion-safe:animate-pulse"></div>
								<div class="h-1.5 rounded-full bg-subtle motion-safe:animate-pulse"></div>
								<div class="h-12 rounded-card bg-subtle motion-safe:animate-pulse"></div>
							</div>
						{/each}
					</div>
				{:else}
					<section
						class="rounded-panel border border-line bg-card p-4 shadow-card"
						aria-labelledby="overall-heading"
					>
						<h2
							id="overall-heading"
							class="text-caption font-medium tracking-wide text-helper uppercase"
						>
							Overall score
						</h2>
						<p class="mt-1 flex items-baseline gap-2">
							<span class="font-mono text-[32px] leading-none text-ink">
								{formatScore(application.overall_score) ?? '—'}
							</span>
							{#if application.overall_score !== null}
								<span class="text-body-sm text-helper">/ 5, weighted</span>
							{/if}
						</p>
						{#if manualReviewNote(manualCount)}
							<p class="mt-2 flex items-center gap-1.5 text-body-sm text-warning-text">
								<TriangleAlert size={14} aria-hidden="true" class="shrink-0" />
								{manualReviewNote(manualCount)}
							</p>
						{/if}
					</section>
					{#each detail.job.rubric as criterion (criterion.key)}
						<ScoreCard {criterion} score={scoreByKey.get(criterion.key)} onjump={jump} />
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>
