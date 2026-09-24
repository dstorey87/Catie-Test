## Changelog
- Question bank checked against current UK rules (issue #20, Darren 2026-09-24: "make sure you
  are using UK answers"). **44 questions corrected**, each found by one agent and confirmed by a
  second, independent one with the official source quoted. Content only: ids, topics and packs
  are unchanged, and none of the 44 is in the free sample (`questions-free.json` is unchanged).
  The same 44 rows were corrected in the live Supabase `questions` table in one transaction,
  then read back: all 378 live rows now match the files exactly.
- Wrong facts fixed in 18 questions (question, options or explanation changed; see the table).
  The other 26 only had the wrong rule reference: it now names the rule or page that actually
  says it. Where the Highway Code does not cover the fact at all (CPR 30:2, defibrillators,
  shock, 101, trailer width, tunnel breakdowns), the reference now names the official page that
  does.
- New test `tests/bank.test.js`: every question has 4 different options and a valid answer
  index, ids are unique and match their topic, all 14 topics are the same size, no rule
  reference is a vague "area"/"note" pointer, the free sample is an exact copy of the bank,
  and one check per corrected question so a wrong fact cannot quietly come back. Run against
  the old bank it fails 45 checks.
- Memory tips and plain explanations for the 44 questions were re-drafted from the corrected
  wording (the old ones were drafted from the wrong text); see Status.

## Corrected questions
HC = the Highway Code on gov.uk. Wrong facts first, then rule references.

| id | What was wrong | Source |
|---|---|---|
| t02q15 | Said a doctor's car shows a **blue** light; it is **green** (and its own explanation already said green). Question, right answer and explanation rewritten. | https://www.legislation.gov.uk/uksi/1989/1796/regulation/27, https://www.legislation.gov.uk/uksi/1989/1796/regulation/11, HC Rule 219 https://www.gov.uk/guidance/the-highway-code/road-users-requiring-extra-care-204-to-225 |
| t02q05 | "At night" is wider than the horn ban, which is 11.30 pm to 7 am; the question now names the hours. | https://www.gov.uk/guidance/the-highway-code/general-rules-techniques-and-advice-for-all-drivers-and-riders-103-to-158 (Rule 112) |
| t01q03 | Explanation said a hand-held phone is illegal "at all times"; Rule 149 has narrow exceptions (999/112 emergency, contactless payment). | https://www.gov.uk/guidance/the-highway-code/general-rules-techniques-and-advice-for-all-drivers-and-riders-103-to-158 (Rule 149) |
| t01q27 | Explanation claimed "most" sleep-related crashes are in the early morning: not verified. Now says what Rule 91 says. | https://www.gov.uk/guidance/the-highway-code/rules-for-drivers-and-motorcyclists-89-to-102 (Rule 91) |
| t05q21 | Question mixed up the legal alcohol limit with safety advice (the legal limit is not zero). Now asks for the safest amount. | https://www.gov.uk/guidance/the-highway-code/rules-for-drivers-and-motorcyclists-89-to-102 (Rule 95) |
| t05q08 | Explanation said drowsy driving "is as dangerous as drink driving": not in any official source read. | https://www.gov.uk/guidance/the-highway-code/rules-for-drivers-and-motorcyclists-89-to-102 (Rule 96) |
| t07q24 | Question ("where do trams stop quickest") did not match its options, and its answer (trams stop more slowly) was not verified. Rebuilt on Rule 305 (standing passengers). | https://www.gov.uk/guidance/the-highway-code/road-works-level-crossings-and-tramways-288-to-307 (Rule 305) |
| t07q10 | Two more options were also right under Rule 301. Rebuilt on Rule 303's absolute rule, with one right answer. | https://www.gov.uk/guidance/the-highway-code/road-works-level-crossings-and-tramways-288-to-307 (Rules 301, 303) |
| t09q12 | Answer said "emergency or breakdown only"; you must also stop when police, traffic officers or signs direct you. | https://www.gov.uk/guidance/the-highway-code/motorways-253-to-273 (Rules 269, 271) |
| t08q16 | Explanation said wet roads "halve your grip": not in the Highway Code. Now: stopping distances at least double. | https://www.gov.uk/guidance/the-highway-code/driving-in-adverse-weather-conditions-226-to-237 (Rule 227) |
| t11q26 | Said a **white** light flashes at a level crossing; it is **twin flashing red** lights. | https://www.gov.uk/guidance/the-highway-code/road-works-level-crossings-and-tramways-288-to-307 (Rule 293) |
| t11q19 | Right answer said "a **sharp** bend"; the triangle is a plain bend sign (sharp bends have chevrons). | https://www.gov.uk/guidance/the-highway-code/traffic-signs |
| t10q11 | Explanation missed passing a stationary vehicle, said "under" 10 mph (it is 10 mph or less) and left out "if safe". | https://www.gov.uk/guidance/the-highway-code/general-rules-techniques-and-advice-for-all-drivers-and-riders-103-to-158 (Rule 129) |
| t12q16 | Said an untaxed car may only be driven **to** a booked MOT; the law also allows driving **from** it, and to/from a booked repair after a fail. | https://www.legislation.gov.uk/ukpga/1994/22/schedule/2/paragraph/22 |
| t12q11 | Explanation said L plates only; in Wales D plates can be used instead. Supervisor rule made exact. | https://www.gov.uk/guidance/the-highway-code/annex-3-motor-vehicle-documentation-and-learner-driver-requirements |
| t12q21 | Same Wales D-plate point. | https://www.gov.uk/guidance/the-highway-code/annex-3-motor-vehicle-documentation-and-learner-driver-requirements |
| t13q14 | Right answer said do not open the bonnet "fully", as if part-way were fine; Annex 6 says do not open it. Ref Rule 280 → Annex 6. | https://www.gov.uk/guidance/the-highway-code/annex-6-vehicle-maintenance-safety-and-security |
| t13q23 | Did not say where the car stopped, so "in the car with belts on" could also be right (Rule 277). Now on the hard shoulder. Ref → Rules 275 and 277. | https://www.gov.uk/guidance/the-highway-code/breakdowns-and-incidents-274-to-287 |
| t01q09 | Ref Rule 171 → **Rule 146** | https://www.gov.uk/guidance/the-highway-code/general-rules-techniques-and-advice-for-all-drivers-and-riders-103-to-158 |
| t02q26 | Ref Rule 213 → **Rule 152** | https://www.gov.uk/guidance/the-highway-code/general-rules-techniques-and-advice-for-all-drivers-and-riders-103-to-158 |
| t06q07 | Ref Rule 213 → **Rule 212** | https://www.gov.uk/guidance/the-highway-code/road-users-requiring-extra-care-204-to-225 |
| t06q14 | Ref Rule 183 → **Rule 182** | https://www.gov.uk/guidance/the-highway-code/using-the-road-159-to-203 |
| t07q25 | Ref "Rule 214 area" → **Rule 206 (see also Rule 225)** | https://www.gov.uk/guidance/the-highway-code/road-users-requiring-extra-care-204-to-225 |
| t07q04 | Ref Rule 300 → **Rule 224 (see also Rule 302)** | https://www.gov.uk/guidance/the-highway-code/road-users-requiring-extra-care-204-to-225 |
| t09q11 | Ref Rule 272 → **Rule 263** | https://www.gov.uk/guidance/the-highway-code/motorways-253-to-273 |
| t09q14 | Ref Rule 275 → **Rule 277** | https://www.gov.uk/guidance/the-highway-code/breakdowns-and-incidents-274-to-287 |
| t09q21 | Ref Rule 277 → **Rule 270** | https://www.gov.uk/guidance/the-highway-code/motorways-253-to-273 |
| t09q27 | Ref "Rule 274 area" → **Rules 273 and 274** | https://www.gov.uk/guidance/the-highway-code/motorways-253-to-273 |
| t08q19 | Ref Rule 153 → **Rule 166 (see also Rule 126)** | https://www.gov.uk/guidance/the-highway-code/using-the-road-159-to-203 |
| t08q13 | Ref Rule 227 → **Rule 237** (the oil-and-rubber cause is not verified from gov.uk; unchanged) | https://www.gov.uk/guidance/the-highway-code/driving-in-adverse-weather-conditions-226-to-237 |
| t07q15 | Ref Rule 164 → **Rule 126** (the "heavier" reason is not verified from gov.uk; unchanged) | https://www.gov.uk/guidance/the-highway-code/general-rules-techniques-and-advice-for-all-drivers-and-riders-103-to-158 |
| t12q06 | Ref "Rule 253 note" → **Annex 3** | https://www.gov.uk/guidance/the-highway-code/annex-3-motor-vehicle-documentation-and-learner-driver-requirements |
| t12q18 | Ref "Rule 253 note" → **Annex 3** | https://www.gov.uk/guidance/the-highway-code/annex-3-motor-vehicle-documentation-and-learner-driver-requirements |
| t11q17 | Ref Rule 129 → **HC: Traffic signs** | https://www.gov.uk/guidance/the-highway-code/traffic-signs |
| t13q07 | Ref Rule 274 → **Rule 276** | https://www.gov.uk/guidance/the-highway-code/breakdowns-and-incidents-274-to-287 |
| t13q26 | Ref Rule 281 → **Rule 283** | https://www.gov.uk/guidance/the-highway-code/breakdowns-and-incidents-274-to-287 |
| t13q22 | Ref "Rule 278 area" → **Annex 6** | https://www.gov.uk/guidance/the-highway-code/annex-6-vehicle-maintenance-safety-and-security |
| t13q15 | Ref "Rule 126 tunnels" → **Traffic Wales tunnel safety guide** (the Highway Code does not cover breaking down in a tunnel; gov.uk "A3 Hindhead tunnel: advice for drivers" says the same) | https://www.gov.uk/guidance/the-highway-code/general-rules-techniques-and-advice-for-all-drivers-and-riders-103-to-158 (Rule 126, searched) |
| t13q21 | Ref "Rule 286 area" → **gov.uk: Contact the police** (101) | https://www.gov.uk/contact-police |
| t13q03 | Ref Annex 7 → **St John Ambulance CPR guide** (Annex 7 has no rescue breaths or 30:2) | https://www.gov.uk/guidance/the-highway-code/annex-7-first-aid-on-the-road (searched) |
| t13q05 | Ref Annex 7 → **St John Ambulance: how to use a defibrillator** (the Highway Code never mentions one) | https://www.gov.uk/guidance/the-highway-code/annex-7-first-aid-on-the-road (searched) |
| t13q27 | Ref Annex 7 → **St John Ambulance: shock** (Annex 7 never describes shock) | https://www.gov.uk/guidance/the-highway-code/annex-7-first-aid-on-the-road (searched) |
| t14q17 | Ref Rule 98 → **gov.uk: Towing with a car** (2.55 metres) | https://www.gov.uk/towing-with-car/print |
| t14q08 | Ref Rule 98 → **Annex 6** | https://www.gov.uk/guidance/the-highway-code/annex-6-vehicle-maintenance-safety-and-security |

t02q15 had four confirmed findings with different wording. The first one is applied in full
(question, right answer, explanation): it is the only one that also checked regulation 27, which
lets a green beacon be lit only while a registered doctor is in the car **and it is used for an
emergency**, so its "emergency call" wording is backed by law. The other three agreed on
blue → green, and objected only that "emergency" was not verified. Regulation 27 and Rule 219
were re-read on 2026-09-24 to confirm.

## Requirements
- REQUIREMENTS.md line "✅ 378 original questions, 14 DVSA topics…" stays ✅; add: "checked
  against current UK rules 2026-09-24 (issue #20): 44 corrected, each with its source;
  `tests/bank.test.js` guards the shape and each corrected fact".
- Standing rule line "only questions and answers that are in the bank" holds: this corrects the
  bank's own questions, it adds none.

## Status
- ✅ Question bank checked for UK rules (issue #20): 44 questions corrected in
  `questions-1..5.json` and in the live Supabase `questions` table (read back: all 378 rows match
  the files). List with sources: `changes/section-bank-uk.md` (fold into CHANGELOG at promotion).
  Test: `node --test` (`tests/bank.test.js`).
- The t02q15 bank bug from `changes/section-plain-explanations-tool.md` ("do not approve AI text
  for t02q15 until the bank is fixed") is **fixed**: the question now says green, and its memory
  tip and plain explanation were re-drafted from the corrected text.
- AI text for the 44 corrected questions, re-drafted 2026-09-24 (local qwen3:14b) from the
  corrected wording:
  - **Memory tips: 44 of 44 re-drafted and passing every check**, loaded into the live
    `questions.memory_tip` with `tip_status = 'draft'` (read back: all 44 match the file). They
    show to a learner only after Darren approves them. t13q03's old tip had been rejected in
    Admin; its new tip is a fresh draft.
  - **Plain explanations: 44 of 44 re-drafted and passing every check.** Nothing to load: the
    live `plain_explanation` column is still empty for every question (checked).
  - Review these first. They passed the machine checks but say something not in the question, so
    reject them: t13q03 tip ("30 compressions as a full minute": invented timing), t01q03 tip
    ("use hands-free": not in the question), t11q17 tip ("just like a stop sign"), t13q26 plain
    explanation (a bike with hazard lights).
  - The finished files are in this worktree, not in git:
    `Catie-Test-wt-bank-uk/tools/out/memory-tips.json` (372 of 378 drafted; rejected by the checks:
    t02q13, t02q24, t03q16, t04q01, t05q19, t09q24) and
    `Catie-Test-wt-bank-uk/tools/out/plain-explanations.json` (377 of 378; rejected: t09q24). They
    replace the copies in `Catie-Test-wt-b` and `Catie-Test-wt-plain-explanations-tool`. Copy them
    to the hub's `tools/out/` before this worktree is removed.
- Found while doing this, not changed (outside issue #20's confirmed list):
  - Develop's stricter AI checks now reject 5 older tips for questions this work did not change:
    t02q13, t02q24 and t05q19 are still live as `draft`, and t03q16 and t04q01 were already
    rejected in Admin. Reject or re-draft them before approving.
  - t13q22's explanation says "come off the gas", which is US wording (UK: accelerator). It needs a
    confirmed finding before it is changed.
