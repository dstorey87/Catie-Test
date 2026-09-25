// Theory Trainer — road-sign pictures (issue #44).
//
// Every picture here is OFFICIAL Great Britain artwork, copied unchanged (only scaled down) from
// GOV.UK — never drawn by us:
//   * signs: the Department for Transport's traffic sign images (numbered by their diagram in
//     the Traffic Signs Regulations), https://www.gov.uk/guidance/traffic-sign-images
//   * road markings and light signals, which that set does not have: The Highway Code pages on
//     GOV.UK (road markings, light signals controlling traffic).
// Both are Crown copyright under the Open Government Licence v3.0, which lets anyone reuse them
// if they say where they came from — so CREDITS below is shown on the Road Signs screen.
//
// ONE MAP (TTSigns.list) feeds everything: the picture on a question (SignImage), the tiles on
// the Road Signs screen, the "Sign image" list in the question editor and the signs quiz.
// A question names its picture by a key (the bank's `sign` column, the app's `imageHint`).
// To add a picture: put the file in signs/, add one entry below, add its path to sw.js EXTRAS.
// tests/signs.test.js fails if a file is missing, EXTRAS is out of step, or a bank question
// names a key this map does not have.
(function () {
  'use strict';

  // ---------- where the pictures come from ----------
  // The page a person can open to check a picture, and the words the licence asks us to show.
  var LICENCE_URL = 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/';
  var SOURCES = {
    dft: {
      name: 'Department for Transport traffic sign images',
      page: 'https://www.gov.uk/guidance/traffic-sign-images',
      // The spreadsheet the diagram numbers and official descriptions below were copied from.
      details: 'https://assets.publishing.service.gov.uk/media/5a82c0fee5274a2e8ab592d9/traffic-signs-images-image-details.xls',
      credit: 'Road sign images: Crown copyright, Department for Transport. Contains public sector information licensed under the Open Government Licence v3.0.'
    },
    hc: {
      name: 'The Highway Code',
      page: 'https://www.gov.uk/guidance/the-highway-code',
      credit: 'Road marking and light signal images: Crown copyright, The Highway Code. Contains public sector information licensed under the Open Government Licence v3.0.'
    }
  };

  // The DfT publishes its JPGs as one zip per category; each entry's `url` is the zip it came from.
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
  // The Highway Code page each road marking or light picture sits on (its caption is the meaning).
  var HC_PAGE = {
    lights: 'https://www.gov.uk/guidance/the-highway-code/light-signals-controlling-traffic',
    markings: 'https://www.gov.uk/guidance/the-highway-code/road-markings'
  };
  var HC_IMG = 'https://assets.digital.cabinet-office.gov.uk/media/';

  // ---------- the map ----------
  // One entry per picture:
  //   key      what a question stores to show it (never change a key a question already uses)
  //   file     the picture, inside the signs/ folder
  //   source   'dft' or 'hc' (SOURCES above)
  //   diagram  the DfT diagram number (signs only)
  //   url      the exact file or zip it was copied from
  //   page     the GOV.UK page to check it against
  //   name     a short title for the Road Signs tile and the editor list
  //   meaning  the OFFICIAL words, copied exactly: the DfT spreadsheet's description, or the
  //            Highway Code's caption under the picture (typing and capitals as published)
  //   alt      what the picture LOOKS like — never what it means, because on a question the
  //            meaning is the answer. Shown only if the picture cannot load.
  // Order: signs that give orders, warning signs, information and direction, road works,
  // traffic lights, motorway signals, then road markings. The Road Signs screen keeps this order.
  var LIST = [
    // --- signs giving orders (DfT) ---
    { key: 'stop', file: '601.1.jpg', source: 'dft', diagram: '601.1', url: DFT.regulatory, name: 'Stop',
      meaning: 'Stop before crossing the traverse line on the road and ensure the way is clear before entering a major road',
      alt: 'Red eight-sided sign with the word STOP' },
    { key: 'giveWay', file: '602.jpg', source: 'dft', diagram: '602', url: DFT.regulatory, name: 'Give way',
      meaning: 'Give way to traffic on the major road',
      alt: 'Red-bordered triangle pointing down with the words GIVE WAY' },
    { key: 'noEntry', file: '616.jpg', source: 'dft', diagram: '616', url: DFT.regulatory, name: 'No entry',
      meaning: 'No entry for vehicular traffic',
      alt: 'Red circle with a white bar across the middle' },
    { key: 'noOvertaking', file: '632.jpg', source: 'dft', diagram: '632', url: DFT.regulatory, name: 'No overtaking',
      meaning: 'No overtaking',
      alt: 'Red-ringed circle with a black car and a red car side by side' },
    { key: 'speed20', file: '670V20.jpg', source: 'dft', diagram: '670', url: DFT.speed, name: '20 mph limit',
      meaning: 'Maximum speed limit of 20 miles per hour',
      alt: 'Red-ringed circle with the number 20' },
    { key: 'speed30', file: '670V30.jpg', source: 'dft', diagram: '670', url: DFT.speed, name: '30 mph limit',
      meaning: 'Maximum speed limit of 30 miles per hour',
      alt: 'Red-ringed circle with the number 30' },
    { key: 'speed50', file: '670V50.jpg', source: 'dft', diagram: '670', url: DFT.speed, name: '50 mph limit',
      meaning: 'Maximum speed limit of 50 miles per hour',
      alt: 'Red-ringed circle with the number 50' },
    { key: 'natLimit', file: '671.jpg', source: 'dft', diagram: '671', url: DFT.speed, name: 'National speed limit',
      meaning: 'National speed limits apply',
      alt: 'White circle with a black diagonal stripe' },
    { key: 'minSpeed', file: '672.jpg', source: 'dft', diagram: '672', url: DFT.speed, name: 'Minimum speed',
      meaning: 'Minimum speed limit of 30 miles per hour',
      alt: 'Blue circle with the number 30 in white' },
    { key: 'turnLeft', file: '606.jpg', source: 'dft', diagram: '606', url: DFT.regulatory, name: 'Turn left',
      meaning: 'Vehicular traffic must proceed in the direction indicated by the arrow',
      alt: 'Blue circle with a white arrow pointing left' },
    { key: 'cyclesOnly', file: '955.jpg', source: 'dft', diagram: '955', url: DFT.busCycle, name: 'Cycles only',
      meaning: 'Route for use by pedal cycles only',
      alt: 'Blue circle with a white bicycle' },
    { key: 'clearway', file: '642.jpg', source: 'dft', diagram: '642', url: DFT.parking, name: 'Clearway',
      meaning: 'No stopping on main carriageway',
      alt: 'Blue circle with a red border and a red cross' },
    // --- warning signs (DfT) ---
    { key: 'bendLeft', file: '512L.jpg', source: 'dft', diagram: '512', url: DFT.warning, name: 'Bend to the left',
      meaning: 'Bend ahead to the left',
      alt: 'Red-bordered triangle with a road bending to the left' },
    { key: 'roadNarrows', file: '516.jpg', source: 'dft', diagram: '516', url: DFT.warning, name: 'Road narrows',
      meaning: 'Road narrows on both sides ahead',
      alt: 'Red-bordered triangle with a road getting narrower on both sides' },
    { key: 'trafficLights', file: '543.jpg', source: 'dft', diagram: '543', url: DFT.warning, name: 'Traffic signals',
      meaning: 'Traffic signals ahead',
      alt: 'Red-bordered triangle with a set of traffic lights' },
    { key: 'zebra', file: '544.jpg', source: 'dft', diagram: '544', url: DFT.warning, name: 'Zebra crossing',
      meaning: 'Zebra crossing ahead',
      alt: 'Red-bordered triangle with a person walking over a striped crossing' },
    { key: 'schoolAhead', file: '545.jpg', source: 'dft', diagram: '545', url: DFT.warning, name: 'School children',
      meaning: 'Children going to or from school or playground ahead',
      alt: 'Red-bordered triangle with two children' },
    { key: 'ford', file: '554.jpg', source: 'dft', diagram: '554', url: DFT.warning, name: 'Ford',
      meaning: 'Ford warning sign',
      alt: 'Red-bordered triangle with the word Ford' },
    { key: 'slippery', file: '557.jpg', source: 'dft', diagram: '557', url: DFT.warning, name: 'Slippery road',
      meaning: 'Slippery road ahead',
      alt: 'Red-bordered triangle with a car and skid marks' },
    { key: 'levelCrossing', file: '770.jpg', source: 'dft', diagram: '770', url: DFT.levelCrossing, name: 'Level crossing',
      meaning: 'Level crossing with gate or barrier ahead',
      alt: 'Red-bordered triangle with a gate' },
    // --- information and direction signs (DfT) ---
    { key: 'oneWay', file: '652.jpg', source: 'dft', diagram: '652', url: DFT.regulatory, name: 'One way',
      meaning: 'One-way traffic',
      alt: 'Blue rectangle with a white arrow pointing up' },
    { key: 'speedCamera', file: '880.jpg', source: 'dft', diagram: '880', url: DFT.speed, name: 'Speed camera',
      meaning: 'Speed camera ahead and reminder of 30 miles per hour speed limit',
      alt: 'Blue sign with a camera symbol above a 30 in a red ring' },
    { key: 'motorway', file: '2901.jpg', source: 'dft', diagram: '2901', url: DFT.motorway, name: 'Start of motorway',
      meaning: 'Start of motorway regulations, including the national speed limit',
      alt: 'Blue sign with M62 and a motorway symbol' },
    { key: 'tourist', file: '2203.jpg', source: 'dft', diagram: '2203', url: DFT.tourist, name: 'Tourist sign',
      meaning: 'Direction and distance to a tourist attraction',
      alt: 'Brown sign reading Model village, 1½, with a chevron pointing left' },
    // --- road works (DfT) ---
    { key: 'roadWorks', file: '7001.jpg', source: 'dft', diagram: '7001', url: DFT.roadWorks, name: 'Road works',
      meaning: 'Road works or temporary obstruction of the carriageway ahead',
      alt: 'Red-bordered triangle with a person digging' },
    // --- traffic lights (The Highway Code, light signals) ---
    { key: 'lightRed', file: 'hc-traffic-light-red.jpg', source: 'hc', page: HC_PAGE.lights, url: HC_IMG + '559fbe1940f0b6156700004d/traffic-light-red.jpg', name: 'Red',
      meaning: 'RED means ‘Stop’. Wait behind the stop line on the carriageway',
      alt: 'Traffic light showing red' },
    { key: 'lightRedAmber', file: 'hc-traffic-light-red-amber.jpg', source: 'hc', page: HC_PAGE.lights, url: HC_IMG + '559fbe31e5274a155c000056/traffic-light-red-amber.jpg', name: 'Red and amber',
      meaning: 'RED AND AMBER also means ‘Stop’. Do not pass through or start until GREEN shows',
      alt: 'Traffic light showing red and amber together' },
    { key: 'lightGreen', file: 'hc-traffic-light-green.jpg', source: 'hc', page: HC_PAGE.lights, url: HC_IMG + '559fbe3e40f0b6156700004f/traffic-light-green.jpg', name: 'Green',
      meaning: 'GREEN means you may go on if the way is clear. Take special care if you intend to turn left or right and give way to pedestrians who are crossing',
      alt: 'Traffic light showing green' },
    { key: 'lightAmber', file: 'hc-traffic-light-amber.jpg', source: 'hc', page: HC_PAGE.lights, url: HC_IMG + '559fbe48ed915d1592000048/traffic-light-amber.jpg', name: 'Amber',
      meaning: 'AMBER means ‘Stop’ at the stop line. You may go on only if the AMBER appears after you have crossed the stop line or are so close to it that to pull up might cause an accident',
      alt: 'Traffic light showing amber' },
    { key: 'levelCrossingLights', file: 'hc-flashing-red-lights.jpg', source: 'hc', page: HC_PAGE.lights, url: HC_IMG + '559fbe92ed915d159200004a/flashing-red-lights.jpg', name: 'Flashing red lights',
      meaning: 'Alternately flashing red lights mean YOU MUST STOP. At level crossings, lifting bridges, airfields, fire stations, etc.',
      alt: 'Two red lights and an amber light on a black panel with a red and white border' },
    // --- motorway signals (The Highway Code, light signals) ---
    { key: 'redX', file: 'hc-motorway-signal-red-cross.jpg', source: 'hc', page: HC_PAGE.lights, url: HC_IMG + '559fbeb6ed915d159500003e/motorway-signal-red-cross.jpg', name: 'Red X',
      meaning: 'You MUST NOT proceed further in this lane',
      alt: 'Motorway signal with a red cross and flashing red lamps' },
    { key: 'motorwayAdvised', file: 'hc-motorway-signal-temporary-speed.jpg', source: 'hc', page: HC_PAGE.lights, url: HC_IMG + '559fbf5940f0b61567000051/motorway-signal-temporary-speed.jpg', name: 'Advised speed',
      meaning: 'Temporary maximum speed advised',
      alt: 'Motorway signal showing 50 with flashing amber lamps' },
    { key: 'motorwayLimit', file: 'hc-motorway-signal-mandatory-speed-limit.jpg', source: 'hc', page: HC_PAGE.lights, url: 'https://assets.publishing.service.gov.uk/media/613a08c58fa8f503c0fa759a/Obstruction_FINAL_.jpg', name: 'Speed limit over the lanes',
      meaning: 'You MUST NOT enter or proceed in the left lane, temporary mandatory maximum speed limit and information message',
      alt: 'Motorway signal with a red cross, three amber arrows, 40 in a red ring and the word Obstruction' },
    // --- road markings (The Highway Code, road markings) ---
    { key: 'centreLine', file: 'hc-along-carriageway-centre-line.jpg', source: 'hc', page: HC_PAGE.markings, url: HC_IMG + '55bb607ae5274a1545000004/along-carriageway-centre-line.jpg', name: 'Centre line',
      meaning: 'Centre line See Rule 127',
      alt: 'Road with a broken white line along the middle' },
    { key: 'doubleWhite', file: 'hc-along-carriageway-double-white-line.jpg', source: 'hc', page: HC_PAGE.markings, url: HC_IMG + '55bb60eee5274a1548000007/along-carriageway-double-white-line.jpg', name: 'Double white lines',
      meaning: 'Double white lines See Rules 128 and 129',
      alt: 'Road with two solid white lines along the middle' },
    { key: 'doubleYellow', file: 'hc-along-edge-carriageway-double-yellow.jpg', source: 'hc', page: HC_PAGE.markings, url: HC_IMG + '55bb62db40f0b6154e00000d/along-edge-carriageway-double-yellow.jpg', name: 'Double yellow lines',
      meaning: 'No waiting at any time',
      alt: 'Two yellow lines along the edge of the road' },
    { key: 'boxJunction', file: 'hc-other-road-markings-box-junction.jpg', source: 'hc', page: HC_PAGE.markings, url: HC_IMG + '55bb8b4740f0b61551000012/other-road-markings-box-junction.jpg', name: 'Box junction',
      meaning: 'Box junction - See Rule 174',
      alt: 'Criss-cross yellow lines painted on the road' }
  ];
  // A DfT sign's page is the DfT guidance page; a Highway Code picture names its own page above.
  LIST.forEach(function (s) { if (!s.page) s.page = SOURCES[s.source].page; });

  // Look a key up once, not by searching the list every time a question is drawn.
  var BY_KEY = {};
  LIST.forEach(function (s) { BY_KEY[s.key] = s; });

  var FOLDER = 'signs/';     // where the pictures live, next to the page
  var QUIZ_SIZE = 20;        // "Quiz me on the signs": at most this many questions

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

  window.TTSigns = {
    list: LIST,
    sources: SOURCES,
    licenceUrl: LICENCE_URL,
    folder: FOLDER,
    quizSize: QUIZ_SIZE,
    // The entry for a key, or null when there is no picture for it.
    get: function (key) { return (key && Object.prototype.hasOwnProperty.call(BY_KEY, key)) ? BY_KEY[key] : null; },
    has: function (key) { return !!window.TTSigns.get(key); },
    // The picture's address, relative to the page (the app and adventure.html both sit at the root).
    src: function (key) { var s = window.TTSigns.get(key); return s ? FOLDER + s.file : ''; },
    // The credit lines to show wherever the pictures are shown: one per source actually used.
    credits: function () {
      var used = {};
      LIST.forEach(function (s) { used[s.source] = true; });
      return Object.keys(SOURCES).filter(function (k) { return used[k]; }).map(function (k) { return SOURCES[k].credit; });
    },
    // The signs quiz: ids of bank questions that carry a picture we can show, in a random
    // order, at most quizSize of them. Only real bank questions — nothing is made up here.
    quizIds: function (questions, rnd) {
      var withPicture = (questions || []).filter(function (q) { return q && window.TTSigns.has(q.imageHint); });
      return shuffled(withPicture, rnd || Math.random).slice(0, QUIZ_SIZE).map(function (q) { return q.id; });
    }
  };

  // ---------- the picture itself ----------
  // <x-import component-from-global-scope="SignImage" hint="stop" size="128"> draws this.
  // The picture sits on a white rounded card with a little padding, so a sign with a white edge
  // still reads on the dark theme. The outer box has role "img" and the name "Road sign picture":
  // the name says what it is, not what the sign means — on a question the meaning is the answer
  // (WCAG 1.1.1 allows this for a test). An unknown key draws nothing.
  // adventure.html has no React: it reads the HTML out of dangerouslySetInnerHTML, so the card
  // must be inside that HTML, not on the outer box.
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  window.SignImage = function (props) {
    var s = window.TTSigns.get(props.hint);
    if (!s) return null;
    var size = props.size || 120;
    var img = '<img src="' + esc(FOLDER + s.file) + '" alt="' + esc(s.alt) + '" loading="lazy" decoding="async"'
      + ' style="display:block;width:100%;height:100%;object-fit:contain;box-sizing:border-box;padding:6%;background:#fff;border-radius:14%">';
    return React.createElement('div', {style: {width: size, height: size, flex: 'none', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.12))'}, role:'img', 'aria-label':'Road sign picture', dangerouslySetInnerHTML: {__html: img}});
  };
})();
