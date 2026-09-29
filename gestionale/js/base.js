/* =============================================================================
   IDRAL — gestionale (demo) · il nucleo
   -----------------------------------------------------------------------------
   Tutto quello che le tre superfici (tecnico, ufficio, cliente) usano in comune:
   archivio, accesso, router, notifiche, componenti.

   ⚠️ QUESTA E' UNA DEMO. L'archivio e' il localStorage del browser: niente
   server, niente database condiviso. Serve a far provare il flusso completo ad
   Andrea prima di costruire il prodotto vero (OPERA, prompt master v1.2), dove
   l'archivio e' Postgres con RLS per azienda e per ruolo.
   Le regole di prodotto pero' valgono gia' qui: il tecnico non vede prezzi, il
   cliente non vede note e foto interne, le foto nascono NON visibili al cliente.

   API esposta su window.A (vedi in fondo al file l'elenco completo).
   ============================================================================= */
(function () {
  'use strict';

  const CHIAVE = 'idral.demo.v1';
  const CHIAVE_SESSIONE = 'idral.demo.sessione';
  const CHIAVE_RICORDA = 'idral.demo.ricordami';
  const CHIAVE_RETE = 'idral.demo.senzarete';

  // ---------------------------------------------------------------------------
  // Piccoli attrezzi
  // ---------------------------------------------------------------------------
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /** Escape HTML. Tutto quello che viene da un campo compilato passa da qui. */
  function h(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function uid(pref) {
    const r = (crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2))).replace(/-/g, '').slice(0, 10);
    return (pref ? pref + '_' : '') + r;
  }

  // ---- date: tutto in ISO locale 'YYYY-MM-DD' per i giorni, ISO completo per gli istanti
  function pad(n) { return String(n).padStart(2, '0'); }
  function isoGiorno(d) { d = d instanceof Date ? d : new Date(d); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function oggi() { return isoGiorno(new Date()); }
  function adesso() { return new Date().toISOString(); }
  function daGiorno(iso) { const [y, m, g] = iso.split('-').map(Number); return new Date(y, m - 1, g); }
  function piuGiorni(iso, n) { const d = daGiorno(iso); d.setDate(d.getDate() + n); return isoGiorno(d); }
  function diffGiorni(a, b) { return Math.round((daGiorno(b) - daGiorno(a)) / 86400000); }
  function lunedi(iso) { const d = daGiorno(iso); const g = (d.getDay() + 6) % 7; d.setDate(d.getDate() - g); return isoGiorno(d); }
  const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  const GIORNI_BREVI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

  /** '2026-09-28' -> '28/09/2026' ; accetta anche ISO completi */
  function data(v) {
    if (!v) return '—';
    const d = v.length === 10 ? daGiorno(v) : new Date(v);
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
  }
  /** 'lunedì 28 settembre' */
  function dataLunga(v) {
    const d = v.length === 10 ? daGiorno(v) : new Date(v);
    return GIORNI[d.getDay()] + ' ' + d.getDate() + ' ' + MESI[d.getMonth()];
  }
  /** '28 set' */
  function dataBreve(v) {
    const d = v.length === 10 ? daGiorno(v) : new Date(v);
    return d.getDate() + ' ' + MESI_BREVI[d.getMonth()];
  }
  function ora(v) { if (!v) return ''; const d = new Date(v); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function dataOra(v) { if (!v) return '—'; return data(v) + ' ' + ora(v); }
  /** «oggi alle 14:32», «ieri alle 9:10», «3 giorni fa» */
  function quando(v) {
    if (!v) return '—';
    const d = new Date(v); const g = diffGiorni(isoGiorno(d), oggi());
    if (g === 0) return 'oggi alle ' + ora(v);
    if (g === 1) return 'ieri alle ' + ora(v);
    if (g < 7) return g + ' giorni fa';
    return data(v);
  }
  /** minuti -> '1 h 25 min' */
  function durata(min) {
    min = Math.round(min || 0);
    const hh = Math.floor(min / 60), mm = min % 60;
    if (!hh) return mm + ' min';
    return hh + ' h' + (mm ? ' ' + mm + ' min' : '');
  }
  function oreDecimali(min) { return (Math.round((min || 0) / 60 * 100) / 100).toLocaleString('it-IT', { maximumFractionDigits: 2 }); }

  // ---- numeri
  const fmtEuro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
  const fmtEuro0 = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  /** euro(1234.5) -> '1.234,50 €' ; euro(x, true) senza decimali */
  function euro(n, tondo) { return (tondo ? fmtEuro0 : fmtEuro).format(Number(n) || 0); }
  function num(n, dec) { return (Number(n) || 0).toLocaleString('it-IT', { maximumFractionDigits: dec === undefined ? 2 : dec }); }
  function arrot(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function iniziali(nome) { return String(nome || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase(); }

  // ---------------------------------------------------------------------------
  // Icone — tratto 24x24 stile «lucide». icona('casa') -> <svg>
  // ---------------------------------------------------------------------------
  const IC = {
    casa: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    cruscotto: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    calendario: '<rect x="3" y="4.5" width="18" height="17" rx="2"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/>',
    chiave: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.4-3.4a6 6 0 0 1-7.9 7.9l-6.4 6.4a2.1 2.1 0 0 1-3-3l6.4-6.4a6 6 0 0 1 7.9-7.9z"/>',
    documento: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    verifica: '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="m9 14 2 2 4-4"/>',
    persone: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-1.5A4.5 4.5 0 0 1 6.5 15h5a4.5 4.5 0 0 1 4.5 4.5V21M16 3.1a4 4 0 0 1 0 7.8M22 21v-1.5a4.5 4.5 0 0 0-3-4.2"/>',
    utente: '<circle cx="12" cy="7.5" r="4"/><path d="M4 21v-1a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v1"/>',
    pacco: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8M7.5 5.5l9 5"/>',
    furgone: '<path d="M1 4h14v12H1zM15 8h4.5L23 11.5V16h-8"/><circle cx="5.5" cy="18" r="2.2"/><circle cx="18.5" cy="18" r="2.2"/>',
    mappa: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    naviga: '<path d="M3 11 21 3l-8 18-2-8z"/>',
    telefono: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    messaggio: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    campanella: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    fotocamera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    orologio: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    spunta: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    piu: '<path d="M12 5v14M5 12h14"/>',
    meno: '<path d="M5 12h14"/>',
    cerca: '<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.6-4.6"/>',
    destra: '<path d="m9 18 6-6-6-6"/>',
    sinistra: '<path d="m15 18-6-6 6-6"/>',
    giu: '<path d="m6 9 6 6 6-6"/>',
    indietro: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    avanti: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    esci: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    regolazioni: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    grafico: '<path d="M3 3v18h18"/><path d="M8 17v-5M13 17V8M18 17v-9"/>',
    posta: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
    arrivo: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
    scudo: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    elenco: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    penna: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    senzarete: '<path d="m2 2 20 20M16.7 11.1A11 11 0 0 1 19 12.6M5 12.6a11 11 0 0 1 5.2-2.4M10.7 5.1A16 16 0 0 1 22.6 9M1.4 9a16 16 0 0 1 4.7-2.9M8.5 16.1a6 6 0 0 1 7 0M12 20h.01"/>',
    rete: '<path d="M5 12.6a11 11 0 0 1 14 0M1.4 9a16 16 0 0 1 21.2 0M8.5 16.1a6 6 0 0 1 7 0M12 20h.01"/>',
    ricarica: '<path d="M21 3v6h-6M3 21v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L21 9M3 15l2.6 3.4A9 9 0 0 0 20.5 15"/>',
    invia: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
    scarica: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    carica: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    stampa: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
    euro: '<path d="M18 7a7 7 0 1 0 0 10M4 10h10M4 14h10"/>',
    goccia: '<path d="M12 2.7 17.7 8.3a8 8 0 1 1-11.3 0z"/>',
    fiamma: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.4 1.4 1.3 2.8 2.5 2.8z"/>',
    attenzione: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    occhio: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    occhiochiuso: '<path d="M17.9 17.9A10.1 10.1 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2M1 1l22 22"/>',
    lucchetto: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    play: '<path d="M6 4l14 8-14 8z"/>',
    pausa: '<path d="M7 4h3v16H7zM14 4h3v16h-3z"/>',
    stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
    etichetta: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    edificio: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
    carrello: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
    cestino: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    modifica: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    copia: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    esterno: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/>',
    filtro: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
    stella: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    storico: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
    graffetta: '<path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
    impianto: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 6h6M9 10h6"/><circle cx="12" cy="16" r="2.5"/>',
    scatola: '<path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/>',
    ingranaggio: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    microfono: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"/>',
    fulmine: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    punti: '<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>'
  };
  /** icona('casa', 'g') — secondo parametro: classi extra (g = grande, p = piccola) */
  function icona(nome, cl) {
    return '<svg class="ic ' + (cl || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (IC[nome] || IC.info) + '</svg>';
  }
  const GOCCIA = '<svg viewBox="0 0 24 24"><path d="M12 2C12 2 5 10.2 5 14.8 5 18.8 8.1 22 12 22s7-3.2 7-7.2C19 10.2 12 2 12 2z"/></svg>';
  function marchio(sottotitolo) {
    return '<span class="marchio"><span class="g">' + GOCCIA + '</span><span class="nm">IDRAL<small>' + h(sottotitolo || 'Soluzioni per la tua casa') + '</small></span></span>';
  }

  // ---------------------------------------------------------------------------
  // ARCHIVIO
  // ---------------------------------------------------------------------------
  let DB = null;
  const ascoltatori = [];

  function carica() {
    try {
      const s = localStorage.getItem(CHIAVE);
      if (s) { DB = JSON.parse(s); if (DB && DB.versione === 1) return; }
    } catch (e) { console.warn('archivio illeggibile, riparto dai dati di prova', e); }
    DB = window.SEME();
    scrivi();
  }
  // Richieste lasciate dal modulo del sito quando il gestionale non era ancora
  // mai stato aperto in questo browser (vedi assets/sito.js).
  function accogliRichiesteSito() {
    let att = [];
    try { att = JSON.parse(localStorage.getItem('idral.demo.richiesteSito') || '[]'); } catch (_) { }
    if (!att.length) return;
    att.forEach(r => {
      if (DB.richieste.some(x => x.id === r.id)) return;
      DB.richieste.unshift(r);
      DB.avvisi.unshift({ id: 'avv_' + r.id, a: 'ufficio', testo: 'Nuova richiesta dal sito: ' + r.nome, link: '#/u/richieste', data: r.data, letto: false, tipo: 'richiesta' });
    });
    localStorage.removeItem('idral.demo.richiesteSito');
    scrivi();
  }
  function scrivi() {
    try {
      localStorage.setItem(CHIAVE, JSON.stringify(DB));
      return true;
    } catch (e) {
      // La memoria del browser e' piccola (~5 MB) e le foto la riempiono in
      // fretta. Meglio dirlo chiaro che perdere in silenzio l'ultima modifica.
      toast('Memoria della demo piena: elimina qualche foto o azzera i dati (Impostazioni).', 'per', 6000);
      return false;
    }
  }
  /** Modifica l'archivio e salva. fn riceve DB. Ritorna il valore di fn. */
  function modifica(fn) {
    const r = fn(DB);
    DB.aggiornato = adesso();
    scrivi();
    return r;
  }
  function azzera() { localStorage.removeItem(CHIAVE); DB = window.SEME(); scrivi(); }

  // Sincronizzazione «in tempo reale» fra schede dello stesso browser: apri il
  // titolare in una finestra e il tecnico in un'altra, e le modifiche passano.
  window.addEventListener('storage', e => {
    if (e.key !== CHIAVE || !e.newValue) return;
    try { DB = JSON.parse(e.newValue); } catch (_) { return; }
    const att = document.activeElement;
    const staScrivendo = att && /^(INPUT|TEXTAREA|SELECT)$/.test(att.tagName) && att.type !== 'checkbox' && att.type !== 'radio';
    const modaleAperta = !!$('.velo');
    if (staScrivendo || modaleAperta || firmaInCorso) { mostraAggiornamento(); return; }
    render();
    ascoltatori.forEach(f => f());
  });
  let firmaInCorso = false;
  function mostraAggiornamento() {
    if ($('#agg-dati')) return;
    const d = document.createElement('div');
    d.id = 'agg-dati';
    d.innerHTML = '<div class="toast" style="cursor:pointer">' + icona('ricarica') + ' Nuovi dati da un altro utente — tocca per aggiornare</div>';
    d.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:260';
    d.onclick = () => { d.remove(); render(); };
    document.body.appendChild(d);
  }

  // ---- ricerche comuni
  const trova = (coll, id) => (DB[coll] || []).find(x => x.id === id) || null;
  const cliente = id => trova('clienti', id);
  const sede = id => trova('sedi', id);
  const impianto = id => trova('impianti', id);
  const articolo = id => trova('articoli', id);
  const utenteDa = id => trova('utenti', id);
  const intervento = id => trova('interventi', id);
  const preventivo = id => trova('preventivi', id);
  const tecnici = () => DB.utenti.filter(u => u.ruolo === 'tecnico' && u.attivo !== false);
  const sediDi = clienteId => DB.sedi.filter(s => s.clienteId === clienteId);
  const impiantiDi = clienteId => DB.impianti.filter(s => s.clienteId === clienteId);
  function indirizzo(s) { if (!s) return ''; return s.indirizzo + (s.citta ? ', ' + s.citta : ''); }
  function nomeTecnici(ids) { return (ids || []).map(id => (utenteDa(id) || {}).nome || '?').join(', ') || 'da assegnare'; }
  function nomeBreve(nome) { const p = String(nome || '').split(' '); return p.length > 1 ? p[0] + ' ' + p[p.length - 1][0] + '.' : nome; }

  /** Numerazione per anno: numera('INT') -> '2026-0419'. Contatore in DB.contatori. */
  function numera(tipo) {
    const anno = new Date().getFullYear();
    const k = tipo + '-' + anno;
    DB.contatori[k] = (DB.contatori[k] || 0) + 1;
    return anno + '-' + String(DB.contatori[k]).padStart(4, '0');
  }

  /** Registro delle azioni (audit). Si chiama dentro modifica() o subito dopo. */
  function registra(azione, dettaglio) {
    const u = utente();
    DB.registro.unshift({ id: uid('reg'), data: adesso(), utenteId: u ? u.id : null, chi: u ? u.nome : 'sito web', azione, dettaglio: dettaglio || '' });
    if (DB.registro.length > 600) DB.registro.length = 600;
  }

  /**
   * Avviso in-app. a: 'ufficio' (titolare + ufficio), un id utente, oppure
   * 'cliente:<clienteId>' (tutti gli utenti cliente collegati a quel cliente).
   * Se il destinatario e' un cliente, parte anche l'email (simulata: finisce in
   * «Posta in uscita»), perche' il cliente il gestionale non lo apre tutti i giorni.
   */
  function avvisa(a, testo, link, opz) {
    opz = opz || {};
    DB.avvisi.unshift({ id: uid('avv'), a, testo, link: link || '', data: adesso(), letto: false, tipo: opz.tipo || 'info' });
    if (DB.avvisi.length > 400) DB.avvisi.length = 400;
    if (opz.email) {
      DB.email.unshift({ id: uid('eml'), data: adesso(), a: opz.email.a, oggetto: opz.email.oggetto, testo: opz.email.testo || testo });
      if (DB.email.length > 300) DB.email.length = 300;
    }
    notificaBrowser(a, testo);
  }
  function destinatariDi(u) {
    if (!u) return [];
    const d = [u.id];
    if (u.ruolo === 'titolare' || u.ruolo === 'ufficio') d.push('ufficio');
    (u.clienti || []).forEach(c => d.push('cliente:' + c));
    return d;
  }
  function mieiAvvisi() { const d = destinatariDi(utente()); return DB.avvisi.filter(a => d.includes(a.a)); }
  function nonLetti() { return mieiAvvisi().filter(a => !a.letto).length; }

  // Notifiche del browser: quando l'utente le attiva, gli avvisi che arrivano da
  // un'altra scheda escono come notifica di sistema. In produzione e' Web Push
  // (VAPID) dietro un'astrazione (§15); qui e' la Notification API e basta.
  let ultimiAvvisiVisti = null;
  function notificaBrowser() { /* le notifiche partono dalla scheda che RICEVE, vedi controllaNotifiche */ }
  function controllaNotifiche() {
    const u = utente(); if (!u || !('Notification' in window) || Notification.permission !== 'granted') return;
    const miei = mieiAvvisi();
    const ids = new Set(miei.map(a => a.id));
    if (ultimiAvvisiVisti) miei.filter(a => !ultimiAvvisiVisti.has(a.id) && !a.letto).slice(0, 3).forEach(a => {
      try { new Notification('IDRAL', { body: a.testo, tag: a.id, icon: 'icone/icona-192.png' }); } catch (_) { }
    });
    ultimiAvvisiVisti = ids;
  }
  ascoltatori.push(controllaNotifiche);

  // ---------------------------------------------------------------------------
  // ACCESSO
  // ---------------------------------------------------------------------------
  function normTel(s) { return String(s || '').replace(/[^\d]/g, '').replace(/^0039|^39(?=3\d{8,9}$)/, ''); }
  function utente() {
    let id = sessionStorage.getItem(CHIAVE_SESSIONE);
    if (!id) { id = localStorage.getItem(CHIAVE_RICORDA); if (id) sessionStorage.setItem(CHIAVE_SESSIONE, id); }
    const u = id ? utenteDa(id) : null;
    return u && u.attivo !== false ? u : null;
  }
  /**
   * entra('andrea@idral.it', 'idral2026') -> {ok:true, utente} | {ok:false, errore}
   * Il tecnico entra con il telefono o l'email; il cliente con l'email.
   * ⚠️ Le password qui sono in chiaro nel browser: E' UNA DEMO. Nel prodotto
   * vero le custodisce Supabase Auth (impronta a senso unico, §2.2).
   */
  function entra(chi, password, ricorda) {
    chi = String(chi || '').trim().toLowerCase();
    const t = normTel(chi);
    const u = DB.utenti.find(x => (x.email && x.email.toLowerCase() === chi) || (t.length >= 6 && x.telefono && normTel(x.telefono) === t));
    if (!u) return { ok: false, errore: 'Non troviamo questo indirizzo o numero.' };
    if (u.attivo === false) return { ok: false, errore: 'Accesso disattivato. Chiedi all\'ufficio.' };
    if (u.password !== password) return { ok: false, errore: 'Password non corretta.' };
    apriSessione(u, ricorda);
    return { ok: true, utente: u };
  }
  function apriSessione(u, ricorda) {
    sessionStorage.setItem(CHIAVE_SESSIONE, u.id);
    if (ricorda) localStorage.setItem(CHIAVE_RICORDA, u.id); else localStorage.removeItem(CHIAVE_RICORDA);
    modifica(db => { u.ultimoAccesso = adesso(); registra('accesso', u.nome + ' (' + ETICHETTA_RUOLO[u.ruolo] + ')'); });
  }
  function esci() {
    sessionStorage.removeItem(CHIAVE_SESSIONE);
    localStorage.removeItem(CHIAVE_RICORDA);
    location.hash = '#/accesso';
  }
  const ETICHETTA_RUOLO = { titolare: 'Titolare', ufficio: 'Ufficio', tecnico: 'Tecnico', cliente: 'Cliente' };
  function casaDi(u) {
    if (!u) return '#/accesso';
    if (u.ruolo === 'tecnico') return '#/t/oggi';
    if (u.ruolo === 'cliente') return '#/c/home';
    return '#/u/cruscotto';
  }
  /** Il titolare vede tutto; l'ufficio tutto tranne persone/accessi e impostazioni. */
  function puo(permesso) {
    const u = utente(); if (!u) return false;
    if (u.ruolo === 'titolare') return true;
    if (u.ruolo === 'ufficio') return !['persone', 'impostazioni', 'registro'].includes(permesso);
    return false;
  }

  // ---------------------------------------------------------------------------
  // RETE E CODA (app tecnico)
  // ---------------------------------------------------------------------------
  // In produzione la coda sta in IndexedDB sul telefono. Qui sta nell'archivio
  // comune ma finche' la rete e' «tolta» l'ufficio non la legge: e' lo stesso
  // effetto, visibile in riunione con il pulsante «Togli la rete».
  function inRete() { return navigator.onLine && sessionStorage.getItem(CHIAVE_RETE) !== '1'; }
  function impostaRete(attiva) {
    if (attiva) sessionStorage.removeItem(CHIAVE_RETE); else sessionStorage.setItem(CHIAVE_RETE, '1');
    if (attiva) svuotaCoda();
    render();
  }
  const gestoriCoda = {};
  /** Registra chi sa applicare un'operazione in coda: gestoreCoda('invia_rapporto', payload => {...}) */
  function gestoreCoda(tipo, fn) { gestoriCoda[tipo] = fn; }
  /**
   * accoda('invia_rapporto', {interventoId}, 'Scheda di Rossi') — se c'e' rete
   * applica subito, altrimenti mette in coda. Ritorna true se applicato subito.
   * L'id dell'operazione nasce sul telefono: un doppio invio non fa due record.
   */
  function accoda(tipo, payload, descrizione) {
    const u = utente();
    const op = { id: uid('op'), tipo, payload, descrizione: descrizione || tipo, utenteId: u && u.id, creata: adesso() };
    if (inRete() && gestoriCoda[tipo]) {
      modifica(db => { gestoriCoda[tipo](op.payload, op); db.codaApplicate.push(op.id); });
      return true;
    }
    modifica(db => { db.coda.push(op); });
    return false;
  }
  function codaMia() { const u = utente(); return DB.coda.filter(o => u && o.utenteId === u.id); }
  function svuotaCoda() {
    if (!inRete()) return 0;
    const u = utente(); if (!u) return 0;
    let n = 0;
    modifica(db => {
      db.coda = db.coda.filter(op => {
        if (op.utenteId !== u.id) return true;
        if (db.codaApplicate.includes(op.id)) return false; // gia' arrivata: niente doppioni
        const g = gestoriCoda[op.tipo]; if (!g) return true;
        g(op.payload, op); db.codaApplicate.push(op.id); n++;
        return false;
      });
      if (db.codaApplicate.length > 500) db.codaApplicate = db.codaApplicate.slice(-500);
    });
    if (n) toast(n === 1 ? '1 scheda inviata all\'ufficio' : n + ' schede inviate all\'ufficio', 'ok');
    return n;
  }
  window.addEventListener('online', () => { svuotaCoda(); render(); });
  window.addEventListener('offline', () => render());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) svuotaCoda(); });

  // ---------------------------------------------------------------------------
  // ROUTER
  // ---------------------------------------------------------------------------
  // rotta('#/u/intervento/:id', 'ufficio', params => html | {html, dopo})
  // area: 'libera' | 'tecnico' | 'ufficio' | 'cliente'
  const rotte = [];
  function rotta(schema, area, fn) {
    const nomi = [];
    const re = new RegExp('^' + schema.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\:([a-z]+)/gi, (m, n) => { nomi.push(n); return '([^/]+)'; }).replace(/:([a-z]+)/gi, (m, n) => { nomi.push(n); return '([^/]+)'; }) + '$');
    rotte.push({ schema, re, nomi, area, fn });
  }
  function vai(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  function hashCorrente() { return location.hash || '#/'; }
  let ultimoHash = null;
  let dopoRender = [];
  /** Codice da eseguire dopo che la pagina e' nel DOM (grafici, mappe, firma). */
  function dopo(fn) { dopoRender.push(fn); }

  function render() {
    const hash = hashCorrente();
    const [percorso, query] = hash.split('?');
    const q = Object.fromEntries(new URLSearchParams(query || ''));
    const u = utente();
    if (percorso === '#/' || percorso === '#') { location.replace(casaDi(u)); return; }
    let r = null, par = {};
    for (const x of rotte) { const m = percorso.match(x.re); if (m) { r = x; x.nomi.forEach((n, i) => par[n] = decodeURIComponent(m[i + 1])); break; } }
    if (!r) { location.replace(casaDi(u)); return; }
    if (r.area !== 'libera') {
      if (!u) { sessionStorage.setItem('idral.demo.dopo', hash); location.replace('#/accesso'); return; }
      const areaUtente = u.ruolo === 'tecnico' ? 'tecnico' : u.ruolo === 'cliente' ? 'cliente' : 'ufficio';
      // Un tecnico che incolla un indirizzo dell'ufficio non vede niente: in
      // produzione lo blocca il database (RLS per ruolo), qui il router.
      if (areaUtente !== r.area) { location.replace(casaDi(u)); return; }
    }
    par.q = q;
    dopoRender = [];
    const cambioPagina = ultimoHash !== percorso;
    const y = window.scrollY;
    const scorriTec = $('.tec .scorri'); const yTec = scorriTec ? scorriTec.scrollTop : 0;
    let out;
    try { out = r.fn(par); } catch (e) { console.error(e); out = '<div style="padding:40px"><div class="avviso dang">' + icona('attenzione') + '<div><b>Qualcosa non ha funzionato.</b><br>' + h(e.message) + '</div></div></div>'; }
    if (out === false) return; // la rotta ha gia' reindirizzato
    const html = typeof out === 'string' ? out : out.html;
    document.body.className = r.area === 'tecnico' ? 'sup-tecnico' : r.area === 'cliente' ? 'sup-cliente' : r.area === 'ufficio' ? 'sup-ufficio' : 'sup-libera';
    $('#app').innerHTML = html;
    if (out && out.dopo) dopoRender.push(out.dopo);
    dopoRender.forEach(f => { try { f(); } catch (e) { console.error(e); } });
    if (cambioPagina) { window.scrollTo(0, 0); const s = $('.tec .scorri'); if (s) s.scrollTop = 0; }
    else { window.scrollTo(0, y); const s = $('.tec .scorri'); if (s) s.scrollTop = yTec; }
    ultimoHash = percorso;
    controllaNotifiche();
  }
  window.addEventListener('hashchange', render);

  // ---------------------------------------------------------------------------
  // AZIONI — delega degli eventi. Nel markup: data-az="nome" (+ data-* a piacere)
  // azione('nome', (el, ev) => {...})  — click su bottoni/link/righe
  // Per i form: <form data-form="nome"> e azione('nome', (form, ev, dati) => {})
  //   dove dati = oggetto dei campi (checkbox -> true/false; campi multipli -> array)
  // Per i cambi: data-cambia="nome" su input/select -> azione('nome', (el, ev) => {})
  // ---------------------------------------------------------------------------
  const azioni = {};
  function azione(nome, fn) { azioni[nome] = fn; }
  function datiForm(form) {
    const o = {};
    $$('input,select,textarea', form).forEach(el => {
      if (!el.name || el.disabled) return;
      if (el.type === 'checkbox') {
        const multipli = $$('input[type=checkbox][name="' + el.name + '"]', form).length > 1;
        if (multipli) { o[el.name] = o[el.name] || []; if (el.checked) o[el.name].push(el.value); }
        else o[el.name] = el.checked;
      } else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; else if (!(el.name in o)) o[el.name] = ''; }
      else if (el.type === 'file') { o[el.name] = el.files; }
      else if (el.multiple) { o[el.name] = Array.from(el.selectedOptions).map(x => x.value); }
      else o[el.name] = el.value;
    });
    return o;
  }
  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-az]');
    if (!el) return;
    const fn = azioni[el.dataset.az];
    if (!fn) { console.warn('azione mancante:', el.dataset.az); return; }
    ev.preventDefault();
    fn(el, ev);
  });
  document.addEventListener('submit', ev => {
    const form = ev.target.closest('form[data-form]');
    if (!form) return;
    ev.preventDefault();
    const fn = azioni[form.dataset.form];
    if (fn) fn(form, ev, datiForm(form));
  });
  document.addEventListener('change', ev => {
    const el = ev.target.closest('[data-cambia]');
    if (!el) return;
    const fn = azioni[el.dataset.cambia];
    if (fn) fn(el, ev);
  });
  document.addEventListener('input', ev => {
    const el = ev.target.closest('[data-digita]');
    if (!el) return;
    const fn = azioni[el.dataset.digita];
    if (fn) fn(el, ev);
  });

  // ---------------------------------------------------------------------------
  // COMPONENTI
  // ---------------------------------------------------------------------------
  function toast(msg, tipo, ms) {
    let c = $('#toast'); if (!c) { c = document.createElement('div'); c.id = 'toast'; document.body.appendChild(c); }
    const t = document.createElement('div');
    t.className = 'toast ' + (tipo || '');
    t.innerHTML = (tipo === 'ok' ? icona('spunta') : tipo === 'per' ? icona('attenzione') : icona('info')) + '<span>' + h(msg) + '</span>';
    c.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, ms || 2800);
  }

  /**
   * modale({titolo, corpo (html), largo, azioni:[{testo, classe, az}] , form:'nomeForm'})
   * Se passi form, il corpo e' avvolto in <form data-form="..."> e il bottone con
   * tipo:'submit' lo invia. Ritorna { chiudi, el }.
   * Chiusura: bottone ×, tasto Esc, click sul velo, oppure A.chiudiModale().
   */
  function modale(o) {
    chiudiModale();
    const v = document.createElement('div');
    v.className = 'velo';
    const piede = (o.azioni || [{ testo: 'Chiudi', classe: '', chiudi: true }]).map(a =>
      '<button class="btn ' + (a.classe || '') + '" ' + (a.tipo === 'submit' ? 'type="submit"' : 'type="button"') + (a.az ? ' data-az="' + a.az + '"' : '') + (a.chiudi ? ' data-chiudi="1"' : '') + (a.attr || '') + '>' + (a.icona ? icona(a.icona) : '') + h(a.testo) + '</button>').join('');
    const interno = '<div class="mt"><h2>' + h(o.titolo || '') + '</h2><button class="btn vuoto icona" type="button" data-chiudi="1" aria-label="Chiudi">' + icona('x') + '</button></div><div class="mc">' + (o.corpo || '') + '</div>' + (piede ? '<div class="mp">' + piede + '</div>' : '');
    v.innerHTML = '<div class="modale ' + (o.largo ? 'largo' : '') + '" role="dialog" aria-modal="true">' + (o.form ? '<form data-form="' + o.form + '" novalidate>' + interno + '</form>' : interno) + '</div>';
    v.addEventListener('click', e => { if (e.target === v || e.target.closest('[data-chiudi]')) { e.preventDefault(); chiudiModale(); } });
    document.body.appendChild(v);
    const primo = $('input:not([type=hidden]):not([type=checkbox]),select,textarea', v);
    if (primo && !o.nofocus && window.matchMedia('(pointer:fine)').matches) setTimeout(() => primo.focus(), 30);
    if (o.dopo) o.dopo(v);
    return { chiudi: chiudiModale, el: v };
  }
  function chiudiModale() { const v = $('.velo'); if (v) v.remove(); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') chiudiModale(); });

  /** conferma('Eliminare?', {ok:'Elimina', pericolo:true}) -> Promise<boolean> */
  function conferma(testo, o) {
    o = o || {};
    return new Promise(res => {
      azione('__conferma_si', () => { chiudiModale(); res(true); });
      azione('__conferma_no', () => { chiudiModale(); res(false); });
      modale({ titolo: o.titolo || 'Confermi?', corpo: '<p>' + testo + '</p>', azioni: [{ testo: 'Annulla', az: '__conferma_no' }, { testo: o.ok || 'Conferma', classe: o.pericolo ? 'per' : 'pri', az: '__conferma_si' }] });
    });
  }

  function vuoto(titolo, testo, ic) {
    return '<div class="stato-vuoto">' + icona(ic || 'arrivo') + '<b>' + h(titolo) + '</b>' + (testo ? '<span>' + h(testo) + '</span>' : '') + '</div>';
  }
  function pastiglia(testo, tono, nopunto) { return '<span class="pastiglia ' + (tono || '') + (nopunto ? ' nopunto' : '') + '">' + h(testo) + '</span>'; }

  // ---- stati e vocabolari (lessico dell'idraulico, non dell'informatico)
  const STATI_INTERVENTO = {
    da_pianificare: ['Da pianificare', 'grigio'],
    pianificato: ['Pianificato', 'blu'],
    in_viaggio: ['In viaggio', 'acc'],
    in_corso: ['In corso', 'acc'],
    sospeso: ['Sospeso', 'warn'],
    completato: ['Da approvare', 'warn'],
    approvato: ['Approvato', 'ok'],
    valorizzato: ['Valorizzato', 'ok'],
    fatturato: ['Fatturato', 'grigio'],
    annullato: ['Annullato', 'grigio']
  };
  function statoIntervento(s) { const x = STATI_INTERVENTO[s] || [s, '']; return pastiglia(x[0], x[1]); }
  const TIPI_INTERVENTO = { riparazione: 'Riparazione', manutenzione: 'Manutenzione', installazione: 'Installazione', sopralluogo: 'Sopralluogo', emergenza: 'Pronto intervento', collaudo: 'Collaudo' };
  const PRIORITA = { bassa: ['Bassa', 'grigio'], normale: ['Normale', 'blu'], alta: ['Alta', 'acc'], urgente: ['Urgente', 'dang'] };
  function priorita(p) { const x = PRIORITA[p] || PRIORITA.normale; return pastiglia(x[0], x[1]); }
  const STATI_PREVENTIVO = { bozza: ['Bozza', 'grigio'], inviato: ['Inviato', 'blu'], visto: ['Visto dal cliente', 'blu'], accettato: ['Accettato', 'ok'], rifiutato: ['Rifiutato', 'dang'], scaduto: ['Scaduto', 'warn'], convertito: ['Diventato intervento', 'ok'] };
  function statoPreventivo(s) { const x = STATI_PREVENTIVO[s] || [s, '']; return pastiglia(x[0], x[1]); }
  const ESITI = { risolto: 'Risolto', parziale: 'Risolto in parte', da_riprogrammare: 'Da riprogrammare', non_eseguibile: 'Non eseguibile' };
  const FASI_FOTO = { prima: 'Prima', durante: 'Durante', dopo: 'Dopo', anomalia: 'Anomalia', matricola: 'Matricola', documento: 'Documento' };
  const TIPI_ORE = { lavoro: 'Lavoro', viaggio: 'Viaggio', attesa: 'Attesa', straordinario: 'Straordinario' };

  // ---- conti: un posto solo, cosi' ufficio, cliente e stampe dicono lo stesso numero
  /** Totali di un preventivo. Le voci opzionali non entrano nel totale finche' il cliente non le sceglie. */
  function totaliPreventivo(p) {
    let imp = 0, iva = 0, opz = 0;
    const perAliquota = {};
    (p.righe || []).forEach(r => {
      const tot = arrot((Number(r.qta) || 0) * (Number(r.prezzo) || 0) * (1 - (Number(r.sconto) || 0) / 100));
      if (r.opzionale && !r.scelta) { opz += tot; return; }
      imp += tot;
      const al = Number(r.iva === undefined ? 22 : r.iva);
      perAliquota[al] = (perAliquota[al] || 0) + tot;
    });
    Object.keys(perAliquota).forEach(al => iva += arrot(perAliquota[al] * al / 100));
    return { imponibile: arrot(imp), iva: arrot(iva), totale: arrot(imp + iva), opzionali: arrot(opz), perAliquota };
  }
  /** Minuti lavorati su un intervento, per tipo. */
  function minutiIntervento(i) {
    const o = { lavoro: 0, viaggio: 0, attesa: 0, straordinario: 0, totale: 0 };
    ((i.rapporto && i.rapporto.ore) || []).forEach(x => { o[x.tipo] = (o[x.tipo] || 0) + (Number(x.minuti) || 0); o.totale += Number(x.minuti) || 0; });
    return o;
  }
  /**
   * Valore di un intervento chiuso, con il listino di oggi: manodopera (lavoro +
   * straordinario), un'uscita, materiali a prezzo di vendita. E' la cifra che
   * finisce nella pre-fattura. In garanzia o a contratto vale zero al cliente.
   */
  function valoreIntervento(i) {
    const t = DB.azienda.tariffe;
    const m = minutiIntervento(i);
    const oreFatt = (m.lavoro + m.straordinario * 1) / 60;
    const manodopera = arrot(oreFatt * t.manodopera + (m.straordinario / 60) * (t.straordinario - t.manodopera));
    const uscita = (i.rapporto && (m.totale > 0)) ? t.uscita : 0;
    let materiali = 0, costoMat = 0;
    ((i.rapporto && i.rapporto.materiali) || []).forEach(r => {
      const a = r.articoloId ? articolo(r.articoloId) : null;
      const prezzo = r.prezzo !== undefined ? r.prezzo : (a ? a.prezzo : 0);
      materiali += (Number(r.qta) || 0) * (Number(prezzo) || 0);
      costoMat += (Number(r.qta) || 0) * (a ? a.costo : (Number(prezzo) || 0) * 0.7);
    });
    materiali = arrot(materiali);
    const gratuito = i.modalita === 'garanzia' || i.modalita === 'contratto';
    const totale = gratuito ? 0 : arrot(manodopera + uscita + materiali);
    return { oreFatturabili: oreFatt, manodopera, uscita, materiali, totale, costoMateriali: arrot(costoMat), gratuito };
  }
  /** Giacenza = somma dei movimenti, mai un contatore (§12.2). */
  function giacenza(articoloId, magazzinoId) {
    let q = 0;
    for (const m of DB.movimenti) if (m.articoloId === articoloId && (!magazzinoId || m.magazzinoId === magazzinoId)) q += Number(m.qta) || 0;
    return Math.round(q * 1000) / 1000;
  }
  /** Impegnata: materiale previsto sui preventivi accettati non ancora eseguiti. */
  function impegnata(articoloId) {
    let q = 0;
    DB.preventivi.forEach(p => { if (p.stato === 'accettato') (p.righe || []).forEach(r => { if (r.articoloId === articoloId && (!r.opzionale || r.scelta)) q += Number(r.qta) || 0; }); });
    return q;
  }
  /**
   * L'unica porta d'ingresso al magazzino. Append-only: si corregge con un
   * movimento opposto. Non rifiuta MAI (giacenza a zero, articolo disattivato):
   * registra e basta, la segnalazione la fa chi legge.
   */
  function registraMovimento(m) {
    const u = utente();
    DB.movimenti.push(Object.assign({ id: uid('mov'), data: adesso(), utenteId: u && u.id }, m));
  }
  function magazzinoDiTecnico(tecnicoId) { return DB.magazzini.find(m => m.tecnicoId === tecnicoId) || null; }

  // ---- file
  function scarica(nome, contenuto, mime) {
    const b = contenuto instanceof Blob ? contenuto : new Blob([contenuto], { type: mime || 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = nome;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  /** CSV con separatore «;» e BOM: e' quello che Excel italiano apre senza chiedere niente. */
  function csv(righe) {
    const esc = v => { v = v === null || v === undefined ? '' : String(v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return '﻿' + righe.map(r => r.map(esc).join(';')).join('\r\n');
  }
  /**
   * Comprime una foto dal telefono: lato lungo 1280 px, JPEG/WebP q .7.
   * Un 12 MP da 4 MB diventa ~150 KB. Rimuove l'EXIF per costruzione (il canvas
   * non lo copia): la posizione di casa del cliente non resta nella foto.
   */
  function comprimiFoto(file, lato, q) {
    lato = lato || 1280; q = q || 0.7;
    return new Promise((res, rej) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        let w = img.naturalWidth, hh = img.naturalHeight;
        const s = Math.min(1, lato / Math.max(w, hh)); w = Math.round(w * s); hh = Math.round(hh * s);
        const c = document.createElement('canvas'); c.width = w; c.height = hh;
        c.getContext('2d').drawImage(img, 0, 0, w, hh);
        URL.revokeObjectURL(url);
        let d = c.toDataURL('image/webp', q);
        if (d.indexOf('data:image/webp') !== 0) d = c.toDataURL('image/jpeg', q);
        res(d);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Immagine non leggibile')); };
      img.src = url;
    });
  }
  function leggiFile(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  }
  /** Impronta sha-256 di un testo: e' la «prova» dell'accettazione del preventivo. */
  async function impronta(testo) {
    try {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(testo));
      return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
    } catch (_) { let hsh = 0; for (let i = 0; i < testo.length; i++) hsh = (hsh * 31 + testo.charCodeAt(i)) | 0; return 'x' + (hsh >>> 0).toString(16); }
  }

  /** Link di navigazione: apre Google Maps (o l'app di navigazione del telefono). */
  function linkNaviga(s) {
    if (!s) return '#';
    const dest = s.lat ? s.lat + ',' + s.lng : encodeURIComponent(indirizzo(s));
    return 'https://www.google.com/maps/dir/?api=1&destination=' + dest + '&travelmode=driving';
  }
  function linkMappa(s) { return s ? 'https://www.google.com/maps/search/?api=1&query=' + (s.lat ? s.lat + ',' + s.lng : encodeURIComponent(indirizzo(s))) : '#'; }

  /** Barra «stai guardando una demo», uguale ovunque tranne che nell'app tecnico. */
  function barraDemo() {
    return '<div class="barra-demo"><b>Demo</b> — dati di prova salvati solo in questo browser. Non inserire dati reali. <a href="#" data-az="demo-azzera">Riporta la demo all\'inizio</a></div>';
  }
  azione('demo-azzera', async () => {
    if (await conferma('Tutti i dati inseriti in questo browser vengono cancellati e si riparte dai dati di prova.', { ok: 'Riporta all\'inizio', pericolo: true })) {
      azzera(); toast('Demo riportata all\'inizio', 'ok'); vai(casaDi(utente()));
    }
  });
  azione('esci', () => esci());

  // Avvio: si aspetta che tutti i moduli abbiano registrato le rotte.
  function avvia() {
    carica();
    accogliRichiesteSito();
    render();
    // Service worker: rende l'app installabile e apribile senza rete.
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
  }

  // ---------------------------------------------------------------------------
  // API pubblica
  // ---------------------------------------------------------------------------
  window.A = {
    // attrezzi
    $, $$, h, uid, euro, num, arrot, iniziali, pad,
    oggi, adesso, isoGiorno, daGiorno, piuGiorni, diffGiorni, lunedi, data, dataLunga, dataBreve, ora, dataOra, quando, durata, oreDecimali,
    GIORNI, GIORNI_BREVI, MESI, MESI_BREVI,
    icona, marchio, GOCCIA,
    // archivio
    get DB() { return DB; }, modifica, azzera, scrivi, registra, avvisa, mieiAvvisi, nonLetti, numera,
    trova, cliente, sede, impianto, articolo, utenteDa, intervento, preventivo, tecnici, sediDi, impiantiDi, indirizzo, nomeTecnici, nomeBreve,
    // accesso
    utente, entra, apriSessione, esci, casaDi, puo, ETICHETTA_RUOLO, normTel,
    // rete e coda
    inRete, impostaRete, accoda, gestoreCoda, codaMia, svuotaCoda,
    // router e azioni
    rotta, vai, render, dopo, azione, datiForm,
    // componenti
    toast, modale, chiudiModale, conferma, vuoto, pastiglia, barraDemo,
    set firmaInCorso(v) { firmaInCorso = v; },
    // vocabolari
    STATI_INTERVENTO, statoIntervento, TIPI_INTERVENTO, PRIORITA, priorita, STATI_PREVENTIVO, statoPreventivo, ESITI, FASI_FOTO, TIPI_ORE,
    // conti
    totaliPreventivo, minutiIntervento, valoreIntervento, giacenza, impegnata, registraMovimento, magazzinoDiTecnico,
    // file
    scarica, csv, comprimiFoto, leggiFile, impronta, linkNaviga, linkMappa,
    avvia
  };
})();
