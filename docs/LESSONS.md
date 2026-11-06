# LESSONS — talent-scout-client

Agent lessons log (learning loop). Add entries **at the top** (newest first) after finishing or blocking an issue, only when there is a real lesson: a surprise, a near-repeated mistake, a technical decision, or a command that behaved differently than expected.

Rules:
- Read this file before starting a new issue.
- The **same lesson appears 2×** → open a separate PR labeled `skill-update` that changes the skill in `.claude/skills/` or the rules in `CLAUDE.md`, then fill the "Follow-up" field of both entries with that PR number.
- Prefer turning a lesson into a **test, lint rule, or CI check** over text.
- Never write secrets, tokens, URLs containing credentials, or applicant personal data.
- A human merges `skill-update` PRs.

## Entry template

```markdown
### YYYY-MM-DD — #<issue> <short title>
- **Context:** what was being worked on
- **Problem:** what went wrong / was surprising
- **Cause:** root cause
- **Lesson:** reusable rule (1 sentence)
- **Follow-up:** none | test/CI check in PR #… | skill-update PR #…
- **Repeated?:** first time | same as entry YYYY-MM-DD
```

## Entries

### 2026-11-07 — #24 Rules that only exist as text don't run
- **Context:** the "docs written for SvelteKit 2" lesson was logged three times, and the required `skill-update` PR was never opened
- **Problem:** the learning rule depended on an agent remembering it, across sessions that remember nothing
- **Cause:** nothing computed the repeat count or scheduled the follow-up
- **Lesson:** enforce a repeated rule with a check, and let `ops/triage` schedule the work
- **Follow-up:** CI check in PR #28
- **Repeated?:** first time

### 2026-11-07 — #13 Kit 3 `handleError` also receives `error()` throws
- **Context:** returning the generic message that `docs/SERVER-SIDE.md` and the issue ask for
- **Problem:** always returning it would have replaced every friendly `error(404, …)`/`error(410, …)` message, and the hook types had moved, so `Handle` no longer imports from `@sveltejs/kit`
- **Cause:** Kit 3 calls the hook for app and framework errors as well, with `{ kind, error, event }` instead of `{ error, event, status, message }`; hook types now live in `@sveltejs/kit/hooks`
- **Lesson:** in `handleError`, return early unless `kind === 'unknown'`; read a framework hook's types in the installed version before following docs written against the previous major
- **Follow-up:** CI check in PR #28
- **Repeated?:** same root cause as 2026-11-06 #1 and #3 (docs written against SvelteKit 2)

### 2026-11-07 — #13 Auth checks that look right but are not enough in Kit
- **Context:** the `/dashboard/*` guard and "never forward the browser's cookies" in `handleFetch`
- **Problem:** `url.pathname.startsWith('/dashboard')` lets `/%64ashboard/jobs` reach a recruiter route, and deleting the `cookie` header in `handleFetch` does not stop the cookie reaching an API on the same hostname (`localhost` in dev)
- **Cause:** Kit matches routes on the decoded path, and its inner `fetch` adds cookies back after `handleFetch` runs, unless `credentials` is `omit`
- **Lesson:** decide route access from `event.route.id`, and send API requests with `credentials: 'omit'`; check security behavior on a running build, because unit tests with a fake `fetch` cannot see either problem
- **Follow-up:** unit tests in `guards.test.ts` and `hooks.server.test.ts`
- **Repeated?:** first time

### 2026-11-06 — #3 A test on random delays passed locally and failed in CI
- **Context:** testing the default 300–800 ms delay of `replayEvents`
- **Problem:** the test failed about 1 run in 30, so it passed before the push and failed on the PR
- **Cause:** it advanced timers by 800 ms with real `Math.random`, and two delays can add up to less than that
- **Lesson:** stub `Math.random` in any test that depends on it, and run a new timing test many times before pushing
- **Follow-up:** none
- **Repeated?:** first time

### 2026-11-06 — #3 SvelteKit 3 replaced `$env/dynamic/private`
- **Context:** reading `API_BASE_URL` and `USE_MOCK` in the server API layer
- **Problem:** `svelte-check` reports "Cannot find module `$env/dynamic/private`", while `CLAUDE.md`, `docs/SERVER-SIDE.md` and the issues all name it
- **Cause:** Kit 3 deprecated `$env/*`; variables are declared with `defineEnvVars` in `src/env.ts` and imported by name from `$app/env/private`
- **Lesson:** add a new env var to `src/env.ts` first, then `import { NAME } from '$app/env/private'`; check issue text that names framework modules against the installed major
- **Follow-up:** CI check and skill fix in PR #28
- **Repeated?:** same root cause as 2026-11-06 #1 (docs written against SvelteKit 2)

### 2026-11-06 — #2 A server contract change turns every client PR red
- **Context:** PR #19 only touched UI, yet its `contract-sync` job failed
- **Problem:** the job compares `docs/` with the server's `main`, so an unrelated PR fails as soon as the server merges a contract change
- **Cause:** the server merged a contract change (`talent-scout-server#22`) and the client copy had not been synced yet
- **Lesson:** when `contract-sync` fails on a PR that does not touch the contract docs, sync them in a separate PR, merge it, then merge `main` into the open branch; never add the `contract-change` label to skip the job
- **Follow-up:** none
- **Repeated?:** first time

### 2026-11-06 — #2 Playwright browsers do not launch on this WSL setup
- **Context:** rendering the base components in a real browser to check them
- **Problem:** `chromium.launch()` fails: the headless shell is not installed, and the full Chromium cannot load `libnspr4`/`libnss3`
- **Cause:** `playwright install` was run without its system dependencies, which need root
- **Lesson:** before relying on `pnpm test:e2e` locally (client #9), run `pnpm exec playwright install --with-deps chromium`; without root, `apt-get download` + `dpkg-deb -x` into a temp dir + `LD_LIBRARY_PATH` + `channel: 'chromium'` is enough for one-off checks
- **Follow-up:** none
- **Repeated?:** first time

### 2026-11-06 — #1 SvelteKit 3 removed `$lib`
- **Context:** scaffolding the app with the latest SvelteKit (3.1.1)
- **Problem:** any `$lib` import fails the build with `module_removed_lib`, while `CLAUDE.md`, `docs/SERVER-SIDE.md`, skills and issues all use `$lib`
- **Cause:** the docs were written against the SvelteKit 2 API; Kit 3 replaced `$lib` with the `#lib` package import
- **Lesson:** keep `$lib` through the official `alias: { $lib: 'src/lib' }` in `vite.config.ts` (typecheck passes, and importing `$lib/server` from browser code still fails the build); check framework majors against the docs before scaffolding
- **Follow-up:** none
- **Repeated?:** first time
