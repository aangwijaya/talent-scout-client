// Pure rules behind a spoken answer (FR-16): error copy and next step, the entry signals, and
// when voice is still on offer. Browser-safe: only types come from the server API module.
import type { AudioUploadResponse, FallbackReason, MessageEntry } from '$lib/server/api/types';

export type AudioUpload = AudioUploadResponse;

export type VoiceFailure = {
	kind: 'no_speech' | 'transcription' | 'budget' | 'too_long' | 'microphone' | 'ended' | 'other';
	message: string;
	/** `record`: record again; `retry`: re-send the kept recording; `text`: answer in text; `reload`: the session ended. */
	next: 'record' | 'retry' | 'text' | 'reload';
	/** The `fallback_reason` for a typed answer that this failure leads to. */
	fallback?: FallbackReason;
};

export const VOICE_COPY = {
	noSpeech: "We didn't catch any speech. Check your microphone and try again.",
	transcription: "We couldn't transcribe that. Your recording is kept.",
	budget:
		"You've used all the recording time for this interview, so you'll answer the rest in text.",
	tooLong: 'That recording was too long or too large. Please record a shorter answer.',
	microphone:
		"Your browser blocked the microphone, so you'll answer in text. Allow it in your browser settings to use voice again.",
	ended: 'This screening session has ended.',
	other: 'We could not upload your recording. Please try again.'
};

export function uploadFailure(status: number, code: string | null): VoiceFailure {
	if (code === 'no_speech')
		return { kind: 'no_speech', message: VOICE_COPY.noSpeech, next: 'record' };
	if (code === 'transcription_unavailable') {
		return {
			kind: 'transcription',
			message: VOICE_COPY.transcription,
			next: 'retry',
			fallback: 'transcription_failed'
		};
	}
	if (code === 'audio_budget_exceeded') {
		// The contract has no reason for a spent budget; the server refused to transcribe, so this
		// is the closest one.
		return {
			kind: 'budget',
			message: VOICE_COPY.budget,
			next: 'text',
			fallback: 'transcription_failed'
		};
	}
	if (status === 400 || status === 413) {
		return { kind: 'too_long', message: VOICE_COPY.tooLong, next: 'record' };
	}
	if (status === 410) return { kind: 'ended', message: VOICE_COPY.ended, next: 'reload' };
	return { kind: 'other', message: VOICE_COPY.other, next: 'retry' };
}

export function microphoneFailure(): VoiceFailure {
	return {
		kind: 'microphone',
		message: VOICE_COPY.microphone,
		next: 'text',
		fallback: 'microphone_unavailable'
	};
}

const ENTRY_MAX = 10_000_000;
const clamp = (n: number) => Math.min(ENTRY_MAX, Math.max(0, Math.round(n)));

export type SpokenTiming = {
	/** When the question was shown. */
	questionAt: number;
	/** When the first take of this answer started recording. */
	firstRecordAt: number;
	/** Length of the take being sent. */
	speakingMs: number;
	rerecords: number;
	sentAt: number;
};

export function spokenEntry(t: SpokenTiming): MessageEntry {
	return {
		pasted_chars: 0,
		typed_chars: 0,
		duration_ms: clamp(t.sentAt - t.firstRecordAt),
		mode: 'spoken',
		start_latency_ms: clamp(t.firstRecordAt - t.questionAt),
		speaking_ms: clamp(t.speakingMs),
		rerecord_count: clamp(t.rerecords)
	};
}

/** A typed answer in a voice session always says why it was typed. */
export function typedEntry(snapshot: MessageEntry | null, reason: FallbackReason): MessageEntry {
	return {
		...(snapshot ?? { pasted_chars: 0, typed_chars: 0, duration_ms: 0 }),
		mode: 'typed',
		fallback_reason: reason
	};
}

/** Whether "Answer by voice" is offered while answering in text. */
export function canAnswerByVoice(reason: FallbackReason, budgetSpent: boolean): boolean {
	if (budgetSpent) return false;
	return reason === 'chose_text' || reason === 'transcription_failed';
}

const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

/** webm/opus where supported, `audio/mp4` on Safari; `undefined` lets the browser pick. */
export function pickMimeType(isSupported: (type: string) => boolean): string | undefined {
	return MIME_TYPES.find(isSupported);
}

export function formatClock(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
