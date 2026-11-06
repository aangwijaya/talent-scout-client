<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Circle from '@lucide/svelte/icons/circle';
	import Loader from '@lucide/svelte/icons/loader';
	import Minus from '@lucide/svelte/icons/minus';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import X from '@lucide/svelte/icons/x';

	type ApplicationStatus =
		| 'applied'
		| 'invited'
		| 'in_session'
		| 'scoring'
		| 'review'
		| 'shortlisted'
		| 'rejected'
		| 'failed';
	type NodeStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
	type Status = ApplicationStatus | NodeStatus | 'retry' | 'needs_manual';

	type Props = {
		status: Status;
		/** Replaces the default label when it carries data, e.g. "Retry 2/3". */
		label?: string;
	};

	let { status, label }: Props = $props();

	const tones = {
		idle: { dot: 'bg-line', fill: 'bg-card', text: 'text-helper', icon: Circle },
		running: { dot: 'bg-brand', fill: 'bg-wash', text: 'text-brand', icon: Loader },
		passed: { dot: 'bg-success', fill: 'bg-success/10', text: 'text-success-text', icon: Check },
		failed: { dot: 'bg-danger', fill: 'bg-danger/10', text: 'text-danger-text', icon: X },
		retry: { dot: 'bg-warning', fill: 'bg-warning/10', text: 'text-warning-text', icon: RotateCcw },
		skipped: { dot: 'bg-line', fill: 'bg-subtle', text: 'text-muted', icon: Minus }
	};

	const statuses: Record<Status, { tone: keyof typeof tones; label: string }> = {
		applied: { tone: 'idle', label: 'Applied' },
		invited: { tone: 'idle', label: 'Invited' },
		in_session: { tone: 'running', label: 'In session' },
		scoring: { tone: 'retry', label: 'Scoring' },
		review: { tone: 'running', label: 'Review' },
		shortlisted: { tone: 'passed', label: 'Shortlisted' },
		rejected: { tone: 'failed', label: 'Rejected' },
		failed: { tone: 'failed', label: 'Failed' },
		pending: { tone: 'idle', label: 'Idle' },
		running: { tone: 'running', label: 'Running' },
		succeeded: { tone: 'passed', label: 'Passed' },
		skipped: { tone: 'skipped', label: 'Skipped' },
		retry: { tone: 'retry', label: 'Retry' },
		needs_manual: { tone: 'retry', label: 'Needs manual review' }
	};

	const entry = $derived(statuses[status]);
	const tone = $derived(tones[entry.tone]);
</script>

<!-- The opaque base keeps status tints readable on any background (DESIGN.md §2.1). -->
<span class="inline-flex rounded-full bg-card">
	<span
		class={[
			'inline-flex items-center gap-1 rounded-full px-2 py-1 text-caption font-medium',
			tone.fill,
			tone.text
		]}
	>
		<span class={['size-1.5 rounded-full', tone.dot]}></span>
		<tone.icon
			size={12}
			aria-hidden="true"
			class={status === 'running' ? 'motion-safe:animate-spin' : ''}
		/>
		{label ?? entry.label}
	</span>
</span>
