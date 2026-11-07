import { ApiError, type ApiErrorCode } from '$lib/server/api/types';

const MESSAGES: Partial<Record<ApiErrorCode, string>> = {
	rate_limited: 'We have received too many applications from your network. Please try again later.'
};

const FALLBACK = 'Something went wrong. Please try again in a moment.';

/** Applicant-facing text for a failed apply; never echoes the API message. */
export function applyErrorMessage(error: unknown): string {
	return (error instanceof ApiError && MESSAGES[error.code]) || FALLBACK;
}
