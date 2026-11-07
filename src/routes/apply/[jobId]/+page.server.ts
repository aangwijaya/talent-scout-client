import { error, fail } from '@sveltejs/kit';
import { api } from '$lib/server/api';
import { ApiError } from '$lib/server/api/types';
import { applyErrorMessage } from './errors';
import { validateApplication } from './validate';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	try {
		return { job: await api.getPublicJob(params.jobId) };
	} catch (err) {
		if (err instanceof ApiError && err.status === 404) {
			error(404, 'This job could not be found. Please check the link you were given.');
		}
		throw err;
	}
};

export const actions: Actions = {
	default: async ({ params, request }) => {
		const form = await request.formData();
		const errors = validateApplication(form);
		if (Object.keys(errors).length > 0) {
			const values = {
				name: String(form.get('name') ?? ''),
				email: String(form.get('email') ?? '')
			};
			return fail(400, { errors, values });
		}

		try {
			const { message } = await api.apply(params.jobId, form);
			return { message };
		} catch (err) {
			if (err instanceof ApiError) return fail(err.status, { error: applyErrorMessage(err) });
			throw err;
		}
	}
};
