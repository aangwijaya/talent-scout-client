---
name: issue-workflow
description: How to work one node (GitHub issue) in talent-scout-client. Use when starting or finishing a node.
---

# Node workflow (client)

`ops/run` in `aangwijaya/talent-scout` picks the node, prepares the worktree, and posts your handoff. It also pushes, opens the PR, and merges. These commands are denied to you.

1. **Read** `CLAUDE.md`, `docs/LESSONS.md`, the issue, and any handoff in your brief.
2. **SCOPE:** check that what the node depends on really exists. Missing and outside the fence → gap issue, `STATUS: gap`, stop.
3. **RED:** write the tests first and watch them fail. Commit them; don't use temporary routes.
4. **GREEN:** implement inside the fence. Run `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build`, plus the node's `checks`.
5. **Commit** with Conventional Commits, on the worktree's branch.
6. **HANDOFF:** write the file named in your brief, with `STATUS`, `GOAL`, `TRIED`, `KNOWN`, `NEXT`, `NEVER`, and `GAPS` when needed.

If `ops/gate` fails, the next brief holds `EXPECTED / SAW / FENCE / DEAD ENDS`. Fix only that. The same `SAW` twice escalates to a human.
