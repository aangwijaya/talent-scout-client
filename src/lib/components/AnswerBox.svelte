<script lang="ts">
	import AlertCircle from '@lucide/svelte/icons/circle-alert';
	import SendHorizontal from '@lucide/svelte/icons/send-horizontal';
	import { answerCounter, autosize, canSend, MAX_ANSWER } from './composer';

	type Props = {
		value: string;
		/** Waiting for the interviewer, or the session can no longer take answers. */
		locked: boolean;
		/** The stream is reconnecting: the draft stays editable but cannot be sent. */
		reconnecting: boolean;
	};

	let { value = $bindable(), locked, reconnecting }: Props = $props();

	const COPY = {
		label: 'Your answer',
		placeholder: 'Type your answer…',
		lockedPlaceholder: 'You can answer once the question arrives',
		send: 'Send',
		sendWaiting: 'Send (waiting for the connection)',
		hint: 'Enter to send · Shift+Enter for a new line'
	};
	const MAX_HEIGHT_RATIO = 0.4;

	let field = $state<HTMLTextAreaElement>();
	const counter = $derived(answerCounter(value.length));
	const sendable = $derived(canSend(value, locked || reconnecting));

	$effect(() => {
		void value;
		const el = field;
		if (!el) return;
		const fit = () => autosize(el, window.innerHeight * MAX_HEIGHT_RATIO);
		fit();
		window.addEventListener('resize', fit);
		return () => window.removeEventListener('resize', fit);
	});

	function onKeydown(event: KeyboardEvent & { currentTarget: HTMLTextAreaElement }) {
		if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
			event.preventDefault();
			if (sendable) event.currentTarget.form?.requestSubmit();
		}
	}
</script>

<div
	class={[
		'grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 rounded-panel border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-focus sm:px-4 sm:py-3',
		counter?.atLimit ? 'border-danger' : 'border-line focus-within:border-brand',
		locked ? 'bg-subtle' : 'bg-card'
	]}
>
	<label for="answer" class="sr-only">{COPY.label}</label>
	<textarea
		bind:this={field}
		id="answer"
		name="content"
		rows="3"
		maxlength={MAX_ANSWER}
		placeholder={locked ? COPY.lockedPlaceholder : COPY.placeholder}
		aria-describedby={counter ? 'answer-counter' : undefined}
		bind:value
		onkeydown={onKeydown}
		disabled={locked}
		class="col-start-1 row-start-1 w-full resize-none bg-transparent py-1 text-base text-body outline-hidden placeholder:text-helper disabled:text-helper sm:col-span-2"
	></textarea>
	<button
		type="submit"
		aria-label={reconnecting ? COPY.sendWaiting : COPY.send}
		disabled={!sendable}
		class={[
			'col-start-2 row-start-1 flex h-11 min-w-11 items-center justify-center gap-2 self-end rounded-full outline-hidden transition-colors [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 sm:row-start-2 sm:px-4',
			sendable
				? 'cursor-pointer bg-brand text-card hover:bg-brand/90 active:bg-brand/80'
				: 'cursor-not-allowed bg-line text-muted'
		]}
	>
		<span class="hidden text-body-sm font-medium sm:inline" aria-hidden="true">{COPY.send}</span>
		<SendHorizontal size={20} aria-hidden="true" />
	</button>
	<div
		class="col-span-2 row-start-2 flex min-h-5 flex-wrap items-center justify-between gap-x-3 self-center sm:col-span-1 sm:col-start-1"
	>
		<span class="hidden text-caption text-muted [@media(hover:hover)_and_(pointer:fine)]:inline">
			{COPY.hint}
		</span>
		{#if counter}
			<span
				id="answer-counter"
				class={[
					'flex items-center gap-1 font-mono text-caption tabular-nums',
					counter.atLimit ? 'text-danger-text' : 'text-muted'
				]}
			>
				{#if counter.atLimit}<AlertCircle size={14} aria-hidden="true" />{/if}{counter.text}
			</span>
		{/if}
	</div>
</div>
