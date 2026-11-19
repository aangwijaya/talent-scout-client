import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
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

// Job editor checks (client#76). They live here because this project is the one that runs the
// real API client against `fake-api.ts`, one test at a time, which the stateful job store needs.
const SEED_JOB_ID = 'e2e00000-0000-4000-8000-000000000001';
const DESCRIPTION =
	'Own the recruiter dashboard and ship accessible features with the team. '.repeat(2);

type Editor = { lastCreate: { rubric: { label: string; weight: number }[] }; lastPatch: object };
type EditorState = { count?: number; applicants?: number; suggest_limited?: boolean };

test.describe('job editor', () => {
	async function setup(page: Page, request: APIRequestContext, state: EditorState) {
		await request.post(`${FAKE_API}/__jobs`, { data: state });
		await page.goto('/dashboard/login');
		await page.getByLabel('Password', { exact: true }).fill('any-password');
		await page.getByRole('button', { name: 'Sign in' }).click();
		await expect(page).toHaveURL(/\/dashboard\/jobs$/);
	}

	const editorState = async (request: APIRequestContext): Promise<Editor> =>
		(await request.get(`${FAKE_API}/__jobs`)).json();

	test('create a job with an edited AI suggestion, then see it listed and on its apply page', async ({
		page,
		request
	}) => {
		await setup(page, request, { count: 1 });
		await expect(page.getByText('1 of 20 jobs')).toBeVisible();
		await page.getByRole('link', { name: 'New job' }).click();
		await expect(page.getByRole('heading', { name: 'New job', level: 1 })).toBeVisible();

		await page.locator('#field-title').fill('Platform Engineer');
		await page.locator('#field-description').fill(DESCRIPTION);
		await page.getByRole('button', { name: 'Suggest with AI' }).click();
		await expect(page.getByRole('status')).toContainText('Suggested by AI from your description.');
		await expect(page.locator('#field-rubric-0-label')).toHaveValue('Product sense');

		await page.locator('#field-rubric-0-label').fill('Product thinking');
		await expect(page.locator('#field-rubric-0-key')).toHaveValue('product_sense');
		await page.locator('#field-rubric-0-weight').getByRole('button', { name: '×3' }).click();
		await page.getByRole('button', { name: 'Create job' }).click();

		await expect(page).toHaveURL(/\/dashboard\/jobs\/[^/]+\?saved=created$/);
		await expect(page.getByRole('status')).toHaveText('Job created');
		const jobId = new URL(page.url()).pathname.split('/').pop();
		const { lastCreate } = await editorState(request);
		expect(lastCreate.rubric[0]).toMatchObject({ label: 'Product thinking', weight: 3 });

		await page.goto('/dashboard/jobs');
		await expect(page.getByRole('link', { name: 'Platform Engineer', exact: true })).toBeVisible();
		await expect(page.getByText('2 of 20 jobs')).toBeVisible();
		await page.goto(`/apply/${jobId}`);
		await expect(page.getByRole('heading', { name: 'Platform Engineer' })).toBeVisible();
	});

	test('edit a job with applicants: the rubric is locked and the title change saves', async ({
		page,
		request
	}) => {
		await setup(page, request, { count: 1, applicants: 2 });
		await page.getByRole('link', { name: 'Edit Seeded Engineer' }).click();
		await expect(page.getByText('Locked: 2 applicants were scored')).toBeVisible();
		await expect(page.locator('#field-rubric-0-label')).toHaveAttribute('readonly', '');
		await expect(page.getByRole('button', { name: 'Suggest with AI' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Add criterion' })).toHaveCount(0);

		await page.locator('#field-title').fill('Seeded Engineer II');
		await page.getByRole('button', { name: 'Save changes' }).click();
		await expect(page).toHaveURL(`/dashboard/jobs/${SEED_JOB_ID}?saved=updated`);
		await expect(page.getByRole('status')).toHaveText('Changes saved');
		await expect(page.getByRole('heading', { name: 'Seeded Engineer II' })).toBeVisible();

		const { lastPatch } = await editorState(request);
		expect(lastPatch).not.toHaveProperty('rubric');
		expect(lastPatch).toMatchObject({ title: 'Seeded Engineer II' });
	});

	test('a used-up suggestion limit shows the wait and keeps the criteria', async ({
		page,
		request
	}) => {
		await setup(page, request, { count: 1, suggest_limited: true });
		await page.goto('/dashboard/jobs/new');
		await page.locator('#field-title').fill('Platform Engineer');
		await page.locator('#field-description').fill(DESCRIPTION);
		await page.locator('#field-rubric-0-label').fill('Keep me');
		await expect(page.locator('#field-rubric-0-key')).toHaveValue('keep_me');

		page.once('dialog', (dialog) => void dialog.accept());
		await page.getByRole('button', { name: 'Suggest with AI' }).click();
		await expect(page.getByRole('alert')).toContainText(
			'Suggestions are used up for this hour. Try again in 3 min'
		);
		await expect(page.locator('#field-rubric-0-label')).toHaveValue('Keep me');
	});

	test('at 20 jobs "New job" is disabled', async ({ page, request }) => {
		await setup(page, request, { count: 20 });
		await expect(page.getByRole('button', { name: 'New job' })).toBeDisabled();
		await expect(page.getByRole('link', { name: 'New job' })).toHaveCount(0);
		await expect(
			page.getByText('The demo holds 20 jobs. Edit or close one instead.')
		).toBeVisible();
	});
});
