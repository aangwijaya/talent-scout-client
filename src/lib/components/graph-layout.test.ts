import { describe, expect, it } from 'vitest';
import { NODE_IDS } from '$lib/stores/graph';
import {
	CANVAS_HEIGHT,
	CANVAS_WIDTH,
	EDGE_GEOMETRY,
	NODE_HEIGHT,
	NODE_NAMES,
	NODE_POSITIONS,
	NODE_WIDTH,
	type EdgeGeometry
} from './graph-layout';

// The label chip is `text-caption` (12px) with px-2 and a 1px border: 18px line + 2px border tall.
const CHIP_HEIGHT = 20;
const chipWidth = (label: string) => label.length * 7 + 18;

type Point = [number, number];
const points = (path: string): Point[] =>
	[...path.matchAll(/(\d+),(\d+)/g)].map(([, x, y]) => [Number(x), Number(y)]);

function chipCrossings(path: string, { label, labelX, labelY }: EdgeGeometry): string[] {
	const box = {
		left: labelX - chipWidth(label) / 2,
		right: labelX + chipWidth(label) / 2,
		top: labelY - CHIP_HEIGHT / 2,
		bottom: labelY + CHIP_HEIGHT / 2
	};
	const corners = points(path);
	expect(corners.length).toBeGreaterThan(1);
	return corners.slice(1).flatMap(([x2, y2], i) => {
		const [x1, y1] = corners[i];
		const crossesX = Math.max(x1, x2) >= box.left && Math.min(x1, x2) <= box.right;
		const crossesY = Math.max(y1, y2) >= box.top && Math.min(y1, y2) <= box.bottom;
		return crossesX && crossesY ? [`${x1},${y1} → ${x2},${y2}`] : [];
	});
}

describe('edge labels', () => {
	it('no chip, "planned" included, overlaps the planner self-loop', () => {
		const loop = EDGE_GEOMETRY['planner>planner'];
		expect(loop).toBeDefined();
		for (const [id, geometry] of Object.entries(EDGE_GEOMETRY)) {
			expect(chipCrossings(loop.path, geometry), id).toEqual([]);
		}
	});

	for (const [id, geometry] of Object.entries(EDGE_GEOMETRY)) {
		const { path, label, labelX, labelY } = geometry;
		it(`${id}: the "${label}" chip sits beside its line, never on it`, () => {
			expect(chipCrossings(path, geometry)).toEqual([]);
		});

		it(`${id}: the "${label}" chip stays close to its line`, () => {
			const gaps = points(path).flatMap(([x, y], i, all) => {
				if (i === 0) return [];
				const [px, py] = all[i - 1];
				if (py === y && labelX >= Math.min(px, x) && labelX <= Math.max(px, x))
					return [Math.abs(labelY - y)];
				if (px === x && labelY >= Math.min(py, y) && labelY <= Math.max(py, y))
					return [Math.abs(labelX - x) - chipWidth(label) / 2];
				return [];
			});
			expect(Math.min(...gaps)).toBeLessThanOrEqual(20);
		});
	}
});

// server#81 added the advisory authenticity node, and server#99 the voice-only fluency node, between
// evidence_check and recruiter_gate.
describe('node layout', () => {
	it('places all ten nodes, including authenticity and fluency, inside the canvas', () => {
		expect(NODE_IDS).toContain('authenticity');
		expect(NODE_IDS).toContain('fluency');
		expect(NODE_IDS).toHaveLength(10);
		for (const id of NODE_IDS) {
			const pos = NODE_POSITIONS[id];
			expect(pos, id).toBeDefined();
			expect(NODE_NAMES[id], id).toBeTruthy();
			expect(pos.x + NODE_WIDTH, id).toBeLessThanOrEqual(CANVAS_WIDTH);
			expect(pos.y + NODE_HEIGHT, id).toBeLessThanOrEqual(CANVAS_HEIGHT);
		}
	});

	it('never stacks two nodes on each other', () => {
		const ids = [...NODE_IDS];
		for (const [i, a] of ids.entries()) {
			for (const b of ids.slice(i + 1)) {
				const pa = NODE_POSITIONS[a];
				const pb = NODE_POSITIONS[b];
				const apart =
					pa.x + NODE_WIDTH <= pb.x ||
					pb.x + NODE_WIDTH <= pa.x ||
					pa.y + NODE_HEIGHT <= pb.y ||
					pb.y + NODE_HEIGHT <= pa.y;
				expect(apart, `${a} overlaps ${b}`).toBe(true);
			}
		}
	});

	it('routes evidence_check → authenticity → fluency → recruiter_gate', () => {
		expect(EDGE_GEOMETRY['evidence_check>authenticity']).toBeDefined();
		expect(EDGE_GEOMETRY['authenticity>fluency']).toBeDefined();
		expect(EDGE_GEOMETRY['fluency>recruiter_gate']).toBeDefined();
	});

	// Replays of older runs: before server#81 (no authenticity) and before server#99 (no fluency).
	for (const key of ['evidence_check>recruiter_gate', 'authenticity>recruiter_gate']) {
		it(`keeps the older ${key} edge clear of every node and ends it on recruiter_gate`, () => {
			const legacy = EDGE_GEOMETRY[key];
			expect(legacy).toBeDefined();
			const pts = points(legacy.path);
			// Every segment, sampled every 4px, stays out of every node's box.
			for (const [[ax, ay], [bx, by]] of pts.slice(1).map((p, i) => [pts[i], p])) {
				const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) / 4;
				for (let k = 1; k < steps; k++) {
					const px = ax + ((bx - ax) * k) / steps;
					const py = ay + ((by - ay) * k) / steps;
					for (const id of NODE_IDS) {
						const { x, y } = NODE_POSITIONS[id];
						const inside = px > x && px < x + NODE_WIDTH && py > y && py < y + NODE_HEIGHT;
						expect(inside, `${key} at ${px},${py} crosses ${id}`).toBe(false);
					}
				}
			}
			const [ex, ey] = pts[pts.length - 1];
			const gate = NODE_POSITIONS.recruiter_gate;
			expect(ey).toBe(gate.y);
			expect(ex).toBeGreaterThan(gate.x);
			expect(ex).toBeLessThan(gate.x + NODE_WIDTH);
		});
	}
});
