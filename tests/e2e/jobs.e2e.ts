import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { FAKE_API_PORT } from './ports';

// Job editor checks (client#76, client#78) on a built app that uses the real API client against
// `fake-api.ts`, one test at a time, which the stateful job store needs.

const FAKE_API = `http://localhost:${FAKE_API_PORT}`;
const SEED_JOB_ID = 'e2e00000-0000-4000-8000-000000000001';
const DESCRIPTION =
	'Own the recruiter dashboard and ship accessible features with the team. '.repeat(2);

type Editor = {
	lastCreate: { rubric: { label: string; weight: number }[]; spoken_english_required?: boolean };
	lastPatch: object;
};

// The fields the server accepts on create and PATCH; it rejects any other with a 400, so a body
// carrying more breaks create or edit there (client#97). `integration.int.ts` checks the same
// against the pinned server.
const JOB_FIELDS = ['description', 'rubric', 'spoken_english_required', 'status', 'title'];
const expectOnlyJobFields = (body: object) =>
	expect(Object.keys(body).filter((key) => !JOB_FIELDS.includes(key))).toEqual([]);
type EditorState = {
	count?: number;
	applicants?: number;
	suggest_limited?: boolean;
	suggest_spoken?: boolean;
};

test.beforeEach(async ({ request }) => {
	await request.get(`${FAKE_API}/__reset`);
});

async function setup(page: Page, request: APIRequestContext, state: EditorState) {
	await request.post(`${FAKE_API}/__jobs`, { data: state });
	await page.goto('/dashboard/login');
	await page.getByLabel('Password', { exact: true }).fill('any-password');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(/\/dashboard\/jobs$/);
}

const editorState = async (request: APIRequestContext): Promise<Editor> =>
	(await request.get(`${FAKE_API}/__jobs`)).json();

async function newJob(page: Page) {
	await page.goto('/dashboard/jobs/new');
	await page.locator('#field-title').fill('Platform Engineer');
	await page.locator('#field-description').fill(DESCRIPTION);
}

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
	expect(lastCreate.spoken_english_required).toBe(false);
	expectOnlyJobFields(lastCreate);

	await page.goto('/dashboard/jobs');
	await expect(page.getByRole('link', { name: 'Platform Engineer', exact: true })).toBeVisible();
	await expect(page.getByText('2 of 20 jobs')).toBeVisible();
	await page.goto(`/apply/${jobId}`);
	await expect(page.getByRole('heading', { name: 'Platform Engineer' })).toBeVisible();
});

test('the AI hint turns on spoken English, and the job and apply pages say so', async ({
	page,
	request
}) => {
	await setup(page, request, { count: 1, suggest_spoken: true });
	await newJob(page);
	const spoken = page.getByRole('switch', { name: 'Spoken English interview' });
	await expect(spoken).not.toBeChecked();

	await page.getByRole('button', { name: 'Suggest with AI' }).click();
	const hint = page.getByText('AI suggests turning this on.');
	await expect(hint).toBeVisible();
	await expect(page.getByText('<b>Daily calls</b> with customers in English.')).toBeVisible();
	await expect(spoken).not.toBeChecked();

	await page.getByRole('button', { name: 'Turn on' }).click();
	await expect(spoken).toBeChecked();
	await expect(hint).toHaveCount(0);
	await expect(page.getByText('Up to 2 minutes per answer')).toBeVisible();

	// Keyboard: Space toggles the focused switch, and it shows the focus ring.
	await spoken.focus();
	await page.keyboard.press('Space');
	await expect(spoken).not.toBeChecked();
	await expect(hint).toHaveCount(0);
	await page.keyboard.press('Space');
	await expect(spoken).toBeChecked();

	await page.getByRole('button', { name: 'Create job' }).click();
	await expect(page).toHaveURL(/\/dashboard\/jobs\/[^/]+\?saved=created$/);
	const { lastCreate } = await editorState(request);
	expect(lastCreate.spoken_english_required).toBe(true);
	expectOnlyJobFields(lastCreate);
	await expect(page.getByText('Spoken English', { exact: true })).toBeVisible();

	const jobId = new URL(page.url()).pathname.split('/').pop();
	await page.goto(`/apply/${jobId}`);
	await expect(page.getByText('The interview is spoken, in English.')).toBeVisible();
});

test('turning the switch on by hand hides the AI hint', async ({ page, request }) => {
	await setup(page, request, { count: 1, suggest_spoken: true });
	await newJob(page);
	await page.getByRole('button', { name: 'Suggest with AI' }).click();
	await expect(page.getByText('AI suggests turning this on.')).toBeVisible();
	await page.getByRole('switch', { name: 'Spoken English interview' }).check();
	await expect(page.getByText('AI suggests turning this on.')).toHaveCount(0);
});

test('a suggestion made while the switch is on leaves no hint for later', async ({
	page,
	request
}) => {
	await setup(page, request, { count: 1, suggest_spoken: true });
	await newJob(page);
	const spoken = page.getByRole('switch', { name: 'Spoken English interview' });
	await spoken.check();
	await page.getByRole('button', { name: 'Suggest with AI' }).click();
	await expect(page.getByText('Suggested by AI from your description.')).toBeVisible();
	await spoken.uncheck();
	await expect(spoken).not.toBeChecked();
	await expect(page.getByText('AI suggests turning this on.')).toHaveCount(0);
});

test('editing a job with applicants sends the switch and notes the sent interviews', async ({
	page,
	request
}) => {
	await setup(page, request, { count: 1, applicants: 1 });
	await page.goto(`/dashboard/jobs/${SEED_JOB_ID}/edit`);
	await expect(
		page.getByText(
			'Changing this applies to invites sent after you save. The 1 interview already sent keeps its mode.'
		)
	).toBeVisible();
	await page.getByRole('switch', { name: 'Spoken English interview' }).check();
	await page.getByRole('button', { name: 'Save changes' }).click();
	await expect(page).toHaveURL(`/dashboard/jobs/${SEED_JOB_ID}?saved=updated`);
	const { lastPatch } = await editorState(request);
	expect(lastPatch).toMatchObject({ spoken_english_required: true });
	expectOnlyJobFields(lastPatch);
});

test('the Write and Preview tabs move with the arrow keys', async ({ page, request }) => {
	await setup(page, request, {});
	await newJob(page);
	const write = page.getByRole('tab', { name: 'Write' });
	const preview = page.getByRole('tab', { name: 'Preview' });
	await write.focus();

	await page.keyboard.press('ArrowRight');
	await expect(preview).toBeFocused();
	await expect(preview).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByRole('tabpanel', { name: 'Preview' })).toBeVisible();

	await page.keyboard.press('ArrowLeft');
	await expect(write).toBeFocused();
	await expect(write).toHaveAttribute('aria-selected', 'true');
	await expect(page.locator('#field-description')).toBeVisible();
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
	expectOnlyJobFields(lastPatch);
});

test('a used-up suggestion limit shows the wait and keeps the criteria', async ({
	page,
	request
}) => {
	await setup(page, request, { count: 1, suggest_limited: true });
	await newJob(page);
	await page.locator('#field-rubric-0-label').fill('Keep me');
	await expect(page.locator('#field-rubric-0-key')).toHaveValue('keep_me');

	page.once('dialog', (dialog) => void dialog.accept());
	await page.getByRole('button', { name: 'Suggest with AI' }).click();
	await expect(page.getByRole('alert')).toContainText(
		'Suggestions are used up for this hour. Try again in 3 min'
	);
	await expect(page.locator('#field-rubric-0-label')).toHaveValue('Keep me');
});

test('suggesting over existing criteria asks first, and cancelling keeps them', async ({
	page,
	request
}) => {
	await setup(page, request, { count: 1 });
	await newJob(page);
	await page.getByRole('button', { name: 'Suggest with AI' }).click();
	await expect(page.locator('#field-rubric-0-label')).toHaveValue('Product sense');
	await page.locator('#field-rubric-0-label').fill('Keep me');

	const asked = page.waitForEvent('dialog');
	const click = page.getByRole('button', { name: 'Suggest with AI' }).click();
	const dialog = await asked;
	expect(dialog.type()).toBe('confirm');
	expect(dialog.message()).toBe('Replace the current criteria with a new suggestion?');
	await dialog.dismiss();
	await click;

	await expect(page.getByRole('button', { name: 'Suggest with AI' })).toBeEnabled();
	await expect(page.locator('#field-rubric-0-label')).toHaveValue('Keep me');
});

test('a session that ends before Suggest keeps the form and offers sign-in in a new tab', async ({
	page,
	context,
	request
}) => {
	await setup(page, request, { count: 1 });
	await newJob(page);
	await page.locator('#field-rubric-0-label').fill('Keep me');
	await context.clearCookies();

	page.once('dialog', (dialog) => void dialog.accept());
	await page.getByRole('button', { name: 'Suggest with AI' }).click();
	await expect(page.getByRole('alert')).toContainText(
		'Your session ended. Sign in again in a new tab, then try Suggest again.'
	);
	await expect(page).toHaveURL('/dashboard/jobs/new');
	await expect(page.locator('#field-title')).toHaveValue('Platform Engineer');
	await expect(page.locator('#field-description')).toHaveValue(DESCRIPTION);
	await expect(page.locator('#field-rubric-0-label')).toHaveValue('Keep me');

	const login = page.getByRole('alert').getByRole('link', { name: /sign in/i });
	await expect(login).toHaveAttribute('target', '_blank');
	await expect(login).toHaveAttribute(
		'href',
		'/dashboard/login?redirectTo=%2Fdashboard%2Fjobs%2Fnew'
	);
});

test('at 20 jobs "New job" is disabled', async ({ page, request }) => {
	await setup(page, request, { count: 20 });
	await expect(page.getByRole('button', { name: 'New job' })).toBeDisabled();
	await expect(page.getByRole('link', { name: 'New job' })).toHaveCount(0);
	await expect(page.getByText('The demo holds 20 jobs. Edit or close one instead.')).toBeVisible();
});
