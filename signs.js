// Theory Trainer — road signs, road markings and light signals (issues #44 and #48).
//
// Every picture here is OFFICIAL Great Britain artwork from GOV.UK, never drawn by us. It is copied
// unchanged: only scaled down (at most 360-400 px on the long side) and saved as JPEG.
//   * The Highway Code (#48): every picture on its traffic signs, road markings, light signals
//     controlling traffic and vehicle markings pages, with the caption printed under it as its
//     meaning, word for word, grouped under the pages' own headings, in page order.
//   * The Department for Transport's traffic sign images (#44), numbered by their diagram in the
//     Traffic Signs Regulations, https://www.gov.uk/guidance/traffic-sign-images. Where a DfT picture
//     is the same sign as a Highway Code one (same diagram and picture), it is ONE entry: its old key
//     and file, the Highway Code's caption. Seven have no Highway Code twin: they keep the DfT's words.
// Both are Crown copyright under the Open Government Licence v3.0, which lets anyone reuse them if
// they say where they came from: CREDIT below is shown on the Road Signs screen, about and help.
// Left out of the Highway Code, each with its reason (lead decisions on issue #48): the wrong
// picture, a caption its picture contradicts, two pictures with logos, the photographs of people,
// and captions that are not a meaning. The list: tests/data/highway-code-catalogue.json (leftOut).
//
// ONE MAP (TTSigns.list) feeds everything: the picture on a question (SignImage), the Road Signs
// screen (sections), its quizzes (question, quizIds), the question editor's "Sign image" list and
// Adventure's sign worlds (worlds). A bank question names its picture by a key (the bank's `sign`
// column, the app's `imageHint`): never change a key a question already uses.
// To add a picture: put the file in signs/ and add one entry below. A bank question's picture also
// goes in sw.js EXTRAS (tests/signs.test.js checks); every other picture is cached when first seen.
(function () {
  'use strict';

  // ---------- where the pictures come from ----------
  // The licence, the one credit it asks for, and the page a person can open to check a picture.
  var LICENCE_URL = 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/';
  var CREDIT = 'Road sign, road marking, light signal and vehicle marking images: Crown copyright, Department for Transport and The Highway Code. Contains public sector information licensed under the Open Government Licence v3.0.';
  var SOURCES = {
    dft: {
      name: 'Department for Transport traffic sign images',
      page: 'https://www.gov.uk/guidance/traffic-sign-images',
      // The spreadsheet the diagram numbers and official descriptions below were copied from.
      details: 'https://assets.publishing.service.gov.uk/media/5a82c0fee5274a2e8ab592d9/traffic-signs-images-image-details.xls'
    },
    hc: { name: 'The Highway Code', page: 'https://www.gov.uk/guidance/the-highway-code' }
  };

  // The DfT publishes its JPGs as one zip per category; each DfT entry's `url` is the zip it came from.
  var ZIP = 'https://assets.publishing.service.gov.uk/media/';
  var DFT = {
    regulatory: ZIP + '5a7e23d9e5274a2e8ab4617d/regulatory-signs-jpg.zip',
    warning: ZIP + '5a7ef66e40f0b62305b8445e/warning-signs-jpg.zip',
    speed: ZIP + '5a7b6b6240f0b6425d59306b/speed-limit-signs-jpg.zip',
    parking: ZIP + '5a7d7bfce5274a6b89a505a7/on-street-parking-jpg.zip',
    busCycle: ZIP + '5a74d530e5274a3cb28678bd/bus-and-cycle-signs-jpg.zip',
    levelCrossing: ZIP + '5a74d7c8e5274a59fa715601/level-crossing-signs-jpg.zip',
    motorway: ZIP + '5a7585b840f0b6397f35f132/motorway-signs-jpg.zip',
    tourist: ZIP + '5a7b15e640f0b66eab99ee0b/direction-and-tourist-signs-jpg.zip',
    roadWorks: ZIP + '5a7b0d7e40f0b66a2fc04cef/road-works-and-temporary-jpg.zip'
  };
  // Where most Highway Code pictures are stored on GOV.UK (a few newer ones are on ZIP's server).
  var HC_IMG = 'https://assets.digital.cabinet-office.gov.uk/media/';

  // ---------- the Highway Code's pages and headings ----------
  // Each page: its title, its address, and what a question calls one of its pictures.
  var HC = 'https://www.gov.uk/guidance/the-highway-code/';
  var PAGES = {
    signs: { title: 'Traffic signs', url: HC + 'traffic-signs', noun: 'sign' },
    markings: { title: 'Road markings', url: HC + 'road-markings', noun: 'road marking' },
    lights: { title: 'Light signals controlling traffic', url: HC + 'light-signals-controlling-traffic', noun: 'light signal' },
    vehicles: { title: 'Vehicle markings', url: HC + 'vehicle-markings', noun: 'vehicle marking' }
  };
  // The categories, in the Highway Code's order: a section of the Road Signs screen, a "Quiz me on
  // this category" and an Adventure sign world each. On the Traffic signs page they are its headings;
  // each other page is one category, and its headings are the sub-categories (`sub`, and `sub2` for
  // road markings' third level). Names are the pages' own words.
  var CATEGORIES = [
    { id: 'orders', name: 'Signs giving orders', page: 'signs' },
    { id: 'warning', name: 'Warning signs', page: 'signs' },
    { id: 'direction', name: 'Direction signs', page: 'signs' },
    { id: 'information', name: 'Information signs', page: 'signs' },
    { id: 'roadworks', name: 'Road work signs', page: 'signs' },
    { id: 'markings', name: 'Road markings', page: 'markings' },
    { id: 'lights', name: 'Light signals controlling traffic', page: 'lights' },
    { id: 'vehicles', name: 'Vehicle markings', page: 'vehicles' }
  ];
  // The DfT pictures with no Highway Code twin: the last group on the Road Signs screen, no quiz.
  var OTHER = { id: 'dft', name: 'More signs from the Department for Transport' };

  // ---------- sign questions (#48) ----------
  // Darren's rule is "only questions and answers from the bank". A sign question meets it (logged on
  // issue #48): the official picture, its official caption word for word as the right answer, and
  // three OTHER official captions from the same category as the wrong ones. Nothing is written here
  // but this one question line, with the page's own word for the picture.
  var QUESTION = 'What does this {noun} mean?';
  var PREFIX = 'sign:';        // a sign question's id: 'sign:' + its key (never a bank question's id)
  var QUIZ_SIZE = 20;          // "Quiz me on all signs" / "on this category": at most this many
  var FOLDER = 'signs/';       // where the pictures live, next to the page
  // What a picture is called on screen when it has no written description of its own (#48's): what
  // it is, never what it means, because on a question the meaning is the answer.
  var ALT = 'Road sign picture';

  // ---------- the map ----------
  // One entry per picture:
  //   key      what a question stores to show it (never change a key a question already uses). A
  //            #48 picture's key is its GOV.UK file name; #44's are short words.
  //   hc       the Highway Code picture it is (its GOV.UK file name), when it is one
  //   cat, sub, sub2   its category (CATEGORIES) and the page's headings above it (set by group())
  //   file     the picture, inside the signs/ folder (a #48 picture: key + '.jpg')
  //   source   'hc' (The Highway Code) or 'dft' (the DfT's images); a #48 picture: 'hc'
  //   diagram  the DfT diagram number (DfT pictures only)
  //   url      the exact file or zip it was copied from
  //   page     the GOV.UK page to check it against (worked out below)
  //   meaning  the OFFICIAL words, copied exactly (typing, capitals and spacing as published): the
  //            Highway Code's caption, with only markdown's ** marks taken out; the DfT
  //            spreadsheet's description for the seven with no Highway Code twin
  //   alt      #44's words for what the picture LOOKS like (shown only if it cannot load)
  //   multi    the picture shows several signs at once: shown on Road Signs, never a quiz picture
  // Pictures under one heading of a page.
  function group(cat, sub, entries, sub2) {
    entries.forEach(function (s) { s.cat = cat; s.sub = sub; if (sub2) s.sub2 = sub2; });
    return entries;
  }
  var LIST = [].concat(
      group('orders', null, [
        { key: 'sign-giving-order-entry-20-zone', url: HC_IMG + '55b9f29740f0b6151f000013/sign-giving-order-entry-20-zone.jpg',
          meaning: 'Entry to 20 mph zone' },
        { key: 'sign-giving-order-end-20-zonev2', url: 'https://assets.publishing.service.gov.uk/media/57f76285e5274a0eb7000029/sign-giving-order-end-20-zonev2.jpg',
          meaning: 'End of 20 mph zone' },
        { key: 'sign-giving-order-maximum-speed', url: HC_IMG + '55b9f2dd40f0b6151f000015/sign-giving-order-maximum-speed.jpg',
          meaning: 'Maximum speed' },
        { key: 'natLimit', hc: 'sign-giving-order-national-speed-limit', file: '671.jpg', source: 'dft', diagram: '671', url: DFT.speed,
          alt: 'White circle with a black diagonal stripe',
          meaning: 'National speed limit applies' },
        { key: 'sign-giving-order-school-crossing-patrol', url: HC_IMG + '55b9f31040f0b6151f000017/sign-giving-order-school-crossing-patrol.jpg',
          meaning: 'School crossing patrol' },
        { key: 'stop', hc: 'sign-giving-order-stop-give-way', file: '601.1.jpg', source: 'dft', diagram: '601.1', url: DFT.regulatory,
          alt: 'Red eight-sided sign with the word STOP',
          meaning: 'Stop and give way' },
        { key: 'giveWay', hc: 'sign-giving-order-give-way', file: '602.jpg', source: 'dft', diagram: '602', url: DFT.regulatory,
          alt: 'Red-bordered triangle pointing down with the words GIVE WAY',
          meaning: 'Give way to traffic on major road' },
        { key: 'sign-giving-order-manually-stop', url: HC_IMG + '55b9f3d040f0b6151c00001f/sign-giving-order-manually-stop.jpg',
          meaning: 'Manually operated temporary STOP and GO signs' },
        { key: 'sign-giving-order-manually-go', url: HC_IMG + '55b9f3f1e5274a152100001f/sign-giving-order-manually-go.jpg',
          meaning: 'Manually operated temporary STOP and GO signs' },
        { key: 'noEntry', hc: 'sign-giving-order-no-entry-vehicular-traffic', file: '616.jpg', source: 'dft', diagram: '616', url: DFT.regulatory,
          alt: 'Red circle with a white bar across the middle',
          meaning: 'No entry for vehicular traffic' },
        { key: 'sign-giving-order-no-vehicles', url: HC_IMG + '55b9f489e5274a151e000024/sign-giving-order-no-vehicles.jpg',
          meaning: 'No vehicles except bicycles being pushed' },
        { key: 'sign-giving-order-no-cycling', url: HC_IMG + '55b9f4a5ed915d155c00000f/sign-giving-order-no-cycling.jpg',
          meaning: 'No cycling' },
        { key: 'sign-giving-order-no-motor-vehicles', url: HC_IMG + '55b9f4d840f0b6151f00001b/sign-giving-order-no-motor-vehicles.jpg',
          meaning: 'No motor vehicles' },
        { key: 'sign-giving-order-no-buses', url: HC_IMG + '55b9f4f0ed915d155f000020/sign-giving-order-no-buses.jpg',
          meaning: 'No buses (over 8 passenger seats)' },
        { key: 'noOvertaking', hc: 'sign-giving-order-no-overtaking', file: '632.jpg', source: 'dft', diagram: '632', url: DFT.regulatory,
          alt: 'Red-ringed circle with a black car and a red car side by side',
          meaning: 'No overtaking' },
        { key: 'sign-giving-order-no-towed-caravans', url: HC_IMG + '55b9f52540f0b6151c000023/sign-giving-order-no-towed-caravans.jpg',
          meaning: 'No towed caravans' },
        { key: 'sign-giving-order-no-vehicles-carry-explosives', url: HC_IMG + '55b9f562e5274a1521000021/sign-giving-order-no-vehicles-carry-explosives.jpg',
          meaning: 'No vehicles carrying explosives' },
        { key: 'sign-giving-order-no-vehicle-combination-length', url: 'https://assets.publishing.service.gov.uk/media/58171318e5274a03bd000004/sign-giving-order-no-vehicle-combination-length.jpg', multi: true,
          meaning: 'No vehicle or combination of vehicles over length shown' },
        { key: 'sign-giving-order-no-vehicles-over-height', url: HC_IMG + '55b9f5dc40f0b6151c000025/sign-giving-order-no-vehicles-over-height.jpg',
          meaning: 'No vehicles over height shown' },
        { key: 'sign-giving-order-no-vehicle-width', url: HC_IMG + '55b9f60aed915d155f000022/sign-giving-order-no-vehicle-width.jpg',
          meaning: 'No vehicles over width shown' },
        { key: 'sign-giving-order-give-priority-vehicles', url: HC_IMG + '55b9f637e5274a151e000026/sign-giving-order-give-priority-vehicles.jpg',
          meaning: 'Give priority to vehicles from opposite direction' },
        { key: 'sign-giving-order-no-right-turn', url: HC_IMG + '55b9f66fe5274a151e000028/sign-giving-order-no-right-turn.jpg',
          meaning: 'No right turn' },
        { key: 'sign-giving-order-no-left-turn', url: HC_IMG + '55b9f68740f0b6151f000021/sign-giving-order-no-left-turn.jpg',
          meaning: 'No left turn' },
        { key: 'sign-giving-order-no-u-turn', url: HC_IMG + '55b9f6aded915d155f000024/sign-giving-order-no-u-turn.jpg',
          meaning: 'No U-turns' },
        { key: 'sign-giving-order-no-goods-vehicle-over-weight', url: HC_IMG + '55b9f6d8e5274a151e00002a/sign-giving-order-no-goods-vehicle-over-weight.jpg',
          meaning: 'No goods vehicles over maximum gross weight shown (in tonnes) except for loading and unloading' },
        { key: 'sign-giving-order-no-vehicles-max-gross-weight', url: HC_IMG + '55b9ffe8e5274a151e00002c/sign-giving-order-no-vehicles-max-gross-weight.jpg',
          meaning: 'No vehicles over maximum gross weight shown (in tonnes)' },
        { key: 'sign-giving-order-park-restrict-permit-holders', url: HC_IMG + '55ba0058ed915d155c000011/sign-giving-order-park-restrict-permit-holders.jpg',
          meaning: 'Parking restricted to permit holders' },
        { key: 'sign-giving-order-no-stopping-times', url: HC_IMG + '55ba008eed915d155f000028/sign-giving-order-no-stopping-times.jpg',
          meaning: 'No stopping during times shown except for as long as necessary to set down or pick up passengers' },
        { key: 'sign-giving-order-no-waiting', url: HC_IMG + '55ba00a140f0b6151f000025/sign-giving-order-no-waiting.jpg',
          meaning: 'No waiting' },
        { key: 'clearway', hc: 'sign-giving-order-no-stopping', file: '642.jpg', source: 'dft', diagram: '642', url: DFT.parking,
          alt: 'Blue circle with a red border and a red cross',
          meaning: 'No stopping (Clearway)' },
      ]),
      group('orders', 'Signs with blue circles but no red border mostly give positive instruction.', [
        { key: 'sign-giving-order-ahead-only', url: HC_IMG + '55cb16d9e5274a5473000021/sign-giving-order-ahead-only.jpg',
          meaning: 'Ahead only' },
        { key: 'sign-giving-order-turn-left-ahead', url: HC_IMG + '55ba11ffe5274a151e000030/sign-giving-order-turn-left-ahead.jpg',
          meaning: 'Turn left ahead (right if symbol reversed)' },
        { key: 'turnLeft', hc: 'sign-giving-order-turn-left', file: '606.jpg', source: 'dft', diagram: '606', url: DFT.regulatory,
          alt: 'Blue circle with a white arrow pointing left',
          meaning: 'Turn left (right if symbol reversed)' },
        { key: 'sign-giving-order-keep-left', url: HC_IMG + '55ba123bed915d155c000019/sign-giving-order-keep-left.jpg',
          meaning: 'Keep left (right if symbol reversed)' },
        { key: 'sign-giving-order-vehicle-pass-either-side', url: HC_IMG + '55ba124eed915d155c00001b/sign-giving-order-vehicle-pass-either-side.jpg',
          meaning: 'Vehicles may pass either side to reach same destination' },
        { key: 'sign-giving-order-mini-roundabout', url: HC_IMG + '55ba126540f0b6151c00002b/sign-giving-order-mini-roundabout.jpg',
          meaning: 'Mini-roundabout (roundabout circulation - give way to vehicles from the immediate right)' },
        { key: 'cyclesOnly', hc: 'sign-giving-order-route-pedal-cycles-only', file: '955.jpg', source: 'dft', diagram: '955', url: DFT.busCycle,
          alt: 'Blue circle with a white bicycle',
          meaning: 'Route to be used by pedal cycles only' },
        { key: 'sign-giving-order-segregated-cycle-pedestrian-route', url: HC_IMG + '55ba12b1ed915d155c00001d/sign-giving-order-segregated-cycle-pedestrian-route.jpg',
          meaning: 'Segregated pedal cycle and pedestrian route' },
        { key: 'minSpeed', hc: 'sign-giving-order-minimum-speed', file: '672.jpg', source: 'dft', diagram: '672', url: DFT.speed,
          alt: 'Blue circle with the number 30 in white',
          meaning: 'Minimum speed' },
        { key: 'sign-giving-order-minimum-speed-end', url: HC_IMG + '55ba12d3e5274a151e000032/sign-giving-order-minimum-speed-end.jpg',
          meaning: 'End of minimum speed' },
        { key: 'sign-giving-order-buses-cycles-only', url: 'https://assets.publishing.service.gov.uk/media/68e3cbcc49e17d00a56ffe3c/sign-giving-order-buses-cycles-only.jpg',
          meaning: 'Buses and cycles only' },
        { key: 'sign-giving-order-trams-only', url: 'https://assets.publishing.service.gov.uk/media/68e3cbba8c1db6022d0ca152/sign-giving-order-trams-only.jpg',
          meaning: 'Trams only' },
        { key: 'sign-giving-order-pedestrian-crossing-tramway', url: HC_IMG + '55ba131840f0b6151c00002d/sign-giving-order-pedestrian-crossing-tramway.jpg',
          meaning: 'Pedestrian crossing point over tramway' },
        { key: 'oneWay', hc: 'sign-giving-order-one-way-traffic', file: '652.jpg', source: 'dft', diagram: '652', url: DFT.regulatory,
          alt: 'Blue rectangle with a white arrow pointing up',
          meaning: 'One-way traffic (note: compare circular ‘Ahead only’ sign)' },
        { key: 'sign-giving-order-with-flow-bus-cycle-lane', url: HC_IMG + '55ba1353e5274a1521000027/sign-giving-order-with-flow-bus-cycle-lane.jpg',
          meaning: 'With-flow bus and cycle lane' },
        { key: 'sign-giving-order-contra-flow-bus-lane', url: HC_IMG + '55ba136ded915d155f00002a/sign-giving-order-contra-flow-bus-lane.jpg',
          meaning: 'Contra-flow bus lane' },
        { key: 'sign-giving-order-with-flow-pedal-cycle-lane', url: HC_IMG + '55ba1383ed915d155c00001f/sign-giving-order-with-flow-pedal-cycle-lane.jpg',
          meaning: 'With-flow pedal cycle lane' },
      ]),
      group('warning', 'Mostly triangular', [
        { key: 'warning-sign-distance-to-stop-line-ahead-100-yards', url: HC_IMG + '55b75e26ed915d07e2000007/warning-sign-distance-to-stop-line-ahead-100-yards.jpg',
          meaning: 'Distance to ‘STOP’ line ahead' },
        { key: 'warning-sign-dual-carriageway-ends', url: HC_IMG + '55b75e47e5274a215200000c/warning-sign-dual-carriageway-ends.jpg',
          meaning: 'Dual carriageway ends' },
        { key: 'warning-sign-road-narrow', url: HC_IMG + '55b75eeded915d07fe000005/warning-sign-road-narrow.jpg',
          meaning: 'Road narrows on right (left if symbol reversed)' },
        { key: 'roadNarrows', hc: 'warning-sign-road-narrow-both-sides', file: '516.jpg', source: 'dft', diagram: '516', url: DFT.warning,
          alt: 'Red-bordered triangle with a road getting narrower on both sides',
          meaning: 'Road narrows on both sides' },
        { key: 'warning-sign-distance-to-stop-line-ahead-50-yards', url: HC_IMG + '55b75f36e5274a215200000e/warning-sign-distance-to-stop-line-ahead-50-yards.jpg',
          meaning: 'Distance to ‘Give Way’ line ahead' },
        { key: 'warning-sign-crossroads', url: HC_IMG + '55b7696640f0b6790f000011/warning-sign-crossroads.jpg',
          meaning: 'Crossroads' },
        { key: 'warning-sign-junction-on-bend-ahead', url: HC_IMG + '55b7698540f0b6790f000013/warning-sign-junction-on-bend-ahead.jpg',
          meaning: 'Junction on bend ahead' },
        { key: 'warning-sign-t-junction-with-priority', url: HC_IMG + '55b769b2ed915d07e200000b/warning-sign-t-junction-with-priority.jpg',
          meaning: 'T-junction with priority over vehicles from the right' },
        { key: 'warning-sign-staggered-junction', url: HC_IMG + '55b769e040f0b67aa300000d/warning-sign-staggered-junction.jpg',
          meaning: 'Staggered junction' },
        { key: 'warning-sign-traffic-merging-left', url: HC_IMG + '55b76a04ed915d07fe000009/warning-sign-traffic-merging-left.jpg',
          meaning: 'Traffic merging from left ahead' },
        { key: 'warning-sign-double-bend', url: HC_IMG + '55b76a2d40f0b6790f000015/warning-sign-double-bend.jpg',
          meaning: 'Double bend first to left (symbol may be reversed)' },
        { key: 'bendLeft', hc: 'warning-sign-bend-to-right', file: '512L.jpg', source: 'dft', diagram: '512', url: DFT.warning,
          alt: 'Red-bordered triangle with a road bending to the left',
          meaning: 'Bend to right (or left if symbol reversed)' },
        { key: 'warning-sign-roundabout', url: HC_IMG + '55b76a79ed915d07fe00000b/warning-sign-roundabout.jpg',
          meaning: 'Roundabout' },
        { key: 'warning-sign-uneven-road', url: HC_IMG + '55b76a9240f0b6790f000017/warning-sign-uneven-road.jpg',
          meaning: 'Uneven road' },
        { key: 'warning-sign-two-way-traffic-crosses-road', url: HC_IMG + '55b76af8ed915d07fe00000d/warning-sign-two-way-traffic-crosses-road.jpg',
          meaning: 'Two-way traffic crosses one-way road' },
        { key: 'warning-sign-two-way-traffic-ahead', url: HC_IMG + '55b76b1e40f0b67aa3000013/warning-sign-two-way-traffic-ahead.jpg',
          meaning: 'Two-way traffic straight ahead' },
        { key: 'warning-sign-swing-bridge', url: HC_IMG + '55b76b42e5274a21ec00000a/warning-sign-swing-bridge.jpg',
          meaning: 'Opening or swing bridge ahead' },
        { key: 'warning-sign-aircraft', url: HC_IMG + '55b76b6840f0b67aa3000015/warning-sign-aircraft.jpg',
          meaning: 'Low-flying aircraft or sudden aircraft noise' },
        { key: 'warning-sign-falling-rocks', url: HC_IMG + '55b76b81ed915d07fe00000f/warning-sign-falling-rocks.jpg',
          meaning: 'Falling or fallen rocks' },
        { key: 'warning-sign-traffic-signals-not-in-use', url: HC_IMG + '55b76bbbed915d07fe000011/warning-sign-traffic-signals-not-in-use.jpg',
          meaning: 'Traffic signals not in use' },
        { key: 'trafficLights', hc: 'warning-sign-traffic-signals', file: '543.jpg', source: 'dft', diagram: '543', url: DFT.warning,
          alt: 'Red-bordered triangle with a set of traffic lights',
          meaning: 'Traffic signals' },
        { key: 'slippery', hc: 'warning-sign-slippery-road', file: '557.jpg', source: 'dft', diagram: '557', url: DFT.warning,
          alt: 'Red-bordered triangle with a car and skid marks',
          meaning: 'Slippery road' },
        { key: 'warning-sign-steep-hill-downwards', url: HC_IMG + '55b76c11ed915d07fe000013/warning-sign-steep-hill-downwards.jpg',
          meaning: 'Steep hill downwards' },
        { key: 'warning-sign-steep-hill-upwards', url: HC_IMG + '55b76c2de5274a21ec00000e/warning-sign-steep-hill-upwards.jpg',
          meaning: 'Steep hill upwards' },
        { key: 'warning-sign-tunnel-ahead', url: HC_IMG + '55b76c51e5274a21ec000010/warning-sign-tunnel-ahead.jpg',
          meaning: 'Tunnel ahead' },
        { key: 'warning-sign-trams-crossing-ahead', url: HC_IMG + '55b76c82ed915d07fe000015/warning-sign-trams-crossing-ahead.jpg',
          meaning: 'Trams crossing ahead' },
        { key: 'levelCrossing', hc: 'warning-sign-level-crossing-ahead-barrier-or-gate', file: '770.jpg', source: 'dft', diagram: '770', url: DFT.levelCrossing,
          alt: 'Red-bordered triangle with a gate',
          meaning: 'Level crossing with barrier or gate ahead' },
        { key: 'warning-sign-level-crossing-ahead-without-barrier', url: HC_IMG + '55b76cf940f0b67aa3000017/warning-sign-level-crossing-ahead-without-barrier.jpg',
          meaning: 'Level crossing without barrier or gate ahead' },
        { key: 'warning-sign-level-crossing-without-barrier-ahead', url: HC_IMG + '55b76d18ed915d07e200000d/warning-sign-level-crossing-without-barrier-ahead.jpg',
          meaning: 'Level crossing without barrier' },
        { key: 'warning-sign-frail-pedestrians-cross-road-ahead', url: HC_IMG + '55b76ddc40f0b6790f00001b/warning-sign-frail-pedestrians-cross-road-ahead.jpg',
          meaning: 'Frail (or blind or disabled if shown) pedestrians likely to cross road ahead' },
        { key: 'warning-sign-pedestrians-in-road-ahead', url: HC_IMG + '55b76dfbed915d07fe000017/warning-sign-pedestrians-in-road-ahead.jpg',
          meaning: 'Pedestrians in road ahead' },
        { key: 'zebra', hc: 'warning-sign-zebra-crossing', file: '544.jpg', source: 'dft', diagram: '544', url: DFT.warning,
          alt: 'Red-bordered triangle with a person walking over a striped crossing',
          meaning: 'Zebra crossing' },
        { key: 'warning-sign-overhead-electric-cables', url: 'https://assets.publishing.service.gov.uk/media/5817085d40f0b64c34000000/warning-sign-overhead-electric-cables.jpg',
          meaning: 'Overhead electric cable; plate indicates maximum height of vehicles which can pass safely' },
        { key: 'warning-sign-sharp-deviation-of-route', url: HC_IMG + '55b76ecae5274a21ec000014/warning-sign-sharp-deviation-of-route.jpg',
          meaning: 'Sharp deviation of route to left (or right if chevrons reversed)' },
        { key: 'warning-sign-light-signals-ahead', url: HC_IMG + '55b76ef9e5274a21ec000016/warning-sign-light-signals-ahead.jpg',
          meaning: 'Light signals ahead at level crossing, airfield or bridge' },
        { key: 'warning-sign-level-crossing-minature', url: HC_IMG + '55b76f4440f0b6790f00001f/warning-sign-level-crossing-minature.jpg',
          meaning: 'Miniature warning lights at level crossings' },
        { key: 'warning-sign-cattle', url: HC_IMG + '55b76f56e5274a21ec000018/warning-sign-cattle.jpg',
          meaning: 'Cattle' },
        { key: 'warning-sign-wild-animals', url: HC_IMG + '55b76f70e5274a21ec00001a/warning-sign-wild-animals.jpg',
          meaning: 'Wild animals' },
        { key: 'warning-sign-wild-horses', url: HC_IMG + '55b76f87ed915d07fe000019/warning-sign-wild-horses.jpg',
          meaning: 'Wild horses or ponies' },
        { key: 'warning-sign-accompanied-horses', url: HC_IMG + '55b76fa6ed915d07fe00001b/warning-sign-accompanied-horses.jpg',
          meaning: 'Accompanied horses or ponies' },
        { key: 'warning-sign-cycle-route-ahead', url: HC_IMG + '55b76fbced915d07e200000f/warning-sign-cycle-route-ahead.jpg',
          meaning: 'Cycle route ahead' },
        { key: 'warning-sign-risk-of-ice', url: HC_IMG + '55b76fd9e5274a2152000014/warning-sign-risk-of-ice.jpg',
          meaning: 'Risk of ice' },
        { key: 'warning-sign-traffic-queues', url: HC_IMG + '55b76ffa40f0b6790f000021/warning-sign-traffic-queues.jpg',
          meaning: 'Traffic queues likely ahead' },
        { key: 'warning-sign-distance-humps-extend', url: HC_IMG + '55b7701940f0b6790f000023/warning-sign-distance-humps-extend.jpg',
          meaning: 'Distance over which road humps extend' },
        { key: 'warning-sign-other-danger', url: HC_IMG + '55b7703fe5274a21ec00001c/warning-sign-other-danger.jpg',
          meaning: 'Other danger; plate indicates nature of danger' },
        { key: 'warning-sign-soft-verges', url: HC_IMG + '55b77056ed915d07fe00001d/warning-sign-soft-verges.jpg',
          meaning: 'Soft verges' },
        { key: 'warning-sign-side-winds', url: HC_IMG + '55b7706940f0b67aa300001b/warning-sign-side-winds.jpg',
          meaning: 'Side winds' },
        { key: 'warning-sign-hump-bridge', url: HC_IMG + '55b7707ae5274a21ec00001e/warning-sign-hump-bridge.jpg',
          meaning: 'Hump bridge' },
        { key: 'warning-sign-quayside-or-riverbank', url: HC_IMG + '55b770aaed915d07fe000021/warning-sign-quayside-or-riverbank.jpg',
          meaning: 'Quayside or river bank' },
        { key: 'warning-sign-risk-of-grounding', url: HC_IMG + '55b770c3ed915d07fe000023/warning-sign-risk-of-grounding.jpg',
          meaning: 'Risk of grounding' },
      ]),
      group('direction', 'Signs on motorways - blue backgrounds', [
        { key: 'direction-sign-blue-route-sign', url: HC_IMG + '55b8a49e40f0b6151f000001/direction-sign-blue-route-sign.jpg',
          meaning: 'Route confirmatory sign after junction' },
        { key: 'direction-sign-blue-get-in-lane', url: HC_IMG + '55b8a4c0ed915d155c000005/direction-sign-blue-get-in-lane.jpg',
          meaning: 'Downward pointing arrows mean ‘Get in lane’ \nThe left-hand lane leads to a different destination from the other lanes.' },
        { key: 'direction-sign-blue-destination-leaving-motorway', url: HC_IMG + '55b8a4e940f0b6151c000003/direction-sign-blue-destination-leaving-motorway.jpg',
          meaning: 'The panel with the inclined arrow indicates the destinations which can be reached by leaving the motorway at the next junction' },
      ]),
      group('direction', 'Signs on primary routes - green backgrounds', [
        { key: 'direction-sign-green-route-sign', url: HC_IMG + '55b8a7afed915d155f000003/direction-sign-green-route-sign.jpg',
          meaning: 'Route confirmatory sign after junction' },
        { key: 'direction-sign-green-ring-road-crossroads', url: HC_IMG + '55b8a812e5274a1521000005/direction-sign-green-ring-road-crossroads.jpg',
          meaning: 'Primary route forming part of a ring road' },
        { key: 'direction-sign-green-primary-route-ring-road', url: HC_IMG + '55b8a82ce5274a151e000003/direction-sign-green-primary-route-ring-road.jpg',
          meaning: 'Primary route forming part of a ring road' },
      ]),
      group('direction', 'Signs on non-primary and local routes - black borders', [
        { key: 'direction-sign-black-border-toilets-disabled-access', url: HC_IMG + '55b8af1540f0b6151c000007/direction-sign-black-border-toilets-disabled-access.jpg',
          meaning: 'Direction to toilets with access for the disabled' },
      ]),
      group('direction', 'Other direction signs', [
        { key: 'direction-sign-other-picnic-site', url: HC_IMG + '55b8a938e5274a1521000007/direction-sign-other-picnic-site.jpg',
          meaning: 'Picnic site' },
        { key: 'direction-sign-other-english-heritage', url: HC_IMG + '55b8a952e5274a151e000005/direction-sign-other-english-heritage.jpg',
          meaning: 'Ancient monument in the care of English Heritage' },
        { key: 'direction-sign-other-direction-car-park', url: HC_IMG + '55b8a965e5274a151e000007/direction-sign-other-direction-car-park.jpg',
          meaning: 'Direction to a car park' },
        { key: 'direction-sign-other-tourist-attraction', url: HC_IMG + '55b8a98740f0b6151f000005/direction-sign-other-tourist-attraction.jpg',
          meaning: 'Tourist attraction' },
        { key: 'direction-sign-other-camping-caravan', url: HC_IMG + '55b8a9a140f0b6151f000007/direction-sign-other-camping-caravan.jpg',
          meaning: 'Direction to camping and caravan site' },
        { key: 'direction-sign-other-advisory-route-lorries', url: HC_IMG + '55b8a9b9e5274a151e000009/direction-sign-other-advisory-route-lorries.jpg',
          meaning: 'Advisory route for lorries' },
        { key: 'direction-sign-other-route-pedal-cycles', url: HC_IMG + '55b8ab18e5274a1521000009/direction-sign-other-route-pedal-cycles.jpg',
          meaning: 'Route for pedal cycles forming part of a network' },
        { key: 'direction-sign-other-recommended-route-cycle', url: HC_IMG + '55b8ab49e5274a151e00000b/direction-sign-other-recommended-route-cycle.jpg',
          meaning: 'Recommended route for pedal cycles to place shown' },
        { key: 'direction-sign-other-route-pedestrians', url: HC_IMG + '55b8ab66e5274a152100000b/direction-sign-other-route-pedestrians.jpg',
          meaning: 'Route for pedestrians' },
        { key: 'direction-sign-other-emergency-diversion-square', url: HC_IMG + '55b8ab86ed915d155c000009/direction-sign-other-emergency-diversion-square.jpg',
          meaning: 'Symbols showing emergency diversion route for motorway and other main road traffic' },
        { key: 'direction-sign-other-emergency-diversion-triangle', url: HC_IMG + '55b8abace5274a151e00000d/direction-sign-other-emergency-diversion-triangle.jpg',
          meaning: 'Symbols showing emergency diversion route for motorway and other main road traffic' },
        { key: 'direction-sign-other-emergency-diversion-diamond', url: HC_IMG + '55b8abc2e5274a152100000d/direction-sign-other-emergency-diversion-diamond.jpg',
          meaning: 'Symbols showing emergency diversion route for motorway and other main road traffic' },
        { key: 'direction-sign-other-emergency-diversion-circle', url: HC_IMG + '55b8abd6e5274a152100000f/direction-sign-other-emergency-diversion-circle.jpg',
          meaning: 'Symbols showing emergency diversion route for motorway and other main road traffic' },
        { key: 'direction-sign-other-diversion-route', url: HC_IMG + '55b8abf540f0b6151c000005/direction-sign-other-diversion-route.jpg',
          meaning: 'Diversion route' },
      ]),
      group('information', 'All rectangular', [
        { key: 'information-sign-entrance-controlled-parking-zone', url: HC_IMG + '55b8bc8040f0b6151c000009/Information-sign-entrance-controlled-parking-zone.jpg',
          meaning: 'Entrance to controlled parking zone' },
        { key: 'information-sign-end-controlled-parking-zone', url: HC_IMG + '55b8bcab40f0b6151c00000b/Information-sign-end-controlled-parking-zone.jpg',
          meaning: 'End of controlled parking zone' },
        { key: 'information-sign-advance-warning-restriction-ahead', url: HC_IMG + '55b8bcc340f0b6151c00000d/Information-sign-advance-warning-restriction-ahead.jpg',
          meaning: 'Advance warning of restriction or prohibition ahead' },
        { key: 'information-sign-parking-place-solo-motorcycles', url: HC_IMG + '55b8bcdfed915d155f00000b/Information-sign-parking-place-solo-motorcycles.jpg',
          meaning: 'Parking place for solo motorcycles' },
        { key: 'information-sign-with-flow-bus-lane-ahead', url: HC_IMG + '55b8bcf4e5274a151e000013/Information-sign-with-flow-bus-lane-ahead.jpg',
          meaning: 'With-flow bus lane ahead which pedal cycles and taxis may also use' },
        { key: 'information-sign-lane-for-hov', url: HC_IMG + '55b8bd2aed915d155c00000b/Information-sign-lane-for-hov.jpg',
          meaning: 'Lane designated for use by high occupancy vehicles (HOV) - see rule 142' },
        { key: 'information-sign-vehicles-permitted-hov-lane', url: HC_IMG + '55b8bd4140f0b6151c00000f/Information-sign-vehicles-permitted-HOV-lane.jpg',
          meaning: 'Vehicles permitted to use an HOV lane ahead' },
        { key: 'information-sign-motorway-end', url: HC_IMG + '55b8bd5b40f0b6151f000009/Information-sign-motorway-end.jpg',
          meaning: 'End of motorway' },
        { key: 'motorway', hc: 'information-sign-start-motorway', file: '2901.jpg', source: 'dft', diagram: '2901', url: DFT.motorway,
          alt: 'Blue sign with M62 and a motorway symbol',
          meaning: 'Start of motorway and point from which motorway regulations apply' },
        { key: 'information-sign-appropriate-traffic-lanes-junction', url: HC_IMG + '55b8bd89e5274a1521000011/Information-sign-appropriate-traffic-lanes-junction.jpg',
          meaning: 'Appropriate traffic lanes at junction ahead' },
        { key: 'information-sign-traffic-on-carriageway-priority', url: HC_IMG + '55b8bdefed915d155f00000d/Information-sign-traffic-on-carriageway-priority.jpg',
          meaning: 'Traffic on the main carriageway coming from right has priority over joining traffic' },
        { key: 'information-sign-addtional-traffic-joining-left', url: HC_IMG + '55b8be2440f0b6151c000011/Information-sign-addtional-traffic-joining-left.jpg',
          meaning: 'Additional traffic joining from left ahead. Traffic on main carriageway has priority over joining traffic from right hand lane of slip road' },
        { key: 'information-sign-traffic-joining-right-hand-slip-road', url: HC_IMG + '55b8be5540f0b6151c000013/Information-sign-traffic-joining-right-hand-slip-road.jpg',
          meaning: 'Traffic in right hand lane of slip road joining the main carriageway has priority over left hand lane' },
        { key: 'variable-speed-limit', url: 'https://assets.publishing.service.gov.uk/media/613a0b1e8fa8f503c6403de0/variable_speed_limit.png',
          meaning: 'Variable speed limit with camera enforcement sign.' },
        { key: 'information-sign-motorway-exit-countdown-markers', url: HC_IMG + '560bc777e5274a0369000024/information-sign-motorway-exit-countdown-markers.jpg', multi: true,
          meaning: '‘Countdown’ markers at exit from motorway (each bar represents 100 yards to the exit). Green-backed markers may be used on primary routes and white-backed markers with black bars on other routes. At approaches to concealed level crossings white-backed markers with red bars may be used. Although these will be erected at equal distances the bars do not represent 100 yard intervals.' },
        { key: 'information-sign-motorway-service', url: HC_IMG + '55b8beb3ed915d155f000011/Information-sign-motorway-service.jpg',
          meaning: 'Motorway service area sign showing the operator’s name' },
        { key: 'information-sign-traffic-priority-over-oncoming-vehicles', url: HC_IMG + '55b8befce5274a151e000017/Information-sign-traffic-priority-over-oncoming-vehicles.jpg',
          meaning: 'Traffic has priority over oncoming vehicles' },
        { key: 'information-sign-hospital-a-and-e', url: HC_IMG + '55b8c000ed915d155f000014/Information-sign-hospital-a-and-e.jpg',
          meaning: 'Hospital ahead with Accident and Emergency facilities' },
        { key: 'information-sign-tourist-info-point', url: HC_IMG + '55b8c01340f0b6151c000015/Information-sign-tourist-info-point.jpg',
          meaning: 'Tourist information point' },
        { key: 'information-sign-no-through-road', url: HC_IMG + '55b8c026e5274a1521000015/Information-sign-no-through-road.jpg',
          meaning: 'No through road for vehicles' },
        { key: 'information-sign-recommended-route-cycles', url: HC_IMG + '55b8c063e5274a151e00001a/Information-sign-recommended-route-cycles.jpg',
          meaning: 'Recommended route for pedal cycles' },
        { key: 'information-sign-home-zone-entry', url: HC_IMG + '55b8c079e5274a1521000017/Information-sign-home-zone-entry.jpg',
          meaning: 'Home Zone Entry' },
        { key: 'information-sign-camera-area', url: HC_IMG + '55b8c091ed915d155f000016/Information-sign-camera-area.jpg',
          meaning: 'Area in which cameras are used to enforce traffic regulations' },
        { key: 'information-sign-bus-lane-road-junction-ahead', url: HC_IMG + '55b8c0a6ed915d155c00000d/Information-sign-bus-lane-road-junction-ahead.jpg',
          meaning: 'Bus lane on road at junction ahead' },
      ]),
      group('roadworks', null, [
        { key: 'roadWorks', hc: 'road-work-sign-road-works', file: '7001.jpg', source: 'dft', diagram: '7001', url: DFT.roadWorks,
          alt: 'Red-bordered triangle with a person digging',
          meaning: 'Road works' },
        { key: 'road-work-sign-loose-chippings', url: HC_IMG + '55b8c3c240f0b6151c000017/road-work-sign-loose-chippings.jpg',
          meaning: 'Loose chippings' },
        { key: 'road-work-sign-temporary-hazard', url: HC_IMG + '55b8c3dbed915d155f00001a/road-work-sign-temporary-hazard.jpg',
          meaning: 'Temporary hazard at road works' },
        { key: 'road-work-sign-temporary-lane-closure', url: HC_IMG + '55b8c3f140f0b6151f00000d/road-work-sign-temporary-lane-closure.jpg',
          meaning: 'Temporary lane closure (the number and position of arrows and red bars may be varied according to lanes open and closed)' },
        { key: 'road-work-sign-back-vehicle-direction-arrow', url: HC_IMG + '55b8c413ed915d155f00001c/road-work-sign-back-vehicle-direction-arrow.jpg',
          meaning: 'Slow-moving or stationary works vehicle blocking a traffic lane. Pass in the direction shown by the arrow.' },
        { key: 'road-work-sign-mandatory-speed-limit', url: HC_IMG + '55b8c42740f0b6151c000019/road-work-sign-mandatory-speed-limit.jpg',
          meaning: 'Mandatory speed limit ahead' },
        { key: 'road-work-sign-road-works-ahead', url: HC_IMG + '55b8c43ee5274a151e00001c/road-work-sign-road-works-ahead.jpg',
          meaning: 'Road works 1 mile ahead' },
        { key: 'road-work-sign-back-vehicle-800-yards', url: HC_IMG + '55b8c476e5274a1521000019/road-work-sign-back-vehicle-800-yards.jpg',
          meaning: 'Signs used on the back of slow-moving or stationary vehicles warning of a lane closed ahead by a works vehicle. There are no cones on the road.' },
        { key: 'road-work-sign-back-vehicle450-yards', url: HC_IMG + '55b8c486e5274a152100001b/road-work-sign-back-vehicle450-yards.jpg',
          meaning: 'Signs used on the back of slow-moving or stationary vehicles warning of a lane closed ahead by a works vehicle. There are no cones on the road.' },
        { key: 'road-work-sign-lane-restriction', url: HC_IMG + '55b8c4a640f0b6151f00000f/road-work-sign-lane-restriction.jpg',
          meaning: 'Lane restrictions at road works ahead' },
        { key: 'road-work-sign-lane-crossover', url: HC_IMG + '55b8c4b840f0b6151f000011/road-work-sign-lane-crossover.jpg',
          meaning: 'One lane crossover at contraflow road works' },
      ]),
      group('markings', 'Across the carriageway', [
        { key: 'across-carriageway-stop-line-signals-or-police', url: HC_IMG + '55bb5ed1ed915d1565000002/across-carriageway-stop-line-signals-or-police.jpg',
          meaning: 'Stop line at signals or police control' },
        { key: 'across-carriageway-stop-line-at-stop-sign', url: HC_IMG + '55bb5f0040f0b6154e000005/across-carriageway-stop-line-at-stop-sign.jpg',
          meaning: 'Stop line at ‘Stop’ sign' },
        { key: 'across-carriageway-stop-line-level-crossing', url: HC_IMG + '55bb5f38e5274a1548000005/across-carriageway-stop-line-level-crossing.jpg',
          meaning: 'Stop line for pedestrians at a level crossing' },
        { key: 'across-carriageway-give-way-traffic-major-road', url: HC_IMG + '55bb5f73ed915d1568000009/across-carriageway-give-way-traffic-major-road.jpg',
          meaning: 'Give way to traffic on major road (can also be used at mini roundabouts)' },
        { key: 'across-carriageway-give-way-traffic-from-right-roundabout', url: HC_IMG + '55bb5f9e40f0b61551000004/across-carriageway-give-way-traffic-from-right-roundabout.jpg',
          meaning: 'Give way to traffic from the right at a roundabout' },
        { key: 'across-carriageway-give-way-traffic-from-right-miniroundabout', url: HC_IMG + '55bb5fc340f0b6154e000007/across-carriageway-give-way-traffic-from-right-miniroundabout.jpg',
          meaning: 'Give way to traffic from the right at a mini-roundabout' },
      ]),
      group('markings', 'Along the carriageway', [
        { key: 'along-carriageway-edge-line', url: HC_IMG + '55bb6062ed915d1565000004/along-carriageway-edge-line.jpg',
          meaning: 'Edge line' },
        { key: 'centreLine', hc: 'along-carriageway-centre-line', file: 'hc-along-carriageway-centre-line.jpg', source: 'hc', url: HC_IMG + '55bb607ae5274a1545000004/along-carriageway-centre-line.jpg',
          alt: 'Road with a broken white line along the middle',
          meaning: 'Centre line See Rule 127' },
        { key: 'along-carriageway-hazard-warn-line', url: HC_IMG + '55bb609a40f0b6154e000009/along-carriageway-hazard-warn-line.jpg',
          meaning: 'Hazard warning line See Rule 127' },
        { key: 'along-carriageway-double-white-broken-line', url: HC_IMG + '55bb60cf40f0b6154e00000b/along-carriageway-double-white-broken-line.jpg',
          meaning: 'Double white lines See Rules 128 and 129' },
        { key: 'doubleWhite', hc: 'along-carriageway-double-white-line', file: 'hc-along-carriageway-double-white-line.jpg', source: 'hc', url: HC_IMG + '55bb60eee5274a1548000007/along-carriageway-double-white-line.jpg',
          alt: 'Road with two solid white lines along the middle',
          meaning: 'Double white lines See Rules 128 and 129' },
        { key: 'along-carriageway-lane-line', url: HC_IMG + '55bb618bed915d1565000008/along-carriageway-lane-line.jpg',
          meaning: 'Lane line See Rule 131' },
      ]),
      group('markings', 'Along the edge of the carriageway', [
        { key: 'doubleYellow', hc: 'along-edge-carriageway-double-yellow', file: 'hc-along-edge-carriageway-double-yellow.jpg', source: 'hc', url: HC_IMG + '55bb62db40f0b6154e00000d/along-edge-carriageway-double-yellow.jpg',
          alt: 'Two yellow lines along the edge of the road',
          meaning: 'No waiting at any time' },
        { key: 'along-edge-carriageway-single-yellow-with-parking', url: HC_IMG + '55bb6347ed915d156800000b/along-edge-carriageway-single_yellow-with-parking.jpg',
          meaning: 'No waiting during times shown on sign' },
        { key: 'along-edge-carriageway-waiting-space', url: HC_IMG + '55bb63c5ed915d156800000d/along-edge-carriageway-waiting-space.jpg',
          meaning: 'Waiting is limited to the duration specified during the days and times shown' },
      ], 'Waiting restrictions'),
      group('markings', 'Along the edge of the carriageway', [
        { key: 'along-edge-carriageway-red-route-no-stopping-double-red-line', url: HC_IMG + '55bb7c4ce5274a154500000a/along-edge-carriageway-red-route-no-stopping-double-red-line.jpg',
          meaning: 'No stopping at any time' },
        { key: 'along-edge-carriageway-red-route-no-stopping-red-line', url: HC_IMG + '55bb7c95ed915d156800001d/along-edge-carriageway-red-route-no-stopping-red-line.jpg',
          meaning: 'No stopping during times shown on sign' },
        { key: 'along-edge-carriageway-red-route-parking-space', url: HC_IMG + '55bb7d05ed915d156500000e/along-edge-carriageway-red-route-parking-space.jpg',
          meaning: 'Parking is limited to the duration specified during the days and times shown' },
        { key: 'along-edge-carriageway-red-route-loading-space', url: HC_IMG + '55bb7d6540f0b6154e000010/along-edge-carriageway-red-route-loading-space.jpg',
          meaning: 'Only loading may take place at the times shown for up to a maximum duration of 20 mins' },
      ], 'Red Route stopping controls'),
      group('markings', 'On the kerb or at the edge of the carriageway', [
        { key: 'on-kerb-double-line-no-loading', url: HC_IMG + '55bb7ebd40f0b6154e000016/on-kerb-double-line-no-loading.jpg',
          meaning: 'No loading or unloading at any time' },
        { key: 'on-kerb-single-line-no-loading-times', url: HC_IMG + '55bb7ee740f0b6155100000a/on-kerb-single-line-no-loading-times.jpg',
          meaning: 'No loading or unloading at the times shown' },
        { key: 'on-kerb-loading-only-space', url: HC_IMG + '55bb7f0de5274a154500000c/on-kerb-loading-only-space.jpg',
          meaning: 'Loading bay' },
      ], 'Loading restrictions on roads other than Red Routes'),
      group('markings', 'Other road markings', [
        { key: 'other-road-markings-school-keep-clear', url: HC_IMG + '55bb8aa840f0b6154e00001c/other-road-markings-school-keep-clear.jpg',
          meaning: 'Keep entrance clear of stationary vehicles, even if picking up or setting down children' },
        { key: 'other-road-markings-give-way-road', url: HC_IMG + '55bb8ada40f0b6154e00001e/other-road-markings-give-way-road.jpg',
          meaning: 'Warning of ‘Give Way’ just ahead' },
        { key: 'other-road-markings-space-doctor', url: HC_IMG + '55bb8af2e5274a1548000013/other-road-markings-space-doctor.jpg',
          meaning: 'Parking space reserved for vehicles named' },
        { key: 'boxJunction', hc: 'other-road-markings-box-junction', file: 'hc-other-road-markings-box-junction.jpg', source: 'hc', url: HC_IMG + '55bb8b4740f0b61551000012/other-road-markings-box-junction.jpg',
          alt: 'Criss-cross yellow lines painted on the road',
          meaning: 'Box junction - See Rule 174' },
        { key: 'other-road-markings-keep-clear', url: HC_IMG + '55bb8b58e5274a1545000010/other-road-markings-keep-clear.jpg',
          meaning: 'Do not block that part of the carriageway indicated' },
        { key: 'other-road-markings-indication-lanes', url: HC_IMG + '55bb8b78e5274a1548000015/other-road-markings-indication-lanes.jpg',
          meaning: 'Indication of traffic lanes' },
      ]),
      group('lights', 'Traffic light signals', [
        { key: 'lightRed', hc: 'traffic-light-red', file: 'hc-traffic-light-red.jpg', source: 'hc', url: HC_IMG + '559fbe1940f0b6156700004d/traffic-light-red.jpg',
          alt: 'Traffic light showing red',
          meaning: 'RED means ‘Stop’. Wait behind the stop line on the carriageway' },
        { key: 'lightRedAmber', hc: 'traffic-light-red-amber', file: 'hc-traffic-light-red-amber.jpg', source: 'hc', url: HC_IMG + '559fbe31e5274a155c000056/traffic-light-red-amber.jpg',
          alt: 'Traffic light showing red and amber together',
          meaning: 'RED AND AMBER also means ‘Stop’. Do not pass through or start until GREEN shows' },
        { key: 'lightGreen', hc: 'traffic-light-green', file: 'hc-traffic-light-green.jpg', source: 'hc', url: HC_IMG + '559fbe3e40f0b6156700004f/traffic-light-green.jpg',
          alt: 'Traffic light showing green',
          meaning: 'GREEN means you may go on if the way is clear. Take special care if you intend to turn left or right and give way to pedestrians who are crossing' },
        { key: 'lightAmber', hc: 'traffic-light-amber', file: 'hc-traffic-light-amber.jpg', source: 'hc', url: HC_IMG + '559fbe48ed915d1592000048/traffic-light-amber.jpg',
          alt: 'Traffic light showing amber',
          meaning: 'AMBER means ‘Stop’ at the stop line. You may go on only if the AMBER appears after you have crossed the stop line or are so close to it that  to pull up might cause an accident' },
        { key: 'traffic-light-green-arrow', url: HC_IMG + '559fbe58e5274a155c000058/traffic-light-green-arrow.jpg',
          meaning: 'A GREEN ARROW may be provided in addition to the full green signal if movement in a certain direction is allowed before or after the full green phase. If the way  is clear you may go but only in the direction shown by  the arrow. You may do this whatever other lights may be showing. White light signals may be provided for trams' },
      ]),
      group('lights', 'Flashing red lights', [
        { key: 'levelCrossingLights', hc: 'flashing-red-lights', file: 'hc-flashing-red-lights.jpg', source: 'hc', url: HC_IMG + '559fbe92ed915d159200004a/flashing-red-lights.jpg',
          alt: 'Two red lights and an amber light on a black panel with a red and white border',
          meaning: 'Alternately flashing red lights mean YOU MUST STOP' },
      ]),
      group('lights', 'Motorway signals', [
        { key: 'redX', hc: 'motorway-signal-red-cross', file: 'hc-motorway-signal-red-cross.jpg', source: 'hc', url: HC_IMG + '559fbeb6ed915d159500003e/motorway-signal-red-cross.jpg',
          alt: 'Motorway signal with a red cross and flashing red lamps',
          meaning: 'You MUST NOT proceed further in this lane' },
        { key: 'motorway-signal-change-lane', url: HC_IMG + '559fbec5e5274a155900002f/motorway-signal-change-lane.jpg',
          meaning: 'Change lane' },
        { key: 'motorway-signal-fog', url: HC_IMG + '559fbef4ed915d1595000040/motorway-signal-fog.jpg',
          meaning: 'Reduced visibility ahead' },
        { key: 'motorway-signal-lane-ahead-closed', url: HC_IMG + '559fbf08e5274a1559000031/motorway-signal-lane-ahead-closed.jpg',
          meaning: 'Lane ahead closed' },
        { key: 'motorway-signal-temporary-speed-limit-message', url: HC_IMG + '559fbf20ed915d159200004c/motorway-signal-temporary-speed-limit-message.jpg',
          meaning: 'Temporary maximum speed advised and information message' },
        { key: 'motorwayLimit', hc: 'obstruction-final', file: 'hc-motorway-signal-mandatory-speed-limit.jpg', source: 'hc', url: 'https://assets.publishing.service.gov.uk/media/613a08c58fa8f503c0fa759a/Obstruction_FINAL_.jpg',
          alt: 'Motorway signal with a red cross, three amber arrows, 40 in a red ring and the word Obstruction',
          meaning: 'You MUST NOT enter or proceed in the left lane, temporary mandatory maximum speed limit and information message' },
        { key: 'motorwayAdvised', hc: 'motorway-signal-temporary-speed', file: 'hc-motorway-signal-temporary-speed.jpg', source: 'hc', url: HC_IMG + '559fbf5940f0b61567000051/motorway-signal-temporary-speed.jpg',
          alt: 'Motorway signal showing 50 with flashing amber lamps',
          meaning: 'Temporary maximum speed advised' },
        { key: 'motorway-signal-end-restriction', url: HC_IMG + '559fbf68ed915d159200004e/motorway-signal-end-restriction.jpg',
          meaning: 'End of restriction' },
      ]),
      group('vehicles', 'Hazard warning plates', [
        { key: 'hazard-warning-dangerous-goods', url: HC_IMG + '55bb8c79ed915d1565000018/hazard-warning-dangerous-goods.jpg',
          meaning: 'The above panel will be displayed by vehicles carrying certain dangerous goods in packages' },
        { key: 'hazard-warning-toxic-label', url: HC_IMG + '55bb8c9ce5274a1545000012/hazard-warning-toxic-label.jpg',
          meaning: 'Toxic substance' },
        { key: 'hazard-warning-oxidising-plate', url: HC_IMG + '55bb8cafe5274a1548000017/hazard-warning-oxidising-plate.jpg',
          meaning: 'Oxidizing substance' },
        { key: 'hazard-warning-compressed-gas-plate', url: HC_IMG + '55bb8cc3e5274a1548000019/hazard-warning-compressed-gas-plate.jpg',
          meaning: 'Non-flammable compressed gas' },
        { key: 'hazard-warning-radioactive-plate', url: HC_IMG + '55bb8cd440f0b61551000014/hazard-warning-radioactive-plate.jpg',
          meaning: 'Radioactive substance' },
        { key: 'hazard-warning-spon-combust-red', url: HC_IMG + '55bb8ce5e5274a1545000014/hazard-warning-spon-combust-red.jpg',
          meaning: 'Spontaneously combustible substance' },
        { key: 'hazard-warning-corrosive-plate', url: HC_IMG + '55bb8cf5e5274a1545000016/hazard-warning-corrosive-plate.jpg',
          meaning: 'Corrosive substance' },
      ]),
      group('vehicles', 'Projections markers', [
        { key: 'projection-marker-side', url: HC_IMG + '55bb8d18e5274a1545000018/projection-marker-side.jpg',
          meaning: 'Side marker' },
        { key: 'projection-marker-end', url: HC_IMG + '55bb8d2ced915d156500001a/projection-marker-end.jpg',
          meaning: 'End marker' },
      ]),
      group('vehicles', 'Other', [
        { key: 'other-school-bus', url: HC_IMG + '55bb8d54ed915d156500001c/other-school-bus.jpg',
          meaning: 'School bus (displayed in front or rear window of bus or coach)' },
      ]),
    // ===== The DfT's pictures with no Highway Code twin kept here (#44): no category =====
    [
      { key: 'speed20', file: '670V20.jpg', source: 'dft', diagram: '670', url: DFT.speed,
        alt: 'Red-ringed circle with the number 20',
        meaning: 'Maximum speed limit of 20 miles per hour' },
      { key: 'speed30', file: '670V30.jpg', source: 'dft', diagram: '670', url: DFT.speed,
        alt: 'Red-ringed circle with the number 30',
        meaning: 'Maximum speed limit of 30 miles per hour' },
      { key: 'speed50', file: '670V50.jpg', source: 'dft', diagram: '670', url: DFT.speed,
        alt: 'Red-ringed circle with the number 50',
        meaning: 'Maximum speed limit of 50 miles per hour' },
      { key: 'schoolAhead', file: '545.jpg', source: 'dft', diagram: '545', url: DFT.warning,
        alt: 'Red-bordered triangle with two children',
        meaning: 'Children going to or from school or playground ahead' },
      { key: 'ford', file: '554.jpg', source: 'dft', diagram: '554', url: DFT.warning,
        alt: 'Red-bordered triangle with the word Ford',
        meaning: 'Ford warning sign' },
      { key: 'speedCamera', file: '880.jpg', source: 'dft', diagram: '880', url: DFT.speed,
        alt: 'Blue sign with a camera symbol above a 30 in a red ring',
        meaning: 'Speed camera ahead and reminder of 30 miles per hour speed limit' },
      { key: 'tourist', file: '2203.jpg', source: 'dft', diagram: '2203', url: DFT.tourist,
        alt: 'Brown sign reading Model village, 1½, with a chevron pointing left',
        meaning: 'Direction and distance to a tourist attraction' }
    ]
  );

  // Look things up once, not by searching the list every time.
  var BY_KEY = {}, CAT = {};
  CATEGORIES.forEach(function (c) { CAT[c.id] = c; });
  LIST.forEach(function (s) {
    // A #48 picture: saved under its own GOV.UK name, from The Highway Code.
    if (!s.source) { s.source = 'hc'; s.hc = s.key; s.file = s.key + '.jpg'; }
    // Checked against the page it was copied from: a Highway Code page, or the DfT's.
    s.page = s.source === 'hc' ? PAGES[CAT[s.cat].page].url : SOURCES.dft.page;
    BY_KEY[s.key] = s;
  });
  function get(key) { return (key && Object.prototype.hasOwnProperty.call(BY_KEY, key)) ? BY_KEY[key] : null; }

  // Shuffle a copy of a list (Fisher-Yates). `rnd` is a random-number function, so a test can
  // pass a fixed one and get the same order every time.
  function shuffled(list, rnd) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1)), t = a[i];
      a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  // The same "random" numbers for the same words, every time (a sign's key -> its question's
  // wrong answers and their order). FNV-1a turns the words into a number; mulberry32 counts on.
  function seededRandom(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () {
      h = (h + 0x6D2B79F5) | 0;
      var t = Math.imul(h ^ (h >>> 15), 1 | h);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- the Road Signs screen ----------
  // sections() -> [{id, name, quiz, count, groups: [{sub, sub2, keys}]}]: each category in order,
  // its pictures grouped under the page's headings, then the DfT-only group (no quiz).
  var SECTIONS = null;
  function sections() {
    if (SECTIONS) return SECTIONS;
    var out = CATEGORIES.map(function (c) { return { id: c.id, name: c.name, quiz: true, count: 0, groups: [] }; });
    var other = { id: OTHER.id, name: OTHER.name, quiz: false, count: 0, groups: [] }, by = {};
    out.forEach(function (x) { by[x.id] = x; });
    LIST.forEach(function (s) {
      var sec = s.cat ? by[s.cat] : other, g = sec.groups[sec.groups.length - 1], sub = s.sub || null;
      if (!g || g.sub !== sub || g.sub2 !== s.sub2) { g = { sub: sub, sub2: s.sub2, keys: [] }; sec.groups.push(g); }
      g.keys.push(s.key); sec.count++;
    });
    SECTIONS = out.concat([other]);
    return SECTIONS;
  }

  // ---------- sign questions ----------
  function isQuizId(id) { return typeof id === 'string' && id.indexOf(PREFIX) === 0; }
  // The keys of the quiz pictures (one sign each, with a Highway Code caption) in page order: in
  // one category, or in all of them (cat null).
  function quizKeys(cat) {
    return LIST.filter(function (s) { return s.cat && !s.multi && (!cat || s.cat === cat); }).map(function (s) { return s.key; });
  }
  // The question for one sign. Its three wrong answers are other captions from its sub-category
  // when that has three that fit, otherwise from its category. A caption "fits" when it is not the
  // right answer's words, does not hold them whole and does not sit inside them ("Road works" is
  // never a wrong answer for "Road works 1 mile ahead": it would be right too). The same sign gets
  // the same question every time (seededRandom), as a bank question does.
  function build(s) {
    var c = CAT[s.cat], rnd = seededRandom(s.key), right = s.meaning, low = right.toLowerCase();
    var fits = function (m) { var l = m.toLowerCase(); return m !== right && l.indexOf(low) < 0 && low.indexOf(l) < 0; };
    var captions = function (list) {
      var seen = {}, out = [];
      list.forEach(function (x) { if (fits(x.meaning) && !seen[x.meaning]) { seen[x.meaning] = true; out.push(x.meaning); } });
      return out;
    };
    var inCat = LIST.filter(function (x) { return x.cat === s.cat; });
    var fromSub = s.sub ? captions(inCat.filter(function (x) { return x.sub === s.sub; })) : [];
    var wrong = shuffled(fromSub.length >= 3 ? fromSub : captions(inCat), rnd).slice(0, 3);
    var at = Math.floor(rnd() * (wrong.length + 1)), options = wrong.slice();
    options.splice(at, 0, right);
    return { id: PREFIX + s.key, question: QUESTION.replace('{noun}', PAGES[c.page].noun), options: options, correctIndex: at,
      imageHint: s.key, explanation: right, ruleRef: 'The Highway Code: ' + c.name };
  }
  var BUILT = {};
  // question('sign:<key>') -> {id, question, options, correctIndex, imageHint, explanation, ruleRef},
  // or null for any other id (a bank question, an unknown key, a picture that is no quiz picture).
  function question(id) {
    if (!isQuizId(id)) return null;
    if (!Object.prototype.hasOwnProperty.call(BUILT, id)) {
      var s = get(id.slice(PREFIX.length));
      BUILT[id] = s && s.cat && !s.multi ? build(s) : null;
    }
    return BUILT[id];
  }
  // A quiz: sign question ids in a random order, at most QUIZ_SIZE. cat null: every category.
  function quizIds(cat, rnd) {
    return shuffled(quizKeys(cat), rnd || Math.random).slice(0, QUIZ_SIZE).map(function (k) { return PREFIX + k; });
  }
  // Adventure's sign worlds (coach.js adventureRoute): one per category, its questions in page order.
  function worlds() {
    return CATEGORIES.map(function (c) { return { id: c.id, name: c.name, qids: quizKeys(c.id).map(function (k) { return PREFIX + k; }) }; });
  }

  window.TTSigns = {
    list: LIST,
    sources: SOURCES,
    pages: PAGES,
    categories: CATEGORIES,
    licenceUrl: LICENCE_URL,
    credit: CREDIT,
    folder: FOLDER,
    quizSize: QUIZ_SIZE,
    QUIZ_PREFIX: PREFIX,
    // The entry for a key, or null when there is no picture for it.
    get: get,
    has: function (key) { return !!get(key); },
    // The picture's address, relative to the page (the app and adventure.html both sit at the root).
    src: function (key) { var s = get(key); return s ? FOLDER + s.file : ''; },
    sections: sections,
    isQuizId: isQuizId,
    quizKeys: quizKeys,
    question: question,
    quizIds: quizIds,
    worlds: worlds
  };

  // ---------- the picture itself ----------
  // <x-import component-from-global-scope="SignImage" hint="stop" size="128"> draws this.
  // The picture sits on a white rounded card with a little padding, so a sign with a white edge
  // still reads on the dark theme. The outer box has role "img" and the name "Road sign picture":
  // the name says what it is, not what the sign means — on a question the meaning is the answer
  // (WCAG 1.1.1 allows this for a test). An unknown key draws nothing. loading="lazy": the Road
  // Signs screen has 200+ pictures, and only those near the screen are fetched.
  // adventure.html has no React: it reads the HTML out of dangerouslySetInnerHTML, so the card
  // must be inside that HTML, not on the outer box.
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  window.SignImage = function (props) {
    var s = get(props.hint);
    if (!s) return null;
    var size = props.size || 120;
    var img = '<img src="' + esc(FOLDER + s.file) + '" alt="' + esc(s.alt || ALT) + '" loading="lazy" decoding="async"'
      + ' style="display:block;width:100%;height:100%;object-fit:contain;box-sizing:border-box;padding:6%;background:#fff;border-radius:14%">';
    return React.createElement('div', {style: {width: size, height: size, flex: 'none', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.12))'}, role:'img', 'aria-label':ALT, dangerouslySetInnerHTML: {__html: img}});
  };
})();
