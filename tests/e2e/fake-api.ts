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

function json(res: import('node:http').ServerResponse, status: number, body: unknown): void {
	res.writeHead(status, { 'content-type': 'application/json' });
	res.end(JSON.stringify(body));
}

createServer((req, res) => {
	const path = new URL(req.url ?? '/', 'http://localhost').pathname;
	if (path === '/__seen') return json(res, 200, { token: FAKE_ACCESS_TOKEN, requests: seen });
	if (path === '/__reset') {
		seen.length = 0;
		return json(res, 200, {});
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
		return json(res, 200, { items: [], next_cursor: null });
	}
	json(res, 404, { error: { code: 'not_found', message: 'Not found' } });
}).listen(Number(process.argv[2] ?? 4180));
