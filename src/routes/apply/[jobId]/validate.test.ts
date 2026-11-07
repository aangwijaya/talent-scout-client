import { describe, expect, it } from 'vitest';
import { MAX_CV_BYTES, validateApplication } from './validate';

const pdf = (size = 1024, type = 'application/pdf', name = 'cv.pdf') =>
	new File([new Uint8Array(size)], name, { type });

function form(fields: { name?: string; email?: string; cv?: File | null }) {
	const data = new FormData();
	data.set('name', fields.name ?? 'Budi Santoso');
	data.set('email', fields.email ?? 'budi@example.com');
	if (fields.cv !== null) data.set('cv', fields.cv ?? pdf());
	return data;
}

describe('validateApplication', () => {
	it('accepts a valid name, email and PDF up to 2 MB', () => {
		expect(validateApplication(form({ cv: pdf(MAX_CV_BYTES) }))).toEqual({});
	});

	it('rejects a name outside 2–100 characters', () => {
		expect(validateApplication(form({ name: ' B ' })).name).toBeDefined();
		expect(validateApplication(form({ name: 'x'.repeat(101) })).name).toBeDefined();
	});

	it('rejects an invalid email', () => {
		expect(validateApplication(form({ email: 'budi@' })).email).toBeDefined();
	});

	it('rejects a missing CV, a non-PDF and a PDF over 2 MB', () => {
		expect(validateApplication(form({ cv: null })).cv).toMatch(/pdf/i);
		expect(validateApplication(form({ cv: pdf(10, 'text/plain', 'cv.txt') })).cv).toMatch(/pdf/i);
		expect(validateApplication(form({ cv: pdf(MAX_CV_BYTES + 1) })).cv).toMatch(/2 MB/);
	});
});
