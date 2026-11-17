import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const fixtures = new URL('../../tests/e2e/fixtures/', import.meta.url);
const pdfUrl = new URL('cv.pdf', fixtures);
const pdf = () => readFileSync(pdfUrl, 'latin1');

describe('cv.pdf fixture', () => {
	it('is a one-page PDF with the made-up person as extractable text', () => {
		const file = pdf();
		expect(file.startsWith('%PDF-1.4\n')).toBe(true);
		expect(file.trimEnd().endsWith('%%EOF')).toBe(true);
		expect(file).toContain('/Count 1');
		expect(file).toContain('(Jordan Example - Frontend Engineer) Tj');
		expect(file).toContain('(Email: jordan@example.com) Tj');
	});

	it('has an xref table whose offsets point at each object', () => {
		const file = pdf();
		const xrefAt = Number(/startxref\n(\d+)\n/.exec(file)?.[1]);
		const entries = file
			.slice(xrefAt)
			.split('\n')
			.filter((line) => / 00000 n $/.test(line))
			.map((line) => Number(line.slice(0, 10)));

		expect(entries).toHaveLength(5);
		entries.forEach((offset, i) => {
			expect(file.slice(offset).startsWith(`${i + 1} 0 obj\n`)).toBe(true);
		});
	});

	it('matches what make-cv-pdf.ts generates', () => {
		const dir = mkdtempSync(join(tmpdir(), 'cv-pdf-'));
		try {
			const out = join(dir, 'cv.pdf');
			execFileSync(process.execPath, [new URL('make-cv-pdf.ts', fixtures).pathname, out]);
			expect(readFileSync(out).equals(readFileSync(pdfUrl))).toBe(true);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
