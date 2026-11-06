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
