import { spawn, type ChildProcess } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let server: ChildProcess;
let origin: string;
let BASE: string;

/** Port 0 lets the OS pick a free port; the server prints the one it got. */
beforeAll(async () => {
	server = spawn(process.execPath, [
		new URL('../../tests/e2e/fake-storage.ts', import.meta.url).pathname,
		'0'
	]);
	const port = await new Promise<string>((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error('fake storage did not start')), 5000);
		let out = '';
		server.stdout?.on('data', (chunk: Buffer) => {
			out += chunk.toString();
			const match = /listening on (\d+)/.exec(out);
			if (match) {
				clearTimeout(timer);
				resolve(match[1]);
			}
		});
	});
	origin = `http://localhost:${port}`;
	BASE = `${origin}/storage/v1/object`;
});

afterAll(() => {
	server.kill();
});

describe('fake Supabase Storage', () => {
	it('stores an uploaded object and returns the same bytes and content type', async () => {
		const body = new Uint8Array([37, 80, 68, 70, 0, 255]);
		const upload = await fetch(`${BASE}/cvs/app-1/cv.pdf`, {
			method: 'POST',
			headers: { 'content-type': 'application/pdf' },
			body
		});
		expect(upload.status).toBe(200);

		const read = await fetch(`${BASE}/cvs/app-1/cv.pdf`);
		expect(read.status).toBe(200);
		expect(read.headers.get('content-type')).toBe('application/pdf');
		expect(new Uint8Array(await read.arrayBuffer())).toEqual(body);
	});

	it('serves the authenticated/ and public/ read paths from the same object', async () => {
		await fetch(`${BASE}/cvs/app-2/cv.pdf`, { method: 'PUT', body: 'hello' });

		for (const variant of ['authenticated', 'public']) {
			const read = await fetch(`${BASE}/${variant}/cvs/app-2/cv.pdf`);
			expect(read.status).toBe(200);
			expect(await read.text()).toBe('hello');
		}
	});

	it('answers HEAD with headers only', async () => {
		await fetch(`${BASE}/cvs/app-3/cv.pdf`, { method: 'POST', body: 'abc' });

		const head = await fetch(`${BASE}/cvs/app-3/cv.pdf`, { method: 'HEAD' });
		expect(head.status).toBe(200);
		expect(head.headers.get('content-length')).toBe('3');
	});

	it('returns 404 for a missing object or a path outside the storage API', async () => {
		expect((await fetch(`${BASE}/cvs/missing.pdf`)).status).toBe(404);
		expect((await fetch(`${origin}/rest/v1/jobs`)).status).toBe(404);
	});

	it('rejects other methods', async () => {
		expect((await fetch(`${BASE}/cvs/app-1/cv.pdf`, { method: 'DELETE' })).status).toBe(405);
	});
});
