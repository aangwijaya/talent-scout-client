import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import GraphEdge from './GraphEdge.svelte';
import { EDGE_GEOMETRY, NODE_POSITIONS, NODE_WIDTH } from './graph-layout';

const selfLoop = EDGE_GEOMETRY['interviewer>interviewer'];

function edge(taken: boolean, latest: boolean): string {
	const data = { geometry: selfLoop, taken, latest, retryPath: true };
	return render(GraphEdge, { props: { id: 'interviewer>interviewer', data } }).body;
}

describe('interviewer self-loop edge', () => {
	it('leaves and re-enters through the top of the node, never across it', () => {
		const { x, y } = NODE_POSITIONS.interviewer;
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
