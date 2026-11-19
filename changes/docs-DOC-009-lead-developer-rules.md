## Changelog
- `CLAUDE.md` gains one paragraph, "Lead developer, among parallel sessions": subagents do the
  reading, research, test runs and reviews; one worktree and branch per ticket; each commit holds
  only your task's files; before every merge, rebase on develop, re-run the tests you touched and
  check `gh pr diff <N> --name-only`. The same rule now sits in every one of Darren's repositories
  (DOC-009, 2026-09-24).

## Requirements
- No REQUIREMENTS.md line changes status: this is a working rule for agents, not app behaviour.

## Status
- Nothing in the app changed; no STATUS.md line needed.
