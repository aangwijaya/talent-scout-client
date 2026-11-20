import { expect, test, type APIRequestContext } from '@playwright/test';
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

// Answer authenticity (client#83, server#81) against `fake-api.ts`. Kept in this file because
// it runs in the one-worker project that shares the fake API's request log.
test.describe('answer authenticity', () => {
	const ENTRY_SESSION = 'e2e-entry-session-token';
	const INVITED_SESSION = 'e2e-entry-invited-token';
	const ASSESSED_APP = 'e2e00000-0000-4000-8000-0000000000a1';
	const UNASSESSED_APP = 'e2e00000-0000-4000-8000-0000000000a2';
	const PASTED = 'I led the migration of our checkout to Svelte 5 and cut drop-off by a third.';
	const entries = async (request: APIRequestContext) =>
		(await (await request.get(`${FAKE_API}/__entries`)).json()).received as {
			pasted_chars: number;
			typed_chars: number;
			duration_ms: number;
		}[];

	test('the intro tells the applicant that typing and pasting are noted', async ({ page }) => {
		await page.goto(`/s/${INVITED_SESSION}`);
		const notice = page.getByRole('listitem').last();
		await expect(notice).toHaveText(
			'We note whether answers were typed or pasted. A person reviews this.'
		);
		await expect(notice).toHaveClass(/font-medium/);
	});

	test('a pasted answer goes through with its entry, and the applicant sees no numbers', async ({
		page,
		context,
		request
	}) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await page.goto(`/s/${ENTRY_SESSION}`);
		const box = page.getByLabel('Your answer');
		await expect(box).toBeEnabled();
		await page.evaluate((text) => navigator.clipboard.writeText(text), PASTED);
		await box.focus();
		await page.keyboard.press('ControlOrMeta+V');
		await expect(box).toHaveValue(PASTED);
		await box.press('Enter');
		await expect(page.getByText(PASTED)).toBeVisible();

		await expect.poll(async () => (await entries(request)).length).toBe(1);
		const [entry] = await entries(request);
		expect(entry.pasted_chars).toBe(PASTED.length);
		expect(entry.typed_chars).toBe(0);
		expect(entry.duration_ms).toBeGreaterThanOrEqual(0);

		const text = await page.locator('main').innerText();
		expect(text).not.toMatch(/pasted|typed|\bchars\b/i);
		expect(text).not.toContain(String(PASTED.length));
	});

	test.describe('recruiter review', () => {
		test.beforeEach(async ({ page }) => {
			await page.goto('/dashboard/login');
			await page.getByLabel('Password', { exact: true }).fill('any-password');
			await page.getByRole('button', { name: 'Sign in' }).click();
			await expect(page).toHaveURL(/\/dashboard\/jobs$/);
		});

		test('shows a likely concern with reasons, and an entry line per answer', async ({ page }) => {
			await page.goto(`/dashboard/applications/${ASSESSED_APP}`);
			const card = page.getByRole('region', { name: 'Answer authenticity' });
			await expect(card).toContainText('Likely concern');
			await expect(card.getByRole('listitem')).toHaveText([
				'Answer 1 was pasted in full within three seconds.'
			]);
			await expect(card).toContainText('Advisory only.');
			await expect(card).toContainText('Checked Nov 5, 14:12.');

			const lines = page.getByLabel(/characters pasted, \d+ typed, in \d+ seconds/);
			await expect(lines).toHaveCount(2);
			await expect(lines.first()).toHaveText('Pasted 412 · typed 3 chars · 2 s');
			await expect(lines.last()).toHaveText('Typed 186 · pasted 0 chars · 42 s');
		});

		test('the graph replay draws and completes the authenticity node', async ({ page }) => {
			await page.goto('/dashboard/runs/e2e00000-0000-4000-8000-0000000000e1');
			const node = page.getByRole('button', { name: /^Authenticity\b/ });
			await expect(node).toBeVisible();
			await expect(node).toHaveAttribute('aria-label', 'Authenticity, worker, Passed');
			await expect(page.getByRole('button', { name: /^Recruiter gate\b/ })).toBeVisible();
		});

		test('says "Not assessed" when there is no authenticity result', async ({ page }) => {
			await page.goto(`/dashboard/applications/${UNASSESSED_APP}`);
			const card = page.getByRole('region', { name: 'Answer authenticity' });
			await expect(card).toContainText('Not assessed');
			await expect(card).not.toContainText('Checked');
		});
	});
});
