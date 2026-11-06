import { redirect } from '@sveltejs/kit';
import { clearSessionCookie } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	redirect(303, '/dashboard/login');
};

export const actions: Actions = {
	default: ({ cookies }) => {
		clearSessionCookie(cookies);
		redirect(303, '/dashboard/login');
	}
};
