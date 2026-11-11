import { error } from '@sveltejs/kit';
import { api } from '$lib/server/api';
import { ApiError, type GraphRun } from '$lib/server/api/types';
import { rethrowApiError } from '../../api-error';
import type { PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The run snapshot, plus the stream URL and a 60 s `sse_token` for the browser's `EventSource`
 * (both live and replay read the run stream from `since_seq=0`). In mock mode `stream` is null
 * and the browser replays `$lib/mock`. `from` is the application the recruiter came from.
 */
export const load: PageServerLoad = async ({ params, url }) => {
	let run: GraphRun;
	try {
		run = await api.getGraphRun(params.runId);
	} catch (err) {
		if (err instanceof ApiError && err.status === 404) error(404, 'Graph run not found');
		rethrowApiError(err);
	}

	const base = api.sseBaseUrl();
	let stream: { url: string; sse_token: string } | null = null;
	if (base) {
		try {
			const { sse_token } = await api.mintSseToken(run.id);
			stream = { url: `${base}/graph-runs/${encodeURIComponent(run.id)}/events`, sse_token };
		} catch (err) {
			rethrowApiError(err);
		}
	}

	const from = url.searchParams.get('from');
	return { run, stream, from: from && UUID.test(from) ? from : null };
};
