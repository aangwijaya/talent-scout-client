import { describe, expect, it } from 'vitest';
import type { Message, Score, SessionSummary, Topic } from '$lib/server/api/types';
import {
	attemptsText,
	canDecide,
	canGetInvite,
	evidenceByMessage,
	firstName,
	formatCost,
	groupByTopic,
	highlight,
	manualReviewNote,
	relativeTime,
	sessionMeta,
	speakerLabel
} from './review';

function message(id: string, parts: Partial<Message> = {}): Message {
	return {
		id,
		role: 'applicant',
		kind: 'answer',
		topic_id: 't1',
		content: '',
		created_at: '2026-11-04T06:30:00Z',
		...parts
	};
}

function score(parts: Partial<Score> = {}): Score {
	return {
		rubric_key: 'k',
		score: 4,
		rationale: '',
		status: 'valid',
		attempts: 1,
		evidence: [],
		...parts
	};
}

describe('highlight', () => {
	it('returns the whole text when nothing is quoted', () => {
		expect(highlight('plain answer', [])).toEqual([{ text: 'plain answer', quoted: false }]);
	});

	it('marks every quote that occurs, and merges overlaps', () => {
		expect(highlight('a quick brown fox', ['quick brown', 'brown fox', 'missing'])).toEqual([
			{ text: 'a ', quoted: false },
			{ text: 'quick brown fox', quoted: true }
		]);
		expect(highlight('one two one', ['one'])).toEqual([
			{ text: 'one', quoted: true },
			{ text: ' two ', quoted: false },
			{ text: 'one', quoted: true }
		]);
	});

	it('ignores empty quotes', () => {
		expect(highlight('abc', [''])).toEqual([{ text: 'abc', quoted: false }]);
	});
});

describe('evidenceByMessage', () => {
	it('collects quotes per message id across all scores', () => {
		const map = evidenceByMessage([
			score({ evidence: [{ message_id: 'm1', quote: 'a' }] }),
			score({
				evidence: [
					{ message_id: 'm1', quote: 'b' },
					{ message_id: 'm2', quote: 'c' }
				]
			})
		]);
		expect(map.get('m1')).toEqual(['a', 'b']);
		expect(map.get('m2')).toEqual(['c']);
	});
});

describe('attemptsText', () => {
	it('names the attempt that produced the score', () => {
		expect(attemptsText(score({ attempts: 1 }))).toBe('scored on the first attempt');
		expect(attemptsText(score({ attempts: 2 }))).toBe('scored on attempt 2 of 3');
		expect(attemptsText(score({ status: 'needs_manual', score: null, attempts: 3 }))).toBe(
			'gave up after 3 attempts'
		);
	});
});

describe('speakerLabel', () => {
	it('labels AI messages by kind and applicant messages by first name', () => {
		const ai = (kind: Message['kind']) =>
			speakerLabel(message('m', { role: 'assistant', kind }), 'Rani Putri');
		expect(ai('opening')).toBe('AI interviewer · Opening');
		expect(ai('question')).toBe('AI interviewer · Question');
		expect(ai('follow_up')).toBe('AI interviewer · Follow-up');
		expect(ai('closing')).toBe('AI interviewer · Closing');
		expect(speakerLabel(message('m'), 'Rani Putri')).toBe('Rani');
	});
});

describe('groupByTopic', () => {
	const topics: Topic[] = [
		{
			id: 't1',
			position: 1,
			title: 'State',
			goal: '',
			rubric_keys: [],
			status: 'done',
			follow_up_count: 0
		},
		{
			id: 't2',
			position: 2,
			title: 'Design',
			goal: '',
			rubric_keys: [],
			status: 'done',
			follow_up_count: 0
		}
	];

	it('starts a group whenever the topic changes, keeping message order', () => {
		const groups = groupByTopic(
			[message('a'), message('b'), message('c', { topic_id: 't2' }), message('d', { topic_id: null })],
			topics
		);
		expect(groups.map((g) => [g.topic?.position ?? null, g.messages.map((m) => m.id)])).toEqual([
			[1, ['a', 'b']],
			[2, ['c']],
			[null, ['d']]
		]);
	});
});

describe('sessionMeta', () => {
	const base: SessionSummary = {
		id: 's',
		status: 'completed',
		expires_at: '2026-11-11T06:00:00Z',
		started_at: '2026-11-04T06:30:00Z',
		ended_at: '2026-11-04T06:45:00Z',
		finish_reason: 'completed',
		question_count: 2
	};

	it('joins status, questions and minutes, leaving out what is null', () => {
		expect(sessionMeta(base)).toBe('Session completed · 2 questions · 15 min');
		expect(sessionMeta({ ...base, question_count: 1, ended_at: null })).toBe(
			'Session completed · 1 question'
		);
		expect(sessionMeta(null)).toBeNull();
	});
});

describe('small formatters', () => {
	it('formats cost with four decimals', () => {
		expect(formatCost(0.0041)).toBe('$0.0041');
	});

	it('words the manual-review note by count', () => {
		expect(manualReviewNote(0)).toBeNull();
		expect(manualReviewNote(1)).toBe('1 criterion needs manual review and is left out');
		expect(manualReviewNote(2)).toBe('2 criteria need manual review and are left out');
	});

	it('gives relative times', () => {
		const now = Date.parse('2026-11-11T06:00:00Z');
		expect(relativeTime('2026-11-11T05:59:30Z', now)).toBe('just now');
		expect(relativeTime('2026-11-11T05:55:00Z', now)).toBe('5 minutes ago');
		expect(relativeTime('2026-11-11T03:00:00Z', now)).toBe('3 hours ago');
		expect(relativeTime('2026-11-10T06:00:00Z', now)).toBe('yesterday');
	});

	it('takes the first name', () => {
		expect(firstName('Rani Putri')).toBe('Rani');
		expect(firstName('  Madonna ')).toBe('Madonna');
	});
});

describe('action rules', () => {
	it('allows a decision only once scores exist', () => {
		expect(canDecide('review')).toBe(true);
		expect(canDecide('shortlisted')).toBe(true);
		expect(canDecide('rejected')).toBe(true);
		expect(canDecide('scoring')).toBe(false);
		expect(canDecide('invited')).toBe(false);
	});

	it('offers a new invite for invited sessions and failed applications', () => {
		expect(canGetInvite('invited', 'invited')).toBe(true);
		expect(canGetInvite('failed', 'completed')).toBe(true);
		expect(canGetInvite('review', 'completed')).toBe(false);
		expect(canGetInvite('applied', null)).toBe(false);
	});
});
