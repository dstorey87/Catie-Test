## Changelog
- **Accessibility, issue #10 (WCAG 2.2 AA).** Every screen of the app was checked and fixed, for learner and admin, at 390px and 1280px, in light and dark.
- **Answers.** After a practice answer, the right option shows a tick and her wrong pick shows a cross, so right and wrong no longer depend on green and red alone. A screen reader hears the result straight away ("Not quite. The right answer is B: …", in the bank's own words). Each option's name says "Right answer" or "Your answer". The read-aloud button now sits beside the option, not inside it. The two options the 50:50 hint takes away leave the Tab order. In a mock, the chosen option is announced as selected, and so is the flag.
- **Keyboard.** The road-sign tiles, the dashboard's mock-history rows and the editor's question list are now real buttons, so a keyboard can reach them. "Upload a photo", "Import backup" and "Load a question pack" can be reached with Tab. The notes sheet works as a dialog: focus moves into it, Tab stays inside it, Escape closes it, and focus returns to the notes button. On a new screen or question, focus moves to its heading, and the browser tab shows the screen's name ("Mock test review · Theory Trainer").
- **Names and states.** Every form field has a name: the voice list, date boxes, editor boxes, print list, notes box, the password box, and the log-a-mock score boxes. Switches say on or off. Choice buttons (topics, lengths, test types, theme, speed, goal, reminder time and the rest) say which one is picked. The three Text size buttons, which all read "A", now have their own names. Each mock review square says, for example, "Question 7, not answered, flagged". The mock-score chart is described with her real scores. The road-sign picture is named "Road sign picture"; naming the sign would give a question's answer away.
- **Colour contrast, light and dark.** All words now reach at least 4.5:1 against their background. Fixed: faint grey text, grey words on beige chips, status words ("Needs work", "% ready"), white letters on the green and red answer squares, dark words on the amber buttons in dark mode, the greys in the print preview, amber topic labels, and the explanation's read-aloud icon in dark mode. The off state of switches, the flagged-square border and the chart's pass line now reach 3:1 against what is around them.
- **Narrow screens.** Four rows no longer run off a 320px screen: the Home header, the My Progress readiness card, the mock results topic bars, and the mock question header when flagged.
- **Colour map (`TT_DARK`).** `bg-d8d0bf` became `bg-8c8779` (a switch's off track). Added `fg-686458` (grey words on a chip). Removed six colours nothing uses any more: `fg-8a6a22`, `fg-c9c2b2`, `fg-c77e14`, `fg-888`, `fg-999`, `fg-aaa`. `fg-b5ae9e` stays, for decoration only, because `help/site.css` copies it.
- **Tests.** 19 new tests in `tests/app-files.test.js`, 325 in the suite. Each of the 19 fails on develop as it was at v12 and passes here. They check: language and title; one heading per screen; every button, field and picture has a name; keyboard reach; no control nested inside another; switch and choice states; the answer marks and spoken result; the notes dialog; focus ring and reduced motion; contrast of every text/background pair in both themes, worked out from `TT_DARK`; 3:1 for switch tracks and borders; and the four reflow rows.
- `Theory Trainer.dc.html` and `signs.js` are both in `sw.js` CORE, so bump `VERSION` at promotion.

## Requirements
- REQUIREMENTS.md line "Accessibility audit against WCAG 2.2 AA" → 🟡. The app has been audited and every automated and scripted failure is fixed (see Audit below). Still open: a check by a person using a real screen reader (VoiceOver, TalkBack or NVDA; not done), the five findings on the standalone pages (Pages lane, listed below), and small overflows at 320px with the app's biggest text size.
- REQUIREMENTS.md line "Automated tests (the scoring, Leitner…" stays 🟡. Its count becomes 325 tests.

## Status
- Accessibility: every app screen passes axe-core's WCAG 2.0, 2.1 and 2.2 A/AA rules (and its best-practice rules) at 390px and 1280px, light and dark, for learner and admin. It can be used by keyboard alone. To test: `node --test tests/app-files.test.js` (the `#10` tests). In a browser: switch the phone or computer to dark mode or reduce motion, or press Tab through a practice session and a mock.
- CLAUDE.md "Codebase gotchas", answer options line: at promotion, change "(they contain a read-aloud button)" to "(their read-aloud button sits beside them, not inside)". Finding them by name, `getByRole('button', {name: /^Answer A:/})`, still works.
- What's left: see "What remains" below.

## Audit (issue #10)
**How.** axe-core 4.13.0 (from npm into a temp folder, not the repo), run through `tests/browser/harness.js` on 34 app states: 26 as the learner, including hint used, answered, a flagged mock question, the review grid and the notes sheet; 8 as the admin, including the print preview. Each ran at 390px and 1280px, light and dark: 136 checks with the WCAG 2.0, 2.1 and 2.2 A/AA rules plus best-practice. The same scripts also measured controls under 24px and sideways scrolling. The keyboard walk, focus, reduced motion and zoom checks were scripted in the same browser, and the screenshots were looked at.

**Before, on develop at v12 (measured the same way): 10 rules failed.** The counts are failing elements added up over all 136 checks, so one element on many screens counts many times. 394 with low text contrast (light and dark). No page title and no `lang` on every screen. No main landmark or level-one heading. A read-aloud button nested inside each answer option (80). `aria-label` on the road-sign picture's plain `div` (92). A date box and three drop-down lists with no name (24). Content outside landmarks (2,604).

**After: 0 violations** in all 136 checks, and no page errors. Also 0 at 320px (light and dark), at 640px (light and dark), and at 390px with the app's biggest text size.

**Checks axe cannot do:**
- **Keyboard only.** A practice session (setup, answer with Enter and Space, hint, notes, stop) and a mock (choose, flag, next, review, jump from a square, end), using Tab, Shift+Tab, Enter, Space and Escape. 28 checks, all passing, at 390px and 1280px in light and dark.
- **Focus visible and not hidden (2.4.7, 2.4.11).** Checked at every Tab stop: a 3px ring shows, and nothing covers the control.
- **Focus order (2.4.3).** A new screen or question puts focus on its heading. Closing the notes returns focus to the notes button.
- **Target size (2.5.8).** Nothing is under 24px at 390px or 1280px. At 320px the 50 review squares are 22px, but their centres are 29px apart, which meets the spacing exception; axe's target-size rule passes them.
- **Reduced motion (2.3.3).** With the device set to reduce motion, the longest animation drops from 250ms to 0.01ms and the longest transition from 300ms to 0.01ms.
- **Text resize and reflow (1.4.4, 1.4.10).** At 640px (a 1280px window at 200% zoom) and 320px (400%), no screen scrolls sideways, except the A4 print preview, which the rule allows because it is two-dimensional. At 390px with the app's biggest text: none.
- **Dark-palette contrast.** Every text/background pair written in the page is checked in both themes by a test, and axe checked dark mode on every screen.

**Judgement calls:**
- **Mock time limit (2.2.1).** "Like the real test" and "Surprise mix" keep the 57-minute limit, because matching the real test's timing is the point of those mocks. "Build your own" and tests made from My answers have a "Timer for tests" switch that turns the limit off.
- **Road-sign picture name (1.1.1).** It says what the picture is, not what the sign means, because on a question the meaning is the answer. WCAG allows this for a test.
- **Mock's chosen option (1.4.1).** It is shown by a dark filled letter against a pale one, a difference in lightness rather than hue alone, and it is announced as selected.
- **Items axe could not decide.** Icon-only buttons, numbers drawn over the readiness ring, the lettering inside the road-sign pictures, and text under the floating notes button in full-page scans. These were checked by hand and by the contrast test.

**What remains:**
1. **Screen reader.** No person has used the app with VoiceOver, TalkBack or NVDA. Not verified.
2. **Standalone pages (Pages lane, not changed here; read-only axe run).**
   - `help.html`: "Tip:" in teal on the pale teal panel (4.44:1, 20 places, light mode).
   - `help.html`: contents-group labels in `--faint` `#B5AE9E` (2.2:1 light, 4.0:1 dark).
   - `help.html`: the `.hero` block sits outside any landmark.
   - `legal/cookies.html`: `<code>` in muted grey on the chip colour (4.47:1).
   - `adventure.html` (merged during this section): no axe failures, but on its "Open the app first" screen an SVG drawing runs 46px past the right edge at 390px and 1280px, so the page scrolls sideways (1.4.10). Only that screen was checked; its route screens need the app's saved data.
   - `about.html` and the other legal pages pass.
3. **320px with the app's own biggest text (1.25×).** Some screens scroll sideways slightly: Road signs 14px, Mock test intro 12px, Practise setup 7px, Question editor 6px, Settings 2px, My Progress and the dashboard 1px. This is past WCAG's 320px benchmark, which uses browser zoom (that passes).
4. **Flagged and answered mock square.** On screen it shows only the flag; its spoken name says both.
