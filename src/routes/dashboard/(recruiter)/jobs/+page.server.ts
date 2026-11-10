import { api } from '$lib/server/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const { items } = await api.listJobs();
	return { jobs: items };
};
