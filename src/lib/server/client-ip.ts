import type { RequestEvent } from '@sveltejs/kit';

/**
 * Tells the Go API who the applicant is: it trusts `X-Forwarded-For` for its per-IP rate limit
 * only when `X-BFF-Secret` matches. Any value the browser sent is replaced, never passed through.
 */
export function setClientIpHeaders(
	headers: Headers,
	event: Pick<RequestEvent, 'getClientAddress'>,
	secret: string | undefined
): void {
	headers.set('x-forwarded-for', event.getClientAddress());
	if (secret) headers.set('x-bff-secret', secret);
	else headers.delete('x-bff-secret');
}
