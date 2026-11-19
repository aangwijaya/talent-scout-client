import { isRedirect, json } from '@sveltejs/kit';
import { api } from '$lib/server/api';
import { rethrowApiError } from '../../../api-error';
import type { RequestHandler } from './$types';

/**
 * A fresh `sse_token` for a manual reconnect (docs/EVENTS.md §4). `handle` guards the route.
 * When the API rejects the recruiter token, the API layer clears the cookie and redirects to
 * login; a script's `fetch` would follow that to HTML, so answer the same JSON 401 as `handle`.
 */
export const POST: RequestHandler = async ({ params }) => {
	try {
		const { sse_token } = await api.mintSseToken(params.runId);
		return json({ sse_token });
	} catch (err) {
		if (isRedirect(err)) {
			return json({ error: { code: 'unauthorized', message: 'Sign in again' } }, { status: 401 });
		}
		rethrowApiError(err);
	}
};
