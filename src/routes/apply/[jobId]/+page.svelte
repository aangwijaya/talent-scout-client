<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import FileText from '@lucide/svelte/icons/file-text';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import InlineError from '$lib/components/InlineError.svelte';
	import Input from '$lib/components/Input.svelte';
	import { validateApplication, validateCv, type ApplicationErrors } from './validate';
	import type { PageProps } from './$types';

	const COPY = {
		submit: 'Submit application',
		submitting: 'Submitting…',
		jobDescription: 'Job description',
		formHeading: 'Your details',
		name: 'Full name',
		email: 'Email',
		cv: 'CV (PDF, max 2 MB)',
		cvHint: 'Choose a PDF file',
		closed: 'This job is no longer accepting applications.',
		successHeading: 'Application received'
	};

	let { data, form }: PageProps = $props();

	let submitting = $state(false);
	let clientErrors = $state<ApplicationErrors>({});
	let cvName = $state('');

	const errors = $derived<ApplicationErrors>({
		...(form && 'errors' in form ? form.errors : {}),
		...clientErrors
	});
	const values = $derived((form && 'values' in form && form.values) || { name: '', email: '' });
	const success = $derived(form && 'message' in form ? form.message : null);
	const apiError = $derived(form && 'error' in form ? form.error : null);

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

<main class="min-h-screen bg-canvas text-body">
	<header class="bg-wash px-4 py-10">
		<div class="mx-auto max-w-[640px]">
			<p class="text-body-sm font-medium text-brand">Talent Scout</p>
			<h1 class="mt-2 text-heading-sm font-semibold text-ink sm:text-heading">
				{data.job.title}
			</h1>
		</div>
	</header>

	<div class="mx-auto flex max-w-[640px] flex-col gap-6 px-4 py-8">
		{#if success}
			<Card class="flex flex-col items-center gap-3 p-8 text-center">
				<CircleCheck size={40} aria-hidden="true" class="text-success-text" />
				<h2 class="text-subheading font-semibold text-ink">{COPY.successHeading}</h2>
				<p role="status">{success}</p>
			</Card>
		{:else}
			<Card>
				<details open>
					<summary class="cursor-pointer font-semibold text-ink">{COPY.jobDescription}</summary>
					<p class="mt-3 whitespace-pre-line text-muted">{data.job.description}</p>
				</details>
			</Card>

			{#if data.job.status === 'closed'}
				<InlineError message={COPY.closed} />
			{:else}
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
								<p id="cv-error" role="alert" class="text-caption text-danger-text">{errors.cv}</p>
							{/if}
						</div>

						<Button type="submit" variant="primary" size="lg" loading={submitting}>
							{submitting ? COPY.submitting : COPY.submit}
						</Button>
					</form>
				</Card>
			{/if}
		{/if}
	</div>
</main>
