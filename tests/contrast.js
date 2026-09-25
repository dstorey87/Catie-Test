// WCAG 2 contrast ratio between two colours written #rrggbb or #rgb, shared by the test files
// that check colours (tests/app-files.test.js for the app, tests/help-pages.test.js for the help
// and legal pages), so the sum lives in one place. Not a test itself: `node --test` only runs
// files named *.test.js.
//
// How it works: each colour's "relative luminance" (how bright it looks, 0 for black to 1 for
// white) is worked out, then ratio = (brighter + 0.05) / (darker + 0.05). Words need 4.5:1,
// large words and the edges of controls 3:1 (WCAG 1.4.3 and 1.4.11).
function contrast(a, b) {
  const lum = h => {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');   // #abc is short for #aabbcc
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
      .map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
      .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  };
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

module.exports = { contrast };
