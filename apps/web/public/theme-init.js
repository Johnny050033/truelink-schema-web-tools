/* Applies the saved theme and language before the app renders, avoiding a flash. */
(function () {
  var root = document.documentElement;
  var theme = 'system';
  try {
    var prefs = JSON.parse(localStorage.getItem('truelink-schema-studio:v1:prefs') || 'null');
    if (prefs && (prefs.theme === 'light' || prefs.theme === 'dark')) theme = prefs.theme;
    if (prefs && prefs.locale === 'en') root.lang = 'en';
  } catch (error) {
    /* storage unavailable: fall back to the system theme */
  }
  if (theme === 'system') {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  root.setAttribute('data-theme', theme);
})();
