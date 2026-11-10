import { api } from '$lib/server/api';
import { rethrowApiError } from '../api-error';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const { items } = await api.listJobs().catch(rethrowApiError);
	return { jobs: items };
};
