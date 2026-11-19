// Pure helpers for the job create/edit form, shared by its page actions and the editor.
// The rules mirror docs/API.md "Job validation"; the server stays the authority.
import type { JobStatus, JobUpdateRequest, RubricCriterion } from '$lib/server/api/types';

export const JOB_LIMIT = 20;
export const LIMIT_MESSAGE = 'The demo holds 20 jobs. Edit or close one instead.';
export const DESCRIPTION_MAX = 12_000;
export const RUBRIC_MIN = 3;
export const RUBRIC_MAX = 6;

const KEY_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;
const KEY_MAX = 40;
const CRITERION_FIELDS = ['key', 'label', 'description', 'weight'] as const;
const CRITERION_FIELD = /^rubric\[(\d+)\]\.(key|label|description|weight)$/;
const JOB_FIELDS = ['title', 'description', 'status', 'rubric'] as const;

export type JobValues = {
	title: string;
	description: string;
	status: JobStatus;
	rubric: RubricCriterion[];
};

/** Field path (`title`, `rubric[1].key`) → message. `form` holds errors that belong to no input. */
export type FieldErrors = Record<string, string>;

export const MESSAGES = {
	title: 'Use 3 to 120 characters.',
	description: 'Use 50 to 12,000 characters.',
	status: 'Choose Open or Closed.',
	rubric: 'Add 3 to 6 criteria.',
	key: 'Use 2 to 40 lowercase letters, digits or _, starting with a letter.',
	duplicateKey: 'Each key must be unique.',
	label: 'Use 2 to 60 characters.',
	criterionDescription: 'Use 10 to 300 characters.',
	weight: 'Pick a weight of ×1, ×2 or ×3.'
};

/** Characters as the API counts them (code points, not UTF-16 units). */
export const charCount = (value: string) => [...value].length;

const within = (value: string, min: number, max: number) => {
	const length = charCount(value);
	return length >= min && length <= max;
};

/** Lowercase, `_` for anything else, starting with a letter, 40 characters at most. */
export function keyFromLabel(label: string): string {
	return label
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^[^a-z]+/, '')
		.slice(0, KEY_MAX)
		.replace(/_+$/, '');
}

export function validateJob(
	values: JobValues,
	{ rubricLocked = false }: { rubricLocked?: boolean } = {}
): FieldErrors {
	const errors: FieldErrors = {};
	if (!within(values.title, 3, 120)) errors.title = MESSAGES.title;
	if (!within(values.description, 50, DESCRIPTION_MAX)) errors.description = MESSAGES.description;
	if (values.status !== 'open' && values.status !== 'closed') errors.status = MESSAGES.status;
	if (rubricLocked) return errors;

	const { rubric } = values;
	if (rubric.length < RUBRIC_MIN || rubric.length > RUBRIC_MAX) errors.rubric = MESSAGES.rubric;
	const seen = new Set<string>();
	rubric.forEach((criterion, i) => {
		const at = `rubric[${i}]`;
		if (!KEY_PATTERN.test(criterion.key)) errors[`${at}.key`] = MESSAGES.key;
		else if (seen.has(criterion.key)) errors[`${at}.key`] = MESSAGES.duplicateKey;
		seen.add(criterion.key);
		if (!within(criterion.label, 2, 60)) errors[`${at}.label`] = MESSAGES.label;
		if (!within(criterion.description, 10, 300)) {
			errors[`${at}.description`] = MESSAGES.criterionDescription;
		}
		if (!Number.isInteger(criterion.weight) || criterion.weight < 1 || criterion.weight > 3) {
			errors[`${at}.weight`] = MESSAGES.weight;
		}
	});
	return errors;
}

/** The form field a server `details.field` names, or `form` when it names none of them. */
export function mapServerField(details: Record<string, unknown> | null, rubricLength: number) {
	const field = details?.field;
	if (typeof field !== 'string') return 'form';
	if (JOB_FIELDS.some((name) => name === field)) return field;
	const match = CRITERION_FIELD.exec(field);
	return match && Number(match[1]) < rubricLength ? field : 'form';
}

/** `rubric[1].key` → `field-rubric-1-key`: the id of the input whose `name` is that path. */
export function fieldId(path: string): string {
	return `field-${path.replace(/[[\].]+/g, '-').replace(/-$/, '')}`;
}

/** The API refuses any `rubric` once a job has applications, even an unchanged one. */
export function patchBody(
	values: JobValues,
	{ rubricLocked }: { rubricLocked: boolean }
): JobUpdateRequest {
	const { title, description, status, rubric } = values;
	return rubricLocked ? { title, description, status } : { title, description, status, rubric };
}

/** Reads the fields named by their contract paths (`rubric[0].key`, …), in index order. */
export function parseJobForm(form: FormData): JobValues {
	const text = (name: string) => {
		const value = form.get(name);
		return typeof value === 'string' ? value : '';
	};
	const indexes = new Set<number>();
	for (const name of form.keys()) {
		const match = CRITERION_FIELD.exec(name);
		if (match) indexes.add(Number(match[1]));
	}
	const rubric = [...indexes]
		.sort((a, b) => a - b)
		.map((i) => {
			const [key, label, description, weight] = CRITERION_FIELDS.map((f) =>
				text(`rubric[${i}].${f}`)
			);
			return { key, label, description, weight: Number(weight) };
		});
	return {
		title: text('title'),
		description: text('description'),
		status: text('status') === 'closed' ? 'closed' : 'open',
		rubric
	};
}

/** What the BFF suggest endpoint answers. */
export type SuggestResult =
	| { ok: true; rubric: RubricCriterion[] }
	| { ok: false; status: number; retry_after_seconds: number | null };

export type SuggestError =
	{ kind: 'rate_limited'; minutes: number | null } | { kind: 'unavailable' };

export function retryAfterMinutes(seconds: number | null): number | null {
	if (seconds === null || !Number.isFinite(seconds)) return null;
	return Math.max(1, Math.ceil(seconds / 60));
}

/** A failed suggestion never touches the current criteria. */
export function applySuggestion(
	current: RubricCriterion[],
	result: SuggestResult
): { rubric: RubricCriterion[]; error: SuggestError | null } {
	if (result.ok) return { rubric: result.rubric, error: null };
	if (result.status === 429) {
		return {
			rubric: current,
			error: { kind: 'rate_limited', minutes: retryAfterMinutes(result.retry_after_seconds) }
		};
	}
	return { rubric: current, error: { kind: 'unavailable' } };
}
