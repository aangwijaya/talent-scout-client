import { json } from '@sveltejs/kit';
import { api } from '$lib/server/api';
import { ApiError, type ApiErrorCode } from '$lib/server/api/types';
import type { RequestHandler } from './$types';

const MAX_BYTES = 1024 * 1024;
// Room for the multipart boundaries and headers around a file at the limit.
const MAX_BODY_BYTES = MAX_BYTES + 16 * 1024;
const TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4'];
const HEADERS = { 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex' };

/** The browser maps the code to its own copy; the API's message is never passed on. */
const failure = (status: number, code: ApiErrorCode) =>
	json({ error: { code } }, { status, headers: HEADERS });

/**
 * Streams a spoken answer to `POST /sessions/{token}/audio`. The size is checked here first, so
 * an oversized recording never reaches the API (or a Vercel function's body limit).
 */
export const POST: RequestHandler = async ({ params, request }) => {
	if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
		return failure(413, 'file_too_large');
	}
	let audio: FormDataEntryValue | null;
	try {
		audio = (await request.formData()).get('audio');
	} catch {
		return failure(400, 'validation_failed');
	}
	if (!(audio instanceof Blob) || audio.size === 0) return failure(400, 'validation_failed');
	if (audio.size > MAX_BYTES) return failure(413, 'file_too_large');
	// `MediaRecorder` reports `audio/webm;codecs=opus`; the API takes the bare type.
	const type = audio.type.split(';')[0].trim().toLowerCase();
	if (!TYPES.includes(type)) return failure(400, 'validation_failed');

	const form = new FormData();
	form.set('audio', new File([audio], `answer.${type.split('/')[1]}`, { type }));
	try {
		return json(await api.uploadAudio(params.token, form), { headers: HEADERS });
	} catch (err) {
		if (err instanceof ApiError) return failure(err.status, err.code);
		throw err;
	}
};
