<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Clock from '@lucide/svelte/icons/clock';
	import SendHorizontal from '@lucide/svelte/icons/send-horizontal';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import InlineError from '$lib/components/InlineError.svelte';
	import MessageBubble from '$lib/components/MessageBubble.svelte';
	import {
		openSessionStream,
		replayEvents,
		type SessionEvent,
		type SessionStream
	} from '$lib/events';
	import { mockSessionTurns } from '$lib/mock';
	import type { Message, SessionInfo } from '$lib/server/api/types';
	import { initialChat, rebuildChat, reduceChat, sendingAnswer } from '$lib/stores/chat';
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
		topic: 'Topic',
		timeLeft: 'Time left',
		answerLabel: 'Your answer',
		placeholder: 'Type your answer…',
		send: 'Send answer',
		waiting: 'The interviewer is replying…',
		timeUp: 'Time is up. Wrapping up your session…',
		retryError: 'The interviewer ran into a temporary problem.',
		fatalError: 'The interviewer ran into a problem. Please wait a moment.',
		doneHeading: 'Thank you!',
		done: 'Your screening is complete. The recruiter will review it and get back to you.',
		failedHeading: 'We could not finish your screening',
		failed:
			'Something went wrong on our side, not yours. The recruiter has been notified and will send you a new link.'
	};
	const MAX_ANSWER = 2000;
	const STREAM_RETRY_MS = 5000;

	let { data }: PageProps = $props();

	// One chat per page visit; the data props only seed it.
	// svelte-ignore state_referenced_locally
	let chat = $state(initialChat(data.session, data.messages));
	let formError = $state<string | null>(null);
	let streamReady = $state(false);
	let submitting = $state(false);
	let answer = $state('');
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
	const inputLocked = $derived(chat.awaiting || ended || timeUp || submitting);
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
		const rebuild = async () => {
			await invalidateAll();
			chat = rebuildChat(chat, data.messages);
		};
		let stream: SessionStream;
		let retryTimer: ReturnType<typeof setTimeout> | undefined;
		// Opened before `POST /start`: the stream accepts invited sessions, so no delta is lost.
		const connect = () => {
			stream = openSessionStream(sseUrl, {
				onEvent: apply,
				onReconnect: rebuild,
				// The browser gave up. The load turns an ended/expired session into the 404/410
				// page; if the session is still live, rebuild and reopen after a pause.
				onConnectionError: async () => {
					streamReady = false;
					await rebuild();
					retryTimer = setTimeout(connect, STREAM_RETRY_MS);
				}
			});
			stream.ready.then(() => (streamReady = true));
		};
		connect();
		return () => {
			clearInterval(timer);
			clearTimeout(retryTimer);
			stream.close();
		};
	});

	$effect(() => {
		void chat.messages.length;
		void chat.streaming?.text;
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
		if (inputLocked || answer.trim().length === 0) return cancel();
		submitting = true;
		formError = null;
		return async ({ result }) => {
			submitting = false;
			if (result.type === 'success' && result.data?.message) {
				chat = sendingAnswer(chat, result.data.message as Message);
				answer = '';
				if (mock) replayTurn(chat.messages.filter((m) => m.role === 'applicant').length);
			} else if (result.type === 'failure') {
				formError = String(result.data?.error ?? '');
			}
		};
	};

	const retrySubmit: SubmitFunction = () => {
		formError = null;
		return async ({ result }) => {
			if (result.type === 'success') chat = { ...chat, error: null };
			else if (result.type === 'failure') formError = String(result.data?.error ?? '');
		};
	};

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
			event.preventDefault();
			answerForm?.requestSubmit();
		}
	}
</script>

<svelte:head>
	<title>Screening: {data.session.job_title} · Talent Scout</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="flex h-dvh flex-col bg-canvas text-body">
	<header class="border-b border-line bg-card px-4 py-3">
		<div class="mx-auto flex max-w-[720px] items-center justify-between gap-3">
			<div class="min-w-0">
				<p class="text-caption font-medium text-brand">Talent Scout</p>
				<h1 class="truncate text-base font-semibold text-ink">{data.session.job_title}</h1>
			</div>
			{#if chat.status === 'active' && !ended}
				<div class="flex shrink-0 items-center gap-3 text-body-sm">
					{#if chat.current_topic}
						<span class="rounded-full bg-wash px-3 py-1 font-medium text-brand">
							<span class="sr-only">{COPY.topic}</span>
							{chat.current_topic.position}/{chat.current_topic.total}
						</span>
					{/if}
					{#if countdown}
						<span
							class={[
								'flex items-center gap-1 font-mono tabular-nums',
								remainingMs !== null && remainingMs < 120_000 ? 'text-warning-text' : 'text-muted'
							]}
							aria-label="{COPY.timeLeft}: {countdown}"
						>
							<Clock size={16} aria-hidden="true" />{countdown}
						</span>
					{/if}
				</div>
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
		<section
			bind:this={list}
			role="log"
			aria-live="polite"
			aria-label="Conversation"
			class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6"
		>
			<div class="mx-auto flex max-w-[720px] flex-col gap-3">
				{#each chat.messages as message (message.id)}
					{#if message.role !== 'system'}
						<MessageBubble role={message.role} content={message.content} />
					{/if}
				{/each}
				{#if chat.streaming}
					<MessageBubble role="assistant" content={chat.streaming.text} streaming />
				{/if}
			</div>
		</section>

		<div
			class="border-t border-line bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
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
				<p class="text-caption text-helper" aria-live="polite">
					{#if timeUp}{COPY.timeUp}{:else if chat.awaiting && !chat.error}{COPY.waiting}{/if}
				</p>
				<form
					bind:this={answerForm}
					method="POST"
					action="?/message"
					use:enhance={messageSubmit}
					class="flex items-end gap-2"
				>
					<label for="answer" class="sr-only">{COPY.answerLabel}</label>
					<textarea
						id="answer"
						name="content"
						rows="2"
						maxlength={MAX_ANSWER}
						placeholder={COPY.placeholder}
						bind:value={answer}
						onkeydown={onKeydown}
						disabled={inputLocked}
						class="min-h-11 flex-1 resize-none rounded-input border border-line bg-card px-3 py-2 text-base text-body outline-hidden placeholder:text-helper focus-visible:ring-2 focus-visible:ring-focus disabled:bg-subtle disabled:text-helper"
					></textarea>
					<button
						type="submit"
						aria-label={COPY.send}
						disabled={inputLocked || answer.trim().length === 0}
						class="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-brand text-card outline-hidden transition-colors [-webkit-tap-highlight-color:transparent] hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 active:bg-brand/80 disabled:cursor-not-allowed disabled:bg-subtle disabled:text-helper"
					>
						<SendHorizontal size={20} aria-hidden="true" />
					</button>
				</form>
			</div>
		</div>
	{/if}
</main>
