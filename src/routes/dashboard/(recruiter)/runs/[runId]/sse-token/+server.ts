import { json } from '@sveltejs/kit';
import { api } from '$lib/server/api';
import { rethrowApiError } from '../../../api-error';
import type { RequestHandler } from './$types';

/** A fresh `sse_token` for a manual reconnect (docs/EVENTS.md §4). `handle` guards the route. */
export const POST: RequestHandler = async ({ params }) => {
	try {
		const { sse_token } = await api.mintSseToken(params.runId);
		return json({ sse_token });
	} catch (err) {
		rethrowApiError(err);
	}
};
