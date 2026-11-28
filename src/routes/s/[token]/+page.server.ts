import { error, fail } from '@sveltejs/kit';
import { api } from '$lib/server/api';
import { ENTRY_MAX } from '$lib/components/entry-counter';
import {
	ApiError,
	type FallbackReason,
	type MessageEntry,
	type SendMessageRequest
} from '$lib/server/api/types';
import { sessionErrorMessage } from './errors';
import type { Actions, PageServerLoad } from './$types';

const MAX_ANSWER = 2000;

const isCount = (n: unknown) =>
	Number.isInteger(n) && (n as number) >= 0 && (n as number) <= ENTRY_MAX;

const MODES: readonly unknown[] = ['typed', 'spoken'] satisfies MessageEntry['mode'][];
const REASONS: readonly unknown[] = [
	'chose_text',
	'declined_recording',
	'microphone_unavailable',
	'transcription_failed'
] satisfies FallbackReason[];
const OPTIONAL_COUNTS = ['start_latency_ms', 'speaking_ms', 'rerecord_count'] as const;
const AUDIO_ID = /^[0-9a-f-]{1,64}$/i;

/** The optional `entry` (FR-15/16); a malformed one is dropped so the answer still goes through. */
function parseEntry(raw: FormDataEntryValue | null): MessageEntry | undefined {
	if (typeof raw !== 'string') return undefined;
	let value: Partial<Record<keyof MessageEntry, unknown>>;
	try {
		value = JSON.parse(raw);
	} catch {
		return undefined;
	}
	if (typeof value !== 'object' || value === null) return undefined;
	const { pasted_chars, typed_chars, duration_ms, mode, fallback_reason } = value;
	if (![pasted_chars, typed_chars, duration_ms].every(isCount)) return undefined;
	const entry = { pasted_chars, typed_chars, duration_ms } as MessageEntry;
	if (mode !== undefined) {
		if (!MODES.includes(mode)) return undefined;
		entry.mode = mode as MessageEntry['mode'];
	}
	if (fallback_reason !== undefined) {
		if (!REASONS.includes(fallback_reason)) return undefined;
		entry.fallback_reason = fallback_reason as FallbackReason;
	}
	for (const key of OPTIONAL_COUNTS) {
		if (value[key] === undefined) continue;
		if (!isCount(value[key])) return undefined;
		entry[key] = value[key] as number;
	}
	return entry;
}

/** A spoken answer names its upload; the transcript is the server's, so `content` is ignored. */
function messageBody(form: FormData): SendMessageRequest | string {
	const entry = parseEntry(form.get('entry'));
	const audioId = form.get('audio_id');
	if (typeof audioId === 'string' && audioId !== '') {
		if (!AUDIO_ID.test(audioId)) return 'This recording could not be sent. Please record it again.';
		return entry ? { audio_id: audioId, entry } : { audio_id: audioId };
	}
	const content = String(form.get('content') ?? '').trim();
	if (content.length === 0 || content.length > MAX_ANSWER) {
		return `Your answer must be between 1 and ${MAX_ANSWER} characters.`;
	}
	return entry ? { content, entry } : { content };
}

/** `recording_consent` is in the start form only for a voice session. */
function parseConsent(raw: FormDataEntryValue | null): boolean | undefined {
	if (raw === 'true') return true;
	if (raw === 'false') return false;
	return undefined;
}

function toFailure(err: unknown) {
	if (err instanceof ApiError) {
		return fail(err.status, { error: sessionErrorMessage(err), code: err.code });
	}
	throw err;
}

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	// The token is in the URL: keep it out of referrers and search indexes.
	setHeaders({ 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex' });
	try {
		const [session, { items }] = await Promise.all([
			api.getSession(params.token),
			api.listMessages(params.token)
		]);
		const base = api.sseBaseUrl();
		return {
			session,
			messages: items,
			sseUrl: base && `${base}/sessions/${encodeURIComponent(params.token)}/events`
		};
	} catch (err) {
		if (err instanceof ApiError && (err.status === 404 || err.status === 410)) {
			error(err.status, sessionErrorMessage(err));
		}
		throw err;
	}
};

export const actions: Actions = {
	start: async ({ params, request }) => {
		const consent = parseConsent((await request.formData()).get('recording_consent'));
		try {
			return { session: await api.startSession(params.token, consent) };
		} catch (err) {
			// A double click or a second tab: the session is running, so resume it.
			if (err instanceof ApiError && err.code === 'session_already_started') {
				return { session: await api.getSession(params.token) };
			}
			return toFailure(err);
		}
	},
	message: async ({ params, request }) => {
		const body = messageBody(await request.formData());
		if (typeof body === 'string') return fail(400, { error: body });
		try {
			const { message } = await api.sendMessage(params.token, body);
			return { message };
		} catch (err) {
			return toFailure(err);
		}
	},
	retry: async ({ params }) => {
		try {
			await api.retrySession(params.token);
			return { retrying: true };
		} catch (err) {
			return toFailure(err);
		}
	}
};
