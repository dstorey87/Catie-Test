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
- Each agent works in its OWN sibling folder, `Catie-Test-wt-<name>`
  (`git worktree add ../Catie-Test-wt-<name> -b section/<name> origin/develop`).
- Work ONLY inside your own worktree. Never edit files in another worktree or the hub.

## Before starting a section
1. Your section has a GitHub issue (`gh issue list --repo dstorey87/Catie-Test`). Comment
   "started in Catie-Test-wt-<name>" on it — that is the claim (STATUS.md is not edited on
   section branches; everyone editing it at once is how merges collide).
2. Check the lane table below. Only touch files your lane owns. If you need a file another
   running section owns, stop and say so in your issue.

## File-ownership lanes (two sections may run in parallel ONLY if their lanes share no files)
| Lane | Files | Parallel-safe? |
|---|---|---|
| Platform/PWA | `sw.js`, `manifest.json`, `index.html`, `icon*.png`, `capacitor/`, `.github/` | yes |
| Backend | `supabase/`, `backend.js`, `config.js`, `tests/backend.test.js` | yes — the only lane that changes the live Supabase project |
| Coach logic | `coach.js`, `picker.js`, `tests/coach.test.js`, `tests/picker.test.js` | yes (pure functions, no screens) |
| App/UI | `Theory Trainer.dc.html`, `support.js`, `signs.js`, `tests/app-files.test.js` | **serialized — only ever ONE agent** |
| Pages | new standalone pages (`help.html`, `legal/`, `about.html`) and their assets | yes, one agent per page |
| Tools | `tools/` | yes |
| Docs/data | `*.md`, `questions-*.json` | promotion only — sections write `changes/<branch>.md` instead |

Nobody edits `CHANGELOG.md`, `STATUS.md` or `REQUIREMENTS.md` on a section branch: write your
fragment in `changes/` (see `changes/README.md`). Nobody bumps `sw.js` VERSION on a section
branch: that happens once, at promotion.

## While working
- Commit at every stopping point; small commits. Push your branch (`git push -u origin
  section/<name>`). Pages only deploys `main`, so pushing any other branch is always safe.
- Local web server for browser checks: `python -m http.server <your port> --bind 127.0.0.1`
  from your worktree. Use the port your task gives you (8781–8799). **Never 8765** — another
  app on this PC owns it. Browser checks use `tests/browser/harness.js` (fake signed-in
  server), at 390px and 1280px, light and dark, before a PR is opened.

## Codebase gotchas
- **Never put inline `<script>` with camelCase identifiers inside `<helmet>`** in
  `Theory Trainer.dc.html`: the dc compiler's attribute-preservation pass rewrites
  camelCase tokens in helmet content (`ttHadSW` → `sc-camel-tt-had-s-w`), corrupting
  the copy it re-mounts into `document.head` (SyntaxError on every load). Inline
  scripts go in the real `<head>` before `</head>`.
- **Never put a `<script src>` inside `<helmet>` either**: the browser runs it while
  reading the page, then the re-mount runs it a SECOND time. A second `backend.js`
  replaced `TTAuth` mid-sign-in and showed the admin the paywall (issue #42). Every
  script goes in the real `<head>`; helmet is for meta and link tags only
  (`tests/app-files.test.js` checks it).
- **Bump `VERSION` in `sw.js`** in any deploy that changes a file in its CORE list —
  the cache name is the only update signal existing installs get. In the same change,
  rewrite `TTWelcome.NEWS` (top of `Theory Trainer.dc.html`, the What's new card's words)
  for the new VERSION: `node --test` fails until you do.
- **This app's `componentDidUpdate` gets no previous state** (`support.js` passes only
  previous props). Compare against a copy you keep yourself (see `this._seen`).
- **Only questions and answers from the bank** (Darren's standing rule, REQUIREMENTS.md top).
  Nothing may invent a question, answer or fact. AI text (memory tips) is drafted from the
  question's own words, machine-checked, and shown only once the admin approves it.
- Answer options are `div role="button"` (their read-aloud button sits beside them, not inside): find them in
  browser checks by name, `getByRole('button', {name: /^Answer A:/})`.
- The `?paid=1` Stripe return URL and the `%20` in `Theory%20Trainer.dc.html` are
  load-bearing: edge functions allowlist `origin + pathname` and must keep the `%20`.

## Merging (from your worktree) — by pull request
1. `git fetch origin && git rebase origin/develop`; re-run `node --test` and your browser check.
2. `gh pr create --repo dstorey87/Catie-Test --base develop` with "Closes #<issue>" in the body.
3. Merge ONLY on a seen pass of the `tests` check: from `C:\Projects\PassiveApps\everyday-im-hustling`
   run `python scripts/pr-gate.py <PR> --repo dstorey87/Catie-Test`. It polls until the
   check exists and has finished. Then `gh pr merge <PR> --repo dstorey87/Catie-Test --merge`.
4. Never resolve a conflict by discarding the other side's change — if a rebase conflicts
   in a file your lane doesn't own, stop and say so on the issue.
5. `main` (the live site) is promoted from `develop` by the hub only.
