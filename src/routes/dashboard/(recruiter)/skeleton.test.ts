import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import RouteSkeleton from './RouteSkeleton.svelte';
import { skeletonFor } from './skeleton';

const route = (path: string) => `/dashboard/(recruiter)${path}`;

describe('skeletonFor', () => {
	it.each([
		['/jobs', 'table'],
		['/jobs/[jobId]', 'table'],
		['/jobs/new', 'form'],
		['/jobs/[jobId]/edit', 'form'],
		['/applications/[applicationId]', 'review'],
		['/runs/[runId]', 'run']
	])('shows the %s skeleton in its own shape', (path, kind) => {
		expect(skeletonFor(route(path), route('/jobs/other'))).toBe(kind);
	});

	it('leaves a reload of the same route to the page itself', () => {
		expect(skeletonFor(route('/jobs/[jobId]'), route('/jobs/[jobId]'))).toBeNull();
		expect(skeletonFor(null, route('/jobs'))).toBeNull();
		expect(skeletonFor('/dashboard/login', route('/jobs'))).toBeNull();
	});
});

describe('RouteSkeleton', () => {
	it.each([
		['table', 'Loading'],
		['review', 'Loading application'],
		['form', 'Loading job form'],
		['run', 'Loading graph run']
	] as const)('marks the %s skeleton busy with one status message', (kind, label) => {
		const body = render(RouteSkeleton, { props: { kind } }).body;
		expect(body).toContain('aria-busy="true"');
		expect(body.match(/role="status"/g)).toHaveLength(1);
		expect(body).toContain(`<span class="sr-only">${label}</span>`);
		expect(body).toContain('motion-safe:animate-pulse');
		expect(body).not.toMatch(/[\s"]animate-pulse/);
	});
});
