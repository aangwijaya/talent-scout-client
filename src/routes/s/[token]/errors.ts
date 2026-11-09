import { ApiError, type ApiErrorCode } from '$lib/server/api/types';

const MESSAGES: Partial<Record<ApiErrorCode, string>> = {
	session_not_found:
		'We could not find this screening session. Please check the link you were given.',
	session_expired: 'This screening link has expired. Please contact the recruiter for a new one.',
	session_completed: 'This screening session has already finished. Thank you for taking part.',
	session_already_started: 'This screening session has already started.',
	invalid_state: 'Please wait for the interviewer to finish replying, then try again.',
	validation_failed: 'Your answer must be between 1 and 2000 characters.',
	llm_unavailable: 'The interviewer is temporarily unavailable. Please try again in a moment.'
};

const FALLBACK = 'Something went wrong. Please try again in a moment.';

/** Applicant-facing text for a session API error; never echoes the API message. */
export function sessionErrorMessage(error: unknown): string {
	return (error instanceof ApiError && MESSAGES[error.code]) || FALLBACK;
}
