import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import { MOCK_RUN_ID } from '$lib/mock';
import { graphRunSnapshot } from '$lib/server/api/fixtures';
import { initialRunState } from '$lib/stores/graph';

vi.mock('@xyflow/svelte/dist/base.css', () => ({}));

const { default: GraphView } = await import('./GraphView.svelte');

describe('GraphView', () => {
	it('hides the xyflow attribution link, as in the approved mockup', () => {
		const snapshot = graphRunSnapshot(MOCK_RUN_ID);
		if (!snapshot) expect.unreachable();
		const run = initialRunState(snapshot);
		const { body } = render(GraphView, { props: { run, selectedId: null, onselect: () => {} } });
		expect(body).toContain('svelte-flow');
		expect(body).not.toContain('svelte-flow__attribution');
		expect(body).not.toContain('xyflow.com');
	});
});
