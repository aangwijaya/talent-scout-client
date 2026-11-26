<script lang="ts">
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Button from './Button.svelte';

	type Props = {
		/** `spoken_english_reason` from the AI suggestion; rendered as text. */
		reason: string;
		onTurnOn: () => void;
	};

	let { reason, onTurnOn }: Props = $props();
</script>

<div
	role="status"
	class="mt-3 flex flex-col gap-3 rounded-input border border-brand bg-wash p-3 text-body-sm text-body sm:flex-row sm:items-start sm:justify-between"
>
	<div class="flex items-start gap-2">
		<Sparkles size={16} aria-hidden="true" class="mt-0.5 shrink-0 text-brand" />
		<p><strong class="font-semibold">AI suggests turning this on.</strong> {reason}</p>
	</div>
	<Button variant="secondary" size="sm" class="shrink-0 self-start" onclick={onTurnOn}>
		Turn on
	</Button>
</div>
