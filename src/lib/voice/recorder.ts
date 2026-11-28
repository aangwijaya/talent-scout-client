// The recorder as a small state machine: idle → recording → uploading → review, or error.
// Browser APIs come in through `deps`, so tests drive it with a fake `MediaRecorder`.
import {
	microphoneFailure,
	pickMimeType,
	uploadFailure,
	type AudioUpload,
	type VoiceFailure
} from './answer';

/** About 240 KB a minute: a 2-minute answer stays under the 1 MB upload limit. */
export const AUDIO_BITS_PER_SECOND = 32_000;
const TICK_MS = 100;

export type StreamLike = { getTracks(): { stop(): void }[] };
export type RecorderLike = {
	readonly state: string;
	readonly mimeType: string;
	ondataavailable: ((event: BlobEvent) => void) | null;
	onstop: ((event: Event) => void) | null;
	start(): void;
	stop(): void;
};
export type UploadResult =
	{ ok: true; upload: AudioUpload } | { ok: false; status: number; code: string | null };

export type RecorderDeps = {
	getUserMedia(): Promise<StreamLike>;
	createRecorder(
		stream: StreamLike,
		options: { mimeType?: string; audioBitsPerSecond: number }
	): RecorderLike;
	isTypeSupported(type: string): boolean;
	upload(blob: Blob, type: string): Promise<UploadResult>;
	now(): number;
};

type Take = { blob: Blob; type: string; speakingMs: number };

export type RecorderState =
	| { kind: 'idle' }
	| { kind: 'recording'; elapsedMs: number; limitMs: number; stream: StreamLike }
	| { kind: 'uploading' }
	| { kind: 'review'; upload: AudioUpload; blob: Blob; speakingMs: number }
	| { kind: 'error'; failure: VoiceFailure };

type Options = {
	/** The longest take allowed now: the per-answer limit, or less when the budget is nearly spent. */
	limitMs: () => number;
	onChange: (state: RecorderState) => void;
};

export function createRecorder(deps: RecorderDeps, { limitMs, onChange }: Options) {
	let state: RecorderState = { kind: 'idle' };
	let rerecords = 0;
	let firstStartedAt: number | null = null;
	let take: Take | null = null;
	let media: {
		recorder: RecorderLike;
		stream: StreamLike;
		ticker: ReturnType<typeof setInterval>;
	} | null = null;
	let stopping: Promise<void> | null = null;
	let disposed = false;

	function set(next: RecorderState) {
		state = next;
		if (!disposed) onChange(next);
	}

	function release() {
		if (!media) return;
		clearInterval(media.ticker);
		for (const track of media.stream.getTracks()) track.stop();
		media = null;
	}

	async function upload(current: Take) {
		set({ kind: 'uploading' });
		let result: UploadResult;
		try {
			result = await deps.upload(current.blob, current.type);
		} catch {
			result = { ok: false, status: 0, code: null };
		}
		if (disposed) return;
		if (result.ok) {
			set({
				kind: 'review',
				upload: result.upload,
				blob: current.blob,
				speakingMs: current.speakingMs
			});
		} else {
			set({ kind: 'error', failure: uploadFailure(result.status, result.code) });
		}
	}

	async function start() {
		if (state.kind === 'recording' || state.kind === 'uploading' || media) return;
		let stream: StreamLike;
		try {
			stream = await deps.getUserMedia();
		} catch {
			set({ kind: 'error', failure: microphoneFailure() });
			return;
		}
		if (disposed) {
			for (const track of stream.getTracks()) track.stop();
			return;
		}
		const mimeType = pickMimeType(deps.isTypeSupported);
		const recorder = deps.createRecorder(stream, {
			...(mimeType ? { mimeType } : {}),
			audioBitsPerSecond: AUDIO_BITS_PER_SECOND
		});
		const chunks: Blob[] = [];
		const startedAt = deps.now();
		firstStartedAt ??= startedAt;
		const limit = limitMs();
		take = null;
		recorder.ondataavailable = (event) => {
			if (event.data.size > 0) chunks.push(event.data);
		};
		recorder.onstop = () => {
			const type = recorder.mimeType || mimeType || 'audio/webm';
			take = {
				blob: new Blob(chunks, { type }),
				type,
				speakingMs: Math.min(limit, deps.now() - startedAt)
			};
		};
		const ticker = setInterval(() => {
			const elapsedMs = Math.min(limit, deps.now() - startedAt);
			if (elapsedMs >= limit) void stop();
			else set({ kind: 'recording', elapsedMs, limitMs: limit, stream });
		}, TICK_MS);
		media = { recorder, stream, ticker };
		recorder.start();
		set({ kind: 'recording', elapsedMs: 0, limitMs: limit, stream });
	}

	function stop(): Promise<void> {
		if (stopping) return stopping;
		if (!media) return Promise.resolve();
		const { recorder } = media;
		// A real recorder fires `onstop` asynchronously after the last `dataavailable`.
		const stopped = new Promise<void>((resolve) => {
			const done = recorder.onstop;
			recorder.onstop = (event) => {
				done?.(event);
				resolve();
			};
		});
		recorder.stop();
		release();
		stopping = stopped
			.then(() => (take ? upload(take) : set({ kind: 'idle' })))
			.finally(() => (stopping = null));
		if (state.kind === 'recording') set({ kind: 'uploading' });
		return stopping;
	}

	return {
		get state() {
			return state;
		},
		get rerecords() {
			return rerecords;
		},
		/** When the first take of the current answer began; `null` before any. */
		get firstStartedAt() {
			return firstStartedAt;
		},
		start,
		stop,
		/** Re-sends the kept recording after a failed transcription. */
		async retry() {
			if (state.kind === 'error' && take) await upload(take);
		},
		/** Discards the transcript under review and records a new take. */
		async rerecord() {
			if (state.kind !== 'review') return;
			rerecords += 1;
			set({ kind: 'idle' });
			await start();
		},
		/** After an answer was sent, or when leaving voice: back to a fresh answer. */
		reset() {
			release();
			take = null;
			rerecords = 0;
			firstStartedAt = null;
			set({ kind: 'idle' });
		},
		dispose() {
			disposed = true;
			if (media) {
				media.recorder.onstop = null;
				media.recorder.stop();
			}
			release();
		}
	};
}

export type Recorder = ReturnType<typeof createRecorder>;

/** Real browser dependencies; `null` when this browser cannot record. */
export function browserRecorderDeps(upload: RecorderDeps['upload']): RecorderDeps | null {
	if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;
	return {
		getUserMedia: () => navigator.mediaDevices.getUserMedia({ audio: true }),
		createRecorder: (stream, options) => new MediaRecorder(stream as MediaStream, options),
		isTypeSupported: (type) => MediaRecorder.isTypeSupported(type),
		upload,
		now: () => performance.now()
	};
}
