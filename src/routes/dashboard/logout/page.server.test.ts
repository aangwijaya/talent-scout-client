import { isRedirect } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { actions } from './+page.server';

describe('logout action', () => {
	it('clears the session cookie and redirects to login', async () => {
		const cookies = { delete: vi.fn() };
		const error = await (async () =>
			actions.default({ cookies } as unknown as Parameters<typeof actions.default>[0]))().catch(
			(thrown: unknown) => thrown
		);

		expect(cookies.delete).toHaveBeenCalledWith('ts_session', { path: '/' });
		expect(isRedirect(error) && error.location).toBe('/dashboard/login');
	});
});
