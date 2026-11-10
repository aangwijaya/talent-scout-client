import { API_BASE_URL, BFF_SHARED_SECRET } from '$app/env/private';
import { isRedirect, type RequestEvent } from '@sveltejs/kit';
import type { Handle, HandleFetch, HandleServerError } from '@sveltejs/kit/hooks';
import { isDashboardRoute, isRecruiterRoute, requireRecruiter } from '$lib/server/guards';
import { redact } from '$lib/server/redact';
import { readSession } from '$lib/server/session';

/** Sets the header, copying the response first when its headers are immutable. */
function noStore(response: Response): Response {
	try {
		response.headers.set('cache-control', 'no-store');
		return response;
	} catch {
		const copy = new Response(response.body, response);
		copy.headers.set('cache-control', 'no-store');
		return copy;
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.recruiter = readSession(event.cookies);
	if (!isDashboardRoute(event)) return resolve(event);

	// Recruiter pages, actions and redirects must never be served from a shared or back/forward cache.
	try {
		if (isRecruiterRoute(event)) requireRecruiter(event);
	} catch (thrown) {
		if (!isRedirect(thrown)) throw thrown;
		return noStore(
			new Response(null, { status: thrown.status, headers: { location: thrown.location } })
		);
	}
	return noStore(await resolve(event));
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
	// A deliberate `error(5xx)` keeps its message too, but is still logged.
	if (kind === 'app' && (error.status ?? 0) >= 500) {
		log(event, `${error.status} ${error.message}`);
		return;
	}
	if (kind !== 'unknown') return;

	log(event, error instanceof Error ? (error.stack ?? error.message) : String(error));
	return { message: 'Something went wrong' };
};

function log(event: RequestEvent, detail: string): void {
	// Header-name patterns miss a bare secret value, so pass the values themselves.
	const secrets = [event.locals.recruiter?.token, BFF_SHARED_SECRET].filter(
		(secret): secret is string => Boolean(secret)
	);
	console.error(
		`${event.request.method} ${event.route.id ?? '(no route)'}: ${redact(detail, secrets)}`
	);
}
