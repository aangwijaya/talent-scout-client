import { describe, expect, it } from 'vitest';
import { EDGE_GEOMETRY } from './graph-layout';

// The label chip is `text-caption` (12px) with px-2 and a 1px border: 18px line + 2px border tall.
const CHIP_HEIGHT = 20;
const chipWidth = (label: string) => label.length * 7 + 18;

type Point = [number, number];
const points = (path: string): Point[] =>
	[...path.matchAll(/(\d+),(\d+)/g)].map(([, x, y]) => [Number(x), Number(y)]);

describe('edge labels', () => {
	for (const [id, { path, label, labelX, labelY }] of Object.entries(EDGE_GEOMETRY)) {
		it(`${id}: the "${label}" chip sits beside its line, never on it`, () => {
			const box = {
				left: labelX - chipWidth(label) / 2,
				right: labelX + chipWidth(label) / 2,
				top: labelY - CHIP_HEIGHT / 2,
				bottom: labelY + CHIP_HEIGHT / 2
			};
			const corners = points(path);
			expect(corners.length).toBeGreaterThan(1);
			for (let i = 1; i < corners.length; i++) {
				const [[x1, y1], [x2, y2]] = [corners[i - 1], corners[i]];
				const crossesX = Math.max(x1, x2) >= box.left && Math.min(x1, x2) <= box.right;
				const crossesY = Math.max(y1, y2) >= box.top && Math.min(y1, y2) <= box.bottom;
				expect(crossesX && crossesY, `segment ${x1},${y1} → ${x2},${y2}`).toBe(false);
			}
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
