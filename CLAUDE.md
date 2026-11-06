# CLAUDE.md — Brief for Claude (SvelteKit Frontend)

## Project Summary
Talent Scout: recruiter-side AI screening. Applicant applies → gets a session link (MVP: the recruiter copies it from the dashboard via "Get invite link"; email is optional) → ~15-minute screening chat with the AI → the recruiter sees the transcript, rubric scores + evidence quotes, and **the multi-agent graph running live** (nodes light up via SSE), then shortlists/rejects. This repo = **SvelteKit client**. The Go backend lives in the `talent-scout-server` repo and is built by another agent; we meet at the contract.

## Read First (mandatory)
0. `DESIGN.md` — **must be read before building any UI** (color/typography/node-status tokens, components, per-page layout)
1. `docs/PRD.md` — flows & requirements
2. `docs/API.md` — **REST contract** (identical to the server)
3. `docs/EVENTS.md` — **SSE contract** (identical to the server)
4. `PLAN.md` — 7-day checklist
5. `docs/LESSONS.md` — lessons from previous issues (read before starting a new issue)
6. `docs/SERVER-SIDE.md` — server-side SvelteKit (BFF) design & auth/SSE/IP flow (approved 2026-11-05; the contract docs win on any conflict)
7. The GitHub issue being worked on (`gh issue view <n>`) — the source of the task

## Stack
SvelteKit (Svelte 5, runes) + strict TypeScript, **server-side (BFF) on `@sveltejs/adapter-vercel`** (SSR on, no `vercel.json` rewrite; design in `docs/SERVER-SIDE.md`). The browser talks only to the SvelteKit server; `+page.server.ts` loads/actions and `+server.ts` endpoints call the Go API through `src/lib/server/api`. Exception: SSE `EventSource` connects straight to Go (short-lived `sse_token` for recruiter runs, path token for applicant sessions). Tailwind CSS. Graph: `@xyflow/svelte`. API types: `openapi-typescript` from the server's `openapi.yaml` (copied to `src/lib/server/api/openapi.yaml`). Validation: zod. Tests: `svelte-check`, Vitest (server modules), Playwright. Package manager: pnpm. Deploy: **Vercel Hobby** (Functions: max 300 s, request/response body 4.5 MB — never proxy SSE through a function; the 2 MB CV fits), default domain `talentscout.vercel.app` (or another available name). Verify on the Day 1 preview that `/apply/x`, `/s/x`, `/dashboard/jobs` render server-side.

**One app, routed by path:** the recruiter at `/dashboard/...`, the applicant apply form at `/apply/[jobId]`, the AI session link from the email at `/s/[token]` (`${PUBLIC_APP_URL}/s/<token>`). Vercel's free subdomain is single-level (`apply.talentscout.vercel.app` is not possible); if a custom domain comes later, `apply.` just points to the same project — no routing changes.

**The client never talks to Supabase.** No `@supabase/supabase-js`, anon key, or Supabase URL in this repo; all data goes through the Go API.

## Structure (proposed)
```
talent-scout-client/
├── src/
│   ├── lib/
│   │   ├── server/                 # server-only ($lib/server can't be imported by browser code)
│   │   │   ├── session.ts          # ts_session cookie: name/options, set/clear/read
│   │   │   ├── guards.ts           # requireRecruiter(event), normalizeRefererPath
│   │   │   ├── client-ip.ts        # X-Forwarded-For + X-BFF-Secret headers for the apply call
│   │   │   └── api/
│   │   │       ├── openapi.yaml    # copy from the server
│   │   │       ├── schema.d.ts     # openapi-typescript output
│   │   │       ├── types.ts        # interface TalentScoutApi, error {error:{code,message}}
│   │   │       ├── real.ts         # event.fetch → API_BASE_URL
│   │   │       ├── mock.ts         # mock implementation (fixtures)
│   │   │       ├── index.ts        # api = USE_MOCK ? mock : real
│   │   │       └── fixtures/       # jobs, application detail, run-events.json (order per EVENTS.md §6)
│   │   ├── events.ts               # browser: event types from docs/EVENTS.md + EventSource wrapper (sse_token, since_seq, reconnect, mock replay)
│   │   ├── stores/                 # session chat state, graph run state (no tokens)
│   │   └── components/             # ChatWindow, MessageBubble, ScoreCard, EvidenceQuote, GraphView, StatusBadge
│   ├── hooks.server.ts             # handle (cookie → locals.recruiter), handleFetch (Bearer only for API_BASE_URL), handleError (redacted)
│   └── routes/
│       ├── +page.svelte            # short landing + link to /dashboard
│       ├── apply/[jobId]/          # +page.server.ts: job load + apply action (CV ≤ 2 MB, forwards client IP)
│       ├── s/[token]/              # +page.server.ts: session load + message action; applicant AI session: intro → chat → thank you
│       └── dashboard/
│           ├── +page.server.ts     # redirect → /dashboard/jobs
│           ├── login/              # login action → sets httpOnly ts_session cookie
│           ├── logout/             # logout action → clears the cookie
│           └── (recruiter)/        # +layout.server.ts guard (no session → /dashboard/login?redirectTo=)
│               ├── jobs/           # job list (MVP: 1 seeded job, read-only)
│               ├── jobs/[jobId]/   # applicant list
│               ├── applications/[applicationId]/  # review + decision/resend-invite actions; cv/+server.ts streams the CV
│               └── runs/[runId]/   # live graph view; load mints sse_token; sse-token/+server.ts (POST) for reconnects
├── tests/e2e/                      # 1 Playwright smoke (mock): apply → chat → review
├── DESIGN.md                       # design system (Refero: Relate)
├── docs/                           # PRD, API, EVENTS (identical to the server), LESSONS
│   └── design-refs/                # Relate reference assets (images, original DESIGN.md & tokens)
├── .claude/skills/                 # issue-workflow, new-page-with-mock, use-design-tokens + review/CI: verify-this, deslop, thermo-nuclear-review, thermo-nuclear-code-quality-review, loop-on-ci, fix-ci, get-pr-comments + design: impeccable
├── .github/                        # ISSUE_TEMPLATE/task.md, pull_request_template.md, workflows/ci.yml
└── .env.example                    # API_BASE_URL, USE_MOCK, BFF_SHARED_SECRET (names only, private env)
```

## Pages
| Route | Content | Endpoint/Event |
|---|---|---|
| `/apply/[jobId]` | Title + JD, name/email/CV PDF form (client-side validation ≤ 2 MB), success state "link will be sent" (MVP without mandatory email) | `GET /jobs/{jobId}/public`, `POST /jobs/{jobId}/applications` |
| `/s/[token]` | Intro (15-minute duration, rules) → Start → streaming chat, topic indicator `2/4`, countdown from `deadline_at`, input locked until `message.completed` → finish screen. 404/410 errors → friendly message. Resume after refresh. | `GET /sessions/{token}`, `POST .../start`, `GET`/`POST .../messages`, SSE `.../events` |
| `/dashboard` | Redirect to `/dashboard/jobs` (or `/dashboard/login` when there is no session cookie) | — |
| `/dashboard/login` | Single password → form action → `access_token` stored only in the httpOnly `ts_session` cookie (never sent to the browser); 401 anywhere → clear the cookie, go to login | `POST /auth/login` |
| `/dashboard/jobs` | Job table (MVP: 1 seeded job, no create/edit button), applicant count, copy `apply_url` (`https://talentscout.vercel.app/apply/{jobId}` from the server) | `GET /jobs` |
| `/dashboard/jobs/[jobId]` | Applicant table: name, status badge, overall score, status filter | `GET /jobs/{jobId}/applications` |
| `/dashboard/applications/[applicationId]` | Left: transcript (quoted applicant messages highlighted). Right: ScoreCard per criterion (score, rationale, evidence quote → click scrolls to the message, `needs_manual` badge), cost, Shortlist/Reject buttons + note, **Get invite link** (only for status `invited`; show & copy `invite_url`), CV link, link to the graph | `GET /applications/{applicationId}`, `POST .../decision`, `POST .../resend-invite`, `GET .../cv` |
| `/dashboard/runs/[runId]` | GraphView: nodes `planner, plan_check, interviewer, judge, guard, scorer, evidence_check, recruiter_gate`; color per status (pending/running/succeeded/failed), edges animate on `edge.traversed`, `attempt` badge on `loop.retry`, event timeline panel + node detail (model, tokens, duration, cost). Live & replay modes. | `GET /graph-runs/{runId}`, `POST /auth/sse-token` (server-side), SSE `/graph-runs/{runId}/events?sse_token=&since_seq=` (browser → Go) |

## Mock-First
- `USE_MOCK=true` (private env, read on the server) → `$lib/server/api` exports the mock implementation (no network); loads/actions don't know which one they get. In mock mode the page load returns a mock flag instead of an SSE URL, and `events.ts` replays `fixtures/run-events.json` in the browser with 300–800 ms delays and streams `message.delta` word by word.
- Fixtures must be valid against the types from `schema.d.ts` / `events.ts` (checked by `svelte-check`).
- Day 4 switches to the real API: `USE_MOCK=false`, `API_BASE_URL=http://localhost:8080`. The mock stays in use for Playwright.

## Conventions
- Svelte 5 runes (`$state`, `$derived`, `$props`), strict TypeScript, no `any`.
- All Go API calls go through `$lib/server/api` from `+page.server.ts` / `+server.ts` (forms via actions); no `fetch` to Go in components. The only browser → Go traffic is SSE `EventSource`.
- Nothing returned from a `load` or action may contain the recruiter token (page data is readable by JS). Only the login action sets the session cookie.
- Don't forward the browser's `Authorization` header; `handleFetch` adds the Bearer from the cookie.
- Field names exactly as in the contract (`snake_case`), never remapped.
- UI in **English** (international portfolio); strings kept together so they are easy to translate later.
- Basic accessibility: form labels, keyboard focus, sufficient contrast. Mobile-friendly applicant pages.
- Small commits, Conventional Commits.

## Rules
1. **Follow the contract.** Don't guess fields. Don't edit `docs/API.md`/`docs/EVENTS.md`/`docs/PRD.md` in this repo: the source of truth is the server. Need a change → open a `contract-change` issue in `aangwijaya/talent-scout-server`, wait for approval & merge, then copy the file here byte-identical.
2. No secrets in the browser. Env is private server-side only (`API_BASE_URL`, `USE_MOCK`, `BFF_SHARED_SECRET` via `$env/dynamic/private`); no `PUBLIC_*` vars. No Supabase keys/URLs. `.env` is in `.gitignore`.
3. Recruiter token only in the httpOnly `ts_session` cookie (`secure` in prod, `sameSite: 'lax'`); never in `localStorage`/`sessionStorage`, page data, URLs (except the 60 s `sse_token`), or logs. `handleError` redacts tokens and query strings.
4. Never show scores/assessments to the applicant.
5. Out of scope: applicant accounts, multi-tenant, full i18n, dark mode. Post-MVP (don't build): job create/edit pages, a Playwright suite beyond 1 smoke test.

## Definition of Done (per task)
- [ ] `pnpm check` (svelte-check) 0 errors, `pnpm lint` clean
- [ ] `pnpm test:e2e` (1 Playwright smoke, mock mode) green once the smoke test exists
- [ ] Pages use types from the contract; mock fixtures valid
- [ ] Loading, empty, and error states handled
- [ ] UI follows `DESIGN.md` (tokens, no hardcoded colors)
- [ ] All acceptance criteria in the issue checked
- [ ] New lessons (if any) added to `docs/LESSONS.md`

## Tasks (7 days)
Tasks are **no longer** listed here. Source of tasks = GitHub issues in this repo labeled `agent:claude` (dependencies via "Blocked by #N", day via the `day:N` label). A per-day summary is in `PLAN.md`.

## Agentic Workflow (mandatory)
Project skills live in `.claude/skills/`: `issue-workflow`, `new-page-with-mock`, `use-design-tokens`. Review & CI skills (adapted from cursor/plugins, MIT, see `LICENSE-THIRD-PARTY.md` there): `verify-this`, `deslop`, `thermo-nuclear-review`, `thermo-nuclear-code-quality-review`, `loop-on-ci`, `fix-ci`, `get-pr-comments` (order in the work loop below). Design skill: `impeccable` (pbakaus/impeccable v4.8.0, Apache-2.0, see its folder's `LICENSE`/`NOTICE.md`), restricted below.

**Labels:** `agent:claude` (your tasks) · `agent:opencode` (server) · `agent:human` (repo owner) · `status:todo` → `status:in-progress` → `status:review` · `status:blocked` · `contract-change` · `skill-update` · `type:feat|bug|chore` · `day:1`…`day:7`.

**Work loop (repeat until no issues remain):**
1. Pick a `status:todo` + `agent:claude` issue with the lowest `day:N` whose "Blocked by" issues are all **closed** (`gh issue list --label agent:claude --label status:todo --state open`, then `gh issue view <n>`). Cross-repo blockers (`aangwijaya/talent-scout-server#N`) are checked with `gh issue view N -R aangwijaya/talent-scout-server`.
2. Switch the label to `status:in-progress` (`gh issue edit <n> --remove-label status:todo --add-label status:in-progress`).
3. Work **only in a git worktree** (see `WORKFLOW.md` §11): check that `git rev-parse --git-dir` contains `/worktrees/`. If not → stop and ask a human to run `git worktree add ../wt/client-<n> -b feat/<n>-<slug> origin/main`. Don't create branches in the main checkout. 1 issue = 1 worktree = 1 branch = 1 PR. If the worktree has no branch yet, create it from `origin/main`: `feat/<n>-<slug>` (`fix/…` for bugs, `chore/…` for chores; `.env` copied manually, `pnpm install` per worktree).
4. Implement only the acceptance criteria. Claiming a fix (type:bug, "fixes X") → run `verify-this` and put the verdict in the PR body.
5. Run `deslop` on the branch diff, then the green checks: `pnpm check`, `pnpm lint`, `pnpm build`, `pnpm test:e2e` (once the smoke test exists).
6. **UI PRs only:** run `impeccable audit <route>` (report-only), then `impeccable polish <route>` on the PR's own page (existing `DESIGN.md` tokens only); re-run the green checks.
7. Run `thermo-nuclear-review` + `thermo-nuclear-code-quality-review` — **report-only, once per PR** (no review→edit loop; token cost). Fix only High findings / presumptive blockers and re-run the green checks; list the rest in the PR body under "Review findings (not fixed)".
8. Failing (checks or blocker fixes) → **max 3 attempts** in total. Still failing → label `status:blocked`, comment on the issue (what was tried, the last error, the suspected cause), move to the next issue.
9. Green → push, `gh pr create` with the template and a `Closes #<n>` line; switch the issue label to `status:review`.
10. `loop-on-ci` (+ `fix-ci`) until all PR checks are green — active once CI exists (client #1); same max-3 rule.
11. Human review → `get-pr-comments` → fix → green checks → push (no force) → back to step 10. The human merges.
12. Add an entry to `docs/LESSONS.md` if there was a lesson (recurring review/CI findings included), then go back to step 1.

## Impeccable (design skill)
`.claude/skills/impeccable/` (pinned v4.8.0, manual copy, no hook, no subagents). Project config: `.impeccable/config.json` (telemetry off; detector ignores `overused-font` = Inter).
- **Allowed:** `audit` (report-only), `polish` (final pass on the PR's own page, existing `DESIGN.md` tokens only), `harden`, `clarify`. `critique` is optional, once per major screen (dashboard, review page, graph view, chat), not on every PR.
- **`DESIGN.md` is authoritative and wins** over any impeccable suggestion (Relate tokens, Inter, light mode, darkened status colors).
- **Never run:** `document`, `extract`, `init`, redesign, `shape`, `bolder`, `colorize`, `delight`, `overdrive`, `animate`, `typeset`, `live`, `generate`.
- No dark mode. No new fonts. Don't install the impeccable hook, don't run `npx impeccable install`, don't edit `DESIGN.md` through impeccable.
- If the launcher (`scripts/impeccable context`) is unavailable or would download its binary, skip it and read `DESIGN.md` directly.

**Limits:** never merge a PR, never force-push, never push to `main`; don't edit contract documents without an approved `contract-change` issue; don't close issues yourself; don't create new feature issues (`type:bug`/`contract-change` are allowed). Restart the Claude session every 2–4 issues (start again with `CLAUDE.md` + `docs/LESSONS.md`). All GitHub operations go through the `gh` CLI.

**Learning loop:** the same lesson appearing 2× in `docs/LESSONS.md` → a separate PR labeled `skill-update` that updates `.claude/skills/` or the rules in this file. Prefer turning lessons into tests/lint/CI checks. A human merges.
