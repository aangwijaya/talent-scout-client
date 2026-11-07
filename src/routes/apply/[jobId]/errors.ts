import { ApiError, type ApiErrorCode } from '$lib/server/api/types';

const MESSAGES: Partial<Record<ApiErrorCode, string>> = {
	rate_limited: 'We have received too many applications from your network. Please try again later.',
	already_applied: 'You have already applied for this job with this email address.',
	file_too_large: 'Your CV must be 2 MB or smaller.',
	invalid_file: 'We could not read your CV. Please upload a text-based PDF.',
	validation_failed: 'Please check your name, email and CV, then try again.',
	invalid_state: 'This job is no longer accepting applications.',
	not_found: 'This job could not be found. It may have been removed.'
};

const FALLBACK = 'Something went wrong. Please try again in a moment.';

/** Applicant-facing text for a failed apply; never echoes the API message. */
export function applyErrorMessage(error: unknown): string {
	return (error instanceof ApiError && MESSAGES[error.code]) || FALLBACK;
}
