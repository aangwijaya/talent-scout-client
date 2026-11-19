import { fail } from '@sveltejs/kit';
import { mapServerField, type FieldErrors, type JobValues } from '$lib/components/job-form';
import { ApiError } from '$lib/server/api/types';
import { rethrowApiError } from '../api-error';

export const invalid = (status: number, values: JobValues, errors: FieldErrors) =>
	fail(status, { values, errors });

/** A 400 lands on the input its `details.field` names; anything else goes to the error page. */
export function apiFailure(err: unknown, values: JobValues) {
	if (err instanceof ApiError && err.status === 400) {
		const field = mapServerField(err.details, values.rubric.length);
		return invalid(400, values, { [field]: err.message });
	}
	return rethrowApiError(err);
}

export const savedPath = (jobId: string, saved: 'created' | 'updated') =>
	`/dashboard/jobs/${encodeURIComponent(jobId)}?saved=${saved}`;
