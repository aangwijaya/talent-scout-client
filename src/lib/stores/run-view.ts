// View rules of the graph run page that don't need the DOM: when the run counts as ended, what a
// mode switch does, and the connection copy.
import type { RunStatus } from '$lib/server/api/types';
import type { ConnectionStatus } from './run-stream';

export type ViewMode = 'live' | 'replay';

/** Ended per the snapshot, the events so far, or a stream with nothing more to send. */
export function isRunEnded(
	snapshotStatus: RunStatus,
	reducedStatus: RunStatus,
	connection: ConnectionStatus
): boolean {
	return snapshotStatus !== 'running' || reducedStatus !== 'running' || connection === 'ended';
}

/**
 * The mode and replay position after the recruiter picks a mode, or null when Live is not allowed.
 * A null position follows the newest event, so Replay never freezes before the first one arrives.
 */
export function switchMode(
	requested: ViewMode,
	{ ended, eventCount }: { ended: boolean; eventCount: number }
): { mode: ViewMode; position: number | null } | null {
	if (requested === 'live' && ended) return null;
	return {
		mode: requested,
		position: requested === 'replay' && eventCount > 0 ? eventCount : null
	};
}

export const showConnectionAlert = (connection: ConnectionStatus) =>
	connection === 'lost' || connection === 'reconnecting';

export function connectionAlertText(mode: ViewMode, lastSeq: number): string {
	return mode === 'live'
		? `Live updates stopped at event #${lastSeq}. Reconnect to load the events after it.`
		: "Couldn't load the run events. Reconnect to try again.";
}

export function liveStatusText(
	connection: ConnectionStatus,
	ended: boolean,
	lastSeq: number
): string {
	if (connection === 'reconnecting') return `Reconnecting from event #${lastSeq}…`;
	if (connection === 'lost') return `Disconnected at event #${lastSeq}`;
	if (ended) return `The run ended at event #${lastSeq}. Switch to Replay to step through it.`;
	return `Receiving events · last event #${lastSeq}`;
}
