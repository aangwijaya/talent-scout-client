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

/** The seq of the newest received event, or 0 before the first one arrives. */
export const receivedSeq = (events: readonly RunEvent[]) => events.at(-1)?.seq ?? 0;
