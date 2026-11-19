// A stand-in for the Go API, used by `auth.e2e.ts`. It answers the few endpoints the recruiter
// login and job list need, and records the headers of every `/api/v1` request so the test can
// see exactly what the BFF sent. Run with `node tests/e2e/fake-api.ts <port>`.
import { createServer, type IncomingHttpHeaders } from 'node:http';

const FAKE_ACCESS_TOKEN = 'e2e-fake-access-token';

const paragraph = (topic: string) =>
	`You will ${topic} with a small team. `.repeat(6) + 'We value **clear writing** and `svelte`.';

/** Ids are repeated in `smoke.e2e.ts`. */
const JD_JOBS: Record<string, { title: string; description: string }> = {
	'0d1c5c3a-2f5e-4c39-9d6b-1f6c2b9a7e01': {
		title: 'Long JD Engineer',
		description: [
			'# About the role',
			paragraph('build the screening product'),
			'## What you will do',
			'- Own the recruiter dashboard\n- Ship the applicant chat\n- Review pull requests',
			paragraph('work on the graph view'),
			'## What we look for',
			'1. Svelte 5\n2. TypeScript\n3. Accessibility',
			paragraph('pair with designers'),
			'## How to apply',
			'Send your CV through the form. Questions: [email us](mailto:jobs@example.com).'
		].join('\n\n')
	},
	'0d1c5c3a-2f5e-4c39-9d6b-1f6c2b9a7e02': {
		title: 'Short JD Engineer',
		description: 'Build the dashboard.\nOwn frontend quality.'
	}
};

const seen: { method: string; path: string; headers: IncomingHttpHeaders }[] = [];

// Job editor state for the job tests in `auth.e2e.ts`; `POST /__jobs` resets it.
type Criterion = { key: string; label: string; description: string; weight: number };
type FakeJob = {
	id: string;
	title: string;
	description: string;
	rubric: Criterion[];
	status: 'open' | 'closed';
	apply_url: string;
	application_count: number;
	created_at: string;
	updated_at: string;
};
/** Repeated in `auth.e2e.ts`. */
const SEED_JOB_ID = 'e2e00000-0000-4000-8000-000000000001';
const JOB_LIMIT = 20;
const SUGGESTION: Criterion[] = [
	{
		key: 'product_sense',
		label: 'Product sense',
		description: 'Ships small useful features',
		weight: 2
	},
	{
		key: 'frontend_craft',
		label: 'Frontend craft',
		description: 'Accessible, fast interfaces',
		weight: 3
	},
	{
		key: 'collaboration',
		label: 'Collaboration',
		description: 'Works well with design and backend',
		weight: 1
	}
];
const editor = {
	jobs: [] as FakeJob[],
	suggestLimited: false,
	lastCreate: null as unknown,
	lastPatch: null as unknown
};

function fakeJob(id: string, title: string, fields: Partial<FakeJob> = {}): FakeJob {
	const now = new Date().toISOString();
	return {
		id,
		title,
		description: `${title} builds the product with a small team. `.repeat(3),
		rubric: SUGGESTION,
		status: 'open',
		apply_url: `http://localhost/apply/${id}`,
		application_count: 0,
		created_at: now,
		updated_at: now,
		...fields
	};
}

function resetEditor({ count = 1, applicants = 0, suggest_limited = false } = {}): void {
	editor.jobs = Array.from({ length: count }, (_, i) =>
		i === 0
			? fakeJob(SEED_JOB_ID, 'Seeded Engineer', { application_count: applicants })
			: fakeJob(crypto.randomUUID(), `Filler job ${i}`)
	);
	editor.suggestLimited = suggest_limited;
	editor.lastCreate = null;
	editor.lastPatch = null;
}

async function readJson(
	req: import('node:http').IncomingMessage
): Promise<Record<string, unknown>> {
	let text = '';
	for await (const chunk of req) text += chunk;
	return text ? JSON.parse(text) : {};
}

function json(
	res: import('node:http').ServerResponse,
	status: number,
	body: unknown,
	headers: Record<string, string> = {}
): void {
	res.writeHead(status, { 'content-type': 'application/json', ...headers });
	res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
	const path = new URL(req.url ?? '/', 'http://localhost').pathname;
	if (path === '/__seen') return json(res, 200, { token: FAKE_ACCESS_TOKEN, requests: seen });
	if (path === '/__reset') {
		seen.length = 0;
		return json(res, 200, {});
	}
	if (path === '/__jobs') {
		if (req.method === 'POST') resetEditor(await readJson(req));
		return json(res, 200, editor);
	}

	// Public job pages for `smoke.e2e.ts`; kept out of `seen` because those tests run in parallel.
	const jd = path.match(/^\/api\/v1\/jobs\/([^/]+)\/(public|applications)$/);
	if (jd && jd[1] in JD_JOBS) {
		if (req.method === 'POST') {
			return json(res, 409, { error: { code: 'already_applied', message: 'Already applied' } });
		}
		return json(res, 200, { id: jd[1], ...JD_JOBS[jd[1]], status: 'open' });
	}

	seen.push({ method: req.method ?? 'GET', path, headers: req.headers });
	if (req.method === 'POST' && path === '/api/v1/auth/login') {
		const expires_at = new Date(Date.now() + 12 * 3_600_000).toISOString();
		return json(res, 200, { access_token: FAKE_ACCESS_TOKEN, expires_at });
	}
	if (req.method === 'GET' && path === '/api/v1/jobs') {
		return json(res, 200, { items: editor.jobs, next_cursor: null });
	}
	if (req.method === 'POST' && path === '/api/v1/jobs') {
		if (editor.jobs.length >= JOB_LIMIT) {
			return json(res, 409, { error: { code: 'invalid_state', message: 'Job limit reached' } });
		}
		const body = await readJson(req);
		editor.lastCreate = body;
		const job = fakeJob(crypto.randomUUID(), String(body.title), body as Partial<FakeJob>);
		editor.jobs.unshift(job);
		return json(res, 201, job);
	}
	if (req.method === 'POST' && path === '/api/v1/jobs/rubric-suggestion') {
		if (editor.suggestLimited) {
			const error = { code: 'rate_limited', message: 'Suggestion limit reached' };
			return json(res, 429, { error }, { 'retry-after': '125' });
		}
		return json(res, 200, { rubric: SUGGESTION });
	}
	const jobPath = path.match(/^\/api\/v1\/jobs\/([^/]+)(\/public|\/applications)?$/);
	const job = editor.jobs.find(({ id }) => id === jobPath?.[1]);
	if (jobPath && job) {
		if (jobPath[2] === '/applications') return json(res, 200, { items: [], next_cursor: null });
		if (jobPath[2] === '/public') {
			const { id, title, description, status } = job;
			return json(res, 200, { id, title, description, status });
		}
		if (req.method === 'PATCH') {
			const patch = await readJson(req);
			editor.lastPatch = patch;
			if ('rubric' in patch && job.application_count > 0) {
				return json(res, 409, { error: { code: 'invalid_state', message: 'Rubric is locked' } });
			}
			Object.assign(job, patch, { updated_at: new Date().toISOString() });
		}
		return json(res, 200, job);
	}
	json(res, 404, { error: { code: 'not_found', message: 'Not found' } });
}).listen(Number(process.argv[2] ?? 4180));
