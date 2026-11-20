import { spawn, type ChildProcess } from 'node:child_process';
import { expect, request, test, type Locator, type Page } from '@playwright/test';
import { DEMO_PORT, REAL_PORT } from './ports';

// Fixture values from src/lib/server/api/fixtures (that module imports `$lib`, which only Vite
// resolves, so the ids are repeated here).
const JOB_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const INVITED_TOKEN = 'mock-invited';
const REVIEW_APPLICATION_ID = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
const SUCCEEDED_RUN_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const PASSWORD = 'mock-password';
const MAX_ANSWERS = 20;

/** Anything under 16px makes iOS Safari zoom in when the field gets focus. */
async function expectNoZoomOnFocus(fields: Locator): Promise<void> {
	// `count()` does not wait, and the composer renders only after Start is handled.
	await expect(fields.first()).toBeVisible();
	const count = await fields.count();
	for (let i = 0; i < count; i++) {
		const size = await fields.nth(i).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
		expect(size, `font-size of field ${i}`).toBeGreaterThanOrEqual(16);
	}
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
	const { scrollWidth, clientWidth } = await page.evaluate(() => ({
		scrollWidth: document.documentElement.scrollWidth,
		clientWidth: document.documentElement.clientWidth
	}));
	expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

test('apply, finish the screening chat, then review the application', async ({ page }) => {
	await test.step('the viewport allows pinch zoom', async () => {
		await page.goto(`/apply/${JOB_ID}`);
		const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
		expect(viewport).not.toMatch(/user-scalable\s*=\s*no/);
		expect(viewport).not.toMatch(/maximum-scale\s*=\s*1(\.0*)?(\D|$)/);
	});

	await test.step('apply', async () => {
		await expectNoZoomOnFocus(
			page.locator('input[type="text"], input[type="email"], input:not([type])')
		);
		await page.getByLabel('Full name').fill('Rani Putri');
		await page.getByLabel('Email').fill('rani@example.com');
		await page.locator('input[name="cv"]').setInputFiles({
			name: 'cv.pdf',
			mimeType: 'application/pdf',
			buffer: Buffer.from('%PDF-1.4 e2e CV')
		});
		await page.getByRole('button', { name: 'Submit application' }).click();
		await expect(page.getByRole('heading', { name: 'Application received' })).toBeVisible();
	});

	await test.step('start the screening: the typing indicator shows until the first words', async () => {
		// Mock mode replays the first question 60–150 ms after Start; a paused clock holds it.
		await page.clock.install();
		await page.goto(`/s/${INVITED_TOKEN}`);
		const start = page.getByRole('button', { name: 'Start screening' });
		await expect(start).toBeEnabled();
		await page.clock.pauseAt(Date.now() + 60_000);
		await start.click();

		const typing = page.getByRole('status', {
			name: 'The interviewer is preparing your first question'
		});
		const log = page.getByRole('log');
		await expect(typing).toBeVisible();
		await expect(page.getByText('Preparing your first question…')).toBeVisible();
		await expect(log.locator('p.shadow-card')).toHaveCount(0);

		await page.clock.resume();
		await expect(log.locator('p.shadow-card').first()).not.toBeEmpty();
		await expect(typing).toBeHidden();
	});

	const answer = page.getByLabel('Your answer');
	const send = page.getByRole('button', { name: 'Send' });
	const done = page.getByRole('heading', { name: 'Thank you!' });

	await test.step('the composer stays usable on a small screen', async () => {
		await expectNoZoomOnFocus(answer);
		await expect(answer).toBeEnabled();
		const sendBox = await send.boundingBox();
		expect(sendBox?.width).toBeGreaterThanOrEqual(44);
		expect(sendBox?.height).toBeGreaterThanOrEqual(44);

		// The box grows with the answer, then stops at 40% of the viewport and scrolls inside.
		const height = () => answer.evaluate((el) => el.getBoundingClientRect().height);
		const empty = await height();
		await answer.fill('line\n'.repeat(4));
		expect(await height()).toBeGreaterThan(empty);
		await answer.fill('line\n'.repeat(60));
		const cap = await page.evaluate(() => window.innerHeight * 0.4);
		expect(await height()).toBeLessThanOrEqual(cap + 1);
		expect(await answer.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
		await answer.fill('');
		// client#63: the server can still answer 409 `invalid_state` right after
		// `message.completed`. The draft must stay in the locked box and be resent, not dropped.
		let sends = 0;
		await page.route(/\?\/message$/, (route) => {
			if (sends++ > 0) return route.fallback();
			const data = [{ error: 1, code: 2 }, 'Please wait.', 'invalid_state'];
			return route.fulfill({
				json: { type: 'failure', status: 409, data: JSON.stringify(data) }
			});
		});
		await answer.focus();
		await answer.fill('My first answer.');
		await send.click();
		await expect(answer).toBeDisabled();
		await expect(answer).toHaveValue('My first answer.');
		await expect(page.getByRole('log').getByText('My first answer.')).toBeVisible();
		expect(sends).toBe(2);
		await page.unrouteAll();
		await expect(answer).toBeInViewport();
		await expect(send).toBeInViewport();
		await expectNoHorizontalScroll(page);
	});

	await test.step('answer until the finished screen', async () => {
		// The input unlocks after `message.completed`; the last answer ends the session instead and
		// unmounts the composer. One auto-waiting check: `answer.isEnabled()` would wait forever for
		// a textarea that `session.ended` has just removed.
		const ready = done.or(answer.and(page.locator(':enabled')));
		for (let sent = 1; sent < MAX_ANSWERS; sent++) {
			await expect(ready).toBeVisible();
			if (await done.isVisible()) break;
			await answer.fill(`Answer number ${sent + 1}.`);
			await send.click();
		}
		await expect(done).toBeVisible();
	});

	await test.step('sign in and see the scores', async () => {
		await page.goto(`/dashboard/applications/${REVIEW_APPLICATION_ID}`);
		await expect(page).toHaveURL(/\/dashboard\/login/);
		await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
		await page.getByRole('button', { name: 'Sign in' }).click();
		await expect(page).toHaveURL(new RegExp(`/dashboard/applications/${REVIEW_APPLICATION_ID}$`));

		// Below `lg` the review page shows one tab at a time.
		const scoresTab = page.getByRole('tab', { name: /scores/i });
		if (await scoresTab.isVisible()) await scoresTab.click();
		const scoreCard = page.getByRole('article', { name: 'Frontend depth' });
		await expect(scoreCard).toBeVisible();
		await expect(page.getByRole('article', { name: 'Communication' })).toBeVisible();
		await expect(page.getByRole('region', { name: 'Answer authenticity' })).toContainText(
			'Likely concern'
		);
	});

	await test.step('replay the run up to the authenticity node', async () => {
		await page.goto(`/dashboard/runs/${SUCCEEDED_RUN_ID}`);
		const node = page.getByRole('button', { name: /^Authenticity\b/ });
		await expect(node).toHaveAttribute('aria-label', 'Authenticity, worker, Passed');
	});
});

test('without DEMO_PASSWORD there is no demo card and no apply notice', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/dashboard\/login/);
	await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Demo access' })).toHaveCount(0);

	await page.goto(`/apply/${JOB_ID}`);
	await expect(page.getByRole('heading', { name: 'Your details' })).toBeVisible();
	await expect(page.getByRole('note')).toHaveCount(0);
});

test.describe('public demo', () => {
	// The mock `webServer` runs without DEMO_PASSWORD, so these tests preview the same build with
	// it set. The fixture value is the mock password, so the shown password signs in.
	let server: ChildProcess | undefined;
	let base = '';

	test.beforeAll(async () => {
		const port = DEMO_PORT + test.info().parallelIndex;
		base = `http://localhost:${port}`;
		server = spawn('pnpm', ['preview', '--port', String(port), '--strictPort'], {
			env: { ...process.env, USE_MOCK: 'true', DEMO_PASSWORD: PASSWORD },
			stdio: 'ignore',
			detached: true
		});
		const http = await request.newContext();
		await expect
			.poll(
				() =>
					http.get(base, { maxRedirects: 0 }).then(
						(res) => res.status(),
						() => 0
					),
				{ timeout: 20_000 }
			)
			.toBeGreaterThan(0);
		await http.dispose();
	});

	test.afterAll(() => {
		if (server?.pid) process.kill(-server.pid);
	});

	test('a fresh visitor signs in with the shown demo password', async ({ page, context }) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
		await page.goto(`${base}/`);
		await expect(page).toHaveURL(/\/dashboard\/login/);

		const card = page.getByRole('region', { name: 'Demo access' });
		await expect(card).toContainText('This is a public demo. Sign in with the password below.');
		const shown = await card.getByTestId('demo-password').innerText();
		expect(shown).toBe(PASSWORD);

		const copy = card.getByRole('button', { name: 'Copy demo password' });
		await copy.click();
		await expect(copy).toContainText('Copied');
		await expect(card.locator('[aria-live="polite"]')).not.toBeEmpty();
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(PASSWORD);

		await page.getByLabel('Password', { exact: true }).fill(shown);
		await page.getByRole('button', { name: 'Sign in' }).click();
		await expect(page).toHaveURL(/\/dashboard\/jobs$/);
		await expect(page.getByRole('table')).toBeVisible();
	});

	test('the apply page warns that the demo is public', async ({ page }) => {
		await page.goto(`${base}/apply/${JOB_ID}`);
		await expect(page.getByRole('note')).toContainText(
			'This is a public demo: anyone can read what you submit. Use a sample CV, not your real one.'
		);
	});
});

test.describe('job description', () => {
	// Served by `fake-api.ts` behind the real-API preview; the mock fixtures have one short JD.
	const LONG_JD = `http://localhost:${REAL_PORT}/apply/0d1c5c3a-2f5e-4c39-9d6b-1f6c2b9a7e01`;
	const SHORT_JD = `http://localhost:${REAL_PORT}/apply/0d1c5c3a-2f5e-4c39-9d6b-1f6c2b9a7e02`;
	const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;
	const toggle = (page: Page) => page.getByRole('button', { name: /Show (full description|less)/ });
	const applyLink = (page: Page) => page.getByRole('link', { name: 'Apply', exact: true });

	test('a long JD starts collapsed, expands, and stays expanded after a form error', async ({
		page
	}) => {
		await page.goto(LONG_JD);
		const body = page.locator('[data-collapsed]');
		const last = page.getByRole('heading', { name: 'How to apply' });
		await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
		await expect(body).toHaveAttribute('data-collapsed', 'true');
		expect((await body.boundingBox())?.height).toBeLessThanOrEqual(300);

		await toggle(page).click();
		await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true');
		await expect(toggle(page)).toHaveText('Show less');
		await expect(body).toHaveAttribute('data-collapsed', 'false');
		expect((await body.boundingBox())?.height).toBeGreaterThan(300);
		await last.scrollIntoViewIfNeeded();
		await expect(last).toBeInViewport();

		await page.getByLabel('Full name').fill('Rani Putri');
		await page.getByLabel('Email').fill('rani@example.com');
		await page.locator('input[name="cv"]').setInputFiles({
			name: 'cv.pdf',
			mimeType: 'application/pdf',
			buffer: Buffer.from('%PDF-1.4 e2e CV')
		});
		await page.getByRole('button', { name: 'Submit application' }).click();
		await expect(page.getByRole('alert')).toBeVisible();
		await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true');
	});

	test('the table of contents expands the JD and jumps to a section', async ({ page }) => {
		await page.goto(LONG_JD);
		const toc = page.getByRole('navigation', { name: 'On this page' });
		await expect(toc.getByRole('link')).toHaveCount(4);
		await toc.getByRole('link', { name: 'How to apply' }).click();
		await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true');
		await expect(page.getByRole('heading', { name: 'How to apply' })).toBeInViewport();
	});

	test('on a phone the sticky Apply button reaches the form', async ({ page }) => {
		test.skip(!isPhone(page), 'the Apply bar is for screens below 1024px');
		await page.goto(LONG_JD);
		await expect(applyLink(page)).toBeInViewport();
		await applyLink(page).click();
		await expect(page.getByLabel('Full name')).toBeInViewport();
		await expect(page.getByLabel('Full name')).toBeFocused();
		await expect(applyLink(page)).toBeHidden();
		await expectNoHorizontalScroll(page);
	});

	test('on desktop the form sits beside the JD, without an Apply bar', async ({ page }) => {
		test.skip(isPhone(page), 'two columns from 1024px');
		await page.goto(LONG_JD);
		await expect(page.getByLabel('Full name')).toBeInViewport();
		await expect(applyLink(page)).toBeHidden();
	});

	test('a short JD has no toggle, table of contents or Apply bar', async ({ page }) => {
		await page.goto(SHORT_JD);
		await expect(page.getByText('Own frontend quality.')).toBeVisible();
		await expect(page.locator('.md br')).toHaveCount(1);
		await expect(toggle(page)).toHaveCount(0);
		await expect(page.getByRole('navigation', { name: 'On this page' })).toHaveCount(0);
		await expect(applyLink(page)).toHaveCount(0);
	});
});
