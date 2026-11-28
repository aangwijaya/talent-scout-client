<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import CloudOff from '@lucide/svelte/icons/cloud-off';
	import Ear from '@lucide/svelte/icons/ear';
	import Keyboard from '@lucide/svelte/icons/keyboard';
	import Mic from '@lucide/svelte/icons/mic';
	import MicOff from '@lucide/svelte/icons/mic-off';
	import Pause from '@lucide/svelte/icons/pause';
	import Play from '@lucide/svelte/icons/play';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Square from '@lucide/svelte/icons/square';
	import Volume2 from '@lucide/svelte/icons/volume-2';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import type { FallbackReason, VoiceSession } from '$lib/server/api/types';
	import {
		canAnswerByVoice,
		formatClock,
		microphoneFailure,
		spokenEntry,
		typedEntry,
		type VoiceFailure
	} from '$lib/voice/answer';
	import {
		browserRecorderDeps,
		createRecorder,
		type Recorder,
		type RecorderState,
		type UploadResult
	} from '$lib/voice/recorder';
	import { createReader, type Reader } from '$lib/voice/speech';
	import AnswerBox from './AnswerBox.svelte';
	import Button from './Button.svelte';
	import type { EntryCounter } from './entry-counter';
	import TypingIndicator from './TypingIndicator.svelte';

	type Props = {
		voice: VoiceSession;
		/** The interviewer's current question: `id` changes with each new one. */
		question: { id: string; text: string; complete: boolean } | null;
		/** The page's chat lock: the AI owes a reply, a send is in flight, or time is up. */
		locked: boolean;
		reconnecting: boolean;
		typing: 'first' | 'next' | null;
		draft: string;
		entry: EntryCounter;
		uploadUrl: string;
		/** The page's `?/message` handler; this component only adds the `entry`. */
		submit: SubmitFunction;
		/** The form showing now, so the page can resend a held answer. */
		form?: HTMLFormElement;
		/** The session ended under an upload (410): the page reloads its data. */
		onended: () => void;
	};

	let {
		voice,
		question,
		locked,
		reconnecting,
		typing,
		draft = $bindable(),
		entry,
		uploadUrl,
		submit,
		form = $bindable(),
		onended
	}: Props = $props();

	const COPY = {
		reading: 'Reading aloud…',
		stopReading: 'Reading aloud. Tap to stop.',
		replay: 'Replay question',
		tapToAnswer: 'Tap to answer',
		tapToStop: 'Tap to stop',
		startLabel: 'Start recording your answer',
		stopLabel: 'Stop recording',
		uploadingLabel: 'Transcribing your answer',
		autoStop: (limit: string) => `Stops by itself at ${limit}.`,
		budget: (left: string, total: string) => `Recording time left: ${left} of ${total}`,
		typeInstead: 'Type instead',
		transcribing: 'Transcribing your answer…',
		recordingStatus: 'Recording. Tap to stop.',
		reviewStatus: 'Transcript ready. Review it, then send.',
		heard: "What we heard (you can't edit it)",
		play: 'Play your recording',
		pause: 'Pause your recording',
		send: 'Send answer',
		rerecord: 'Re-record',
		tryAgain: 'Try again',
		textNote: 'Answering in text. The recruiter sees that this answer was typed.',
		byVoice: 'Answer by voice',
		waiting: 'Waiting for the next question…'
	};
	const BARS = 5;

	// svelte-ignore state_referenced_locally
	const initialReason: FallbackReason | null =
		voice.recording_consent === false ? 'declined_recording' : null;
	// svelte-ignore state_referenced_locally
	let usedSeconds = $state(voice.used_seconds);
	let textReason = $state<FallbackReason | null>(initialReason);
	let notice = $state<VoiceFailure | null>(null);
	let rec = $state<RecorderState>({ kind: 'idle' });
	let reading = $state(false);
	let canRead = $state(false);
	let level = $state(0);
	let questionAt = 0;
	let spokenForm = $state<HTMLFormElement>();
	let typedForm = $state<HTMLFormElement>();
	let recorder: Recorder | null = null;
	let hasRecorder = $state(false);
	let reader: Reader | null = null;

	const leftMs = $derived(Math.max(0, (voice.max_total_seconds - usedSeconds) * 1000));
	const budgetSpent = $derived(leftMs <= 0);
	const answerMs = $derived(voice.max_answer_seconds * 1000);
	const inText = $derived(textReason !== null || budgetSpent);
	const reason = $derived<FallbackReason>(textReason ?? 'transcription_failed');
	const showByVoice = $derived(inText && hasRecorder && canAnswerByVoice(reason, budgetSpent));
	const status = $derived.by(() => {
		if (rec.kind === 'recording') return COPY.recordingStatus;
		if (rec.kind === 'uploading') return COPY.transcribing;
		if (rec.kind === 'review') return COPY.reviewStatus;
		return '';
	});

	$effect(() => {
		form = inText ? typedForm : spokenForm;
	});

	async function upload(blob: Blob, type: string): Promise<UploadResult> {
		const body = new FormData();
		body.set('audio', new File([blob], 'answer', { type }));
		const res = await fetch(uploadUrl, { method: 'POST', body });
		const json = await res.json().catch(() => null);
		if (res.ok) return { ok: true, upload: json };
		return { ok: false, status: res.status, code: json?.error?.code ?? null };
	}

	function onRecorder(next: RecorderState) {
		if (next.kind === 'review' && rec.kind !== 'review') {
			usedSeconds += Math.ceil(next.upload.duration_ms / 1000);
		}
		rec = next;
		if (next.kind !== 'error') return;
		const { failure } = next;
		// The server's count wins: voice stays off for the rest of the session.
		if (failure.kind === 'budget') usedSeconds = voice.max_total_seconds;
		if (failure.next === 'reload') onended();
		else if (failure.next === 'text') toText(failure.fallback ?? 'chose_text', failure);
	}

	onMount(() => {
		const deps = browserRecorderDeps(upload);
		if (deps) {
			recorder = createRecorder(deps, {
				limitMs: () => Math.min(answerMs, leftMs),
				onChange: onRecorder
			});
			hasRecorder = true;
		} else if (!textReason) {
			toText('microphone_unavailable', microphoneFailure());
		}
		reader = createReader(
			'speechSynthesis' in window ? window.speechSynthesis : undefined,
			'SpeechSynthesisUtterance' in window ? window.SpeechSynthesisUtterance : undefined,
			(value) => (reading = value),
			() => (canRead = true)
		);
		canRead = reader.available;
	});
	onDestroy(() => {
		recorder?.dispose();
		reader?.stop();
	});

	// Each new question: a fresh answer, read aloud once it has fully arrived.
	let seen: string | null = null;
	$effect(() => {
		if (!question?.complete || question.id === seen) return;
		seen = question.id;
		questionAt = performance.now();
		recorder?.reset();
		if (canRead) reader?.speak(question.text);
	});

	// A live level for the meter while recording.
	$effect(() => {
		if (rec.kind !== 'recording' || typeof AudioContext === 'undefined') return;
		let frame = 0;
		let ctx: AudioContext | null = null;
		try {
			ctx = new AudioContext();
			const analyser = ctx.createAnalyser();
			analyser.fftSize = 256;
			ctx.createMediaStreamSource(rec.stream as MediaStream).connect(analyser);
			const data = new Uint8Array(analyser.fftSize);
			const loop = () => {
				analyser.getByteTimeDomainData(data);
				let sum = 0;
				for (const v of data) sum += ((v - 128) / 128) ** 2;
				level = Math.min(1, Math.sqrt(sum / data.length) * 4);
				frame = requestAnimationFrame(loop);
			};
			loop();
		} catch {
			level = 0;
		}
		return () => {
			cancelAnimationFrame(frame);
			void ctx?.close();
			level = 0;
		};
	});

	function toText(next: FallbackReason, failure: VoiceFailure | null = null) {
		reader?.stop();
		recorder?.reset();
		textReason = next;
		notice = failure;
	}

	function toVoice() {
		textReason = null;
		notice = null;
		recorder?.reset();
	}

	function onRecordButton() {
		reader?.stop();
		if (rec.kind === 'recording') void recorder?.stop();
		else void recorder?.start();
	}

	const spokenSubmit: SubmitFunction = (input) => {
		if (rec.kind !== 'review' || !recorder) return input.cancel();
		input.formData.set(
			'entry',
			JSON.stringify(
				spokenEntry({
					questionAt,
					firstRecordAt: recorder.firstStartedAt ?? questionAt,
					speakingMs: rec.speakingMs,
					rerecords: recorder.rerecords,
					sentAt: performance.now()
				})
			)
		);
		return submit(input);
	};

	const typedSubmit: SubmitFunction = (input) => {
		input.formData.set('entry', JSON.stringify(typedEntry(entry.snapshot(), reason)));
		return submit(input);
	};

	// The review player: one `<audio>` for the take under review.
	let audio = $state<HTMLAudioElement>();
	let playing = $state(false);
	let position = $state(0);
	const audioUrl = $derived(rec.kind === 'review' ? URL.createObjectURL(rec.blob) : null);
	$effect(() => {
		const url = audioUrl;
		return () => {
			if (url) URL.revokeObjectURL(url);
			playing = false;
			position = 0;
		};
	});
	const playLength = $derived(rec.kind === 'review' ? rec.speakingMs : 0);

	function togglePlay() {
		if (!audio) return;
		if (audio.paused) void audio.play();
		else audio.pause();
	}
</script>

{#snippet failureBox(failure: VoiceFailure)}
	<div
		role="alert"
		class={[
			'flex items-start gap-3 rounded-card border p-3 text-body-sm',
			failure.kind === 'no_speech' || failure.kind === 'too_long' || failure.kind === 'other'
				? 'border-warning bg-warning/10 text-warning-text'
				: failure.kind === 'transcription'
					? 'border-danger bg-danger/10 text-danger-text'
					: 'border-line bg-card text-muted'
		]}
	>
		{#if failure.kind === 'no_speech'}
			<Ear size={18} aria-hidden="true" class="mt-0.5 shrink-0" />
		{:else if failure.kind === 'transcription'}
			<CloudOff size={18} aria-hidden="true" class="mt-0.5 shrink-0" />
		{:else if failure.kind === 'microphone'}
			<MicOff size={18} aria-hidden="true" class="mt-0.5 shrink-0" />
		{:else}
			<TriangleAlert size={18} aria-hidden="true" class="mt-0.5 shrink-0" />
		{/if}
		<p class="min-w-0 flex-1">{failure.message}</p>
	</div>
{/snippet}

<p class="sr-only" aria-live="polite">{status}</p>

<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6">
	<div class="mx-auto flex max-w-[640px] flex-col gap-3">
		{#if question}
			<div
				aria-live="polite"
				class={[
					'rounded-panel bg-subtle p-4 text-body transition-opacity',
					(rec.kind === 'recording' || rec.kind === 'review') && 'opacity-60'
				]}
			>
				<p class="whitespace-pre-wrap">{question.text}</p>
			</div>
			{#if question.complete && canRead}
				<button
					type="button"
					onclick={() => (reading ? reader?.stop() : reader?.speak(question.text))}
					aria-label={reading ? COPY.stopReading : COPY.replay}
					class="flex h-11 max-w-full items-center gap-2 self-start rounded-full pr-3 text-caption font-medium text-muted outline-hidden hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"
				>
					<span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-subtle">
						{#if reading}
							<Volume2 size={14} aria-hidden="true" />
						{:else}
							<RotateCcw size={14} aria-hidden="true" />
						{/if}
					</span>
					<span class="truncate">{reading ? COPY.reading : COPY.replay}</span>
				</button>
			{/if}
		{/if}
		{#if typing}
			<TypingIndicator first={typing === 'first'} />
		{:else if locked && !question?.complete}
			<p class="text-caption text-helper">{COPY.waiting}</p>
		{/if}

		{#if rec.kind === 'review' && !inText}
			<div class="flex items-center gap-3 rounded-panel border border-line bg-card p-2">
				<button
					type="button"
					onclick={togglePlay}
					aria-label={playing ? COPY.pause : COPY.play}
					class="flex size-11 shrink-0 items-center justify-center rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-focus"
				>
					<span
						class="flex size-8 items-center justify-center rounded-full border border-line bg-card text-body"
					>
						{#if playing}<Pause size={14} aria-hidden="true" />{:else}<Play
								size={14}
								aria-hidden="true"
							/>{/if}
					</span>
				</button>
				<div class="relative h-1 min-w-0 flex-1 rounded-full bg-line" aria-hidden="true">
					<span
						class="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand"
						style:left="{playLength ? Math.min(100, (position / playLength) * 100) : 0}%"
					></span>
				</div>
				<span class="shrink-0 pr-2 font-mono text-caption text-muted tabular-nums">
					{formatClock(position)} / {formatClock(playLength)}
				</span>
				<audio
					bind:this={audio}
					src={audioUrl}
					onplay={() => (playing = true)}
					onpause={() => (playing = false)}
					onended={() => (playing = false)}
					ontimeupdate={() => (position = (audio?.currentTime ?? 0) * 1000)}
					preload="metadata"
				></audio>
			</div>
			<p class="text-caption text-muted">{COPY.heard}</p>
			<p class="rounded-panel border border-line bg-canvas p-4 text-body" data-testid="transcript">
				{rec.upload.transcript}
			</p>
		{/if}
	</div>
</div>

<div class="border-t border-line bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
	<div class="mx-auto flex max-w-[640px] flex-col gap-2">
		{#if inText}
			{#if notice}{@render failureBox(notice)}{/if}
			<p class="flex items-start gap-2 rounded-card border border-line p-3 text-body-sm text-muted">
				<Keyboard size={18} aria-hidden="true" class="mt-0.5 shrink-0" />
				{COPY.textNote}
			</p>
			<form
				bind:this={typedForm}
				method="POST"
				action="?/message"
				use:enhance={typedSubmit}
				class="flex flex-col gap-2"
			>
				<AnswerBox bind:value={draft} {locked} {reconnecting} {entry} stacked />
				<Button
					type="submit"
					variant="primary"
					size="lg"
					class="w-full whitespace-nowrap"
					disabled={locked || reconnecting || draft.trim().length === 0}
				>
					{COPY.send}
				</Button>
			</form>
			{#if showByVoice}
				<Button variant="secondary" size="lg" class="w-full whitespace-nowrap" onclick={toVoice}>
					<Mic size={16} aria-hidden="true" />{COPY.byVoice}
				</Button>
			{/if}
		{:else if rec.kind === 'review'}
			<form bind:this={spokenForm} method="POST" action="?/message" use:enhance={spokenSubmit}>
				<input type="hidden" name="audio_id" value={rec.upload.audio_id} />
				<Button
					type="submit"
					variant="primary"
					size="lg"
					class="w-full whitespace-nowrap"
					disabled={locked || reconnecting}
				>
					{COPY.send}
				</Button>
			</form>
			<Button
				variant="secondary"
				size="lg"
				class="w-full whitespace-nowrap"
				disabled={locked}
				onclick={() => recorder?.rerecord()}
			>
				<RefreshCw size={16} aria-hidden="true" />{COPY.rerecord}
			</Button>
		{:else}
			{#if rec.kind === 'error'}
				{@render failureBox(rec.failure)}
				{#if rec.failure.next === 'retry'}
					<Button
						variant="primary"
						size="lg"
						class="w-full whitespace-nowrap"
						onclick={() => recorder?.retry()}
					>
						{COPY.tryAgain}
					</Button>
					<Button
						variant="secondary"
						size="lg"
						class="w-full whitespace-nowrap"
						onclick={() =>
							toText(rec.kind === 'error' ? (rec.failure.fallback ?? 'chose_text') : 'chose_text')}
					>
						{COPY.typeInstead}
					</Button>
				{/if}
			{/if}
			{#if rec.kind !== 'error' || rec.failure.next === 'record'}
				<div class="flex flex-col items-center gap-2 py-2">
					{#if rec.kind === 'recording'}
						<div class="flex h-5 items-end gap-1" aria-hidden="true">
							{#each { length: BARS }, i (i)}
								<span
									class="w-1 rounded-full bg-danger transition-[height]"
									style:height="{Math.max(
										4,
										Math.min(20, level * 20 * (1 - Math.abs(i - 2) * 0.2))
									)}px"
								></span>
							{/each}
						</div>
						<p class="font-mono text-body-sm text-ink tabular-nums">
							<span class="text-danger" aria-hidden="true">●</span>
							{formatClock(rec.elapsedMs)} / {formatClock(rec.limitMs)}
						</p>
					{/if}
					<button
						type="button"
						onclick={onRecordButton}
						disabled={rec.kind === 'uploading' ||
							(locked && rec.kind !== 'recording') ||
							!hasRecorder}
						aria-label={rec.kind === 'recording'
							? COPY.stopLabel
							: rec.kind === 'uploading'
								? COPY.uploadingLabel
								: COPY.startLabel}
						class={[
							'flex size-16 items-center justify-center rounded-full text-card outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-line disabled:text-helper',
							rec.kind === 'recording'
								? 'bg-danger hover:bg-danger/90'
								: 'bg-brand hover:bg-brand/90'
						]}
					>
						{#if rec.kind === 'recording'}
							<Square size={22} aria-hidden="true" fill="currentColor" />
						{:else}
							<Mic size={24} aria-hidden="true" />
						{/if}
					</button>
					<p class="text-body-sm font-medium text-ink">
						{rec.kind === 'recording'
							? COPY.tapToStop
							: rec.kind === 'uploading'
								? COPY.transcribing
								: COPY.tapToAnswer}
					</p>
					{#if rec.kind === 'recording'}
						<p class="text-caption text-helper">{COPY.autoStop(formatClock(rec.limitMs))}</p>
					{:else}
						<p class="text-caption text-helper">
							{COPY.budget(formatClock(leftMs), formatClock(voice.max_total_seconds * 1000))}
						</p>
						{#if rec.kind !== 'uploading'}
							<button
								type="button"
								onclick={() => toText('chose_text')}
								class="min-h-11 px-2 text-body-sm font-medium whitespace-nowrap text-brand underline-offset-2 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-focus"
							>
								{COPY.typeInstead}
							</button>
						{/if}
					{/if}
				</div>
			{/if}
		{/if}
	</div>
</div>
