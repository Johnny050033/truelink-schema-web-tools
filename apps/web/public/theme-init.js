/*
 * Applies the saved theme and language before the app renders, avoiding a flash.
 * Same contract as the TrueLink site (tl-theme.js): light unless the user chose otherwise,
 * applied as <html data-tl-theme>. A same-origin tl_theme choice seeds a first run.
 */
(function () {
  var root = document.documentElement;
  var theme = 'light';
  // Same values as LOCALE_INFO[locale].htmlLang in truelink-schema-document (checked by a test).
  var HTML_LANG = { en: 'en', 'zh-TW': 'zh-Hant-TW', 'zh-CN': 'zh-Hans-CN', ja: 'ja', es: 'es', 'pt-BR': 'pt-BR', id: 'id' };
  try {
    var prefs = JSON.parse(localStorage.getItem('truelink-schema-studio:v1:prefs') || 'null');
    if (prefs && (prefs.theme === 'light' || prefs.theme === 'dark' || prefs.theme === 'system')) {
      theme = prefs.theme;
    } else {
      var shared = localStorage.getItem('tl_theme');
      if (shared === 'light' || shared === 'dark') theme = shared;
    }
    if (prefs && Object.prototype.hasOwnProperty.call(HTML_LANG, prefs.locale)) root.lang = HTML_LANG[prefs.locale];
  } catch (error) {
    /* storage unavailable: keep the light default */
  }
  if (theme === 'system') {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  root.setAttribute('data-tl-theme', theme);
})();
