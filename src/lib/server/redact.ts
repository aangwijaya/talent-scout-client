const REDACTED = '[redacted]';

const SECRET_PATTERNS: [RegExp, string][] = [
	[/\bbearer\s+\S+/gi, `Bearer ${REDACTED}`],
	[
		/\b(ts_session|sse_token|access_token|x-bff-secret|authorization|cookie)(["'\s:=>]+)[^\s"';,&]+/gi,
		`$1$2${REDACTED}`
	],
	// Applicant session tokens travel in the path.
	[/(\/(?:s|sessions)\/)[^/\s?#]+/g, `$1${REDACTED}`],
	[/\?\S*/g, `?${REDACTED}`]
];

/** Removes the given secret values and anything shaped like a credential from log text. */
export function redact(text: string, secrets: readonly string[] = []): string {
	const withoutSecrets = secrets.reduce(
		(result, secret) => result.replaceAll(secret, REDACTED),
		text
	);
	return SECRET_PATTERNS.reduce(
		(result, [pattern, replacement]) => result.replace(pattern, replacement),
		withoutSecrets
	);
}
