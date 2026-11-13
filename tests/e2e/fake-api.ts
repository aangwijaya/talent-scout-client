// A stand-in for the Go API, used by `auth.e2e.ts`. It answers the few endpoints the recruiter
// login and job list need, and records the headers of every `/api/v1` request so the test can
// see exactly what the BFF sent. Run with `node tests/e2e/fake-api.ts <port>`.
import { createServer, type IncomingHttpHeaders } from 'node:http';

const FAKE_ACCESS_TOKEN = 'e2e-fake-access-token';

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
