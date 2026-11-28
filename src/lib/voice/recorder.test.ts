import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioUpload } from './answer';
import {
	createRecorder,
	type RecorderDeps,
	type RecorderLike,
	type UploadResult
} from './recorder';

class FakeMediaRecorder implements RecorderLike {
	static last: FakeMediaRecorder | null = null;
	state: 'inactive' | 'recording' = 'inactive';
	ondataavailable: ((event: BlobEvent) => void) | null = null;
	onstop: ((event: Event) => void) | null = null;
	constructor(
		readonly stream: unknown,
		readonly options: { mimeType?: string; audioBitsPerSecond?: number }
	) {
		FakeMediaRecorder.last = this;
	}
	get mimeType() {
		return this.options.mimeType ?? '';
	}
	start() {
		this.state = 'recording';
	}
	stop() {
		if (this.state === 'inactive') return;
		this.state = 'inactive';
		this.ondataavailable?.({ data: new Blob([new Uint8Array(100)]) } as BlobEvent);
		this.onstop?.(new Event('stop'));
	}
}

const UPLOAD: AudioUpload = {
	audio_id: 'a1',
	transcript: 'I built the checkout flow.',
	language: 'en',
	duration_ms: 3000,
	stored: true
};

let clock = 0;
const stopTrack = vi.fn();

function setup(upload: (blob: Blob, type: string) => Promise<UploadResult>, limitMs = 120_000) {
	const deps: RecorderDeps = {
		getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] })),
		createRecorder: (stream, options) => new FakeMediaRecorder(stream, options),
		isTypeSupported: (type) => type === 'audio/webm;codecs=opus',
		upload: vi.fn(upload),
		now: () => clock
	};
	const states: string[] = [];
	const recorder = createRecorder(deps, {
		limitMs: () => limitMs,
		onChange: (s) => states.push(s.kind)
	});
	return { recorder, deps, states };
}

const ok = async (): Promise<UploadResult> => ({ ok: true, upload: UPLOAD });

beforeEach(() => {
	vi.useFakeTimers();
	clock = 0;
	FakeMediaRecorder.last = null;
	stopTrack.mockReset();
});
afterEach(() => vi.useRealTimers());

function advance(ms: number) {
	clock += ms;
	vi.advanceTimersByTime(ms);
}

describe('recorder', () => {
	it('goes idle → recording → uploading → review, with webm/opus at about 32 kbit/s', async () => {
		const { recorder, deps, states } = setup(ok);
		expect(recorder.state.kind).toBe('idle');
		await recorder.start();
		expect(recorder.state).toMatchObject({ kind: 'recording', elapsedMs: 0, limitMs: 120_000 });
		expect(FakeMediaRecorder.last?.options).toEqual({
			mimeType: 'audio/webm;codecs=opus',
			audioBitsPerSecond: 32_000
		});
		advance(42_000);
		expect(recorder.state).toMatchObject({ kind: 'recording', elapsedMs: 42_000 });
		await recorder.stop();
		expect([...new Set(states)]).toEqual(['recording', 'uploading', 'review']);
		expect(recorder.state).toMatchObject({ kind: 'review', upload: UPLOAD, speakingMs: 42_000 });
		expect(deps.upload).toHaveBeenCalledWith(expect.any(Blob), 'audio/webm;codecs=opus');
		expect(stopTrack).toHaveBeenCalled();
	});

	it('stops by itself at the limit and uploads', async () => {
		const { recorder, deps } = setup(ok, 120_000);
		await recorder.start();
		advance(119_000);
		expect(recorder.state.kind).toBe('recording');
		advance(1_000);
		await vi.waitFor(() => expect(recorder.state.kind).toBe('review'));
		expect(deps.upload).toHaveBeenCalledTimes(1);
		expect(recorder.state).toMatchObject({ speakingMs: 120_000 });
	});

	it('a blocked microphone is an error that switches to text', async () => {
		const { recorder, deps } = setup(ok);
		vi.mocked(deps.getUserMedia).mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
		await recorder.start();
		expect(recorder.state).toMatchObject({
			kind: 'error',
			failure: { kind: 'microphone', next: 'text', fallback: 'microphone_unavailable' }
		});
	});

	it('no speech is an error, and recording again works', async () => {
		const { recorder } = setup(async () => ({ ok: false, status: 422, code: 'no_speech' }));
		await recorder.start();
		advance(1_000);
		await recorder.stop();
		expect(recorder.state).toMatchObject({ kind: 'error', failure: { kind: 'no_speech' } });
		await recorder.start();
		expect(recorder.state.kind).toBe('recording');
	});

	it('a failed transcription keeps the recording and retries the same blob', async () => {
		const results: UploadResult[] = [
			{ ok: false, status: 502, code: 'transcription_unavailable' },
			{ ok: true, upload: UPLOAD }
		];
		const { recorder, deps } = setup(async () => results.shift()!);
		await recorder.start();
		advance(2_000);
		await recorder.stop();
		expect(recorder.state).toMatchObject({ kind: 'error', failure: { kind: 'transcription' } });
		await recorder.retry();
		expect(recorder.state.kind).toBe('review');
		const [first, second] = vi.mocked(deps.upload).mock.calls;
		expect(second[0]).toBe(first[0]);
	});

	it('a failed upload network call is a retryable error', async () => {
		const { recorder } = setup(async () => {
			throw new TypeError('network');
		});
		await recorder.start();
		await recorder.stop();
		expect(recorder.state).toMatchObject({ kind: 'error', failure: { next: 'retry' } });
	});

	it('re-record discards the review, counts it, and records again; reset clears the count', async () => {
		const { recorder } = setup(ok);
		await recorder.start();
		clock = 500;
		await recorder.stop();
		await recorder.rerecord();
		expect(recorder.state.kind).toBe('recording');
		expect(recorder.rerecords).toBe(1);
		expect(recorder.firstStartedAt).toBe(0);
		await recorder.stop();
		recorder.reset();
		expect(recorder.state.kind).toBe('idle');
		expect(recorder.rerecords).toBe(0);
		expect(recorder.firstStartedAt).toBeNull();
	});

	it('ignores stop while not recording and start while uploading', async () => {
		let release: (r: UploadResult) => void = () => {};
		const { recorder, deps } = setup(() => new Promise((r) => (release = r)));
		await recorder.stop();
		expect(recorder.state.kind).toBe('idle');
		await recorder.start();
		const stopping = recorder.stop();
		expect(recorder.state.kind).toBe('uploading');
		await recorder.start();
		expect(deps.getUserMedia).toHaveBeenCalledTimes(1);
		release({ ok: true, upload: UPLOAD });
		await stopping;
		expect(recorder.state.kind).toBe('review');
	});

	it('dispose stops a running recording without uploading it', async () => {
		const { recorder, deps } = setup(ok);
		await recorder.start();
		recorder.dispose();
		expect(stopTrack).toHaveBeenCalled();
		advance(200_000);
		expect(deps.upload).not.toHaveBeenCalled();
	});
});
