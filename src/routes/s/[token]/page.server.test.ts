import { isActionFailure, isHttpError, type RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '$lib/server/api/types';

const api = vi.hoisted(() => ({
	getSession: vi.fn(),
	startSession: vi.fn(),
	listMessages: vi.fn(),
	sendMessage: vi.fn(),
	retrySession: vi.fn(),
	sseBaseUrl: vi.fn()
}));
vi.mock('$lib/server/api', () => ({ api }));

const { actions, load } = await import('./+page.server');

const TOKEN = 'tok-123';
const session = { status: 'active', deadline_at: '2026-11-09T10:15:00Z' };
const messages = [{ id: 'm1', role: 'assistant', content: 'Hi' }];

function event(body?: FormData) {
	const url = `http://app.test/s/${TOKEN}`;
	const request = body ? new Request(url, { method: 'POST', body }) : new Request(url);
	const setHeaders = vi.fn();
	return { params: { token: TOKEN }, request, setHeaders } as unknown as RequestEvent & {
		setHeaders: ReturnType<typeof vi.fn>;
	};
}

const runLoad = (e: RequestEvent) => Promise.resolve(load(e as never));
const act = (name: 'start' | 'message' | 'retry', e: RequestEvent) =>
	Promise.resolve(actions[name](e as never));

beforeEach(() => {
	vi.resetAllMocks();
});

describe('load', () => {
	it('returns session, transcript and the SSE URL, with no-referrer/noindex headers', async () => {
		api.getSession.mockResolvedValue(session);
		api.listMessages.mockResolvedValue({ items: messages });
		api.sseBaseUrl.mockReturnValue('http://api.test/api/v1');
		const e = event();
		await expect(runLoad(e)).resolves.toEqual({
			session,
			messages,
			sseUrl: `http://api.test/api/v1/sessions/${TOKEN}/events`
		});
		expect(e.setHeaders).toHaveBeenCalledWith({
			'Referrer-Policy': 'no-referrer',
			'X-Robots-Tag': 'noindex'
		});
	});

	it('returns a null SSE URL in mock mode', async () => {
		api.getSession.mockResolvedValue(session);
		api.listMessages.mockResolvedValue({ items: [] });
		api.sseBaseUrl.mockReturnValue(null);
		await expect(runLoad(event())).resolves.toMatchObject({ sseUrl: null });
	});

	it.each([
		[404, 'session_not_found', /link/i],
		[410, 'session_expired', /expired/i],
		[410, 'session_completed', /finished/i]
	] as const)('turns %i %s into a friendly error', async (status, code, text) => {
		api.getSession.mockRejectedValue(new ApiError(status, code, 'raw api text'));
		const thrown = await runLoad(event()).catch((e: unknown) => e);
		expect(isHttpError(thrown, status)).toBe(true);
		expect((thrown as { body: { message: string } }).body.message).toMatch(text);
	});
});

describe('actions', () => {
	it('start returns the active session', async () => {
		api.startSession.mockResolvedValue(session);
		await expect(act('start', event(new FormData()))).resolves.toEqual({ session });
		expect(api.startSession).toHaveBeenCalledWith(TOKEN);
	});

	it('start treats 409 session_already_started as resume', async () => {
		api.startSession.mockRejectedValue(new ApiError(409, 'session_already_started', 'x'));
		api.getSession.mockResolvedValue(session);
		await expect(act('start', event(new FormData()))).resolves.toEqual({ session });
	});

	it('message forwards trimmed content and returns the stored message', async () => {
		const form = new FormData();
		form.set('content', '  my answer  ');
		const message = { id: 'm2', role: 'applicant', content: 'my answer' };
		api.sendMessage.mockResolvedValue({ message, awaiting: 'assistant' });
		await expect(act('message', event(form))).resolves.toEqual({ message });
		expect(api.sendMessage).toHaveBeenCalledWith(TOKEN, 'my answer');
	});

	it('message rejects empty and over-long content without calling the API', async () => {
		for (const content of ['   ', 'x'.repeat(2001)]) {
			const form = new FormData();
			form.set('content', content);
			const result = await act('message', event(form));
			expect(isActionFailure(result)).toBe(true);
		}
		expect(api.sendMessage).not.toHaveBeenCalled();
	});

	it('message maps 409 invalid_state to a friendly failure', async () => {
		const form = new FormData();
		form.set('content', 'hi');
		api.sendMessage.mockRejectedValue(new ApiError(409, 'invalid_state', 'raw'));
		const result = await act('message', event(form));
		expect(isActionFailure(result)).toBe(true);
		expect(result).toMatchObject({ status: 409, data: { error: expect.stringMatching(/wait/i) } });
	});

	it('retry calls POST /retry', async () => {
		api.retrySession.mockResolvedValue({ status: 'retrying' });
		await expect(act('retry', event(new FormData()))).resolves.toEqual({ retrying: true });
		expect(api.retrySession).toHaveBeenCalledWith(TOKEN);
	});

	it('retry maps 410 to a friendly failure', async () => {
		api.retrySession.mockRejectedValue(new ApiError(410, 'session_expired', 'raw'));
		const result = await act('retry', event(new FormData()));
		expect(result).toMatchObject({ status: 410, data: { error: expect.stringMatching(/ended|expired/i) } });
	});
});
