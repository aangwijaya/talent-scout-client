import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import { MOCK_PLANNER_RETRY_RUN_ID, MOCK_RUN_ID, mockRunEvents } from '$lib/mock';
import { graphRunSnapshot } from '$lib/server/api/fixtures';
import { initialRunState, reduceRun } from '$lib/stores/graph';
import { EDGE_GEOMETRY } from './graph-layout';

vi.mock('@xyflow/svelte/dist/base.css', () => ({}));

const { default: GraphView } = await import('./GraphView.svelte');

function initial(runId: string) {
	const snapshot = graphRunSnapshot(runId);
	if (!snapshot) expect.unreachable();
	return initialRunState(snapshot);
}

describe('GraphView', () => {
	it('hides the xyflow attribution link, as in the approved mockup', () => {
		const run = initial(MOCK_RUN_ID);
		const { body } = render(GraphView, { props: { run, selectedId: null, onselect: () => {} } });
		expect(body).toContain('svelte-flow');
		expect(body).not.toContain('svelte-flow__attribution');
		expect(body).not.toContain('xyflow.com');
	});

	it('draws the planner self-loop, lit after the manual retry, and the ×3 badge', () => {
		const events = mockRunEvents[MOCK_PLANNER_RETRY_RUN_ID];
		const loop = events.findIndex(
			(e) => e.event === 'edge.traversed' && e.data.from === 'planner' && e.data.to === 'planner'
		);
		expect(loop).toBeGreaterThan(-1);
		const run = reduceRun(initial(MOCK_PLANNER_RETRY_RUN_ID), events.slice(0, loop + 1));
		const { body } = render(GraphView, { props: { run, selectedId: null, onselect: () => {} } });
		const path = EDGE_GEOMETRY['planner>planner']?.path;
		expect(path).toBeDefined();
		const edge = body.slice(body.indexOf(`d="${path}"`) - 300, body.indexOf(`d="${path}"`) + 300);
		expect(body).toContain(`d="${path}"`);
		expect(edge).toContain('data-state="latest"');
		expect(body).toContain('×3');
	});
});
