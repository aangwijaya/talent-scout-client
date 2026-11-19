import { error, redirect } from '@sveltejs/kit';
import { parseJobForm, patchBody, validateJob } from '$lib/components/job-form';
import { api } from '$lib/server/api';
import { ApiError, type Job, type RubricCriterion } from '$lib/server/api/types';
import { rethrowApiError } from '../../../api-error';
import { apiFailure, invalid, savedPath } from '../../job-form.server';
import type { Actions, PageServerLoad } from './$types';

const LOCKED_NOW =
	'Someone applied while you were editing, so the rubric is now locked. Reload to edit the rest.';

async function loadJob(jobId: string): Promise<Job> {
	try {
		return await api.getJob(jobId);
	} catch (err) {
		if (err instanceof ApiError && err.status === 404) error(404, "This job doesn't exist");
		return rethrowApiError(err);
	}
}

const sameRubric = (a: RubricCriterion[], b: RubricCriterion[]) =>
	a.length === b.length &&
	a.every(
		(c, i) =>
			c.key === b[i].key &&
			c.label === b[i].label &&
			c.description === b[i].description &&
			c.weight === b[i].weight
	);

export const load: PageServerLoad = async ({ params }) => {
	const job = await loadJob(params.jobId);
	return { job, locked: job.application_count > 0 };
};

export const actions: Actions = {
	default: async ({ params, request }) => {
		// The lock comes from the API, never from the form.
		const job = await loadJob(params.jobId);
		const locked = job.application_count > 0;
		const values = parseJobForm(await request.formData());
		// The page loaded unlocked and someone applied since: saving the rest would drop the edits.
		if (locked && !sameRubric(values.rubric, job.rubric)) {
			return invalid(409, values, { form: LOCKED_NOW });
		}

		const errors = validateJob(values, { rubricLocked: locked });
		if (Object.keys(errors).length > 0) return invalid(400, values, errors);

		try {
			await api.updateJob(job.id, patchBody(values, { rubricLocked: locked }));
		} catch (err) {
			if (err instanceof ApiError && err.status === 409) {
				return invalid(409, values, { form: LOCKED_NOW });
			}
			return apiFailure(err, values);
		}
		redirect(303, savedPath(job.id, 'updated'));
	}
};
