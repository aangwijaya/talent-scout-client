import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import GraphEdge from './GraphEdge.svelte';
import { EDGE_GEOMETRY, NODE_POSITIONS, NODE_WIDTH } from './graph-layout';

describe.each(['interviewer', 'planner'] as const)('%s self-loop edge', (node) => {
	const id = `${node}>${node}`;
	const selfLoop = EDGE_GEOMETRY[id];

	function edge(taken: boolean, latest: boolean): string {
		const data = { geometry: selfLoop, taken, latest, retryPath: true };
		return render(GraphEdge, { props: { id, data } }).body;
	}

	it('leaves and re-enters through the top of the node, never across it', () => {
		const { x, y } = NODE_POSITIONS[node];
		const points = [...selfLoop.path.matchAll(/(\d+),(\d+)/g)].map(([, px, py]) => [+px, +py]);
		expect(points.at(0)?.[1]).toBe(y);
		expect(points.at(-1)?.[1]).toBe(y);
		for (const [px, py] of points) {
			expect(py).toBeLessThanOrEqual(y);
			expect(px).toBeGreaterThan(x);
			expect(px).toBeLessThan(x + NODE_WIDTH);
		}
	});

	it('renders as a dashed retry path until it is taken', () => {
		const body = edge(false, false);
		expect(body).toContain(`d="${selfLoop.path}"`);
		expect(body).toContain('data-state="idle"');
		expect(body).toContain('data-retry="true"');
		expect(body).toContain('>retry</span>');
	});

	it('lights up as the latest edge, then stays taken', () => {
		expect(edge(true, true)).toContain('data-state="latest"');
		expect(edge(true, false)).toContain('data-state="taken"');
	});
});

it('draws the planner loop as the interviewer loop moved over the Planner node', () => {
	expect(EDGE_GEOMETRY['planner>planner']).toEqual({
		path: 'M100,96 L100,52 L180,52 L180,96',
		label: 'retry',
		labelX: 140,
		labelY: 34
	});
});
