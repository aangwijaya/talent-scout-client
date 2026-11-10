import { redirect } from '@sveltejs/kit';
import { LOGIN_PATH } from '$lib/server/guards';
import { clearSessionCookie } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	redirect(303, LOGIN_PATH);
};

export const actions: Actions = {
	default: ({ cookies }) => {
		clearSessionCookie(cookies);
		redirect(303, LOGIN_PATH);
	}
};
