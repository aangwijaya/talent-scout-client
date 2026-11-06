// Hand-written from docs/API.md until openapi-typescript replaces the shapes in #10.

export type JobStatus = 'open' | 'closed';
export type ApplicationStatus =
	| 'applied'
	| 'invited'
	| 'in_session'
	| 'scoring'
	| 'review'
	| 'shortlisted'
	| 'rejected'
	| 'failed';
export type SessionStatus = 'invited' | 'active' | 'completed' | 'expired' | 'revoked';
export type FinishReason = 'completed' | 'time_limit' | 'question_limit' | 'abandoned' | 'failed';
export type ScoreStatus = 'valid' | 'needs_manual';
export type TopicStatus = 'pending' | 'active' | 'done';
export type RunStatus = 'running' | 'succeeded' | 'failed';
export type NodeId =
	| 'planner'
	| 'plan_check'
	| 'interviewer'
	| 'judge'
	| 'guard'
	| 'scorer'
	| 'evidence_check'
	| 'recruiter_gate';
export type NodeType = 'splitter' | 'worker' | 'gate' | 'code' | 'human_gate';
export type NodeStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
export type DecisionValue = 'shortlist' | 'reject';

export interface List<T> {
	items: T[];
	next_cursor: string | null;
}

export interface RubricCriterion {
	key: string;
	label: string;
	description: string;
	weight: number;
}

export interface Job {
	id: string;
	title: string;
	description: string;
	rubric: RubricCriterion[];
	status: JobStatus;
	apply_url: string;
	application_count: number;
	created_at: string;
	updated_at: string;
}

export type PublicJob = Pick<Job, 'id' | 'title' | 'description' | 'status'>;

export interface ApplicationSummary {
	id: string;
	job_id: string;
	name: string;
	email: string;
	status: ApplicationStatus;
	session_status: SessionStatus | null;
	overall_score: number | null;
	created_at: string;
}

export interface Message {
	id: string;
	role: 'assistant' | 'applicant' | 'system';
	kind: 'opening' | 'question' | 'follow_up' | 'answer' | 'closing';
	topic_id: string | null;
	content: string;
	created_at: string;
}

export interface Topic {
	id: string;
	position: number;
	title: string;
	goal: string;
	rubric_keys: string[];
	status: TopicStatus;
	follow_up_count: number;
}

export interface Evidence {
	message_id: string;
	quote: string;
}

export interface Score {
	rubric_key: string;
	score: number | null;
	rationale: string;
	status: ScoreStatus;
	attempts: number;
	evidence: Evidence[];
}

export interface Decision {
	value: DecisionValue;
	note: string;
	decided_at: string;
}

export interface ApplicationDetail {
	application: ApplicationSummary;
	job: Pick<Job, 'id' | 'title' | 'rubric'>;
	cv_text: string;
	decision: Decision | null;
	session: {
		id: string;
		status: SessionStatus;
		expires_at: string;
		started_at: string | null;
		ended_at: string | null;
		finish_reason: FinishReason | null;
		question_count: number;
	} | null;
	graph_run: { id: string; status: RunStatus; cost_usd: number } | null;
	topics: Topic[];
	messages: Message[];
	scores: Score[];
}

export interface CurrentTopic {
	position: number;
	title: string;
	total: number;
}

export interface SessionInfo {
	status: SessionStatus;
	job_title: string;
	applicant_name: string;
	expires_at: string;
	started_at: string | null;
	deadline_at: string | null;
	max_minutes: number;
	topic_count: number | null;
	question_count: number;
	max_questions: number;
	current_topic: CurrentTopic | null;
}

export interface GraphRun {
	id: string;
	session_id: string;
	status: RunStatus;
	nodes: {
		id: NodeId;
		type: NodeType;
		status: NodeStatus;
		attempts: number;
		model: string | null;
	}[];
	edges: { from: NodeId; to: NodeId }[];
	last_seq: number;
	total_tokens_in: number;
	total_tokens_out: number;
	cost_usd: number;
}

export interface LoginResponse {
	access_token: string;
	expires_at: string;
}

export interface SseTokenResponse {
	sse_token: string;
	expires_at: string;
}

export interface ApplyResponse {
	application_id: string;
	status: ApplicationStatus;
	message: string;
}

export interface ResendInviteResponse {
	session_id: string;
	expires_at: string;
	invite_url: string | null;
}

export interface SendMessageResponse {
	message: Message;
	awaiting: 'assistant';
}

export const API_ERROR_CODES = [
	'validation_failed',
	'invalid_file',
	'unauthorized',
	'not_found',
	'session_not_found',
	'already_applied',
	'session_already_started',
	'invalid_state',
	'session_expired',
	'session_completed',
	'file_too_large',
	'rate_limited',
	'internal_error',
	'llm_unavailable',
	'db_unavailable'
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** A contract error (`{ error: { code, message, details } }`) from the API or the mock. */
export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: ApiErrorCode,
		message: string,
		readonly details: Record<string, unknown> | null = null
	) {
		super(message);
		this.name = 'ApiError';
	}
}

/**
 * Failures reject with `ApiError`. The exception is a 401 on a recruiter call: it clears the
 * session cookie and redirects to login, so callers never see it. `login` is not a recruiter
 * call, and its 401 (wrong password) rejects like any other error.
 */
export interface TalentScoutApi {
	login(password: string): Promise<LoginResponse>;
	mintSseToken(runId: string): Promise<SseTokenResponse>;

	listJobs(): Promise<List<Job>>;
	getJob(jobId: string): Promise<Job>;
	getPublicJob(jobId: string): Promise<PublicJob>;

	/** `form` carries the multipart fields `name`, `email` and `cv`. */
	apply(jobId: string, form: FormData): Promise<ApplyResponse>;
	listApplications(
		jobId: string,
		query?: { status?: ApplicationStatus }
	): Promise<List<ApplicationSummary>>;
	getApplication(applicationId: string): Promise<ApplicationDetail>;
	/** Resolves to the raw `application/pdf` response, for a `+server.ts` to stream. */
	getCv(applicationId: string): Promise<Response>;
	decide(
		applicationId: string,
		decision: { decision: DecisionValue; note?: string }
	): Promise<ApplicationSummary>;
	resendInvite(applicationId: string): Promise<ResendInviteResponse>;

	getSession(token: string): Promise<SessionInfo>;
	startSession(token: string): Promise<SessionInfo>;
	listMessages(token: string): Promise<{ items: Message[] }>;
	sendMessage(token: string, content: string): Promise<SendMessageResponse>;
	retrySession(token: string): Promise<{ status: 'retrying' }>;

	getGraphRun(runId: string): Promise<GraphRun>;

	/** Base URL for browser `EventSource`; `null` in mock mode, where the browser replays fixtures. */
	sseBaseUrl(): string | null;
}
