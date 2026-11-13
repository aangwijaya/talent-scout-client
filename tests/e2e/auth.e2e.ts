import { expect, test } from '@playwright/test';
import { FAKE_API_PORT } from './ports';

// Runtime checks of the recruiter auth rules (docs/LESSONS.md, #13) on a built app that uses the
// real API client against `fake-api.ts`. Unit tests with a fake `fetch` cannot see what Kit's
// router and inner `fetch` actually do.

const FAKE_API = `http://localhost:${FAKE_API_PORT}`;

type Seen = {
	token: string;
	requests: { method: string; path: string; headers: Record<string, string | undefined> }[];
};

test.beforeEach(async ({ request }) => {
	await request.get(`${FAKE_API}/__reset`);
});

for (const path of ['/dashboard/jobs', '/%64ashboard/jobs', '/dashboard/%6Aobs']) {
	test(`${path} without a session redirects to login`, async ({ request }) => {
		const res = await request.get(path, { maxRedirects: 0 });
		expect(res.status()).toBe(303);
		expect(res.headers()['location']).toMatch(/^\/dashboard\/login(\?|$)/);
	});
}

test('login keeps the token in an httpOnly cookie and never sends cookies to the API', async ({
	page,
	context,
	request
}) => {
	await page.goto('/dashboard/login');
	await page.getByLabel('Password', { exact: true }).fill('any-password');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(/\/dashboard\/jobs$/);

	const { token, requests }: Seen = await (await request.get(`${FAKE_API}/__seen`)).json();

	const cookie = (await context.cookies()).find(({ name }) => name === 'ts_session');
	expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
	expect(cookie?.value).toContain(token);
	expect(await page.evaluate(() => document.cookie)).not.toContain('ts_session');
	expect(await page.content()).not.toContain(token);

	const jobs = requests.filter((r) => r.method === 'GET' && r.path === '/api/v1/jobs');
	expect(jobs.length).toBeGreaterThan(0);
	for (const { headers } of requests) expect(headers.cookie).toBeUndefined();
	for (const { headers } of jobs) expect(headers.authorization).toBe(`Bearer ${token}`);
});
