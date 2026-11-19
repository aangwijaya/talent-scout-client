<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import FileText from '@lucide/svelte/icons/file-text';
	import Info from '@lucide/svelte/icons/info';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import InlineError from '$lib/components/InlineError.svelte';
	import Input from '$lib/components/Input.svelte';
	import JobDescription from '$lib/components/JobDescription.svelte';
	import { validateApplication, validateCv, type ApplicationErrors } from './validate';
	import type { PageProps } from './$types';

	const COPY = {
		submit: 'Submit application',
		submitting: 'Submitting…',
		apply: 'Apply',
		formHeading: 'Your details',
		name: 'Full name',
		email: 'Email',
		cv: 'CV (PDF, max 2 MB)',
		cvHint: 'Choose a PDF file',
		closed: 'This job is no longer accepting applications.',
		successHeading: 'Application received',
		demoLead: 'This is a public demo:',
		demoRest: 'anyone can read what you submit. Use a sample CV, not your real one.'
	};

	let { data, form }: PageProps = $props();

	let submitting = $state(false);
	let clientErrors = $state<ApplicationErrors>({});
	let cvName = $state('');
	let collapsible = $state(false);
	let formCard = $state<HTMLDivElement>();
	let formInView = $state(false);

	$effect(() => {
		if (!formCard) return;
		const observer = new IntersectionObserver(([entry]) => (formInView = entry.isIntersecting));
		observer.observe(formCard);
		return () => observer.disconnect();
	});

	const errors = $derived<ApplicationErrors>({
		...(form && 'errors' in form ? form.errors : {}),
		...clientErrors
	});
	const values = $derived((form && 'values' in form && form.values) || { name: '', email: '' });
	const success = $derived(form && 'message' in form ? form.message : null);
	const apiError = $derived(form && 'error' in form ? form.error : null);
	const open = $derived(data.job.status !== 'closed');
	/** Phones only (hidden from 1024px), and only when a long description pushes the form down. */
	const applyBar = $derived(collapsible && open && !success);

	function goToForm(event: MouseEvent) {
		if (!formCard) return;
		event.preventDefault();
		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
		formCard.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
		formCard.querySelector('input')?.focus({ preventScroll: true });
	}

	function onCvChange(event: Event & { currentTarget: HTMLInputElement }) {
		const file = event.currentTarget.files?.[0] ?? null;
		cvName = file?.name ?? '';
		clientErrors = { ...clientErrors, cv: validateCv(file) };
	}

	const submit: SubmitFunction = ({ formData, cancel }) => {
		clientErrors = validateApplication(formData);
		if (Object.keys(clientErrors).length > 0) return cancel();
		submitting = true;
		return async ({ update }) => {
			await update({ reset: false });
			submitting = false;
		};
	};
</script>

<svelte:head>
	<title>Apply: {data.job.title} · Talent Scout</title>
</svelte:head>

<main class={['min-h-screen bg-canvas text-body', applyBar && 'max-lg:pb-28']}>
	<header class="bg-wash px-4 py-10 lg:px-6">
		<div class="mx-auto max-w-[640px] lg:max-w-[1080px]">
			<p class="text-body-sm font-medium text-brand">Talent Scout</p>
			<h1 class="mt-2 text-heading-sm font-semibold text-ink sm:text-heading">
				{data.job.title}
			</h1>
		</div>
	</header>

	<div class="mx-auto flex max-w-[640px] flex-col gap-6 px-4 py-8 lg:max-w-[1080px] lg:px-6">
		{#if data.demo}
			<p
				role="note"
				class="flex gap-2.5 rounded-input border border-brand bg-wash px-3.5 py-3 text-body-sm text-body"
			>
				<Info size={18} aria-hidden="true" class="mt-px shrink-0 text-brand" />
				<span><strong class="font-semibold">{COPY.demoLead}</strong> {COPY.demoRest}</span>
			</p>
		{/if}
		{#if success}
			<Card class="flex flex-col items-center gap-3 p-8 text-center">
				<CircleCheck size={40} aria-hidden="true" class="text-success-text" />
				<h2 class="text-subheading font-semibold text-ink">{COPY.successHeading}</h2>
				<p role="status">{success}</p>
			</Card>
		{:else}
			<div
				class="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-8"
			>
				<JobDescription source={data.job.description} toc bind:collapsible />

				{#if !open}
					<InlineError message={COPY.closed} />
				{:else}
					<div id="apply" bind:this={formCard} class="scroll-mt-6 lg:sticky lg:top-6">
						<Card>
							<form
								method="POST"
								enctype="multipart/form-data"
								novalidate
								use:enhance={submit}
								class="flex flex-col gap-4"
							>
								<h2 class="text-subheading font-semibold text-ink">{COPY.formHeading}</h2>

								{#if apiError}
									<InlineError message={apiError} />
								{/if}

								<Input
									label={COPY.name}
									name="name"
									autocomplete="name"
									required
									minlength={2}
									maxlength={100}
									value={values.name}
									error={errors.name}
								/>
								<Input
									label={COPY.email}
									name="email"
									type="email"
									autocomplete="email"
									required
									value={values.email}
									error={errors.email}
								/>

								<div class="flex flex-col gap-1">
									<span class="font-medium" id="cv-label">{COPY.cv}</span>
									<label
										class={[
											'flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-panel border border-dashed bg-card p-4 text-center focus-within:ring-2 focus-within:ring-focus hover:bg-wash',
											errors.cv ? 'border-danger' : 'border-line'
										]}
									>
										<FileText size={24} aria-hidden="true" class="text-helper" />
										<span class="text-body-sm text-muted">{cvName || COPY.cvHint}</span>
										<input
											type="file"
											name="cv"
											accept="application/pdf,.pdf"
											required
											aria-labelledby="cv-label"
											aria-invalid={errors.cv ? true : undefined}
											aria-describedby={errors.cv ? 'cv-error' : undefined}
											onchange={onCvChange}
											class="sr-only"
										/>
									</label>
									{#if errors.cv}
										<p id="cv-error" role="alert" class="text-caption text-danger-text">
											{errors.cv}
										</p>
									{/if}
								</div>

								<Button type="submit" variant="primary" size="lg" loading={submitting}>
									{submitting ? COPY.submitting : COPY.submit}
								</Button>
							</form>
						</Card>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	{#if applyBar && !formInView}
		<div
			class="fixed inset-x-0 bottom-0 border-t border-line bg-card px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-panel lg:hidden"
		>
			<Button href="#apply" variant="primary" class="h-12 w-full" onclick={goToForm}>
				{COPY.apply}<ArrowDown size={18} aria-hidden="true" />
			</Button>
		</div>
	{/if}
</main>
