## Changelog
- Road Signs now has every sign, road marking, light signal and vehicle marking in The Highway Code: 205 official pictures, each with the Highway Code's caption under it word for word (only markdown `**` removed). They are in the pages' own order, under their own headings: Signs giving orders, Warning signs, Direction signs, Information signs, Road work signs, Road markings (with its five sub-headings), Light signals controlling traffic, and Vehicle markings. A last group, "More signs from the Department for Transport", holds the 7 #44 pictures that have no Highway Code twin (the 20, 30 and 50 limits, school children, ford, speed camera, tourist sign).
- Category buttons at the top of Road Signs show how many pictures each has and jump straight to it. "Back to the categories" under each section jumps back up. Pictures load only as they near the screen.
- **Quiz me on all signs** (20 at random) and **Quiz me on this category** (up to 20). Each question shows one official picture and asks "What does this sign / road marking / light signal / vehicle marking mean?". The right answer is its caption. The three wrong answers are other captions from the same category (from the sub-category when it has three that fit), never one that repeats, holds or sits inside the right answer's words. A picture of several signs at once (2 of them) is never a quiz picture.
- Sign answers count toward today's goal, the streak and XP, like practice, and are logged as `answer` events (`src: 'signs'`). They get no Leitner box, no topic, no Tricky?/Flag and no "More like this". Today's lesson, stuck detection, My answers, Flagged, Focus Drill, readiness, the pass prediction and the topic badges never see them (their ids are `sign:<key>`).
- Adventure: 8 sign worlds after the 14 topic worlds (worlds 15 to 22, one per category, 37 stages: 8, 8, 4, 4, 3, 5, 3, 2). They are a road of their own, whose first stage is open from the start. Lessons, checkpoint, 80% pass mark, stars and replays are as in a topic world. Sign questions have no Flag. The world buttons are two rows, topics and "Signs". Saved topic-world progress is untouched (tested with a v16 record).
- Offline: sw.js EXTRAS now lists exactly the 30 pictures bank questions show. The other 182 are kept by the service worker the first time each is seen (no precaching of 200+ pictures).
- One credit line for all the pictures (Crown copyright, Department for Transport and The Highway Code, Open Government Licence v3.0) on Road Signs, about and help.
- The question editor's "Sign image" list has all 212 pictures, named by their official meaning.
- help.html: the Road signs and Adventure sections are rewritten, and both pictures are retaken.

## Requirements
- REQUIREMENTS.md line "Road signs with spoken meanings, sign learning screen, signs quiz" → ✅ (every Highway Code sign, marking, light signal and vehicle marking with its caption, by category, a per-category and an all-signs quiz, and sign worlds in Adventure; the photographs of people in the two signals pages are left out pending a decision)
- REQUIREMENTS.md line "**Road signs**: 37 official pictures since v16 (#44)" → 🟡 212 official pictures (205 Highway Code, 7 DfT). Still left: the two signals pages (arm signals, police and other authorised persons) are photographs of people, left out until decided; 30 Highway Code pictures whose caption is not a meaning are not shown (list below)
- REQUIREMENTS.md line "**Adventure mode**" → still ✅; add "(#48): 8 sign worlds, one per Highway Code category, their own road, open from the start"

## Status
- Road Signs: 212 official pictures by the Highway Code's headings, with jump buttons, per-category and all-signs quizzes (sign questions: official picture, official caption as the answer, 3 other captions from the same category). Sign answers count toward goal, streak and XP; the bank's coach never sees them.
- Adventure: 22 worlds. The 14 topics, then 8 sign worlds on their own road (open from the start).
- signs.js is the one map (212 entries). tests/data/highway-code-catalogue.json is the researched catalogue with every left-out entry and why; tests/signs.test.js checks every caption against it word for word.
- Pictures: signs/ holds 212 JPEGs, 3.81 MB (3,810,884 bytes). The 175 new ones are 3.08 MB (3,083,877 bytes), at most 360 px, quality 80. The largest is 65,509 bytes (information-sign-motorway-service.jpg).
- Tests: 436 (was 422).
- Left: the two signals pages (photographs of people, not decided); the 30 not-a-meaning pictures (below); a check with a real screen reader (not verified).

## Left out of the catalogue (56 of 261; `#` = its place in page order, from 0)
- Lead decisions: #27 `sign-giving-order-red-route` (the caption says "during period indicated", the picture says "at any time"); #78 `warning-sign-school-crossing-patrol-ahead` (the official page shows the wrong picture, byte-for-byte #4's); #133 `information-sign-entrance-congestion-zone` (Transport for London roundel: logos are not under the OGL); #164 `road-work-sign-end-road-works` (National Highways logo).
- Photographs of people, possible personal data, not decided (lead decision). Signals to other road users: #235 to #245. Signals by authorised persons: #246 to #260.
- The caption is not a meaning: #62 "Plate below some signs", #99 "Worded warning sign", #223 "Left - Central - Right", #224 "The panel illustrated is for flammable liquid…".
- The caption says where a sign is used, not what it means ("On approaches to junctions", "At the junction", …): #102, #103, #107, #108, #110, #111, #114, #115, #116.
- The caption is only a rule reference: #180 "See Rule 130", #203 "See Rule 243", #204 "See Rule 141".
- No caption of its own (an upright sign shown before the marking whose caption covers both): #184, #186, #188, #190, #192, #194, #196, #198.
- One picture of several signs with no single meaning: #83 (headroom on a bridge arch), #222 (lane control signals).
- Every one, with its GOV.UK file name and reason: `tests/data/highway-code-catalogue.json` → `leftOut`.

## Merged with an existing key (30)
- The same sign as a #44 entry (same DfT diagram and the same picture, checked side by side, or the same GOV.UK file). Each is one entry with the old key and file, and the Highway Code caption as its meaning: stop, giveWay, noEntry, noOvertaking, natLimit, minSpeed, turnLeft, cyclesOnly, clearway, bendLeft, roadNarrows, trafficLights, zebra, slippery, levelCrossing, oneWay, motorway, roadWorks, lightRed, lightRedAmber, lightGreen, lightAmber, levelCrossingLights, redX, motorwayAdvised, motorwayLimit, centreLine, doubleWhite, doubleYellow, boxJunction.
- Not merged (7): speed20, speed30 and speed50 (the Highway Code's "Maximum speed" shows 40: a different picture), schoolAhead (545: not in the Highway Code), ford (its twin #99 is left out), speedCamera (880 ≠ 879), tourist ("Model village" ≠ the Highway Code's "Zoo"). They keep the DfT's words and have no quiz.

## Assumptions (proceeded and logged; each cheap to reverse)
- **Road markings are one category**, with its five headings as sub-categories, not five categories. "On the kerb or at the edge of the carriageway" has only 3 pictures, so its questions could not take 3 wrong answers from their own category, and its Adventure world would be a single lesson. So: 8 categories, 8 quizzes, 8 sign worlds.
- **Sign worlds are their own road, open from the start**, rather than locked until all 14 topic worlds are passed. Otherwise they would be out of reach for months. Reverse: drop `track` from the sign worlds in coach.js.
- **A wrong answer never holds or sits inside the right answer's words.** For example, "Road works" is never offered for "Road works 1 mile ahead", because both would be right. This rule is on top of the lead's same-category rule.
- **A sign's question is the same every time.** Its wrong answers are chosen by a seed from its key, like a bank question's fixed options. The app and Adventure then show them in their own order.
- **No new alt text written.** The 175 new pictures have no description of their own, so their `alt` is "Road sign picture", the same as the picture's spoken name. The meaning is the answer, so it is never used as the alt.
- **Merged entries keep their #44 picture.** The bank's questions look exactly as before. The DfT description is replaced by the Highway Code caption. `name` (#44's short titles, not official words) is gone: tiles and the editor show the official meaning.
- **Captions ending "See Rule 127" and the like are kept word for word** (the research counted them usable). The two traffic-light captions with a double space keep it; a browser shows it as one.
- **#146 "Variable speed limit with camera enforcement sign." is a PNG with see-through parts.** It is laid on white (the card it is shown on) to become a JPEG. Nothing else about any picture is changed.
- **Free-sample learners get the sign worlds and sign quizzes in full.** They are public Highway Code material, not the paid bank.
- **Readiness leaves sign answers out** (it is about the bank). The badges count them as questions answered, but not as a DVSA topic.
- Not checked: 320 px with the biggest text size (not verified); a real screen reader (not verified).
