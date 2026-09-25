// Theory Trainer — the about page's only script (about.html).
// Two jobs, both small:
//   1. Light or dark: follow the choice the learner saved in the app (Settings → Appearance,
//      stored as localStorage 'tt.theme'), or the device when there is no saved choice.
//   2. Prices: fill the page's price words from config.js (window.TT_CONFIG), so the page
//      never states a price or free-sample size that the app does not charge or give.
// The logic is plain functions on window.TTAbout, and the tests (tests/about-page.test.js)
// load this same file in Node — so what is tested is exactly what the page runs.
(function (root) {
  // ---------- 1. theme ----------

  // The app saves 'light', 'dark' or 'auto'. Returns the data-theme value to set on <html>,
  // or null for "follow the device" (the page's CSS handles that with prefers-color-scheme).
  function themeFor(saved) {
    return saved === 'light' || saved === 'dark' ? saved : null;
  }

  // Reads the saved choice and applies it to <html>. Storage can be blocked (private
  // browsing, strict settings): then the page simply follows the device.
  function applyTheme(doc, storage) {
    var saved = null;
    try { saved = storage && storage.getItem('tt.theme'); } catch (e) { saved = null; }
    var t = themeFor(saved);
    if (t) doc.documentElement.setAttribute('data-theme', t);
    else doc.documentElement.removeAttribute('data-theme');
    return t;
  }

  // ---------- 2. prices ----------

  // The three facts the page shows, taken from config.js. Returns null unless all three are
  // usable — a half-filled price line ("Try  questions free") is worse than none, so the
  // page then shows its fallback sentence instead.
  function priceFacts(cfg) {
    if (!cfg) return null;
    var monthly = typeof cfg.priceMonthly === 'string' ? cfg.priceMonthly.trim() : '';
    var annual = typeof cfg.priceAnnual === 'string' ? cfg.priceAnnual.trim() : '';
    var trial = Number(cfg.trialCount);
    if (!monthly || !annual || !(trial > 0) || Math.floor(trial) !== trial) return null;
    return { monthly: monthly, annual: annual, trial: String(trial) };
  }

  // Puts the facts into the page:
  //   <span data-fact="monthly|annual|trial">   gets the value as its text;
  //   [data-needs-prices]                        shown only when the facts are known;
  //   [data-no-prices]                           shown only when they are not (the fallback).
  // Uses textContent, never innerHTML, so nothing in config.js can inject markup.
  function fill(doc, facts) {
    var each = function (sel, fn) { Array.prototype.forEach.call(doc.querySelectorAll(sel), fn); };
    if (facts) each('[data-fact]', function (el) {
      var v = facts[el.getAttribute('data-fact')];
      if (v !== undefined) el.textContent = v;
    });
    each('[data-needs-prices]', function (el) { el.hidden = !facts; });
    each('[data-no-prices]', function (el) { el.hidden = !!facts; });
    return !!facts;
  }

  var api = { themeFor: themeFor, applyTheme: applyTheme, priceFacts: priceFacts, fill: fill };

  // In a browser: apply the theme at once (this file loads in <head>, before the page is
  // drawn, so there is no flash of the wrong colours), then fill prices once the page exists.
  if (root && root.document) {
    root.TTAbout = api;
    var storage = null;
    try { storage = root.localStorage; } catch (e) { storage = null; }
    applyTheme(root.document, storage);
    var run = function () {
      try { fill(root.document, priceFacts(root.TT_CONFIG)); }
      catch (e) {
        // Never break the page over prices: the fallback sentence stays visible.
        if (root.console) root.console.error('about page: could not fill prices from config.js (' +
          e.message + '). The fallback sentence is shown; check config.js loads and has priceMonthly, priceAnnual and trialCount.');
      }
    };
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', run);
    else run();
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : null);
