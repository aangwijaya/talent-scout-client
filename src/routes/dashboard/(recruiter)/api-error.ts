import { error } from '@sveltejs/kit';
import { ApiError } from '$lib/server/api/types';

/**
 * Rethrows an API failure as `error(status, message)`, so the error page can show the API's
 * `error.message`. A 5xx is still logged: `handleError` logs every `error()` of 500 or more.
 */
export function rethrowApiError(err: unknown): never {
	if (err instanceof ApiError) error(err.status, err.message);
	throw err;
}
