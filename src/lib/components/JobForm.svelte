<script lang="ts">
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Info from '@lucide/svelte/icons/info';
	import Lock from '@lucide/svelte/icons/lock';
	import Plus from '@lucide/svelte/icons/plus';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { tick, untrack } from 'svelte';
	import { applyAction, enhance, type SubmitFunction } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Markdown from '$lib/markdown/Markdown.svelte';
	import type { JobStatus, RubricCriterion } from '$lib/server/api/types';
	import Button from './Button.svelte';
	import {
		DESCRIPTION_MAX,
		RUBRIC_MAX,
		RUBRIC_MIN,
		applySuggestion,
		charCount,
		fieldId,
		keyFromLabel,
		validateJob,
		type FieldErrors,
		type JobValues,
		type SuggestError,
		type SuggestResult
	} from './job-form';

	type Props = {
		mode: 'create' | 'edit';
		initial: JobValues;
		/** Edit only: the job has applications, so its rubric can't change. */
		locked?: boolean;
		applicantCount?: number;
		/** From the action's `fail()` when JavaScript is off. */
		errors?: FieldErrors;
		cancelHref: string;
	};

	let {
		mode,
		initial,
		locked = false,
		applicantCount = 0,
		errors: serverErrors,
		cancelHref
	}: Props = $props();

	const COPY = {
		details: 'Details',
		title: 'Title',
		description: 'Description',
		write: 'Write',
		preview: 'Preview',
		markdownHint: 'Markdown: ## headings, - lists, **bold**',
		shownOnApply: 'Shown on the public apply page.',
		status: 'Status',
		statusHint: 'Closed jobs stay listed. New applications are refused; running interviews finish.',
		rubric: 'Rubric',
		rubricHint:
			'3 to 6 criteria. The interviewer plans topics from them and the scorer rates each one.',
		suggest: 'Suggest with AI',
		suggesting: 'Suggesting…',
		suggestHint: 'Uses the title and description · shared limit of 10 an hour',
		suggestedTitle: 'Suggested by AI from your description.',
		suggestedBody:
			'Review and edit before you save. Suggesting again asks first, then replaces these criteria.',
		confirmReplace: 'Replace the current criteria with a new suggestion?',
		unavailable: "The suggestion didn't come through. Try again, or write the criteria yourself.",
		signedOut: 'Your session ended. Sign in again in a new tab, then try Suggest again.',
		signIn: 'Sign in (new tab)',
		label: 'Label',
		key: 'Key',
		criterionDescription: 'Description',
		weight: 'Weight',
		add: 'Add criterion',
		cancel: 'Cancel',
		create: 'Create job',
		creating: 'Creating…',
		save: 'Save changes',
		saving: 'Saving…'
	};
	const lockedNote = (n: number) =>
		`Locked: ${n} ${n === 1 ? 'applicant was' : 'applicants were'} scored against these criteria. Title, description and status can still change.`;

	type Row = RubricCriterion & { uid: number; keyEdited: boolean };
	let nextUid = 0;
	const toRow = (criterion: RubricCriterion, keyEdited = true): Row => ({
		...criterion,
		uid: nextUid++,
		keyEdited
	});
	const blank = (): Row => toRow({ key: '', label: '', description: '', weight: 1 }, false);

	const start = untrack(() => initial);
	let title = $state(start.title);
	let description = $state(start.description);
	let status = $state<JobStatus>(start.status);
	let rows = $state<Row[]>(
		start.rubric.length > 0
			? start.rubric.map((c) => toRow(c))
			: Array.from({ length: RUBRIC_MIN }, blank)
	);
	let errors = $state<FieldErrors>(untrack(() => serverErrors ?? {}));
	let tab = $state<'write' | 'preview'>('write');
	let saving = $state(false);
	let suggesting = $state(false);
	let suggested = $state(false);
	let suggestError = $state<SuggestError | null>(null);

	const rubric = (): RubricCriterion[] =>
		rows.map(({ key, label, description, weight }) => ({ key, label, description, weight }));
	const values = (): JobValues => ({ title, description, status, rubric: rubric() });
	const descriptionLength = $derived(charCount(description));
	const hasCriteria = $derived(rows.some((r) => r.label || r.key || r.description));
	const rowError = (i: number) =>
		Object.keys(errors).some((field) => field.startsWith(`rubric[${i}].`));

	function setLabel(row: Row, label: string) {
		row.label = label;
		if (!row.keyEdited) row.key = keyFromLabel(label);
	}

	function add() {
		if (rows.length < RUBRIC_MAX) rows.push(blank());
	}

	function remove(i: number) {
		if (rows.length > RUBRIC_MIN) rows.splice(i, 1);
		errors = {};
	}

	async function focusFirstError() {
		await tick();
		const target =
			document.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid]') ??
			document.getElementById('form-error') ??
			document.getElementById('rubric-error');
		target?.focus();
	}

	async function suggest() {
		const check = validateJob(values(), { rubricLocked: true });
		const missing = Object.fromEntries(
			Object.entries(check).filter(([field]) => field === 'title' || field === 'description')
		);
		if (Object.keys(missing).length > 0) {
			errors = { ...errors, ...missing };
			await focusFirstError();
			return;
		}
		if (hasCriteria && !confirm(COPY.confirmReplace)) return;

		suggesting = true;
		suggestError = null;
		try {
			const res = await fetch(resolve('/dashboard/(recruiter)/jobs/rubric-suggestion'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ title, description })
			});
			// `handle` answers a JSON 401 here instead of redirecting, so the unsaved form stays put.
			const result: SuggestResult =
				res.status === 401
					? { ok: false, status: 401, retry_after_seconds: null }
					: await res.json();
			const outcome = applySuggestion(rubric(), result);
			suggestError = outcome.error;
			if (result.ok) {
				rows = outcome.rubric.map((c) => toRow(c));
				suggested = true;
				errors = {};
			}
		} catch {
			suggestError = { kind: 'unavailable' };
		} finally {
			suggesting = false;
		}
	}

	const submit: SubmitFunction = ({ cancel }) => {
		const found = validateJob(values(), { rubricLocked: locked });
		if (Object.keys(found).length > 0) {
			errors = found;
			cancel();
			void focusFirstError();
			return;
		}
		errors = {};
		saving = true;
		return async ({ result }) => {
			if (result.type === 'failure') {
				saving = false;
				errors = (result.data?.errors as FieldErrors | undefined) ?? {};
				await focusFirstError();
				return;
			}
			await applyAction(result);
			saving = false;
		};
	};

	const returnQuery = $derived(
		new URLSearchParams({ redirectTo: page.url.pathname + page.url.search })
	);

	const describedBy = (field: string) => (errors[field] ? `${fieldId(field)}-error` : undefined);
	const inputClass = (field: string, extra = '') => [
		'w-full rounded-input border bg-card px-3 text-base outline-hidden placeholder:text-helper focus:ring-2 focus:ring-focus read-only:bg-subtle read-only:text-muted',
		errors[field] ? 'border-danger' : 'border-line',
		extra
	];
</script>

{#snippet fieldError(field: string)}
	{#if errors[field]}
		<p
			id="{fieldId(field)}-error"
			class="mt-1.5 flex items-start gap-1.5 text-[13px] text-danger-text"
		>
			<CircleAlert size={14} aria-hidden="true" class="mt-0.5 shrink-0" />
			{errors[field]}
		</p>
	{/if}
{/snippet}

<form method="POST" use:enhance={submit} novalidate class="flex flex-col gap-[18px] max-sm:pb-24">
	<section
		aria-labelledby="details-title"
		class="rounded-card border border-line bg-card p-4 shadow-card sm:p-6"
	>
		<h2 id="details-title" class="text-subheading font-semibold text-ink">{COPY.details}</h2>

		<div class="mt-4">
			<label for={fieldId('title')} class="mb-1.5 block font-medium text-body">{COPY.title}</label>
			<input
				id={fieldId('title')}
				name="title"
				bind:value={title}
				autocomplete="off"
				aria-invalid={errors.title ? true : undefined}
				aria-describedby={describedBy('title')}
				class={inputClass('title', 'h-11')}
			/>
			{@render fieldError('title')}
		</div>

		<div class="mt-5">
			<span id="description-label" class="mb-1.5 block font-medium text-body"
				>{COPY.description}</span
			>
			<div
				class={[
					'overflow-hidden rounded-input border',
					errors.description ? 'border-danger' : 'border-line'
				]}
			>
				<div
					class="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-subtle px-2 py-1.5"
				>
					<div
						role="tablist"
						aria-labelledby="description-label"
						class="flex gap-1 rounded-full bg-subtle p-0.5"
					>
						{#each [['write', COPY.write], ['preview', COPY.preview]] as const as [id, name] (id)}
							<button
								type="button"
								role="tab"
								id="description-tab-{id}"
								aria-selected={tab === id}
								aria-controls="description-panel-{id}"
								tabindex={tab === id ? 0 : -1}
								onclick={() => (tab = id)}
								class={[
									'h-8 rounded-full px-3 text-body-sm font-medium outline-hidden focus-visible:ring-2 focus-visible:ring-focus',
									tab === id ? 'bg-card text-ink shadow-card' : 'text-muted hover:text-ink'
								]}>{name}</button
							>
						{/each}
					</div>
					<span class="px-1 text-caption text-helper">{COPY.markdownHint}</span>
				</div>
				<div
					id="description-panel-write"
					role="tabpanel"
					aria-labelledby="description-tab-write"
					hidden={tab !== 'write'}
				>
					<textarea
						id={fieldId('description')}
						name="description"
						bind:value={description}
						rows="11"
						aria-labelledby="description-label"
						aria-invalid={errors.description ? true : undefined}
						aria-describedby={['description-hint', describedBy('description')]
							.filter(Boolean)
							.join(' ')}
						class="block w-full resize-y bg-card p-3 font-mono text-[13px] leading-[1.6] text-body outline-hidden focus:ring-2 focus:ring-focus focus:ring-inset"
					></textarea>
				</div>
				<div
					id="description-panel-preview"
					role="tabpanel"
					aria-labelledby="description-tab-preview"
					hidden={tab !== 'preview'}
					class="min-h-60 bg-card p-4"
				>
					{#if tab === 'preview'}<Markdown source={description} />{/if}
				</div>
			</div>
			<div id="description-hint" class="mt-1.5 flex justify-between gap-3 text-caption text-helper">
				<span>{COPY.shownOnApply}</span>
				<span class={['font-mono', descriptionLength > DESCRIPTION_MAX && 'text-danger-text']}>
					{descriptionLength.toLocaleString('en-US')} / {DESCRIPTION_MAX.toLocaleString('en-US')}
				</span>
			</div>
			{@render fieldError('description')}
		</div>

		<fieldset class="mt-5">
			<legend class="mb-1.5 font-medium text-body">{COPY.status}</legend>
			<div class="flex gap-2">
				{#each [['open', 'Open'], ['closed', 'Closed']] as const as [value, name] (value)}
					<label
						class="flex h-9 cursor-pointer items-center rounded-full border border-line bg-card px-4 text-body-sm font-medium text-body has-checked:border-brand has-checked:bg-wash has-checked:text-brand has-focus-visible:ring-2 has-focus-visible:ring-focus"
					>
						<input type="radio" name="status" {value} bind:group={status} class="sr-only" />
						{name}
					</label>
				{/each}
			</div>
			<p class="mt-1.5 text-caption text-helper">{COPY.statusHint}</p>
			{@render fieldError('status')}
		</fieldset>
	</section>

	<section
		aria-labelledby="rubric-title"
		class="rounded-card border border-line bg-card p-4 shadow-card sm:p-6"
	>
		<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
			<div>
				<h2
					id="rubric-title"
					class="flex items-center gap-2 text-subheading font-semibold text-ink"
				>
					{#if locked}<Lock size={16} aria-hidden="true" class="text-muted" />{/if}
					{COPY.rubric}
				</h2>
				<p class="mt-1 text-body-sm text-muted">
					{locked ? lockedNote(applicantCount) : COPY.rubricHint}
				</p>
			</div>
			{#if !locked}
				<div class="flex shrink-0 flex-col items-start gap-1 sm:items-end">
					<Button variant="secondary" onclick={suggest} loading={suggesting}>
						{#if !suggesting}<Sparkles size={16} aria-hidden="true" />{/if}
						{suggesting ? COPY.suggesting : COPY.suggest}
					</Button>
					<span class="text-caption text-helper">{COPY.suggestHint}</span>
				</div>
			{/if}
		</div>

		{#if suggestError}
			<div
				role="alert"
				class="mt-4 flex items-start gap-2 rounded-input border border-danger bg-danger/10 p-3 text-body-sm text-danger-text"
			>
				<CircleAlert size={16} aria-hidden="true" class="mt-0.5 shrink-0" />
				<p>
					{#if suggestError.kind === 'rate_limited'}
						Suggestions are used up for this hour.
						{#if suggestError.minutes}Try again in <span class="font-mono"
								>{suggestError.minutes} min</span
							>,{:else}Try again later,{/if}
						or write the criteria yourself.
					{:else if suggestError.kind === 'signed_out'}
						{COPY.signedOut}
						<a
							href="{resolve('/dashboard/login')}?{returnQuery}"
							target="_blank"
							rel="noopener"
							class="font-medium underline underline-offset-2">{COPY.signIn}</a
						>
					{:else}
						{COPY.unavailable}
					{/if}
				</p>
			</div>
		{:else if suggested}
			<div
				role="status"
				class="mt-4 flex items-start gap-2 rounded-input border border-brand bg-wash p-3 text-body-sm text-body"
			>
				<Info size={16} aria-hidden="true" class="mt-0.5 shrink-0 text-brand" />
				<p><strong class="font-semibold">{COPY.suggestedTitle}</strong> {COPY.suggestedBody}</p>
			</div>
		{/if}

		{#if errors.rubric}
			<p
				id="rubric-error"
				tabindex="-1"
				class="mt-4 flex items-center gap-1.5 text-[13px] text-danger-text"
			>
				<CircleAlert size={14} aria-hidden="true" />{errors.rubric}
			</p>
		{/if}

		<ol class="mt-4 flex flex-col gap-3">
			{#each rows as row, i (row.uid)}
				{@const at = `rubric[${i}]`}
				<li
					class={[
						'rounded-input border bg-card p-4',
						rowError(i) ? 'border-danger' : 'border-line'
					]}
				>
					<div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
						<div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
							<div>
								<label for={fieldId(`${at}.label`)} class="mb-1 block text-caption text-muted"
									>{COPY.label}</label
								>
								<input
									id={fieldId(`${at}.label`)}
									name="{at}.label"
									value={row.label}
									oninput={(e) => setLabel(row, e.currentTarget.value)}
									readonly={locked}
									aria-invalid={errors[`${at}.label`] ? true : undefined}
									aria-describedby={describedBy(`${at}.label`)}
									class={inputClass(`${at}.label`, 'h-10 font-medium')}
								/>
							</div>
							<div>
								<label for={fieldId(`${at}.key`)} class="mb-1 block text-caption text-muted"
									>{COPY.key}</label
								>
								<input
									id={fieldId(`${at}.key`)}
									name="{at}.key"
									value={row.key}
									oninput={(e) => {
										row.key = e.currentTarget.value;
										row.keyEdited = true;
									}}
									readonly={locked}
									autocomplete="off"
									spellcheck="false"
									aria-invalid={errors[`${at}.key`] ? true : undefined}
									aria-describedby={describedBy(`${at}.key`)}
									class={inputClass(`${at}.key`, 'h-10 font-mono text-[13px] sm:text-[13px]')}
								/>
							</div>
							<div class="sm:col-span-2">
								<label
									for={fieldId(`${at}.description`)}
									class="mb-1 block text-caption text-muted"
								>
									{COPY.criterionDescription}
								</label>
								<textarea
									id={fieldId(`${at}.description`)}
									name="{at}.description"
									bind:value={row.description}
									rows="2"
									readonly={locked}
									aria-invalid={errors[`${at}.description`] ? true : undefined}
									aria-describedby={describedBy(`${at}.description`)}
									class={inputClass(`${at}.description`, 'block resize-y py-2')}></textarea>
							</div>
						</div>
						<div
							class="flex items-end justify-between gap-3 sm:flex-col sm:items-end sm:justify-start"
						>
							<div>
								<span
									id="{fieldId(`${at}.weight`)}-label"
									class="mb-1 block text-caption text-muted">{COPY.weight}</span
								>
								<input type="hidden" name="{at}.weight" value={row.weight} />
								<div
									role="group"
									id={fieldId(`${at}.weight`)}
									tabindex="-1"
									aria-labelledby="{fieldId(`${at}.weight`)}-label"
									data-invalid={errors[`${at}.weight`] ? true : undefined}
									aria-describedby={describedBy(`${at}.weight`)}
									class="flex overflow-hidden rounded-input border border-line"
								>
									{#each [1, 2, 3] as weight (weight)}
										<button
											type="button"
											aria-pressed={row.weight === weight}
											disabled={locked}
											onclick={() => (row.weight = weight)}
											class={[
												'h-9 w-10 font-mono text-body-sm outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset disabled:cursor-not-allowed',
												row.weight === weight
													? 'bg-brand text-card'
													: 'bg-card text-body hover:bg-subtle disabled:bg-subtle'
											]}>×{weight}</button
										>
									{/each}
								</div>
							</div>
							{#if !locked}
								<button
									type="button"
									aria-label="Remove criterion {i + 1}"
									disabled={rows.length <= RUBRIC_MIN}
									onclick={() => remove(i)}
									class="grid size-9 place-items-center rounded-full text-muted outline-hidden hover:bg-subtle hover:text-danger-text focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:text-helper disabled:hover:bg-transparent"
								>
									<Trash2 size={16} aria-hidden="true" />
								</button>
							{/if}
						</div>
						{#each ['label', 'key', 'description', 'weight'] as field (field)}
							<div class="empty:hidden sm:col-span-2">{@render fieldError(`${at}.${field}`)}</div>
						{/each}
					</div>
				</li>
			{/each}
		</ol>

		{#if !locked}
			<div class="mt-3 flex items-center justify-between">
				<button
					type="button"
					onclick={add}
					disabled={rows.length >= RUBRIC_MAX}
					class="inline-flex h-9 items-center gap-2 rounded-full px-3 text-body-sm font-medium text-brand outline-hidden hover:bg-wash focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:text-helper disabled:hover:bg-transparent"
				>
					<Plus size={16} aria-hidden="true" />{COPY.add}
				</button>
				<span class="font-mono text-caption text-helper">{rows.length} / {RUBRIC_MAX}</span>
			</div>
		{/if}
	</section>

	{#if errors.form}
		<div
			id="form-error"
			tabindex="-1"
			role="alert"
			class="flex items-start gap-2 rounded-input border border-danger bg-danger/10 p-3 text-body-sm text-danger-text"
		>
			<CircleAlert size={16} aria-hidden="true" class="mt-0.5 shrink-0" />
			<p>{errors.form}</p>
		</div>
	{/if}

	<div
		class="z-10 flex gap-3 max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:border-t max-sm:border-line max-sm:bg-card max-sm:p-3 max-sm:pb-[calc(12px+env(safe-area-inset-bottom))] sm:sticky sm:bottom-0 sm:justify-end sm:bg-linear-to-t sm:from-canvas sm:from-60% sm:pt-8 sm:pb-4"
	>
		<Button
			href={cancelHref}
			class="max-sm:h-12 max-sm:flex-1 max-sm:border-brand max-sm:text-brand sm:border-transparent sm:bg-transparent"
		>
			{COPY.cancel}
		</Button>
		<Button type="submit" variant="primary" loading={saving} class="max-sm:h-12 max-sm:flex-[2]">
			{#if mode === 'create'}{saving ? COPY.creating : COPY.create}{:else}{saving
					? COPY.saving
					: COPY.save}{/if}
		</Button>
	</div>
</form>
