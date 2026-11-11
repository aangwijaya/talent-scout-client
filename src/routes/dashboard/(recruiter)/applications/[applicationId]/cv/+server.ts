import { error } from '@sveltejs/kit';
import { api } from '$lib/server/api';
import { ApiError } from '$lib/server/api/types';
import { rethrowApiError } from '../../../api-error';
import type { RequestHandler } from './$types';

/** Streams the CV from the API, so the recruiter's Bearer token never leaves the server. */
export const GET: RequestHandler = async ({ params }) => {
	try {
		const upstream = await api.getCv(params.applicationId);
		return new Response(upstream.body, {
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': 'inline; filename="cv.pdf"',
				'Cache-Control': 'private, no-store',
				'X-Content-Type-Options': 'nosniff'
			}
		});
	} catch (err) {
		if (err instanceof ApiError && err.status === 404) error(404, "This CV doesn't exist");
		rethrowApiError(err);
	}
};
