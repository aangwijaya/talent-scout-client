import { formatCount } from '$lib/components/graph-layout';
import { formatCost } from '$lib/components/review';
import type { RunEvent } from '$lib/events';
import type { RunState } from '$lib/stores/graph';

/** The header band's status and totals, all from one state so they follow the replay position together. */
export function runHeader(state: RunState) {
	return {
		status: state.status,
		cost: formatCost(state.costUsd),
		tokens: `${formatCount(state.tokensIn)} in · ${formatCount(state.tokensOut)} out`
	};
}

const nodeName = (id: string) => id.replaceAll('_', ' ');

/**
 * What the live region says for an event: node starts, failures and retries, and the run's end.
 * Everything else (deltas, edges, checks) is too chatty for a screen reader, so it returns null.
 */
export function announcement(event: RunEvent): string | null {
	switch (event.event) {
		case 'node.started':
			return `${nodeName(event.node_id)} started`;
		case 'node.failed':
			return `${nodeName(event.node_id)} failed${event.data.will_retry ? ', retrying' : ''}`;
		case 'loop.retry':
			return `${nodeName(event.node_id)} retry, attempt ${event.data.attempt} of ${event.data.max_attempts}`;
		case 'run.completed':
			return 'Run completed';
		case 'run.failed':
			return 'Run failed';
		default:
			return null;
	}
}

/** The newest announceable event among `events`, or null when none of them is worth saying. */
export function latestAnnouncement(events: readonly RunEvent[]): string | null {
	for (let i = events.length - 1; i >= 0; i--) {
		const text = announcement(events[i]);
		if (text) return text;
	}
	return null;
}

/** The seq of the newest received event, or 0 before the first one arrives. */
export const receivedSeq = (events: readonly RunEvent[]) => events.at(-1)?.seq ?? 0;
