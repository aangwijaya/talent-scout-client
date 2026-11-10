import type {
	ApplicationStatus,
	Message,
	Score,
	SessionStatus,
	SessionSummary,
	Topic
} from '$lib/server/api/types';

const MAX_ATTEMPTS = 3;
const MINUTE_MS = 60_000;

export type Segment = { text: string; quoted: boolean };

/** Splits `content` into plain and quoted runs; every occurrence of every quote is marked. */
export function highlight(content: string, quotes: readonly string[]): Segment[] {
	const ranges: [number, number][] = [];
	for (const quote of quotes) {
		if (!quote) continue;
		for (let at = content.indexOf(quote); at !== -1; at = content.indexOf(quote, at + 1)) {
			ranges.push([at, at + quote.length]);
		}
	}
	ranges.sort((a, b) => a[0] - b[0]);

	const segments: Segment[] = [];
	let cursor = 0;
	for (const [start, end] of ranges) {
		if (end <= cursor) continue;
		if (start > cursor) segments.push({ text: content.slice(cursor, start), quoted: false });
		const from = Math.max(start, cursor);
		const last = segments.at(-1);
		if (last?.quoted && from === cursor) last.text += content.slice(from, end);
		else segments.push({ text: content.slice(from, end), quoted: true });
		cursor = end;
	}
	if (cursor < content.length) segments.push({ text: content.slice(cursor), quoted: false });
	return segments;
}

export function evidenceByMessage(scores: readonly Score[]): Map<string, string[]> {
	const map = new Map<string, string[]>();
	for (const { evidence } of scores) {
		for (const { message_id, quote } of evidence) {
			map.set(message_id, [...(map.get(message_id) ?? []), quote]);
		}
	}
	return map;
}

export function attemptsText({ status, attempts }: Score): string {
	if (status === 'needs_manual') return `gave up after ${attempts} attempts`;
	return attempts <= 1
		? 'scored on the first attempt'
		: `scored on attempt ${attempts} of ${MAX_ATTEMPTS}`;
}

const kindLabels: Record<Message['kind'], string> = {
	opening: 'Opening',
	question: 'Question',
	follow_up: 'Follow-up',
	answer: 'Answer',
	closing: 'Closing'
};

export function firstName(name: string): string {
	return name.trim().split(/\s+/)[0];
}

export function speakerLabel(message: Message, applicantName: string): string {
	if (message.role === 'applicant') return firstName(applicantName);
	if (message.role === 'system') return 'System';
	return `AI interviewer · ${kindLabels[message.kind]}`;
}

export type TopicGroup = { topic: Topic | null; messages: Message[] };

/** Groups consecutive messages by topic, in transcript order. */
export function groupByTopic(messages: readonly Message[], topics: readonly Topic[]): TopicGroup[] {
	const byId = new Map(topics.map((topic) => [topic.id, topic]));
	const groups: (TopicGroup & { id: string | null })[] = [];
	for (const message of messages) {
		const last = groups.at(-1);
		if (last && last.id === message.topic_id) last.messages.push(message);
		else
			groups.push({
				id: message.topic_id,
				topic: (message.topic_id && byId.get(message.topic_id)) || null,
				messages: [message]
			});
	}
	return groups.map(({ topic, messages }) => ({ topic, messages }));
}

function plural(count: number, one: string, many: string): string {
	return `${count} ${count === 1 ? one : many}`;
}

/** "Session completed · 2 questions · 15 min", leaving out what is unknown. */
export function sessionMeta(session: SessionSummary | null): string | null {
	if (!session) return null;
	const parts = [
		`Session ${session.finish_reason === 'failed' ? 'failed' : session.status}`,
		plural(session.question_count, 'question', 'questions')
	];
	if (session.started_at && session.ended_at) {
		const ms = Date.parse(session.ended_at) - Date.parse(session.started_at);
		parts.push(`${Math.max(0, Math.round(ms / MINUTE_MS))} min`);
	}
	return parts.join(' · ');
}

export function formatCost(usd: number): string {
	return `$${usd.toFixed(4)}`;
}

export function manualReviewNote(count: number): string | null {
	if (count === 0) return null;
	return count === 1
		? '1 criterion needs manual review and is left out'
		: `${count} criteria need manual review and are left out`;
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** Past times only: a time after `now` (the page clock is older than the event) is "just now". */
export function relativeTime(iso: string, now: number): string {
	const minutes = Math.round((Date.parse(iso) - now) / MINUTE_MS);
	if (minutes > -1) return 'just now';
	if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute');
	const hours = Math.round(minutes / 60);
	if (Math.abs(hours) < 24) return relative.format(hours, 'hour');
	return relative.format(Math.round(hours / 24), 'day');
}

export function minutesSince(iso: string, now: number): number {
	return Math.max(0, Math.round((now - Date.parse(iso)) / MINUTE_MS));
}

export function canDecide(status: ApplicationStatus): boolean {
	return status === 'review' || status === 'shortlisted' || status === 'rejected';
}

export function canGetInvite(status: ApplicationStatus, session: SessionStatus | null): boolean {
	return status === 'failed' || session === 'invited';
}
