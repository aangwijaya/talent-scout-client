import { expect, test } from '@playwright/test';

// The built client with the real API client against the Go server at its pinned commit
// (`contract.lock`), run by the `integration` CI job with LLM_MODE=fake and EMAIL_MODE=log.
// Later nodes add their flows here (client#10: apply -> chat -> review).

function required(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is not set; the integration CI job sets it`);
	return value;
}

const recruiterLogin = required('INTEGRATION_RECRUITER_PASSWORD');
const seedJobTitle = required('INTEGRATION_SEED_JOB_TITLE');

test('the recruiter logs in and sees the seeded job', async ({ page, context }) => {
	await page.goto('/dashboard/login');
	await page.getByLabel('Password', { exact: true }).fill(recruiterLogin);
	await page.getByRole('button', { name: 'Sign in' }).click();

	await expect(page).toHaveURL(/\/dashboard\/jobs$/);
	await expect(page.getByText(seedJobTitle, { exact: true })).toBeVisible();
	expect((await context.cookies()).some(({ name }) => name === 'ts_session')).toBe(true);
});

test('a wrong password shows the login error and sets no session', async ({ page, context }) => {
	await page.goto('/dashboard/login');
	await page.getByLabel('Password', { exact: true }).fill(`${recruiterLogin}-wrong`);
	await page.getByRole('button', { name: 'Sign in' }).click();

	await expect(page.getByRole('alert')).toBeVisible();
	await expect(page).toHaveURL(/\/dashboard\/login$/);
	expect((await context.cookies()).some(({ name }) => name === 'ts_session')).toBe(false);
});
