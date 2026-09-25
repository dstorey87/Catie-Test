-- Issue #44: official road-sign pictures on bank questions (2026-09-25).
-- The live bank keeps a question's picture in public.questions.sign (backend.js reads it as the
-- app's imageHint). Each key is an entry in signs.js (TTSigns.list); the same values are in
-- questions-1..5.json, and tests/signs.test.js checks this file agrees with them.
-- NOT applied by the section branch: the lead runs it once against the live project.
begin;
update public.questions set sign = 'ford' where qid = 't08q17';  -- DfT 554 Ford warning sign
update public.questions set sign = 'speed50' where qid = 't09q26';  -- DfT 670 50 mph limit
update public.questions set sign = 'clearway' where qid = 't10q18';  -- DfT 642 no stopping on main carriageway
update public.questions set sign = 'cyclesOnly' where qid = 't11q18';  -- DfT 955 route for pedal cycles only
update public.questions set sign = 'turnLeft' where qid = 't11q23';  -- DfT 606 arrow pointing left
update public.questions set sign = 'speedCamera' where qid = 't11q22';  -- DfT 880 speed camera ahead
update public.questions set sign = 'tourist' where qid = 't11q14';  -- DfT 2203 tourist attraction
update public.questions set sign = 'motorwayAdvised' where qid = 't09q13';  -- Highway Code: temporary maximum speed advised
update public.questions set sign = 'levelCrossingLights' where qid = 't11q26';  -- Highway Code: alternately flashing red lights
update public.questions set sign = 'motorwayLimit' where qid = 't09q22';  -- Highway Code: temporary mandatory maximum speed limit
update public.questions set sign = 'doubleYellow' where qid = 't10q04';  -- Highway Code: no waiting at any time
update public.questions set sign = 'centreLine' where qid = 't10q10';  -- Highway Code: centre line
update public.questions set sign = 'roadWorks' where qid = 't05q26';  -- DfT 7001 road works ahead
update public.questions set sign = 'levelCrossing' where qid = 't10q27';  -- DfT 770 level crossing with gate or barrier
update public.questions set sign = 'zebra' where qid = 't10q24';  -- DfT 544 zebra crossing ahead
update public.questions set sign = 'lightAmber' where qid = 't10q13';  -- was trafficLights: Highway Code amber light
update public.questions set sign = 'lightGreen' where qid = 't11q10';  -- was trafficLights: Highway Code green light
update public.questions set sign = 'lightRedAmber' where qid = 't11q11';  -- was trafficLights: Highway Code red and amber
update public.questions set sign = null where qid = 't11q03';  -- was stop: the picture showed the answer (the shape)
update public.questions set sign = null where qid = 't11q12';  -- was motorway: the picture showed the answer (the colour)
commit;
