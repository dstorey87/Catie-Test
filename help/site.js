// Theory Trainer help and legal pages — the little bit of script they share.
//
// 1. Theme: the app saves the learner's choice (Settings → Appearance) in localStorage
//    under `tt.theme` as 'auto', 'light' or 'dark'. These pages read the same key, so the
//    guide looks the way the app does. 'light'/'dark' set <html data-theme>; 'auto' (or
//    nothing saved) removes it and site.css follows the device's own dark mode.
//    Loaded in <head> without defer, so the theme is set before the page is drawn.
// 2. Live figures: prices, the free-sample size and the age rule live in config.js
//    (window.TT_CONFIG). Any element with data-config="<key>" (or "<key>.<inner key>" for a
//    nested setting such as age.guardianUnder) gets that value, so changing config.js changes
//    every page. The text already in the element is the fallback when config.js is missing
//    (tests/help-pages.test.js checks the fallback matches config.js).
//
// Written as a small module so Node can test it: in a browser it runs itself; in Node,
// require() returns the functions.
(function (root) {
  'use strict';

  var THEME_KEY = 'tt.theme';

  // Reads the saved choice. Storage can throw (private mode, blocked site data) — then we
  // just follow the device, which is what 'auto' means anyway.
  function savedTheme(storage) {
    try {
      var v = storage && storage.getItem(THEME_KEY);
      return v === 'light' || v === 'dark' ? v : 'auto';
    } catch (e) {
      return 'auto';
    }
  }

  // Puts the choice on <html>. `el` is document.documentElement (or a stand-in in tests).
  function applyTheme(el, storage) {
    var choice = savedTheme(storage);
    if (choice === 'auto') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', choice);
    return choice;
  }

  // Looks up "priceMonthly" or a nested setting such as "age.guardianUnder".
  function configValue(cfg, key) {
    var parts = String(key || '').split('.'), v = cfg;
    for (var i = 0; i < parts.length; i++) {
      if (v === null || typeof v !== 'object' || !Object.prototype.hasOwnProperty.call(v, parts[i])) return undefined;
      v = v[parts[i]];
    }
    return v;
  }

  // Copies config values into [data-config] elements. Only plain strings and numbers are
  // used, and textContent (never innerHTML), so config can't inject markup.
  function fillConfig(doc, cfg) {
    var filled = 0;
    if (!doc || !cfg) return filled;
    var els = doc.querySelectorAll('[data-config]');
    for (var i = 0; i < els.length; i++) {
      var v = configValue(cfg, els[i].getAttribute('data-config'));
      if ((typeof v === 'string' && v.trim()) || typeof v === 'number') {
        els[i].textContent = String(v);
        filled++;
      }
    }
    return filled;
  }

  // 3. Contents: a long list is in the way on a phone but useful beside the page on a wide
  //    screen. <details data-open-wide> starts closed and is opened when the screen is wide.
  function openWide(doc, wide) {
    var els = doc ? doc.querySelectorAll('details[data-open-wide]') : [];
    for (var i = 0; i < els.length; i++) els[i].open = !!wide;
    return els.length;
  }

  var WIDE = '(min-width: 960px)';   // the width where site.css puts the contents beside the page
  var api = { THEME_KEY: THEME_KEY, WIDE: WIDE, savedTheme: savedTheme, applyTheme: applyTheme, configValue: configValue, fillConfig: fillConfig, openWide: openWide };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }

  // ---------- in the browser ----------
  var store = null;
  try { store = root.localStorage; } catch (e) { store = null; }
  applyTheme(root.document.documentElement, store);

  // If the app is open in another tab and the theme is changed there, follow it here too.
  root.addEventListener('storage', function (e) {
    if (e.key === THEME_KEY) applyTheme(root.document.documentElement, store);
  });

  // config.js loads before this file; the page body isn't parsed yet, so wait for it.
  root.document.addEventListener('DOMContentLoaded', function () {
    fillConfig(root.document, root.TT_CONFIG);
    try { openWide(root.document, root.matchMedia(WIDE).matches); } catch (e) { /* old browser: stays closed */ }
  });
  root.TTHelp = api;
})(this);
