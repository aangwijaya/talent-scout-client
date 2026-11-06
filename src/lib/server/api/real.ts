import { API_BASE_URL } from '$app/env/private';
import { redirect } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { SESSION_COOKIE } from '../session';
import { API_ERROR_CODES, ApiError, type ApiErrorCode, type TalentScoutApi } from './types';

function isApiErrorCode(code: unknown): code is ApiErrorCode {
	return API_ERROR_CODES.some((known) => known === code);
}

async function toApiError(res: Response): Promise<ApiError> {
	const body: unknown = await res.json().catch(() => null);
	const error = typeof body === 'object' && body !== null && 'error' in body ? body.error : null;
	if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
		const { code, message } = error;
		if (isApiErrorCode(code) && typeof message === 'string') {
			const details =
				'details' in error && typeof error.details === 'object'
					? (error.details as Record<string, unknown> | null)
					: null;
			return new ApiError(res.status, code, message, details);
		}
	}
	return new ApiError(res.status, 'internal_error', 'The API returned an unexpected response');
}

function apiUrl(path: string): string {
	if (!API_BASE_URL) throw new Error('API_BASE_URL is not set');
	return `${API_BASE_URL}/api/v1${path}`;
}

async function send(path: string, init?: RequestInit, redirectOn401 = true): Promise<Response> {
	const event = getRequestEvent();
	const url = apiUrl(path);
	let res: Response;
	try {
		res = await event.fetch(url, init);
	} catch {
		throw new ApiError(502, 'internal_error', 'The API could not be reached');
	}
	if (res.ok) return res;
	if (res.status === 401 && redirectOn401) {
		event.cookies.delete(SESSION_COOKIE, { path: '/' });
		redirect(303, `/dashboard/login?redirectTo=${encodeURIComponent(event.url.pathname)}`);
	}
	throw await toApiError(res);
}

async function getJson<T>(path: string): Promise<T> {
	return (await send(path)).json();
}

function jsonInit(body: unknown): RequestInit {
	return {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	};
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
	const init = body === undefined ? { method: 'POST' } : jsonInit(body);
	return (await send(path, init)).json();
}

const seg = encodeURIComponent;

export const realApi: TalentScoutApi = {
	login: async (password) => (await send('/auth/login', jsonInit({ password }), false)).json(),
	mintSseToken: (runId) => postJson('/auth/sse-token', { run_id: runId }),

	listJobs: () => getJson('/jobs'),
	getJob: (jobId) => getJson(`/jobs/${seg(jobId)}`),
	getPublicJob: (jobId) => getJson(`/jobs/${seg(jobId)}/public`),

	apply: async (jobId, form) =>
		(await send(`/jobs/${seg(jobId)}/applications`, { method: 'POST', body: form })).json(),
	listApplications: (jobId, query) => {
		const search = query?.status ? `?status=${seg(query.status)}` : '';
		return getJson(`/jobs/${seg(jobId)}/applications${search}`);
	},
	getApplication: (id) => getJson(`/applications/${seg(id)}`),
	getCv: (id) => send(`/applications/${seg(id)}/cv`),
	decide: (id, decision) => postJson(`/applications/${seg(id)}/decision`, decision),
	resendInvite: (id) => postJson(`/applications/${seg(id)}/resend-invite`),

	getSession: (token) => getJson(`/sessions/${seg(token)}`),
	startSession: (token) => postJson(`/sessions/${seg(token)}/start`),
	listMessages: (token) => getJson(`/sessions/${seg(token)}/messages`),
	sendMessage: (token, content) => postJson(`/sessions/${seg(token)}/messages`, { content }),
	retrySession: (token) => postJson(`/sessions/${seg(token)}/retry`),

	getGraphRun: (runId) => getJson(`/graph-runs/${seg(runId)}`),

	sseBaseUrl: () => apiUrl('')
};
