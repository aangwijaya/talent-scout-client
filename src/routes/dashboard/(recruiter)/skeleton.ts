export type SkeletonKind = 'table' | 'review' | 'form' | 'run';

const KINDS: Record<string, SkeletonKind> = {
	'/dashboard/(recruiter)/jobs': 'table',
	'/dashboard/(recruiter)/jobs/[jobId]': 'table',
	'/dashboard/(recruiter)/jobs/new': 'form',
	'/dashboard/(recruiter)/jobs/[jobId]/edit': 'form',
	'/dashboard/(recruiter)/applications/[applicationId]': 'review',
	'/dashboard/(recruiter)/runs/[runId]': 'run'
};

/**
 * The skeleton to show while navigating from one dashboard route to another, shaped like the
 * page being loaded. Null when staying on the same route (the page shows its own loading state).
 */
export function skeletonFor(
	to: string | null | undefined,
	from: string | null
): SkeletonKind | null {
	if (to == null || to === from) return null;
	return KINDS[to] ?? null;
}
