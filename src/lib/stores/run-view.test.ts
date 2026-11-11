import { describe, expect, it } from 'vitest';
import {
	connectionAlertText,
	isRunEnded,
	liveStatusText,
	showConnectionAlert,
	switchMode
} from './run-view';

describe('isRunEnded', () => {
	it('is ended when the snapshot, the reduced events or the stream says so', () => {
		expect(isRunEnded('running', 'running', 'live')).toBe(false);
		expect(isRunEnded('succeeded', 'running', 'connecting')).toBe(true);
		expect(isRunEnded('running', 'failed', 'live')).toBe(true);
		// The mock replay of a running run ran out of events.
		expect(isRunEnded('running', 'running', 'ended')).toBe(true);
	});
});

describe('switchMode', () => {
	it('keeps Live disabled for an ended run', () => {
		expect(switchMode('live', { ended: true, eventCount: 12 })).toBeNull();
	});

	it('switches to Live for a running run and follows the newest event', () => {
		expect(switchMode('live', { ended: false, eventCount: 5 })).toEqual({
			mode: 'live',
			position: null
		});
	});

	it('pauses Replay at the newest event received so far', () => {
		expect(switchMode('replay', { ended: false, eventCount: 7 })).toEqual({
			mode: 'replay',
			position: 7
		});
	});

	it('follows the end in Replay when no event has arrived yet, so it never freezes at 0', () => {
		expect(switchMode('replay', { ended: true, eventCount: 0 })).toEqual({
			mode: 'replay',
			position: null
		});
	});
});

describe('connection alert', () => {
	it('shows whenever the stream is lost or reconnecting, in both modes', () => {
		expect(showConnectionAlert('lost')).toBe(true);
		expect(showConnectionAlert('reconnecting')).toBe(true);
		expect(showConnectionAlert('live')).toBe(false);
		expect(showConnectionAlert('connecting')).toBe(false);
		expect(showConnectionAlert('ended')).toBe(false);
	});

	it('uses the Live copy in Live and the load-failure copy in Replay', () => {
		expect(connectionAlertText('live', 9)).toBe(
			'Live updates stopped at event #9. Reconnect to load the events after it.'
		);
		expect(connectionAlertText('replay', 0)).toBe(
			"Couldn't load the run events. Reconnect to try again."
		);
	});
});

describe('liveStatusText', () => {
	it('reports streaming, reconnecting and a lost stream', () => {
		expect(liveStatusText('live', false, 12)).toBe('Receiving events · last event #12');
		expect(liveStatusText('reconnecting', false, 12)).toBe('Reconnecting from event #12…');
		expect(liveStatusText('lost', false, 12)).toBe('Disconnected at event #12');
	});

	it('stops saying "Receiving events" once the run or the stream has ended', () => {
		expect(liveStatusText('ended', true, 12)).toBe(
			'The run ended at event #12. Switch to Replay to step through it.'
		);
		expect(liveStatusText('live', true, 30)).toBe(
			'The run ended at event #30. Switch to Replay to step through it.'
		);
	});
});
