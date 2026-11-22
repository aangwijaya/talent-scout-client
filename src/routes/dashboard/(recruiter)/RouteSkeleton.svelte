<script lang="ts">
	import TableSkeleton from '$lib/components/TableSkeleton.svelte';
	import type { SkeletonKind } from './skeleton';

	let { kind }: { kind: SkeletonKind } = $props();

	const LABELS = {
		review: 'Loading application',
		form: 'Loading job form',
		run: 'Loading graph run'
	} as const;

	// DESIGN.md §3 loading state: `subtle` bars (fully round) and boxes (12px), pulsing only when
	// motion is allowed. Each shape matches the loaded page so nothing jumps when data lands.
	const bar = 'block rounded-full bg-subtle motion-safe:animate-pulse';
	const box = 'block rounded-input bg-subtle motion-safe:animate-pulse';
</script>

{#snippet header(pills: boolean)}
	<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
		<div class="flex flex-col gap-2">
			<span class={[bar, 'h-4 w-40']}></span>
			<span class={[bar, 'h-7 w-56 max-w-full']}></span>
			<span class={[bar, 'h-4 w-72 max-w-full']}></span>
		</div>
		{#if pills}
			<div class="grid grid-cols-2 gap-2 lg:flex">
				<span class={[bar, 'h-11 lg:h-9 lg:w-28']}></span>
				<span class={[bar, 'h-11 lg:h-9 lg:w-28']}></span>
			</div>
		{/if}
	</div>
{/snippet}

{#if kind === 'table'}
	<div class="mb-6 flex flex-col gap-2" aria-hidden="true">
		<span class={[bar, 'h-7 w-48']}></span>
		<span class={[bar, 'h-4 w-72 max-w-full']}></span>
	</div>
	<TableSkeleton label="Loading" />
{:else}
	<div aria-busy="true" class="flex flex-col gap-6">
		<p role="status"><span class="sr-only">{LABELS[kind]}</span></p>
		{#if kind === 'review'}
			{@render header(true)}
			<!-- Below 1024px the two columns stack under the Transcript/Scores tab bar. -->
			<span class={[bar, 'h-12 lg:hidden']}></span>
			<div class="flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:items-start">
				<div class="flex flex-col gap-4 rounded-panel border border-line bg-card p-4 lg:col-span-7">
					{#each ['w-2/3', 'ml-auto w-1/2', 'w-3/4', 'ml-auto w-2/5'] as width, index (index)}
						<span class={[box, 'h-16', width]}></span>
					{/each}
				</div>
				<div class="flex flex-col gap-4 lg:col-span-5">
					<div class="flex flex-col gap-3 rounded-panel border border-line bg-card p-4">
						<span class={[bar, 'h-3 w-24']}></span>
						<span class={[bar, 'h-7 w-20']}></span>
					</div>
					<div class="flex flex-col gap-3 rounded-panel border border-line bg-card p-4">
						<span class={[bar, 'h-3 w-28']}></span>
						<span class={[bar, 'h-4 w-3/4']}></span>
					</div>
					<div class="flex flex-col gap-4 rounded-panel border border-line bg-card p-4">
						{#each [1, 2, 3] as row (row)}
							<div class="flex flex-col gap-2">
								<div class="flex items-center justify-between gap-4">
									<span class={[bar, 'h-4 w-32']}></span>
									<span class={[bar, 'h-5 w-12']}></span>
								</div>
								<span class={[bar, 'h-1.5']}></span>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{:else if kind === 'form'}
			<div class="mx-auto flex w-full max-w-[880px] flex-col gap-6">
				<div class="flex flex-col gap-2">
					<span class={[bar, 'h-4 w-32']}></span>
					<span class={[bar, 'h-7 w-40']}></span>
				</div>
				<div class="flex flex-col gap-4 rounded-card border border-line bg-card p-4 sm:p-6">
					<span class={[bar, 'h-4 w-16']}></span>
					<span class={[box, 'h-11']}></span>
					<span class={[bar, 'h-4 w-24']}></span>
					<span class={[box, 'h-40']}></span>
				</div>
				<div class="flex flex-col gap-4 rounded-card border border-line bg-card p-4 sm:p-6">
					<span class={[bar, 'h-5 w-20']}></span>
					<span class={[box, 'h-16']}></span>
					<span class={[box, 'h-16']}></span>
				</div>
			</div>
		{:else}
			{@render header(false)}
			<div class="flex flex-col gap-4 lg:flex-row">
				<span class={[box, 'h-[480px] flex-1']}></span>
				<div class="flex flex-col gap-3 lg:w-80">
					{#each [1, 2, 3, 4] as row (row)}
						<span class={[bar, 'h-4']}></span>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/if}
