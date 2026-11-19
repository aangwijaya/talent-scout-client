import { describe, expect, it } from 'vitest';
import {
	JOB_LIMIT,
	applySuggestion,
	fieldId,
	keyFromLabel,
	mapServerField,
	patchBody,
	retryAfterMinutes,
	validateJob,
	type JobValues
} from './job-form';

const criterion = (key: string, weight = 1) => ({
	key,
	label: `Label ${key}`,
	description: 'A long enough description',
	weight
});

const valid: JobValues = {
	title: 'Frontend Engineer',
	description: 'x'.repeat(50),
	status: 'open',
	rubric: [criterion('one'), criterion('two', 2), criterion('three', 3)]
};

describe('keyFromLabel', () => {
	it.each([
		['Frontend depth', 'frontend_depth'],
		['  API & Systems — design!  ', 'api_systems_design'],
		['3D graphics', 'd_graphics'],
		['Ünïcode Label', 'n_code_label'],
		['a', 'a'],
		['', ''],
		['x'.repeat(60), 'x'.repeat(40)],
		['abc '.repeat(11), `${'abc_'.repeat(9)}abc`]
	])('%j → %j', (label, key) => {
		expect(keyFromLabel(label)).toBe(key);
	});

	it('always yields a key the contract accepts once the label has two letters', () => {
		for (const label of ['Frontend depth', '9 lives of cats', 'Communication', 'x'.repeat(80)]) {
			expect(keyFromLabel(label)).toMatch(/^[a-z][a-z0-9_]{1,39}$/);
		}
	});
});

describe('validateJob (docs/API.md "Job validation")', () => {
	it('accepts a valid job', () => {
		expect(validateJob(valid)).toEqual({});
	});

	it.each([
		['title', { title: 'ab' }],
		['title', { title: 'x'.repeat(121) }],
		['description', { description: 'x'.repeat(49) }],
		['description', { description: 'x'.repeat(12_001) }],
		['rubric', { rubric: [criterion('one'), criterion('two')] }],
		['rubric', { rubric: Array.from({ length: 7 }, (_, i) => criterion(`key_${i}`)) }],
		['rubric[1].key', { rubric: [criterion('one'), criterion('1bad'), criterion('three')] }],
		['rubric[2].key', { rubric: [criterion('one'), criterion('two'), criterion('one')] }],
		['rubric[0].key', { rubric: [criterion('o'), criterion('two'), criterion('three')] }],
		['rubric[0].label', { rubric: [{ ...criterion('one'), label: 'a' }, ...valid.rubric.slice(1)] }],
		[
			'rubric[0].description',
			{ rubric: [{ ...criterion('one'), description: 'too short' }, ...valid.rubric.slice(1)] }
		],
		['rubric[0].weight', { rubric: [criterion('one', 4), ...valid.rubric.slice(1)] }]
	] as const)('flags %s', (field, patch) => {
		expect(Object.keys(validateJob({ ...valid, ...patch }))).toContain(field);
	});

	it('accepts the boundaries', () => {
		const job = {
			...valid,
			title: 'abc',
			description: 'x'.repeat(12_000),
			rubric: Array.from({ length: 6 }, (_, i) => ({
				key: `k${i}${'x'.repeat(37)}`,
				label: 'ab',
				description: 'x'.repeat(300),
				weight: 3
			}))
		};
		expect(validateJob(job)).toEqual({});
	});

	it('counts characters, not UTF-16 units', () => {
		expect(validateJob({ ...valid, title: '😀😀😀' })).toEqual({});
	});

	it('skips the rubric when it is locked', () => {
		expect(validateJob({ ...valid, rubric: [] }, { rubricLocked: true })).toEqual({});
	});
});

describe('mapServerField', () => {
	it.each([
		['title', 'title'],
		['description', 'description'],
		['status', 'status'],
		['rubric', 'rubric'],
		['rubric[1].key', 'rubric[1].key'],
		['rubric[0].weight', 'rubric[0].weight']
	])('maps details.field %s to %s', (field, key) => {
		expect(mapServerField({ field }, 3)).toBe(key);
	});

	it('falls back to the form when the field is unknown, missing or out of range', () => {
		expect(mapServerField({ field: 'salary' }, 3)).toBe('form');
		expect(mapServerField(null, 3)).toBe('form');
		expect(mapServerField({ field: 'rubric[7].key' }, 3)).toBe('form');
	});

	it('names inputs so the mapped field lands on the matching element id', () => {
		expect(fieldId('rubric[1].key')).toBe('field-rubric-1-key');
		expect(fieldId('title')).toBe('field-title');
	});
});

describe('patchBody', () => {
	it('leaves rubric out when the job has applications', () => {
		const body = patchBody(valid, { rubricLocked: true });
		expect(body).not.toHaveProperty('rubric');
		expect(body).toEqual({
			title: valid.title,
			description: valid.description,
			status: valid.status
		});
	});

	it('sends the rubric when the job has no applications', () => {
		expect(patchBody(valid, { rubricLocked: false }).rubric).toEqual(valid.rubric);
	});
});

describe('applySuggestion', () => {
	const current = valid.rubric;

	it('replaces the criteria on success', () => {
		const rubric = [criterion('a_key'), criterion('b_key'), criterion('c_key')];
		expect(applySuggestion(current, { ok: true, rubric })).toEqual({ rubric, error: null });
	});

	it('keeps the criteria on 429 and reports the wait in minutes, rounded up', () => {
		const outcome = applySuggestion(current, {
			ok: false,
			status: 429,
			retry_after_seconds: 61
		});
		expect(outcome.rubric).toBe(current);
		expect(outcome.error).toEqual({ kind: 'rate_limited', minutes: 2 });
	});

	it('keeps the criteria on 502', () => {
		const outcome = applySuggestion(current, { ok: false, status: 502, retry_after_seconds: null });
		expect(outcome.rubric).toBe(current);
		expect(outcome.error).toEqual({ kind: 'unavailable' });
	});
});

describe('retryAfterMinutes', () => {
	it.each([
		['120', 2],
		['121', 3],
		['1', 1],
		['0', 1],
		[null, null],
		['soon', null]
	])('Retry-After %j → %j', (value, minutes) => {
		expect(retryAfterMinutes(value === null ? null : Number(value))).toBe(minutes);
	});
});

it('caps the demo at 20 jobs', () => {
	expect(JOB_LIMIT).toBe(20);
});
