/* =============================================================================
   IDRAL — gestionale (demo) · l'app del TECNICO
   -----------------------------------------------------------------------------
   Il telefono di Marco: in cantina, con i guanti, spesso senza campo. La regola
   e' una sola: dev'essere PIU' VELOCE DELLA CARTA. Un intervento tipico (ore,
   tre materiali, quattro foto, firma) si chiude in meno di tre minuti (§6).
   Se una scelta rallenta il tecnico, e' la scelta sbagliata.

   Cosa NON c'e', di proposito:
   - prezzi, costi, listini, margini, documenti di vendita. Mai, neanche nei
     totali: un telefono si presta e si perde (§6.7). Del preventivo collegato
     si vedono solo le voci, senza importi;
   - campi obbligatori oltre a «cosa ho fatto» ed «esito»: il resto si
     registra, si segnala e si va avanti (§6.3);
   - geolocalizzazione: «Portami» apre il navigatore, non traccia nessuno
     (art. 4 Statuto dei lavoratori, §17.5).

   Senza rete: tutto quello che deve arrivare all'ufficio passa da A.accoda()
   (stato, rapportino, note, materiale da ordinare). Se c'e' campo parte subito,
   altrimenti resta in coda e parte da solo quando torna. Il tecnico vede lo
   stato nuovo SUBITO, anche se la rete non c'e': la sua verita' e' l'ultima
   operazione in coda, non quello che l'ufficio ha gia' ricevuto.

   Rotte: #/t/oggi · #/t/lavoro/:id · #/t/rapportino/:id · #/t/firma/:id ·
   #/t/chiusura/:id · #/t/inviato/:id · #/t/coda · #/t/avvisi · #/t/profilo
   ============================================================================= */
(function () {
  'use strict';
  const { h, icona } = A;

  // ---------------------------------------------------------------------------
  // Costanti e vocabolario del campo
  // ---------------------------------------------------------------------------
  const MAX_FOTO = 12;
  // La memoria del browser della demo e' ~5 MB: una foto a 1280 px pesa il
  // doppio di una a 1024 e sul rapportino non si vede la differenza.
  const LATO_FOTO = 1024, QUALITA_FOTO = 0.62;
  const RAPPORTO_FIRMA = 1.5;   // larghezza / altezza del riquadro: uguale ovunque, cosi' ingrandire non deforma la firma
  const INCHIOSTRO = '#0A2A3D'; // blu penna su carta bianca, come le firme dei dati di prova
  const TRATTO = 2.6;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;

  // Stati dopo i quali il lavoro, per il tecnico, e' «fatto».
  const CHIUSI = ['completato', 'approvato', 'valorizzato', 'fatturato', 'annullato'];
  // Le etichette dell'ufficio parlano all'ufficio («Da approvare», «Fatturato»).
  // Al tecnico interessa un'altra cosa: l'ho fatto? e' arrivato? Il fatturato,
  // poi, e' un fatto di vendita: non e' affar suo.
  const ETICHETTE = {
    da_pianificare: ['Da pianificare', 'grigio'], pianificato: ['Da fare', 'blu'], in_viaggio: ['In viaggio', 'acc'],
    in_corso: ['In corso', 'acc'], sospeso: ['In pausa', 'warn'], completato: ['Inviato', 'ok'], approvato: ['Approvato', 'ok'],
    valorizzato: ['Approvato', 'ok'], fatturato: ['Approvato', 'ok'], annullato: ['Annullato', 'grigio'], rimandato: ['Da correggere', 'dang']
  };
  // Le frasi che il tecnico scriverebbe comunque, a un tocco. Sono il motivo
  // per cui la descrizione (obbligatoria) non costa trenta secondi di pollici.
  const TESTI_RAPIDI = {
    manutenzione: ['Pulizia bruciatore e scambiatore', 'Analisi fumi: valori nella norma', 'Verificati i dispositivi di sicurezza', 'Controllata pressione e vaso di espansione', 'Pulizia filtri', 'Compilato il libretto di impianto'],
    riparazione: ['Individuato il guasto', 'Sostituito il pezzo difettoso', 'Rifatta la tenuta', 'Sfiatato l\'impianto', 'Ripristinata la pressione a 1,5 bar', 'Prova di funzionamento: tutto regolare'],
    installazione: ['Smontato il vecchio apparecchio', 'Installato e collegato il nuovo apparecchio', 'Prova di tenuta superata', 'Prima accensione e regolazione', 'Spiegato il funzionamento al cliente', 'Portato via il vecchio apparecchio'],
    sopralluogo: ['Rilevate le misure', 'Fatte le foto dello stato attuale', 'Verificati scarichi e colonne', 'Verificata la canna fumaria', 'Verificati gli allacci di gas e acqua'],
    emergenza: ['Chiusa l\'acqua generale', 'Individuata la perdita', 'Riparazione provvisoria', 'Riparazione definitiva', 'Riaperta l\'acqua e verificato'],
    collaudo: ['Prova di tenuta dell\'impianto', 'Verificato il funzionamento', 'Consegnata la documentazione al cliente']
  };
  const TROVATO_RAPIDI = ['Tutto in ordine', 'Molto calcare', 'Pezzo usurato', 'Perdita d\'acqua', 'Aria nell\'impianto', 'Acqua dell\'impianto sporca'];
  const CONSIGLIO_RAPIDI = ['Nessun consiglio particolare', 'Installare un defangatore magnetico', 'Trattare l\'acqua contro il calcare', 'Valutare la sostituzione: apparecchio a fine vita', 'Prossimo controllo fra 12 mesi'];
  const QUALIFICHE = { privato: ['Cliente', 'Familiare', 'Inquilino', 'Delegato'], condominio: ['Amministratore', 'Portiere', 'Condomino', 'Delegato'], azienda: ['Titolare', 'Referente', 'Dipendente'] };
  const URGENZE = { normale: ['Normale', 'Arriva col prossimo giro'], urgente: ['Urgente', 'Serve entro domani'], blocca_lavoro: ['Blocca il lavoro', 'Senza, non finisco'] };
  const STATI_RICHIESTA = { nuova: ['Segnalato', 'blu'], presa: ['Preso in carico', 'blu'], ordinata: ['Ordinato', 'acc'], arrivata: ['Arrivato', 'ok'], rifiutata: ['Non ordinato', 'grigio'] };
  const ICONA_OP = { stato: 'orologio', invia_rapporto: 'verifica', nota: 'messaggio', richiesta_materiale: 'carrello' };
  const ESITO_ICONA = { risolto: ['spunta', 'ok'], parziale: ['info', 'warn'], da_riprogrammare: ['calendario', 'warn'], non_eseguibile: ['x', 'dang'] };

  // ---------------------------------------------------------------------------
  // Piccoli attrezzi
  // ---------------------------------------------------------------------------
  const cap = s => s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '';
  const taglia = (s, n) => { s = String(s || '').trim().replace(/\s+/g, ' '); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const numero = v => { const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : NaN; };
  const arrot5 = min => Math.max(5, Math.round(min / 5) * 5);
  const tondo = n => Math.round(n * 1000) / 1000;
  /** 95 -> '1 h 35' ; 40 -> '40 min'. Piu' corto di A.durata: sta dentro uno stepper. */
  function oreBrevi(min) {
    min = Math.round(min || 0);
    const hh = Math.floor(min / 60), mm = min % 60;
    if (!hh) return mm + ' min';
    return hh + ' h' + (mm ? ' ' + A.pad(mm) : '');
  }
  function hms(ms) { ms = Math.max(0, ms || 0); const s = Math.floor(ms / 1000); return A.pad(Math.floor(s / 3600)) + ':' + A.pad(Math.floor(s / 60) % 60) + ':' + A.pad(s % 60); }
  function quantoFa(iso) {
    const g = A.diffGiorni(iso.slice(0, 10), A.oggi());
    if (g <= 0) return 'oggi';
    if (g === 1) return 'ieri';
    if (g < 31) return g + ' giorni fa';
    if (g < 365) { const m = Math.round(g / 30.4); return m === 1 ? 'un mese fa' : m + ' mesi fa'; }
    const a = Math.floor(g / 365); return a === 1 ? 'un anno fa' : a + ' anni fa';
  }
  function saluto() { const o = new Date().getHours(); return o < 13 ? 'Buongiorno' : o < 18 ? 'Buon pomeriggio' : 'Buonasera'; }
  function telLink(t) { return 'tel:' + String(t || '').replace(/[^\d+]/g, ''); }

  // ---------------------------------------------------------------------------
  // Chi sono, cosa e' mio. Il tecnico vede SOLO i lavori con il suo id in
  // «tecnici»: in produzione lo impone la RLS, qui questa funzione.
  // ---------------------------------------------------------------------------
  const io = () => A.utente();
  function mio(id) { const u = io(); const i = id ? A.intervento(id) : null; return i && u && (i.tecnici || []).includes(u.id) ? i : null; }
  function mieiLavori() { const u = io(); if (!u) return []; return A.DB.interventi.filter(i => (i.tecnici || []).includes(u.id) && i.stato !== 'da_pianificare'); }
  const inDb = (db, id) => (db.interventi || []).find(x => x.id === id) || null;
  const nomeCliente = i => ((A.cliente(i.clienteId) || {}).nome || 'Cliente');
  const perOra = (a, b) => ((a.ora || '99') + a.numero).localeCompare((b.ora || '99') + b.numero);
  /** Operazioni di questo lavoro ancora sul telefono (non arrivate all'ufficio). */
  function coda(i, tipo) { return A.codaMia().filter(o => o.payload && o.payload.interventoId === i.id && (!tipo || o.tipo === tipo)); }

  /**
   * Lo stato come lo vede il TECNICO. Senza rete l'ufficio ha ancora lo stato
   * vecchio, ma Marco ha appena premuto «Ho iniziato»: se il bottone non
   * cambiasse lo ripremerebbe tre volte. La sua verita' e' la coda.
   */
  function statoTec(i) {
    if (i.stato === 'annullato') return 'annullato';
    if (coda(i, 'invia_rapporto').length) return 'completato';
    const r = i.rapporto;
    if (r && r.stato === 'rimandato') return 'rimandato';
    if (r && r.stato && r.stato !== 'bozza') return i.stato;
    const st = coda(i, 'stato');
    if (st.length) return st[st.length - 1].payload.stato;
    return i.stato;
  }
  function pastigliaTec(i) {
    const st = statoTec(i);
    if (st === 'completato' && coda(i, 'invia_rapporto').length) return A.pastiglia('Da inviare', 'warn');
    if (st === 'in_corso' && i.rapporto && i.rapporto.cronometro && i.rapporto.cronometro.finito) return A.pastiglia('Da chiudere', 'warn');
    const x = ETICHETTE[st] || [st, 'grigio'];
    return A.pastiglia(x[0], x[1]);
  }
  /** Il rapportino si puo' ancora toccare? Una volta chiuso si legge soltanto. */
  function modificabile(i) {
    if (!i || i.stato === 'annullato') return false;
    if (coda(i, 'invia_rapporto').length) return false;
    const r = i.rapporto;
    return !r || !r.stato || r.stato === 'bozza' || r.stato === 'rimandato';
  }
  /** In che punto del lavoro siamo: decide quali bottoni grandi mostrare. */
  function fase(i) {
    const st = statoTec(i); const c = (i.rapporto && i.rapporto.cronometro) || {};
    if (st === 'annullato') return 'annullato';
    if (st === 'rimandato') return 'rimandato';
    if (CHIUSI.includes(st)) return coda(i, 'invia_rapporto').length ? 'in_coda' : 'chiuso';
    if (st === 'in_viaggio') return 'viaggio';
    if (st === 'sospeso') return 'pausa';
    if (st === 'in_corso') return c.finito ? 'rapportino' : 'lavoro';
    return 'da_fare';
  }

  // ---------------------------------------------------------------------------
  // Il rapportino in bozza vive dentro intervento.rapporto (stato 'bozza').
  // ---------------------------------------------------------------------------
  function nuovaBozza() { return { lavoro: '', trovato: '', consiglio: '', esito: '', secondoIntervento: false, ore: [], materiali: [], foto: [], note: '', firma: null, inizio: null, fine: null, stato: 'bozza' }; }
  /** Dentro A.modifica: restituisce il rapportino, creandolo se manca. */
  function bozza(db, id) {
    const i = inDb(db, id); if (!i) return null;
    if (!i.rapporto) i.rapporto = nuovaBozza();
    const r = i.rapporto;
    ['ore', 'materiali', 'foto'].forEach(k => { if (!Array.isArray(r[k])) r[k] = []; });
    if (!r.cronometro) r.cronometro = {};
    if (!r.stato) r.stato = 'bozza';
    return r;
  }
  function assicuraBozza(id) {
    const i = A.intervento(id);
    const r = i && i.rapporto;
    if (r && Array.isArray(r.ore) && Array.isArray(r.materiali) && Array.isArray(r.foto) && r.cronometro) return;
    A.modifica(db => { bozza(db, id); });
  }
  function firmaVuota() { return { nome: '', qualifica: '', png: null, data: null, assente: false, motivo: '' }; }

  // ---------------------------------------------------------------------------
  // Salvataggio «a ogni campo». Ogni lettera finisce sul telefono entro un
  // quarto di secondo; prima di ogni tocco e di ogni cambio pagina si scrive
  // subito. Chi perde un rapportino da venti righe non lo riscrive (§14.6).
  // ---------------------------------------------------------------------------
  const inSospeso = {};
  let timerSalva = null;
  function salvaDopo(id, campo, valore) {
    inSospeso[id + '|' + campo] = { id, campo, valore };
    clearTimeout(timerSalva);
    timerSalva = setTimeout(flush, 250);
    segnaSalvataggio(false);
  }
  function flush() {
    clearTimeout(timerSalva); timerSalva = null;
    const lista = Object.values(inSospeso);
    if (!lista.length) return;
    Object.keys(inSospeso).forEach(k => delete inSospeso[k]);
    A.modifica(db => lista.forEach(s => {
      const r = bozza(db, s.id); if (!r) return;
      if (s.campo.indexOf('firma.') === 0) { r.firma = r.firma || firmaVuota(); r.firma[s.campo.slice(6)] = s.valore; }
      else r[s.campo] = s.valore;
    }));
    segnaSalvataggio(true);
  }
  function segnaSalvataggio(fatto) {
    const el = document.getElementById('tec-salvato'); if (!el) return;
    el.classList.toggle('in-corso', !fatto);
    el.innerHTML = fatto ? 'Salvato sul telefono ' + icona('spunta', 'p') : 'Salvo…';
  }
  // Fase di cattura: parte PRIMA dei gestori dei bottoni e dei link, cosi'
  // la pagina successiva legge il testo appena scritto.
  document.addEventListener('click', flush, true);
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

  // ---------------------------------------------------------------------------
  // Cronometro. I tempi stanno in rapporto.cronometro come istanti, non come
  // secondi contati: se Marco chiude l'app o gli si spegne il telefono, alla
  // riapertura il tempo e' ancora giusto.
  // ---------------------------------------------------------------------------
  let timerCrono = null;
  function tick() {
    const els = A.$$('[data-crono]');
    if (!els.length) { fermaTimerCrono(); return; }
    const ora = Date.now();
    els.forEach(el => {
      const fine = el.dataset.fermo ? Date.parse(el.dataset.fermo) : ora;
      el.textContent = hms(fine - Date.parse(el.dataset.da) - (Number(el.dataset.pausa) || 0) * 60000);
    });
  }
  function avviaTimerCrono() { if (!timerCrono) timerCrono = setInterval(tick, 1000); tick(); }
  function fermaTimerCrono() { if (timerCrono) { clearInterval(timerCrono); timerCrono = null; } }
  function minutiLavoro(c) {
    if (!c || !c.avviato) return 0;
    const fine = c.finito ? Date.parse(c.finito) : c.pausaDa ? Date.parse(c.pausaDa) : Date.now();
    return Math.max(0, (fine - Date.parse(c.avviato)) / 60000 - (c.pausaMin || 0));
  }
  function chiudiPausa(c) {
    if (!c.pausaDa) return;
    c.pausaMin = (c.pausaMin || 0) + Math.max(0, (Date.now() - Date.parse(c.pausaDa)) / 60000);
    c.pausaDa = null;
  }
  /** Ferma il cronometro e mette la riga ore 'lavoro'. Ritorna i minuti segnati. */
  function fermaCronometro(r) {
    const c = r.cronometro || (r.cronometro = {});
    if (!c.avviato || c.finito) return 0;
    chiudiPausa(c);
    const ora = A.adesso();
    c.finito = ora;
    const min = arrot5(minutiLavoro(c));
    r.ore.push({ id: A.uid('ore'), tipo: 'lavoro', minuti: min, auto: true });
    r.fine = ora;
    return min;
  }
  function cronoHtml(titolo, da, pausaMin, fermo, sotto, extra) {
    const ms = (fermo ? Date.parse(fermo) : Date.now()) - Date.parse(da) - (pausaMin || 0) * 60000;
    return `<div class="crono${fermo ? ' tec-fermo' : ''}">${icona(fermo ? 'pausa' : 'orologio', 'g')}
      <div class="tec-cr"><small>${h(titolo)}${sotto ? ' · ' + h(sotto) : ''}</small>
      <span class="t" role="timer" data-crono data-da="${h(da)}" data-pausa="${Number(pausaMin) || 0}" data-fermo="${h(fermo || '')}">${hms(ms)}</span></div>${extra || ''}</div>`;
  }

  // ---------------------------------------------------------------------------
  // Magazzino del furgone: solo QUANTITA', mai prezzi.
  // ---------------------------------------------------------------------------
  function furgoneDi(tecnicoId) { return A.magazzinoDiTecnico(tecnicoId) || (A.DB.magazzini || []).find(m => m.tipo === 'sede') || null; }
  /** Quanti ne ha sul furgone per QUESTO lavoro: giacenza + quello che il lavoro ha gia' scaricato (rapportino rimandato). */
  function sulFurgone(articoloId, i) {
    const mag = furgoneDi(io().id); if (!mag) return 0;
    let q = A.giacenza(articoloId, mag.id);
    if (i) A.DB.movimenti.forEach(m => { if (m.interventoId === i.id && m.magazzinoId === mag.id && m.articoloId === articoloId && (m.tipo === 'scarico' || m.tipo === 'reso')) q -= Number(m.qta) || 0; });
    return tondo(q);
  }
  /**
   * Allinea il magazzino al rapportino: scarica la differenza fra quello che il
   * rapportino dice e quello che questo intervento ha gia' scaricato. Cosi' un
   * rapportino rimandato e reinviato non scarica due volte, e un pezzo tolto in
   * correzione torna sul furgone con un movimento opposto (mai una modifica:
   * i movimenti sono append-only, §12.2).
   */
  function allineaMagazzino(db, i, tecnicoId) {
    const furgone = A.magazzinoDiTecnico(tecnicoId);
    const sede = (db.magazzini || []).find(m => m.tipo === 'sede');
    const voluto = {}, gia = {};
    (i.rapporto.materiali || []).forEach(m => {
      if (!m.articoloId || m.da === 'fuori catalogo') return; // fuori catalogo: comprato al banco, non passa dal magazzino
      const mag = m.da === 'deposito' ? sede : (furgone || sede);
      if (!mag) return;
      const k = m.articoloId + '|' + mag.id;
      voluto[k] = (voluto[k] || 0) + (Number(m.qta) || 0);
    });
    db.movimenti.forEach(mv => {
      if (mv.interventoId !== i.id || (mv.tipo !== 'scarico' && mv.tipo !== 'reso')) return;
      const k = mv.articoloId + '|' + mv.magazzinoId;
      gia[k] = (gia[k] || 0) - (Number(mv.qta) || 0);
    });
    new Set(Object.keys(voluto).concat(Object.keys(gia))).forEach(k => {
      const delta = tondo((voluto[k] || 0) - (gia[k] || 0));
      if (!delta) return;
      const [articoloId, magazzinoId] = k.split('|');
      A.registraMovimento({ articoloId, magazzinoId, qta: -delta, tipo: delta > 0 ? 'scarico' : 'reso', rif: 'Intervento ' + i.numero, nota: delta > 0 ? '' : 'Correzione del rapportino', controparte: '', interventoId: i.id });
    });
  }

  // ---------------------------------------------------------------------------
  // CODA: i quattro gestori. Si registrano al caricamento del modulo perche'
  // la coda si puo' svuotare da qualunque pagina (anche dall'evento «online»).
  // Il gestore riceve il DB gia' aperto in A.modifica: scrive su A.DB.
  // Tutti idempotenti: l'id nasce sul telefono, un secondo invio non fa doppioni.
  // ---------------------------------------------------------------------------
  A.gestoreCoda('stato', (p, op) => {
    const i = inDb(A.DB, p.interventoId); if (!i) return;
    // Un «Ho iniziato» arrivato in ritardo non deve riaprire un lavoro gia' chiuso.
    if (['completato', 'approvato', 'valorizzato', 'fatturato', 'annullato'].includes(i.stato)) return;
    if (i.stato === p.stato) return;
    i.stato = p.stato;
    // L'ora e' quella in cui il tecnico ha premuto il bottone, non quella in
    // cui e' tornata la rete: all'ufficio serve sapere quando e' partito davvero.
    (i.storico = i.storico || []).push({ stato: p.stato, data: op.creata || A.adesso(), utenteId: op.utenteId });
  });

  A.gestoreCoda('invia_rapporto', (p, op) => {
    const db = A.DB;
    const i = inDb(db, p.interventoId); if (!i || !i.rapporto) return;
    const r = i.rapporto;
    if (r.stato === 'inviato' || r.stato === 'approvato') return; // gia' arrivato: niente doppioni
    const tecId = op.utenteId || (A.utente() || {}).id;
    const tec = A.utenteDa(tecId) || { nome: 'Il tecnico' };
    const eraRimandato = r.stato === 'rimandato';
    const cli = nomeCliente(i);
    if (eraRimandato) {
      // Il motivo resta nella storia del rapportino, ma non piu' «in evidenza».
      (r.rimandi = r.rimandi || []).push({ motivo: r.motivoRimando || '', corretto: op.creata || A.adesso() });
      delete r.motivoRimando;
    }
    r.stato = 'inviato';
    r.inviatoIl = A.adesso();
    r.fine = r.fine || op.creata || A.adesso();
    r.inizio = r.inizio || r.fine;
    i.stato = 'completato';
    (i.storico = i.storico || []).push({ stato: 'completato', data: op.creata || A.adesso(), utenteId: tecId });
    allineaMagazzino(db, i, tecId);
    A.registra(eraRimandato ? 'rapportino reinviato' : 'rapportino inviato', 'Intervento ' + i.numero + ' — ' + cli);
    A.avvisa('ufficio', tec.nome + (eraRimandato ? ' ha corretto e reinviato il rapportino di ' : ' ha inviato il rapportino di ') + cli, '#/u/intervento/' + i.id, { tipo: 'rapportino' });
  });

  A.gestoreCoda('nota', (p, op) => {
    const db = A.DB;
    if ((db.note || []).some(n => n.id === p.id)) return;
    const i = p.interventoId ? inDb(db, p.interventoId) : null;
    const tec = A.utenteDa(op.utenteId) || { nome: 'Un tecnico' };
    (db.note = db.note || []).push({ id: p.id || A.uid('not'), interventoId: p.interventoId || null, autoreId: op.utenteId, testo: p.testo, urgente: !!p.urgente, letta: false, data: p.data || op.creata || A.adesso() });
    A.registra('nota dal campo', tec.nome + (i ? ' — ' + nomeCliente(i) : ''));
    A.avvisa('ufficio', (p.urgente ? 'URGENTE — ' : '') + tec.nome + (i ? ' (' + nomeCliente(i) + ')' : '') + ': ' + taglia(p.testo, 90), i ? '#/u/intervento/' + i.id : '#/u/messaggi', { tipo: 'nota' });
  });

  A.gestoreCoda('richiesta_materiale', (p, op) => {
    const db = A.DB;
    if ((db.richiesteMateriale || []).some(x => x.id === p.id)) return;
    const tec = A.utenteDa(op.utenteId) || { nome: 'Un tecnico' };
    (db.richiesteMateriale = db.richiesteMateriale || []).push({ id: p.id || A.uid('rmat'), interventoId: p.interventoId || null, tecnicoId: op.utenteId, articoloId: p.articoloId || null, descrizione: p.descrizione, qta: p.qta, unita: p.unita || 'pz', urgenza: p.urgenza || 'normale', stato: 'nuova', data: p.data || op.creata || A.adesso(), fornitoreId: null, note: p.note || '' });
    A.registra('materiale segnalato', tec.nome + ': ' + p.descrizione + ' ×' + A.num(p.qta));
    if (p.urgenza === 'urgente' || p.urgenza === 'blocca_lavoro') {
      A.avvisa('ufficio', tec.nome + ': materiale ' + (p.urgenza === 'blocca_lavoro' ? 'che BLOCCA IL LAVORO' : 'URGENTE') + ' — ' + p.descrizione + ' ×' + A.num(p.qta) + ' ' + (p.unita || ''), '#/u/materiale', { tipo: 'materiale' });
    }
  });

  // ---------------------------------------------------------------------------
  // Stile del modulo (una volta sola). Solo variabili: il tema scuro e' nei token.
  // ---------------------------------------------------------------------------
  const CSS = `
/* Token del modulo. Nel tema scuro i blu del marchio usati come TESTO spariscono
   sul fondo scuro (e il toast diventa bianco su bianco): li ridefiniamo qui,
   solo per la superficie del tecnico. */
body.sup-tecnico{--tec-blu:var(--brand-700);--tec-acc-t:var(--accent-dark);--tec-ok-pieno:var(--ok);--tec-dang-pieno:var(--dang);--tec-toast:var(--ink);--tec-ombra:0 -2px 12px rgba(6,42,61,.06),0 12px 34px rgba(6,42,61,.2)}
@media (prefers-color-scheme:dark){
  body.sup-tecnico{--tec-blu:#8ED0EC;--tec-acc-t:#FFB27A;--tec-ok-pieno:#1C7A52;--tec-dang-pieno:#A82A2A;--tec-toast:#1D3B4C;--tec-ombra:0 -2px 12px rgba(0,0,0,.35),0 12px 34px rgba(0,0,0,.55)}
  body.sup-tecnico .pastiglia.blu{color:var(--tec-blu)}
  body.sup-tecnico .pastiglia.acc{color:var(--tec-acc-t);border-color:transparent}
  body.sup-tecnico .scelta input:checked+span{color:var(--tec-blu);border-color:var(--tec-blu);box-shadow:inset 0 0 0 1px var(--tec-blu)}
  body.sup-tecnico .stepper button,body.sup-tecnico .tabbar a.on{color:var(--tec-blu)}
  body.sup-tecnico .avviso:not(.warn):not(.dang):not(.ok){color:var(--ink)}
  body.sup-tecnico .avviso:not(.warn):not(.dang):not(.ok) svg{color:var(--tec-blu)}
  body.sup-tecnico .btn:not(.pri):not(.acc):not(.ok):not(.per):hover{color:var(--tec-blu)}
  body.sup-tecnico .btn.ok{background:var(--tec-ok-pieno);border-color:var(--tec-ok-pieno)}
  body.sup-tecnico .toast{background:var(--tec-toast)}
  body.sup-tecnico .toast.ok{background:var(--tec-ok-pieno)}
  body.sup-tecnico .toast.per{background:var(--tec-dang-pieno)}
  body.sup-tecnico .fascia-offline{background:var(--tec-dang-pieno)}
}
.tec{position:relative}
/* testata */
.tec-tit{flex:1;min-width:0}
.tec-tit h1{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tec-tit small{display:block;color:rgba(255,255,255,.72);font-size:12.5px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.testa-tec .btn.indietro{min-height:44px;min-width:44px}
.tec-avatar{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.14);color:#fff;font-weight:750;font-size:14px;text-decoration:none!important;flex:0 0 42px;border:1px solid rgba(255,255,255,.2)}
.tec-salvato{flex:0 0 auto;max-width:112px;font-size:11.5px;font-weight:650;line-height:1.2;color:rgba(255,255,255,.82);text-align:right;display:flex;align-items:center;gap:4px}
.tec-salvato.in-corso{color:rgba(255,255,255,.55)}
.tec-salvato svg{color:#7FE0B0}
/* misure da dita con i guanti */
.tec .pagina .btn{min-height:48px}
.tec .pagina .btn.pic{min-height:44px}
.tec .pagina .btn.icona{min-width:48px}
body.sup-tecnico input[type=text],body.sup-tecnico input[type=search],body.sup-tecnico input[type=tel],body.sup-tecnico input[type=number],body.sup-tecnico select,body.sup-tecnico textarea{font-size:16px;min-height:48px}
body.sup-tecnico textarea{min-height:92px}
.tec .sez span{letter-spacing:0;text-transform:none;font-weight:650;font-size:12.5px}
.tec-sott{font-size:12px;font-weight:750;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);margin:16px 0 8px}
.tec-sott:first-child{margin-top:0}
.tec-link{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;min-height:44px;margin-top:6px;background:none;border:0;color:var(--tec-blu);font-weight:650;font-size:14.5px;cursor:pointer;text-decoration:none!important}
.tec-blocco{scroll-margin-top:84px}
.tec .tessera>.tt{padding:12px 16px}
.tec .tessera>.cp{padding:14px 16px}
.tec-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
/* oggi */
a.sync{text-decoration:none!important}
.sync .cx1 b{display:block;font-size:15px}
.sync .cx1 small{display:block;color:inherit;opacity:.85;font-weight:550;font-size:12.5px}
.sync svg.ic.g{width:26px;height:26px}
.tec-demo{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin:10px 0 0;font-size:12px;color:var(--ink-3)}
.tec-demo b{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase}
.tec-demo .btn{border-style:dashed}
.giorni{margin-top:14px}
.giorni a{min-height:58px}
.tec-riep{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:18px 4px 10px}
.tec-riep h2{font-size:17px}
.tec-riep span{font-size:13px;color:var(--ink-3);font-variant-numeric:tabular-nums;white-space:nowrap}
.lavoro .tec-pp{display:flex;gap:5px;flex-wrap:wrap}
.lavoro .tec-freccia{align-self:center;color:var(--ink-3)}
.lavoro .ora small{display:block;color:var(--ink-3)}
.lavoro.tec-adesso{border-color:var(--accent);box-shadow:inset 3px 0 0 var(--accent),var(--sh-2)}
.tec-etichetta{display:block;font-size:10.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--tec-acc-t);margin-bottom:2px}
.lavoro.urgente .tec-etichetta{color:var(--dang)}
.tec-fatti{margin-top:6px}
.tec-vuoto{background:var(--surface);border:1.5px dashed var(--line);border-radius:18px}
.tec-vuoto .stato-vuoto svg{color:var(--ink-3);opacity:.5}
/* scheda lavoro */
.tec-testata{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:2px 2px 12px}
.tec-testata .quando{margin-left:auto;font-size:13px;font-weight:650;color:var(--ink-2);font-variant-numeric:tabular-nums}
.tec-cliente{font-size:18px;font-weight:750;line-height:1.25;letter-spacing:-.01em}
.tec-cliente small{display:block;font-size:12.5px;font-weight:600;color:var(--ink-3);letter-spacing:0}
.tec-ind{margin:8px 0 12px;font-size:15px;line-height:1.4}
.tec-ind small{display:block;color:var(--ink-3);font-size:13px}
.tec-accesso{margin-bottom:12px}
.tec-riga-ic{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-top:1px solid var(--line-2);font-size:14.5px}
.tec-riga-ic>svg{color:var(--ink-3);margin-top:2px}
.tec-riga-ic small{display:block;color:var(--ink-3);font-size:12.5px}
.tec .azioni-grandi{margin:4px 0 14px}
.tec .azioni-grandi .btn{min-height:64px;font-size:15px}
.tec .azioni-grandi .btn small{font-size:11.5px;font-weight:550;opacity:.8;color:inherit}
.tec-richiesta{font-size:16px;line-height:1.45;padding:2px 0 2px 12px;border-left:3px solid var(--accent)}
.tec-voci{list-style:none;display:grid;gap:6px}
.tec-voci li{display:flex;gap:10px;align-items:baseline;font-size:14px;padding:8px 10px;background:var(--bg);border-radius:10px}
.tec-voci .q{flex:0 0 58px;font-weight:750;font-variant-numeric:tabular-nums;color:var(--ink-2)}
.tec-voci li.escl{opacity:.6}
.tec-voci li.escl span:last-child{text-decoration:line-through}
.tec-voci li.escl em{text-decoration:none;display:inline-block}
.tec-voci li.nota{color:var(--ink-2);font-style:italic}
.tec-macchina{display:flex;gap:12px;align-items:center;margin-bottom:12px}
.tec-macchina .ic2{width:48px;height:48px;border-radius:14px;background:var(--brand-50);color:var(--tec-blu);display:grid;place-items:center;flex:0 0 48px}
.tec-macchina b{display:block;font-size:16px;line-height:1.25}
.tec-macchina small{display:block;color:var(--ink-3);font-size:13px}
.tec-dl{font-size:14px;gap:8px 14px}
.tec-dl dd{font-variant-numeric:tabular-nums}
.tec-altre{list-style:none;display:grid;gap:6px;font-size:14px}
.tec-altre li{display:flex;gap:8px;align-items:center}
.tec-altre li svg{color:var(--ink-3)}
.tec-storia{list-style:none}
.tec-storia li{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--line-2)}
.tec-storia li:first-child{border-top:0;padding-top:0}
.tec-storia .d{flex:0 0 56px;text-align:center;line-height:1.15;white-space:nowrap}
.tec-storia .d b{display:block;font-size:14px;font-variant-numeric:tabular-nums}
.tec-storia .d small{font-size:11px}
.tec-storia .cx1{flex:1;min-width:0}
.tec-storia .t1{font-weight:650;font-size:14px}
.tec-storia .t2{font-size:13.5px;color:var(--ink-2);line-height:1.4}
/* barra dei bottoni di stato: sempre sotto il pollice */
.tec-barra{position:sticky;z-index:15;margin-top:18px;padding:12px;border-radius:20px;background:var(--surface);border:1px solid var(--line);box-shadow:var(--tec-ombra)}
@media(max-width:699px){.tec-barra{bottom:calc(76px + env(safe-area-inset-bottom))}}
@media(min-width:700px){.tec-barra{bottom:10px}}
.tec-barra{padding:10px}
.tec-barra .crono{margin-bottom:8px;padding:9px 12px;border-radius:14px}
.tec-barra .crono .t{font-size:25px;line-height:1.15}
.tec-barra .tec-link{min-height:40px;margin-top:4px}
.tec-barra .btn.xl{min-height:56px}
.tec-cr{flex:1;min-width:0}
.tec-cr .t{display:block}
.crono.tec-fermo{background:var(--warn-50);color:var(--warn);border:1px solid var(--warn-line)}
.crono.tec-fermo small{color:var(--warn);opacity:.85}
.tec-fasi-lav{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:0 2px 8px}
.tec-fasi-lav div{font-size:10.5px;font-weight:700;color:var(--ink-3);text-align:center;letter-spacing:.02em}
.tec-fasi-lav i{display:block;height:5px;border-radius:99px;background:var(--line);margin-bottom:4px}
.tec-fasi-lav .on i{background:var(--accent)}
.tec-fasi-lav .on{color:var(--ink)}
.tec-fasi-lav .ok i{background:var(--ok)}
.tec-barra-info{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--ink-2);margin:0 2px 10px}
.tec-barra .avviso{margin-bottom:10px}
/* passi del rapportino */
.tec-passi{margin:0 2px 12px}
.tec-passi .stadi{margin:0 0 5px}
.tec-passi .lbl{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font-size:11.5px;font-weight:650;color:var(--ink-3)}
.tec-passi .lbl .on{color:var(--ink)}
.tec-salta{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin:0 -14px 4px;padding:0 14px 6px}
.tec-salta::-webkit-scrollbar{display:none}
.tec-salta button{flex:0 0 auto;min-height:44px;padding:6px 13px;border-radius:99px;border:1.5px solid var(--line);background:var(--surface);font-weight:650;font-size:13.5px;color:var(--ink-2);cursor:pointer;display:inline-flex;gap:6px;align-items:center}
.tec-salta button b{color:var(--ink);font-variant-numeric:tabular-nums}
.tec-salta button .fatto{color:var(--ok)}
.tec-obb{font-size:11px;font-weight:700;color:var(--tec-acc-t);background:var(--accent-50);padding:1px 7px;border-radius:99px;margin-left:4px;letter-spacing:0}
.tec-area{position:relative}
.tec-area.con-mic textarea{padding-right:58px}
.tec-mic{position:absolute;right:6px;bottom:6px;width:46px;height:46px;border-radius:12px;border:1.5px solid var(--line);background:var(--bg);color:var(--ink-2);display:grid;place-items:center;cursor:pointer}
.tec-mic.on{background:var(--accent);border-color:var(--accent);color:#fff;animation:tec-pulsa 1.2s ease-out infinite}
@keyframes tec-pulsa{0%{box-shadow:0 0 0 0 rgba(234,106,12,.55)}100%{box-shadow:0 0 0 14px rgba(234,106,12,0)}}
.tec-rapidi{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.tec-rapidi button{min-height:44px;padding:8px 12px;border-radius:12px;border:1.5px dashed var(--line);background:var(--bg);color:var(--ink-2);font-size:13.5px;font-weight:600;cursor:pointer;text-align:left;line-height:1.25}
.tec-rapidi.scorre{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin-right:-16px;padding-right:16px;-webkit-mask-image:linear-gradient(to right,#000 88%,transparent);mask-image:linear-gradient(to right,#000 88%,transparent)}
.tec-rapidi.scorre::-webkit-scrollbar{display:none}
.tec-rapidi.scorre button{flex:0 0 auto;white-space:nowrap}
.tec-rapidi button.usato{border-style:solid;border-color:var(--ok-line);background:var(--ok-50);color:var(--ok)}
.tec-testo+.tec-testo{margin-top:18px}
.campo.tec-manca>label{color:var(--dang)}
.campo.tec-manca textarea{border-color:var(--dang);box-shadow:0 0 0 3px var(--dang-50)}
.tec-manca-msg{font-size:13px;color:var(--dang);font-weight:600}
/* ore */
.tec-ore{list-style:none;display:grid;gap:8px}
/* griglie a una colonna: la colonna non deve allargarsi alla misura minima del contenuto (una select larga sfonda la scheda) */
.tec-ore,.tec-mat,.tec-ris,.tec-inviati,.tec-voci,.tec-due,.tec-bottoni,.tec-urgenze,.tec-sugg{grid-template-columns:minmax(0,1fr)}
.tec-ore li{display:flex;align-items:center;gap:6px;padding:6px;border:1px solid var(--line-2);border-radius:14px;background:var(--bg)}
.tec-ore select{flex:1 1 auto;width:auto;min-width:0;font-weight:650;padding-left:10px;padding-right:4px}
.tec .tec-ore .stepper{flex:0 0 auto}
.tec .tec-ore .stepper button{width:44px}
.tec .tec-ore .stepper output{min-width:60px}
.tec .pagina .tec-ore .btn.icona{min-width:44px;padding:6px}
.stepper output{display:grid;place-items:center;min-width:66px;height:44px;padding:0 6px;font-weight:750;font-variant-numeric:tabular-nums;border-left:1px solid var(--line-2);border-right:1px solid var(--line-2);white-space:nowrap}
.tec .stepper{border-radius:12px}
.tec .stepper button{width:48px;height:48px;font-size:22px}
.tec .stepper input{height:48px;min-height:48px;width:64px;font-size:17px;font-variant-numeric:tabular-nums}
.tec-agg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}
.tec-agg .btn{font-size:14px;padding:8px 10px}
.tec-tot{display:flex;justify-content:space-between;font-weight:750;margin-top:12px;padding:10px 4px 0;border-top:1px solid var(--line-2);font-variant-numeric:tabular-nums}
.tec-crono-mini{margin-bottom:12px}
.tec-crono-mini .t{font-size:24px}
.tec-crono-mini .btn{min-height:48px;background:var(--tec-ok-pieno);border-color:var(--tec-ok-pieno);color:#fff}
/* materiale */
.tec-ris{display:grid;gap:6px;margin-top:8px}
.tec-ris:empty{display:none}
.tec-ris button{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:9px 10px 9px 12px;min-height:58px;border-radius:12px;border:1.5px solid var(--line);background:var(--surface);cursor:pointer;color:var(--ink)}
.tec-ris .cx1{flex:1;min-width:0}
.tec-ris .cx1 b{display:block;font-weight:650;line-height:1.25}
.tec-ris .cx1 small{display:block}
.tec-ris .piu{width:40px;height:40px;border-radius:11px;background:var(--brand-700);color:#fff;display:grid;place-items:center;flex:0 0 40px}
.tec-nessuno{font-size:14px;padding:6px 2px}
.tec-soliti{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.tec-soliti button{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;text-align:left;padding:9px 11px;min-height:62px;border-radius:12px;border:1.5px solid var(--line);background:var(--surface);cursor:pointer;color:var(--ink);position:relative}
.tec-soliti button b{font-size:13.5px;font-weight:650;line-height:1.25;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.tec-soliti button small{font-size:11.5px;font-variant-numeric:tabular-nums}
.tec-soliti button.dentro{border-color:var(--ok-line);background:var(--ok-50)}
.tec-soliti button .contatore{position:absolute;top:-7px;right:-5px;background:var(--tec-ok-pieno)}
.tec-mat{list-style:none;display:grid;gap:8px}
.tec-mat li{padding:10px 10px 10px 12px;border:1px solid var(--line-2);border-radius:14px;background:var(--bg)}
.tec-mat li.nuovo{animation:tec-lampo 1.4s ease}
@keyframes tec-lampo{0%{background:var(--accent-50);border-color:var(--accent)}}
.tec-mat .nm{font-weight:700;line-height:1.3}
.tec-mat .sub{font-size:12.5px;color:var(--ink-3);font-variant-numeric:tabular-nums}
.tec-mat .ctr{display:flex;align-items:center;gap:10px;margin-top:8px}
.tec-mat .un{font-weight:650;color:var(--ink-2);min-width:30px}
.tec-mat .sp{flex:1}
.tec-mat .avv{font-size:12.5px;color:var(--warn);margin-top:8px;display:flex;gap:6px;align-items:flex-start;line-height:1.35}
.tec-mat .avv svg{margin-top:1px}
.tec-fuori{margin-top:10px}
/* foto */
.tec-fasi{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:4px}
.tec-fasi::-webkit-scrollbar{display:none}
.tec-fasi .scelta span{white-space:nowrap}
.tec-scatta{display:grid;grid-template-columns:1.4fr 1fr;gap:8px;margin:12px 0}
.tec-scatta .btn{position:relative;overflow:hidden}
.tec-foto{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.tec-foto .apri{position:absolute;inset:0;border:0;padding:0;background:none;cursor:zoom-in}
.tec-foto .fase{position:absolute;left:6px;right:6px;bottom:6px;min-height:40px;border-radius:10px;border:0;background:rgba(6,27,39,.8);color:#fff;font-weight:700;font-size:13.5px;display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer}
.tec-foto .togli{position:absolute;top:6px;right:6px;width:40px;height:40px;border-radius:50%;border:0;background:rgba(255,255,255,.92);color:#0D1B24;display:grid;place-items:center;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.25)}
.tec-privacy{display:flex;gap:8px;align-items:flex-start;margin-top:12px;font-size:12.5px;color:var(--ink-3);line-height:1.4}
.tec-privacy svg{margin-top:1px}
.tec-foto-grande{width:100%;border-radius:12px;display:block;margin-bottom:12px;background:var(--bg-2)}
/* note e segnalazioni */
.tec-due{display:grid;gap:8px}
.tec-due .btn{justify-content:flex-start}
.tec-inviati{list-style:none;margin-top:14px;display:grid;gap:8px}
.tec-inviati li{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:12px;background:var(--bg);font-size:14px}
.tec-inviati li>svg{color:var(--ink-3);margin-top:2px}
.tec-inviati .cx1{flex:1;min-width:0}
.tec-inviati small{display:block;font-size:12px}
.tec-risp{margin-top:6px;padding:7px 10px;border-radius:10px;background:var(--surface);border:1px solid var(--line);font-size:13.5px}
.tec-avanti{margin-top:22px}
/* modali del tecnico (stanno fuori da .tec) */
body.sup-tecnico .modale .scelte .scelta span{min-height:48px}
.tec-sugg{display:grid;gap:6px;margin:-6px 0 14px}
.tec-sugg:empty{display:none}
.tec-sugg button{display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;text-align:left;padding:8px 12px;min-height:48px;border-radius:10px;border:1.5px solid var(--line);background:var(--surface);cursor:pointer;color:var(--ink);font-size:14px}
.tec-sugg button small{white-space:nowrap}
.tec-scelto{display:flex;align-items:center;gap:8px;margin:-6px 0 14px;font-size:13px;color:var(--ok);font-weight:650}
.tec-urgenze{display:grid;gap:8px}
.tec-urgenze .scelta span{display:flex;width:100%;flex-direction:column;align-items:flex-start;gap:0;min-height:56px}
.tec-urgenze .scelta span small{font-weight:500;color:var(--ink-3)}
.tec-urgenze .scelta{display:block}
.tec-qta{display:flex;gap:10px;align-items:flex-end}
.tec-qta .campo{flex:1}
/* firma */
.tec-pad-w{margin-top:4px}
.tec-pad{height:auto;aspect-ratio:${RAPPORTO_FIRMA};width:100%}
.tec-pad.spenta{opacity:.35;pointer-events:none}
.tec-pad .suggerimento{position:absolute;left:0;right:0;top:40%;text-align:center;color:#9FB3BF;font-size:15px;font-weight:600;pointer-events:none}
.tec-pad.firmata .suggerimento{display:none}
.tec-pad-azioni{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
.tec-pad-azioni .tec-stato-firma{grid-column:1/-1;min-height:24px}
.tec-pad-testa{display:none}
.tec-pad-w.piena{position:fixed;inset:0;z-index:250;background:var(--bg);display:flex;flex-direction:column;justify-content:center;align-items:center;padding:16px;gap:10px}
@media(min-width:700px){.tec-pad-w.piena{position:absolute;border-radius:34px}}
.tec-pad-w.piena .tec-pad{width:min(100%,calc((100vh - 170px) * ${RAPPORTO_FIRMA}))}
.tec-pad-w.piena .tec-pad-testa{display:flex;width:min(100%,calc((100vh - 170px) * ${RAPPORTO_FIRMA}));justify-content:space-between;align-items:center;gap:10px}
.tec-pad-w.piena .tec-pad-azioni{width:min(100%,calc((100vh - 170px) * ${RAPPORTO_FIRMA}))}
.tec-pad-w.piena [data-az=tec-pad-piena].btn:not(.pri){display:none}
.tec-pad-w.piena .tec-pad-azioni{grid-template-columns:1fr}
.tec-gira{display:none;font-size:13px;color:var(--ink-3);text-align:center}
@media (orientation:portrait){.tec-pad-w.piena .tec-gira{display:block}}
.tec-stato-firma{display:flex;gap:6px;align-items:center;font-size:13px;font-weight:650;color:var(--ink-3)}
.tec-stato-firma.ok{color:var(--ok)}
.tec-nota-firma{font-size:12.5px;color:var(--ink-3);margin-top:8px;line-height:1.4}
.tec-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.tec-chips button{min-height:40px;padding:6px 12px;border-radius:99px;border:1.5px solid var(--line);background:var(--surface);font-weight:600;font-size:13.5px;cursor:pointer;color:var(--ink-2)}
.tec-chips button.on{border-color:var(--tec-blu);color:var(--tec-blu);background:var(--brand-50)}
.tec-riep-lista{list-style:none;margin-top:4px}
.tec-riep-lista li{display:flex;justify-content:space-between;gap:10px;padding:3px 0}
.tec-riep-lista li span:last-child{font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:650}
.tec-assente{margin-top:6px;padding:4px 14px;border:1.5px solid var(--line);border-radius:14px;background:var(--surface)}
.tec-assente .spunta{min-height:52px;align-items:center;font-weight:650}
.tec-firma-img{display:block;max-width:100%;width:320px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:6px}
/* chiusura */
.tec-esiti{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.tec-esiti .scelta{display:block}
.tec-esiti .scelta span{display:flex;width:100%;min-height:64px;padding:8px 10px;gap:8px;border-radius:14px;font-size:14px;line-height:1.2;white-space:normal}
.tec-esiti .scelta span b{min-width:0;overflow-wrap:break-word;hyphens:auto}
.tec-esiti.manca .scelta span{border-color:var(--dang)}
.tec-esito-ic{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;flex:0 0 26px}
.tec-esito-ic.ok{background:var(--ok-50);color:var(--ok)}
.tec-esito-ic.warn{background:var(--warn-50);color:var(--warn)}
.tec-esito-ic.dang{background:var(--dang-50);color:var(--dang)}
.tec-sw-riga{position:relative;display:flex;align-items:center;gap:12px;padding:12px 14px;border:1.5px solid var(--line);border-radius:14px;background:var(--surface);cursor:pointer;min-height:64px;margin-top:10px}
.tec-sw-riga input{position:absolute;opacity:0;pointer-events:none}
.tec-sw-riga .cx1{flex:1}
.tec-sw-riga b{display:block}
.tec-sw-riga small{display:block}
.tec-sw{width:50px;height:30px;border-radius:99px;background:var(--line);position:relative;flex:0 0 50px;transition:background .15s}
.tec-sw::after{content:"";position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .15s}
.tec-sw-riga input:checked~.tec-sw{background:var(--tec-ok-pieno)}
.tec-sw-riga input:checked~.tec-sw::after{transform:translateX(20px)}
.tec-sw-riga input:focus-visible~.tec-sw{box-shadow:0 0 0 3px rgba(18,126,163,.35)}
.tec-riepilogo{list-style:none}
.tec-riepilogo li{display:flex;gap:12px;align-items:flex-start;padding:11px 0;border-top:1px solid var(--line-2)}
.tec-riepilogo li:first-child{border-top:0;padding-top:0}
.tec-riepilogo li>svg{margin-top:2px;color:var(--ink-3)}
.tec-riepilogo .cx1{flex:1;min-width:0}
.tec-riepilogo .cx1 b{display:block;font-size:13px;color:var(--ink-3);font-weight:650}
.tec-riepilogo .cx1 span{font-size:14.5px;overflow-wrap:anywhere}
.tec-riepilogo li.manca>svg,.tec-riepilogo li.manca .cx1 span{color:var(--warn)}
.tec-riepilogo .btn{min-height:44px;flex:0 0 auto}
/* conferma d'invio */
.tec-fatto{text-align:center;padding:26px 8px 6px}
.tec-fatto .cerchio{width:104px;height:104px;border-radius:50%;display:grid;place-items:center;margin:0 auto 18px;background:var(--ok-50);color:var(--ok);border:2px solid var(--ok-line);animation:tec-entra .35s cubic-bezier(.2,.8,.3,1.3)}
.tec-fatto .cerchio svg{width:52px;height:52px;stroke-width:2.4}
.tec-fatto.attesa .cerchio{background:var(--warn-50);color:var(--warn);border-color:var(--warn-line)}
@keyframes tec-entra{from{transform:scale(.6);opacity:0}}
.tec-fatto h2{font-size:26px;letter-spacing:-.02em}
.tec-fatto p{color:var(--ink-2);margin-top:6px;font-size:15.5px;line-height:1.45}
.tec-fatto .n{display:inline-block;margin-top:12px}
.tec-prossimo{margin-top:22px}
.tec-bottoni{display:grid;gap:10px;margin-top:16px}
/* coda, avvisi, profilo */
.tec-op{list-style:none}
.tec-op li{display:flex;gap:12px;align-items:center;padding:12px 16px;border-top:1px solid var(--line-2)}
.tec-op li:first-child{border-top:0}
.tec-op .ic2{width:38px;height:38px;border-radius:11px;background:var(--warn-50);color:var(--warn);display:grid;place-items:center;flex:0 0 38px}
.tec-op .cx1{flex:1;min-width:0}
.tec-op .cx1 b{display:block;font-size:14.5px;line-height:1.3}
.tec-op .cx1 small{display:block}
.tec-come{list-style:none;display:grid;gap:12px}
.tec-come li{display:flex;gap:12px;align-items:flex-start;font-size:14.5px;line-height:1.45}
.tec-come li>span{width:28px;height:28px;border-radius:50%;background:var(--brand-50);color:var(--tec-blu);display:grid;place-items:center;flex:0 0 28px;font-weight:800;font-size:13px}
.tec-avvisi{list-style:none}
.tec-avvisi button{display:flex;width:100%;gap:12px;align-items:flex-start;text-align:left;padding:13px 16px;border:0;border-top:1px solid var(--line-2);background:transparent;color:var(--ink);cursor:pointer;min-height:64px}
.tec-avvisi li:first-child button{border-top:0}
.tec-avvisi button.nuovo{background:var(--brand-50)}
.tec-avvisi .ic2{width:36px;height:36px;border-radius:50%;background:var(--bg-2);color:var(--ink-2);display:grid;place-items:center;flex:0 0 36px}
.tec-avvisi button.nuovo .ic2{background:var(--accent);color:#fff}
.tec-avvisi .cx1{flex:1;min-width:0}
.tec-avvisi .cx1 span{display:block;line-height:1.35}
.tec-avvisi button.nuovo .cx1 span{font-weight:700}
.tec-avvisi small{display:block;margin-top:2px}
.tec-io{display:flex;gap:14px;align-items:center}
.tec-io .avatar{width:58px;height:58px;flex-basis:58px;font-size:20px}
.tec-io b{display:block;font-size:18px}
.tec-furgone{list-style:none}
.tec-furgone li{display:flex;gap:10px;align-items:center;padding:9px 16px;border-top:1px solid var(--line-2)}
.tec-furgone .cx1{flex:1;min-width:0}
.tec-furgone .cx1 span{display:block;font-weight:600;font-size:14px;line-height:1.3}
.tec-furgone .q{font-weight:750;font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right}
.tec-furgone .q small{font-weight:600}
.tec-furgone .q.poco{color:var(--warn)}
.tec-da-contare{display:block;font-size:10.5px;font-weight:650}
.tec-furgone .gr{padding:12px 16px 4px;border-top:1px solid var(--line-2);font-size:11.5px;font-weight:750;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
.tec-furgone .gr:first-child{border-top:0}
.tec-furgone .btn{min-height:40px!important}
.tec-installa ol{padding-left:20px;display:grid;gap:4px;font-size:14.5px;margin-top:6px}
.tec-installa .os{padding:12px 14px;border-radius:14px;background:var(--bg);margin-top:10px}
.tec-installa .os.tuo{box-shadow:inset 0 0 0 1.5px var(--brand-500)}
.tec-installa .os>b{display:flex;gap:8px;align-items:center}
`;
  if (!document.getElementById('stile-tecnico')) document.head.insertAdjacentHTML('beforeend', '<style id="stile-tecnico">' + CSS + '</style>');

  // ---------------------------------------------------------------------------
  // Il guscio: testata, pagina, barra in basso. Uguale per tutte le pagine.
  // ---------------------------------------------------------------------------
  function guscio(o) {
    const off = !A.inRete();
    const nCoda = A.codaMia().length, nAvv = A.nonLetti();
    const tab = (k, href, ic, testo, n, tono) => `<a href="${href}" class="${o.tab === k ? 'on' : ''}" ${o.tab === k ? 'aria-current="page"' : ''}>${icona(ic)}<span>${testo}</span>${n ? `<span class="contatore ${tono || ''}" aria-label="${n} ${k === 'coda' ? 'da inviare' : 'non letti'}">${n}</span>` : ''}</a>`;
    return `<div class="tec">
      <div class="scorri">
        ${off ? `<div class="fascia-offline" role="status">${icona('senzarete', 'p')} Senza rete — il lavoro resta sul telefono</div>` : ''}
        <header class="testa-tec">
          ${o.indietro ? `<a class="btn indietro" href="${h(o.indietro)}" aria-label="Indietro">${icona('indietro')}</a>` : ''}
          <div class="tec-tit"><h1>${h(o.titolo)}</h1>${o.sotto ? `<small>${h(o.sotto)}</small>` : ''}</div>
          ${o.destra || ''}
        </header>
        <main class="pagina">${o.contenuto}</main>
      </div>
      <nav class="tabbar" aria-label="Sezioni dell'app">
        ${tab('oggi', '#/t/oggi', 'calendario', 'Oggi')}
        ${tab('coda', '#/t/coda', 'invia', 'Da inviare', nCoda)}
        ${tab('avvisi', '#/t/avvisi', 'campanella', 'Avvisi', nAvv, 'blu')}
        ${tab('profilo', '#/t/profilo', 'utente', 'Io')}
      </nav>
    </div>
    <p class="fuori-cornice">Questa è l'app del tecnico come la vede sul telefono. · <a href="#" data-az="tec-finestra">Apri l'ufficio in un'altra finestra</a> · <a href="#" data-az="esci">Esci</a></p>`;
  }
  function nonTrovato() {
    return guscio({
      titolo: 'Lavoro non trovato', indietro: '#/t/oggi', tab: 'oggi',
      contenuto: `<div class="tessera tec-vuoto">${A.vuoto('Questo lavoro non è nella tua agenda', 'Forse l\'ufficio l\'ha passato a un collega o l\'ha annullato. Se ti serve, chiama l\'ufficio.', 'calendario')}</div>
        <div class="spazio"></div><a class="btn pri xl" href="#/t/oggi">${icona('indietro')} Torna a oggi</a>`
    });
  }
  let ultimaPagina = null, roFirma = null, dettatura = null;
  /** Prima di disegnare una pagina: salva il sospeso, ferma cio' che scorre. */
  function preparaPagina() {
    flush();
    fermaTimerCrono();
    if (roFirma) { roFirma.disconnect(); roFirma = null; }
    const pag = (location.hash || '').split('?')[0];
    if (pag !== ultimaPagina && dettatura) { try { dettatura.rec.stop(); } catch (_) { } dettatura = null; }
    ultimaPagina = pag;
  }
  function passi(n) {
    const nomi = ['Rapportino', 'Firma', 'Chiusura'];
    return `<div class="tec-passi" aria-label="Passo ${n} di 3"><div class="stadi">${nomi.map((_, k) => `<i class="${k + 1 < n ? 'ok' : k + 1 === n ? 'on' : ''}"></i>`).join('')}</div>
      <div class="lbl">${nomi.map((t, k) => `<span class="${k + 1 === n ? 'on' : ''}">${k + 1}. ${t}</span>`).join('')}</div></div>`;
  }
  function indicatoreSync() {
    const n = A.codaMia().length;
    if (!A.inRete()) return `<a class="sync off" href="#/t/coda">${icona('senzarete', 'g')}<span class="cx1"><b>Senza rete — ${n} in attesa</b><small>Il lavoro resta sul telefono e parte da solo</small></span><span class="n">${n}</span></a>`;
    if (n) return `<a class="sync attesa" href="#/t/coda">${icona('ricarica', 'g')}<span class="cx1"><b>${n === 1 ? '1 scheda da inviare' : n + ' schede da inviare'}</b><small>Tocca per inviarle adesso</small></span><span class="n">${n}</span></a>`;
    return `<a class="sync" href="#/t/coda">${icona('spunta', 'g')}<span class="cx1"><b>Tutto inviato</b><small>L'ufficio vede tutto il tuo lavoro</small></span></a>`;
  }
  function bottoneRete() {
    const r = A.inRete();
    return `<div class="tec-demo"><b>Demo</b><button type="button" class="btn pic" data-az="tec-rete" aria-pressed="${r ? 'false' : 'true'}">${icona(r ? 'senzarete' : 'rete', 'p')} ${r ? 'Togli la rete' : 'Rimetti la rete'}</button></div>`;
  }

  // ===========================================================================
  // 1. OGGI
  // ===========================================================================
  function schedaLavoro(i, etichetta) {
    const c = A.cliente(i.clienteId) || {}, s = A.sede(i.sedeId);
    const st = statoTec(i);
    const fatto = CHIUSI.includes(st);
    const urg = i.priorita === 'urgente';
    return `<a class="lavoro${urg ? ' urgente' : ''}${fatto ? ' fatto' : ''}${etichetta ? ' tec-adesso' : ''}" href="#/t/lavoro/${h(i.id)}">
      <div class="ora"><b>${h(i.ora || '—')}</b><small>${i.durataMin ? oreBrevi(i.durataMin) : ''}</small></div>
      <div class="cx1">
        ${etichetta ? `<span class="tec-etichetta">${h(etichetta)}</span>` : ''}
        <div class="cl">${h(c.nome || 'Cliente')}</div>
        <div class="ind">${h(A.indirizzo(s))}</div>
        <div class="tec-pp">${A.pastiglia(A.TIPI_INTERVENTO[i.tipo] || i.tipo, 'grigio', true)}${urg ? A.pastiglia('Urgente', 'dang') : i.priorita === 'alta' ? A.pastiglia('Priorità alta', 'acc') : ''}${pastigliaTec(i)}</div>
      </div>
      ${icona('destra', 'tec-freccia')}
    </a>`;
  }
  A.rotta('#/t/oggi', 'tecnico', par => {
    preparaPagina();
    const u = io(); const oggi = A.oggi();
    const g = /^\d{4}-\d{2}-\d{2}$/.test(par.q.g || '') ? par.q.g : oggi;
    const miei = mieiLavori();
    const delGiorno = miei.filter(i => i.data === g);
    const aperti = delGiorno.filter(i => !CHIUSI.includes(statoTec(i))).sort(perOra);
    const chiusi = delGiorno.filter(i => CHIUSI.includes(statoTec(i))).sort(perOra);
    const daCorreggere = miei.filter(i => statoTec(i) === 'rimandato');
    const rimasti = g === oggi ? miei.filter(i => i.data && i.data < oggi && ['pianificato', 'in_viaggio', 'in_corso', 'sospeso'].includes(statoTec(i))).sort((a, b) => a.data.localeCompare(b.data)) : [];
    const conLavori = new Set(miei.filter(i => i.stato !== 'annullato').map(i => i.data));
    const giorni = [];
    for (let k = -1; k <= 6; k++) giorni.push(A.piuGiorni(oggi, k));
    // L'etichetta «Adesso» sul lavoro gia' partito, altrimenti «Prossimo» sul primo da fare.
    let evid = null, etich = '';
    if (g === oggi && aperti.length) {
      evid = aperti.find(i => ['in_viaggio', 'in_corso', 'sospeso'].includes(statoTec(i)));
      etich = evid ? 'Adesso' : 'Prossimo';
      evid = evid || aperti.find(i => statoTec(i) !== 'rimandato') || null;
    }
    const titoloGiorno = g === oggi ? 'Oggi' : g === A.piuGiorni(oggi, 1) ? 'Domani' : g === A.piuGiorni(oggi, -1) ? 'Ieri' : cap(A.dataLunga(g));
    const contenuto = `
      ${indicatoreSync()}
      ${bottoneRete()}
      <nav class="giorni" aria-label="Scegli il giorno">${giorni.map(d => {
      const dd = A.daGiorno(d);
      const n = miei.filter(i => i.data === d && i.stato !== 'annullato').length;
      return `<a href="#/t/oggi?g=${d}" class="${d === g ? 'on' : ''}${conLavori.has(d) ? ' ha' : ''}" aria-label="${h(A.dataLunga(d))}: ${n ? n + (n === 1 ? ' lavoro' : ' lavori') : 'nessun lavoro'}" ${d === g ? 'aria-current="date"' : ''}><small>${d === oggi ? 'oggi' : A.GIORNI_BREVI[dd.getDay()]}</small><b>${dd.getDate()}</b><i></i></a>`;
    }).join('')}</nav>
      ${daCorreggere.map(i => `<a class="avviso dang" style="margin-top:14px;text-decoration:none" href="#/t/rapportino/${h(i.id)}">${icona('attenzione')}<div><b>Rapportino da correggere — ${h(nomeCliente(i))}</b><br>${h(taglia(i.rapporto.motivoRimando || 'L\'ufficio te l\'ha rimandato', 110))}<br><u>Correggilo adesso</u></div></a>`).join('')}
      ${rimasti.length ? `<div class="tec-riep"><h2>Rimasti aperti</h2><span>dai giorni scorsi</span></div>${rimasti.map(i => schedaLavoro(i, 'Del ' + A.dataBreve(i.data))).join('')}` : ''}
      <div class="tec-riep"><h2>${h(titoloGiorno)}${g !== oggi && titoloGiorno.length < 8 ? ' · ' + h(A.dataLunga(g)) : ''}</h2><span>${delGiorno.length ? delGiorno.length + (delGiorno.length === 1 ? ' lavoro' : ' lavori') + (chiusi.length ? ' · ' + chiusi.length + (chiusi.length === 1 ? ' fatto' : ' fatti') : '') : ''}</span></div>
      ${delGiorno.length ? aperti.map(i => schedaLavoro(i, i === evid ? etich : '')).join('')
        + (chiusi.length ? `<div class="sez tec-fatti">Fatti <span>${chiusi.length}</span></div>` + chiusi.map(i => schedaLavoro(i)).join('') : '')
        : `<div class="tec-vuoto">${A.vuoto(g < oggi ? 'Nessun lavoro in questo giorno' : 'Nessun lavoro in programma', g < oggi ? 'Qui non hai lavori registrati.' : 'Quando l\'ufficio ti assegna un lavoro lo trovi qui, e ti arriva un avviso.', 'calendario')}</div>`}`;
    return {
      html: guscio({
        titolo: saluto() + ' ' + (u.nome || '').split(' ')[0], sotto: cap(A.dataLunga(oggi)), tab: 'oggi', contenuto,
        destra: `<a class="tec-avatar" href="#/t/profilo" aria-label="Il mio profilo">${h(A.iniziali(u.nome))}</a>`
      }),
      dopo: () => {
        // Il giorno scelto dentro la striscia, senza far saltare la pagina.
        const on = A.$('.giorni a.on'); if (on) on.parentNode.scrollLeft = Math.max(0, on.offsetLeft - on.parentNode.clientWidth / 2 + on.offsetWidth / 2);
      }
    };
  });

  // ===========================================================================
  // 2. SCHEDA DEL LAVORO
  // ===========================================================================
  function iconaMacchina(cat) {
    cat = norm(cat);
    if (/caldaia|bruciatore/.test(cat)) return 'fiamma';
    if (/scaldabagno|acqua|addolc/.test(cat)) return 'goccia';
    if (/pompa|clima/.test(cat)) return 'fulmine';
    if (/circolatore/.test(cat)) return 'ingranaggio';
    return 'impianto';
  }
  function esitoPastiglia(e) { if (!e) return ''; const t = ESITO_ICONA[e] || ['', 'grigio']; return A.pastiglia(A.ESITI[e] || e, t[1]); }
  function bloccoChiDove(i) {
    const c = A.cliente(i.clienteId) || {}, s = A.sede(i.sedeId) || {};
    const tel = s.telefono || c.telefono || '';
    const referente = s.referente || c.referente || '';
    const tipoCliente = { privato: 'Privato', condominio: 'Condominio', azienda: 'Azienda' }[c.tipo] || '';
    return `<section class="tessera tec-blocco"><div class="tt"><h3>${icona('mappa')} Chi e dove</h3></div><div class="cp">
      <div class="tec-cliente">${h(c.nome || 'Cliente')}<small>${h(tipoCliente)}</small></div>
      <div class="tec-ind">${s.nome && s.nome !== 'Sede principale' ? `<b>${h(s.nome)}</b><br>` : ''}${h(s.indirizzo || '')}<small>${h([s.cap, s.citta].filter(Boolean).join(' '))}</small></div>
      <div class="azioni-grandi">
        <a class="btn acc" href="${h(A.linkNaviga(s))}" target="_blank" rel="noopener">${icona('naviga', 'g')}<span>Portami</span><small>apre il navigatore</small></a>
        ${tel ? `<a class="btn pri" href="${h(telLink(tel))}">${icona('telefono', 'g')}<span>Chiama</span><small>${h(tel)}</small></a>` : `<span class="btn" aria-disabled="true">${icona('telefono', 'g')}<span>Chiama</span><small>nessun numero</small></span>`}
      </div>
      ${s.noteAccesso ? `<div class="avviso warn tec-accesso">${icona('chiave')}<div><b>Come entrare</b><br>${h(s.noteAccesso)}</div></div>` : ''}
      ${referente ? `<div class="tec-riga-ic">${icona('utente')}<div>${h(referente)}<small>${tel ? h(tel) : 'Nessun numero in anagrafica'}</small></div></div>` : ''}
      ${c.note ? `<div class="tec-riga-ic">${icona('info')}<div><small>Da sapere</small>${h(c.note)}</div></div>` : ''}
    </div></section>`;
  }
  function vociPreventivo(i) {
    if (!i.preventivoId) return '';
    const p = A.preventivo(i.preventivoId); if (!p) return '';
    // Solo le VOCI: niente prezzi, sconti, totali, IVA, condizioni (§6.7).
    const righe = (p.righe || []).filter(r => r.descrizione);
    if (!righe.length) return '';
    return `<div class="tec-sott">Concordato con il cliente</div><ul class="tec-voci">${righe.map(r => {
      if (r.tipo === 'nota') return `<li class="nota">${icona('info', 'p')}<span>${h(r.descrizione)}</span></li>`;
      const escl = r.opzionale && !r.scelta;
      return `<li class="${escl ? 'escl' : ''}"><span class="q">${r.qta ? A.num(r.qta) + ' ' + h(r.unita || '') : ''}</span><span>${h(r.descrizione)}${escl ? ' <em>— il cliente non l\'ha scelto: non va fatto</em>' : ''}</span></li>`;
    }).join('')}</ul>`;
  }
  function bloccoCosaFare(i) {
    const mod = { garanzia: ['In garanzia', 'ok'], contratto: ['A contratto', 'blu'] }[i.modalita];
    return `<section class="tessera tec-blocco"><div class="tt"><h3>${icona('verifica')} Cosa fare</h3>${mod ? A.pastiglia(mod[0], mod[1]) : ''}</div><div class="cp">
      <div class="tec-sott">Cosa chiede il cliente</div>
      <p class="tec-richiesta">${h(i.richiesta || 'Nessuna descrizione: chiedi al cliente o all\'ufficio.')}</p>
      ${i.noteInterne ? `<div class="avviso" style="margin-top:14px">${icona('messaggio')}<div><b>Nota dell'ufficio</b><br>${h(i.noteInterne)}</div></div>` : ''}
      ${vociPreventivo(i)}
    </div></section>`;
  }
  function bloccoMacchina(i) {
    const m = i.impiantoId ? A.impianto(i.impiantoId) : null;
    const altre = (A.DB.impianti || []).filter(x => x.sedeId === i.sedeId && (!m || x.id !== m.id));
    const listaAltre = altre.length ? `<div class="tec-sott">${m ? 'Altre macchine in questo posto' : 'Macchine in questo posto'}</div><ul class="tec-altre">${altre.map(x => `<li>${icona(iconaMacchina(x.categoria), 'p')}<span><b>${h(x.marca)} ${h(x.modello)}</b> <span class="muto">— ${h(x.categoria)}${x.matricola ? ' · <span class="mono">' + h(x.matricola) + '</span>' : ''}</span></span></li>`).join('')}</ul>` : '';
    let corpo;
    if (!m) corpo = (listaAltre || `<p class="muto">Nessuna macchina collegata a questo lavoro.</p>`);
    else {
      const oggi = A.oggi();
      const gar = m.garanziaFino ? (m.garanziaFino >= oggi ? A.pastiglia('Fino al ' + A.data(m.garanziaFino), 'ok') : A.pastiglia('Scaduta il ' + A.data(m.garanziaFino), 'grigio')) : '<span class="muto">Nessuna</span>';
      corpo = `<div class="tec-macchina"><div class="ic2">${icona(iconaMacchina(m.categoria), 'g')}</div><div><b>${h(m.marca)} ${h(m.modello)}</b><small>${h(cap(m.categoria))}${m.potenzaKw ? ' · ' + h(m.potenzaKw) + ' kW' : ''}${m.combustibile ? ' · ' + h(m.combustibile) : ''}</small></div></div>
        <dl class="dl tec-dl">
          <dt>Matricola</dt><dd class="mono">${h(m.matricola || '—')}</dd>
          <dt>Garanzia</dt><dd>${gar}</dd>
          <dt>Installata</dt><dd>${m.installato ? A.data(m.installato) + ' <span class="muto">(' + quantoFa(m.installato) + ')</span>' : '—'}</dd>
          <dt>Ultima manut.</dt><dd>${m.ultimaManutenzione ? A.data(m.ultimaManutenzione) + ' <span class="muto">(' + quantoFa(m.ultimaManutenzione) + ')</span>' : '—'}</dd>
          <dt>Libretto</dt><dd>${m.libretto ? 'Sì, sul posto' : 'No'}</dd>
        </dl>
        ${m.note ? `<div class="avviso warn" style="margin-top:12px">${icona('attenzione')}<div>${h(m.note)}</div></div>` : ''}
        ${listaAltre}`;
    }
    return `<section class="tessera tec-blocco"><div class="tt"><h3>${icona('impianto')} La macchina</h3></div><div class="cp">${corpo}</div></section>`;
  }
  function bloccoStoria(i) {
    const oggi = A.oggi();
    const prima = A.DB.interventi.filter(x => x.id !== i.id && x.sedeId === i.sedeId && x.rapporto && x.rapporto.stato && x.rapporto.stato !== 'bozza' && x.data && x.data <= oggi)
      .sort((a, b) => (b.data + (b.ora || '')).localeCompare(a.data + (a.ora || ''))).slice(0, 3);
    const corpo = prima.length ? `<ul class="tec-storia">${prima.map(x => `<li><div class="d"><b>${h(A.dataBreve(x.data))}</b><small>${x.data.slice(0, 4)}</small></div>
      <div class="cx1"><div class="t1">${h(A.TIPI_INTERVENTO[x.tipo] || x.tipo)}</div><div class="t2">${h(taglia(x.rapporto.lavoro || x.richiesta, 150))}</div></div>${esitoPastiglia(x.rapporto.esito)}</li>`).join('')}</ul>`
      : `<p class="muto">Nessun lavoro precedente qui: è la prima volta.</p>`;
    return `<section class="tessera tec-blocco"><div class="tt"><h3>${icona('storico')} Cosa è stato fatto qui prima</h3></div><div class="cp">${corpo}</div></section>`;
  }
  function fasiLavoro(f) {
    const nomi = ['Viaggio', 'Lavoro', 'Rapportino', 'Inviato'];
    const pos = { da_fare: -1, viaggio: 0, lavoro: 1, pausa: 1, rapportino: 2, rimandato: 2, in_coda: 3, chiuso: 4, annullato: -1 }[f];
    return `<div class="tec-fasi-lav" aria-hidden="true">${nomi.map((n, k) => `<div class="${k < pos ? 'ok' : k === pos ? 'on' : ''}"><i></i>${n}</div>`).join('')}</div>`;
  }
  function barraStato(i) {
    const f = fase(i); const r = i.rapporto || {}; const c = r.cronometro || {}; const id = h(i.id);
    let corpo = '';
    if (f === 'da_fare') corpo = `<button type="button" class="btn acc xl" data-az="tec-viaggio" data-id="${id}">${icona('furgone', 'g')} Sono in viaggio</button>
      <button type="button" class="tec-link" data-az="tec-inizia" data-id="${id}">Sono già sul posto: inizio il lavoro</button>`;
    else if (f === 'viaggio') corpo = (c.viaggioDa ? cronoHtml('In viaggio', c.viaggioDa, 0, null, 'dalle ' + A.ora(c.viaggioDa)) : '')
      + `<button type="button" class="btn acc xl" data-az="tec-inizia" data-id="${id}">${icona('play', 'g')} Ho iniziato</button>`;
    else if (f === 'lavoro') corpo = (c.avviato ? cronoHtml('Lavoro in corso', c.avviato, c.pausaMin, null, 'dalle ' + A.ora(c.avviato)) : '')
      + `<div class="tec-2"><button type="button" class="btn g" data-az="tec-sospendi" data-id="${id}">${icona('pausa')} Sospendi</button><button type="button" class="btn ok g" data-az="tec-finito" data-id="${id}">${icona('stop')} Ho finito</button></div>
      <a class="tec-link" href="#/t/rapportino/${id}">${icona('penna', 'p')} Apri il rapportino: materiale e foto</a>`;
    else if (f === 'pausa') corpo = (c.avviato ? cronoHtml('In pausa', c.avviato, c.pausaMin, c.pausaDa || A.adesso(), 'il tempo è fermo') : '')
      + `<div class="tec-2"><button type="button" class="btn acc g" data-az="tec-riprendi" data-id="${id}">${icona('play')} Riprendi</button><button type="button" class="btn ok g" data-az="tec-finito" data-id="${id}">${icona('stop')} Ho finito</button></div>`;
    else if (f === 'rapportino') corpo = `<div class="tec-barra-info">${icona('orologio')} Lavoro finito alle <b>${h(A.ora(c.finito))}</b> · ${oreBrevi(A.minutiIntervento(i).totale)} segnate</div>
      <a class="btn acc xl" href="#/t/rapportino/${id}">${icona('penna', 'g')} Continua il rapportino</a>`;
    else if (f === 'rimandato') corpo = `<div class="avviso dang">${icona('attenzione')}<div><b>L'ufficio ti ha rimandato il rapportino</b><br>${h(r.motivoRimando || 'Controlla i dati e rimandalo.')}</div></div>
      <a class="btn acc xl" href="#/t/rapportino/${id}">${icona('penna', 'g')} Correggi il rapportino</a>`;
    else if (f === 'in_coda') corpo = `<div class="avviso warn">${icona('senzarete')}<div><b>Chiuso sul telefono</b><br>Il rapportino parte da solo appena torna la rete.</div></div>
      <a class="btn g largo" href="#/t/rapportino/${id}">${icona('documento')} Vedi il rapportino</a>`;
    else if (f === 'chiuso') corpo = `<div class="avviso ok">${icona('spunta')}<div><b>${r.stato === 'approvato' ? 'Rapportino approvato' : 'Rapportino inviato'}</b><br>${r.stato === 'approvato' && r.approvatoIl ? 'Approvato ' + h(A.quando(r.approvatoIl)) : r.inviatoIl ? 'Arrivato all\'ufficio ' + h(A.quando(r.inviatoIl)) : ''}</div></div>
      <a class="btn g largo" href="#/t/rapportino/${id}">${icona('documento')} Vedi il rapportino</a>`;
    else corpo = `<div class="avviso">${icona('info')}<div><b>Lavoro annullato</b><br>L'ufficio l'ha tolto dalla tua agenda.</div></div>`;
    return `<div class="tec-barra" aria-label="Stato del lavoro">${f === 'annullato' ? '' : fasiLavoro(f)}${corpo}</div>`;
  }
  A.rotta('#/t/lavoro/:id', 'tecnico', par => {
    preparaPagina();
    const i = mio(par.id); if (!i) return nonTrovato();
    const f = fase(i);
    const contenuto = `
      <div class="tec-testata">${pastigliaTec(i)}${i.priorita === 'urgente' ? A.pastiglia('Urgente', 'dang') : i.priorita === 'alta' ? A.pastiglia('Priorità alta', 'acc') : ''}
        <span class="quando">${i.data ? h(cap(A.dataBreve(i.data))) : ''}${i.ora ? ' · ' + h(i.ora) : ''}${i.durataMin ? ' · ' + oreBrevi(i.durataMin) : ''}</span></div>
      ${bloccoChiDove(i)}
      ${bloccoCosaFare(i)}
      ${bloccoMacchina(i)}
      ${bloccoStoria(i)}
      ${barraStato(i)}`;
    return {
      html: guscio({ titolo: nomeCliente(i), sotto: (A.TIPI_INTERVENTO[i.tipo] || i.tipo) + ' · N. ' + i.numero, indietro: '#/t/oggi' + (i.data && i.data !== A.oggi() ? '?g=' + i.data : ''), tab: 'oggi', contenuto }),
      dopo: () => { if (['viaggio', 'lavoro', 'pausa'].includes(f)) avviaTimerCrono(); }
    };
  });

  // ---- i bottoni di stato. Ogni cambio va all'ufficio passando dalla coda.
  function cambiaStato(id, nuovo, prepara) {
    flush();
    const i = mio(id); if (!i || !modificabile(i)) return false;
    A.modifica(db => { const r = bozza(db, id); if (prepara) prepara(r); });
    A.accoda('stato', { interventoId: id, stato: nuovo }, (ETICHETTE[nuovo] || [nuovo])[0] + ' — ' + nomeCliente(i));
    return true;
  }
  A.azione('tec-viaggio', el => {
    if (cambiaStato(el.dataset.id, 'in_viaggio', r => { r.cronometro.viaggioDa = A.adesso(); })) A.toast('Buon viaggio: il tempo parte da adesso', 'ok');
    A.render();
  });
  A.azione('tec-inizia', el => {
    let viaggio = 0;
    const ok = cambiaStato(el.dataset.id, 'in_corso', r => {
      const c = r.cronometro, ora = A.adesso();
      // Il tempo di viaggio diventa da solo una riga ore: nessuno se lo ricorda la sera.
      if (c.viaggioDa && !c.avviato) {
        viaggio = arrot5((Date.parse(ora) - Date.parse(c.viaggioDa)) / 60000);
        r.ore.push({ id: A.uid('ore'), tipo: 'viaggio', minuti: viaggio, auto: true });
      }
      if (!c.avviato) { c.avviato = ora; c.pausaMin = 0; }
      r.inizio = r.inizio || ora;
    });
    if (ok) A.toast(viaggio ? 'Viaggio: ' + oreBrevi(viaggio) + ' segnati. Cronometro partito.' : 'Cronometro partito', 'ok');
    A.render();
  });
  A.azione('tec-sospendi', el => {
    if (cambiaStato(el.dataset.id, 'sospeso', r => { if (!r.cronometro.pausaDa) r.cronometro.pausaDa = A.adesso(); })) A.toast('In pausa: il tempo è fermo');
    A.render();
  });
  A.azione('tec-riprendi', el => {
    if (cambiaStato(el.dataset.id, 'in_corso', r => chiudiPausa(r.cronometro))) A.toast('Si riparte', 'ok');
    A.render();
  });
  A.azione('tec-finito', el => {
    const id = el.dataset.id; let min = 0;
    flush();
    const i = mio(id); if (!i || !modificabile(i)) return;
    const prepara = r => { min = fermaCronometro(r); };
    if (statoTec(i) === 'sospeso') cambiaStato(id, 'in_corso', prepara);
    else A.modifica(db => prepara(bozza(db, id)));
    A.toast(min ? 'Lavoro: ' + oreBrevi(min) + ' segnati nel rapportino' : 'Cronometro fermato', 'ok');
    if (el.dataset.resta) A.render(); else A.vai('#/t/rapportino/' + id);
  });

  // ===========================================================================
  // 3. RAPPORTINO
  // ===========================================================================
  function campoTesto(i, campo, etichetta, obbl, rapidi, esempio, scorre) {
    const v = i.rapporto[campo] || '';
    const idc = 'tec-c-' + campo;
    return `<div class="campo tec-testo" id="tec-w-${campo}">
      <label for="${idc}">${h(etichetta)}${obbl ? '<span class="tec-obb">obbligatorio</span>' : ''}</label>
      <div class="tec-area${SR ? ' con-mic' : ''}">
        <textarea id="${idc}" rows="3" data-digita="tec-scrivi" data-cambia="tec-scrivi-fine" data-id="${h(i.id)}" data-campo="${campo}" placeholder="${h(esempio)}">${h(v)}</textarea>
        ${SR ? `<button type="button" class="tec-mic" data-az="tec-detta" data-campo="${campo}" aria-pressed="false" aria-label="Detta: ${h(etichetta.toLowerCase())}">${icona('microfono')}</button>` : ''}
      </div>
      <div class="tec-rapidi${scorre ? ' scorre' : ''}" role="group" aria-label="Frasi pronte">${rapidi.map(t => `<button type="button" class="${norm(v).includes(norm(t)) ? 'usato' : ''}" data-az="tec-rapido" data-campo="${campo}" data-t="${h(t)}">${h(t)}</button>`).join('')}</div>
    </div>`;
  }
  function cronoMini(i) {
    const c = i.rapporto.cronometro || {};
    if (!c.avviato || c.finito) return '';
    const pausa = !!c.pausaDa;
    return `<div class="crono tec-crono-mini${pausa ? ' tec-fermo' : ''}">${icona(pausa ? 'pausa' : 'orologio', 'g')}<div class="tec-cr"><small>${pausa ? 'In pausa' : 'Lavoro in corso'}</small><span class="t" role="timer" data-crono data-da="${h(c.avviato)}" data-pausa="${Number(c.pausaMin) || 0}" data-fermo="${h(c.pausaDa || '')}">${hms(minutiLavoro(c) * 60000)}</span></div>
      <button type="button" class="btn" data-az="tec-finito" data-id="${h(i.id)}" data-resta="1">${icona('stop')} Ho finito</button></div>`;
  }
  function bloccoOre(i) {
    const r = i.rapporto; const c = r.cronometro || {};
    const inCorso = c.avviato && !c.finito;
    const tot = r.ore.reduce((s, o) => s + (Number(o.minuti) || 0), 0);
    const id = h(i.id);
    return `${cronoMini(i)}
      ${r.ore.length ? `<ul class="tec-ore">${r.ore.map(o => `<li>
        <select aria-label="Tipo di ore" data-cambia="tec-ore-tipo" data-id="${id}" data-riga="${h(o.id)}">${Object.keys(A.TIPI_ORE).map(k => `<option value="${k}" ${o.tipo === k ? 'selected' : ''}>${A.TIPI_ORE[k]}</option>`).join('')}</select>
        <div class="stepper"><button type="button" data-az="tec-ore-passo" data-d="-15" data-id="${id}" data-riga="${h(o.id)}" aria-label="Togli 15 minuti">−</button><output aria-live="polite">${oreBrevi(o.minuti)}</output><button type="button" data-az="tec-ore-passo" data-d="15" data-id="${id}" data-riga="${h(o.id)}" aria-label="Aggiungi 15 minuti">+</button></div>
        <button type="button" class="btn vuoto icona" data-az="tec-ore-togli" data-id="${id}" data-riga="${h(o.id)}" aria-label="Togli questa riga">${icona('cestino')}</button>
      </li>`).join('')}</ul>`
        : `<p class="muto">${inCorso ? 'Le ore di lavoro si segnano da sole quando premi «Ho finito».' : 'Nessuna ora segnata: aggiungile qui sotto.'}</p>`}
      <div class="tec-agg">${Object.keys(A.TIPI_ORE).map(k => `<button type="button" class="btn" data-az="tec-ore-agg" data-id="${id}" data-tipo="${k}">${icona('piu', 'p')} ${A.TIPI_ORE[k]}</button>`).join('')}</div>
      ${r.ore.length ? `<div class="tec-tot"><span>Totale</span><b>${oreBrevi(tot)}</b></div>` : ''}`;
  }
  function solitiDi(i) {
    const u = io();
    // Prima gli ultimi usati da LUI (ognuno ha il suo modo di lavorare), poi i «soliti» del catalogo.
    const recenti = [];
    A.DB.interventi.filter(x => x.id !== i.id && (x.tecnici || []).includes(u.id) && x.rapporto && x.rapporto.stato && x.rapporto.stato !== 'bozza')
      .sort((a, b) => String(b.rapporto.fine || b.data || '').localeCompare(String(a.rapporto.fine || a.data || '')))
      .forEach(x => (x.rapporto.materiali || []).forEach(m => { if (m.articoloId && !recenti.includes(m.articoloId)) recenti.push(m.articoloId); }));
    const ids = recenti.slice(0, 6).concat(A.DB.articoli.filter(a => a.solito).map(a => a.id));
    return Array.from(new Set(ids)).map(A.articolo).filter(a => a && a.attivo !== false).slice(0, 12);
  }
  function bloccoMateriale(i) {
    const r = i.rapporto; const id = h(i.id);
    const qIn = artId => r.materiali.filter(m => m.articoloId === artId).reduce((s, m) => s + (Number(m.qta) || 0), 0);
    const righe = r.materiali.map(m => {
      const a = m.articoloId ? A.articolo(m.articoloId) : null;
      const disp = a ? sulFurgone(a.id, i) : 0;
      const totArt = a ? qIn(a.id) : 0;
      return `<li class="${m.id === ultimaRiga ? 'nuovo' : ''}">
        <div class="nm">${h(m.nome)}</div>
        <div class="sub">${a ? h(a.codice) + ' · ' + h(a.marca) + ' · sul furgone: ' + A.num(disp) + ' ' + h(a.unita) : 'Fuori catalogo'}</div>
        <div class="ctr">
          <div class="stepper"><button type="button" data-az="tec-mat-passo" data-d="-1" data-id="${id}" data-riga="${h(m.id)}" aria-label="Uno in meno">−</button><input type="text" inputmode="decimal" value="${A.num(m.qta)}" data-cambia="tec-mat-qta" data-id="${id}" data-riga="${h(m.id)}" aria-label="Quantità di ${h(m.nome)}"><button type="button" data-az="tec-mat-passo" data-d="1" data-id="${id}" data-riga="${h(m.id)}" aria-label="Uno in più">+</button></div>
          <span class="un">${h(m.unita || '')}</span><span class="sp"></span>
          <button type="button" class="btn vuoto icona per" data-az="tec-mat-togli" data-id="${id}" data-riga="${h(m.id)}" aria-label="Togli ${h(m.nome)}">${icona('cestino')}</button>
        </div>
        ${a && m.da !== 'deposito' && totArt > disp ? `<div class="avv">${icona('attenzione', 'p')}<span>Sul furgone ne risultano ${A.num(disp)}: lo segno lo stesso, l'ufficio controlla.</span></div>` : ''}
      </li>`;
    }).join('');
    const soliti = solitiDi(i);
    return `<div class="cerca">${icona('cerca')}<input type="search" id="tec-cerca" data-digita="tec-cerca" data-id="${id}" placeholder="Cerca: nome, codice, marca, codice a barre" autocomplete="off" enterkeyhint="search" aria-label="Cerca nel catalogo"></div>
      <div id="tec-ris" class="tec-ris" aria-live="polite"></div>
      <div class="tec-sott" style="margin-top:14px">I miei soliti</div>
      <div class="tec-soliti">${soliti.map(a => { const q = qIn(a.id); return `<button type="button" class="${q ? 'dentro' : ''}" data-az="tec-mat-agg" data-id="${id}" data-art="${h(a.id)}" aria-label="Aggiungi ${h(a.nome)}"><b>${h(a.nome)}</b><small>furgone: ${A.num(sulFurgone(a.id, i))} ${h(a.unita)}</small>${q ? `<span class="contatore">${A.num(q)}</span>` : ''}</button>`; }).join('')}</div>
      ${r.materiali.length ? `<div class="tec-sott" style="margin-top:16px">Usato in questo lavoro</div><ul class="tec-mat">${righe}</ul>` : ''}
      <button type="button" class="btn largo tec-fuori" data-az="tec-fuori" data-id="${id}">${icona('piu')} Voce fuori catalogo</button>`;
  }
  const fasiScelte = {};
  function faseAttiva(i) {
    if (fasiScelte[i.id]) return fasiScelte[i.id];
    const c = (i.rapporto && i.rapporto.cronometro) || {};
    return c.finito ? 'dopo' : c.avviato ? 'durante' : 'prima';
  }
  function bloccoFoto(i) {
    const r = i.rapporto; const id = h(i.id); const f = faseAttiva(i);
    const piene = r.foto.length >= MAX_FOTO;
    return `<div class="tec-sott">Che foto stai facendo?</div>
      <div class="tec-fasi scelte" role="radiogroup" aria-label="Tipo di foto">${Object.keys(A.FASI_FOTO).map(k => `<label class="scelta"><input type="radio" name="tec-fase" value="${k}" data-cambia="tec-fase" data-id="${id}" ${k === f ? 'checked' : ''}><span>${A.FASI_FOTO[k]}</span></label>`).join('')}</div>
      <div class="tec-scatta">
        <label class="btn acc g" ${piene ? 'aria-disabled="true"' : ''}>${icona('fotocamera', 'g')} Scatta<input class="sr" type="file" accept="image/*" capture="environment" data-cambia="tec-foto" data-id="${id}" ${piene ? 'disabled' : ''}></label>
        <label class="btn g" ${piene ? 'aria-disabled="true"' : ''}>${icona('carica')} Galleria<input class="sr" type="file" accept="image/*" multiple data-cambia="tec-foto" data-id="${id}" ${piene ? 'disabled' : ''}></label>
      </div>
      ${r.foto.length ? `<div class="tec-foto">${r.foto.map(ft => `<div class="foto">
        <img src="${h(ft.src)}" alt="Foto: ${h(A.FASI_FOTO[ft.fase] || ft.fase)}" loading="lazy">
        <button type="button" class="apri" data-az="tec-foto-apri" data-id="${id}" data-foto="${h(ft.id)}" aria-label="Apri la foto"></button>
        <button type="button" class="togli" data-az="tec-foto-togli" data-id="${id}" data-foto="${h(ft.id)}" aria-label="Elimina la foto">${icona('x')}</button>
        <button type="button" class="fase" data-az="tec-foto-fase" data-id="${id}" data-foto="${h(ft.id)}" aria-label="Tipo di foto: ${h(A.FASI_FOTO[ft.fase] || ft.fase)}. Tocca per cambiare">${h(A.FASI_FOTO[ft.fase] || ft.fase)} ${icona('ricarica', 'p')}</button>
      </div>`).join('')}</div>` : `<p class="muto">Nessuna foto. Di solito: una prima, una dopo e la targhetta con la matricola.</p>`}
      <p class="tec-privacy">${icona('occhiochiuso', 'p')}<span>${r.foto.length} di ${MAX_FOTO}. Le foto le vede solo l'ufficio: è lui a decidere cosa mostrare al cliente (nell'inquadratura spesso c'è casa sua).</span></p>`;
  }
  function bloccoNote(i) {
    const r = i.rapporto; const u = io(); const id = h(i.id);
    const note = (A.DB.note || []).filter(n => n.interventoId === i.id && n.autoreId === u.id);
    const mat = (A.DB.richiesteMateriale || []).filter(x => x.interventoId === i.id && x.tecnicoId === u.id);
    const ops = coda(i);
    const testoRisposta = x => typeof x === 'string' ? x : (x && x.testo) || '';
    const elenco = []
      .concat(ops.filter(o => o.tipo === 'nota').map(o => ({ d: o.creata, html: `<li>${icona('messaggio', 'p')}<div class="cx1">${h(o.payload.testo)}<small>${o.payload.urgente ? 'Urgente · ' : ''}scritta ${h(A.quando(o.creata))}</small></div>${A.pastiglia('Da inviare', 'warn')}</li>` })))
      .concat(note.map(n => ({ d: n.data, html: `<li>${icona('messaggio', 'p')}<div class="cx1">${h(n.testo)}<small>${n.urgente ? 'Urgente · ' : ''}${h(A.quando(n.data))}</small>${n.risposta ? `<div class="tec-risp"><b>Ufficio:</b> ${h(testoRisposta(n.risposta))}</div>` : ''}</div>${A.pastiglia(n.letta ? 'Letta' : 'Inviata', n.letta ? 'ok' : 'blu')}</li>` })))
      .concat(ops.filter(o => o.tipo === 'richiesta_materiale').map(o => ({ d: o.creata, html: `<li>${icona('carrello', 'p')}<div class="cx1"><b>${h(o.payload.descrizione)}</b> ×${A.num(o.payload.qta)} ${h(o.payload.unita || '')}<small>${h((URGENZE[o.payload.urgenza] || ['Normale'])[0])} · ${h(A.quando(o.creata))}</small></div>${A.pastiglia('Da inviare', 'warn')}</li>` })))
      .concat(mat.map(x => { const s = STATI_RICHIESTA[x.stato] || [x.stato, 'grigio']; return { d: x.data, html: `<li>${icona('carrello', 'p')}<div class="cx1"><b>${h(x.descrizione)}</b> ×${A.num(x.qta)} ${h(x.unita || '')}<small>${h((URGENZE[x.urgenza] || ['Normale'])[0])} · ${h(A.quando(x.data))}</small></div>${A.pastiglia(s[0], s[1])}</li>` }; }))
      .sort((a, b) => String(b.d).localeCompare(String(a.d)));
    return `<div class="campo"><label for="tec-c-note">Note per l'ufficio <span class="pic">— il cliente non le vede</span></label>
        <textarea id="tec-c-note" rows="2" data-digita="tec-scrivi" data-cambia="tec-scrivi-fine" data-id="${id}" data-campo="note" placeholder="Es. Il cliente chiede un preventivo per il bagno">${h(r.note || '')}</textarea></div>
      <div class="tec-due">
        <button type="button" class="btn g" data-az="tec-nota" data-id="${id}">${icona('messaggio')} Scrivi all'ufficio adesso</button>
        <button type="button" class="btn g" data-az="tec-matord" data-id="${id}">${icona('carrello')} Segnala materiale da ordinare</button>
      </div>
      ${elenco.length ? `<ul class="tec-inviati">${elenco.map(x => x.html).join('')}</ul>` : ''}`;
  }
  function avvisoRimando(r) {
    return `<div class="avviso dang" style="margin-bottom:12px">${icona('attenzione')}<div><b>L'ufficio ti ha rimandato il rapportino</b><br>«${h(r.motivoRimando || 'Controlla i dati e rimandalo.')}»<br><span style="font-size:13px">Correggi quello che serve e rimandalo dall'ultimo passo.</span></div></div>`;
  }
  let ultimaRiga = null;
  function rapportinoModifica(i, q) {
    const r = i.rapporto; const id = h(i.id);
    const tot = r.ore.reduce((s, o) => s + (Number(o.minuti) || 0), 0);
    const contenuto = `
      ${passi(1)}
      ${r.stato === 'rimandato' ? avvisoRimando(r) : ''}
      <div class="tec-salta" role="navigation" aria-label="Vai alla sezione">
        <button type="button" data-az="tec-salta" data-a="tec-s-lavoro">${icona('penna', 'p')} Lavoro ${String(r.lavoro || '').trim() ? `<span class="fatto">${icona('spunta', 'p')}</span>` : ''}</button>
        <button type="button" data-az="tec-salta" data-a="tec-s-ore">${icona('orologio', 'p')} Ore <b>${oreBrevi(tot)}</b></button>
        <button type="button" data-az="tec-salta" data-a="tec-s-mat">${icona('pacco', 'p')} Materiale <b>${r.materiali.length}</b></button>
        <button type="button" data-az="tec-salta" data-a="tec-s-foto">${icona('fotocamera', 'p')} Foto <b>${r.foto.length}</b></button>
        <button type="button" data-az="tec-salta" data-a="tec-s-note">${icona('messaggio', 'p')} Ufficio</button>
      </div>
      <div class="sez tec-blocco" id="tec-s-lavoro">Il lavoro</div>
      <section class="tessera"><div class="cp">
        ${campoTesto(i, 'lavoro', 'Cosa ho fatto', true, TESTI_RAPIDI[i.tipo] || TESTI_RAPIDI.riparazione, 'Tocca le frasi pronte qui sotto, o scrivi')}
        ${campoTesto(i, 'trovato', 'Cosa ho trovato', false, TROVATO_RAPIDI, 'Es. Scambiatore pieno di calcare', true)}
        ${campoTesto(i, 'consiglio', 'Cosa consiglio al cliente', false, CONSIGLIO_RAPIDI, 'Es. Installare un defangatore', true)}
      </div></section>
      <div class="sez tec-blocco" id="tec-s-ore">Ore <span>${oreBrevi(tot)}</span></div>
      <section class="tessera"><div class="cp">${bloccoOre(i)}</div></section>
      <div class="sez tec-blocco" id="tec-s-mat">Materiale usato <span>${r.materiali.length ? r.materiali.length + (r.materiali.length === 1 ? ' voce' : ' voci') : ''}</span></div>
      <section class="tessera"><div class="cp">${bloccoMateriale(i)}</div></section>
      <div class="sez tec-blocco" id="tec-s-foto">Foto <span>${r.foto.length} di ${MAX_FOTO}</span></div>
      <section class="tessera"><div class="cp">${bloccoFoto(i)}</div></section>
      <div class="sez tec-blocco" id="tec-s-note">Per l'ufficio</div>
      <section class="tessera"><div class="cp">${bloccoNote(i)}</div></section>
      <a class="btn acc xl tec-avanti" href="#/t/firma/${id}">Avanti: firma del cliente ${icona('avanti')}</a>`;
    const nuova = ultimaRiga; ultimaRiga = null;
    return {
      html: guscio({ titolo: 'Rapportino', sotto: nomeCliente(i) + ' · N. ' + i.numero, indietro: '#/t/lavoro/' + id, tab: 'oggi', contenuto, destra: `<span class="tec-salvato" id="tec-salvato" role="status">Salvato sul telefono ${icona('spunta', 'p')}</span>` }),
      dopo: () => {
        A.$$('.tec-testo textarea, #tec-c-note').forEach(autoAltezza);
        if (A.$('[data-crono]')) avviaTimerCrono();
        // Dopo il ridisegno il router riporta la pagina in cima: si scende dopo.
        if (q.campo) setTimeout(() => evidenziaCampo(q.campo), 30);
        if (nuova) setTimeout(() => { const li = A.$('.tec-mat li.nuovo'); if (li && li.scrollIntoView) li.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 30);
      }
    };
  }
  function evidenziaCampo(campo) {
    const ta = document.getElementById('tec-c-' + campo); if (!ta) return;
    const w = ta.closest('.campo');
    if (w && campo === 'lavoro' && !String(ta.value).trim()) {
      w.classList.add('tec-manca');
      if (!w.querySelector('.tec-manca-msg')) w.insertAdjacentHTML('beforeend', '<div class="tec-manca-msg" style="margin-top:8px">Bastano due righe (o due frasi pronte): è l\'unica cosa che serve davvero, insieme all\'esito.</div>');
    }
    ta.scrollIntoView({ block: 'center' });
    try { ta.focus({ preventScroll: true }); } catch (_) { ta.focus(); }
  }
  function autoAltezza(ta) { if (!ta) return; ta.style.height = 'auto'; ta.style.height = Math.max(ta.scrollHeight + 3, 92) + 'px'; }

  // ---- rapportino in sola lettura (inviato, approvato, o chiuso in attesa di rete)
  function rapportinoLettura(i) {
    const r = i.rapporto; const pend = coda(i, 'invia_rapporto').length > 0;
    if (!r) return guscio({ titolo: 'Rapportino', sotto: nomeCliente(i), indietro: '#/t/lavoro/' + h(i.id), tab: 'oggi', contenuto: `<div class="tessera tec-vuoto">${A.vuoto('Nessun rapportino', 'Questo lavoro non ha un rapportino.', 'documento')}</div>` });
    const min = A.minutiIntervento(i);
    const stato = pend ? `<div class="avviso warn">${icona('senzarete')}<div><b>Chiuso sul telefono, in attesa di rete</b><br>Parte da solo appena c'è campo. Per aggiungere qualcosa scrivi all'ufficio.</div></div>`
      : r.stato === 'approvato' ? `<div class="avviso ok">${icona('spunta')}<div><b>Approvato dall'ufficio</b>${r.approvatoIl ? '<br>' + h(A.quando(r.approvatoIl)) : ''}</div></div>`
        : `<div class="avviso ok">${icona('spunta')}<div><b>Inviato all'ufficio</b>${r.inviatoIl ? '<br>Arrivato ' + h(A.quando(r.inviatoIl)) + '. Adesso lo controllano.' : ''}</div></div>`;
    const f = r.firma;
    const contenuto = `${stato}
      <div class="sez">Il lavoro</div>
      <section class="tessera"><div class="cp">
        <div class="tec-sott">Cosa ho fatto</div><p>${h(r.lavoro || '—')}</p>
        ${r.trovato ? `<div class="tec-sott">Cosa ho trovato</div><p>${h(r.trovato)}</p>` : ''}
        ${r.consiglio ? `<div class="tec-sott">Cosa consiglio</div><p>${h(r.consiglio)}</p>` : ''}
        <div class="tec-sott">Esito</div><p>${esitoPastiglia(r.esito) || '—'}${r.secondoIntervento ? ' ' + A.pastiglia('Serve un secondo intervento', 'warn') : ''}</p>
      </div></section>
      <div class="sez">Ore <span>${oreBrevi(min.totale)}</span></div>
      <section class="tessera"><div class="cp"><ul class="tec-riep-lista">${Object.keys(A.TIPI_ORE).filter(k => min[k]).map(k => `<li><span>${A.TIPI_ORE[k]}</span><span>${oreBrevi(min[k])}</span></li>`).join('') || '<li><span class="muto">Nessuna ora segnata</span></li>'}</ul></div></section>
      <div class="sez">Materiale</div>
      <section class="tessera"><div class="cp"><ul class="tec-riep-lista">${(r.materiali || []).map(m => `<li><span>${h(m.nome)}</span><span>${A.num(m.qta)} ${h(m.unita || '')}</span></li>`).join('') || '<li><span class="muto">Nessun materiale</span></li>'}</ul></div></section>
      ${(r.foto || []).length ? `<div class="sez">Foto <span>${r.foto.length}</span></div><div class="foto-griglia">${r.foto.map(ft => `<div class="foto"><img src="${h(ft.src)}" alt="" loading="lazy"><span class="tag">${h(A.FASI_FOTO[ft.fase] || ft.fase)}</span></div>`).join('')}</div>` : ''}
      ${r.note ? `<div class="sez">Note per l'ufficio</div><section class="tessera"><div class="cp"><p>${h(r.note)}</p></div></section>` : ''}
      <div class="sez">Firma del cliente</div>
      <section class="tessera"><div class="cp">${f && f.png && !f.assente ? `<img class="tec-firma-img" src="${h(f.png)}" alt="Firma del cliente"><p class="pic" style="margin-top:6px">${h(f.nome || '')}${f.qualifica ? ' (' + h(f.qualifica) + ')' : ''}${f.data ? ' · ' + h(A.dataOra(f.data)) : ''}</p>`
        : f && f.assente ? `<p><b>Cliente non presente.</b> ${h(f.motivo || '')}</p>` : '<p class="muto">Senza firma</p>'}</div></section>
      <div class="spazio"></div>
      <a class="btn g largo" href="#/t/oggi">${icona('indietro')} Torna a oggi</a>`;
    return guscio({ titolo: 'Rapportino', sotto: nomeCliente(i) + ' · N. ' + i.numero, indietro: '#/t/lavoro/' + h(i.id), tab: 'oggi', contenuto });
  }
  A.rotta('#/t/rapportino/:id', 'tecnico', par => {
    preparaPagina();
    const i = mio(par.id); if (!i) return nonTrovato();
    if (!modificabile(i)) return rapportinoLettura(i);
    assicuraBozza(i.id);
    return rapportinoModifica(i, par.q);
  });

  // ---- testo: si salva a ogni lettera
  A.azione('tec-scrivi', el => {
    salvaDopo(el.dataset.id, el.dataset.campo, el.value);
    if (el.tagName === 'TEXTAREA') autoAltezza(el);
    const w = el.closest('.campo');
    if (w && w.classList.contains('tec-manca') && el.value.trim()) { w.classList.remove('tec-manca'); const m = w.querySelector('.tec-manca-msg'); if (m) m.remove(); }
    const rap = w && w.querySelector('.tec-rapidi');
    if (rap) A.$$('button', rap).forEach(b => b.classList.toggle('usato', norm(el.value).includes(norm(b.dataset.t))));
  });
  A.azione('tec-scrivi-fine', () => flush());
  /** Aggiunge una frase in coda al testo, con la punteggiatura giusta. */
  function aggiungiFrase(ta, frase) {
    frase = String(frase || '').trim(); if (!frase) return;
    frase = cap(frase) + (/[.!?]$/.test(frase) ? '' : '.');
    let v = ta.value.replace(/\s+$/, '');
    if (v && !/[.!?:;]$/.test(v)) v += '.';
    ta.value = (v ? v + ' ' : '') + frase;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    flush();
  }
  A.azione('tec-rapido', el => {
    const ta = document.getElementById('tec-c-' + el.dataset.campo); if (!ta) return;
    if (norm(ta.value).includes(norm(el.dataset.t))) { A.toast('Già scritto'); return; }
    aggiungiFrase(ta, el.dataset.t);
  });
  // Dettatura: in cantina con i guanti si parla meglio di quanto si scriva.
  A.azione('tec-detta', el => {
    if (!SR) return;
    const campo = el.dataset.campo;
    if (dettatura) { const stessa = dettatura.campo === campo; try { dettatura.rec.stop(); } catch (_) { } dettatura = null; A.$$('.tec-mic.on').forEach(b => { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); }); if (stessa) return; }
    let rec;
    try { rec = new SR(); } catch (e) { A.toast('Dettatura non disponibile su questo telefono', 'warn'); return; }
    rec.lang = 'it-IT'; rec.continuous = true; rec.interimResults = false;
    rec.onresult = ev => {
      let testo = '';
      for (let k = ev.resultIndex; k < ev.results.length; k++) if (ev.results[k].isFinal) testo += ev.results[k][0].transcript;
      const ta = document.getElementById('tec-c-' + campo);
      if (ta && testo.trim()) aggiungiFrase(ta, testo);
    };
    rec.onerror = ev => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') A.toast('Il microfono non è autorizzato: scrivi pure a mano', 'warn');
      else if (ev.error === 'network') A.toast('La dettatura vuole la rete: scrivi a mano o riprova fuori', 'warn');
      else if (ev.error !== 'no-speech' && ev.error !== 'aborted') A.toast('La dettatura si è fermata: riprova', 'warn');
    };
    rec.onend = () => {
      A.$$('.tec-mic[data-campo="' + campo + '"]').forEach(b => { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); });
      if (dettatura && dettatura.rec === rec) dettatura = null;
    };
    try { rec.start(); } catch (e) { A.toast('Dettatura non disponibile adesso', 'warn'); return; }
    dettatura = { rec, campo };
    el.classList.add('on'); el.setAttribute('aria-pressed', 'true');
    A.toast('Parla pure, scrivo io. Tocca di nuovo il microfono per fermare.');
  });
  A.azione('tec-salta', el => {
    const t = document.getElementById(el.dataset.a); if (!t) return;
    t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ---- ore
  function suRiga(id, coll, rigaId, fn) {
    flush();
    A.modifica(db => { const r = bozza(db, id); if (!r) return; const x = r[coll].find(o => o.id === rigaId); if (x) fn(x, r); });
    A.render();
  }
  A.azione('tec-ore-passo', el => suRiga(el.dataset.id, 'ore', el.dataset.riga, o => { o.minuti = Math.max(0, (Number(o.minuti) || 0) + Number(el.dataset.d)); o.auto = false; }));
  A.azione('tec-ore-tipo', el => suRiga(el.dataset.id, 'ore', el.dataset.riga, o => { o.tipo = el.value; }));
  A.azione('tec-ore-togli', el => suRiga(el.dataset.id, 'ore', el.dataset.riga, (o, r) => { r.ore = r.ore.filter(x => x.id !== o.id); }));
  A.azione('tec-ore-agg', el => {
    flush();
    const tipo = el.dataset.tipo;
    A.modifica(db => { const r = bozza(db, el.dataset.id); if (r) r.ore.push({ id: A.uid('ore'), tipo, minuti: tipo === 'lavoro' ? 60 : 30 }); });
    A.toast(A.TIPI_ORE[tipo] + ': riga aggiunta, regola con + e −', 'ok');
    A.render();
  });

  // ---- materiale
  function aggiungiMateriale(id, artId, qta) {
    const a = A.articolo(artId); if (!a) return;
    flush();
    A.modifica(db => {
      const r = bozza(db, id); if (!r) return;
      const es = r.materiali.find(m => m.articoloId === artId && m.da !== 'deposito');
      if (es) { es.qta = tondo((Number(es.qta) || 0) + (qta || 1)); ultimaRiga = es.id; }
      else { ultimaRiga = A.uid('rm'); r.materiali.push({ id: ultimaRiga, articoloId: a.id, nome: a.nome, qta: qta || 1, unita: a.unita, da: 'furgone' }); }
    });
    A.toast('Aggiunto: ' + taglia(a.nome, 40), 'ok');
    A.render();
  }
  A.azione('tec-mat-agg', el => aggiungiMateriale(el.dataset.id, el.dataset.art, 1));
  A.azione('tec-cerca', el => {
    const box = A.$('#tec-ris'); if (!box) return;
    const grezzo = el.value.trim(); const q = norm(grezzo);
    if (q.length < 2) { box.innerHTML = ''; return; }
    const attivi = A.DB.articoli.filter(a => a.attivo !== false);
    // Lettore di codici a barre (quelli bluetooth «scrivono» il codice): se il
    // codice e' esatto, si aggiunge senza toccare niente.
    if (/^\d{8,14}$/.test(grezzo)) { const esatto = attivi.find(a => a.barcode === grezzo); if (esatto) { el.value = ''; aggiungiMateriale(el.dataset.id, esatto.id, 1); return; } }
    const parole = q.split(/\s+/);
    const i = mio(el.dataset.id);
    const trovati = attivi.filter(a => { const t = norm([a.codice, a.nome, a.marca, a.barcode, a.categoria].join(' ')); return parole.every(p => t.includes(p)); })
      .map(a => ({ a, q: sulFurgone(a.id, i) })).sort((x, y) => (y.q > 0) - (x.q > 0)).slice(0, 8);
    box.innerHTML = trovati.length ? trovati.map(({ a, q: disp }) => `<button type="button" data-az="tec-mat-agg" data-id="${h(el.dataset.id)}" data-art="${h(a.id)}"><span class="cx1"><b>${h(a.nome)}</b><small>${h(a.codice)} · ${h(a.marca)} · ${disp > 0 ? 'sul furgone: ' + A.num(disp) + ' ' + h(a.unita) : 'non sul furgone'}</small></span><span class="piu" aria-hidden="true">${icona('piu')}</span></button>`).join('')
      : `<p class="tec-nessuno muto">Nessun articolo con «${h(grezzo)}». <button type="button" class="btn pic" data-az="tec-fuori" data-id="${h(el.dataset.id)}" data-nome="${h(grezzo)}">${icona('piu', 'p')} Aggiungilo fuori catalogo</button></p>`;
  });
  A.azione('tec-mat-passo', el => suRiga(el.dataset.id, 'materiali', el.dataset.riga, m => {
    const a = m.articoloId ? A.articolo(m.articoloId) : null;
    const passo = a && a.unita === 'lt' ? 0.5 : 1;
    m.qta = Math.max(passo, tondo((Number(m.qta) || 0) + Number(el.dataset.d) * passo));
  }));
  A.azione('tec-mat-qta', el => {
    const n = numero(el.value);
    if (!(n > 0)) { A.toast('Scrivi una quantità maggiore di zero, oppure togli la riga', 'warn'); A.render(); return; }
    suRiga(el.dataset.id, 'materiali', el.dataset.riga, m => { m.qta = tondo(n); });
  });
  A.azione('tec-mat-togli', el => { suRiga(el.dataset.id, 'materiali', el.dataset.riga, (m, r) => { r.materiali = r.materiali.filter(x => x.id !== m.id); }); A.toast('Tolto dal rapportino'); });
  A.azione('tec-fuori', el => {
    A.modale({
      titolo: 'Voce fuori catalogo', form: 'tec-fuori-agg',
      corpo: `<input type="hidden" name="id" value="${h(el.dataset.id)}">
        <div class="campo"><label for="tec-fn">Che cos'è</label><input id="tec-fn" name="nome" type="text" value="${h(el.dataset.nome || '')}" placeholder="Es. Raccordo speciale comprato al banco" autocomplete="off"></div>
        <div class="tec-qta"><div class="campo"><label for="tec-fq">Quantità</label><input id="tec-fq" name="qta" type="text" inputmode="decimal" value="1"></div>
        <div class="campo"><label for="tec-fu">Unità</label><select id="tec-fu" name="unita">${['pz', 'm', 'lt', 'kg', 'kit', 'corpo'].map(x => `<option>${x}</option>`).join('')}</select></div></div>
        <p class="pic">Non esce dal furgone: l'ufficio la registra a parte.</p>`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: 'Aggiungi', classe: 'acc', tipo: 'submit', icona: 'piu' }]
    });
  });
  A.azione('tec-fuori-agg', (form, ev, d) => {
    const nome = String(d.nome || '').trim(); const q = numero(d.qta);
    if (!nome) { A.toast('Scrivi che cos\'è', 'warn'); const x = form.querySelector('[name=nome]'); if (x) x.focus(); return; }
    A.chiudiModale();
    A.modifica(db => { const r = bozza(db, d.id); if (!r) return; ultimaRiga = A.uid('rm'); r.materiali.push({ id: ultimaRiga, articoloId: null, nome, qta: q > 0 ? tondo(q) : 1, unita: d.unita || 'pz', da: 'fuori catalogo' }); });
    A.toast('Aggiunto: ' + taglia(nome, 40), 'ok');
    A.render();
  });

  // ---- foto
  A.azione('tec-fase', el => { fasiScelte[el.dataset.id] = el.value; });
  A.azione('tec-foto', async el => {
    const id = el.dataset.id; const files = Array.from(el.files || []); el.value = '';
    if (!files.length) return;
    flush();
    const i = mio(id); if (!i) return;
    const posto = Math.max(0, MAX_FOTO - ((i.rapporto && i.rapporto.foto) || []).length);
    if (!posto) { A.toast('Hai già ' + MAX_FOTO + ' foto: eliminane una per farne un\'altra', 'warn'); return; }
    const scelti = files.slice(0, posto);
    A.toast(scelti.length === 1 ? 'Preparo la foto…' : 'Preparo ' + scelti.length + ' foto…');
    const fatte = [];
    for (const f of scelti) { try { fatte.push(await A.comprimiFoto(f, LATO_FOTO, QUALITA_FOTO)); } catch (e) { A.toast('Una foto non si legge: riprova', 'per'); } }
    if (!fatte.length) return;
    const fase = faseAttiva(A.intervento(id));
    // Le foto nascono NON visibili al cliente: le rende visibili l'ufficio (§8.3).
    A.modifica(db => { const r = bozza(db, id); fatte.forEach(src => r.foto.push({ id: A.uid('fot'), fase, src, visibileCliente: false, data: A.adesso() })); });
    A.toast(files.length > posto ? 'Massimo ' + MAX_FOTO + ' foto: ne ho tenute ' + posto : fatte.length === 1 ? 'Foto salvata sul telefono' : fatte.length + ' foto salvate sul telefono', files.length > posto ? 'warn' : 'ok');
    A.render();
  });
  A.azione('tec-foto-fase', el => suRiga(el.dataset.id, 'foto', el.dataset.foto, ft => {
    const k = Object.keys(A.FASI_FOTO); ft.fase = k[(k.indexOf(ft.fase) + 1) % k.length];
  }));
  A.azione('tec-foto-apri', el => {
    const i = mio(el.dataset.id); if (!i || !i.rapporto) return;
    const ft = i.rapporto.foto.find(x => x.id === el.dataset.foto); if (!ft) return;
    A.modale({
      titolo: 'Foto', nofocus: true,
      corpo: `<img class="tec-foto-grande" src="${h(ft.src)}" alt="Foto ingrandita">
        <div class="tec-sott">Che foto è?</div>
        <div class="scelte" role="radiogroup">${Object.keys(A.FASI_FOTO).map(k => `<label class="scelta"><input type="radio" name="tec-ff" value="${k}" data-cambia="tec-foto-fase-set" data-id="${h(i.id)}" data-foto="${h(ft.id)}" ${ft.fase === k ? 'checked' : ''}><span>${A.FASI_FOTO[k]}</span></label>`).join('')}</div>
        <p class="tec-privacy">${icona('occhiochiuso', 'p')}<span>Il cliente non la vede finché l'ufficio non decide di mostrargliela.</span></p>`,
      azioni: [{ testo: 'Elimina', classe: 'per', icona: 'cestino', az: 'tec-foto-togli', attr: ` data-id="${h(i.id)}" data-foto="${h(ft.id)}"` }, { testo: 'Fatto', classe: 'pri', chiudi: true }]
    });
  });
  A.azione('tec-foto-fase-set', el => { A.modifica(db => { const r = bozza(db, el.dataset.id); const ft = r && r.foto.find(x => x.id === el.dataset.foto); if (ft) ft.fase = el.value; }); A.render(); });
  A.azione('tec-foto-togli', async el => {
    const id = el.dataset.id, fid = el.dataset.foto;
    if (!(await A.conferma('La foto viene cancellata dal telefono e non arriva all\'ufficio.', { titolo: 'Eliminare la foto?', ok: 'Elimina', pericolo: true }))) return;
    A.modifica(db => { const r = bozza(db, id); if (r) r.foto = r.foto.filter(x => x.id !== fid); });
    A.toast('Foto eliminata');
    A.render();
  });

  // ---- note all'ufficio e materiale da ordinare: passano dalla coda
  A.azione('tec-nota', el => {
    A.modale({
      titolo: 'Scrivi all\'ufficio', form: 'tec-nota-invia',
      corpo: `<input type="hidden" name="id" value="${h(el.dataset.id || '')}">
        <div class="campo"><label for="tec-nt">Messaggio</label><textarea id="tec-nt" name="testo" rows="4" placeholder="Es. Il cliente chiede se possiamo tornare giovedì"></textarea></div>
        <label class="spunta"><input type="checkbox" name="urgente"> <span><b>Urgente</b> — l'ufficio lo vede in rosso</span></label>
        <p class="pic">${A.inRete() ? 'Arriva subito all\'ufficio.' : 'Sei senza rete: resta sul telefono e parte appena torna il campo.'}</p>`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: 'Invia', classe: 'acc', tipo: 'submit', icona: 'invia' }]
    });
  });
  A.azione('tec-nota-invia', (form, ev, d) => {
    const testo = String(d.testo || '').trim();
    if (!testo) { A.toast('Scrivi il messaggio', 'warn'); const x = form.querySelector('textarea'); if (x) x.focus(); return; }
    const i = d.id ? mio(d.id) : null;
    A.chiudiModale();
    const subito = A.accoda('nota', { id: A.uid('not'), interventoId: i ? i.id : null, testo, urgente: !!d.urgente, data: A.adesso() }, 'Nota per l\'ufficio' + (i ? ' — ' + nomeCliente(i) : ''));
    A.toast(subito ? 'Nota arrivata all\'ufficio' : 'Nota salvata: parte appena torna la rete', subito ? 'ok' : 'warn');
    A.render();
  });
  function modaleMateriale(id, art) {
    A.modale({
      titolo: 'Materiale da ordinare', form: 'tec-matord-invia',
      corpo: `<input type="hidden" name="id" value="${h(id || '')}"><input type="hidden" name="articoloId" value="${art ? h(art.id) : ''}">
        <div class="campo"><label for="tec-md">Cosa serve</label><input id="tec-md" name="descrizione" type="text" autocomplete="off" data-digita="tec-matord-cerca" value="${art ? h(art.nome) : ''}" placeholder="Cerca nel catalogo o scrivi a parole"></div>
        <div id="tec-md-scelto">${art ? sceltoHtml(art) : ''}</div>
        <div id="tec-md-sugg" class="tec-sugg"></div>
        <div class="tec-qta"><div class="campo"><label for="tec-mq">Quantità</label><input id="tec-mq" name="qta" type="text" inputmode="decimal" value="1"></div>
          <div class="campo"><label for="tec-mu">Unità</label><input id="tec-mu" name="unita" type="text" value="${art ? h(art.unita) : 'pz'}"></div></div>
        <div class="campo"><span class="etichetta">Quanto è urgente?</span><div class="tec-urgenze" role="radiogroup">${Object.keys(URGENZE).map((k, n) => `<label class="scelta"><input type="radio" name="urgenza" value="${k}" ${n === 0 ? 'checked' : ''}><span>${URGENZE[k][0]}<small>${URGENZE[k][1]}</small></span></label>`).join('')}</div></div>
        <div class="campo"><label for="tec-mn">Note (facoltative)</label><input id="tec-mn" name="note" type="text" placeholder="Es. uguale a quello montato, attacco 3/4"></div>`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: 'Segnala all\'ufficio', classe: 'acc', tipo: 'submit', icona: 'carrello' }]
    });
  }
  function sceltoHtml(a) { return `<div class="tec-scelto">${icona('spunta', 'p')} Dal catalogo: ${h(a.codice)} · ${h(a.marca)} <button type="button" class="btn pic vuoto" data-az="tec-matord-libero" aria-label="Scrivi a parole">${icona('x', 'p')}</button></div>`; }
  A.azione('tec-matord', el => modaleMateriale(el.dataset.id, el.dataset.art ? A.articolo(el.dataset.art) : null));
  A.azione('tec-matord-cerca', el => {
    const form = el.closest('form'); if (!form) return;
    const hid = form.querySelector('[name=articoloId]');
    // Se riscrive a mano dopo aver scelto dal catalogo, la scelta decade.
    if (hid.value) { const a = A.articolo(hid.value); if (!a || a.nome !== el.value) { hid.value = ''; A.$('#tec-md-scelto').innerHTML = ''; } }
    const q = norm(el.value).trim(); const box = A.$('#tec-md-sugg');
    if (q.length < 2 || hid.value) { box.innerHTML = ''; return; }
    const parole = q.split(/\s+/);
    const tr = A.DB.articoli.filter(a => a.attivo !== false && parole.every(p => norm([a.codice, a.nome, a.marca, a.barcode].join(' ')).includes(p))).slice(0, 5);
    box.innerHTML = tr.map(a => `<button type="button" data-az="tec-matord-scegli" data-art="${h(a.id)}"><span>${h(a.nome)}</span><small>${h(a.codice)}</small></button>`).join('');
  });
  A.azione('tec-matord-scegli', el => {
    const a = A.articolo(el.dataset.art); const form = el.closest('form'); if (!a || !form) return;
    form.querySelector('[name=articoloId]').value = a.id;
    form.querySelector('[name=descrizione]').value = a.nome;
    form.querySelector('[name=unita]').value = a.unita;
    A.$('#tec-md-scelto').innerHTML = sceltoHtml(a);
    A.$('#tec-md-sugg').innerHTML = '';
  });
  A.azione('tec-matord-libero', el => {
    const form = el.closest('form'); if (!form) return;
    form.querySelector('[name=articoloId]').value = '';
    A.$('#tec-md-scelto').innerHTML = '';
    const x = form.querySelector('[name=descrizione]'); x.focus(); x.select();
  });
  A.azione('tec-matord-invia', (form, ev, d) => {
    const descr = String(d.descrizione || '').trim(); const q = numero(d.qta);
    if (!descr) { A.toast('Scrivi cosa serve', 'warn'); form.querySelector('[name=descrizione]').focus(); return; }
    const i = d.id ? mio(d.id) : null;
    A.chiudiModale();
    const payload = { id: A.uid('rmat'), interventoId: i ? i.id : null, articoloId: d.articoloId || null, descrizione: descr, qta: q > 0 ? tondo(q) : 1, unita: String(d.unita || 'pz').trim() || 'pz', urgenza: URGENZE[d.urgenza] ? d.urgenza : 'normale', note: String(d.note || '').trim(), data: A.adesso() };
    const subito = A.accoda('richiesta_materiale', payload, 'Materiale da ordinare — ' + taglia(descr, 40) + ' ×' + A.num(payload.qta));
    A.toast(subito ? 'Segnalato all\'ufficio' : 'Segnalazione salvata: parte appena torna la rete', subito ? 'ok' : 'warn');
    A.render();
  });

  // ===========================================================================
  // 4. FIRMA
  // ===========================================================================
  function firmatarioPredefinito(i) {
    const c = A.cliente(i.clienteId) || {}, s = A.sede(i.sedeId) || {};
    let nome = s.referente || (c.tipo === 'privato' ? c.nome : (c.referente || c.nome)) || '';
    let qualifica = c.tipo === 'condominio' ? 'Amministratore' : c.tipo === 'azienda' ? 'Referente' : 'Cliente';
    let m = nome.match(/^(.+?)\s+[—–-]\s+(.+)$/); // «Portiere — Sig. Lo Presti»
    if (m) { qualifica = cap(m[1].trim()); nome = m[2].trim(); }
    m = nome.match(/^(.+?)\s*\((.+)\)\s*$/);   // «Salvatore Puglisi (amministratore)»
    if (m) { nome = m[1].trim(); qualifica = cap(m[2].trim()); }
    return { nome, qualifica };
  }
  function riepilogoOre(i) {
    const min = A.minutiIntervento(i);
    const part = Object.keys(A.TIPI_ORE).filter(k => min[k]).map(k => A.TIPI_ORE[k].toLowerCase() + ' ' + oreBrevi(min[k]));
    return min.totale ? oreBrevi(min.totale) + (part.length > 1 ? ' (' + part.join(', ') + ')' : '') : 'nessuna ora segnata';
  }
  A.rotta('#/t/firma/:id', 'tecnico', par => {
    preparaPagina();
    const i = mio(par.id); if (!i) return nonTrovato();
    if (!modificabile(i)) { location.replace('#/t/rapportino/' + i.id); return false; }
    assicuraBozza(i.id);
    if (!i.rapporto.firma) { const p = firmatarioPredefinito(i); A.modifica(db => { const r = bozza(db, i.id); r.firma = Object.assign(firmaVuota(), p); }); }
    const r = i.rapporto; const f = r.firma; const id = h(i.id);
    const c = A.cliente(i.clienteId) || {};
    const qual = QUALIFICHE[c.tipo] || QUALIFICHE.privato;
    const contenuto = `
      ${passi(2)}
      <div class="riepilogo-firma">
        <b>Il cliente firma per questo lavoro</b>
        <p style="margin:4px 0 8px">${h(taglia(r.lavoro, 180)) || '<span class="muto">Descrizione non ancora scritta</span>'}</p>
        <ul class="tec-riep-lista">
          <li><span>Ore</span><span>${h(riepilogoOre(i))}</span></li>
          ${(r.materiali || []).map(m => `<li><span>${h(m.nome)}</span><span>${A.num(m.qta)} ${h(m.unita || '')}</span></li>`).join('') || '<li><span>Materiale</span><span>nessuno</span></li>'}
        </ul>
      </div>
      <div class="spazio"></div>
      <div class="campo"><label for="tec-fnome">Nome di chi firma</label><input id="tec-fnome" type="text" autocomplete="off" value="${h(f.nome || '')}" data-digita="tec-scrivi" data-cambia="tec-scrivi-fine" data-id="${id}" data-campo="firma.nome"></div>
      <div class="campo"><label for="tec-fqual">In qualità di</label><input id="tec-fqual" type="text" autocomplete="off" value="${h(f.qualifica || '')}" data-digita="tec-scrivi" data-cambia="tec-scrivi-fine" data-id="${id}" data-campo="firma.qualifica">
        <div class="tec-chips">${qual.map(q => `<button type="button" class="${norm(f.qualifica) === norm(q) ? 'on' : ''}" data-az="tec-qualifica" data-id="${id}" data-q="${h(q)}">${h(q)}</button>`).join('')}</div></div>
      <div id="tec-pad-w" class="tec-pad-w">
        <div class="tec-pad-testa"><b>Firma qui, con il dito</b><button type="button" class="btn pri" data-az="tec-pad-piena">${icona('spunta')} Fatto</button></div>
        <p class="tec-gira">Gira il telefono in orizzontale: il riquadro diventa più grande.</p>
        <div id="tec-pad" class="firma-pad tec-pad${f.png ? ' firmata' : ''}${f.assente ? ' spenta' : ''}"><canvas aria-label="Riquadro per la firma del cliente" role="img"></canvas><div class="linea"></div><div class="x">×</div><div class="suggerimento">Firma qui con il dito</div></div>
        <div class="tec-pad-azioni">
          <span id="tec-stato-firma" class="tec-stato-firma${f.png ? ' ok' : ''}">${f.png ? icona('spunta', 'p') + ' Firma salvata sul telefono' : 'Il cliente firma nel riquadro'}</span>
          <button type="button" class="btn" data-az="tec-pad-cancella" data-id="${id}">${icona('cestino', 'p')} Cancella</button><button type="button" class="btn" data-az="tec-pad-piena" aria-label="Firma a tutto schermo">${icona('esterno', 'p')} Ingrandisci</button>
        </div>
      </div>
      <p class="tec-nota-firma">È una firma elettronica semplice: conferma che il lavoro descritto è stato fatto. Resta nel rapportino, con data e ora.</p>
      <div class="tec-assente">
        <label class="spunta"><input type="checkbox" data-cambia="tec-assente" data-id="${id}" ${f.assente ? 'checked' : ''}> Il cliente non è presente</label>
        ${f.assente ? `<div class="campo"><label for="tec-c-motivo">Perché? <span class="tec-obb">obbligatorio</span></label><textarea id="tec-c-motivo" rows="2" data-digita="tec-scrivi" data-cambia="tec-scrivi-fine" data-id="${id}" data-campo="firma.motivo" placeholder="Es. Ha lasciato le chiavi al portiere">${h(f.motivo || '')}</textarea></div>` : ''}
      </div>
      <button type="button" class="btn acc xl tec-avanti" data-az="tec-a-chiusura" data-id="${id}">Avanti: chiusura ${icona('avanti')}</button>`;
    return {
      html: guscio({ titolo: 'Firma del cliente', sotto: nomeCliente(i) + ' · N. ' + i.numero, indietro: '#/t/rapportino/' + id, tab: 'oggi', contenuto }),
      dopo: () => { montaFirma(i.id); if (par.q.campo === 'motivo') setTimeout(() => { const m = A.$('#tec-c-motivo'); if (m) { m.scrollIntoView({ block: 'center' }); m.focus({ preventScroll: true }); } }, 30); }
    };
  });

  /*
   * Il riquadro della firma. I tratti si tengono in coordinate relative (0..1)
   * e il riquadro ha sempre le stesse proporzioni: cosi' si puo' ingrandire,
   * girare il telefono o tornare sulla pagina senza deformare la firma.
   * Il canvas e' scalato per devicePixelRatio (altrimenti su iPhone la firma
   * esce sgranata) e salvato come PNG largo 600 px: basta per il foglio e
   * pesa pochi KB.
   */
  const firme = {};
  function traccia(c, pts, w, hh, lw) {
    c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = INCHIOSTRO; c.fillStyle = INCHIOSTRO; c.lineWidth = lw;
    const P = pts.map(p => [p[0] * w, p[1] * hh]);
    if (P.length === 1) { c.beginPath(); c.arc(P[0][0], P[0][1], lw / 2, 0, Math.PI * 2); c.fill(); return; }
    c.beginPath(); c.moveTo(P[0][0], P[0][1]);
    // Curve fra i punti medi: il tratto esce morbido anche con pochi campioni.
    for (let k = 1; k < P.length - 1; k++) c.quadraticCurveTo(P[k][0], P[k][1], (P[k][0] + P[k + 1][0]) / 2, (P[k][1] + P[k + 1][1]) / 2);
    const u = P[P.length - 1]; c.lineTo(u[0], u[1]); c.stroke();
  }
  function montaFirma(id) {
    const pad = A.$('#tec-pad'); if (!pad) return;
    const cv = pad.querySelector('canvas'); const ctx = cv.getContext('2d');
    const i = A.intervento(id); const f = (i && i.rapporto && i.rapporto.firma) || {};
    const st = firme[id] || (firme[id] = { tratti: [], base: f.png || null });
    let img = null;
    if (st.base) { img = new Image(); img.onload = ridisegna; img.src = st.base; }
    let W = 0, H = 0, dpr = 1, corrente = null, raf = 0;
    function dimensiona() {
      const b = cv.getBoundingClientRect(); if (!b.width || !b.height) return;
      dpr = window.devicePixelRatio || 1; W = b.width; H = b.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ridisegna();
    }
    function ridisegna() {
      if (!W) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (img && img.complete && img.naturalWidth) ctx.drawImage(img, 0, 0, W, H);
      st.tratti.forEach(t => traccia(ctx, t, W, H, TRATTO));
    }
    const chiedi = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; ridisegna(); }); };
    const punto = e => { const b = cv.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), Math.min(1, Math.max(0, (e.clientY - b.top) / b.height))]; };
    cv.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (_) { }
      // Mentre firma, un aggiornamento da un'altra finestra NON ridisegna la pagina.
      A.firmaInCorso = true;
      corrente = [punto(e)]; st.tratti.push(corrente);
      pad.classList.add('firmata');
      chiedi();
    });
    cv.addEventListener('pointermove', e => {
      if (!corrente) return;
      e.preventDefault();
      const lista = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      (lista && lista.length ? lista : [e]).forEach(x => corrente.push(punto(x)));
      chiedi();
    });
    const fine = () => { if (!corrente) return; corrente = null; A.firmaInCorso = false; ridisegna(); salva(); };
    cv.addEventListener('pointerup', fine);
    cv.addEventListener('pointercancel', fine);
    cv.addEventListener('lostpointercapture', fine);
    function salva() {
      const OW = 600, OH = Math.round(600 / RAPPORTO_FIRMA);
      const off = document.createElement('canvas'); off.width = OW; off.height = OH;
      const c2 = off.getContext('2d');
      if (img && img.complete && img.naturalWidth) c2.drawImage(img, 0, 0, OW, OH);
      st.tratti.forEach(t => traccia(c2, t, OW, OH, TRATTO * OW / (W || 360)));
      const png = off.toDataURL('image/png');
      A.modifica(db => { const r = bozza(db, id); r.firma = Object.assign(r.firma || firmaVuota(), { png, data: A.adesso(), assente: false }); });
      const s = A.$('#tec-stato-firma'); if (s) { s.className = 'tec-stato-firma ok'; s.innerHTML = icona('spunta', 'p') + ' Firma salvata sul telefono'; }
    }
    pad._pulisci = () => { st.tratti = []; st.base = null; img = null; pad.classList.remove('firmata'); ridisegna(); };
    if (window.ResizeObserver) { roFirma = new ResizeObserver(() => { if (!document.body.contains(cv)) { if (roFirma) roFirma.disconnect(); return; } dimensiona(); }); roFirma.observe(cv); }
    dimensiona();
  }
  A.azione('tec-pad-cancella', el => {
    const pad = A.$('#tec-pad'); if (pad && pad._pulisci) pad._pulisci();
    A.modifica(db => { const r = bozza(db, el.dataset.id); if (r && r.firma) { r.firma.png = null; r.firma.data = null; } });
    const s = A.$('#tec-stato-firma'); if (s) { s.className = 'tec-stato-firma'; s.textContent = 'Il cliente firma nel riquadro'; }
  });
  A.azione('tec-pad-piena', () => { const w = A.$('#tec-pad-w'); if (w) w.classList.toggle('piena'); });
  A.azione('tec-qualifica', el => {
    const x = A.$('#tec-fqual'); if (!x) return;
    x.value = el.dataset.q; salvaDopo(el.dataset.id, 'firma.qualifica', el.dataset.q); flush();
    A.$$('.tec-chips button').forEach(b => b.classList.toggle('on', b === el));
  });
  A.azione('tec-assente', el => {
    flush();
    const id = el.dataset.id;
    A.modifica(db => { const r = bozza(db, id); r.firma = r.firma || firmaVuota(); r.firma.assente = el.checked; if (el.checked) { r.firma.png = null; r.firma.data = null; } });
    if (el.checked && firme[id]) { firme[id].tratti = []; firme[id].base = null; }
    A.render();
    if (el.checked) setTimeout(() => { const m = A.$('#tec-c-motivo'); if (m) m.focus(); }, 30);
  });
  A.azione('tec-a-chiusura', el => {
    flush();
    const i = mio(el.dataset.id); if (!i) return;
    const f = i.rapporto && i.rapporto.firma;
    if (f && f.assente && !String(f.motivo || '').trim()) {
      A.toast('Scrivi perché il cliente non c\'è: all\'ufficio serve per richiamarlo', 'warn', 4000);
      const m = A.$('#tec-c-motivo'); if (m) { m.scrollIntoView({ block: 'center' }); m.focus({ preventScroll: true }); }
      return;
    }
    A.vai('#/t/chiusura/' + i.id);
  });

  // ===========================================================================
  // 5. CHIUSURA
  // ===========================================================================
  A.rotta('#/t/chiusura/:id', 'tecnico', par => {
    preparaPagina();
    const i = mio(par.id); if (!i) return nonTrovato();
    if (!modificabile(i)) { location.replace('#/t/inviato/' + i.id); return false; }
    assicuraBozza(i.id);
    const r = i.rapporto; const id = h(i.id); const f = r.firma || {};
    const rim = r.stato === 'rimandato';
    const lavoroOk = !!String(r.lavoro || '').trim();
    const firmaTxt = f.png && !f.assente ? 'Firmato da ' + (f.nome || 'cliente') + (f.qualifica ? ' (' + f.qualifica + ')' : '') : f.assente ? 'Cliente non presente' + (f.motivo ? ': ' + f.motivo : ' — manca il motivo') : 'Senza firma';
    const riga = (ic, tit, testo, manca, href) => `<li class="${manca ? 'manca' : ''}">${icona(ic)}<div class="cx1"><b>${h(tit)}</b><span>${testo}</span></div>${href ? `<a class="btn pic" href="${href}" aria-label="Modifica: ${h(tit)}">${icona('modifica', 'p')}</a>` : ''}</li>`;
    const contenuto = `
      ${passi(3)}
      ${rim ? avvisoRimando(r) : ''}
      <div class="sez" id="tec-s-esito">Com'è andata? <span class="tec-obb">obbligatorio</span></div>
      <div class="tec-esiti" role="radiogroup" aria-label="Esito del lavoro">${Object.keys(A.ESITI).map(k => { const t = ESITO_ICONA[k]; return `<label class="scelta"><input type="radio" name="tec-esito" value="${k}" data-cambia="tec-esito" data-id="${id}" ${r.esito === k ? 'checked' : ''}><span><i class="tec-esito-ic ${t[1]}">${icona(t[0], 'p')}</i><b>${h(A.ESITI[k])}</b></span></label>`; }).join('')}</div>
      <label class="tec-sw-riga"><input type="checkbox" data-cambia="tec-secondo" data-id="${id}" ${r.secondoIntervento ? 'checked' : ''}><span class="cx1"><b>Serve un secondo intervento</b><small>L'ufficio lo mette in agenda e avvisa il cliente</small></span><i class="tec-sw" aria-hidden="true"></i></label>
      <div class="sez">Riepilogo</div>
      <section class="tessera"><div class="cp"><ul class="tec-riepilogo">
        ${riga('edificio', 'Cliente', h(nomeCliente(i)) + ' · ' + h(A.indirizzo(A.sede(i.sedeId))))}
        ${riga('penna', 'Cosa ho fatto', lavoroOk ? h(taglia(r.lavoro, 200)) : 'Da scrivere: è obbligatorio', !lavoroOk, '#/t/rapportino/' + id + '?campo=lavoro')}
        ${riga('orologio', 'Ore', h(riepilogoOre(i)), !A.minutiIntervento(i).totale, '#/t/rapportino/' + id)}
        ${riga('pacco', 'Materiale', r.materiali.length ? r.materiali.map(m => h(m.nome) + ' ×' + A.num(m.qta)).join(', ') : 'Nessuno', false, '#/t/rapportino/' + id)}
        ${riga('fotocamera', 'Foto', r.foto.length ? r.foto.length + ' foto' : 'Nessuna', false, '#/t/rapportino/' + id)}
        ${riga('penna', 'Firma', h(firmaTxt), !(f.png && !f.assente) && !(f.assente && f.motivo), '#/t/firma/' + id)}
        ${r.note ? riga('messaggio', 'Note per l\'ufficio', h(taglia(r.note, 140))) : ''}
      </ul></div></section>
      <button type="button" class="btn ok xl tec-avanti" data-az="tec-invia" data-id="${id}">${icona('invia', 'g')} ${rim ? 'Reinvia all\'ufficio' : 'Chiudi e invia all\'ufficio'}</button>
      <p class="pic cx" style="margin-top:10px">${A.inRete() ? 'Arriva subito all\'ufficio.' : 'Sei senza rete: la scheda resta sul telefono e parte da sola appena torna il campo.'}</p>`;
    return guscio({ titolo: 'Chiusura', sotto: nomeCliente(i) + ' · N. ' + i.numero, indietro: '#/t/firma/' + id, tab: 'oggi', contenuto });
  });
  A.azione('tec-esito', el => {
    const e = el.value; let secondo = false;
    A.modifica(db => {
      const r = bozza(db, el.dataset.id); r.esito = e;
      // Chi ha finito a meta' di solito deve tornare: lo proponiamo, lui decide.
      if ((e === 'parziale' || e === 'da_riprogrammare') && !r.secondoIntervento) { r.secondoIntervento = true; secondo = true; }
    });
    if (secondo) A.toast('Ho segnato «serve un secondo intervento»: toglilo se non serve');
    A.render();
  });
  A.azione('tec-secondo', el => { A.modifica(db => { const r = bozza(db, el.dataset.id); r.secondoIntervento = el.checked; }); });
  A.azione('tec-invia', el => {
    flush();
    const id = el.dataset.id; const i = mio(id); if (!i) return;
    if (!modificabile(i)) { A.vai('#/t/inviato/' + id); return; }
    const r = i.rapporto || {};
    // Obbligatori solo descrizione ed esito: lo diciamo con gentilezza e portiamo al campo.
    if (!String(r.lavoro || '').trim()) {
      A.toast('Manca solo due righe su cosa hai fatto: ti porto lì', 'warn', 4200);
      A.vai('#/t/rapportino/' + id + '?campo=lavoro');
      return;
    }
    if (!r.esito) {
      A.toast('Scegli com\'è andata: all\'ufficio serve per sapere se richiamare il cliente', 'warn', 4200);
      const g = A.$('.tec-esiti'); if (g) { g.classList.add('manca'); const s = A.$('#tec-s-esito'); (s || g).scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      return;
    }
    const f = r.firma || {};
    if (f.assente && !String(f.motivo || '').trim()) { A.toast('Scrivi perché il cliente non c\'è', 'warn', 4000); A.vai('#/t/firma/' + id + '?campo=motivo'); return; }
    if (!f.png && !f.assente) {
      // Chiediamo, ma non blocchiamo: la firma si recupera, il lavoro fatto no.
      A.modale({
        titolo: 'Manca la firma',
        corpo: `<p>Il cliente non ha firmato e non è segnato come assente.</p><p class="muto" style="margin-top:8px">Puoi inviare lo stesso: l'ufficio vedrà il rapportino senza firma.</p>`,
        azioni: [{ testo: 'Invia senza firma', az: 'tec-invia-forza', attr: ` data-id="${h(id)}"` }, { testo: 'Fai firmare adesso', classe: 'pri', icona: 'penna', az: 'tec-vai-firma', attr: ` data-id="${h(id)}"` }]
      });
      return;
    }
    invia(id);
  });
  A.azione('tec-invia-forza', el => invia(el.dataset.id));
  A.azione('tec-vai-firma', el => { A.chiudiModale(); A.vai('#/t/firma/' + el.dataset.id); });
  function invia(id) {
    A.chiudiModale(); flush();
    const i = mio(id); if (!i) return;
    // Doppio tocco con i guanti: la seconda volta non si accoda niente.
    if (coda(i, 'invia_rapporto').length || !modificabile(i)) { A.vai('#/t/inviato/' + id); return; }
    A.modifica(db => {
      const r = bozza(db, id);
      fermaCronometro(r); // il cronometro dimenticato acceso non deve perdere le ore
      r.ore = r.ore.filter(o => (Number(o.minuti) || 0) > 0);
      r.materiali = r.materiali.filter(m => (Number(m.qta) || 0) > 0);
      if (r.firma && !r.firma.png && !r.firma.assente) r.firma = null;
      r.fine = r.fine || A.adesso();
      r.chiusoIl = A.adesso();
    });
    A.accoda('invia_rapporto', { interventoId: id }, 'Rapportino — ' + nomeCliente(i));
    A.vai('#/t/inviato/' + id);
  }

  // ===========================================================================
  // 6. INVIATO
  // ===========================================================================
  A.rotta('#/t/inviato/:id', 'tecnico', par => {
    preparaPagina();
    const i = mio(par.id); if (!i) return nonTrovato();
    const pend = coda(i, 'invia_rapporto').length > 0;
    const r = i.rapporto || {};
    if (!pend && !['inviato', 'approvato'].includes(r.stato)) { location.replace('#/t/lavoro/' + i.id); return false; }
    const n = A.codaMia().length;
    const giorno = i.data || A.oggi();
    const altri = mieiLavori().filter(x => x.data === giorno && x.id !== i.id && !CHIUSI.includes(statoTec(x)) && statoTec(x) !== 'rimandato').sort(perOra);
    const prossimo = altri.find(x => (x.ora || '') >= (i.ora || '')) || altri[0] || null;
    const contenuto = `
      <div class="tec-fatto${pend ? ' attesa' : ''}" role="status">
        <div class="cerchio">${icona(pend ? 'senzarete' : 'spunta')}</div>
        <h2>Intervento chiuso</h2>
        <p>${pend ? 'Salvata sul telefono: parte appena torna la rete.' : 'Scheda inviata all\'ufficio.'}</p>
        ${pend ? `<span class="n">${A.pastiglia(n === 1 ? '1 scheda in attesa' : n + ' schede in attesa', 'warn')}</span>` : r.inviatoIl ? `<p class="pic">Arrivata ${h(A.quando(r.inviatoIl))}</p>` : ''}
      </div>
      <div class="tessera" style="margin-top:18px"><div class="cp"><ul class="tec-riep-lista">
        <li><span>Cliente</span><span>${h(nomeCliente(i))}</span></li>
        <li><span>Ore</span><span>${h(oreBrevi(A.minutiIntervento(i).totale))}</span></li>
        <li><span>Materiale</span><span>${(r.materiali || []).length} ${(r.materiali || []).length === 1 ? 'voce' : 'voci'}</span></li>
        <li><span>Foto</span><span>${(r.foto || []).length}</span></li>
        <li><span>Esito</span><span>${h(A.ESITI[r.esito] || '—')}</span></li>
      </ul></div></div>
      ${prossimo ? `<div class="sez tec-prossimo">Il prossimo lavoro</div>${schedaLavoro(prossimo, 'Prossimo')}` : `<div class="sez tec-prossimo">Il prossimo lavoro</div><div class="tec-vuoto">${A.vuoto('Per oggi hai finito', 'Nessun altro lavoro in agenda per questa giornata.', 'spunta')}</div>`}
      <div class="tec-bottoni">
        ${prossimo ? `<a class="btn acc xl" href="#/t/lavoro/${h(prossimo.id)}">${icona('avanti', 'g')} Prossimo lavoro</a>` : ''}
        <a class="btn g largo" href="#/t/oggi${giorno !== A.oggi() ? '?g=' + giorno : ''}">${icona('calendario')} Torna a oggi</a>
        ${pend ? `<a class="btn g largo" href="#/t/coda">${icona('invia')} Vedi le schede da inviare</a>` : ''}
      </div>`;
    return guscio({ titolo: 'Fatto', sotto: nomeCliente(i) + ' · N. ' + i.numero, tab: 'oggi', contenuto });
  });

  // ===========================================================================
  // 7. DA INVIARE (la coda)
  // ===========================================================================
  A.rotta('#/t/coda', 'tecnico', () => {
    preparaPagina();
    const lista = A.codaMia();
    const rete = A.inRete();
    const contenuto = `
      ${indicatoreSync()}
      ${bottoneRete()}
      <div class="sez">Schede sul telefono <span>${lista.length}</span></div>
      ${lista.length ? `<section class="tessera"><ul class="tec-op">${lista.map(o => { const [tit, chi] = String(o.descrizione || o.tipo).split(' — '); return `<li><span class="ic2">${icona(ICONA_OP[o.tipo] || 'documento')}</span><div class="cx1"><b>${h(tit)}</b><small>${chi ? h(chi) + ' · ' : ''}${h(A.quando(o.creata))}</small></div></li>`; }).join('')}</ul></section>
        <div class="spazio"></div>
        <button type="button" class="btn ${rete ? 'acc' : ''} xl" data-az="tec-invia-ora">${icona(rete ? 'invia' : 'senzarete', 'g')} ${rete ? 'Invia adesso' : 'In attesa di rete'}</button>`
        : `<div class="tec-vuoto">${A.vuoto('Tutto inviato', 'Sul telefono non c\'è niente in attesa: l\'ufficio ha tutto.', 'spunta')}</div>`}
      <div class="sez">Come funziona senza rete</div>
      <section class="tessera"><div class="cp"><ul class="tec-come">
        <li><span>1</span><div>Lavori come sempre: rapportino, foto, firma. <b>Tutto resta salvato sul telefono</b>, anche se chiudi l'app.</div></li>
        <li><span>2</span><div>Appena c'è campo, le schede <b>partono da sole</b>, nell'ordine in cui le hai fatte. Niente doppioni, anche se tocchi due volte.</div></li>
        <li><span>3</span><div>Quando esci dalla cantina <b>tieni l'app aperta un attimo</b>: il numero qui sopra torna a zero quando è arrivato tutto.</div></li>
      </ul></div></section>`;
    return guscio({ titolo: 'Da inviare', sotto: rete ? (lista.length ? 'Rete presente' : 'Tutto arrivato all\'ufficio') : 'Senza rete', tab: 'coda', contenuto });
  });
  A.azione('tec-invia-ora', () => {
    if (!A.inRete()) { A.toast('Sei senza rete: le schede partono da sole appena torna il campo', 'warn'); return; }
    const n = A.svuotaCoda();
    if (!n) A.toast(A.codaMia().length ? 'Non è partito niente: riprova fra poco' : 'Niente da inviare', 'ok');
    A.render();
  });
  A.azione('tec-rete', () => {
    flush();
    const era = A.inRete();
    if (!era && !navigator.onLine) { A.toast('Il telefono è davvero senza rete: riprova quando c\'è campo', 'warn'); return; }
    A.impostaRete(!era);
    if (era) A.toast('Rete tolta: sei «in cantina». Il lavoro resta sul telefono.', 'warn', 3600);
  });

  // ===========================================================================
  // 8. AVVISI
  // ===========================================================================
  A.rotta('#/t/avvisi', 'tecnico', () => {
    preparaPagina();
    const lista = A.mieiAvvisi().slice(0, 60);
    const nuovi = lista.filter(a => !a.letto).length;
    const ic = { assegnazione: 'calendario', rapportino: 'verifica', nota: 'messaggio', messaggio: 'messaggio', materiale: 'carrello', ordine: 'carrello' };
    const contenuto = lista.length ? `
      ${nuovi ? `<div class="btns" style="justify-content:flex-end;margin-bottom:10px"><button type="button" class="btn pic" data-az="tec-avvisi-letti">${icona('spunta', 'p')} Segna tutti come letti</button></div>` : ''}
      <section class="tessera"><ul class="tec-avvisi">${lista.map(a => `<li><button type="button" class="${a.letto ? '' : 'nuovo'}" data-az="tec-avviso" data-id="${h(a.id)}"><span class="ic2">${icona(ic[a.tipo] || 'campanella', 'p')}</span><span class="cx1"><span>${h(a.testo)}</span><small>${h(A.quando(a.data))}</small></span>${a.link ? icona('destra', 'p') : ''}</button></li>`).join('')}</ul></section>`
      : `<div class="tec-vuoto">${A.vuoto('Nessun avviso', 'Qui arrivano i lavori nuovi, gli spostamenti e le risposte dell\'ufficio.', 'campanella')}</div>`;
    return guscio({ titolo: 'Avvisi', sotto: nuovi ? (nuovi === 1 ? '1 da leggere' : nuovi + ' da leggere') : 'Tutti letti', tab: 'avvisi', contenuto });
  });
  A.azione('tec-avviso', el => {
    let link = '';
    A.modifica(db => { const a = db.avvisi.find(x => x.id === el.dataset.id); if (a) { a.letto = true; link = a.link || ''; } });
    // Solo link dell'app del tecnico: un indirizzo dell'ufficio lo rimanderebbe comunque qui.
    if (link.indexOf('#/t/') === 0) A.vai(link); else A.render();
  });
  A.azione('tec-avvisi-letti', () => {
    const miei = new Set(A.mieiAvvisi().map(a => a.id));
    A.modifica(db => db.avvisi.forEach(a => { if (miei.has(a.id)) a.letto = true; }));
    A.render();
  });

  // ===========================================================================
  // 9. IO (profilo, furgone, installazione)
  // ===========================================================================
  let richiestaInstalla = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); richiestaInstalla = e; if ((location.hash || '').indexOf('#/t/profilo') === 0) A.render(); });
  window.addEventListener('appinstalled', () => { richiestaInstalla = null; A.toast('App installata sulla schermata Home', 'ok'); });
  const installata = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  A.rotta('#/t/profilo', 'tecnico', () => {
    preparaPagina();
    const u = io();
    const mag = A.magazzinoDiTecnico(u.id);
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    let furgone = '';
    if (mag) {
      const righe = A.DB.articoli.map(a => ({ a, q: A.giacenza(a.id, mag.id) })).filter(x => x.q !== 0)
        .sort((x, y) => (x.a.categoria || '').localeCompare(y.a.categoria || '') || x.a.nome.localeCompare(y.a.nome));
      let cat = null;
      furgone = righe.length ? `<ul class="tec-furgone">${righe.map(({ a, q }) => {
        const gr = a.categoria !== cat ? `<li class="gr">${h(a.categoria || 'Altro')}</li>` : ''; cat = a.categoria;
        const poco = q <= (a.unita === 'm' ? 5 : 2);
        return gr + `<li><div class="cx1"><span>${h(a.nome)}</span><small>${h(a.codice)} · ${h(a.marca)}</small></div>
          ${poco ? `<button type="button" class="btn pic" data-az="tec-matord" data-art="${h(a.id)}" aria-label="Segnala da ordinare: ${h(a.nome)}">${icona('carrello', 'p')}</button>` : ''}
          <div class="q${poco ? ' poco' : ''}">${A.num(q)} <small>${h(a.unita)}</small>${q < 0 ? '<small class="tec-da-contare">da contare</small>' : ''}</div></li>`;
      }).join('')}</ul>` : A.vuoto('Il furgone è vuoto', 'Nessun articolo registrato sul tuo furgone.', 'furgone');
    }
    const contenuto = `
      <section class="tessera"><div class="cp"><div class="tec-io"><span class="avatar" style="background:${h(u.colore || '')}">${h(A.iniziali(u.nome))}</span><div><b>${h(u.nome)}</b><span class="muto">Tecnico${u.squadra ? ' · ' + h(u.squadra) : ''}</span></div></div>
        <dl class="dl tec-dl" style="margin-top:14px"><dt>Telefono</dt><dd>${h(u.telefono || '—')}</dd><dt>Squadra</dt><dd>${h(u.squadra || '—')}</dd>${u.ultimoAccesso ? `<dt>Ultimo accesso</dt><dd>${h(A.quando(u.ultimoAccesso))}</dd>` : ''}</dl>
      </div></section>
      <div class="sez">Il mio furgone <span>${mag ? h(mag.nome.replace(/^Furgone\s+\S+\s+—\s+/, '')) : ''}</span></div>
      <section class="tessera">${mag ? furgone : `<div class="cp">${A.vuoto('Nessun furgone', 'Non hai un furgone assegnato: chiedi all\'ufficio.', 'furgone')}</div>`}</section>
      <p class="pic" style="margin:8px 4px 0">Quantità registrate: si aggiornano quando invii i rapportini. Il carrello segnala all'ufficio cosa ti sta finendo.</p>
      <div class="sez">Installa l'app sul telefono</div>
      <section class="tessera tec-installa"><div class="cp">
        ${installata() ? `<div class="avviso ok">${icona('spunta')}<div><b>L'app è già installata</b><br>La apri dall'icona IDRAL sulla schermata Home.</div></div>` : `
        <p>Con l'icona sulla schermata Home l'app si apre come le altre, a tutto schermo, e funziona anche senza rete.</p>
        ${richiestaInstalla ? `<button type="button" class="btn acc xl" style="margin-top:12px" data-az="tec-installa">${icona('scarica', 'g')} Installa</button>` : ''}
        <div class="os${ios ? ' tuo' : ''}"><b>${icona('telefono', 'p')} iPhone</b><ol><li>Apri questa pagina con <b>Safari</b></li><li>Tocca <b>Condividi</b> (il quadrato con la freccia)</li><li>Scegli <b>Aggiungi alla schermata Home</b></li></ol></div>
        <div class="os${!ios ? ' tuo' : ''}"><b>${icona('telefono', 'p')} Android</b><ol><li>Apri questa pagina con <b>Chrome</b></li><li>Tocca il <b>menu</b> (i tre puntini)</li><li>Scegli <b>Installa app</b> (o «Aggiungi a schermata Home»)</li></ol></div>`}
      </div></section>
      <div class="sez">Avvisi sul telefono</div>
      <section class="tessera"><div class="cp">
        <p>Per sapere subito quando l'ufficio ti assegna o sposta un lavoro.</p>
        <button type="button" class="btn largo" style="margin-top:10px" data-az="tec-notifiche">${icona('campanella')} ${'Notification' in window && Notification.permission === 'granted' ? 'Notifiche attive' : 'Attiva le notifiche'}</button>
      </div></section>
      <div class="spazio"></div>
      <button type="button" class="btn per xl" data-az="esci">${icona('esci', 'g')} Esci</button>
      <p class="pic cx" style="margin-top:14px">Demo: i dati restano in questo browser. <a href="#" data-az="demo-azzera">Riporta la demo all'inizio</a></p>`;
    return guscio({ titolo: 'Io', sotto: u.nome, tab: 'profilo', contenuto });
  });
  A.azione('tec-installa', async () => {
    if (!richiestaInstalla) return;
    richiestaInstalla.prompt();
    try { const r = await richiestaInstalla.userChoice; if (r && r.outcome === 'accepted') A.toast('Fatto: trovi IDRAL sulla schermata Home', 'ok'); } catch (_) { }
    richiestaInstalla = null; A.render();
  });
  A.azione('tec-notifiche', async () => {
    if (!('Notification' in window)) { A.toast('Questo browser non supporta le notifiche', 'warn'); return; }
    if (Notification.permission === 'granted') { A.toast('Le notifiche sono già attive', 'ok'); return; }
    try { const p = await Notification.requestPermission(); A.toast(p === 'granted' ? 'Notifiche attive' : 'Notifiche non autorizzate: le trovi comunque in Avvisi', p === 'granted' ? 'ok' : 'warn'); } catch (_) { }
    A.render();
  });
  A.azione('tec-finestra', () => { flush(); window.open(location.pathname + '#/accesso?cambia=1', '_blank', 'noopener'); });
})();
