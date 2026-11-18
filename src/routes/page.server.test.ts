import { isRedirect } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { load } from './+page.server';

describe('/', () => {
	it('sends every visitor to the dashboard with a 303', async () => {
		const thrown = await Promise.resolve()
			.then(() => load({} as never))
			.catch((e: unknown) => e);
		expect(isRedirect(thrown) && [thrown.status, thrown.location]).toEqual([
			303,
			'/dashboard/jobs'
		]);
	});
});
