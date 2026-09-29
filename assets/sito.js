/* =============================================================================
   IDRAL — sito · comportamenti comuni a tutte le pagine
   ============================================================================= */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // Testata che si stacca dal contenuto quando si scorre.
  var hdr = $('#hdr'), su = $('.su');
  function scorri() {
    if (hdr) hdr.classList.toggle('stuck', scrollY > 10);
    if (su) su.classList.toggle('on', scrollY > 900);
  }
  addEventListener('scroll', scorri, { passive: true }); scorri();
  if (su) su.addEventListener('click', function () { scrollTo({ top: 0, behavior: 'smooth' }); });

  // Apparizione leggera delle sezioni. Senza IntersectionObserver si vede tutto subito.
  var rv = $$('.rv');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: .08, rootMargin: '0px 0px -40px 0px' });
    rv.forEach(function (e) { io.observe(e); });
  } else rv.forEach(function (e) { e.classList.add('in'); });

  // Menu del telefono.
  var burger = $('.burger'), mnav = $('.mnav');
  if (burger && mnav) {
    burger.addEventListener('click', function () {
      var aperto = mnav.classList.toggle('aperto');
      document.body.classList.toggle('menu-aperto', aperto);
      burger.setAttribute('aria-expanded', aperto ? 'true' : 'false');
    });
    $$('a', mnav).forEach(function (a) { a.addEventListener('click', function () { mnav.classList.remove('aperto'); document.body.classList.remove('menu-aperto'); burger.setAttribute('aria-expanded', 'false'); }); });
  }

  // Anno nel piede.
  $$('[data-anno]').forEach(function (e) { e.textContent = new Date().getFullYear(); });

  // ---------------------------------------------------------------------------
  // Modulo «Richiedi un preventivo»
  // ---------------------------------------------------------------------------
  // La richiesta NON finisce in un'email da ricopiare a mano: entra nel
  // gestionale come «richiesta dal sito», che e' esattamente il buco che il
  // gestionale esiste per chiudere (Assessment sito, §8).
  // ⚠️ DEMO: il gestionale di prova vive nella memoria di questo browser, quindi
  // la richiesta la vede chi apre l'area riservata DA QUESTO STESSO BROWSER.
  // In produzione va al database e la vede l'ufficio ovunque sia.
  var CHIAVE = 'idral.demo.v1', IN_ATTESA = 'idral.demo.richiesteSito';
  function uid() { return 'ric_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function riduci(file) {
    return new Promise(function (ok) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        ok(c.toDataURL('image/jpeg', .7));
      };
      img.onerror = function () { URL.revokeObjectURL(url); ok(null); };
      img.src = url;
    });
  }
  function consegna(r) {
    try {
      var s = localStorage.getItem(CHIAVE);
      if (s) {
        var db = JSON.parse(s);
        db.richieste.unshift(r);
        db.avvisi.unshift({ id: 'avv_' + r.id, a: 'ufficio', testo: 'Nuova richiesta dal sito: ' + r.nome + ' — ' + (r.tipo === 'preventivo' ? 'chiede un preventivo' : r.tipo === 'sopralluogo' ? 'chiede un sopralluogo' : r.tipo === 'guasto' ? 'segnala un guasto' : 'chiede un intervento'), link: '#/u/richieste', data: r.data, letto: false, tipo: 'richiesta' });
        if (r.email) db.email.unshift({ id: 'eml_' + r.id, data: r.data, a: r.email, oggetto: 'IDRAL — abbiamo ricevuto la sua richiesta', testo: 'Gentile ' + r.nome + ', abbiamo ricevuto la sua richiesta. La richiamiamo entro 48 ore lavorative.' });
        db.registro.unshift({ id: 'reg_' + r.id, data: r.data, utenteId: null, chi: 'sito web', azione: 'richiesta dal sito', dettaglio: r.nome });
        localStorage.setItem(CHIAVE, JSON.stringify(db));
      } else {
        // Il gestionale non e' mai stato aperto in questo browser: la richiesta
        // aspetta qui e ci entra al primo avvio.
        var att = JSON.parse(localStorage.getItem(IN_ATTESA) || '[]'); att.push(r);
        localStorage.setItem(IN_ATTESA, JSON.stringify(att));
      }
      return true;
    } catch (e) { return false; }
  }
  $$('form[data-preventivo]').forEach(function (f) {
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var err = $('.errore-mod', f); if (err) err.remove();
      var d = {}; new FormData(f).forEach(function (v, k) { if (typeof v === 'string') d[k] = v.trim(); });
      if (d.sito) return; // campo trappola: lo compilano solo i robot
      var mancano = [];
      if (!d.nome) mancano.push('nome');
      if (!d.telefono && !d.email) mancano.push('un telefono o un\'email');
      if (!d.descrizione) mancano.push('due righe sul lavoro');
      if (!$('[name=privacy]', f).checked) mancano.push('il consenso al trattamento dei dati');
      if (mancano.length) {
        f.insertAdjacentHTML('afterbegin', '<div class="errore-mod" role="alert">Manca: ' + mancano.join(', ') + '.</div>');
        return;
      }
      var btn = $('button[type=submit]', f); btn.disabled = true; btn.textContent = 'Invio in corso…';
      var files = Array.prototype.slice.call(($('input[type=file]', f) || {}).files || []).slice(0, 3);
      Promise.all(files.map(riduci)).then(function (foto) {
        var r = { id: uid(), origine: 'sito', clienteId: null, nome: d.nome, telefono: d.telefono || '', email: d.email || '', indirizzo: [d.indirizzo, d.citta].filter(Boolean).join(', '), tipo: d.tipo || 'preventivo', urgenza: d.urgenza || 'quando_potete', sedeId: null, descrizione: d.descrizione, stato: 'nuova', data: new Date().toISOString(), interventoId: null, foto: foto.filter(Boolean) };
        var ok = consegna(r);
        f.outerHTML = '<div class="esito" role="status"><b>Grazie ' + r.nome.replace(/[<>&]/g, '') + ', richiesta ricevuta.</b>Vi richiamiamo entro 48 ore lavorative per fissare il sopralluogo. Se è un\'urgenza, chiamateci subito.' +
          (ok ? '<p style="margin-top:12px;font-size:13.5px;opacity:.85">Demo: la richiesta è già entrata nel gestionale. <a href="' + (f.dataset.gestionale || 'gestionale/') + '#/accesso?porta=personale">Apri l\'area riservata come titolare</a> e la trovi in «Richieste».</p>' : '') + '</div>';
      });
    });
  });
})();
