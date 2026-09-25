# Changelog fragments

Several agents work at once, so nobody edits `CHANGELOG.md`, `STATUS.md` or
`REQUIREMENTS.md` directly on a section branch — they would collide on every merge.
Instead each section branch adds ONE file here, `changes/<branch-name>.md`:

```markdown
## Changelog
- what changed, in plain English, one bullet per behaviour

## Requirements
- REQUIREMENTS.md line "<first words of the line>" → ✅ / 🟡 (and why)

## Status
- lines for STATUS.md (what exists, how to use it, what's left)
```

At promotion (develop → main) the fragments are folded into `CHANGELOG.md`, `STATUS.md`
and `REQUIREMENTS.md` under the new `sw.js` VERSION, and deleted.
