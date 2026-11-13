import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pdfUrl = new URL('cv.pdf', import.meta.url);
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
		const committed = readFileSync(pdfUrl);
		execFileSync(process.execPath, [new URL('make-cv-pdf.ts', import.meta.url).pathname]);
		expect(readFileSync(pdfUrl).equals(committed)).toBe(true);
	});
});
