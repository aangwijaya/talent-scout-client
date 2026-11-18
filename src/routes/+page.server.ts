import { redirect } from '@sveltejs/kit';
import { HOME_PATH } from '$lib/server/guards';
import type { PageServerLoad } from './$types';

// The guard in `handle` sends a visitor without a session on to the login page.
export const load: PageServerLoad = () => redirect(303, HOME_PATH);
