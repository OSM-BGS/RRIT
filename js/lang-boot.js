(function () {
  // 1) Prefer explicit URL override (?lang=fr|en)
  var url; try { url = new URL(window.location.href); } catch(e) {}
  var qLang = (url && (url.searchParams.get('lang') || '').toLowerCase()) || '';

  // 2) Detect browser/system language
  var locale = (navigator.languages && navigator.languages[0]) ||
               navigator.language || navigator.userLanguage || 'en';
  var auto = (locale || 'en').slice(0,2).toLowerCase();
  if (auto !== 'fr') auto = 'en';

  // 3) Decide initial language (query > auto)
  var lang = (qLang === 'fr' || qLang === 'en') ? qLang : auto;

  // 4) Apply immediately for screen readers/CSS
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.classList.remove('no-js');

  // 5) Hand off to RRIT JS
  window.rrit_initialLang = lang;
})();
