// Reads interviewer questions aloud with the browser's `speechSynthesis`, in English only.
// Without it, or without an English voice, the reader is unavailable and the text is enough.

export type SynthLike = {
	getVoices(): SpeechSynthesisVoice[];
	speak(utterance: SpeechSynthesisUtterance): void;
	cancel(): void;
	addEventListener(type: 'voiceschanged', listener: () => void): void;
};
type UtteranceLike = {
	lang: string;
	voice: SpeechSynthesisVoice | null;
	onend: ((event: SpeechSynthesisEvent) => void) | null;
	onerror: ((event: SpeechSynthesisErrorEvent) => void) | null;
};
export type UtteranceCtor = new (text: string) => UtteranceLike;

export function englishVoice(
	voices: readonly SpeechSynthesisVoice[]
): SpeechSynthesisVoice | undefined {
	return voices.find((v) => /^en([-_]|$)/i.test(v.lang));
}

/**
 * `onChange(true)` while a question is being read. `onVoices` fires when the voice list arrives
 * late (Chrome loads it asynchronously), so the caller can show the pill then.
 */
export function createReader(
	synth: SynthLike | undefined,
	Utterance: UtteranceCtor | undefined,
	onChange: (reading: boolean) => void,
	onVoices?: () => void
) {
	let voice = synth ? englishVoice(synth.getVoices()) : undefined;
	let current: UtteranceLike | null = null;
	if (synth && !voice) {
		synth.addEventListener('voiceschanged', () => {
			voice ??= englishVoice(synth.getVoices());
			if (voice) onVoices?.();
		});
	}

	function finish(utterance: UtteranceLike) {
		if (current !== utterance) return;
		current = null;
		onChange(false);
	}

	return {
		get available() {
			return Boolean(synth && Utterance && voice);
		},
		speak(text: string) {
			if (!synth || !Utterance || !voice) return;
			synth.cancel();
			const utterance = new Utterance(text);
			utterance.voice = voice;
			utterance.lang = voice.lang;
			utterance.onend = () => finish(utterance);
			utterance.onerror = () => finish(utterance);
			current = utterance;
			synth.speak(utterance as unknown as SpeechSynthesisUtterance);
			onChange(true);
		},
		stop() {
			if (!synth) return;
			current = null;
			synth.cancel();
			onChange(false);
		}
	};
}

export type Reader = ReturnType<typeof createReader>;
