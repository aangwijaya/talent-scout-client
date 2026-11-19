import { isRedirect, type RequestEvent } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { isRecruiterRoute, requireRecruiter } from '$lib/server/guards';

// The guard runs in `handle` from the route id, so new routes are covered only if their ids
// fall under it. These are the ids of the routes added for job create, edit and suggest.
const ROUTES = [
	['/dashboard/(recruiter)/jobs/new', '/dashboard/jobs/new'],
	['/dashboard/(recruiter)/jobs/[jobId]/edit', '/dashboard/jobs/1/edit'],
	['/dashboard/(recruiter)/jobs/rubric-suggestion', '/dashboard/jobs/rubric-suggestion']
] as const;

function event(id: string, path: string) {
	return {
		route: { id },
		url: new URL(path, 'http://app.test'),
		locals: { recruiter: null },
		request: new Request(new URL(path, 'http://app.test'))
	} as unknown as RequestEvent;
}

describe('recruiter guard on the job editor routes', () => {
	it.each(ROUTES)('%s is a recruiter route', (id, path) => {
		expect(isRecruiterRoute(event(id, path))).toBe(true);
	});

	it.each(ROUTES)('%s redirects to login without a session', (id, path) => {
		let thrown: unknown;
		try {
			requireRecruiter(event(id, path));
		} catch (e) {
			thrown = e;
		}
		expect(isRedirect(thrown) && thrown.location).toMatch(/^\/dashboard\/login/);
	});
});
