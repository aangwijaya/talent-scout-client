# PLAN — Frontend (talent-scout-client), 7 Days

Built by Claude. References: `CLAUDE.md`, `DESIGN.md`, `docs/*`, `../WORKFLOW.md` (a copy of the rules is in `CLAUDE.md`). Each block below = one or more GitHub issues labeled `agent:claude` + `day:N`; work through issues. Tick when the DoD is met.

1-week scope: no create/edit job page (1 seeded job), invite links copied from the dashboard ("Get invite link"), 1 recruiter password, **1 Playwright smoke test**.

## Day 1 — Skeleton
- [ ] Init SvelteKit + strict TS + Tailwind v4 + `adapter-vercel` (server-side, SSR on) + ESLint/Prettier + Vitest + Playwright
- [ ] `.env.example` (`API_BASE_URL`, `USE_MOCK`, `BFF_SHARED_SECRET`, private), `hooks.server.ts` skeleton
- [ ] `@theme` design tokens from `DESIGN.md` + base components
- [ ] `$lib/server/api` (types, real/mock switch on `USE_MOCK`, fixtures) + browser `lib/events.ts` (manual types from `docs/API.md`/`EVENTS.md`, then `openapi-typescript`)
- [ ] Minimal GitHub Actions CI (`pnpm check`, `pnpm lint`, `pnpm build`)
- [ ] Vercel preview: `/apply/x`, `/s/x`, `/dashboard/jobs` render server-side (no 404)
- **Done:** `pnpm check` green; `pnpm build` succeeds

## Day 2 — Applicant Pages & Login (mock)
- [ ] Auth hooks + `ts_session` cookie + `(recruiter)` guard (client#13); applicant IP forwarding (client#15)
- [ ] `/apply/[jobId]`: JD, form action, PDF ≤ 2 MB validation, errors `already_applied`/`file_too_large`/`rate_limited`/job closed
- [ ] `/s/[token]`: intro → start → `message.delta` chat stream, input lock, topics, countdown, finish screen, 404/410 errors
- [ ] `/dashboard/login` (form action → httpOnly cookie, 401 → login) + `/dashboard/jobs` (1 seeded job) + `/dashboard/jobs/[jobId]` (applicant list)
- **Done:** all pages run on mocks

## Day 3 — Review & Live Graph (mock)
- [ ] `/dashboard/applications/[applicationId]`: transcript, ScoreCard, EvidenceQuote, `needs_manual`, cost, decision, **Get invite link** (copy `invite_url`)
- [ ] `/dashboard/runs/[runId]`: `@xyflow/svelte` 8 nodes, `edge.traversed`, `loop.retry` badge, timeline; replay `run-events.json` (EVENTS.md §6)
- [ ] 1 Playwright smoke (mock): apply → chat → review
- **Done:** smoke green; scorer retry clearly visible

## Day 4 — Integration
- [ ] SSE token mint + reconnect (client#14); `USE_MOCK=false` against the local server; types from `openapi-typescript`; recruiter SSE `?sse_token=&since_seq=`
- [ ] Contract mismatch → `contract-change` issue in the server repo (never edit `docs/API.md`/`EVENTS.md` yourself)
- **Done:** local e2e apply → link → chat → score → shortlist

## Day 5 — Vercel Deploy + README
- [ ] Vercel env (private): `API_BASE_URL` = Railway URL, `USE_MOCK=false`, `BFF_SHARED_SECRET` (same value as Railway); check SSE CORS, cookie login & deep links
- [ ] Client README (graph view screenshot, how to run mock & real)
- **Done:** full flow works on `https://talentscout.vercel.app`

## Day 6 — Polish & Bug Fixes
- [ ] Loading/empty/error states, mobile applicant pages, basic accessibility (`DESIGN.md`)
- [ ] Bug fixes from staging QA

## Day 7 — Buffer
- [ ] Bug fixes only

## Post-MVP
Create/edit job page + rubric editor, full Playwright suite, dark mode.
