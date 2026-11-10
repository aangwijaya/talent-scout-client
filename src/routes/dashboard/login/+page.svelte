<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Input from '$lib/components/Input.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>Recruiter login · Talent Scout</title></svelte:head>

<main class="flex min-h-dvh items-center justify-center bg-canvas p-6">
	<Card class="w-full max-w-sm p-6">
		<h1 class="mb-1 text-heading-sm text-ink">Recruiter login</h1>
		<p class="mb-6 text-body-sm text-muted">Sign in to review applicants.</p>
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
			<Input
				label="Password"
				name="password"
				type="password"
				autocomplete="current-password"
				required
				error={form?.error}
			/>
			<Button type="submit" variant="primary" loading={submitting}>Sign in</Button>
		</form>
	</Card>
</main>
