# PROGRESS — handoff for the next agent

**Snapshot from 2026-11-07. This file goes stale.** GitHub labels are the source of truth for issue status, so run these first and trust them over this file:

```bash
gh issue list --label agent:claude --state open
gh pr list --state open
gh issue list -R aangwijaya/talent-scout-server --state open
```

Read in this order: `CLAUDE.md`, `docs/LESSONS.md`, `docs/FINDINGS.md`, this file, then the issue.

## Where things stand

- **Done and merged:** the skeleton, design tokens and server API layer, plus two docs fixes.
- **Waiting on human review:** recruiter auth (#13, PR #23). All PR checks passed on the last read.
- **Not started:** every page. All routes are still placeholders.

## Client issues

| Issue | Day | Title | Status | Waiting on |
|---|---|---|---|---|
| #1 | 1 | Skeleton + tooling + CI | Closed | — |
| #2 | 1 | Design tokens + base components | Closed | — |
| #3 | 1 | Server-only API layer | Closed | — |
| #17 | 1 | Fix docs that conflict with SvelteKit 3 | Closed | — |
| #20 | 1 | Sync contract docs | Closed | — |
| #13 | 2 | Server-side auth hooks + guard | In review, PR #23 | Human review and merge |
| #15 | 2 | Forward applicant IP | Todo, **ready** | — |
| #5 | 2 | Applicant chat `/s/[token]` | Todo, **ready** | — |
| #4 | 2 | Apply page `/apply/[jobId]` | Todo | #15 |
| #6 | 2 | Login, jobs list, applicants table | Todo | #13 |
| #7 | 3 | Application review page | Todo | #6 |
| #8 | 3 | Live graph view | Todo | #6 |
| #9 | 3 | Playwright smoke test | Todo | #4, #5, #7 |
| #14 | 4 | Run SSE token + reconnect | Todo | #8, #13, server #19 |
| #10 | 4 | Integrate the real API | Todo | #9, #14, #15, server #13, server #21 |
| #11 | 5 | Deploy to Vercel | Todo | #10, server #15 |
| #12 | 6 | Polish | Todo | #10 |

**Suggested next:** #15, because it also unblocks #4. Take #6 once PR #23 is merged.

**Server:** the contract issues #18 and #22 are closed. Most of the rest is still open, including #5 (auth), #13 (graph SSE), #19 (SSE token) and #21 (client IP). Day 4 integration cannot start until those land.

## What #13 added (PR #23)

- `src/hooks.server.ts`: `handle`, `handleFetch`, `handleError`
- `src/lib/server/session.ts`: `setSessionCookie`, `clearSessionCookie`, `readSession`
- `src/lib/server/guards.ts`: `normalizeRefererPath`, `isRecruiterRoute`, `redirectToLogin`, `requireRecruiter`
- `src/lib/server/redact.ts`: strips credentials from log text
- `src/routes/dashboard/logout/+page.server.ts`: logout action

For #6: the login action should call `api.login(password)`, then `setSessionCookie(cookies, response)`, then redirect to `normalizeRefererPath(redirectTo) ?? '/dashboard/jobs'`. The login route has no `+page.server.ts` yet.

## Things that differ from what the docs lead you to expect

The project docs were first written for SvelteKit 2, and SvelteKit 3.1.1 is installed. Read the types in `node_modules/@sveltejs/kit/types/index.d.ts` before trusting a doc.

- Private env vars: declare them in `src/env.ts`, then import from `$app/env/private`. `$env/*` is deprecated.
- Hook types come from `@sveltejs/kit/hooks`, not `@sveltejs/kit`.
- `handleError` receives `{ kind, error, event }` and also runs for `error()` throws.
- `$lib` works only through the alias in `vite.config.ts`, and it prints a deprecation warning.
- The `ts_session` value is `<expires_at epoch ms>.<access_token>`. Use `readSession` rather than reading the cookie directly.

## Environment

- Work only in a worktree: `~/projects/talent-scout/wt/client-<n>`, created by the human. Run `pnpm install` in each one.
- Playwright browsers do not launch on this WSL setup without extra steps. See `docs/LESSONS.md` (2026-11-06, #2).
- The desktop app forbids polling CI with `gh`, and binding PR #23 to its monitor failed in this session.
- Agents share one GitHub API limit of 5,000 requests an hour, and it was reached on 2026-11-07. If `gh` calls fail, wait for the reset.

## Still to do outside the issues

- **Open the `skill-update` PR.** The "docs written for SvelteKit 2" lesson is logged three times and no such PR exists, although the `docs/LESSONS.md` rule requires one. The fix starts with `$env/dynamic/private` in `.claude/skills/thermo-nuclear-review/SKILL.md`.
- **Remove the old worktree** `wt/client-2`, since #2 is closed (human).
- **Decide the open questions** under "Behavior to confirm" in `docs/FINDINGS.md` (human).
- **Close the gaps** listed in `docs/FINDINGS.md`, each with the issue that should handle it.
