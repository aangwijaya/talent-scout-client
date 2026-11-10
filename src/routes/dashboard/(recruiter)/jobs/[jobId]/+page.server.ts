import { error } from '@sveltejs/kit';
import { api } from '$lib/server/api';
import { ApiError, type ApplicationStatus } from '$lib/server/api/types';
import type { PageServerLoad } from './$types';

const STATUSES = [
	'applied',
	'invited',
	'in_session',
	'scoring',
	'review',
	'shortlisted',
	'rejected',
	'failed'
] as const satisfies readonly ApplicationStatus[];

function parseStatus(value: string | null): ApplicationStatus | null {
	return STATUSES.find((status) => status === value) ?? null;
}

export const load: PageServerLoad = async ({ params, url }) => {
	const status = parseStatus(url.searchParams.get('status'));
	try {
		const [job, { items }] = await Promise.all([
			api.getJob(params.jobId),
			api.listApplications(params.jobId, status ? { status } : undefined)
		]);
		return { job, applications: items, status, statuses: STATUSES };
	} catch (err) {
		if (err instanceof ApiError && err.status === 404) error(404, 'This job could not be found.');
		throw err;
	}
};
