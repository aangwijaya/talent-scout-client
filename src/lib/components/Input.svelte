<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	type Props = HTMLInputAttributes & { label: string; error?: string };

	let { label, error, id, class: className, ...rest }: Props = $props();

	const generatedId = $props.id();
	const inputId = $derived(id ?? generatedId);
	const errorId = $derived(`${inputId}-error`);
</script>

<div class="flex flex-col gap-1">
	<label for={inputId} class="font-medium">{label}</label>
	<input
		{...rest}
		id={inputId}
		aria-invalid={error ? true : undefined}
		aria-describedby={error ? errorId : undefined}
		class={[
			'rounded-input border bg-card p-3 text-base outline-hidden placeholder:text-helper focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:bg-subtle disabled:text-helper',
			error ? 'border-danger' : 'border-line',
			className
		]}
	/>
	{#if error}
		<p id={errorId} role="alert" class="text-caption text-danger-text">{error}</p>
	{/if}
</div>
