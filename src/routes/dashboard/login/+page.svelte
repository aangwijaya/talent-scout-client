<script lang="ts">
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Info from '@lucide/svelte/icons/info';
	import Lock from '@lucide/svelte/icons/lock';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { enhance } from '$app/forms';
	import Button from '$lib/components/Button.svelte';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let submitting = $state(false);
	let showPassword = $state(false);

	const COPY = {
		title: 'Sign in',
		description: 'Recruiter dashboard. Enter the team password.',
		password: 'Password',
		show: 'Show password',
		hide: 'Hide password',
		submit: 'Sign in',
		stay: 'You stay signed in for 12 hours on this browser.',
		sessionEnded: 'Your session ended. Sign in again to continue where you left off.',
		product:
			'Applicants chat with an AI screener for about 15 minutes. You review the transcript, scores with evidence quotes, and the agent graph as it runs, then decide who moves forward.',
		demoTitle: 'Demo access',
		demoBody: 'This is a public demo. Sign in with the password below.',
		copy: 'Copy',
		copyLabel: 'Copy demo password',
		copied: 'Copied'
	};

	const inputId = $props.id();
	const errorId = `${inputId}-error`;
	const demoHeadingId = `${inputId}-demo`;
</script>

<svelte:head><title>Sign in · Talent Scout</title></svelte:head>

<main
	class={[
		'flex min-h-dvh flex-col items-center justify-center bg-canvas',
		data.demoPassword ? 'gap-5 px-4 py-10' : 'gap-6 p-4 sm:p-6'
	]}
>
	<Logo />
	{#if data.demoPassword}
		<p class="w-full max-w-[400px] text-body-sm text-muted">{COPY.product}</p>
	{/if}
	<div
		class="w-full max-w-[400px] rounded-panel border border-line bg-card p-6 shadow-panel sm:p-8"
	>
		{#if data.sessionEnded && !form?.error}
			<p
				role="status"
				class="mb-6 flex gap-2 rounded-card border border-brand bg-wash p-3 text-body-sm text-body"
			>
				<Lock size={16} aria-hidden="true" class="mt-0.5 shrink-0 text-brand" />
				{COPY.sessionEnded}
			</p>
		{/if}
		<h1 class="text-heading-sm font-semibold text-ink">{COPY.title}</h1>
		<p class="mt-1 mb-6 text-body-sm text-muted">{COPY.description}</p>
		<form
			method="POST"
			class="flex flex-col gap-4"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}}
		>
			<div class="flex flex-col gap-1">
				<label for={inputId} class="font-medium text-ink">{COPY.password}</label>
				<div class="relative">
					<input
						id={inputId}
						name="password"
						type={showPassword ? 'text' : 'password'}
						autocomplete="current-password"
						required
						aria-invalid={form?.error ? true : undefined}
						aria-describedby={form?.error ? errorId : undefined}
						class={[
							'h-11 w-full rounded-input border bg-card py-2 pr-12 pl-3 text-base outline-hidden focus:ring-2 focus:ring-focus',
							form?.error ? 'border-danger' : 'border-line'
						]}
					/>
					<button
						type="button"
						aria-label={showPassword ? COPY.hide : COPY.show}
						onclick={() => (showPassword = !showPassword)}
						class="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-r-input text-helper hover:text-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-hidden"
					>
						{#if showPassword}
							<EyeOff size={16} aria-hidden="true" />
						{:else}
							<Eye size={16} aria-hidden="true" />
						{/if}
					</button>
				</div>
				{#if form?.error}
					<p
						id={errorId}
						role="alert"
						class="flex items-center gap-1 text-caption text-danger-text"
					>
						<TriangleAlert size={12} aria-hidden="true" class="shrink-0" />
						{form.error}
					</p>
				{/if}
			</div>
			<!-- 40px: an approved exception to the 36px button, as the page's only action. -->
			<Button type="submit" variant="primary" loading={submitting} class="h-10 w-full">
				{COPY.submit}
			</Button>
		</form>
		<p class="mt-4 text-caption text-helper">{COPY.stay}</p>
	</div>
	{#if data.demoPassword}
		<section
			aria-labelledby={demoHeadingId}
			class="flex w-full max-w-[400px] flex-col gap-3.5 rounded-panel border border-line bg-wash px-6 py-5"
		>
			<div class="flex gap-2.5">
				<Info size={18} aria-hidden="true" class="mt-0.5 shrink-0 text-brand" />
				<div>
					<h2 id={demoHeadingId} class="text-body-sm font-semibold text-ink">{COPY.demoTitle}</h2>
					<p class="text-body-sm text-muted">{COPY.demoBody}</p>
				</div>
			</div>
			<div
				class="flex items-center justify-between gap-3 rounded-input border border-line bg-card py-1.5 pr-1.5 pl-3.5"
			>
				<span
					data-testid="demo-password"
					class="min-w-0 font-mono text-body-sm font-medium break-all text-ink select-all"
					>{data.demoPassword}</span
				>
				<CopyButton
					value={data.demoPassword}
					label={COPY.copy}
					ariaLabel={COPY.copyLabel}
					announcement={COPY.copied}
				/>
			</div>
		</section>
	{/if}
</main>
