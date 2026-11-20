import { error, fail } from '@sveltejs/kit';
import { api } from '$lib/server/api';
import { ENTRY_MAX } from '$lib/components/entry-counter';
import { ApiError, type MessageEntry } from '$lib/server/api/types';
import { sessionErrorMessage } from './errors';
import type { Actions, PageServerLoad } from './$types';

const MAX_ANSWER = 2000;

const isCount = (n: unknown) =>
	Number.isInteger(n) && (n as number) >= 0 && (n as number) <= ENTRY_MAX;

/** The optional `entry` (FR-15); a malformed one is dropped so the answer still goes through. */
function parseEntry(raw: FormDataEntryValue | null): MessageEntry | undefined {
	if (typeof raw !== 'string') return undefined;
	let value: Partial<Record<keyof MessageEntry, unknown>>;
	try {
		value = JSON.parse(raw);
	} catch {
		return undefined;
	}
	const { pasted_chars, typed_chars, duration_ms } = value ?? {};
	if (![pasted_chars, typed_chars, duration_ms].every(isCount)) return undefined;
	return { pasted_chars, typed_chars, duration_ms } as MessageEntry;
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
	start: async ({ params }) => {
		try {
			return { session: await api.startSession(params.token) };
		} catch (err) {
			// A double click or a second tab: the session is running, so resume it.
			if (err instanceof ApiError && err.code === 'session_already_started') {
				return { session: await api.getSession(params.token) };
			}
			return toFailure(err);
		}
	},
	message: async ({ params, request }) => {
		const form = await request.formData();
		const content = String(form.get('content') ?? '').trim();
		if (content.length === 0 || content.length > MAX_ANSWER) {
			return fail(400, { error: `Your answer must be between 1 and ${MAX_ANSWER} characters.` });
		}
		try {
			const entry = parseEntry(form.get('entry'));
			const { message } = await api.sendMessage(params.token, content, entry);
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
