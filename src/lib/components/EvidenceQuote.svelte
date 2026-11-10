<script lang="ts">
	import type { Evidence } from '$lib/server/api/types';

	type Props = { evidence: Evidence; onjump: (messageId: string) => void };

	let { evidence, onjump }: Props = $props();

	function jump(event: MouseEvent) {
		event.preventDefault();
		onjump(evidence.message_id);
	}
</script>

<blockquote class="rounded-r-card border-l-2 border-brand bg-wash px-3 py-2 text-body">
	<p class="[overflow-wrap:anywhere]">“{evidence.quote}”</p>
	<a
		href="#{evidence.message_id}"
		onclick={jump}
		class="mt-1 inline-flex min-h-6 items-center text-body-sm font-medium text-brand underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-hidden"
	>
		Jump to message →
	</a>
</blockquote>
