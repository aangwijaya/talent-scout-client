<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Circle from '@lucide/svelte/icons/circle';
	import Eye from '@lucide/svelte/icons/eye';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import Loader from '@lucide/svelte/icons/loader';
	import Mail from '@lucide/svelte/icons/mail';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import Minus from '@lucide/svelte/icons/minus';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import X from '@lucide/svelte/icons/x';
	import type { Component } from 'svelte';
	import type { ApplicationStatus, JobStatus, NodeStatus } from '$lib/server/api/types';

	type Status = ApplicationStatus | JobStatus | NodeStatus | 'retry' | 'needs_manual';

	type Props = {
		status: Status;
		/** Replaces the default label when it carries data, e.g. "Retry 2/3". */
		label?: string;
	};

	let { status, label }: Props = $props();

	// DESIGN.md §2.2. `neutral` is the approved idle tone for applications and jobs (client#36).
	const tones = {
		idle: { dot: 'bg-line', fill: 'bg-card', text: 'text-helper' },
		neutral: { dot: 'bg-line', fill: 'bg-subtle', text: 'text-muted' },
		running: { dot: 'bg-brand', fill: 'bg-wash', text: 'text-brand' },
		brand: { dot: 'bg-brand', fill: 'bg-brand/10', text: 'text-brand' },
		passed: { dot: 'bg-success', fill: 'bg-success/10', text: 'text-success-text' },
		failed: { dot: 'bg-danger', fill: 'bg-danger/10', text: 'text-danger-text' },
		retry: { dot: 'bg-warning', fill: 'bg-warning/10', text: 'text-warning-text' },
		skipped: { dot: 'bg-line', fill: 'bg-subtle', text: 'text-muted' }
	};

	const statuses: Record<Status, { tone: keyof typeof tones; label: string; icon: Component }> = {
		applied: { tone: 'neutral', label: 'Applied', icon: Circle },
		invited: { tone: 'neutral', label: 'Invited', icon: Mail },
		in_session: { tone: 'brand', label: 'In session', icon: MessageCircle },
		scoring: { tone: 'retry', label: 'Scoring', icon: Hourglass },
		review: { tone: 'brand', label: 'Review', icon: Eye },
		shortlisted: { tone: 'passed', label: 'Shortlisted', icon: Check },
		rejected: { tone: 'failed', label: 'Rejected', icon: X },
		failed: { tone: 'failed', label: 'Failed', icon: TriangleAlert },
		open: { tone: 'passed', label: 'Open', icon: Check },
		closed: { tone: 'neutral', label: 'Closed', icon: Circle },
		pending: { tone: 'idle', label: 'Idle', icon: Circle },
		running: { tone: 'running', label: 'Running', icon: Loader },
		succeeded: { tone: 'passed', label: 'Passed', icon: Check },
		skipped: { tone: 'skipped', label: 'Skipped', icon: Minus },
		retry: { tone: 'retry', label: 'Retry', icon: RotateCcw },
		needs_manual: { tone: 'retry', label: 'Needs manual review', icon: RotateCcw }
	};

	const entry = $derived(statuses[status]);
	const tone = $derived(tones[entry.tone]);
</script>

<!-- The opaque base keeps status tints readable on any background (DESIGN.md §2.1). -->
<span class="inline-flex rounded-full bg-card">
	<span
		class={[
			'inline-flex items-center gap-1 rounded-full px-2 py-1 text-caption font-medium whitespace-nowrap',
			tone.fill,
			tone.text
		]}
	>
		<span class={['size-1.5 rounded-full', tone.dot]}></span>
		<entry.icon
			size={12}
			aria-hidden="true"
			class={status === 'running' ? 'motion-safe:animate-spin' : ''}
		/>
		{label ?? entry.label}
	</span>
</span>
