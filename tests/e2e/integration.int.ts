import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// The built client with the real API client against the Go server at its pinned commit
// (`contract.lock`), run by the `integration` CI job with LLM_MODE=fake and EMAIL_MODE=log.
// CVs go to `fake-storage.ts`, which stands in for Supabase Storage.

function required(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is not set; the integration CI job sets it`);
	return value;
}

const recruiterLogin = required('INTEGRATION_RECRUITER_PASSWORD');
const seedJobTitle = required('INTEGRATION_SEED_JOB_TITLE');

/** A one-page PDF with real text for a made-up person (`fixtures/make-cv-pdf.ts`). */
const CV = readFileSync(new URL('fixtures/cv.pdf', import.meta.url));
/** The fake LLM decides how many questions there are; this only stops a runaway loop. */
const MAX_ANSWERS = 40;
const SCORING_TIMEOUT = 90_000;

async function signIn(page: Page): Promise<void> {
	await page.goto('/dashboard/login');
	await page.getByLabel('Password', { exact: true }).fill(recruiterLogin);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(/\/dashboard\/jobs$/);
}

test('apply, screen, review, shortlist and watch the run against the real API', async ({
	page: recruiter,
	browser
}) => {
	test.setTimeout(300_000);
	// Unique per run, so `--repeat-each` runs never collide on one job's applicant list.
	const runTag = `${Date.now()}-${test.info().repeatEachIndex}`;
	const name = `Jordan Example ${runTag}`;
	const firstAnswer = `I build accessible Svelte apps (${runTag}).`;

	const requestUrls: string[] = [];
	recruiter.on('request', (request) => requestUrls.push(request.url()));
	// Printed if the live-graph step fails: what the browser saw on the run stream.
	const diagnostics: string[] = [];
	const isRunStream = (url: string) => url.includes('/graph-runs/') || url.includes('/sse-token');
	const redactToken = (url: string) => url.replace(/sse_token=[^&]+/, 'sse_token=<redacted>');
	recruiter.on('response', (response) => {
		if (!isRunStream(response.url())) return;
		const headers = response.headers();
		diagnostics.push(
			`response ${response.status()} ${redactToken(response.url())} content-type=${headers['content-type']} acao=${headers['access-control-allow-origin']}`
		);
	});
	recruiter.on('requestfailed', (request) => {
		diagnostics.push(`failed ${redactToken(request.url())}: ${request.failure()?.errorText}`);
	});
	recruiter.on('console', (message) => {
		if (message.type() === 'error' || message.type() === 'warning')
			diagnostics.push(`console.${message.type()} ${redactToken(message.text())}`);
	});
	recruiter.on('pageerror', (error) => diagnostics.push(`pageerror ${error.message}`));

	const jobId = await test.step('the recruiter opens the seeded job', async () => {
		await signIn(recruiter);
		await recruiter.getByRole('link', { name: seedJobTitle, exact: true }).click();
		await expect(recruiter).toHaveURL(/\/dashboard\/jobs\/[0-9a-f-]{36}$/);
		return recruiter.url().split('/').at(-1) ?? '';
	});

	const applicantContext = await browser.newContext();
	const applicant = await applicantContext.newPage();

	await test.step('the applicant applies with a real PDF', async () => {
		await applicant.goto(`/apply/${jobId}`);
		await applicant.getByLabel('Full name').fill(name);
		await applicant.getByLabel('Email').fill(`jordan.${runTag}@example.com`);
		await applicant.locator('input[name="cv"]').setInputFiles({
			name: 'cv.pdf',
			mimeType: 'application/pdf',
			buffer: CV
		});
		await applicant.getByRole('button', { name: 'Submit application' }).click();
		await expect(applicant.getByRole('heading', { name: 'Application received' })).toBeVisible();
	});

	const inviteUrl = await test.step('the recruiter gets an invite link', async () => {
		await recruiter.reload();
		await recruiter.getByRole('link', { name }).filter({ visible: true }).first().click();
		await expect(recruiter).toHaveURL(/\/dashboard\/applications\/[0-9a-f-]{36}$/);
		await recruiter.getByRole('button', { name: 'Get invite link' }).click();
		const notice = recruiter.getByRole('status').filter({ hasText: 'New invite link' });
		await expect(notice).toBeVisible();
		const url = (await notice.locator('p.font-mono').textContent())?.trim() ?? '';
		expect(url).toMatch(/^https?:\/\/[^/]+\/s\/[^/\s]+$/);
		return url;
	});

	await test.step('the applicant finishes the screening and sees no scores', async () => {
		expect(new URL(inviteUrl).origin).toBe(new URL(applicant.url()).origin);
		await applicant.goto(inviteUrl);
		await applicant.getByRole('button', { name: 'Start screening' }).click();

		const answer = applicant.getByLabel('Your answer');
		const send = applicant.getByRole('button', { name: 'Send answer' });
		const done = applicant.getByRole('heading', { name: 'Thank you!' });
		const ready = done.or(answer.and(applicant.locator(':enabled')));
		for (let sent = 0; sent < MAX_ANSWERS; sent++) {
			await expect(ready).toBeVisible({ timeout: 30_000 });
			if (await done.isVisible()) break;
			await answer.fill(sent === 0 ? firstAnswer : `Answer number ${sent + 1}.`);
			await send.click();
		}
		await expect(done).toBeVisible();
		await expect(applicant.getByText(/score|rubric/i)).toHaveCount(0);
		await applicantContext.close();
	});

	await test.step('the recruiter sees the transcript and scores, then shortlists', async () => {
		const overall = recruiter.getByRole('heading', { name: 'Overall score' });
		await expect(async () => {
			await recruiter.reload();
			await expect(overall).toBeVisible({ timeout: 1_000 });
		}).toPass({ timeout: SCORING_TIMEOUT });

		await expect(recruiter.locator('#panel-transcript').getByText(firstAnswer)).toBeVisible();
		await expect(recruiter.locator('#panel-scores').getByRole('article').first()).toBeVisible();

		await recruiter.getByRole('button', { name: 'Shortlist', exact: true }).click();
		await recruiter.getByRole('button', { name: 'Confirm shortlist' }).click();
		await expect(
			recruiter.getByRole('status').filter({ hasText: /^\s*Shortlisted/ })
		).toBeVisible();
		await recruiter.reload();
		await expect(recruiter.getByText('Shortlisted', { exact: true }).first()).toBeVisible();
	});

	await test.step('the CV link downloads the PDF', async () => {
		const href = await recruiter.getByRole('link', { name: 'CV (PDF)' }).getAttribute('href');
		expect(href).toBeTruthy();
		const response = await recruiter.request.get(new URL(href ?? '', recruiter.url()).href);
		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toContain('application/pdf');
		expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-');
	});

	await test.step('the live graph replays to run.completed over the real SSE', async () => {
		await recruiter.getByRole('link', { name: 'View graph run' }).click();
		await expect(recruiter).toHaveURL(/\/dashboard\/runs\/[0-9a-f-]{36}/);
		try {
			const graph = recruiter.getByRole('region', { name: /Graph of the run/ });
			await expect(graph.locator('.svelte-flow__node')).toHaveCount(8);
			const events = recruiter.locator('section[aria-labelledby="events-title"]');
			await expect(events.getByText('run.completed', { exact: true })).toBeVisible({
				timeout: 30_000
			});
		} catch (error) {
			const alerts = await recruiter.getByRole('alert').allInnerTexts();
			const statuses = await recruiter.getByRole('status').allInnerTexts();
			const report = [
				`url ${recruiter.url()}`,
				`h1 ${await recruiter.locator('h1').allInnerTexts()}`,
				`alerts ${JSON.stringify(alerts)}`,
				`statuses ${JSON.stringify(statuses)}`,
				...diagnostics
			].join('\n');
			console.log(`live-graph diagnostics:\n${report}`);
			await test.info().attach('live-graph-diagnostics', { body: report });
			throw error;
		}

		const streams = requestUrls.filter((url) => /\/graph-runs\/[^/]+\/events\?/.test(url));
		expect(streams.length, 'run stream requests').toBeGreaterThan(0);
		for (const url of streams) expect(new URL(url).searchParams.get('sse_token')).toBeTruthy();
		expect(requestUrls.filter((url) => url.includes('access_token'))).toEqual([]);
	});
});

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
