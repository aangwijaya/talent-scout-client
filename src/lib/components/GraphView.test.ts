import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import { MOCK_PLANNER_RETRY_RUN_ID, MOCK_RUN_ID, mockRunEvents } from '$lib/mock';
import { graphRunSnapshot } from '$lib/server/api/fixtures';
import { initialRunState, reduceRun } from '$lib/stores/graph';
import GraphEdge from './GraphEdge.svelte';
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

	describe('after the manual planner retry (§6.4)', () => {
		const events = mockRunEvents[MOCK_PLANNER_RETRY_RUN_ID];
		const loop = events.findIndex(
			(e) => e.event === 'edge.traversed' && e.data.from === 'planner' && e.data.to === 'planner'
		);
		const run = reduceRun(initial(MOCK_PLANNER_RETRY_RUN_ID), events.slice(0, loop + 1));

		it('shows the ×3 retry badge on the planner', () => {
			const { body } = render(GraphView, { props: { run, selectedId: null, onselect: () => {} } });
			expect(body).toContain('aria-label="Planner, splitter, Retry 3/4, attempt 3"');
			expect(body).toContain('×3</span>');
		});

		// xyflow renders no edges on the server, so the loop is drawn through GraphEdge directly.
		it('draws the planner self-loop as the latest edge', () => {
			const edge = run.edges.find(({ id }) => id === 'planner>planner');
			const geometry = EDGE_GEOMETRY['planner>planner'];
			if (!edge || !geometry) expect.unreachable('run.started lists the planner self-loop');
			const data = {
				geometry,
				taken: edge.taken,
				latest: edge.id === run.latestEdgeId,
				retryPath: edge.retryPath
			};
			const { body } = render(GraphEdge, { props: { id: edge.id, data } });
			expect(body).toContain(`d="${geometry.path}"`);
			expect(body).toContain('data-state="latest"');
			expect(body).toContain('>retry</span>');
		});
	});
});
