import { expect, test, type Locator, type Page } from '@playwright/test';

// Fixture values from src/lib/server/api/fixtures (that module imports `$lib`, which only Vite
// resolves, so the ids are repeated here).
const JOB_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const INVITED_TOKEN = 'mock-invited';
const REVIEW_APPLICATION_ID = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
const PASSWORD = 'mock-password';
const MAX_ANSWERS = 20;

/** Anything under 16px makes iOS Safari zoom in when the field gets focus. */
async function expectNoZoomOnFocus(fields: Locator): Promise<void> {
	const count = await fields.count();
	expect(count).toBeGreaterThan(0);
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

	await test.step('start the screening', async () => {
		await page.goto(`/s/${INVITED_TOKEN}`);
		const start = page.getByRole('button', { name: 'Start screening' });
		await expect(start).toBeEnabled();
		await start.click();
	});

	const answer = page.getByLabel('Your answer');
	const send = page.getByRole('button', { name: 'Send answer' });
	const done = page.getByRole('heading', { name: 'Thank you!' });

	await test.step('the composer stays usable on a small screen', async () => {
		await expectNoZoomOnFocus(answer);
		await expect(answer).toBeEnabled();
		await answer.focus();
		await answer.fill('My first answer.');
		await send.click();
		await expect(page.getByRole('log').getByText('My first answer.')).toBeVisible();
		await expect(answer).toBeInViewport();
		await expect(send).toBeInViewport();
		await expectNoHorizontalScroll(page);
	});

	await test.step('answer until the finished screen', async () => {
		for (let sent = 1; sent < MAX_ANSWERS; sent++) {
			// The input unlocks after `message.completed`; the last answer ends the session instead.
			await expect(async () => {
				expect((await done.isVisible()) || (await answer.isEnabled())).toBe(true);
			}).toPass();
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
	});
});
