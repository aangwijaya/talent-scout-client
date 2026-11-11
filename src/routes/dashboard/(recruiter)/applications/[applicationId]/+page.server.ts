import { error, fail } from '@sveltejs/kit';
import { api } from '$lib/server/api';
import { ApiError, type Decision, type DecisionValue } from '$lib/server/api/types';
import { rethrowApiError } from '../../api-error';
import type { Actions, PageServerLoad } from './$types';

const NOTE_MAX = 1000;

function parseDecision(value: FormDataEntryValue | null): DecisionValue | null {
	return value === 'shortlist' || value === 'reject' ? value : null;
}

export const load: PageServerLoad = async ({ params }) => {
	try {
		return { detail: await api.getApplication(params.applicationId) };
	} catch (err) {
		if (err instanceof ApiError && err.status === 404) {
			error(404, "This application doesn't exist");
		}
		rethrowApiError(err);
	}
};

export const actions: Actions = {
	decide: async ({ params, request }) => {
		const data = await request.formData();
		const decision = parseDecision(data.get('decision'));
		const note = String(data.get('note') ?? '').trim();
		if (!decision || note.length > NOTE_MAX) {
			return fail(400, { decisionError: 'validation_failed' as const });
		}
		try {
			const { status } = await api.decide(params.applicationId, {
				decision,
				...(note ? { note } : {})
			});
			const saved: Decision = { value: decision, note, decided_at: new Date().toISOString() };
			return { status, decision: saved };
		} catch (err) {
			if (err instanceof ApiError && (err.status === 409 || err.status === 400)) {
				return fail(err.status, {
					decisionError:
						err.status === 409 ? ('invalid_state' as const) : ('validation_failed' as const)
				});
			}
			rethrowApiError(err);
		}
	},
	invite: async ({ params }) => {
		try {
			// The contract allows this only for invited sessions or failed applications, and both
			// end up `invited`; returning it keeps the page right even when the load doesn't rerun.
			return {
				invite: await api.resendInvite(params.applicationId),
				status: 'invited' as const
			};
		} catch (err) {
			if (err instanceof ApiError && err.status === 409) {
				return fail(409, { inviteError: err.message });
			}
			rethrowApiError(err);
		}
	}
};
