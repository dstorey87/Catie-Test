# Working rules — parallel agents on this repo

Multiple Claude Code sessions work this repo at once, each in its own git worktree.
These rules keep them from destroying each other's work. Follow them in every session.

## Branch model
- `main` — **the live site.** GitHub Pages serves the root of `main`, so merging to
  main IS deploying. Never commit to it directly. Never merge to it except a verified
  `develop` promotion, done from the hub folder (`Catie-Test`) with the user's go-ahead.
- `develop` — integration buffer. All section branches merge here first.
- `section/<name>` — one section of the plan, one worktree, one agent.
- `origin/uplaod` — stale early snapshot. Never merge it, never delete it without asking.

## Worktrees
- Hub: `Catie-Test` (stays on `develop`/`main`; merges and promotes).
- Slots: `Catie-Test-wt-a` and `Catie-Test-wt-b` (siblings of the hub folder).
- Work ONLY inside the worktree folder your session was opened in. Never edit files in
  another worktree or the hub.
- When your section merges, reuse your slot: `git switch -c section/<next> develop`.

## Before starting a section
1. Open `STATUS.md` → "Work sections" table. Claim your section: set status to
   `in progress @ wt-a` (or `wt-b`) and commit that claim first, on your section branch.
2. Check the lane table below. If any active section shares a file with yours, STOP and
   tell the user — do not start.

## File-ownership lanes (two sections may run in parallel ONLY if their lanes share no files)
| Lane | Files | Parallel-safe? |
|---|---|---|
| Platform/PWA | `sw.js`, `manifest.json`, `index.html`, `icon*.png`, `capacitor/` | yes |
| Backend | `supabase/`, `backend.js`, `config.js` | yes |
| App/UI | `Theory Trainer.dc.html`, `support.js`, `signs.js` | **serialized — only ever ONE agent** |
| Docs/data | `*.md`, `questions-*.json` | yes |

## While working
- Commit at every stopping point; small commits. Push your section branch to origin as
  backup (`git push -u origin section/<name>`). Pages only deploys `main`, so pushing
  any other branch is always safe.

## Codebase gotchas
- **Never put inline `<script>` with camelCase identifiers inside `<helmet>`** in
  `Theory Trainer.dc.html`: the dc compiler's attribute-preservation pass rewrites
  camelCase tokens in helmet content (`ttHadSW` → `sc-camel-tt-had-s-w`), corrupting
  the copy it re-mounts into `document.head` (SyntaxError on every load). Inline
  scripts go in the real `<head>` before `</head>`; helmet is for meta/link/src-scripts.
- **Bump `VERSION` in `sw.js`** in any deploy that changes a file in its CORE list —
  the cache name is the only update signal existing installs get.
- The `?paid=1` Stripe return URL and the `%20` in `Theory%20Trainer.dc.html` are
  load-bearing: edge functions allowlist `origin + pathname` and must keep the `%20`.

## Merging (from your worktree)
1. `git fetch origin` then rebase your section branch on `develop`.
2. Re-verify your change still works after the rebase.
3. Merge into `develop` (fast-forward or `--no-ff`), push `develop`.
4. Update your row in the "Work sections" table to `merged to develop`.
Never resolve a conflict by discarding the other side's change — if a rebase conflicts
in a file your lane doesn't own, stop and tell the user.
