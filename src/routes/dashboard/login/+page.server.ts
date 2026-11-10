import { fail, redirect } from '@sveltejs/kit';
import { api } from '$lib/server/api';
import { ApiError } from '$lib/server/api/types';
import { HOME_PATH, loginRedirectTarget } from '$lib/server/guards';
import { setSessionCookie } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.recruiter) redirect(303, HOME_PATH);
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const password = String((await request.formData()).get('password') ?? '');
		if (!password) return fail(400, { error: 'Enter the password.' });

		try {
			// The token goes only into the httpOnly cookie; nothing returned here may contain it.
			setSessionCookie(cookies, await api.login(password));
		} catch (err) {
			if (!(err instanceof ApiError)) throw err;
			if (err.status === 401) return fail(401, { error: 'Wrong password.' });
			return fail(err.status, { error: 'Could not sign in right now. Please try again.' });
		}
		redirect(303, loginRedirectTarget(url.searchParams.get('redirectTo')));
	}
};
