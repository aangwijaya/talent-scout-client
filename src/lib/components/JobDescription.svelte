<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import Hash from '@lucide/svelte/icons/hash';
	import { onMount, tick } from 'svelte';
	import Markdown from '$lib/markdown/Markdown.svelte';
	import { renderMarkdown } from '$lib/markdown/render';
	import Button from './Button.svelte';

	type Props = {
		source: string;
		/** `lg` on the apply page, `sm` on the recruiter job page. */
		size?: 'lg' | 'sm';
		/** Height of the collapsed body in px; the body collapses only when it is taller. */
		collapsedHeight?: number;
		fade?: number;
		toc?: boolean;
		/** True when the description is long enough to collapse. */
		collapsible?: boolean;
		class?: string;
	};

	let {
		source,
		size = 'lg',
		collapsedHeight = 300,
		fade = 72,
		toc = false,
		collapsible = $bindable(false),
		class: className
	}: Props = $props();

	const COPY = {
		title: 'Job description',
		toc: 'On this page',
		more: 'Show full description',
		less: 'Show less'
	};

	const uid = $props.id();
	const ids = { title: `${uid}-title`, toc: `${uid}-toc`, body: `${uid}-body` };

	const headings = $derived(toc ? renderMarkdown(source).headings : []);
	/** About 24px per line, so the server render guesses right before the browser can measure. */
	function estimateLong(text: string): boolean {
		const lines = text
			.split('\n')
			.reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 70)), 0);
		return lines * 24 > collapsedHeight;
	}

	let measured = $state<boolean | null>(null);
	let expanded = $state(false);
	let content = $state<HTMLDivElement>();

	const long = $derived(measured ?? estimateLong(source));
	const collapsed = $derived(long && !expanded);

	$effect(() => {
		collapsible = long;
	});

	onMount(() => {
		if (!content) return;
		const el = content;
		// Some slack, so a description just over the limit doesn't hide one line behind a button.
		const observer = new ResizeObserver(() => {
			measured = el.scrollHeight > collapsedHeight + 24;
		});
		observer.observe(el);
		return () => observer.disconnect();
	});

	async function jump(event: MouseEvent, id: string) {
		if (!collapsed) return;
		event.preventDefault();
		expanded = true;
		await tick();
		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
		document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
		history.replaceState(history.state, '', `#${id}`);
	}
</script>

<section
	aria-labelledby={ids.title}
	class={[
		'flex flex-col gap-4 rounded-panel border border-line bg-card',
		size === 'lg' ? 'p-4 sm:p-6' : 'px-6 py-5',
		className
	]}
>
	<h2
		id={ids.title}
		class={['font-semibold text-ink', size === 'lg' ? 'text-subheading' : 'text-base']}
	>
		{COPY.title}
	</h2>

	{#if headings.length >= 3}
		<nav aria-labelledby={ids.toc} class="rounded-input border border-line bg-subtle p-3">
			<p
				id={ids.toc}
				class="flex items-center gap-1.5 text-caption font-semibold text-helper uppercase"
			>
				<Hash size={14} aria-hidden="true" />{COPY.toc}
			</p>
			<ul class="mt-2 flex flex-col lg:flex-row lg:flex-wrap lg:gap-2">
				{#each headings as heading (heading.id)}
					<li>
						<a
							href="#{heading.id}"
							onclick={(event) => jump(event, heading.id)}
							class="flex min-h-11 items-center rounded-input px-2 text-body-sm font-medium text-brand hover:bg-card focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-hidden lg:h-8 lg:min-h-0 lg:rounded-full lg:border lg:border-line lg:bg-card lg:px-3 lg:hover:bg-wash"
						>
							{heading.text}
						</a>
					</li>
				{/each}
			</ul>
		</nav>
	{/if}

	<div class="relative">
		<div
			id={ids.body}
			bind:this={content}
			data-collapsed={collapsed}
			class={collapsed ? 'overflow-hidden' : undefined}
			style:max-height={collapsed ? `${collapsedHeight}px` : undefined}
		>
			<Markdown {source} />
		</div>
		{#if collapsed}
			<div
				aria-hidden="true"
				class="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-b from-transparent to-card"
				style:height="{fade}px"
			></div>
		{/if}
	</div>

	{#if long}
		<Button
			size="lg"
			aria-expanded={expanded}
			aria-controls={ids.body}
			onclick={() => (expanded = !expanded)}
			class="self-start"
		>
			{#if expanded}
				{COPY.less}<ChevronUp size={16} aria-hidden="true" />
			{:else}
				{COPY.more}<ChevronDown size={16} aria-hidden="true" />
			{/if}
		</Button>
	{/if}
</section>
