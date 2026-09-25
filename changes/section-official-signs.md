## Changelog
- **Road signs are the real ones now (#44).** Every sign picture is official Great Britain artwork from GOV.UK, copied unchanged and only scaled down: road signs from the Department for Transport's traffic sign images (by diagram number), road markings and traffic/motorway lights from The Highway Code. The 20 hand-drawn signs are gone (some, like "Start of motorway", did not look like the real sign).
- **37 pictures instead of 20**, all in one map in `signs.js` (`TTSigns.list`: key, file, DfT diagram or Highway Code page, official meaning, source link, alt text). The question pictures, the Road Signs screen, the question editor's "Sign image" list and the signs quiz all read that map.
- **15 more questions show their sign** (the ford sign, 50 limit, clearway, cycles only, turn left, speed camera, brown tourist sign, the motorway 50-advised and variable-limit signals, level-crossing lights, double yellow lines, centre line, road works, level crossing, zebra crossing), and the three traffic-light questions show the light they ask about (amber; green; red and amber) instead of one drawing with all three lit.
- **Pictures that gave the answer away are gone**: "Which shape is the stop sign?" and "Signs on motorways have which background colour?" no longer show the sign. Questions that ask a sign's colour or shape, where coloured studs go, or whose only official picture carries the answer's own words (SCHOOL KEEP CLEAR, the times plate on a single yellow line) have no picture on purpose.
- **Road Signs screen**: a tile per picture with its name and its official meaning (the DfT spreadsheet's description, or the Highway Code's caption), two columns on a phone; tapping reads both out. The Crown copyright / Open Government Licence credit and a link to the licence sit at the bottom.
- **"Quiz me on the signs" asks real bank questions**: up to 20 questions from the bank that have a picture, shuffled. The 20 "What does this sign mean?" questions made up in code, and the "Road-sign quiz" question set in Question packs, are gone (they broke the only-questions-from-the-bank rule). Old answers to those made-up questions no longer show in My answers or the coach.
- The pictures work offline: they are in the service worker's best-effort list (EXTRAS), so they are cached once the next VERSION installs.
- About and Help carry the same credit line; Help's Road signs section describes the new screen.

## Requirements
- REQUIREMENTS.md line "⛔ **Road signs are thin**" → 🟡: 37 official pictures (DfT signs + Highway Code markings and lights), 39 bank questions show one; the real test still covers more signs than the bank asks about.
- REQUIREMENTS.md line "⛔ **No diagrams** for junction-layout or road-marking questions" → 🟡: road-marking questions now show the Highway Code's marking pictures (centre line, double white lines, double yellow lines, box junction); junction layouts still have none.
- Add: "✅ Sign pictures are official GOV.UK artwork (DfT traffic sign images, The Highway Code), credited on Road Signs, About and Help under the Open Government Licence v3.0; a question never shows a picture that gives its answer away (#44)".
- ROADMAP.md item 28 "More road signs": done in part (#44) — cut it to what is left (more sign questions in the bank).

## Status
- Road signs: `signs.js` holds the one map (`TTSigns.list`); pictures in `signs/` (37 JPGs, 727 KB, at most 400 px). To add one: put the file in `signs/`, add an entry to the map, add `./signs/<file>` to `sw.js` EXTRAS; `tests/signs.test.js` fails until all three agree.
- Live bank: `supabase/data/2026-09-25-sign-images.sql` sets `questions.sign` for the 20 changed questions. **Not applied yet** — the lead runs it once on the live project (until then the live app shows the old sign values: the 15 new pictures are missing and t11q03/t11q12 still show theirs; trafficLights shows the DfT "traffic signals ahead" sign).
- Signs quiz: Road Signs → Quiz me on the signs (bank questions with a picture, at most 20).
- Test: `node --test` (tests/signs.test.js).
