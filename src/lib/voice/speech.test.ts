import { describe, expect, it, vi } from 'vitest';
import { createReader, englishVoice, type SynthLike } from './speech';

const voice = (lang: string) => ({ lang, name: lang }) as SpeechSynthesisVoice;

function fakeSynth(voices: SpeechSynthesisVoice[]) {
	const spoken: { text: string; lang: string; onend: (() => void) | null }[] = [];
	const synth: SynthLike & { spoken: typeof spoken } = {
		spoken,
		getVoices: () => voices,
		speak: (u) => spoken.push(u as unknown as (typeof spoken)[number]),
		cancel: vi.fn(),
		addEventListener: vi.fn()
	};
	return synth;
}

class Utterance {
	lang = '';
	voice: SpeechSynthesisVoice | null = null;
	onend: (() => void) | null = null;
	onerror: (() => void) | null = null;
	constructor(readonly text: string) {}
}

describe('englishVoice', () => {
	it('picks an English voice and nothing else', () => {
		expect(englishVoice([voice('id-ID'), voice('en-GB')])?.lang).toBe('en-GB');
		expect(englishVoice([voice('en_US')])?.lang).toBe('en_US');
		expect(englishVoice([voice('id-ID'), voice('eng')])).toBeUndefined();
	});
});

describe('createReader', () => {
	it('is unavailable without speechSynthesis or an English voice', () => {
		expect(createReader(undefined, Utterance, () => {}).available).toBe(false);
		expect(createReader(fakeSynth([voice('id-ID')]), Utterance, () => {}).available).toBe(false);
	});

	it('reads in English, reports reading until the end, and stops on request', () => {
		const synth = fakeSynth([voice('en-US')]);
		const onChange = vi.fn();
		const reader = createReader(synth, Utterance, onChange);
		expect(reader.available).toBe(true);
		reader.speak('Tell me about a project.');
		expect(synth.spoken[0]).toMatchObject({ text: 'Tell me about a project.', lang: 'en-US' });
		expect(onChange).toHaveBeenLastCalledWith(true);
		synth.spoken[0].onend?.();
		expect(onChange).toHaveBeenLastCalledWith(false);
		reader.speak('Again');
		reader.stop();
		expect(synth.cancel).toHaveBeenCalled();
		expect(onChange).toHaveBeenLastCalledWith(false);
	});

	it('does nothing when unavailable', () => {
		const onChange = vi.fn();
		const reader = createReader(fakeSynth([]), Utterance, onChange);
		reader.speak('x');
		expect(onChange).not.toHaveBeenCalled();
	});
});
