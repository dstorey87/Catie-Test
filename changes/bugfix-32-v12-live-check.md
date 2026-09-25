## Changelog
- **Bug fixes from the v12 live browser check (issue #32), and the help and legal page findings the accessibility audit (#10) handed over.**
- **The notes button never covers anything.** On a phone (any window narrower than the page plus room for the button beside it) and on every question, the **My notes** button is now in the page, at the bottom of the screen under everything else. On a wide screen, such as a computer, it still floats in the bottom-right corner, but only in the empty space beside the page. On v12 at 390px it covered Reduce motion as Settings opened, Start the test, a Practise topic, a My answers row, Home's cards and the Home button after a session. The width it needs grows with the app's text size (868px, 973px or 1,085px for the three sizes). Turning a tablet, resizing a window or changing the text size moves it straight away. The three copies of the in-page button became one (`TTScreen.PAGE`, `TTScreen.floatMin`, `wideScreen(zoom)`).
- **My Progress wording.** "so 1 more right answers gets you there" now says "1 more right answer gets you there" (and "3 more right answers get you there"). The same line said "/50" and "the pass mark is 43" after a shorter mock (Build your own, or a test from My answers). It now uses that mock's own size and pass mark: 12 out of 20 needs 18, so "6 more right answers". Scoring and this line now share one pass-mark rule (`TTScreen.passMark`). The readiness dial said "Based on her mocks…" on the learner's own screen. It now says "your", and so do two other lines found the same way: Practise's "shaped by your mock results" and the no-voices notice ("On an iPad or iPhone").
- **The mock chart** (My Progress and the dashboard) starts a little under her lowest score instead of at 0, so the scores no longer bunch at the top. It shows at least 30 to 50, so the pass line always shows. A line under it gives the range, for example "The chart runs from 30 to 50." (`TTScreen.chartFloor`, `TTScreen.chartScale`).
- **Today's lesson for a brand-new learner** says "Your first 20 questions, to get you started", not "Built from your answers: 20 new" (`TTScreen.lessonDesc`).
- **After a wrong answer, the memory tip and "Explain it differently" boxes** use the answer card's full width. Before, they were squeezed into the narrow column beside the read-aloud button.
- **Help and legal pages (from #10's audit).** axe-core now finds nothing on `help.html`, the four legal pages, `about.html` or `adventure.html` at 390px and 1280px, in light and dark mode. What was fixed:
  - The first bold words of each teal panel ("Tip:" and the rest), links on those panels and the section numbers were 4.44:1. They now use a new darker teal token, `--on-tint` (the app's `fg-0a5d50`).
  - The contents group labels were `--faint` at 2.2:1. They now use `--muted`. `--faint` is now for decoration only.
  - `<code>` and path chips now set their own text colour. On the cookies page, a chip inside grey text had been 4.47:1.
  - On `help.html`, the page title and introduction are now inside `<main>`, as on `about.html`, so the skip link lands on the title.
  - On `adventure.html`, the "Open the app first" car no longer runs 46px off the right edge.
- **The legal pages at 1280px** are one centred reading column (`.wrap.reading`), with header, notice and footer lined up. They used to leave 424px empty on the right.
- **Guide (`help.html`).** The Notes section says where the button is on a phone and on a wide screen. Today's lesson says that a first lesson is all new questions and what its line says. My Progress describes the chart's scale. `help/img/settings.png` and `help/img/mock-intro.png` are retaken: both showed the old button covering Reduce motion and Start the test.
- **Tests.** 12 new tests, 366 in the suite. Items 1 and 2 were already fixed by #10: their two tests pass on develop and fail on v12 (`main`). The other ten failed on develop before their fixes. They cover:
  - the notes button: where it floats, at every text size, and that there is one of it;
  - the pass mark and the last-mock sentence;
  - "your", not "her";
  - the chart's floor and scale;
  - the first-lesson line;
  - the tip boxes' width;
  - the page contrast pairs, in all three colour blocks;
  - `.hero` inside `<main>`;
  - the legal reading frame;
  - the guide's Notes words;
  - the Adventure car.

  Two older tests changed with the notes button: #12 C now checks that the one button comes after each question screen's Next row, and #10's notes-dialog test expects one button, not four. The WCAG contrast sum is now in one shared file, `tests/contrast.js`.
- `Theory Trainer.dc.html` is in `sw.js` CORE: bump `VERSION` at promotion. `help.html`, `help/`, `legal/` and `adventure/` are not in CORE.

## Requirements
- REQUIREMENTS.md line "Accessibility audit against WCAG 2.2 AA" → 🟡 (with #10's fragment).
  - Now fixed: all of #10's standalone-page findings, and the notes button covering controls on phones (2.4.11 Focus not obscured, and plain use).
  - Still open: a check by a person using a real screen reader (not done), and small sideways overflows at 320px with the app's biggest text size (from #10, unchanged).
- REQUIREMENTS.md line "Notes on any screen, question flagging, revision list" stays ✅. The notes button moved (see Changelog). It still appears on every screen except sign-in and the quick setup.
- REQUIREMENTS.md line "Automated tests (the scoring, Leitner…" stays 🟡. Its count becomes 366 tests.

## Status
- Issue #32, item by item. Every check below was done on 2026-09-25 through `tests/browser/harness.js`, at 390px and 1280px, in light and dark mode.
  1. **Dark-mode speaker button on the wrong-answer card.** Already fixed on develop by #10. Checked in the browser: the icon is 13.6:1 on its circle in dark mode (1.47:1 on v12) and 13.9:1 in light mode. A new test pins it.
  2. **Settings: Voice list and "My theory test date" had no name.** Already fixed on develop by #10. Checked in the browser: `getByRole('combobox', {name: 'Voice'})` and `getByRole('textbox', {name: 'My theory test date'})` each find exactly one field. A new test pins it.
  3. **Notes button covering controls at 390px.** Fixed. Before the fix, 9 screens had controls covered as they opened, and more while scrolling. After, at every half-screen step down 14 app states, no control is under the button:
     - Home, Settings, the streak panel, Badges, Practise setup, Flagged, Mock intro, Road Signs, My Progress, Print, a practice question, the end of a session, My answers, and Home after answering.
     - At 390px the button is the last thing on each screen. At 1280px it floats 154px clear of the page.
     - It still fits beside the page at the float width of each text size. Resizing across that width moves it without a reload.
  4. **My Progress wording.** Fixed. The browser shows "Last mock: 42/50. The pass mark is 43, so 1 more right answer gets you there." and "Based on your mocks…".
  5. **Cosmetic.** Fixed:
     - the mock chart scale ("The chart runs from 30 to 50.");
     - the new learner's lesson line ("Your first 20 questions, to get you started");
     - the narrow tip boxes, which are now full card width;
     - the legal pages at 1280px, where the column is centred with 260px each side.
- The #10 page findings, and axe on the app: 0 axe violations (WCAG 2.0/2.1/2.2 A and AA, plus best practice).
  - Standalone pages: 7 pages at 390px and 1280px, light and dark (28 runs). No page scrolls sideways.
  - App: Home, Settings, Mock intro, the wrong-answer card and My Progress with a chart, in the same four combinations.
  - The notes dialog still opens from the one button and gives focus back to it on Escape.
- How to test: `node --test` (the `#32` tests in `tests/app-files.test.js`, `tests/help-pages.test.js` and `tests/adventure-page.test.js`). In a browser, open Settings on a phone: Reduce motion is clear, and **My notes** is at the bottom. On a computer, the round button sits beside the page.
- Left:
  - The other 390px screenshots in `help/img` (Home, My Progress and others) still show the old round notes button in the corner. Recapturing them needs the guide's example learner, whose seeded data is not in the repo (not verified that it exists anywhere). The rest of what those pictures show is unchanged, and the guide's words describe the new placement.
  - `coach.js` works out the scaled pass mark itself (`Math.ceil(total * passMark / mockSize)`). The app's `TTScreen.passMark` does the same sum, so there are two copies. `coach.js` belongs to the Coach lane, so making it use one copy is left to that lane.
  - The chart's "pass 43" label and the dashboard's "Log a mock" pass check (`score>=43`) still use 43 as a fixed number. They are for 50-question mocks, where 43 is correct.
