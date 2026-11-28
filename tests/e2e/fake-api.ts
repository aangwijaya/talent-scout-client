// A stand-in for the Go API, used by `auth.e2e.ts`. It answers the few endpoints the recruiter
// login and job list need, and records the headers of every `/api/v1` request so the test can
// see exactly what the BFF sent. Run with `node tests/e2e/fake-api.ts <port>`.
import { createServer, type IncomingHttpHeaders } from 'node:http';

const FAKE_ACCESS_TOKEN = 'e2e-fake-access-token';

const paragraph = (topic: string) =>
	`You will ${topic} with a small team. `.repeat(6) + 'We value **clear writing** and `svelte`.';

/** Ids are repeated in `smoke.e2e.ts`. */
const JD_JOBS: Record<string, { title: string; description: string }> = {
	'0d1c5c3a-2f5e-4c39-9d6b-1f6c2b9a7e01': {
		title: 'Long JD Engineer',
		description: [
			'# About the role',
			paragraph('build the screening product'),
			'## What you will do',
			'- Own the recruiter dashboard\n- Ship the applicant chat\n- Review pull requests',
			paragraph('work on the graph view'),
			'## What we look for',
			'1. Svelte 5\n2. TypeScript\n3. Accessibility',
			paragraph('pair with designers'),
			'## How to apply',
			'Send your CV through the form. Questions: [email us](mailto:jobs@example.com).'
		].join('\n\n')
	},
	'0d1c5c3a-2f5e-4c39-9d6b-1f6c2b9a7e02': {
		title: 'Short JD Engineer',
		description: 'Build the dashboard.\nOwn frontend quality.'
	}
};

const seen: { method: string; path: string; headers: IncomingHttpHeaders }[] = [];

// Job editor state for the job tests in `auth.e2e.ts`; `POST /__jobs` resets it.
type Criterion = { key: string; label: string; description: string; weight: number };
type FakeJob = {
	id: string;
	title: string;
	description: string;
	rubric: Criterion[];
	status: 'open' | 'closed';
	spoken_english_required: boolean;
	apply_url: string;
	application_count: number;
	created_at: string;
	updated_at: string;
};
/** Repeated in `auth.e2e.ts`. */
const SEED_JOB_ID = 'e2e00000-0000-4000-8000-000000000001';
const JOB_LIMIT = 20;
const SUGGESTION: Criterion[] = [
	{
		key: 'product_sense',
		label: 'Product sense',
		description: 'Ships small useful features',
		weight: 2
	},
	{
		key: 'frontend_craft',
		label: 'Frontend craft',
		description: 'Accessible, fast interfaces',
		weight: 3
	},
	{
		key: 'collaboration',
		label: 'Collaboration',
		description: 'Works well with design and backend',
		weight: 1
	}
];
const editor = {
	jobs: [] as FakeJob[],
	suggestLimited: false,
	suggestSpoken: false,
	lastCreate: null as unknown,
	lastPatch: null as unknown
};

function fakeJob(id: string, title: string, fields: Partial<FakeJob> = {}): FakeJob {
	const now = new Date().toISOString();
	return {
		id,
		title,
		description: `${title} builds the product with a small team. `.repeat(3),
		rubric: SUGGESTION,
		status: 'open',
		spoken_english_required: false,
		apply_url: `http://localhost/apply/${id}`,
		application_count: 0,
		created_at: now,
		updated_at: now,
		...fields
	};
}

function resetEditor({
	count = 1,
	applicants = 0,
	suggest_limited = false,
	suggest_spoken = false
} = {}): void {
	editor.jobs = Array.from({ length: count }, (_, i) =>
		i === 0
			? fakeJob(SEED_JOB_ID, 'Seeded Engineer', { application_count: applicants })
			: fakeJob(crypto.randomUUID(), `Filler job ${i}`)
	);
	editor.suggestLimited = suggest_limited;
	editor.suggestSpoken = suggest_spoken;
	editor.lastCreate = null;
	editor.lastPatch = null;
}

async function readJson(
	req: import('node:http').IncomingMessage
): Promise<Record<string, unknown>> {
	let text = '';
	for await (const chunk of req) text += chunk;
	return text ? JSON.parse(text) : {};
}

function json(
	res: import('node:http').ServerResponse,
	status: number,
	body: unknown,
	headers: Record<string, string> = {}
): void {
	res.writeHead(status, { 'content-type': 'application/json', ...headers });
	res.end(JSON.stringify(body));
}

// Answer authenticity (server#81) for `authenticity.e2e.ts`: one active session that records
// the `entry` of each answer, and two reviewed applications. Ids are repeated in that file.
const ENTRY_SESSION = 'e2e-entry-session-token';
const ASSESSED_APP = 'e2e00000-0000-4000-8000-0000000000a1';
const UNASSESSED_APP = 'e2e00000-0000-4000-8000-0000000000a2';
const TOPIC_ID = 'e2e00000-0000-4000-8000-0000000000b1';
const received: unknown[] = [];

const question = {
	id: 'e2e00000-0000-4000-8000-0000000000c1',
	role: 'assistant',
	kind: 'question',
	topic_id: TOPIC_ID,
	content: 'Tell me about a feature you shipped end to end.',
	created_at: '2026-11-05T14:00:00Z'
};

const INVITED_SESSION = 'e2e-entry-invited-token';

function entrySession(active: boolean) {
	const started = Date.now() - 60_000;
	return {
		status: active ? 'active' : 'invited',
		job_title: 'Seeded Engineer',
		applicant_name: 'Paste Tester',
		expires_at: new Date(started + 86_400_000).toISOString(),
		started_at: active ? new Date(started).toISOString() : null,
		deadline_at: active ? new Date(started + 15 * 60_000).toISOString() : null,
		max_minutes: 15,
		topic_count: active ? 2 : null,
		question_count: active ? 1 : 0,
		max_questions: 6,
		current_topic: active ? { position: 1, total: 2, title: 'Shipping' } : null,
		voice: null
	};
}

function reviewedApplication(id: string, assessed: boolean) {
	const answer = (n: number, content: string, entry: unknown) => ({
		id: `e2e00000-0000-4000-8000-0000000000d${n}`,
		role: 'applicant',
		kind: 'answer',
		topic_id: TOPIC_ID,
		content,
		created_at: `2026-11-05T14:0${n}:00Z`,
		entry,
		audio: null
	});
	return {
		application: {
			id,
			job_id: SEED_JOB_ID,
			name: assessed ? 'Pat Paster' : 'Una Assessed',
			email: 'applicant@example.com',
			status: 'review',
			session_status: 'completed',
			overall_score: 3.5,
			created_at: '2026-11-05T13:00:00Z'
		},
		job: { id: SEED_JOB_ID, title: 'Seeded Engineer', rubric: SUGGESTION },
		cv_text: '',
		decision: null,
		session: null,
		graph_run: null,
		topics: [
			{
				id: TOPIC_ID,
				position: 1,
				title: 'Shipping',
				goal: 'Ships end to end',
				rubric_keys: ['product_sense'],
				status: 'done',
				follow_up_count: 0
			}
		],
		messages: [
			{ ...question, entry: null, audio: null },
			answer(1, 'I rebuilt the checkout flow and measured the drop-off.', {
				pasted_chars: 412,
				typed_chars: 3,
				duration_ms: 2_400
			}),
			answer(2, 'I paired with design on every step.', {
				pasted_chars: 0,
				typed_chars: 186,
				duration_ms: 41_600
			}),
			answer(3, 'Sent before entry signals existed.', null)
		],
		scores: SUGGESTION.map(({ key }) => ({
			rubric_key: key,
			score: 3.5,
			rationale: 'Solid answer.',
			status: 'valid',
			attempts: 1,
			evidence: []
		})),
		authenticity: assessed
			? {
					level: 'likely',
					reasons: ['Answer 1 was pasted in full within three seconds.'],
					assessed_at: '2026-11-05T14:12:00Z'
				}
			: null
	};
}

// A recorded nine-node run whose replay ends with `authenticity` before the recruiter gate.
const NINE_NODE_RUN = 'e2e00000-0000-4000-8000-0000000000e1';
const NINE_NODES = [
	['planner', 'splitter'],
	['plan_check', 'code'],
	['interviewer', 'worker'],
	['judge', 'gate'],
	['guard', 'code'],
	['scorer', 'worker'],
	['evidence_check', 'code'],
	['authenticity', 'worker'],
	['recruiter_gate', 'human_gate']
] as const;
const NINE_EDGES = [
	['planner', 'plan_check'],
	['plan_check', 'interviewer'],
	['interviewer', 'judge'],
	['judge', 'guard'],
	['guard', 'scorer'],
	['scorer', 'evidence_check'],
	['evidence_check', 'authenticity'],
	['authenticity', 'recruiter_gate']
].map(([from, to]) => ({ from, to }));

function nineNodeRun() {
	return {
		id: NINE_NODE_RUN,
		session_id: 'e2e00000-0000-4000-8000-0000000000e2',
		// Only the replay can turn `authenticity` green.
		status: 'running',
		nodes: NINE_NODES.map(([id, type]) => ({
			id,
			type,
			status: id === 'authenticity' || id === 'recruiter_gate' ? 'pending' : 'succeeded',
			attempts: 1,
			model: null
		})),
		edges: NINE_EDGES,
		last_seq: 4,
		total_tokens_in: 900,
		total_tokens_out: 120,
		cost_usd: 0.0004
	};
}

function nineNodeEvents() {
	const envelope = (seq: number, event: string, node_id: string | null, data: object) => ({
		event,
		run_id: NINE_NODE_RUN,
		seq,
		ts: `2026-11-05T14:12:0${seq}Z`,
		node_id,
		attempt: node_id ? 1 : null,
		data
	});
	return [
		envelope(1, 'run.started', null, {
			session_id: 'e2e00000-0000-4000-8000-0000000000e2',
			nodes: NINE_NODES.map(([id, type]) => ({ id, type })),
			edges: NINE_EDGES
		}),
		envelope(2, 'node.started', 'authenticity', {
			model: 'claude-haiku-5-5',
			input_summary: '3 answers with entry signals'
		}),
		envelope(3, 'node.completed', 'authenticity', {
			output_summary: 'level likely',
			tokens_in: 900,
			tokens_out: 120,
			duration_ms: 1_400,
			cost_usd: 0.0004
		}),
		envelope(4, 'run.completed', null, {
			status: 'succeeded',
			finish_reason: 'completed',
			total_tokens_in: 900,
			total_tokens_out: 120,
			cost_usd: 0.0004,
			needs_manual_count: 0
		})
	];
}

type Handler = (
	req: import('node:http').IncomingMessage,
	res: import('node:http').ServerResponse
) => unknown;

function authenticityRoute(method: string, path: string): Handler | null {
	const session = `/api/v1/sessions/${ENTRY_SESSION}`;
	if (path === '/__entries') return (_, res) => json(res, 200, { received });
	if (method === 'GET' && path === session) return (_, res) => json(res, 200, entrySession(true));
	if (method === 'GET' && path === `${session}/messages`) {
		return (_, res) => json(res, 200, { items: [question] });
	}
	const invited = `/api/v1/sessions/${INVITED_SESSION}`;
	if (method === 'GET' && path === invited) return (_, res) => json(res, 200, entrySession(false));
	if (method === 'GET' && path === `${invited}/messages`) {
		return (_, res) => json(res, 200, { items: [] });
	}
	if (method === 'POST' && path === `${session}/messages`) {
		return async (req, res) => {
			const body = await readJson(req);
			received.push(body.entry ?? null);
			const message = {
				id: crypto.randomUUID(),
				role: 'applicant',
				kind: 'answer',
				topic_id: TOPIC_ID,
				content: body.content,
				created_at: new Date().toISOString()
			};
			return json(res, 202, { message, awaiting: 'assistant' });
		};
	}
	// A spoken answer (FR-16): any recording "transcribes" to the same fake text.
	if (method === 'POST' && path === `${session}/audio`) {
		return (req, res) => {
			req.resume();
			req.on('end', () =>
				json(res, 200, {
					audio_id: crypto.randomUUID(),
					transcript: 'A fake transcript of the recorded answer.',
					language: 'en',
					duration_ms: 3000,
					stored: true
				})
			);
		};
	}
	// The browser opens this stream itself (cross-origin); it stays open and quiet.
	if (method === 'GET' && (path === `${session}/events` || path === `${invited}/events`)) {
		return (_, res) => {
			res.writeHead(200, {
				'content-type': 'text/event-stream',
				'cache-control': 'no-cache',
				'access-control-allow-origin': '*'
			});
			res.write(': connected\n\n');
		};
	}
	if (method === 'GET' && path === `/api/v1/graph-runs/${NINE_NODE_RUN}`) {
		return (_, res) => json(res, 200, nineNodeRun());
	}
	if (method === 'POST' && path === '/api/v1/auth/sse-token') {
		const expires_at = new Date(Date.now() + 60_000).toISOString();
		return (_, res) => json(res, 200, { sse_token: 'e2e-sse-token', expires_at });
	}
	if (method === 'GET' && path === `/api/v1/graph-runs/${NINE_NODE_RUN}/events`) {
		return (_, res) => {
			res.writeHead(200, {
				'content-type': 'text/event-stream',
				'cache-control': 'no-cache',
				'access-control-allow-origin': '*'
			});
			for (const event of nineNodeEvents()) {
				const { event: name, ...envelope } = event;
				res.write(`event: ${name}\nid: ${event.seq}\ndata: ${JSON.stringify(envelope)}\n\n`);
			}
			res.end();
		};
	}
	const app = path.match(/^\/api\/v1\/applications\/([^/]+)$/)?.[1];
	if (method === 'GET' && (app === ASSESSED_APP || app === UNASSESSED_APP)) {
		return (_, res) => json(res, 200, reviewedApplication(app, app === ASSESSED_APP));
	}
	return null;
}

createServer(async (req, res) => {
	const path = new URL(req.url ?? '/', 'http://localhost').pathname;
	if (path === '/__seen') return json(res, 200, { token: FAKE_ACCESS_TOKEN, requests: seen });
	if (path === '/__reset') {
		seen.length = 0;
		received.length = 0;
		return json(res, 200, {});
	}
	if (path === '/__jobs') {
		if (req.method === 'POST') resetEditor(await readJson(req));
		return json(res, 200, editor);
	}

	// Public job pages for `smoke.e2e.ts`; kept out of `seen` because those tests run in parallel.
	const jd = path.match(/^\/api\/v1\/jobs\/([^/]+)\/(public|applications)$/);
	if (jd && jd[1] in JD_JOBS) {
		if (req.method === 'POST') {
			return json(res, 409, { error: { code: 'already_applied', message: 'Already applied' } });
		}
		return json(res, 200, { id: jd[1], ...JD_JOBS[jd[1]], status: 'open' });
	}

	const authenticity = authenticityRoute(req.method ?? 'GET', path);
	if (authenticity) return authenticity(req, res);

	seen.push({ method: req.method ?? 'GET', path, headers: req.headers });
	if (req.method === 'POST' && path === '/api/v1/auth/login') {
		const expires_at = new Date(Date.now() + 12 * 3_600_000).toISOString();
		return json(res, 200, { access_token: FAKE_ACCESS_TOKEN, expires_at });
	}
	if (req.method === 'GET' && path === '/api/v1/jobs') {
		return json(res, 200, { items: editor.jobs, next_cursor: null });
	}
	if (req.method === 'POST' && path === '/api/v1/jobs') {
		if (editor.jobs.length >= JOB_LIMIT) {
			return json(res, 409, { error: { code: 'invalid_state', message: 'Job limit reached' } });
		}
		const body = await readJson(req);
		editor.lastCreate = body;
		const job = fakeJob(crypto.randomUUID(), String(body.title), body as Partial<FakeJob>);
		editor.jobs.unshift(job);
		return json(res, 201, job);
	}
	if (req.method === 'POST' && path === '/api/v1/jobs/rubric-suggestion') {
		if (editor.suggestLimited) {
			const error = { code: 'rate_limited', message: 'Suggestion limit reached' };
			return json(res, 429, { error }, { 'retry-after': '125' });
		}
		// The reason carries markup so the editor test sees it rendered as text.
		return json(res, 200, {
			rubric: SUGGESTION,
			spoken_english_required: editor.suggestSpoken,
			spoken_english_reason: editor.suggestSpoken
				? '<b>Daily calls</b> with customers in English.'
				: 'The role is written work.'
		});
	}
	const jobPath = path.match(/^\/api\/v1\/jobs\/([^/]+)(\/public|\/applications)?$/);
	const job = editor.jobs.find(({ id }) => id === jobPath?.[1]);
	if (jobPath && job) {
		if (jobPath[2] === '/applications') return json(res, 200, { items: [], next_cursor: null });
		if (jobPath[2] === '/public') {
			const { id, title, description, status, spoken_english_required } = job;
			return json(res, 200, { id, title, description, status, spoken_english_required });
		}
		if (req.method === 'PATCH') {
			const patch = await readJson(req);
			editor.lastPatch = patch;
			if ('rubric' in patch && job.application_count > 0) {
				return json(res, 409, { error: { code: 'invalid_state', message: 'Rubric is locked' } });
			}
			Object.assign(job, patch, { updated_at: new Date().toISOString() });
		}
		return json(res, 200, job);
	}
	json(res, 404, { error: { code: 'not_found', message: 'Not found' } });
}).listen(Number(process.argv[2] ?? 4180));
