import { describe, expect, it } from 'vitest';
import { ENTRY_MAX, createEntryCounter } from './entry-counter';

function clock(start = 1_000) {
	let t = start;
	return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('createEntryCounter', () => {
	it('reports nothing before the first input', () => {
		expect(createEntryCounter().snapshot()).toBeNull();
	});

	it('separates pasted and dropped characters from typed ones', () => {
		const counter = createEntryCounter();
		counter.record('insertText', 1);
		counter.record('insertText', 1);
		counter.record('insertFromPaste', 40);
		counter.record('insertFromDrop', 5);
		counter.record('insertLineBreak', 1);
		expect(counter.snapshot()).toMatchObject({ pasted_chars: 45, typed_chars: 3 });
	});

	it('ignores deletions in the counts but starts the clock', () => {
		const time = clock();
		const counter = createEntryCounter(time.now);
		counter.record('deleteContentBackward', 0);
		time.advance(500);
		counter.record('insertText', 1);
		time.advance(1_500);
		expect(counter.snapshot()).toEqual({ pasted_chars: 0, typed_chars: 1, duration_ms: 2_000 });
	});

	it('measures from the first input to the snapshot', () => {
		const time = clock();
		const counter = createEntryCounter(time.now);
		time.advance(10_000);
		counter.record('insertText', 1);
		time.advance(4_200);
		expect(counter.snapshot()?.duration_ms).toBe(4_200);
	});

	it('starts over after reset', () => {
		const time = clock();
		const counter = createEntryCounter(time.now);
		counter.record('insertFromPaste', 30);
		time.advance(3_000);
		counter.reset();
		expect(counter.snapshot()).toBeNull();
		counter.record('insertText', 2);
		time.advance(100);
		expect(counter.snapshot()).toEqual({ pasted_chars: 0, typed_chars: 2, duration_ms: 100 });
	});

	it('clamps every field to the contract range', () => {
		const time = clock();
		const counter = createEntryCounter(time.now);
		counter.record('insertFromPaste', ENTRY_MAX + 5);
		counter.record('insertText', ENTRY_MAX * 2);
		time.advance(ENTRY_MAX * 3);
		expect(counter.snapshot()).toEqual({
			pasted_chars: ENTRY_MAX,
			typed_chars: ENTRY_MAX,
			duration_ms: ENTRY_MAX
		});
	});

	it('never reports a negative duration when the clock goes back', () => {
		const time = clock();
		const counter = createEntryCounter(time.now);
		counter.record('insertText', 1);
		time.advance(-5_000);
		expect(counter.snapshot()?.duration_ms).toBe(0);
	});
});
