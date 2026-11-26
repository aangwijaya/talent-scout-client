import { redirect } from '@sveltejs/kit';
import { LIMIT_MESSAGE, parseJobForm, validateJob } from '$lib/components/job-form';
import { api } from '$lib/server/api';
import { ApiError, type Job } from '$lib/server/api/types';
import { rethrowApiError } from '../../api-error';
import { apiFailure, invalid, savedPath } from '../job-form.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const { items } = await api.listJobs().catch(rethrowApiError);
	return { jobCount: items.length };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const values = parseJobForm(await request.formData());
		const errors = validateJob(values);
		if (Object.keys(errors).length > 0) return invalid(400, values, errors);

		let job: Job;
		try {
			job = await api.createJob(values);
		} catch (err) {
			if (err instanceof ApiError && err.status === 409) {
				return invalid(409, values, { form: LIMIT_MESSAGE });
			}
			return apiFailure(err, values);
		}
		redirect(303, savedPath(job.id, 'created'));
	}
};
