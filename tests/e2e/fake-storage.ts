// A stand-in for Supabase Storage, used by the `integration` CI job: the Go server uploads the
// applicant's CV here and reads it back for the recruiter's CV download. Bytes live in memory.
// Run with `node tests/e2e/fake-storage.ts <port>`.
import { createServer } from 'node:http';

const PREFIX = '/storage/v1/object/';
const objects = new Map<string, { type: string; body: Buffer }>();

/** `authenticated/` and `public/` are Supabase's read variants of the same object path. */
function objectKey(path: string): string {
	return decodeURIComponent(path.slice(PREFIX.length)).replace(/^(authenticated|public)\//, '');
}

createServer((req, res) => {
	const method = req.method ?? 'GET';
	const path = new URL(req.url ?? '/', 'http://localhost').pathname;
	// Logged so a failing CI run shows exactly what the server asked for.
	console.log(`${method} ${path}`);

	if (!path.startsWith(PREFIX)) {
		res.writeHead(404, { 'content-type': 'application/json' });
		return res.end(JSON.stringify({ statusCode: '404', error: 'not_found', message: 'Not found' }));
	}
	const key = objectKey(path);

	if (method === 'POST' || method === 'PUT') {
		const chunks: Buffer[] = [];
		req.on('data', (chunk: Buffer) => chunks.push(chunk));
		req.on('end', () => {
			const type = req.headers['content-type'] ?? 'application/octet-stream';
			objects.set(key, { type, body: Buffer.concat(chunks) });
			res.writeHead(200, { 'content-type': 'application/json' });
			res.end(JSON.stringify({ Key: key }));
		});
		return;
	}

	if (method === 'GET' || method === 'HEAD') {
		const object = objects.get(key);
		if (!object) {
			res.writeHead(404, { 'content-type': 'application/json' });
			return res.end(
				JSON.stringify({ statusCode: '404', error: 'not_found', message: 'Object not found' })
			);
		}
		res.writeHead(200, { 'content-type': object.type, 'content-length': object.body.length });
		return res.end(method === 'HEAD' ? undefined : object.body);
	}

	res.writeHead(405);
	res.end();
}).listen(Number(process.argv[2] ?? 4181));
