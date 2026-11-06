import { API_BASE_URL } from '$app/env/private';
import type { Handle, HandleFetch, HandleServerError } from '@sveltejs/kit/hooks';
import { isRecruiterRoute, requireRecruiter } from '$lib/server/guards';
import { redact } from '$lib/server/redact';
import { readSession } from '$lib/server/session';

export const handle: Handle = ({ event, resolve }) => {
	event.locals.recruiter = readSession(event.cookies);
	if (isRecruiterRoute(event)) requireRecruiter(event);
	return resolve(event);
};

function isApiRequest(url: string): boolean {
	return API_BASE_URL ? new URL(url).origin === new URL(API_BASE_URL).origin : false;
}

export const handleFetch: HandleFetch = ({ event, request, fetch }) => {
	if (!isApiRequest(request.url)) return fetch(request);

	const headers = new Headers(request.headers);
	headers.delete('cookie');
	headers.delete('authorization');
	const token = event.locals.recruiter?.token;
	if (token) headers.set('authorization', `Bearer ${token}`);

	// Deleting the header is not enough: unless credentials are omitted, Kit adds the browser's
	// cookies back when the API shares the app's hostname, as it does on localhost in dev.
	return fetch(new Request(request, { headers, credentials: 'omit' }));
};

export const handleError: HandleServerError = ({ kind, error, event }) => {
	// Other kinds keep their own messages, such as the 404 and 410 text shown on `/s/[token]`.
	if (kind !== 'unknown') return;

	const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
	const token = event.locals.recruiter?.token;
	console.error(
		`${event.request.method} ${event.route.id ?? '(no route)'}: ${redact(detail, token ? [token] : [])}`
	);
	return { message: 'Something went wrong' };
};
