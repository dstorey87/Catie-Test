## Changelog
- **Bug fixes from the v13 live browser check (issue #38).**
- **Adventure progress is no longer lost when two devices sync.** The sync (`mergeSnapshot`) kept the newer copy of each learner's whole record and merged only flags, question by question. A device that had never played Adventure saved a newer record with no stars, and the sync then replaced the stars on the other device. Adventure progress is now joined stage by stage, like flags: the best score, the most stars, passed once passed on either device, the most plays and the latest play. When the server's copy lacks progress this device has, the merged copy is sent back. The rule is one pure function, `TTCoach.mergeAdventure` in `coach.js`.
- **Adventure map, wide screens.** At 768px and wider the 14 world tabs wrapped 13 + 1, and the 14th tab sat alone above the road like a locked stage. They are now on one row: 6px gaps make the row 706px wide, inside the 728px column.
- **Adventure top bar, phones.** With double-digit stars, "Theory Trainer" wrapped onto two lines at 390px, and at 360px the learner's name was cut to "Cat…". The back link now stays on one line. On a phone (480px or narrower) the star pill shows only her stars ("12", not "12 / 210"); the total is still there for screen readers. The world header's "·" no longer dangles at the end of a line: "3 of 7 stages passed" and the stars sit side by side, or one under the other, with no separator.
- **No console errors on app load.** Every load logged 12 errors such as `<line> attribute y1: Expected length, "{{ passLineY }}"`. The browser reads the page before the app fills in its values, so it parsed the two mock charts' template values as numbers. The charts' pass line, label, score line and dots are now made by a pure function, `TTScreen.chartMarks`, and drawn as elements. The drawing is unchanged.
- **Adventure results: "Best run".** A failed stage showed "0 / 7 right first time" next to "Best run: 7 in a row", because the run counted second-chance answers. The in-a-row counter and Best run now count first tries only, like the score. Best run shows only when there is one (2 or more in a row, the same as the counter). A right second chance still earns its 10 XP.
- **How-to guide pictures retaken for v13.** 36 of the 41 pictures in `help/img` were retaken at 390px through `tests/browser/harness.js`, with a seeded example learner (Catie, about two and a half weeks of practice, three mocks, 4 flags, two Adventure stages; Sam for the Family board). They include the four named in #38: `lesson-question.png`, `practise-setup.png` and `road-signs.png` (the old floating notes button covered controls) and `lesson-answered.png` (no ✓ or ✗). The others no longer matched v13 because of:
  - the floating notes button;
  - Home's header (the learner buttons now sit under the app name) and the Adventure card;
  - v13's What's new;
  - darker link colours (#10);
  - the new "Same wrong answer again" filter in My answers;
  - the Adventure top bar (above).

  `age.png`, `setup-date.png`, `setup-remind.png`, `mock-intro.png` and `settings.png` still match v13 and were kept. The alt text, width and height follow each new picture. `home-tiles.png` (390×1068), `lesson-answered.png` (390×966) and `whats-new.png` (390×983) changed height.
- **Guide words.**
  - Adventure mode says the counter and Best run count first tries only.
  - Offline and syncing says Adventure progress is merged stage by stage, keeping the best of both devices.
- **Tests.** 13 new tests, 380 in the suite. Each one failed before its fix:
  - item 1: four for `mergeAdventure`, and three that run the page's real `mergeSnapshot()`;
  - item 2: the tab row's width, from the CSS;
  - item 3: two, for the top bar and the header;
  - item 5: two, for no template value in an SVG geometry attribute, and the chart's marks;
  - item 6: one.

  Three older tests pinned the charts' old SVG markup (`#12 D`, `#10 contrast` for the pass line, and `#32 item 5`). They now check `TTScreen.chartMarks`. The app-files `fakeApp` helper now also lifts `mergeSnapshot()`.
- `Theory Trainer.dc.html`, `coach.js`, `adventure/adventure.js` and `adventure/adventure.css` are in `sw.js` CORE: bump `VERSION` at promotion. `help.html` and `help/` are not in CORE.

## Requirements
- REQUIREMENTS.md line "**Adventure mode**" stays ✅. It gains: progress survives syncing between devices (merged stage by stage), and Best run counts first tries.
- REQUIREMENTS.md line "Automatic sync — pulls on open" stays ✅. Adventure progress is now merged stage by stage instead of newest-copy-wins.
- REQUIREMENTS.md line "Automated tests (the scoring, Leitner…" stays 🟡. Its count becomes 380 tests. "No tests found for … the progress-snapshot sync" becomes: the snapshot merge's Adventure and flag handling is tested through the page's real `mergeSnapshot()`; the Leitner boxes, entitlements and the rest of the snapshot sync (pull/push) still have none.

## Status
- Issue #38, item by item. Each browser check was done on 2026-09-25 through `tests/browser/harness.js`. The before copy was `origin/develop` at 7c207d5 (v13).
  1. **Adventure progress lost across devices.** Fixed.
     - Browser: this device had lessons 1 and 2 passed (4 stars), and the server sent a newer copy with no Adventure progress.
     - Before: the stars were wiped, the Home card said "0 / 210", and the copy pushed back had no stages.
     - After: both stages were kept, the card says "4 / 210, 2 of 5 stages passed", and the pushed copy has both stages. The rest of the newer record still won (its XP).
  2. **Lone world tab.** Fixed. At 1280px and 768px, light and dark, the tabs were 13 + 1 before and are 14 on one row after.
  3. **Crowded top bar.**
     - At 390px, "Theory Trainer" was on two lines before and is on one after.
     - At 360px, the name was 30px of the 42px it needs ("Cat…") before, and is shown in full after.
     - The star pill reads "★ 12" on a phone and "★ 12 / 210" at 768px and up.
     - The header's second line starts with the star, with no dot.
     - No sideways scroll at 1280, 768, 390 or 360px.
  4. **Help pictures.** Retaken: see Changelog. `help.html` was checked at 390px and 1280px, light and dark: all 41 pictures load at their stated size, and no sideways scroll.
  5. **Console errors.**
     - 12 errors on every load before, 0 after, at 390px and 1280px, light and dark.
     - The chart on My Progress and on the admin dashboard is drawn the same as before: the same points, dots, colours, "pass 43" label and screen-reader words.
  6. **Best run.** Fixed. Every first try was wrong and every second chance right, at 390px, light and dark.
     - Before: "0 / 7 right first time · 0%" and "Best run: 7 in a row".
     - After: "0 / 7 right first time · 0%" with no Best run chip.
- How to test: `node --test`. The `#38` tests are in `tests/coach.test.js` ("adventure merge"), `tests/app-files.test.js` and `tests/adventure-page.test.js`.
  - To check syncing by hand: play a stage on one device, open the app on another that has never played Adventure, and both keep the stars.
  - To check the map: open `adventure.html` on a computer, and all 14 world tabs are on one row.
- Left:
  - The example learner's seed and the capture script were throwaway scripts in the session's scratch folder, not in the repo (not verified that a copy exists anywhere else). Retaking the pictures again means writing them again, or adding them to `tools/` (the Tools lane).
  - On the map, the road's rounded top end reaches up into the bottom of the world-tab row, under the middle tabs (seen at 390px, 768px and 1280px). This is unchanged by #38.
  - The "pass 43" label overlaps the last dot when her last mock is near 45. This is unchanged by #38.
