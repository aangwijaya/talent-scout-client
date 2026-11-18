<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Clock from '@lucide/svelte/icons/clock';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import AnswerBox from '$lib/components/AnswerBox.svelte';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import { canSend } from '$lib/components/composer';
	import InlineError from '$lib/components/InlineError.svelte';
	import MessageBubble from '$lib/components/MessageBubble.svelte';
	import TypingIndicator from '$lib/components/TypingIndicator.svelte';
	import { keepSessionStream, replayEvents, type SessionEvent } from '$lib/events';
	import { mockSessionTurns } from '$lib/mock';
	import type { Message, SessionInfo } from '$lib/server/api/types';
	import {
		answerHeld,
		initialChat,
		inputLocked as isChatLocked,
		rebuildChat,
		reduceChat,
		releaseHeld,
		sendingAnswer,
		typingIndicator
	} from '$lib/stores/chat';
	import type { PageProps } from './$types';

	const COPY = {
		introHeading: 'Before you start',
		rules: [
			'The conversation takes about {minutes} minutes. A timer starts when you press Start.',
			'An AI interviewer asks a few questions about your experience. Answer in your own words.',
			'Wait for each question to finish before you reply. You cannot edit an answer once sent.',
			'If you refresh or lose your connection, open this link again to continue.'
		],
		start: 'Start screening',
		connecting: 'Connecting…',
		topic: (position: number, total: number) => `Topic ${position} of ${total}`,
		timeLeft: 'Time left',
		reconnecting: 'Reconnecting… your draft is kept.',
		timeUp: 'Time is up. Wrapping up your session…',
		retryError: 'The interviewer ran into a temporary problem.',
		fatalError: 'The interviewer ran into a problem. Please wait a moment.',
		doneHeading: 'Thank you!',
		done: 'Your screening is complete. The recruiter will review it and get back to you.',
		failedHeading: 'We could not finish your screening',
		failed:
			'Something went wrong on our side, not yours. The recruiter has been notified and will send you a new link.'
	};
	const STREAM_RETRY_MS = 5000;
	const FOLLOW_SLACK_PX = 80;
	// After `message.completed` the server can still be closing its turn and answer 409
	// `invalid_state`; the held draft is resent on this schedule, then the box unlocks.
	const RESEND_MS = [500, 1000, 2000, 4000];

	let { data }: PageProps = $props();

	// One chat per page visit; the data props only seed it.
	// svelte-ignore state_referenced_locally
	let chat = $state(initialChat(data.session, data.messages));
	let formError = $state<string | null>(null);
	let streamReady = $state(false);
	let reconnecting = $state(false);
	let submitting = $state(false);
	let resendAttempts = 0;
	let resendTimer: ReturnType<typeof setTimeout> | undefined;
	onDestroy(() => clearTimeout(resendTimer));
	let now = $state(Date.now());
	let list = $state<HTMLElement>();
	let answerForm = $state<HTMLFormElement>();
	let retryForm = $state<HTMLFormElement>();

	const mock = $derived(data.sseUrl === null);
	let mockTurns: SessionEvent[][] = [];
	let stopReplay = () => {};

	const ended = $derived(chat.finish_reason !== null);
	const remainingMs = $derived(
		chat.deadline_at ? Math.max(0, Date.parse(chat.deadline_at) - now) : null
	);
	const timeUp = $derived(remainingMs === 0);
	const inputLocked = $derived(isChatLocked(chat) || timeUp || submitting);
	const typing = $derived(timeUp ? null : typingIndicator(chat));
	const countdown = $derived.by(() => {
		if (remainingMs === null) return '';
		const total = Math.ceil(remainingMs / 1000);
		return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
	});

	const apply = (event: SessionEvent) => (chat = reduceChat(chat, event));

	function replayTurn(index: number) {
		const turn = mockTurns[index];
		if (!turn) return;
		stopReplay();
		stopReplay = replayEvents(turn, apply, { delayMs: () => 60 + Math.random() * 90 });
	}

	onMount(() => {
		const timer = setInterval(() => (now = Date.now()), 1000);
		if (mock) {
			streamReady = true;
			const deadline = data.session.deadline_at ?? new Date(Date.now() + 15 * 60_000).toISOString();
			mockTurns = mockSessionTurns(deadline);
			return () => {
				clearInterval(timer);
				stopReplay();
			};
		}
		const sseUrl = data.sseUrl;
		if (!sseUrl || ended) return () => clearInterval(timer);
		// Opened before `POST /start`: the stream accepts invited sessions, so no delta is lost.
		// When the browser gives up, the reload turns an ended/expired session into the 404/410
		// page; if the session is still live, the stream reopens after a pause.
		const { stop } = keepSessionStream(sseUrl, {
			onEvent: apply,
			rebuild: async () => {
				await invalidateAll();
				chat = rebuildChat(chat, data.messages);
			},
			onReady: (ready) => {
				streamReady = ready;
				reconnecting = !ready;
			},
			retryMs: STREAM_RETRY_MS
		});
		return () => {
			clearInterval(timer);
			stop();
		};
	});

	// Follow the newest message unless the applicant scrolled up to reread.
	let followLatest = true;
	function onLogScroll() {
		if (!list) return;
		followLatest = list.scrollHeight - list.scrollTop - list.clientHeight < FOLLOW_SLACK_PX;
	}
	$effect(() => {
		void chat.messages.length;
		void chat.streaming?.text;
		void typing;
		if (!followLatest) return;
		tick().then(() => list?.scrollTo({ top: list.scrollHeight }));
	});

	const startSubmit: SubmitFunction = () => {
		submitting = true;
		formError = null;
		return async ({ result }) => {
			submitting = false;
			if (result.type === 'success' && result.data?.session) {
				const session = result.data.session as SessionInfo;
				chat = {
					...chat,
					status: session.status,
					deadline_at: session.deadline_at,
					current_topic: session.current_topic,
					question_count: session.question_count
				};
				if (mock) {
					mockTurns = mockSessionTurns(session.deadline_at ?? chat.deadline_at ?? '');
					replayTurn(0);
				}
			} else if (result.type === 'failure') {
				formError = String(result.data?.error ?? '');
			}
		};
	};

	const messageSubmit: SubmitFunction = ({ cancel }) => {
		if (!canSend(chat.draft, inputLocked || reconnecting)) return cancel();
		submitting = true;
		formError = null;
		return async ({ result }) => {
			submitting = false;
			if (result.type === 'success' && result.data?.message) {
				resendAttempts = 0;
				chat = sendingAnswer(chat, result.data.message as Message);
				if (mock) replayTurn(chat.messages.filter((m) => m.role === 'applicant').length);
			} else if (
				result.type === 'failure' &&
				result.data?.code === 'invalid_state' &&
				!chat.error &&
				resendAttempts < RESEND_MS.length
			) {
				chat = answerHeld(chat);
				resendTimer = setTimeout(resendHeld, RESEND_MS[resendAttempts++]);
			} else if (result.type === 'failure') {
				resendAttempts = 0;
				chat = releaseHeld(chat);
				formError = String(result.data?.error ?? '');
			}
		};
	};

	async function resendHeld() {
		if (!chat.held) return;
		chat = releaseHeld(chat);
		// A disabled textarea is left out of the form data, so let it re-enable first.
		await tick();
		answerForm?.requestSubmit();
	}

	const retrySubmit: SubmitFunction = () => {
		formError = null;
		return async ({ result }) => {
			if (result.type === 'success') chat = { ...chat, error: null };
			else if (result.type === 'failure') formError = String(result.data?.error ?? '');
		};
	};
</script>

<svelte:head>
	<title>Screening: {data.session.job_title} · Talent Scout</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="flex h-dvh flex-col bg-canvas text-body">
	<header class="sticky top-0 z-10 border-b border-line bg-card px-4 py-3">
		<div class="mx-auto flex max-w-[720px] flex-wrap items-center justify-between gap-x-4 gap-y-2">
			<div class="min-w-0 flex-1">
				<p class="text-caption font-medium text-brand">Talent Scout</p>
				<h1 class="truncate text-base font-semibold text-ink">{data.session.job_title}</h1>
			</div>
			{#if chat.status === 'active' && !ended}
				{#if chat.current_topic}
					{@const topic = chat.current_topic}
					<div
						class="order-last flex w-full items-center gap-3 sm:order-none sm:w-auto sm:flex-col-reverse sm:items-end sm:gap-1"
					>
						<div class="flex flex-1 gap-1 sm:flex-none" aria-hidden="true">
							{#each { length: topic.total }, i (i)}
								<span
									class={[
										'h-1 flex-1 rounded-full sm:w-6 sm:flex-none',
										i < topic.position ? 'bg-brand' : 'bg-line'
									]}
								></span>
							{/each}
						</div>
						<p class="shrink-0 text-caption font-medium text-muted">
							{COPY.topic(topic.position, topic.total)}
						</p>
					</div>
				{/if}
				{#if countdown}
					<span
						class={[
							'flex shrink-0 items-center gap-1 font-mono text-body-sm font-medium tabular-nums',
							remainingMs !== null && remainingMs < 120_000 ? 'text-warning-text' : 'text-muted'
						]}
						aria-label="{COPY.timeLeft}: {countdown}"
					>
						<Clock size={16} aria-hidden="true" />{countdown}
					</span>
				{/if}
			{/if}
		</div>
	</header>

	{#if ended}
		<div class="flex flex-1 items-center justify-center px-4">
			<Card class="flex max-w-[480px] flex-col items-center gap-3 p-8 text-center">
				{#if chat.finish_reason === 'failed'}
					<h2 class="text-subheading font-semibold text-ink">{COPY.failedHeading}</h2>
					<p role="status" class="text-muted">{COPY.failed}</p>
				{:else}
					<CircleCheck size={40} aria-hidden="true" class="text-success-text" />
					<h2 class="text-subheading font-semibold text-ink">{COPY.doneHeading}</h2>
					<p role="status" class="text-muted">{COPY.done}</p>
				{/if}
			</Card>
		</div>
	{:else if chat.status === 'invited'}
		<div class="flex-1 overflow-y-auto px-4 py-8">
			<Card class="mx-auto flex max-w-[640px] flex-col gap-5 p-6 sm:p-8">
				<div>
					<p class="text-body-sm text-muted">Hi {data.session.applicant_name},</p>
					<h2 class="mt-1 text-heading-sm font-semibold text-ink">{COPY.introHeading}</h2>
				</div>
				<ul class="flex list-disc flex-col gap-2 pl-5 text-muted">
					{#each COPY.rules as rule (rule)}
						<li>{rule.replace('{minutes}', String(data.session.max_minutes))}</li>
					{/each}
				</ul>
				{#if formError}<InlineError message={formError} />{/if}
				<form method="POST" action="?/start" use:enhance={startSubmit}>
					<Button
						type="submit"
						variant="primary"
						size="lg"
						class="w-full sm:w-auto"
						disabled={!streamReady || submitting}
						loading={submitting}
					>
						{streamReady ? COPY.start : COPY.connecting}
					</Button>
				</form>
			</Card>
		</div>
	{:else}
		{#if reconnecting}
			<div role="status" class="bg-wash px-4 py-2">
				<p class="mx-auto flex max-w-[720px] items-center gap-2 text-body-sm text-muted">
					<LoaderCircle size={16} aria-hidden="true" class="text-brand motion-safe:animate-spin" />
					{COPY.reconnecting}
				</p>
			</div>
		{/if}
		<section
			bind:this={list}
			onscroll={onLogScroll}
			role="log"
			aria-live="polite"
			aria-label="Conversation"
			class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6"
		>
			<div class="mx-auto flex min-h-full max-w-[720px] flex-col justify-end gap-3">
				{#each chat.messages as message (message.id)}
					{#if message.role !== 'system'}
						<MessageBubble role={message.role} content={message.content} />
					{/if}
				{/each}
				{#if chat.streaming}
					<MessageBubble role="assistant" content={chat.streaming.text} streaming />
				{:else if typing}
					<TypingIndicator first={typing === 'first'} />
				{/if}
			</div>
		</section>

		<div
			class="border-t border-line bg-card px-1.5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
		>
			<div class="mx-auto flex max-w-[720px] flex-col gap-2">
				{#if chat.error?.retryable}
					<InlineError message={COPY.retryError} onretry={() => retryForm?.requestSubmit()} />
				{:else if chat.error}
					<InlineError message={COPY.fatalError} />
				{/if}
				{#if formError}<InlineError message={formError} />{/if}
				<form
					bind:this={retryForm}
					method="POST"
					action="?/retry"
					use:enhance={retrySubmit}
					hidden
				></form>
				<p class="text-caption text-helper empty:hidden" aria-live="polite">
					{#if timeUp}{COPY.timeUp}{/if}
				</p>
				<form bind:this={answerForm} method="POST" action="?/message" use:enhance={messageSubmit}>
					<AnswerBox bind:value={chat.draft} locked={inputLocked} {reconnecting} />
				</form>
			</div>
		</div>
	{/if}
</main>
