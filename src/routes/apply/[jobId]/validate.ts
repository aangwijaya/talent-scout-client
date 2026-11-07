// Shared by the browser form and the apply action, so it must stay free of server-only imports.

export const MAX_CV_BYTES = 2 * 1024 * 1024;

export type ApplicationErrors = Partial<Record<'name' | 'email' | 'cv', string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCv(cv: FormDataEntryValue | null): string | undefined {
	if (!(cv instanceof File) || cv.size === 0) return 'Please attach your CV as a PDF.';
	const isPdf = cv.type === 'application/pdf' || cv.name.toLowerCase().endsWith('.pdf');
	if (!isPdf) return 'Your CV must be a PDF file.';
	if (cv.size > MAX_CV_BYTES) return 'Your CV must be 2 MB or smaller.';
}

/** Mirrors the contract limits: name 2–100 characters, a valid email, a PDF CV of at most 2 MB. */
export function validateApplication(form: FormData): ApplicationErrors {
	const errors: ApplicationErrors = {};
	const name = String(form.get('name') ?? '').trim();
	const email = String(form.get('email') ?? '').trim();

	if (name.length < 2 || name.length > 100) errors.name = 'Enter your name (2–100 characters).';
	if (!EMAIL.test(email)) errors.email = 'Enter a valid email address.';
	const cv = validateCv(form.get('cv'));
	if (cv) errors.cv = cv;
	return errors;
}
