// Prova dei colori: aggiungendo ?tema=calmo, ?tema=notte o ?tema=carta all'indirizzo si vede una delle tavolozze in prova.
// Senza parametro il sito resta com'è. Non salva nulla: vale solo per la pagina aperta con quel link.
(function () {
  var TEMI = { calmo: "#5B161F", notte: "#140D0D", carta: "#691421" };
  var m = /[?&]tema=([a-z]+)/.exec(location.search), t = m && TEMI[m[1]] ? m[1] : "";
  if (!t) return;
  document.documentElement.setAttribute("data-tema", t);
  var barra = document.querySelector('meta[name="theme-color"]');
  if (barra) barra.setAttribute("content", TEMI[t]);
})();
