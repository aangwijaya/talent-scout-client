---
name: new-page-with-mock
description: Create a new SvelteKit route in talent-scout-client that runs fully in mock mode (USE_MOCK=true, server-side) with contract types, valid fixtures, and loading/empty/error states. Use when an issue asks for a new page.
---

# New Page with Mock

1. **Contract first.** Find the endpoints & events the page uses in the "Pages" table of `CLAUDE.md`, then the details in `docs/API.md` and `docs/EVENTS.md`. Fields not in the contract → don't guess; create a `contract-change` issue in `aangwijaya/talent-scout-server`.
2. **Types:** use types from `src/lib/server/api/schema.d.ts` (openapi-typescript) / `types.ts`, or `src/lib/events.ts` for SSE. No `any`; keep `snake_case` fields as-is.
3. **API calls:** add a method to the `TalentScoutApi` interface in `src/lib/server/api/types.ts`, implement it in both `real.ts` (Go via `event.fetch` + `API_BASE_URL`) and `mock.ts` (reads `fixtures/`). No `fetch` to Go in components.
4. **Fixtures:** add/change files in `src/lib/server/api/fixtures/` with type annotations so `svelte-check` validates them. For SSE, the browser-side mock in `src/lib/events.ts` replays the sequence in `docs/EVENTS.md` §6 (300–800 ms gaps; `message.delta` per word).
5. **Route (server-load variant, default):** `src/routes/<path>/+page.server.ts` with `load` (and `actions` for forms: zod `safeParse` → `fail(400, …)`) calling `api` from `$lib/server/api`, + `+page.svelte`. Recruiter pages live under `src/routes/dashboard/(recruiter)/` so the layout guard applies (no session → `/dashboard/login?redirectTo=`); a Go 401 → clear the cookie and redirect to login. Never return the token from `load`/actions. Binary/streamed responses (e.g. CV) → `+server.ts`. SSE pages: load returns `{ sseUrl, sse_token, since_seq }` (recruiter) or the path token (applicant); in mock mode it returns a mock flag and the browser replays fixtures.
6. **Required states:** loading, empty, error (message from `error.code`), success. Applicant pages (`/apply`, `/s`) must work well on mobile.
7. **UI:** follow the `use-design-tokens` skill and the page layouts in `DESIGN.md` §4. UI text in English.
8. **Checks:** `pnpm check`, `pnpm lint`, `pnpm build`. Open the page with `USE_MOCK=true pnpm dev` and check manually.

Don't: call Supabase, store tokens in `localStorage`/`sessionStorage` or page data, show scores to applicants, or add new Playwright tests (the MVP has only 1 smoke test, managed in its own issue).
