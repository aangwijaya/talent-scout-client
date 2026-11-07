// REST types come from `schema.d.ts`, generated from the pinned `openapi.yaml` by `pnpm gen:api`.
// Only aliases live here: never hand-write a contract shape.
import type { components, operations } from './schema';

type Schemas = components['schemas'];
type Json<Op extends keyof operations> = operations[Op]['responses'] extends {
	200: { content: { 'application/json': infer T } };
}
	? T
	: never;

export type JobStatus = Schemas['JobStatus'];
export type ApplicationStatus = Schemas['ApplicationStatus'];
export type SessionStatus = Schemas['SessionStatus'];
export type FinishReason = Schemas['FinishReason'];
export type ScoreStatus = Schemas['Score']['status'];
export type TopicStatus = Schemas['Topic']['status'];
export type RunStatus = Schemas['GraphRun']['status'];
export type NodeId = Schemas['GraphRunNode']['id'];
export type NodeType = Schemas['GraphRunNode']['type'];
export type NodeStatus = Schemas['GraphRunNode']['status'];
export type DecisionValue = Schemas['Decision']['value'];

export type RubricCriterion = Schemas['RubricCriterion'];
export type Job = Schemas['Job'];
export type PublicJob = Schemas['PublicJob'];
export type ApplicationSummary = Schemas['ApplicationSummary'];
export type Message = Schemas['Message'];
export type Topic = Schemas['Topic'];
export type Evidence = Schemas['ScoreEvidence'];
export type Score = Schemas['Score'];
export type Decision = Schemas['Decision'];
export type ApplicationDetail = Schemas['ApplicationDetail'];
export type CurrentTopic = Schemas['CurrentTopic'];
export type SessionInfo = Schemas['SessionDetail'];
export type GraphRun = Schemas['GraphRun'];
export type LoginResponse = Schemas['LoginResponse'];
export type SseTokenResponse = Schemas['SSETokenResponse'];
export type ApplyResponse = Schemas['ApplyResponse'];
export type DecisionRequest = Schemas['DecisionRequest'];
export type ResendInviteResponse = Schemas['ResendInviteResponse'];
export type SendMessageResponse = Schemas['SendMessageResponse'];
export type RetryResponse = Schemas['RetryResponse'];

export type JobList = Json<'listJobs'>;
export type ApplicationList = Json<'listApplications'>;
export type MessageList = Json<'listMessages'>;
export type ApplicationListQuery = Pick<
	NonNullable<operations['listApplications']['parameters']['query']>,
	'status'
>;

export type ApiErrorCode = Schemas['Error']['error']['code'];

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
] as const satisfies readonly ApiErrorCode[];

// `satisfies` rejects codes the contract lacks; this rejects contract codes missing above.
export type MissingErrorCodes = Exclude<ApiErrorCode, (typeof API_ERROR_CODES)[number]>;
const noMissingErrorCodes: [MissingErrorCodes] extends [never] ? true : MissingErrorCodes = true;
void noMissingErrorCodes;

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

	listJobs(): Promise<JobList>;
	getJob(jobId: string): Promise<Job>;
	getPublicJob(jobId: string): Promise<PublicJob>;

	/** `form` carries the multipart fields `name`, `email` and `cv`. */
	apply(jobId: string, form: FormData): Promise<ApplyResponse>;
	listApplications(jobId: string, query?: ApplicationListQuery): Promise<ApplicationList>;
	getApplication(applicationId: string): Promise<ApplicationDetail>;
	/** Resolves to the raw `application/pdf` response, for a `+server.ts` to stream. */
	getCv(applicationId: string): Promise<Response>;
	decide(applicationId: string, decision: DecisionRequest): Promise<ApplicationSummary>;
	resendInvite(applicationId: string): Promise<ResendInviteResponse>;

	getSession(token: string): Promise<SessionInfo>;
	startSession(token: string): Promise<SessionInfo>;
	listMessages(token: string): Promise<MessageList>;
	sendMessage(token: string, content: string): Promise<SendMessageResponse>;
	retrySession(token: string): Promise<RetryResponse>;

	getGraphRun(runId: string): Promise<GraphRun>;

	/** Base URL for browser `EventSource`; `null` in mock mode, where the browser replays fixtures. */
	sseBaseUrl(): string | null;
}
