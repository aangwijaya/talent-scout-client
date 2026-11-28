import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '$lib/server/api/types';

const api = vi.hoisted(() => ({ uploadAudio: vi.fn() }));
vi.mock('$lib/server/api', () => ({ api }));

const { POST } = await import('./+server');

const TOKEN = 'tok-123';
const MB = 1024 * 1024;

function upload(file: File | null, headers: Record<string, string> = {}) {
	const body = new FormData();
	if (file) body.set('audio', file);
	const request = new Request(`http://app.test/s/${TOKEN}/audio`, {
		method: 'POST',
		body,
		headers
	});
	return POST({ params: { token: TOKEN }, request } as unknown as RequestEvent<{
		token: string;
	}>);
}

const recording = (bytes: number, type = 'audio/webm;codecs=opus') =>
	new File([new Uint8Array(bytes)], 'answer', { type });

beforeEach(() => {
	vi.resetAllMocks();
});

describe('POST /s/[token]/audio', () => {
	it('forwards the recording with its type and returns the transcript', async () => {
		const result = { audio_id: 'a1', transcript: 'hello', language: 'en', duration_ms: 900 };
		api.uploadAudio.mockResolvedValue({ ...result, stored: true });
		const res = await upload(recording(2048));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ...result, stored: true });
		const [token, form] = api.uploadAudio.mock.calls[0] as [string, FormData];
		expect(token).toBe(TOKEN);
		const sent = form.get('audio') as File;
		expect(sent.type).toBe('audio/webm');
		expect(sent.size).toBe(2048);
	});

	it.each([
		['audio/mp4', 'audio/mp4'],
		['audio/ogg;codecs=opus', 'audio/ogg']
	])('forwards %s as %s', async (type, forwarded) => {
		api.uploadAudio.mockResolvedValue({ audio_id: 'a1' });
		await upload(recording(10, type));
		const [, form] = api.uploadAudio.mock.calls[0] as [string, FormData];
		expect((form.get('audio') as File).type).toBe(forwarded);
	});

	it('rejects a recording over 1 MB without calling the API', async () => {
		const res = await upload(recording(MB + 1));
		expect(res.status).toBe(413);
		expect(await res.json()).toMatchObject({ error: { code: 'file_too_large' } });
		expect(api.uploadAudio).not.toHaveBeenCalled();
	});

	it('rejects a declared body far over 1 MB before reading it', async () => {
		const res = await upload(recording(10), { 'content-length': String(2 * MB) });
		expect(res.status).toBe(413);
		expect(api.uploadAudio).not.toHaveBeenCalled();
	});

	it.each([
		['no file', null],
		['an empty file', recording(0)],
		['a type the API refuses', recording(10, 'video/webm')]
	])('rejects %s with 400 validation_failed', async (_, file) => {
		const res = await upload(file);
		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ error: { code: 'validation_failed' } });
		expect(api.uploadAudio).not.toHaveBeenCalled();
	});

	it.each([
		[422, 'no_speech'],
		[502, 'transcription_unavailable'],
		[409, 'audio_budget_exceeded'],
		[410, 'session_completed']
	] as const)('passes a %i %s through as its status and code', async (status, code) => {
		api.uploadAudio.mockRejectedValue(new ApiError(status, code, 'raw api text'));
		const res = await upload(recording(10));
		expect(res.status).toBe(status);
		const body = await res.json();
		expect(body).toEqual({ error: { code } });
	});
});
