import { describe, expect, it } from 'vitest';
import {
	canAnswerByVoice,
	formatClock,
	microphoneFailure,
	pickMimeType,
	spokenEntry,
	typedEntry,
	uploadFailure
} from './answer';

describe('uploadFailure', () => {
	it('422 no_speech asks to record again', () => {
		expect(uploadFailure(422, 'no_speech')).toEqual({
			kind: 'no_speech',
			message: "We didn't catch any speech. Check your microphone and try again.",
			next: 'record'
		});
	});

	it('502 transcription_unavailable keeps the recording: try again or type instead', () => {
		expect(uploadFailure(502, 'transcription_unavailable')).toEqual({
			kind: 'transcription',
			message: "We couldn't transcribe that. Your recording is kept.",
			next: 'retry',
			fallback: 'transcription_failed'
		});
	});

	it('409 audio_budget_exceeded switches to text for the rest of the session', () => {
		expect(uploadFailure(409, 'audio_budget_exceeded')).toMatchObject({
			kind: 'budget',
			message: expect.stringMatching(/recording time/i),
			next: 'text'
		});
	});

	it.each([
		[400, 'validation_failed'],
		[413, 'file_too_large']
	])('%i %s says the recording was too long and records again', (status, code) => {
		expect(uploadFailure(status, code)).toMatchObject({
			kind: 'too_long',
			message: expect.stringMatching(/too long/i),
			next: 'record'
		});
	});

	it.each([
		[410, 'session_completed'],
		[410, 'session_expired']
	])('%i %s ends the session view', (status, code) => {
		expect(uploadFailure(status, code)).toMatchObject({ kind: 'ended', next: 'reload' });
	});

	it('anything else keeps the recording for a retry, without echoing the API', () => {
		expect(uploadFailure(500, null)).toMatchObject({
			kind: 'other',
			message: expect.stringMatching(/try again/i),
			next: 'retry'
		});
	});

	it('a blocked or missing microphone switches to text', () => {
		expect(microphoneFailure()).toEqual({
			kind: 'microphone',
			message:
				"Your browser blocked the microphone, so you'll answer in text. Allow it in your browser settings to use voice again.",
			next: 'text',
			fallback: 'microphone_unavailable'
		});
	});
});

describe('entries', () => {
	it('a spoken entry carries mode, the three signals and no character counts', () => {
		expect(
			spokenEntry({
				questionAt: 1_000,
				firstRecordAt: 1_900,
				speakingMs: 17_500,
				rerecords: 2,
				sentAt: 31_000
			})
		).toEqual({
			pasted_chars: 0,
			typed_chars: 0,
			duration_ms: 29_100,
			mode: 'spoken',
			start_latency_ms: 900,
			speaking_ms: 17_500,
			rerecord_count: 2
		});
	});

	it('clamps a negative latency (question shown after the clock reading) to zero', () => {
		const entry = spokenEntry({
			questionAt: 5_000,
			firstRecordAt: 4_000,
			speakingMs: 1,
			rerecords: 0,
			sentAt: 6_000
		});
		expect(entry.start_latency_ms).toBe(0);
	});

	it.each([
		'chose_text',
		'declined_recording',
		'microphone_unavailable',
		'transcription_failed'
	] as const)(
		'a typed answer in a voice session carries mode typed and fallback_reason %s',
		(reason) => {
			expect(typedEntry({ pasted_chars: 1, typed_chars: 4, duration_ms: 800 }, reason)).toEqual({
				pasted_chars: 1,
				typed_chars: 4,
				duration_ms: 800,
				mode: 'typed',
				fallback_reason: reason
			});
		}
	);

	it('a typed answer with no input events still carries its reason', () => {
		expect(typedEntry(null, 'chose_text')).toEqual({
			pasted_chars: 0,
			typed_chars: 0,
			duration_ms: 0,
			mode: 'typed',
			fallback_reason: 'chose_text'
		});
	});
});

describe('canAnswerByVoice', () => {
	it('offers voice again after choosing text or a failed transcription', () => {
		expect(canAnswerByVoice('chose_text', false)).toBe(true);
		expect(canAnswerByVoice('transcription_failed', false)).toBe(true);
	});

	it('hides voice after a declined consent, a blocked microphone or a spent budget', () => {
		expect(canAnswerByVoice('declined_recording', false)).toBe(false);
		expect(canAnswerByVoice('microphone_unavailable', false)).toBe(false);
		expect(canAnswerByVoice('chose_text', true)).toBe(false);
	});
});

describe('pickMimeType', () => {
	it('prefers webm/opus, then mp4 (Safari)', () => {
		expect(pickMimeType(() => true)).toBe('audio/webm;codecs=opus');
		expect(pickMimeType((t) => t === 'audio/mp4')).toBe('audio/mp4');
		expect(pickMimeType(() => false)).toBeUndefined();
	});
});

describe('formatClock', () => {
	it('formats m:ss', () => {
		expect(formatClock(42_400)).toBe('0:42');
		expect(formatClock(120_000)).toBe('2:00');
		expect(formatClock(980_000)).toBe('16:20');
		expect(formatClock(-5)).toBe('0:00');
	});
});
