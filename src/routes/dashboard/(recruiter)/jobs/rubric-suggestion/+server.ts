import { isRedirect, json } from '@sveltejs/kit';
import type { SuggestResult } from '$lib/components/job-form';
import { api } from '$lib/server/api';
import { ApiError } from '$lib/server/api/types';
import type { RequestHandler } from './$types';

// The editor's "Suggest with AI" calls this; `handle` guards it like every recruiter route.
// Nothing is stored: the rubric goes back to the editor, and only Create/Save persists it.
const answer = (result: SuggestResult, status = 200) => json(result, { status });

export const POST: RequestHandler = async ({ request }) => {
	const body: unknown = await request.json().catch(() => null);
	const title = typeof body === 'object' && body && 'title' in body ? body.title : null;
	const description =
		typeof body === 'object' && body && 'description' in body ? body.description : null;
	if (typeof title !== 'string' || typeof description !== 'string') {
		return answer({ ok: false, status: 400, retry_after_seconds: null }, 400);
	}

	try {
		const { rubric } = await api.suggestRubric({ title, description });
		return answer({ ok: true, rubric });
	} catch (err) {
		// A token the API rejects makes the API layer clear the cookie and redirect to login; the
		// editor's fetch would follow that to HTML, so say "session ended" in JSON instead.
		if (isRedirect(err)) return answer({ ok: false, status: 401, retry_after_seconds: null }, 401);
		if (!(err instanceof ApiError)) throw err;
		return answer(
			{ ok: false, status: err.status, retry_after_seconds: err.retryAfterSeconds },
			err.status
		);
	}
};
