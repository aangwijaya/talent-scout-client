// Writes `cv.pdf`: a one-page PDF with extractable text for a made-up person (no real personal
// data), used by `integration.int.ts`. Rerun with `node tests/e2e/fixtures/make-cv-pdf.ts`.
import { writeFileSync } from 'node:fs';

const LINES = [
	'Jordan Example - Frontend Engineer',
	'Email: jordan@example.com',
	'Experience: 5 years building web apps with TypeScript, Svelte and React.',
	'Led a design system migration and cut page load time by 40 percent.',
	'Education: BSc Computer Science, Example University.',
	'This CV belongs to a fictional person and is used only for automated tests.'
];

const text = LINES.map((line, i) => `BT /F1 12 Tf 72 ${740 - i * 20} Td (${line}) Tj ET`).join(
	'\n'
);
const objects = [
	'<< /Type /Catalog /Pages 2 0 R >>',
	'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
	'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
	`<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
	'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
];

let pdf = '%PDF-1.4\n';
const offsets = objects.map((object, i) => {
	const offset = Buffer.byteLength(pdf);
	pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
	return offset;
});
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
pdf += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

writeFileSync(new URL('cv.pdf', import.meta.url), pdf);
