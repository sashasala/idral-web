/* =============================================================================
   IDRAL — gestionale (demo) · il back-office GESTIONALE (titolare e ufficio)
   -----------------------------------------------------------------------------
   L'altra metà del «centro di controllo» di Andrea: clienti e macchine,
   preventivi, comunicazioni, materiale e magazzino, da fatturare, manutenzioni,
   statistiche, persone e impostazioni. Il lavoro di tutti i giorni (cruscotto,
   pianificazione, interventi, rapportini) sta in ufficio-lavori.js.

   Rotte: #/u/clienti · #/u/cliente/:id · #/u/preventivi · #/u/preventivo/:id
          (+ /stampa) · #/u/messaggi · #/u/messaggi/:id · #/u/materiale ·
          #/u/magazzino · #/u/articolo/:id · #/u/documenti · #/u/documento/:id
          (+ /stampa) · #/u/manutenzioni · #/u/statistiche · #/u/persone ·
          #/u/posta · #/u/registro · #/u/impostazioni
   Usa: A.apriNuovoIntervento (da ufficio-lavori.js).

   Regole che qui si vedono di più (prompt master OPERA v1.2):
   - qui si vedono prezzi, costi e margini: è il back-office. Il margine del
     preventivo si vede SOLO nell'editor, mai nel foglio che va al cliente;
   - OPERA non emette fatture: prepara il documento di vendita (pre-fattura) e
     l'export per il commercialista; la fattura vera torna come allegato;
   - niente ordini automatici ai fornitori: una lista d'ordine che Andrea manda;
   - la giacenza è la somma dei movimenti; i movimenti non si toccano mai;
   - nessuna classifica fra tecnici: le statistiche confrontano tipi di lavoro.
   ============================================================================= */
(function () {
  'use strict';
  const { h, icona } = A;

  // ---------------------------------------------------------------------------
  // Vocabolario del modulo
  // ---------------------------------------------------------------------------
  const TIPI_CLIENTE = { privato: ['Privato', 'grigio'], condominio: ['Condominio', 'blu'], azienda: ['Azienda', 'acc'] };
  const LISTINI = { base: 'Base (privati)', condomini: 'Condomini', aziende: 'Aziende' };
  const CATEGORIE_MACCHINA = ['caldaia', 'scaldabagno', 'pompa di calore', 'climatizzatore', 'trattamento acqua', 'circolatore', 'vaso di espansione', 'bruciatore', 'autoclave', 'altro'];
  const COMBUSTIBILI = { metano: 'Metano', gpl: 'GPL', gasolio: 'Gasolio', elettrico: 'Elettrico', pellet: 'Pellet', '': '—' };
  const TIPI_ALLEGATO = { fattura: ['Fattura', 'ok'], dico: ['DICO', 'blu'], libretto: ['Libretto', 'blu'], certificazione: ['Certificazione', 'acc'], altro: ['Altro', 'grigio'] };
  const URG_MAT = { normale: ['Normale', 'grigio'], urgente: ['Urgente', 'acc'], blocca_lavoro: ['Blocca il lavoro', 'dang'] };
  const STATI_MAT = { nuova: ['Da vedere', 'blu'], presa: ['Presa in carico', 'blu'], ordinata: ['Ordinata', 'acc'], arrivata: ['Arrivata', 'ok'], rifiutata: ['Non ordinata', 'grigio'] };
  const STATI_ORDINE = { nuovo: ['Nuovo', 'acc'], confermato: ['Confermato', 'blu'], in_preparazione: ['In preparazione', 'blu'], pronto: ['Pronto', 'ok'], consegnato: ['Consegnato', 'grigio'], annullato: ['Annullato', 'grigio'] };
  const PASSI_ORDINE = ['nuovo', 'confermato', 'in_preparazione', 'pronto', 'consegnato'];
  const STATI_DOC = { bozza: ['Bozza', 'grigio'], pronto: ['Pronto da esportare', 'blu'], esportato: ['Esportato', 'acc'], fatturato: ['Fatturato', 'ok'], annullato: ['Annullato', 'grigio'] };
  const REGIMI_IVA = ['IVA ordinaria 22%', 'IVA agevolata 10% (edilizia — da verificare)', 'Reverse charge', 'Split payment', 'Esente'];
  const TIPI_MOV = { carico: ['Carico', 'ok'], scarico: ['Scarico', 'grigio'], trasferimento: ['Trasferimento', 'blu'], rettifica: ['Rettifica', 'warn'], reso: ['Reso', 'acc'], inventario: ['Inventario', 'warn'] };
  const APERTI = ['da_pianificare', 'pianificato', 'in_viaggio', 'in_corso', 'sospeso'];
  const FATTI = ['completato', 'approvato', 'valorizzato', 'fatturato'];
  const MODALITA = { misura: 'A misura', corpo: 'A corpo', garanzia: 'In garanzia', contratto: 'A contratto' };
  const COLORI_TECNICO = ['#127EA3', '#EA6A0C', '#15704A', '#7B4FB5', '#B32020', '#0A4A6B', '#8A4A08', '#C2185B'];
  // Parole del mestiere per le password consegnate ai tecnici: si dettano al
  // telefono e si ricordano («caldaia-47»), a differenza di «x7#Qp2!».
  const PAROLE = ['caldaia', 'valvola', 'rubinetto', 'raccordo', 'sifone', 'pompa', 'flangia', 'collettore', 'termostato', 'bruciatore', 'radiatore', 'manometro', 'boiler', 'guarnizione', 'miscelatore', 'addolcitore'];

  // ---------------------------------------------------------------------------
  // Piccoli attrezzi
  // ---------------------------------------------------------------------------
  const cap = s => s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '';
  const taglia = (s, n) => { s = String(s || '').trim().replace(/\s+/g, ' '); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const telLink = t => 'tel:' + String(t || '').replace(/[^\d+]/g, '');
  const linkAssoluto = hash => location.origin + location.pathname + hash;
  /** Decimali con la virgola: e' quello che Excel italiano legge come numero. */
  const dec = n => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2).replace('.', ',');
  /** Numero da un campo: accetta «12,5» come «12.5» (in Italia si scrive cosi'). */
  const numDa = v => {
    let s = String(v === undefined || v === null ? '' : v).replace(/[\s€]/g, '');
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = parseFloat(s); return isFinite(n) ? n : 0;
  };
  /** Numero dentro un campo da modificare: niente punto delle migliaia («1.650» si rileggerebbe 1,65). */
  const numCampo = (n, d) => { const x = Math.round((Number(n) || 0) * Math.pow(10, d === undefined ? 3 : d)) / Math.pow(10, d === undefined ? 3 : d); return String(x).replace('.', ','); };
  const nomeCli = id => (A.cliente(id) || {}).nome || 'Cliente';
  const nomeUtente = id => (A.utenteDa(id) || {}).nome || '—';
  const pTipoCliente = t => { const x = TIPI_CLIENTE[t] || TIPI_CLIENTE.privato; return A.pastiglia(x[0], x[1], true); };
  const pDa = (voc, k) => { const x = voc[k] || [k || '—', 'grigio']; return A.pastiglia(x[0], x[1]); };
  const emailValida = e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e || '').trim());
  const plurale = (n, uno, tanti) => n + ' ' + (n === 1 ? uno : tanti);
  const nomeFileSicuro = s => String(s || 'file').replace(/[^\w\-àèéìòù ]+/gi, '_').replace(/\s+/g, '-').slice(0, 60);
  const nomeMacchina = m => m ? ((m.marca || '') + ' ' + (m.modello || '')).trim() || cap(m.categoria || 'macchina') : '';
  const dataIso = v => v ? String(v).slice(0, 10) : '';
  function nomeArticolo(a) { return a ? (a.marca && a.marca !== 'generica' ? a.marca + ' ' : '') + a.nome : ''; }

  /** Clienti che vedono l'area riservata: gli utenti «cliente» collegati a quella scheda. */
  function accessiDi(cid) { return A.DB.utenti.filter(u => u.ruolo === 'cliente' && (u.clienti || []).includes(cid)); }
  function areaAttiva(cid) { return accessiDi(cid).some(u => u.attivo !== false); }
  /** A chi scrivere: prima l'email di chi entra nell'area clienti, poi quella della scheda. */
  function emailCliente(cid) {
    const u = accessiDi(cid).find(x => x.attivo !== false && x.email);
    return u ? u.email : (A.cliente(cid) || {}).email || '';
  }
  /**
   * Avviso al cliente (area clienti) + email. Dentro A.modifica.
   * L'email parte se l'azienda tiene attive le notifiche email, oppure se e'
   * il canale stesso della consegna (un preventivo inviato, un invito).
   */
  function avvisaCliente(db, cid, testo, link, tipo, oggetto, corpo, sempreEmail) {
    const a = emailCliente(cid);
    const conEmail = a && (sempreEmail || db.azienda.notificheEmail !== false);
    const firma = '\n\nIDRAL — ' + (db.azienda.telefono || '') + ' · ' + (db.azienda.email || '');
    A.avvisa('cliente:' + cid, testo, link, { tipo, email: conEmail ? { a, oggetto, testo: corpo + (link ? '\n\n' + linkAssoluto(link) : '') + firma } : null });
  }
  function passaA(i, stato, nota) {
    const u = A.utente();
    i.stato = stato;
    const r = { stato, data: A.adesso(), utenteId: u ? u.id : null };
    if (nota) r.nota = nota;
    (i.storico = i.storico || []).push(r);
  }
  function parolaChiave() { return PAROLE[Math.floor(Math.random() * PAROLE.length)] + '-' + (10 + Math.floor(Math.random() * 90)); }

  // ---- query della pagina corrente: i filtri vivono nell'indirizzo, cosi'
  // «indietro» e un link mandato a Laura riaprono la stessa vista.
  function qCorrente() { return Object.fromEntries(new URLSearchParams(location.hash.split('?')[1] || '')); }
  function hashDa(q, base) {
    base = base || location.hash.split('?')[0];
    const p = new URLSearchParams();
    Object.keys(q).forEach(k => { if (q[k] !== '' && q[k] !== undefined && q[k] !== null) p.set(k, q[k]); });
    const s = p.toString(); return base + (s ? '?' + s : '');
  }
  let rifocus = null, timerCerca = null;
  A.azione('ges-cerca', el => {
    clearTimeout(timerCerca);
    timerCerca = setTimeout(() => {
      const q = qCorrente(); q[el.dataset.k || 'q'] = el.value.trim(); delete q.tutti;
      // replaceState: ogni lettera digitata non deve diventare un passo di «indietro».
      history.replaceState(null, '', hashDa(q));
      rifocus = el.id; A.render();
    }, 220);
  });
  A.azione('ges-filtro', el => {
    const q = qCorrente(); q[el.dataset.k] = el.type === 'checkbox' ? (el.checked ? '1' : '') : el.value; delete q.tutti;
    A.vai(hashDa(q));
  });
  function campoCerca(id, valore, segnaposto, k) {
    return `<div class="cerca">${icona('cerca')}<input id="${id}" type="search" placeholder="${h(segnaposto)}" value="${h(valore || '')}" data-digita="ges-cerca" data-k="${k || 'q'}" aria-label="${h(segnaposto)}"></div>`;
  }
  function selFiltro(k, valore, opzioni, etichetta) {
    return `<select data-cambia="ges-filtro" data-k="${k}" aria-label="${h(etichetta)}">${opzioni.map(([v, t]) => `<option value="${h(v)}"${String(valore || '') === String(v) ? ' selected' : ''}>${h(t)}</option>`).join('')}</select>`;
  }
  function segmenti(voci, attiva) {
    return `<nav class="ges-seg">${voci.map(([k, t, href, n]) => `<a href="${href}" class="${k === attiva ? 'on' : ''}"${k === attiva ? ' aria-current="true"' : ''}>${h(t)}${n ? ` <span class="ges-conta">${n}</span>` : ''}</a>`).join('')}</nav>`;
  }
  function schedeHtml(voci, attiva) {
    return `<nav class="schede">${voci.map(([k, t, href, n, acc]) => `<a href="${href}" class="${k === attiva ? 'on' : ''}"${k === attiva ? ' aria-current="page"' : ''}>${h(t)}${n !== undefined && n !== null && n !== '' ? ` <span class="ges-conta${acc ? ' acc' : ''}">${n}</span>` : ''}</a>`).join('')}</nav>`;
  }
  function kpi(o) {
    const tag = o.link ? 'a' : 'div';
    return `<${tag} class="tessera ges-kpi ${o.cl || ''}"${o.link ? ` href="${o.link}"` : ''}><div class="l">${o.ic ? icona(o.ic, 'p') : ''}${h(o.l)}</div><div class="v">${o.v}</div>${o.d ? `<div class="d">${o.d}</div>` : ''}</${tag}>`;
  }
  function vuotoTessera(titolo, testo, ic, extra) {
    return `<div class="tessera">${A.vuoto(titolo, testo, ic)}${extra ? `<p class="cx" style="padding:0 18px 24px">${extra}</p>` : ''}</div>`;
  }
  function erroreModale(msg) { const e = A.$('.velo .ges-err') || A.$('.ges-err'); if (e) e.innerHTML = msg ? `<div class="avviso dang" style="margin-top:6px">${icona('attenzione')}<div>${h(msg)}</div></div>` : ''; if (e && msg) e.scrollIntoView({ block: 'nearest' }); }
  const divErr = '<div class="ges-err" role="alert"></div>';

  // ---- copia negli appunti (con ripiego per i browser che non lo permettono)
  function copia(testo) {
    const ok = () => A.toast('Copiato', 'ok');
    const ripiego = () => {
      const t = document.createElement('textarea'); t.value = testo; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:-100px;opacity:0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); ok(); } catch (_) { A.toast('Seleziona il testo e copialo a mano', 'warn'); }
      t.remove();
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(testo).then(ok, ripiego); else ripiego();
  }
  // Un link dentro una modale: prima si chiude la modale, poi si cambia pagina.
  A.azione('ges-vai', el => { A.chiudiModale(); A.vai(el.dataset.h); });
  A.azione('ges-copia', el => {
    const sorg = el.dataset.da ? A.$(el.dataset.da) : null;
    copia(sorg ? (sorg.value !== undefined ? sorg.value : sorg.textContent) : (el.dataset.t || ''));
  });
  /** Un link (d'invito, d'accesso) da copiare: nella demo l'email non parte davvero. */
  function bloccoLink(link, nota) {
    const id = 'ges-l-' + Math.random().toString(36).slice(2, 8);
    return `<div class="ges-link"><input id="${id}" type="text" readonly value="${h(link)}" aria-label="Link"><button class="btn pri" type="button" data-az="ges-copia" data-da="#${id}">${icona('copia')} Copia</button></div>
      ${nota ? `<p class="pic" style="margin-top:8px">${nota}</p>` : ''}`;
  }

  /** Chi apre la pagina a cui un avviso rimanda l'ha letto: niente «segna come letto» da cliccare. */
  function segnaLettiQui() {
    const qui = location.hash.split('?')[0];
    const miei = A.mieiAvvisi().filter(a => !a.letto && a.link && a.link.split('?')[0] === qui).map(a => a.id);
    if (miei.length) A.modifica(db => db.avvisi.forEach(a => { if (miei.includes(a.id)) a.letto = true; }));
  }

  // ---------------------------------------------------------------------------
  // Stile del modulo (una volta sola)
  // ---------------------------------------------------------------------------
  function stile() {
    if (document.getElementById('stile-ges')) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="stile-ges">
/* --- comuni --- */
.ges-gr>.tessera+.tessera,.ges-kpis>.tessera+.tessera,.ges-carte>.tessera+.tessera,.ges-col>.tessera+.tessera{margin-top:0}
.ges-col{display:flex;flex-direction:column;gap:16px;min-width:0}
/* Un modulo in una griglia si allunga come la colonna accanto: il piede resta in fondo. */
.ges-gr>form.tessera{display:flex;flex-direction:column}.ges-gr>form.tessera>.cp{flex:1}
.btn.pic.ok,.btn.pic.pri,.btn.pic.acc{color:#fff}
.btn.pic.per{color:var(--dang)}
.ges-num{font-variant-numeric:tabular-nums}
.ges-cod{font-family:var(--mono);font-size:12.5px;color:var(--ink-3);font-weight:600;white-space:nowrap}
.ges-seg{display:inline-flex;background:var(--bg-2);border-radius:11px;padding:3px;gap:2px;max-width:100%;overflow-x:auto;scrollbar-width:none}
.ges-seg::-webkit-scrollbar{display:none}
.ges-seg a{padding:7px 13px;border-radius:8px;font-size:13.5px;font-weight:650;color:var(--ink-2);text-decoration:none!important;white-space:nowrap;display:inline-flex;align-items:center;gap:6px}
.ges-seg a.on{background:var(--surface);color:var(--brand-700);box-shadow:var(--sh-1)}
.ges-conta{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 6px;border-radius:99px;background:var(--bg-2);color:var(--ink-2);font-size:11.5px;font-weight:750;font-variant-numeric:tabular-nums}
.schede .on .ges-conta,.ges-seg .on .ges-conta{background:var(--brand-50);color:var(--brand-700)}
.ges-conta.acc,.schede .on .ges-conta.acc{background:var(--accent);color:#fff}
.bo .testa .btns .ges-nt{display:inline}
@media(max-width:760px){.bo .testa .btns .ges-nt{display:none}.bo .testa .btns .btn{padding:8px 10px}}
.ges-intesta{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px}
.ges-intesta p{color:var(--ink-3);font-size:14px;margin:0}
.ges-intesta h2{font-size:18px}
.ges-filtri{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
.ges-filtri .cerca{flex:1 1 240px;max-width:380px}
.ges-filtri .cerca input{width:100%}
.ges-filtri select{width:auto;min-width:0;flex:0 1 auto}
@media(max-width:600px){.ges-filtri .cerca{max-width:none;flex-basis:100%}.ges-filtri select{flex:1 1 140px;min-width:0}}
.ges-sez-t{font-size:11.5px;font-weight:750;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-3);margin:0 0 8px}
.ges-chip{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:7px;font-size:12px;font-weight:650;border:1px solid var(--line);background:var(--bg);color:var(--ink-2);line-height:1.5;white-space:nowrap}
.ges-chips{display:flex;gap:5px;flex-wrap:wrap;align-items:center}
.ges-dida{font-size:13px;color:var(--ink-2);padding:12px 18px;border-top:1px solid var(--line-2);background:var(--bg);border-radius:0 0 var(--r-l) var(--r-l)}
.ges-dida svg{color:var(--ink-3)}
.ges-err:empty{display:none}
.ges-link{display:flex;gap:8px}
.ges-link input{font-family:var(--mono);font-size:12.5px;min-width:0}
.ges-pre{white-space:pre-wrap;font-size:14px;line-height:1.55;background:var(--bg);border:1px solid var(--line-2);border-radius:10px;padding:12px 14px;overflow-wrap:anywhere}
.ges-muto-b{color:var(--ink-3);font-weight:500}
.ges-azr{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;align-items:center}
.ges-su{color:var(--ok);font-weight:700}
.ges-giu{color:var(--dang);font-weight:700}
/* KPI */
.ges-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;margin-bottom:18px}
.ges-kpi{padding:16px 18px;display:flex;flex-direction:column;color:inherit;text-decoration:none!important}
a.ges-kpi:hover{box-shadow:var(--sh-2)}
.ges-kpi .l{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:650;color:var(--ink-2)}
.ges-kpi .l svg{color:var(--brand-500)}
.ges-kpi .v{font-size:27px;font-weight:760;letter-spacing:-.025em;line-height:1.15;margin-top:8px}
.ges-kpi .v small{font-size:14px;font-weight:600;color:var(--ink-3);letter-spacing:0}
.ges-kpi .d{font-size:12.5px;color:var(--ink-3);margin-top:auto;padding-top:6px;line-height:1.4}
.ges-kpi .d b{color:var(--ink-2)}
.ges-kpi.evid{background:radial-gradient(360px 200px at 100% 0%,rgba(234,106,12,.2),transparent 65%),linear-gradient(150deg,var(--brand-800),var(--brand-600));border-color:transparent;color:#fff}
.ges-kpi.evid .l{color:rgba(255,255,255,.85)}.ges-kpi.evid .l svg{color:#FFB27A}
.ges-kpi.evid .d{color:rgba(255,255,255,.75)}.ges-kpi.evid .d b{color:#fff}
@media(max-width:760px){.ges-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.ges-kpi{padding:13px 14px}.ges-kpi .v{font-size:22px}.ges-kpi .l{font-size:12.5px}}
/* tabelle che su telefono diventano schede */
.tab td .t2,.ges-t2{font-size:12.5px;color:var(--ink-3);line-height:1.35}
.tab td.ges-nome{min-width:190px}
.tab td.ges-nome b{font-weight:650}
.tab tr.ges-da-leggere td{background:var(--brand-50)}
.tab tr.ges-spento td{opacity:.62}
.tab .ges-azr .btn{white-space:nowrap}
.tab td.ges-cb,.tab th.ges-cb{width:40px;padding-right:0}
@media(max-width:760px){
  table.ges-resp thead{display:none}
  table.ges-resp,table.ges-resp tbody,table.ges-resp tr{display:block;width:100%}
  table.ges-resp tr{padding:12px 16px;border-bottom:1px solid var(--line-2);position:relative}
  table.ges-resp tr:last-child{border-bottom:0}
  table.ges-resp td{display:block;border:0!important;padding:3px 0;text-align:right;min-width:0!important;white-space:normal;overflow-wrap:anywhere}
  table.ges-resp td::before{content:attr(data-l);float:left;margin-right:14px;color:var(--ink-3);font-size:12.5px;font-weight:600;text-align:left;line-height:1.9}
  table.ges-resp td::after{content:"";display:block;clear:both}
  table.ges-resp td.ges-prima{display:block;text-align:left;padding:0 0 6px}
  table.ges-resp td.ges-prima::before{display:none}
  table.ges-resp td.ges-vuota{display:none}
  table.ges-resp td.ges-az{display:block;text-align:left;padding-top:8px}
  table.ges-resp td.ges-az::before{display:none}
  table.ges-resp td.ges-az .ges-azr{justify-content:flex-start}
  table.ges-resp td.ges-cb{position:absolute;right:14px;top:12px;width:auto;padding:0}
  table.ges-resp td.ges-cb::before{display:none}
  table.ges-resp tr.ges-con-cb td.ges-prima{padding-right:34px}
  table.ges-resp tfoot tr{background:var(--bg)}
  table.ges-resp td.num{white-space:nowrap}
}
/* testata delle schede (cliente, preventivo, documento) */
.ges-testata .ges-t-su{padding:18px 22px}
.ges-t-1{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:6px}
.ges-t-num{font-family:var(--mono);font-size:13px;color:var(--ink-3);font-weight:600;margin-right:4px}
.ges-testata h2{font-size:24px;letter-spacing:-.02em;overflow-wrap:anywhere}
.ges-t-meta{display:flex;gap:6px 18px;flex-wrap:wrap;font-size:14px;color:var(--ink-2);margin-top:8px;align-items:center}
.ges-t-meta>*{display:inline-flex;gap:6px;align-items:center;min-width:0;overflow-wrap:anywhere}
.ges-t-meta svg{color:var(--ink-3)}
.ges-t-barra{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:12px 22px;border-top:1px solid var(--line-2);background:var(--bg);border-radius:0 0 var(--r-l) var(--r-l)}
.ges-t-cifre{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid var(--line-2)}
.ges-t-cifre>div{padding:12px 22px;border-right:1px solid var(--line-2);min-width:0}
.ges-t-cifre>div:last-child{border-right:0}
.ges-t-cifre small{display:block;font-size:12px;color:var(--ink-3);font-weight:600}
.ges-t-cifre b{font-size:18px;font-weight:720;letter-spacing:-.01em}
@media(max-width:760px){.ges-testata .ges-t-su{padding:16px}.ges-testata h2{font-size:20px}.ges-t-barra{padding:12px 16px}.ges-t-cifre{grid-template-columns:repeat(2,minmax(0,1fr))}.ges-t-cifre>div{padding:10px 16px;border-bottom:1px solid var(--line-2)}.ges-t-cifre>div:nth-child(2n){border-right:0}.ges-t-cifre b{font-size:16px}}
.ges-scheda{margin-top:16px}
@media(max-width:600px){.ges-t-barra .btns{width:100%}.ges-t-barra .btns .btn{flex:1 1 auto;white-space:normal;text-align:center}}
/* carte (sedi, fornitori, accessi) */
.ges-carte{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(330px,100%),1fr));gap:14px}
.ges-carta{display:flex;flex-direction:column}
.ges-carta .cp{flex:1;display:flex;flex-direction:column;gap:10px}
.ges-carta .ges-piede{display:flex;gap:6px;flex-wrap:wrap;padding:12px 18px;border-top:1px solid var(--line-2);background:var(--bg);border-radius:0 0 var(--r-l) var(--r-l)}
.ges-riga-i{display:flex;gap:9px;align-items:flex-start;font-size:14px;line-height:1.45;min-width:0}
.ges-riga-i>svg{margin-top:2px;color:var(--ink-3)}
.ges-riga-i>div{min-width:0;overflow-wrap:anywhere}
/* cronologia (fascicolo, eventi) */
.ges-linea{list-style:none}
.ges-linea>li{display:flex;gap:12px;padding:11px 18px;border-bottom:1px solid var(--line-2);align-items:flex-start}
.ges-linea>li:last-child{border-bottom:0}
.ges-linea .ges-ic{width:34px;height:34px;flex:0 0 34px;border-radius:10px;display:grid;place-items:center;background:var(--brand-50);color:var(--brand-600)}
.ges-linea .ges-ic.acc{background:var(--accent-50);color:var(--accent-dark)}
.ges-linea .ges-ic.ok{background:var(--ok-50);color:var(--ok)}
.ges-linea .ges-ic.dang{background:var(--dang-50);color:var(--dang)}
.ges-linea .ges-ic.grigio{background:var(--bg-2);color:var(--ink-3)}
.ges-linea .cx1{flex:1;min-width:0}
.ges-linea .t1{font-weight:650;font-size:14.5px;overflow-wrap:anywhere}
.ges-linea .t1 a{color:inherit}
.ges-linea .t1 a:hover{color:var(--brand-600)}
.ges-linea .t2{font-size:13px;color:var(--ink-3);overflow-wrap:anywhere}
.ges-linea .ges-q{font-size:12.5px;color:var(--ink-3);white-space:nowrap;text-align:right}
.ges-mese{font-size:11.5px;font-weight:750;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-3);padding:12px 18px 6px;background:var(--bg);border-bottom:1px solid var(--line-2)}
.ges-eventi{list-style:none;position:relative;margin-left:4px}
.ges-eventi li{position:relative;padding:0 0 14px 22px;font-size:13.5px}
.ges-eventi li::before{content:"";position:absolute;left:0;top:5px;width:10px;height:10px;border-radius:50%;border:2.5px solid var(--brand-500);background:var(--surface)}
.ges-eventi li::after{content:"";position:absolute;left:5.5px;top:18px;bottom:0;width:1.5px;background:var(--line-2)}
.ges-eventi li:last-child::after{display:none}
.ges-eventi li.ok::before{background:var(--ok);border-color:var(--ok)}
.ges-eventi li.dang::before{background:var(--dang);border-color:var(--dang)}
.ges-eventi li.acc::before{border-color:var(--accent)}
.ges-eventi b{font-weight:680}
.ges-eventi .t2{font-size:12.5px;color:var(--ink-3)}
.ges-impronta{font-family:var(--mono);font-size:10.5px;color:var(--ink-3);overflow-wrap:anywhere;margin-top:3px}
/* moduli a due colonne nelle schede */
.ges-form-g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px}
.ges-form-g .tutta{grid-column:1/-1}
@media(max-width:600px){.ges-form-g{grid-template-columns:1fr}}
.ges-scelte-tipo .scelta span{min-height:40px;padding:7px 13px}
.ges-cb-lista{max-height:240px;overflow-y:auto;border:1.5px solid var(--line);border-radius:10px;padding:4px 10px}
.ges-cb-lista .spunta{padding:7px 0;border-bottom:1px solid var(--line-2)}
.ges-cb-lista .spunta:last-child{border-bottom:0}
/* editor del preventivo */
.ges-righe{border-bottom:1px solid var(--line-2)}
.ges-riga{display:grid;grid-template-columns:30px minmax(0,1fr) 108px 34px;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line-2);align-items:start}
.ges-riga:last-child{border-bottom:0}
.ges-riga.ro{grid-template-columns:0 minmax(0,1fr) 120px;gap:0 12px}
.ges-riga.nota{background:var(--bg)}
.ges-riga.opz{box-shadow:inset 3px 0 0 var(--accent);background:var(--accent-50)}
.ges-r-sposta{display:flex;flex-direction:column;gap:3px;padding-top:3px}
.ges-r-sposta button{width:28px;height:20px;border:1px solid var(--line);border-radius:6px;background:var(--surface);cursor:pointer;display:grid;place-items:center;color:var(--ink-3);padding:0}
.ges-r-sposta button:hover{border-color:var(--brand-500);color:var(--brand-700)}
.ges-r-sposta button:disabled{opacity:.3;cursor:default}
.ges-r-sposta button:first-child svg{transform:rotate(180deg)}
.ges-r-sposta svg{width:13px;height:13px}
.ges-r-corpo{min-width:0}
.ges-r-l1{display:flex;gap:8px;align-items:flex-start}
.ges-r-l1 select{width:124px;flex:0 0 124px;min-height:38px;padding:6px 8px;font-size:13.5px}
.ges-r-l1 input,.ges-r-l1 textarea{flex:1;min-width:0;min-height:38px;font-weight:600}
.ges-r-l1 textarea{font-weight:500;font-style:italic;min-height:60px}
.ges-r-l2{display:flex;flex-wrap:wrap;gap:8px 12px;margin-top:8px;align-items:center}
.ges-r-l2 label{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:650;color:var(--ink-3);white-space:nowrap}
.ges-r-l2 input[type=text],.ges-r-l2 select{min-height:34px;padding:5px 8px;border-radius:8px;font-size:14px;font-variant-numeric:tabular-nums;color:var(--ink)}
.ges-r-l2 .w-q{width:70px}.ges-r-l2 .w-u{width:58px}.ges-r-l2 .w-p{width:92px}.ges-r-l2 .w-s{width:56px}.ges-r-l2 select{width:74px}
.ges-r-l2 .ges-r-opz{color:var(--accent-dark)}
.ges-r-costo{font-size:12px;color:var(--ink-3);flex-basis:100%}
.ges-r-desc{font-weight:600;font-size:14.5px}
.ges-r-nota{font-style:italic;color:var(--ink-2);font-size:14px;display:flex;gap:8px}
.ges-r-imp{text-align:right;font-weight:720;font-variant-numeric:tabular-nums;padding-top:9px;white-space:nowrap;font-size:14.5px}
.ges-riga.ro .ges-r-imp{padding-top:2px}
.ges-r-imp small{display:block;font-weight:600;font-size:11px;color:var(--accent-dark);white-space:normal;line-height:1.3;margin-top:2px}
.ges-r-x{width:34px;height:34px;border:1px solid transparent;border-radius:8px;background:none;color:var(--ink-3);cursor:pointer;display:grid;place-items:center;margin-top:2px}
.ges-r-x:hover{background:var(--dang-50);color:var(--dang);border-color:var(--dang-line)}
@media(max-width:600px){
  .ges-riga{grid-template-columns:30px minmax(0,1fr);padding:12px;gap:8px 10px}
  .ges-riga .ges-r-imp{grid-column:2;grid-row:2;text-align:left;padding-top:0}
  .ges-riga .ges-r-x{grid-column:1;grid-row:2;width:30px;height:30px;margin:0}
  .ges-riga.ro{grid-template-columns:minmax(0,1fr) auto}
  .ges-riga.ro>div:first-child{display:none}
  .ges-riga.ro .ges-r-imp{grid-column:auto;grid-row:auto;text-align:right}
  .ges-r-l1{flex-direction:column}.ges-r-l1 select{width:100%;flex:none}.ges-r-l1 input,.ges-r-l1 textarea{width:100%}
}
.ges-agg{display:flex;gap:8px;flex-wrap:wrap;padding:12px 16px;background:var(--bg);border-bottom:1px solid var(--line-2)}
.ges-totali{padding:14px 18px;display:flex;flex-direction:column;gap:5px;font-size:14px}
#ges-prv-totali{max-width:380px;margin-left:auto}
.ges-tot-r{display:flex;justify-content:space-between;gap:14px;font-variant-numeric:tabular-nums}
.ges-tot-r>:last-child{text-align:right;white-space:nowrap}
.ges-tot-r.ges-t2{font-size:13px;color:var(--ink-3)}
.ges-tot-f{border-top:1.5px solid var(--line);padding-top:7px;margin-top:3px;font-size:15.5px}
.ges-tot-f b{font-weight:780}
.ges-tot-opz{font-size:13px;color:var(--accent-dark);font-weight:600;margin-top:4px}
.ges-riep .ges-riep-v{font-size:34px;font-weight:780;letter-spacing:-.03em;line-height:1.15;margin:2px 0}
.ges-mini-chat{display:flex;flex-direction:column;gap:8px;background:var(--bg);border-radius:12px;padding:10px}
.ges-mini-chat .bolla{max-width:92%;font-size:13.5px;padding:8px 11px}
/* catalogo */
.ges-cat{max-height:52vh;overflow-y:auto;border:1px solid var(--line-2);border-radius:12px}
.ges-cat-g{font-size:11px;font-weight:750;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);padding:9px 12px 5px;background:var(--bg);position:sticky;top:0;z-index:1}
.ges-cat-a{display:grid;grid-template-columns:92px minmax(0,1fr) auto 20px;gap:10px;align-items:center;width:100%;text-align:left;padding:9px 12px;border:0;border-bottom:1px solid var(--line-2);background:var(--surface);cursor:pointer}
.ges-cat-a:hover{background:var(--brand-50)}
.ges-cat-a .n{min-width:0}.ges-cat-a .n b{display:block;font-weight:620;font-size:14px}.ges-cat-a .n small{font-size:12px;color:var(--ink-3)}
.ges-cat-a .p{font-weight:700;font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}.ges-cat-a .p small{font-weight:500;color:var(--ink-3)}
.ges-cat-a>svg{color:var(--brand-600)}
/* comunicazioni */
.ges-note{list-style:none}
.ges-note>li{display:flex;gap:14px;padding:16px 18px;border-bottom:1px solid var(--line-2);align-items:flex-start}
.ges-note>li:last-child{border-bottom:0}
.ges-note>li.nuova{background:var(--brand-50)}
.ges-note>li.urg{box-shadow:inset 3px 0 0 var(--dang)}
.ges-note .cx1{flex:1;min-width:0}
.ges-nota-t{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.ges-nota-testo{font-size:14.5px;line-height:1.5;margin-top:4px;white-space:pre-wrap;overflow-wrap:anywhere}
.ges-risp{display:flex;gap:8px;margin-top:10px;padding:10px 12px;border-radius:10px;background:var(--surface);border:1px solid var(--line);font-size:13.5px}
.ges-risp svg{color:var(--ok);margin-top:2px;transform:scaleX(-1)}
.ges-msg-g{display:grid;grid-template-columns:minmax(260px,340px) minmax(0,1fr);gap:16px;align-items:start}
.ges-msg-g>.tessera+.tessera{margin-top:0}
.ges-conv-cerca{padding:12px;border-bottom:1px solid var(--line-2)}
.ges-conv{list-style:none;max-height:calc(100vh - 250px);overflow-y:auto}
.ges-conv a{display:flex;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line-2);color:inherit;text-decoration:none!important;align-items:flex-start}
.ges-conv li:last-child a{border-bottom:0}
.ges-conv a:hover{background:var(--bg)}
.ges-conv a.on{background:var(--brand-50);box-shadow:inset 3px 0 0 var(--brand-600)}
.ges-conv .cx1{flex:1;min-width:0;display:flex;flex-direction:column}
.ges-conv .r1{display:flex;justify-content:space-between;gap:8px}
.ges-conv .r1 b{font-size:14px;font-weight:620;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ges-conv .r1 small{font-size:11.5px;color:var(--ink-3);white-space:nowrap}
.ges-conv .r2{font-size:13px;font-weight:600;color:var(--ink-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ges-conv .r3{font-size:12.5px;color:var(--ink-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ges-conv a.nuova .r1 b,.ges-conv a.nuova .r2{color:var(--ink);font-weight:760}
.ges-punto{width:9px;height:9px;border-radius:50%;background:var(--accent);flex:0 0 9px;margin-top:6px}
.ges-chatbox .chat{max-height:calc(100vh - 390px);min-height:260px}
.ges-chat-g{align-self:center;font-size:11.5px;font-weight:700;color:var(--ink-3);background:var(--surface);border:1px solid var(--line-2);border-radius:99px;padding:2px 10px;margin:4px 0}
.ges-indietro{display:none;font-size:13px;margin-bottom:4px}
.ges-conv-vuota{min-height:320px;display:grid;place-items:center}
@media(max-width:900px){.ges-msg-g{grid-template-columns:minmax(0,1fr)}.ges-msg-g.aperta .ges-conv-el{display:none}.ges-msg-g:not(.aperta) .ges-conv-vuota{display:none}.ges-indietro{display:inline-flex;gap:4px;align-items:center}.ges-conv{max-height:none}.ges-chatbox .chat{max-height:60vh}}
@media(max-width:600px){.scrivi .ges-nt2{display:none}.ges-note>li{padding:14px}.ges-note .avatar.g{width:34px;height:34px;flex-basis:34px;font-size:12px}}
/* materiale */
tr.ges-blocca td:first-child{box-shadow:inset 3px 0 0 var(--dang)}
@media(max-width:760px){table.ges-resp tr.ges-blocca{box-shadow:inset 3px 0 0 var(--dang)}table.ges-resp tr.ges-blocca td:first-child{box-shadow:none}}
select.ges-sel-pic{min-height:32px;padding:4px 8px;font-size:13px;width:auto;max-width:230px;border-radius:8px}
input.ges-inp-num{width:84px;min-height:34px;padding:5px 8px;text-align:right;font-variant-numeric:tabular-nums;border-radius:8px}
.ges-lo{border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:12px}
.ges-lo-t{display:flex;justify-content:space-between;align-items:baseline;gap:6px 10px;flex-wrap:wrap;margin-bottom:8px}
.ges-lo-t h3{display:flex;gap:8px;align-items:center}
textarea.ges-lo-testo{font-family:var(--mono);font-size:12.5px;background:var(--bg);min-height:0}
.ges-lo-r{margin-left:18px;font-size:14px}
/* magazzino */
.ges-tab-mag td.ges-prima{min-width:250px}
.ges-disp{font-size:17px;font-weight:760;font-variant-numeric:tabular-nums}
.ges-disp.zero{color:var(--ink-3)}
.ges-disp.neg{color:var(--dang)}
.ges-mv-info{font-size:13.5px;color:var(--ink-2);background:var(--bg);border:1px solid var(--line-2);border-radius:10px;padding:8px 12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.ges-mv-info:empty{display:none}
.ges-mv-info svg{color:var(--brand-500)}
/* da fatturare */
.ges-frase{margin-bottom:16px}
.ges-df .tt{flex-wrap:wrap}
.ges-df-cli{display:flex;align-items:center;gap:10px;cursor:pointer;min-width:0}
.ges-df-cli>span{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.ges-df-cli a{color:inherit}
.ges-df-tot{font-size:13.5px;color:var(--ink-2);white-space:nowrap}
.ges-df-tot b{font-variant-numeric:tabular-nums;color:var(--ink)}
.ges-df-barra{position:sticky;bottom:12px;z-index:20;margin-top:16px;display:flex;gap:12px;align-items:center;padding:12px 16px;border-radius:14px;background:var(--surface);border:1px solid var(--line);box-shadow:var(--sh-2);flex-wrap:wrap}
.ges-df-barra .cx1{flex:1 1 220px;min-width:0;font-size:14px}
@media(max-width:600px){.ges-df-barra .btn{width:100%}}
.ges-riep-df{list-style:none;border:1px solid var(--line-2);border-radius:12px;margin-bottom:16px}
.ges-riep-df li{display:flex;gap:12px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--line-2)}
.ges-riep-df li:last-child{border-bottom:0}
.ges-riep-df .cx1{flex:1;min-width:0;display:flex;flex-direction:column}
.ges-riep-df .t2{font-size:12.5px;color:var(--ink-3)}
.ges-riga.doc{grid-template-columns:minmax(0,1fr) 108px 34px}
@media(min-width:1000px){.ges-riga.doc{padding:8px 16px}.ges-riga.doc .ges-r-corpo{display:flex;gap:12px;align-items:center}.ges-riga.doc .ges-r-l1{flex:1;min-width:0}.ges-riga.doc .ges-r-l2{margin-top:0;flex-wrap:nowrap}.ges-riga.doc .ges-r-imp{padding-top:9px}}
.ges-doc-gr{font-size:12.5px;font-weight:700;color:var(--ink-2);background:var(--bg);padding:8px 16px;border-bottom:1px solid var(--line-2)}
@media(max-width:600px){.ges-riga.doc{grid-template-columns:minmax(0,1fr) 34px}.ges-riga.doc .ges-r-imp{grid-column:1;grid-row:2}.ges-riga.doc .ges-r-x{grid-column:2;grid-row:1}}
/* statistiche — palette categoriale validata con lo strumento della skill dataviz (sfondo bianco):
   i colori delle serie vivono solo qui, come variabili, nello stesso ordine fisso. */
.ges-stat{--ges-s1:var(--brand-500);--ges-s2:var(--accent);--ges-s3:#1BAF7A;--ges-s4:#EDA100;--ges-s5:#E87BA4;--ges-s6:#4A3AA7}
.ges-viz{position:relative}
.ges-viz svg{display:block;overflow:visible}
.ges-g text{font-family:var(--font);font-variant-numeric:tabular-nums}
.ges-g .ges-ax{fill:var(--ink-3);font-size:11px}
.ges-g .ges-ax-c{fill:var(--ink-2);font-weight:650}
.ges-g .ges-gl{stroke:var(--line-2);stroke-width:1}
.ges-g .ges-base{stroke:var(--line);stroke-width:1}
.ges-g .ges-val{fill:var(--ink);font-size:11.5px;font-weight:700}
.ges-g .ges-nm{fill:var(--ink-2);font-size:12.5px;font-weight:600}
.ges-g .ges-col{pointer-events:none;transition:opacity .12s}
.ges-g .ges-corr{opacity:.5}
.ges-g .ges-hit{fill:transparent;outline:none}
.ges-g .ges-hit:hover,.ges-g .ges-hit:focus-visible{fill:var(--brand-50)}
.ges-hov .ges-col{opacity:.45}
.ges-hov .ges-col.ges-su{opacity:1}
.ges-hov .ges-col.ges-corr.ges-su{opacity:.6}
.ges-tip{position:absolute;z-index:5;pointer-events:none;display:none;background:var(--surface);border:1px solid var(--line);border-radius:10px;box-shadow:var(--sh-2);padding:8px 11px;font-size:12.5px;min-width:150px;max-width:260px}
.ges-tip-t{font-weight:700;color:var(--ink-2);margin-bottom:4px}
.ges-tip-r{display:flex;align-items:center;gap:8px;padding:1px 0}
.ges-tip-r i{width:12px;height:3px;border-radius:2px;flex:0 0 12px}
.ges-tip-r b{font-variant-numeric:tabular-nums;color:var(--ink);font-size:13px}
.ges-tip-r span{color:var(--ink-3)}
.ges-numeri{margin-top:10px}
.ges-numeri summary{cursor:pointer;font-size:12.5px;color:var(--ink-3);font-weight:600}
.ges-numeri table{margin-top:8px;font-size:13px}
.ges-numeri .tab td,.ges-numeri .tab th{padding:6px 10px}
.ges-g-dida{font-size:12.5px;color:var(--ink-3);margin:-4px 0 10px}
.ges-stat-filtri{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin:30px 0 16px;padding-top:20px;border-top:1px solid var(--line)}
.ges-stat-filtri p,.ges-stat .ges-intesta p{color:var(--ink-3);font-size:14px}
.ges-mini-kpi{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:16px}
.ges-mini-kpi small{display:block;font-size:12px;color:var(--ink-3);font-weight:600}
.ges-mini-kpi b{font-size:22px;font-weight:760;letter-spacing:-.02em}
@media(max-width:600px){.ges-mini-kpi{grid-template-columns:repeat(2,minmax(0,1fr))}}
.ges-metro-t{display:flex;justify-content:space-between;gap:10px;font-size:13.5px;color:var(--ink-2);margin-bottom:6px;align-items:baseline}
.ges-metro-t b{font-size:20px;color:var(--ink)}
.ges-metro{height:10px;border-radius:99px;background:var(--brand-100);overflow:hidden}
.ges-metro i{display:block;height:100%;background:var(--brand-500);border-radius:99px}
/* persone */
.ges-persona{display:flex;gap:10px;align-items:center}
.ges-tab-per td.ges-prima{min-width:200px}
.ges-tab-per td.ges-az{width:1%;min-width:250px}
.ges-persona>div{min-width:0}
.ges-colori .scelta span{min-height:40px;padding:8px 10px}
.ges-colori .scelta span i{display:block;width:22px;height:22px;border-radius:50%;background:var(--c)}
.ges-si{color:var(--ok);font-weight:650;display:inline-flex;gap:4px;align-items:center;white-space:nowrap}
.ges-parz{color:var(--ink-2);font-size:13px}
.ges-permessi td{vertical-align:top}
.ges-permessi td:first-child{min-width:190px}
/* foglio stampabile dentro il back-office: sul telefono scorre dentro il foglio, non la pagina */
@media(max-width:760px){.ges-stampa .foglio{padding:22px 16px;overflow-x:auto;font-size:12.5px}.ges-stampa .foglio .intesta{flex-direction:column}.ges-stampa .foglio .intesta>div:last-child{text-align:left!important}.ges-stampa .foglio .totali{width:100%}}
@media(max-width:600px){.ges-cat-a{grid-template-columns:minmax(0,1fr) auto 18px}.ges-cat-a .ges-cod{display:none}}
</style>`);
  }
  /** Guscio + stile: tutte le pagine del modulo passano da qui. */
  function pagina(o) { stile(); return A.guscioUfficio(o); }
  /** Rotta del back-office con il ritorno del fuoco sul campo di ricerca dopo il ridisegno. */
  function rotta(schema, fn) {
    A.rotta(schema, 'ufficio', par => {
      const out = fn(par);
      if (out === false) return false;
      const html = typeof out === 'string' ? out : out.html;
      return {
        html, dopo: () => {
          if (out && out.dopo) out.dopo();
          if (rifocus) { const e = document.getElementById(rifocus); rifocus = null; if (e) { e.focus(); const n = e.value.length; try { e.setSelectionRange(n, n); } catch (_) { } } }
        }
      };
    });
  }
  function nonTrovato(attivo, titolo, briciole, testo, indietro) {
    return pagina({ attivo, titolo, briciole, contenuto: vuotoTessera(titolo, testo || 'Forse è stato rimosso, oppure il link è sbagliato.', 'cerca', `<a class="btn" href="${indietro[1]}">${h(indietro[0])}</a>`) });
  }
  /** Solo il titolare: persone, impostazioni, registro. L'ufficio vede un messaggio chiaro. */
  function soloTitolare(permesso, attivo, titolo) {
    if (A.puo(permesso)) return null;
    return pagina({ attivo, titolo, contenuto: vuotoTessera('Questa parte è riservata al titolare', 'Persone e accessi, impostazioni e registro attività li gestisce Andrea. Se ti serve qualcosa, chiedi a lui.', 'lucchetto', '<a class="btn" href="#/u/cruscotto">Torna al cruscotto</a>') });
  }

  // ===========================================================================
  // 1. CLIENTI — elenco, nuovo cliente, import ed export CSV
  // ===========================================================================
  /** Numeri di ogni cliente in una passata sola: 17 clienti x 400 interventi. */
  function numeriClienti() {
    const oggi = A.oggi(); const out = {};
    A.DB.interventi.forEach(i => {
      if (i.stato === 'annullato') return;
      const o = out[i.clienteId] = out[i.clienteId] || { n: 0, ultimo: null, prossimo: null };
      o.n++;
      if (i.data && i.data <= oggi && FATTI.includes(i.stato) && (!o.ultimo || i.data > o.ultimo)) o.ultimo = i.data;
      if (i.data && i.data > oggi && APERTI.includes(i.stato) && (!o.prossimo || i.data < o.prossimo)) o.prossimo = i.data;
    });
    return out;
  }
  function testoCliente(c) {
    return norm([c.nome, c.referente, c.email, c.telefono, c.cf, c.piva, (c.tag || []).join(' '), A.sediDi(c.id).map(s => [s.indirizzo, s.citta, s.cap].join(' ')).join(' ')].join(' '));
  }
  function filtraClienti(q) {
    const parole = norm(q.q).split(/\s+/).filter(Boolean);
    const tn = String(q.q || '').replace(/[^\d]/g, '');
    return A.DB.clienti.filter(c => {
      if (q.tipo && c.tipo !== q.tipo) return false;
      if (q.tag && !(c.tag || []).includes(q.tag)) return false;
      if (q.area === 'si' && !areaAttiva(c.id)) return false;
      if (q.area === 'no' && areaAttiva(c.id)) return false;
      if (parole.length) {
        const t = testoCliente(c);
        if (!parole.every(p => t.includes(p)) && !(tn.length >= 4 && A.normTel(c.telefono).includes(tn))) return false;
      }
      return true;
    });
  }
  /** Ha gia' usato l'area (o ha una password sua): l'invito non e' piu' «in attesa». */
  function usaArea(u) { return !!(u.ultimoAccesso || u.invitoAccettato || (u.password && !/^pw_/.test(u.password))); }
  function statoArea(cid) {
    const acc = accessiDi(cid);
    if (!acc.length) return '<span class="muto">—</span>';
    if (!acc.some(u => u.attivo !== false)) return A.pastiglia('Disattivata', 'grigio');
    const usata = acc.some(u => u.attivo !== false && usaArea(u));
    return usata ? A.pastiglia('Attiva', 'ok') : A.pastiglia('Invito inviato', 'blu');
  }

  function paginaClienti(par) {
    const q = par.q; const db = A.DB;
    const num = numeriClienti();
    const ord = ['nome', 'recenti', 'interventi'].includes(q.ord) ? q.ord : 'nome';
    const lista = filtraClienti(q).sort((a, b) => {
      if (ord === 'recenti') return String((num[b.id] || {}).ultimo || '').localeCompare(String((num[a.id] || {}).ultimo || '')) || a.nome.localeCompare(b.nome);
      if (ord === 'interventi') return ((num[b.id] || {}).n || 0) - ((num[a.id] || {}).n || 0) || a.nome.localeCompare(b.nome);
      return a.nome.localeCompare(b.nome, 'it');
    });
    const tag = Array.from(new Set(db.clienti.flatMap(c => c.tag || []))).sort();
    const conFiltri = q.q || q.tipo || q.tag || q.area;
    const filtri = `<div class="ges-filtri">
      ${campoCerca('ges-cli-cerca', q.q, 'Cerca nome, referente, email, telefono, via…')}
      ${selFiltro('tipo', q.tipo, [['', 'Tutti i tipi'], ['privato', 'Privati'], ['condominio', 'Condomini'], ['azienda', 'Aziende']], 'Tipo di cliente')}
      ${tag.length ? selFiltro('tag', q.tag, [['', 'Tutte le etichette']].concat(tag.map(t => [t, t])), 'Etichetta') : ''}
      ${selFiltro('area', q.area, [['', 'Area clienti: tutti'], ['si', 'Con area clienti attiva'], ['no', 'Senza area clienti']], 'Area clienti')}
      ${selFiltro('ord', ord === 'nome' ? '' : ord, [['', 'Ordina per nome'], ['recenti', 'Ultimo intervento'], ['interventi', 'Più interventi']], 'Ordine')}
      ${conFiltri ? `<a class="btn vuoto pic" href="#/u/clienti">${icona('x', 'p')} Togli i filtri</a>` : ''}
    </div>`;
    const riga = c => {
      const n = num[c.id] || { n: 0 }; const s = A.sediDi(c.id)[0];
      return `<tr class="clic" data-az="ges-cli-apri" data-id="${h(c.id)}">
        <td class="ges-nome ges-prima"><a href="#/u/cliente/${h(c.id)}" style="color:inherit"><b>${h(c.nome)}</b></a> ${pTipoCliente(c.tipo)}
          <div class="t2">${h(s ? A.indirizzo(s) : 'nessun indirizzo')}${c.referente ? ' · ' + h(c.referente) : ''}</div>
          ${(c.tag || []).length ? `<div class="ges-chips" style="margin-top:4px">${c.tag.map(t => `<span class="ges-chip">${icona('etichetta', 'p')}${h(t)}</span>`).join('')}</div>` : ''}</td>
        <td data-l="Contatti">${c.telefono ? `<div class="ges-num">${h(c.telefono)}</div>` : ''}${c.email ? `<div class="t2">${h(c.email)}</div>` : ''}${!c.telefono && !c.email ? '<span class="muto">—</span>' : ''}</td>
        <td data-l="Interventi" class="num">${n.n || '<span class="muto">0</span>'}</td>
        <td data-l="Ultimo intervento" class="num">${n.ultimo ? h(A.data(n.ultimo)) : '<span class="muto">—</span>'}${n.prossimo ? `<div class="t2">prossimo ${h(A.dataBreve(n.prossimo))}</div>` : ''}</td>
        <td data-l="Area clienti">${statoArea(c.id)}</td>
      </tr>`;
    };
    const tabella = lista.length ? `<div class="tessera"><div class="tab-w"><table class="tab ges-resp"><thead><tr><th>Cliente</th><th>Contatti</th><th class="num">Interventi</th><th class="num">Ultimo intervento</th><th>Area clienti</th></tr></thead><tbody>${lista.map(riga).join('')}</tbody></table></div></div>`
      : vuotoTessera(conFiltri ? 'Nessun cliente trovato' : 'Ancora nessun cliente', conFiltri ? 'Prova con meno parole o togli i filtri.' : 'Aggiungi il primo cliente oppure importa l\'elenco da un file CSV.', conFiltri ? 'cerca' : 'edificio');
    const tot = { privato: 0, condominio: 0, azienda: 0 }; db.clienti.forEach(c => { tot[c.tipo] = (tot[c.tipo] || 0) + 1; });
    const contenuto = `<div class="ges-intesta"><p>${plurale(lista.length, 'cliente', 'clienti')}${conFiltri ? ' trovati su ' + db.clienti.length : ''} · ${tot.privato} privati, ${tot.condominio} condomini, ${tot.azienda} aziende</p>
        <div class="btns"><button class="btn" type="button" data-az="ges-cli-importa">${icona('carica')} Importa da CSV</button><button class="btn" type="button" data-az="ges-cli-csv">${icona('scarica')} Esporta CSV</button></div></div>
      ${filtri}${tabella}`;
    return pagina({ attivo: 'clienti', titolo: 'Clienti', briciole: [['Clienti', '#/u/clienti']], azioni: `<button class="btn acc" type="button" data-az="ges-cli-nuovo">${icona('piu')}<span class="ges-nt">Nuovo cliente</span></button>`, contenuto });
  }
  A.azione('ges-cli-apri', el => A.vai('#/u/cliente/' + el.dataset.id));

  // ---- nuovo cliente (con la prima sede: senza un indirizzo il tecnico non ci va)
  function campiCliente(c) {
    c = c || {};
    return `<div class="campo"><span class="etichetta">Tipo di cliente</span><div class="scelte ges-scelte-tipo">${Object.keys(TIPI_CLIENTE).map(k => `<label class="scelta"><input type="radio" name="tipo" value="${k}"${(c.tipo || 'privato') === k ? ' checked' : ''}><span>${icona(k === 'privato' ? 'utente' : 'edificio', 'p')}${h(TIPI_CLIENTE[k][0])}</span></label>`).join('')}</div></div>
      <div class="ges-form-g">
        <div class="campo tutta"><label for="ges-c-nome">Nome o ragione sociale</label><input id="ges-c-nome" name="nome" type="text" value="${h(c.nome || '')}" required placeholder="Condominio Via Roma 10 · Mario Rossi · Bar Centrale"></div>
        <div class="campo"><label for="ges-c-ref">Referente</label><input id="ges-c-ref" name="referente" type="text" value="${h(c.referente || '')}" placeholder="Amministratore, titolare…"></div>
        <div class="campo"><label for="ges-c-tel">Telefono</label><input id="ges-c-tel" name="telefono" type="tel" value="${h(c.telefono || '')}"></div>
        <div class="campo"><label for="ges-c-email">Email</label><input id="ges-c-email" name="email" type="email" value="${h(c.email || '')}"></div>
        <div class="campo"><label for="ges-c-cf">Codice fiscale</label><input id="ges-c-cf" name="cf" type="text" value="${h(c.cf || '')}" autocapitalize="characters"></div>
        <div class="campo"><label for="ges-c-piva">Partita IVA</label><input id="ges-c-piva" name="piva" type="text" value="${h(c.piva || '')}" inputmode="numeric"></div>
        <div class="campo"><label for="ges-c-sdi">Codice SDI</label><input id="ges-c-sdi" name="sdi" type="text" value="${h(c.sdi || '')}" autocapitalize="characters" maxlength="7"></div>
        <div class="campo"><label for="ges-c-pec">PEC</label><input id="ges-c-pec" name="pec" type="email" value="${h(c.pec || '')}"></div>
        <div class="campo"><label for="ges-c-lis">Listino</label><select id="ges-c-lis" name="listino">${Object.keys(LISTINI).map(k => `<option value="${k}"${(c.listino || 'base') === k ? ' selected' : ''}>${h(LISTINI[k])}</option>`).join('')}</select></div>
        <div class="campo"><label for="ges-c-sc">Sconto %</label><input id="ges-c-sc" name="sconto" type="number" min="0" max="100" step="0.5" value="${h(c.sconto || 0)}"><span class="aiuto">Vale per i documenti di vendita e per gli ordini dall'area clienti.</span></div>
        <div class="campo tutta"><label for="ges-c-tag">Etichette</label><input id="ges-c-tag" name="tag" type="text" value="${h((c.tag || []).join(', '))}" placeholder="contratto, centrale termica"><span class="aiuto">Separate da una virgola: servono a filtrare l'elenco.</span></div>
        <div class="campo tutta"><label for="ges-c-note">Note <span class="muto">(interne: il cliente non le vede)</span></label><textarea id="ges-c-note" name="note" rows="2">${h(c.note || '')}</textarea></div>
      </div>`;
  }
  function datiCliente(d) {
    return {
      tipo: TIPI_CLIENTE[d.tipo] ? d.tipo : 'privato', nome: String(d.nome || '').trim(), referente: String(d.referente || '').trim(),
      telefono: String(d.telefono || '').trim(), email: String(d.email || '').trim(), cf: String(d.cf || '').trim().toUpperCase(), piva: String(d.piva || '').replace(/\s/g, ''),
      sdi: String(d.sdi || '').trim().toUpperCase(), pec: String(d.pec || '').trim(), listino: LISTINI[d.listino] ? d.listino : 'base',
      sconto: Math.max(0, Math.min(100, numDa(d.sconto))), note: String(d.note || '').trim(),
      tag: String(d.tag || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean).filter((t, k, a) => a.indexOf(t) === k)
    };
  }
  function controllaCliente(x, escludiId) {
    if (!x.nome) return 'Scrivi il nome del cliente.';
    if (x.email && !emailValida(x.email)) return 'L\'email non sembra giusta.';
    if (x.pec && !emailValida(x.pec)) return 'La PEC non sembra giusta.';
    if (x.piva && !/^\d{11}$/.test(x.piva)) return 'La partita IVA ha 11 cifre.';
    if (A.DB.clienti.some(c => c.id !== escludiId && norm(c.nome) === norm(x.nome))) return 'C\'è già un cliente con questo nome: cercalo nell\'elenco.';
    return '';
  }
  function apriNuovoCliente(pre) {
    pre = pre || {};
    A.modale({
      titolo: 'Nuovo cliente', largo: true, form: 'ges-cli-salva',
      corpo: `${campiCliente(pre)}
        <div class="sep"></div>
        <p class="ges-sez-t">Primo indirizzo — dove si va a lavorare</p>
        <div class="ges-form-g">
          <div class="campo tutta"><label for="ges-s-ind">Indirizzo</label><input id="ges-s-ind" name="indirizzo" type="text" placeholder="Via Libertà 128"></div>
          <div class="campo"><label for="ges-s-cit">Città</label><input id="ges-s-cit" name="citta" type="text" value="Palermo"></div>
          <div class="campo"><label for="ges-s-cap">CAP</label><input id="ges-s-cap" name="cap" type="text" inputmode="numeric" maxlength="5"></div>
          <div class="campo tutta"><label for="ges-s-acc">Come si entra <span class="muto">(note di accesso per il tecnico)</span></label><textarea id="ges-s-acc" name="noteAccesso" rows="2" placeholder="Citofono, chiavi dal portiere, cane in giardino…"></textarea></div>
        </div>${divErr}`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: 'Crea il cliente', classe: 'pri', tipo: 'submit', icona: 'spunta' }]
    });
  }
  A.azione('ges-cli-nuovo', () => apriNuovoCliente());
  A.azione('ges-cli-salva', (f, ev, d) => {
    const x = datiCliente(d);
    const err = controllaCliente(x); if (err) return erroreModale(err);
    let id;
    A.modifica(db => {
      id = A.uid('cli');
      db.clienti.push(Object.assign({ id }, x, { portale: false, creato: A.adesso() }));
      const ind = String(d.indirizzo || '').trim();
      if (ind) db.sedi.push({ id: A.uid('sed'), clienteId: id, nome: 'Sede principale', indirizzo: ind, citta: String(d.citta || '').trim() || 'Palermo', cap: String(d.cap || '').trim(), lat: null, lng: null, noteAccesso: String(d.noteAccesso || '').trim(), referente: '', telefono: '' });
      A.registra('cliente creato', x.nome);
    });
    A.chiudiModale(); A.toast('Cliente creato', 'ok');
    A.vai('#/u/cliente/' + id);
  });

  // ---- esporta CSV (quello che si vede, con i filtri applicati)
  A.azione('ges-cli-csv', () => {
    const q = qCorrente(); const num = numeriClienti();
    const lista = filtraClienti(q).sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
    const righe = [['Nome', 'Tipo', 'Referente', 'Codice fiscale', 'Partita IVA', 'Codice SDI', 'PEC', 'Email', 'Telefono', 'Indirizzo', 'Città', 'CAP', 'Listino', 'Sconto %', 'Etichette', 'Area clienti', 'Interventi', 'Ultimo intervento']].concat(lista.map(c => {
      const s = A.sediDi(c.id)[0] || {}; const n = num[c.id] || {};
      return [c.nome, TIPI_CLIENTE[c.tipo] ? TIPI_CLIENTE[c.tipo][0] : c.tipo, c.referente, c.cf, c.piva, c.sdi, c.pec, c.email, c.telefono, s.indirizzo || '', s.citta || '', s.cap || '', LISTINI[c.listino] || c.listino || '', dec(c.sconto), (c.tag || []).join(', '), areaAttiva(c.id) ? 'sì' : 'no', n.n || 0, n.ultimo ? A.data(n.ultimo) : ''];
    }));
    A.scarica('clienti-idral-' + A.oggi() + '.csv', A.csv(righe), 'text/csv;charset=utf-8');
    A.modifica(() => A.registra('export clienti', lista.length + ' clienti'));
    A.toast(plurale(lista.length, 'cliente esportato', 'clienti esportati'), 'ok');
  });

  // ---- importa da CSV: anteprima con righe valide e scartate, poi importa
  let impStato = null;
  /** Lettore CSV con le virgolette: «Condominio "Il Faro", scala B» resta un campo solo. */
  function leggiCsv(testo) {
    testo = String(testo || '').replace(/^﻿/, '');
    const prima = testo.split(/\r?\n/)[0] || '';
    const sep = (prima.match(/;/g) || []).length >= (prima.match(/,/g) || []).length ? ';' : ',';
    const righe = []; let riga = [], campo = '', dentro = false;
    for (let i = 0; i < testo.length; i++) {
      const ch = testo[i];
      if (dentro) { if (ch === '"') { if (testo[i + 1] === '"') { campo += '"'; i++; } else dentro = false; } else campo += ch; }
      else if (ch === '"') dentro = true;
      else if (ch === sep) { riga.push(campo); campo = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && testo[i + 1] === '\n') i++; riga.push(campo); righe.push(riga); riga = []; campo = ''; }
      else campo += ch;
    }
    if (campo || riga.length) { riga.push(campo); righe.push(riga); }
    return { sep, righe: righe.filter(r => r.some(x => String(x).trim())) };
  }
  const SINONIMI_CSV = { nome: ['nome', 'ragionesociale', 'cliente', 'denominazione', 'nominativo'], tipo: ['tipo', 'tipologia', 'categoria'], email: ['email', 'mail', 'posta'], telefono: ['telefono', 'tel', 'cellulare', 'cell'], indirizzo: ['indirizzo', 'via', 'sede'], citta: ['citta', 'comune', 'localita'], cap: ['cap'], referente: ['referente', 'contatto'], piva: ['piva', 'partitaiva'], cf: ['cf', 'codicefiscale'] };
  function tipoDa(t, nome) {
    const x = norm(t);
    if (x.startsWith('cond')) return 'condominio';
    if (/^(az|soc|ditta|impresa|srl|spa|snc|sas)/.test(x)) return 'azienda';
    if (x.startsWith('priv')) return 'privato';
    if (!x && /^condominio/i.test(nome)) return 'condominio';
    if (!x && /\b(s\.?r\.?l|s\.?p\.?a|s\.?n\.?c|s\.?a\.?s)\b/i.test(nome)) return 'azienda';
    return 'privato';
  }
  function analizzaCsv(testo) {
    const { sep, righe } = leggiCsv(testo);
    if (righe.length < 2) return { errore: 'Il file è vuoto o ha solo l\'intestazione.' };
    const intest = righe[0].map(x => norm(x).replace(/[^a-z]/g, ''));
    const col = {};
    Object.keys(SINONIMI_CSV).forEach(k => { const i = intest.findIndex(x => SINONIMI_CSV[k].includes(x)); if (i >= 0) col[k] = i; });
    if (col.nome === undefined) return { errore: 'Manca la colonna «nome» nella prima riga. Le intestazioni attese sono: nome;tipo;email;telefono;indirizzo;citta.' };
    const esistenti = new Set(A.DB.clienti.map(c => norm(c.nome)));
    const visti = new Set(); const valide = [], scartate = [];
    righe.slice(1).forEach((r, k) => {
      const v = key => col[key] === undefined ? '' : String(r[col[key]] || '').trim();
      const x = { riga: k + 2, nome: v('nome'), tipo: tipoDa(v('tipo'), v('nome')), email: v('email'), telefono: v('telefono'), indirizzo: v('indirizzo'), citta: v('citta'), cap: v('cap'), referente: v('referente'), piva: v('piva').replace(/\s/g, ''), cf: v('cf').toUpperCase() };
      let motivo = '';
      if (!x.nome) motivo = 'manca il nome';
      else if (x.email && !emailValida(x.email)) motivo = 'email non valida';
      else if (esistenti.has(norm(x.nome))) motivo = 'già in anagrafica';
      else if (visti.has(norm(x.nome))) motivo = 'doppione nel file';
      if (motivo) scartate.push(Object.assign(x, { motivo })); else { visti.add(norm(x.nome)); valide.push(x); }
    });
    return { sep, valide, scartate, colonne: Object.keys(col) };
  }
  A.azione('ges-cli-importa', () => {
    impStato = null;
    A.modale({
      titolo: 'Importa clienti da CSV', largo: true,
      corpo: `<p style="font-size:14px;margin-bottom:12px">Un file CSV esportato da Excel o dal vecchio gestionale, con separatore «;» o «,» e la prima riga di intestazioni:</p>
        <p class="ges-pre" style="font-family:var(--mono);font-size:12.5px;margin-bottom:12px">nome;tipo;email;telefono;indirizzo;citta</p>
        <p class="pic" style="margin-bottom:14px">Il tipo è «privato», «condominio» o «azienda» (se manca: privato). Si possono aggiungere cap, referente, piva e cf. I clienti che ci sono già vengono saltati. <a href="#" data-az="ges-imp-modello">Scarica un file di esempio</a></p>
        <div class="campo"><label for="ges-imp-file">Il file</label><input id="ges-imp-file" type="file" accept=".csv,text/csv,text/plain" data-cambia="ges-imp-file"></div>
        <div id="ges-imp-ante"></div>`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: 'Importa', classe: 'pri', az: 'ges-imp-ok', icona: 'carica', attr: ' id="ges-imp-ok" disabled' }]
    });
  });
  A.azione('ges-imp-modello', () => {
    A.scarica('modello-clienti.csv', A.csv([['nome', 'tipo', 'email', 'telefono', 'indirizzo', 'citta'], ['Mario Rossi', 'privato', 'm.rossi@example.com', '333 000 0000', 'Via Roma 1', 'Palermo'], ['Condominio Via Dante 5', 'condominio', 'amministratore@example.com', '091 000 0000', 'Via Dante 5', 'Palermo']]), 'text/csv;charset=utf-8');
  });
  A.azione('ges-imp-file', el => {
    const f = el.files && el.files[0]; const box = A.$('#ges-imp-ante'); const bt = A.$('#ges-imp-ok');
    if (!f || !box) return;
    const r = new FileReader();
    r.onload = () => {
      const esito = analizzaCsv(r.result);
      impStato = esito.errore ? null : esito;
      if (bt) { bt.disabled = !(impStato && impStato.valide.length); bt.lastChild.textContent = impStato && impStato.valide.length ? 'Importa ' + plurale(impStato.valide.length, 'cliente', 'clienti') : 'Importa'; }
      if (esito.errore) { box.innerHTML = `<div class="avviso dang">${icona('attenzione')}<div>${h(esito.errore)}</div></div>`; return; }
      const tipoNome = t => TIPI_CLIENTE[t][0];
      box.innerHTML = `<div class="ges-chips" style="margin:4px 0 12px">${A.pastiglia(plurale(esito.valide.length, 'riga valida', 'righe valide'), 'ok')}${esito.scartate.length ? A.pastiglia(plurale(esito.scartate.length, 'riga scartata', 'righe scartate'), 'warn') : ''}<span class="pic">separatore «${h(esito.sep)}» · colonne riconosciute: ${h(esito.colonne.join(', '))}</span></div>
        ${esito.valide.length ? `<p class="ges-sez-t">Da importare</p><div class="tab-w" style="border:1px solid var(--line-2);border-radius:10px;margin-bottom:14px;max-height:260px;overflow:auto"><table class="tab"><thead><tr><th>Riga</th><th>Nome</th><th>Tipo</th><th>Email</th><th>Telefono</th><th>Indirizzo</th></tr></thead><tbody>${esito.valide.map(x => `<tr><td class="num">${x.riga}</td><td><b>${h(x.nome)}</b></td><td>${h(tipoNome(x.tipo))}</td><td>${h(x.email || '—')}</td><td class="ges-num">${h(x.telefono || '—')}</td><td>${h([x.indirizzo, x.citta].filter(Boolean).join(', ') || '—')}</td></tr>`).join('')}</tbody></table></div>` : ''}
        ${esito.scartate.length ? `<p class="ges-sez-t">Scartate</p><ul class="ges-linea" style="border:1px solid var(--line-2);border-radius:10px;max-height:200px;overflow:auto">${esito.scartate.map(x => `<li style="padding:8px 12px"><span class="ges-cod">riga ${x.riga}</span><div class="cx1">${h(x.nome || '(senza nome)')}</div>${A.pastiglia(x.motivo, 'warn')}</li>`).join('')}</ul>` : ''}`;
    };
    r.onerror = () => { box.innerHTML = `<div class="avviso dang">${icona('attenzione')}<div>Non riesco a leggere il file.</div></div>`; };
    r.readAsText(f, 'utf-8');
  });
  A.azione('ges-imp-ok', () => {
    if (!impStato || !impStato.valide.length) return;
    const n = impStato.valide.length;
    A.modifica(db => {
      impStato.valide.forEach(x => {
        const id = A.uid('cli');
        db.clienti.push({ id, tipo: x.tipo, nome: x.nome, referente: x.referente, cf: x.cf, piva: x.piva, sdi: '', pec: '', email: x.email, telefono: x.telefono, listino: x.tipo === 'condominio' ? 'condomini' : x.tipo === 'azienda' ? 'aziende' : 'base', sconto: 0, note: '', tag: [], portale: false, creato: A.adesso() });
        if (x.indirizzo) db.sedi.push({ id: A.uid('sed'), clienteId: id, nome: 'Sede principale', indirizzo: x.indirizzo, citta: x.citta || 'Palermo', cap: x.cap, lat: null, lng: null, noteAccesso: '', referente: '', telefono: '' });
      });
      A.registra('import clienti da CSV', plurale(n, 'cliente', 'clienti') + (impStato.scartate.length ? ', ' + impStato.scartate.length + ' righe scartate' : ''));
    });
    impStato = null;
    A.chiudiModale(); A.toast(plurale(n, 'cliente importato', 'clienti importati'), 'ok'); A.render();
  });

  rotta('#/u/clienti', paginaClienti);

  // ===========================================================================
  // 2. SCHEDA CLIENTE — dati, sedi, macchine, fascicolo, preventivi,
  //    documenti, area clienti
  // ===========================================================================
  const SCHEDE_CLI = ['dati', 'sedi', 'macchine', 'fascicolo', 'preventivi', 'documenti', 'area'];
  function piuMesi(iso, n) { const d = A.daGiorno(iso); d.setMonth(d.getMonth() + n); return A.isoGiorno(d); }
  function pillScadenza(iso, entro) {
    if (!iso) return '<span class="muto">—</span>';
    const g = A.diffGiorni(A.oggi(), iso);
    if (g < 0) return A.pastiglia('scaduta dal ' + A.data(iso), 'dang');
    if (g === 0) return A.pastiglia('oggi', 'warn');
    if (g <= (entro || 30)) return A.pastiglia(A.data(iso) + ' · tra ' + g + ' gg', 'warn');
    return `<span class="ges-num">${h(A.data(iso))}</span>`;
  }
  function pillGaranzia(iso) {
    if (!iso) return '<span class="muto">—</span>';
    return iso >= A.oggi() ? A.pastiglia('fino al ' + A.data(iso), 'ok') : A.pastiglia('scaduta', 'grigio');
  }
  function datiFiscaliMancanti(c) {
    const m = [];
    if (c.tipo === 'azienda') { if (!c.piva) m.push('partita IVA'); if (!c.sdi && !c.pec) m.push('codice SDI o PEC'); }
    else if (!c.cf && !c.piva) m.push('codice fiscale');
    return m;
  }

  function paginaCliente(par) {
    const c = A.cliente(par.id);
    if (!c) return nonTrovato('clienti', 'Cliente non trovato', [['Clienti', '#/u/clienti']], 'Questo cliente non c\'è: forse il link è sbagliato.', ['Torna ai clienti', '#/u/clienti']);
    segnaLettiQui();
    const sc = SCHEDE_CLI.includes(par.q.scheda) ? par.q.scheda : 'dati';
    const db = A.DB; const oggi = A.oggi();
    const ints = db.interventi.filter(i => i.clienteId === c.id && i.stato !== 'annullato');
    const prevs = db.preventivi.filter(p => p.clienteId === c.id);
    const alls = db.allegati.filter(a => a.clienteId === c.id);
    const sedi = A.sediDi(c.id), macc = A.impiantiDi(c.id), acc = accessiDi(c.id);
    const fatti = ints.filter(i => FATTI.includes(i.stato) && i.data);
    const ultimo = fatti.map(i => i.data).sort().pop();
    const prossimo = ints.filter(i => APERTI.includes(i.stato) && i.data && i.data >= oggi).map(i => i.data).sort()[0];
    const anno = A.piuGiorni(oggi, -365);
    const valore12 = fatti.filter(i => i.data >= anno && i.tipo !== 'sopralluogo' && i.rapporto).reduce((s, i) => s + A.valoreIntervento(i).totale, 0);
    const daFatt = ints.filter(i => i.stato === 'approvato' && i.tipo !== 'sopralluogo' && !i.documentoId);
    const valDaFatt = daFatt.reduce((s, i) => s + A.valoreIntervento(i).totale, 0);
    const id = h(c.id);

    const testata = `<div class="tessera ges-testata">
      <div class="ges-t-su">
        <div class="ges-t-1">${pTipoCliente(c.tipo)}${(c.tag || []).map(t => `<span class="ges-chip">${icona('etichetta', 'p')}${h(t)}</span>`).join('')}${areaAttiva(c.id) ? A.pastiglia('Area clienti attiva', 'ok') : ''}</div>
        <h2>${h(c.nome)}</h2>
        <div class="ges-t-meta">
          ${c.referente ? `<span>${icona('utente', 'p')}${h(c.referente)}</span>` : ''}
          ${c.telefono ? `<a href="${h(telLink(c.telefono))}">${icona('telefono', 'p')}${h(c.telefono)}</a>` : ''}
          ${c.email ? `<a href="mailto:${h(c.email)}">${icona('posta', 'p')}${h(c.email)}</a>` : ''}
          ${sedi[0] ? `<span>${icona('mappa', 'p')}${h(A.indirizzo(sedi[0]))}${sedi.length > 1 ? ' <span class="muto">+' + (sedi.length - 1) + '</span>' : ''}</span>` : ''}
        </div>
      </div>
      <div class="ges-t-cifre">
        <div><small>Interventi</small><b class="ges-num">${ints.length}</b></div>
        <div><small>Ultimo intervento</small><b>${ultimo ? h(A.data(ultimo)) : '—'}</b>${prossimo ? `<small>prossimo ${h(A.dataBreve(prossimo))}</small>` : ''}</div>
        <div><small>Lavoro negli ultimi 12 mesi</small><b>${h(A.euro(valore12, true))}</b></div>
        <div><small>Fatto e non fatturato</small><b>${h(A.euro(valDaFatt, true))}</b>${daFatt.length ? `<small><a href="#/u/documenti">${plurale(daFatt.length, 'intervento', 'interventi')} →</a></small>` : ''}</div>
      </div>
      <div class="ges-t-barra"><div class="btns">
        <button class="btn acc" type="button" data-az="ges-cli-nuovoint" data-id="${id}">${icona('piu')} Nuovo intervento</button>
        <button class="btn" type="button" data-az="ges-prv-nuovo" data-cliente="${id}">${icona('documento')} Nuovo preventivo</button>
        <button class="btn" type="button" data-az="ges-scrivi" data-cliente="${id}">${icona('messaggio')} Scrivi al cliente</button>
      </div></div>
    </div>`;
    const base = '#/u/cliente/' + c.id + '?scheda=';
    const schede = schedeHtml([
      ['dati', 'Dati', base + 'dati'], ['sedi', 'Sedi', base + 'sedi', sedi.length], ['macchine', 'Macchine', base + 'macchine', macc.length],
      ['fascicolo', 'Fascicolo', base + 'fascicolo'], ['preventivi', 'Preventivi', base + 'preventivi', prevs.length],
      ['documenti', 'Documenti', base + 'documenti', alls.length], ['area', 'Area clienti', base + 'area', acc.length]
    ], sc);
    const corpo = sc === 'sedi' ? schedaSedi(c, sedi) : sc === 'macchine' ? schedaMacchine(c, macc) : sc === 'fascicolo' ? schedaFascicolo(c, par.q)
      : sc === 'preventivi' ? schedaPreventiviCliente(c, prevs) : sc === 'documenti' ? schedaDocumenti(c, alls) : sc === 'area' ? schedaArea(c, acc) : schedaDati(c);
    return pagina({ attivo: 'clienti', titolo: c.nome, briciole: [['Clienti', '#/u/clienti']], contenuto: testata + `<div class="ges-scheda">${schede}${corpo}</div>` });
  }
  A.azione('ges-cli-nuovoint', el => {
    const pre = { clienteId: el.dataset.id };
    if (el.dataset.imp) { const m = A.impianto(el.dataset.imp); if (m) { pre.impiantoId = m.id; pre.sedeId = m.sedeId; if (el.dataset.tipo) pre.tipo = el.dataset.tipo; } }
    A.apriNuovoIntervento ? A.apriNuovoIntervento(pre) : A.toast('La creazione degli interventi non è disponibile', 'per');
  });

  // ---- Dati
  function schedaDati(c) {
    const db = A.DB;
    const contr = db.contratti.filter(k => k.clienteId === c.id);
    const manc = datiFiscaliMancanti(c);
    const aperti = db.preventivi.filter(p => p.clienteId === c.id && (p.stato === 'inviato' || p.stato === 'visto'));
    const storia = db.interventi.some(i => i.clienteId === c.id) || db.preventivi.some(p => p.clienteId === c.id) || db.documenti.some(d => d.clienteId === c.id) || db.allegati.some(a => a.clienteId === c.id) || db.conversazioni.some(x => x.clienteId === c.id) || db.ordini.some(o => o.clienteId === c.id);
    return `<div class="griglia g-2-1 ges-gr">
      <form class="tessera" data-form="ges-cli-dati" novalidate><input type="hidden" name="id" value="${h(c.id)}">
        <div class="tt"><h3>${icona('modifica')} Anagrafica</h3><span class="pic">cliente dal ${h(A.data(c.creato))}</span></div>
        <div class="cp">${campiCliente(c)}${divErr}</div>
        <div class="ges-dida" style="display:flex;justify-content:flex-end;gap:8px"><button class="btn pri" type="submit">${icona('spunta')} Salva i dati</button></div>
      </form>
      <div class="ges-col">
        <div class="tessera"><div class="tt"><h3>${icona('euro')} Dati per la fatturazione</h3></div><div class="cp">
          ${manc.length ? `<div class="avviso warn">${icona('attenzione')}<div><b>Mancano: ${h(manc.join(', '))}.</b><br>Servono al commercialista per emettere la fattura: completali prima di esportare il documento di vendita.</div></div>`
            : `<div class="avviso ok">${icona('spunta')}<div>Dati fiscali completi per l'export al commercialista.</div></div>`}
          <dl class="dl" style="margin-top:12px"><dt>Listino</dt><dd>${h(LISTINI[c.listino] || c.listino || '—')}</dd><dt>Sconto</dt><dd>${c.sconto ? h(A.num(c.sconto)) + '%' : 'nessuno'}</dd><dt>C.F.</dt><dd class="mono">${h(c.cf || '—')}</dd><dt>P.IVA</dt><dd class="mono">${h(c.piva || '—')}</dd><dt>SDI</dt><dd class="mono">${h(c.sdi || '—')}</dd><dt>PEC</dt><dd>${h(c.pec || '—')}</dd></dl>
        </div></div>
        <div class="tessera"><div class="tt"><h3>${icona('storico')} Contratti di manutenzione</h3><a class="btn pic" href="#/u/manutenzioni?vista=contratti">Gestisci</a></div><div class="cp">
          ${contr.length ? contr.map(k => `<div class="ges-riga-i" style="margin-bottom:8px">${icona('verifica', 'p')}<div><b>${h(k.nome)}</b><div class="t2">${h(A.euro(k.canoneAnnuo))} l'anno · ${k.visiteAnno} ${k.visiteAnno === 1 ? 'visita' : 'visite'} · scade ${h(A.data(k.scadenza))}</div></div></div>`).join('') : '<p class="muto" style="font-size:14px">Nessun contratto: le manutenzioni si fanno a misura.</p>'}
        </div></div>
        ${aperti.length ? `<div class="tessera"><div class="tt"><h3>${icona('documento')} In attesa di risposta</h3></div><div class="cp">${aperti.map(p => `<div class="ges-riga-i" style="margin-bottom:8px">${icona('documento', 'p')}<div><a href="#/u/preventivo/${h(p.id)}"><b>N. ${h(p.numero)}</b></a> — ${h(p.oggetto)}<div class="t2">${h(A.euro(A.totaliPreventivo(p).imponibile))} + IVA · ${A.statoPreventivo(p.stato)}</div></div></div>`).join('')}</div></div>` : ''}
        ${storia ? '' : `<div class="tessera"><div class="cp"><p class="pic" style="margin-bottom:10px">Questo cliente non ha ancora nessuna storia: se l'hai creato per sbaglio puoi eliminarlo.</p><button class="btn pic per" type="button" data-az="ges-cli-elimina" data-id="${h(c.id)}">${icona('cestino', 'p')} Elimina il cliente</button></div></div>`}
      </div>
    </div>`;
  }
  A.azione('ges-cli-dati', (f, ev, d) => {
    const c = A.cliente(d.id); if (!c) return;
    const x = datiCliente(d);
    const err = controllaCliente(x, c.id); if (err) return erroreModale(err);
    A.modifica(db => { Object.assign(db.clienti.find(y => y.id === c.id), x); A.registra('cliente modificato', x.nome); });
    A.toast('Dati salvati', 'ok'); A.render();
  });
  A.azione('ges-cli-elimina', async el => {
    const c = A.cliente(el.dataset.id); if (!c) return;
    if (!await A.conferma('Eliminare <b>' + h(c.nome) + '</b>? Si cancellano anche le sue sedi e macchine.', { ok: 'Elimina', pericolo: true })) return;
    A.modifica(db => {
      db.clienti = db.clienti.filter(x => x.id !== c.id); db.sedi = db.sedi.filter(x => x.clienteId !== c.id); db.impianti = db.impianti.filter(x => x.clienteId !== c.id);
      db.utenti.forEach(u => { if (u.ruolo === 'cliente' && u.clienti) u.clienti = u.clienti.filter(x => x !== c.id); });
      A.registra('cliente eliminato', c.nome);
    });
    A.toast('Cliente eliminato', 'ok'); A.vai('#/u/clienti');
  });

  // ---- Sedi
  function schedaSedi(c, sedi) {
    const db = A.DB;
    const carte = sedi.map((s, k) => {
      const nM = db.impianti.filter(m => m.sedeId === s.id).length, nI = db.interventi.filter(i => i.sedeId === s.id && i.stato !== 'annullato').length;
      return `<div class="tessera ges-carta">
        <div class="tt"><h3>${icona('mappa')} ${h(s.nome || 'Sede')}</h3>${k === 0 ? A.pastiglia('principale', 'blu', true) : ''}</div>
        <div class="cp">
          <div class="ges-riga-i">${icona('casa', 'p')}<div><b>${h(s.indirizzo || 'indirizzo da completare')}</b><div class="t2">${h([s.cap, s.citta].filter(Boolean).join(' '))}</div></div></div>
          ${s.noteAccesso ? `<div class="avviso warn" style="font-size:13.5px">${icona('chiave')}<div><b>Come si entra:</b> ${h(s.noteAccesso)}</div></div>` : ''}
          ${s.referente || s.telefono ? `<div class="ges-riga-i">${icona('telefono', 'p')}<div>Sul posto: ${h(s.referente || '')}${s.telefono ? ` · <a href="${h(telLink(s.telefono))}">${h(s.telefono)}</a>` : ''}</div></div>` : ''}
          <div class="ges-riga-i">${icona('impianto', 'p')}<div>${plurale(nM, 'macchina', 'macchine')} · ${plurale(nI, 'intervento', 'interventi')}</div></div>
          <div class="ges-riga-i">${icona('naviga', 'p')}<div class="t2">${s.lat && s.lng ? 'Coordinate ' + h(A.num(s.lat, 5)) + ', ' + h(A.num(s.lng, 5)) : 'Senza coordinate: la mappa cerca l\'indirizzo'}</div></div>
        </div>
        <div class="ges-piede"><a class="btn pic" href="${h(A.linkMappa(s))}" target="_blank" rel="noopener">${icona('esterno', 'p')} Apri sulla mappa</a><button class="btn pic" type="button" data-az="ges-sede-mod" data-id="${h(s.id)}">${icona('modifica', 'p')} Modifica</button></div>
      </div>`;
    }).join('');
    return `<div class="ges-intesta"><p>${sedi.length ? 'Dove si va a lavorare per questo cliente: le note di accesso arrivano al tecnico sul telefono.' : 'Nessun indirizzo: aggiungine uno, senza il tecnico non sa dove andare.'}</p><button class="btn pri" type="button" data-az="ges-sede-mod" data-cliente="${h(c.id)}">${icona('piu')} Aggiungi sede</button></div>
      ${sedi.length ? `<div class="ges-carte">${carte}</div>` : vuotoTessera('Nessuna sede', 'Aggiungi l\'indirizzo dove si lavora.', 'mappa')}`;
  }
  A.azione('ges-sede-mod', el => {
    const s = el.dataset.id ? A.sede(el.dataset.id) : null;
    const cid = s ? s.clienteId : el.dataset.cliente;
    const nuova = !s; const x = s || { nome: A.sediDi(cid).length ? 'Sede ' + (A.sediDi(cid).length + 1) : 'Sede principale', citta: 'Palermo' };
    A.modale({
      titolo: nuova ? 'Nuova sede' : 'Modifica sede', form: 'ges-sede-salva', largo: true,
      corpo: `<input type="hidden" name="id" value="${h(s ? s.id : '')}"><input type="hidden" name="clienteId" value="${h(cid)}">
        <div class="ges-form-g">
          <div class="campo"><label for="ges-sd-nome">Nome della sede</label><input id="ges-sd-nome" name="nome" type="text" value="${h(x.nome || '')}" placeholder="Sede principale, Centrale termica, Magazzino…"></div>
          <div class="campo"><label for="ges-sd-ind">Indirizzo</label><input id="ges-sd-ind" name="indirizzo" type="text" value="${h(x.indirizzo || '')}" required></div>
          <div class="campo"><label for="ges-sd-cit">Città</label><input id="ges-sd-cit" name="citta" type="text" value="${h(x.citta || '')}"></div>
          <div class="campo"><label for="ges-sd-cap">CAP</label><input id="ges-sd-cap" name="cap" type="text" inputmode="numeric" maxlength="5" value="${h(x.cap || '')}"></div>
          <div class="campo tutta"><label for="ges-sd-acc">Come si entra <span class="muto">(note di accesso)</span></label><textarea id="ges-sd-acc" name="noteAccesso" rows="2" placeholder="Citofono, chiavi dal portiere, orari…">${h(x.noteAccesso || '')}</textarea></div>
          <div class="campo"><label for="ges-sd-ref">Referente sul posto</label><input id="ges-sd-ref" name="referente" type="text" value="${h(x.referente || '')}" placeholder="Portiere, custode…"></div>
          <div class="campo"><label for="ges-sd-tel">Telefono sul posto</label><input id="ges-sd-tel" name="telefono" type="tel" value="${h(x.telefono || '')}"></div>
          <div class="campo"><label for="ges-sd-lat">Latitudine <span class="muto">(facoltativa)</span></label><input id="ges-sd-lat" name="lat" type="text" inputmode="decimal" value="${h(x.lat || '')}" placeholder="38.1336"></div>
          <div class="campo"><label for="ges-sd-lng">Longitudine <span class="muto">(facoltativa)</span></label><input id="ges-sd-lng" name="lng" type="text" inputmode="decimal" value="${h(x.lng || '')}" placeholder="13.3441"></div>
        </div>
        <p class="pic">Le coordinate mettono il puntino esatto sulla mappa del giro (utile per centrali termiche e ingressi sul retro). Si copiano da Google Maps: tasto destro sul punto.</p>${divErr}`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: nuova ? 'Aggiungi' : 'Salva', classe: 'pri', tipo: 'submit', icona: 'spunta' }]
    });
  });
  A.azione('ges-sede-salva', (f, ev, d) => {
    const ind = String(d.indirizzo || '').trim(); if (!ind) return erroreModale('Scrivi l\'indirizzo.');
    const lat = String(d.lat || '').trim() ? numDa(d.lat) : null, lng = String(d.lng || '').trim() ? numDa(d.lng) : null;
    if ((lat !== null && (lat < -90 || lat > 90)) || (lng !== null && (lng < -180 || lng > 180))) return erroreModale('Le coordinate non sembrano giuste (esempio: 38.1336 e 13.3441).');
    const x = { nome: String(d.nome || '').trim() || 'Sede', indirizzo: ind, citta: String(d.citta || '').trim(), cap: String(d.cap || '').trim(), noteAccesso: String(d.noteAccesso || '').trim(), referente: String(d.referente || '').trim(), telefono: String(d.telefono || '').trim(), lat, lng };
    A.modifica(db => {
      if (d.id) Object.assign(db.sedi.find(s => s.id === d.id), x);
      else db.sedi.push(Object.assign({ id: A.uid('sed'), clienteId: d.clienteId }, x));
      A.registra(d.id ? 'sede modificata' : 'sede aggiunta', nomeCli(d.clienteId) + ' — ' + ind);
    });
    A.chiudiModale(); A.toast(d.id ? 'Sede salvata' : 'Sede aggiunta', 'ok'); A.render();
  });

  // ---- Macchine
  function interventoApertoPer(mid, tipo) { return A.DB.interventi.find(i => i.impiantoId === mid && APERTI.includes(i.stato) && (!tipo || i.tipo === tipo)) || null; }
  function schedaMacchine(c, macc) {
    const oggi = A.oggi();
    const righe = macc.slice().sort((a, b) => String(a.prossimaManutenzione || '9').localeCompare(String(b.prossimaManutenzione || '9'))).map(m => {
      const s = A.sede(m.sedeId); const ap = interventoApertoPer(m.id);
      const dovuta = m.prossimaManutenzione && A.diffGiorni(oggi, m.prossimaManutenzione) <= 30;
      return `<tr>
        <td class="ges-nome ges-prima"><b>${h(nomeMacchina(m))}</b> <span class="ges-chip">${h(cap(m.categoria || 'macchina'))}</span>
          <div class="t2">${m.matricola ? 'Matricola <span class="ges-cod">' + h(m.matricola) + '</span>' : 'senza matricola'}${m.potenzaKw ? ' · ' + h(m.potenzaKw) + ' kW' : ''}${m.combustibile ? ' · ' + h(COMBUSTIBILI[m.combustibile] || m.combustibile) : ''}</div>
          ${ap ? `<div style="margin-top:4px"><a class="ges-chip" href="#/u/intervento/${h(ap.id)}">${icona('chiave', 'p')}Intervento aperto N. ${h(ap.numero)}</a></div>` : ''}</td>
        <td data-l="Sede">${h(s ? s.nome : '—')}<div class="t2">${h(s ? s.indirizzo : '')}</div></td>
        <td data-l="Installata" class="num">${m.installato ? h(A.data(m.installato)) : '<span class="muto">—</span>'}</td>
        <td data-l="Garanzia">${pillGaranzia(m.garanziaFino)}</td>
        <td data-l="Ultima manutenzione" class="num">${m.ultimaManutenzione ? h(A.data(m.ultimaManutenzione)) : '<span class="muto">—</span>'}</td>
        <td data-l="Prossima">${pillScadenza(m.prossimaManutenzione)}${m.intervalloMesi ? `<div class="t2">ogni ${h(m.intervalloMesi)} mesi</div>` : ''}</td>
        <td data-l="Libretto">${m.libretto ? A.pastiglia('sì', 'ok', true) : '<span class="muto">no</span>'}</td>
        <td class="ges-az"><div class="ges-azr">${dovuta && !ap ? `<button class="btn pic acc" type="button" data-az="ges-cli-nuovoint" data-id="${h(c.id)}" data-imp="${h(m.id)}" data-tipo="manutenzione">${icona('calendario', 'p')} Manutenzione</button>` : ''}<button class="btn pic" type="button" data-az="ges-mac-mod" data-id="${h(m.id)}">${icona('modifica', 'p')} Modifica</button></div></td>
      </tr>`;
    }).join('');
    return `<div class="ges-intesta"><p>Le «macchine» sono gli apparecchi con matricola: caldaie, scaldabagni, addolcitori… Con la data della prossima manutenzione entrano da sole nell'elenco delle manutenzioni.</p><button class="btn pri" type="button" data-az="ges-mac-mod" data-cliente="${h(c.id)}">${icona('piu')} Aggiungi macchina</button></div>
      ${macc.length ? `<div class="tessera"><div class="tab-w"><table class="tab ges-resp"><thead><tr><th>Macchina</th><th>Sede</th><th class="num">Installata</th><th>Garanzia</th><th class="num">Ultima manut.</th><th>Prossima</th><th>Libretto</th><th></th></tr></thead><tbody>${righe}</tbody></table></div></div>`
        : vuotoTessera('Nessuna macchina registrata', 'Aggiungi la caldaia o lo scaldabagno del cliente: il tecnico vedrà matricola e storia.', 'impianto')}`;
  }
  A.azione('ges-mac-mod', el => {
    const m = el.dataset.id ? A.impianto(el.dataset.id) : null;
    const cid = m ? m.clienteId : el.dataset.cliente;
    const sedi = A.sediDi(cid);
    if (!sedi.length) { A.toast('Prima aggiungi una sede al cliente', 'warn'); A.vai('#/u/cliente/' + cid + '?scheda=sedi'); return; }
    const x = m || { categoria: 'caldaia', combustibile: 'metano', intervalloMesi: 12, libretto: true, sedeId: sedi[0].id };
    const cats = CATEGORIE_MACCHINA.includes(x.categoria) ? CATEGORIE_MACCHINA : CATEGORIE_MACCHINA.concat([x.categoria]);
    A.modale({
      titolo: m ? 'Modifica macchina' : 'Nuova macchina', form: 'ges-mac-salva', largo: true,
      corpo: `<input type="hidden" name="id" value="${h(m ? m.id : '')}"><input type="hidden" name="clienteId" value="${h(cid)}">
        <div class="ges-form-g">
          <div class="campo"><label for="ges-m-sede">Sede</label><select id="ges-m-sede" name="sedeId">${sedi.map(s => `<option value="${h(s.id)}"${x.sedeId === s.id ? ' selected' : ''}>${h(s.nome + ' — ' + s.indirizzo)}</option>`).join('')}</select></div>
          <div class="campo"><label for="ges-m-cat">Tipo di macchina</label><select id="ges-m-cat" name="categoria">${cats.map(k => `<option value="${h(k)}"${x.categoria === k ? ' selected' : ''}>${h(cap(k))}</option>`).join('')}</select></div>
          <div class="campo"><label for="ges-m-mar">Marca</label><input id="ges-m-mar" name="marca" type="text" value="${h(x.marca || '')}" placeholder="Vaillant"></div>
          <div class="campo"><label for="ges-m-mod">Modello</label><input id="ges-m-mod" name="modello" type="text" value="${h(x.modello || '')}" placeholder="ecoTEC plus VMW 246"></div>
          <div class="campo"><label for="ges-m-mat">Matricola</label><input id="ges-m-mat" name="matricola" type="text" value="${h(x.matricola || '')}" autocapitalize="characters"></div>
          <div class="campo"><label for="ges-m-kw">Potenza (kW)</label><input id="ges-m-kw" name="potenzaKw" type="number" min="0" step="0.1" value="${h(x.potenzaKw || '')}"></div>
          <div class="campo"><label for="ges-m-com">Alimentazione</label><select id="ges-m-com" name="combustibile">${Object.keys(COMBUSTIBILI).map(k => `<option value="${k}"${(x.combustibile || '') === k ? ' selected' : ''}>${h(COMBUSTIBILI[k])}</option>`).join('')}</select></div>
          <div class="campo"><label for="ges-m-ins">Installata il</label><input id="ges-m-ins" name="installato" type="date" value="${h(x.installato || '')}"></div>
          <div class="campo"><label for="ges-m-gar">In garanzia fino al</label><input id="ges-m-gar" name="garanziaFino" type="date" value="${h(x.garanziaFino || '')}"></div>
          <div class="campo"><label for="ges-m-int">Manutenzione ogni (mesi)</label><input id="ges-m-int" name="intervalloMesi" type="number" min="0" max="60" value="${h(x.intervalloMesi === undefined ? 12 : x.intervalloMesi)}"><span class="aiuto">0 = nessuna manutenzione periodica.</span></div>
          <div class="campo"><label for="ges-m-ult">Ultima manutenzione</label><input id="ges-m-ult" name="ultimaManutenzione" type="date" value="${h(x.ultimaManutenzione || '')}"></div>
          <div class="campo"><label for="ges-m-pro">Prossima manutenzione</label><input id="ges-m-pro" name="prossimaManutenzione" type="date" value="${h(x.prossimaManutenzione || '')}"><span class="aiuto">Vuota: la calcolo dall'ultima più l'intervallo.</span></div>
          <label class="spunta tutta"><input type="checkbox" name="libretto"${x.libretto ? ' checked' : ''}> C'è il libretto di impianto</label>
          <div class="campo tutta"><label for="ges-m-note">Note</label><textarea id="ges-m-note" name="note" rows="2">${h(x.note || '')}</textarea></div>
        </div>${divErr}`,
      azioni: (m ? [{ testo: 'Elimina', classe: 'per', az: 'ges-mac-elimina', attr: ` data-id="${h(m.id)}"` }] : []).concat([{ testo: 'Annulla', chiudi: true }, { testo: m ? 'Salva' : 'Aggiungi', classe: 'pri', tipo: 'submit', icona: 'spunta' }])
    });
  });
  A.azione('ges-mac-salva', (f, ev, d) => {
    if (!String(d.marca || '').trim() && !String(d.modello || '').trim() && !String(d.matricola || '').trim()) return erroreModale('Scrivi almeno marca, modello o matricola: serve a riconoscerla.');
    const intervallo = Math.max(0, Math.round(numDa(d.intervalloMesi)));
    let prossima = d.prossimaManutenzione || '';
    if (!prossima && d.ultimaManutenzione && intervallo) prossima = piuMesi(d.ultimaManutenzione, intervallo);
    const x = { sedeId: d.sedeId, categoria: d.categoria, marca: String(d.marca || '').trim(), modello: String(d.modello || '').trim(), matricola: String(d.matricola || '').trim().toUpperCase(), potenzaKw: d.potenzaKw ? numDa(d.potenzaKw) : '', combustibile: d.combustibile || '', installato: d.installato || '', garanziaFino: d.garanziaFino || '', ultimaManutenzione: d.ultimaManutenzione || '', prossimaManutenzione: prossima, intervalloMesi: intervallo, libretto: !!d.libretto, note: String(d.note || '').trim() };
    A.modifica(db => {
      if (d.id) Object.assign(db.impianti.find(m => m.id === d.id), x);
      else db.impianti.push(Object.assign({ id: A.uid('imp'), clienteId: d.clienteId }, x));
      A.registra(d.id ? 'macchina modificata' : 'macchina aggiunta', nomeCli(d.clienteId) + ' — ' + nomeMacchina(x) + (x.matricola ? ' (' + x.matricola + ')' : ''));
    });
    A.chiudiModale(); A.toast(d.id ? 'Macchina salvata' : 'Macchina aggiunta', 'ok'); A.render();
  });
  A.azione('ges-mac-elimina', async el => {
    const m = A.impianto(el.dataset.id); if (!m) return;
    const usata = A.DB.interventi.filter(i => i.impiantoId === m.id).length;
    if (!await A.conferma(usata ? 'Questa macchina compare in ' + plurale(usata, 'intervento', 'interventi') + ': gli interventi restano, ma senza la macchina collegata. Eliminarla?' : 'Eliminare la macchina ' + h(nomeMacchina(m)) + '?', { ok: 'Elimina', pericolo: true })) return;
    A.modifica(db => { db.impianti = db.impianti.filter(x => x.id !== m.id); A.registra('macchina eliminata', nomeCli(m.clienteId) + ' — ' + nomeMacchina(m)); });
    A.toast('Macchina eliminata', 'ok'); A.render();
  });

  // ---- Fascicolo: tutta la storia del cliente in una colonna, dal più recente
  function vociFascicolo(c) {
    const db = A.DB; const v = [];
    const giorno = x => x ? String(x).slice(0, 10) : '';
    db.interventi.filter(i => i.clienteId === c.id).forEach(i => {
      const d = i.data || giorno(i.creato);
      v.push({ f: 'interventi', ord: d + 'T' + (i.ora || '00:00'), quando: i.data ? A.data(i.data) + (i.ora ? ' ' + i.ora : '') : 'creato ' + A.data(i.creato), ic: 'chiave', cl: i.stato === 'annullato' ? 'grigio' : FATTI.includes(i.stato) ? 'ok' : '', t: 'Intervento N. ' + i.numero + ' — ' + (A.TIPI_INTERVENTO[i.tipo] || i.tipo), s: (i.rapporto && i.rapporto.lavoro) || i.richiesta, link: '#/u/intervento/' + i.id, pill: A.statoIntervento(i.stato) });
    });
    db.preventivi.filter(p => p.clienteId === c.id).forEach(p => {
      const t = A.totaliPreventivo(p);
      v.push({ f: 'preventivi', ord: p.creato, quando: A.data(p.creato), ic: 'documento', cl: 'acc', t: 'Preventivo N. ' + p.numero + (p.versione > 1 ? ' rev. ' + p.versione : '') + ' — ' + (p.oggetto || 'senza oggetto'), s: A.euro(t.imponibile) + ' + IVA', link: '#/u/preventivo/' + p.id, pill: A.statoPreventivo(p.stato) });
    });
    db.documenti.filter(d => d.clienteId === c.id).forEach(d => {
      const t = A.totaliDocumento(d);
      v.push({ f: 'documenti', ord: d.creato, quando: A.data(d.creato), ic: 'euro', cl: 'ok', t: 'Documento di vendita PRE-' + d.numero, s: plurale((d.interventi || []).length, 'intervento', 'interventi') + ' · ' + A.euro(t.imponibile) + ' + IVA' + (d.fattura ? ' · fattura ' + d.fattura.numero : ''), link: '#/u/documento/' + d.id, pill: pDa(STATI_DOC, d.stato) });
    });
    db.allegati.filter(a => a.clienteId === c.id).forEach(a => {
      v.push({ f: 'documenti', ord: a.data, quando: A.data(a.data), ic: 'graffetta', cl: 'grigio', t: a.nome, s: (TIPI_ALLEGATO[a.tipo] || [a.tipo])[0] + (a.dimensione ? ' · ' + Math.round(a.dimensione / 1024) + ' KB' : '') + (a.visibileCliente ? ' · visibile al cliente' : ' · solo ufficio'), az: 'ges-all-scarica', id: a.id, pill: pDa(TIPI_ALLEGATO, a.tipo) });
    });
    db.conversazioni.filter(x => x.clienteId === c.id).forEach(x => (x.messaggi || []).forEach(m => {
      const chi = m.da === 'azienda' ? 'IDRAL (' + A.nomeBreve(nomeUtente(m.autoreId)) + ')' : (m.autoreId && A.utenteDa(m.autoreId) ? A.utenteDa(m.autoreId).nome : c.nome);
      v.push({ f: 'messaggi', ord: m.data, quando: A.dataOra(m.data), ic: 'messaggio', cl: m.da === 'azienda' ? '' : 'acc', t: chi + ' — ' + (x.oggetto || 'messaggio'), s: m.testo, link: '#/u/messaggi/' + x.id });
    }));
    db.ordini.filter(o => o.clienteId === c.id).forEach(o => {
      const tot = (o.righe || []).reduce((s, r) => s + (Number(r.qta) || 0) * (Number(r.prezzo) || 0), 0);
      v.push({ f: 'ordini', ord: o.data, quando: A.data(o.data), ic: 'carrello', cl: 'acc', t: 'Ordine di materiale N. ' + o.numero, s: plurale((o.righe || []).length, 'articolo', 'articoli') + ' · ' + A.euro(tot) + ' + IVA · ' + (o.consegna === 'consegna' ? 'consegna' : 'ritiro al deposito'), link: '#/u/materiale?scheda=ordini', pill: pDa(STATI_ORDINE, o.stato) });
    });
    return v.sort((a, b) => String(b.ord).localeCompare(String(a.ord)));
  }
  function schedaFascicolo(c, q) {
    const tutte = vociFascicolo(c);
    const f = ['interventi', 'preventivi', 'documenti', 'messaggi', 'ordini'].includes(q.f) ? q.f : '';
    const lista = f ? tutte.filter(v => v.f === f) : tutte;
    const conta = k => tutte.filter(v => v.f === k).length;
    const base = '#/u/cliente/' + c.id + '?scheda=fascicolo';
    const MAX = 60; const vis = q.tutti === '1' ? lista : lista.slice(0, MAX);
    let mese = '';
    const voci = vis.map(v => {
      const m = String(v.ord).slice(0, 7); let testa = '';
      if (m !== mese) { mese = m; const [y, mm] = m.split('-').map(Number); testa = `<li class="ges-mese" style="display:block;padding:10px 18px 6px">${h(cap(A.MESI[mm - 1] || ''))} ${y}</li>`; }
      const titolo = v.link ? `<a href="${h(v.link)}">${h(v.t)}</a>` : v.az ? `<a href="#" data-az="${v.az}" data-id="${h(v.id)}">${h(v.t)}</a>` : h(v.t);
      return testa + `<li><span class="ges-ic ${v.cl || ''}">${icona(v.ic, 'p')}</span><div class="cx1"><div class="t1">${titolo}</div>${v.s ? `<div class="t2">${h(taglia(v.s, 180))}</div>` : ''}</div><div class="ges-q">${h(v.quando)}${v.pill ? '<div style="margin-top:4px">' + v.pill + '</div>' : ''}</div></li>`;
    }).join('');
    return `<div class="ges-intesta">${segmenti([['', 'Tutto', base, tutte.length], ['interventi', 'Interventi', base + '&f=interventi', conta('interventi')], ['preventivi', 'Preventivi', base + '&f=preventivi', conta('preventivi')], ['documenti', 'Documenti', base + '&f=documenti', conta('documenti')], ['messaggi', 'Messaggi', base + '&f=messaggi', conta('messaggi')], ['ordini', 'Ordini', base + '&f=ordini', conta('ordini')]], f)}</div>
      ${lista.length ? `<div class="tessera"><ul class="ges-linea">${voci}</ul>${lista.length > vis.length ? `<div class="ges-dida"><a href="${base}${f ? '&f=' + f : ''}&tutti=1">Mostra tutta la storia (${lista.length})</a></div>` : ''}</div>`
        : vuotoTessera('Niente da mostrare', 'Qui compaiono interventi, preventivi, documenti, messaggi e ordini del cliente, dal più recente.', 'storico')}`;
  }

  // ---- Documenti del cliente (allegati: fatture caricate, DICO, libretti…)
  function schedaDocumenti(c, alls) {
    const docs = A.DB.documenti.filter(d => d.clienteId === c.id).sort((a, b) => String(b.creato).localeCompare(String(a.creato)));
    const righe = alls.slice().sort((a, b) => String(b.data).localeCompare(String(a.data))).map(a => {
      const m = a.impiantoId ? A.impianto(a.impiantoId) : null;
      return `<tr class="${a.visibileCliente ? '' : ''}">
        <td class="ges-nome ges-prima">${pDa(TIPI_ALLEGATO, a.tipo)} <b>${h(a.nome)}</b>${a.nomeFile ? `<div class="t2">${h(a.nomeFile)}</div>` : !a.dataUrl ? '<div class="t2">documento di prova della demo</div>' : ''}</td>
        <td data-l="Macchina">${m ? h(nomeMacchina(m)) : '<span class="muto">—</span>'}</td>
        <td data-l="Data" class="num">${h(A.data(a.data))}</td>
        <td data-l="Dimensione" class="num">${a.dimensione ? h(A.num(a.dimensione / 1024, 0)) + ' KB' : '—'}</td>
        <td data-l="Il cliente">${a.visibileCliente ? A.pastiglia('Lo vede', 'ok') : A.pastiglia('Solo ufficio', 'grigio')}</td>
        <td class="ges-az"><div class="ges-azr"><button class="btn pic" type="button" data-az="ges-all-scarica" data-id="${h(a.id)}">${icona('scarica', 'p')} Scarica</button><button class="btn pic" type="button" data-az="ges-all-vis" data-id="${h(a.id)}">${icona(a.visibileCliente ? 'occhiochiuso' : 'occhio', 'p')} ${a.visibileCliente ? 'Nascondi' : 'Mostra al cliente'}</button><button class="btn pic per" type="button" data-az="ges-all-elimina" data-id="${h(a.id)}" aria-label="Elimina ${h(a.nome)}">${icona('cestino', 'p')}</button></div></td>
      </tr>`;
    }).join('');
    return `<div class="ges-intesta"><p>Fatture emesse dal software fiscale, dichiarazioni di conformità, libretti, certificazioni. Quello che è «visibile» il cliente lo scarica dalla sua area.</p><button class="btn pri" type="button" data-az="ges-all-carica" data-cliente="${h(c.id)}">${icona('carica')} Carica documento</button></div>
      ${alls.length ? `<div class="tessera"><div class="tab-w"><table class="tab ges-resp"><thead><tr><th>Documento</th><th>Macchina</th><th class="num">Data</th><th class="num">Dimensione</th><th>Il cliente</th><th></th></tr></thead><tbody>${righe}</tbody></table></div></div>`
        : vuotoTessera('Nessun documento', 'Carica la fattura emessa dal software fiscale, la DICO o il libretto: il cliente li ritrova nella sua area.', 'graffetta')}
      <div class="tessera" style="margin-top:16px"><div class="tt"><h3>${icona('euro')} Documenti di vendita</h3><a class="btn pic" href="#/u/documenti?scheda=documenti">Tutti</a></div>
        ${docs.length ? `<ul class="ges-linea">${docs.map(d => { const t = A.totaliDocumento(d); return `<li><span class="ges-ic ok">${icona('euro', 'p')}</span><div class="cx1"><div class="t1"><a href="#/u/documento/${h(d.id)}">PRE-${h(d.numero)}</a></div><div class="t2">${A.data(d.creato)} · ${plurale((d.interventi || []).length, 'intervento', 'interventi')}${d.fattura ? ' · fattura ' + h(d.fattura.numero) : ''}</div></div><div class="ges-q"><b class="ges-num" style="color:var(--ink)">${h(A.euro(t.imponibile))}</b><div style="margin-top:4px">${pDa(STATI_DOC, d.stato)}</div></div></li>`; }).join('')}</ul>`
          : `<div class="cp"><p class="muto" style="font-size:14px">Nessun documento di vendita per questo cliente.</p></div>`}
        <div class="ges-dida">${icona('info', 'p')} Il gestionale non emette fatture: prepara il documento di vendita e l'export per chi le emette.</div>
      </div>`;
  }
  A.azione('ges-all-scarica', el => { const a = A.trova('allegati', el.dataset.id); if (a) A.scaricaAllegato(a); });
  A.azione('ges-all-carica', el => {
    const cid = el.dataset.cliente; const macc = A.impiantiDi(cid);
    A.modale({
      titolo: 'Carica un documento', form: 'ges-all-salva',
      corpo: `<input type="hidden" name="clienteId" value="${h(cid)}">
        <div class="campo"><label for="ges-a-file">Il file <span class="muto">(PDF o foto, fino a 1,5 MB)</span></label><input id="ges-a-file" name="file" type="file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx,.txt" data-cambia="ges-all-file"></div>
        <div class="riga-campi">
          <div class="campo"><label for="ges-a-tipo">Tipo</label><select id="ges-a-tipo" name="tipo" data-cambia="ges-all-tipo">${Object.keys(TIPI_ALLEGATO).map(k => `<option value="${k}">${h(TIPI_ALLEGATO[k][0])}</option>`).join('')}</select></div>
          <div class="campo"><label for="ges-a-imp">Macchina <span class="muto">(facoltativa)</span></label><select id="ges-a-imp" name="impiantoId"><option value="">— nessuna —</option>${macc.map(m => `<option value="${h(m.id)}">${h(nomeMacchina(m))}${m.matricola ? ' · ' + h(m.matricola) : ''}</option>`).join('')}</select></div>
        </div>
        <div class="campo"><label for="ges-a-nome">Nome del documento</label><input id="ges-a-nome" name="nome" type="text" placeholder="Fattura FT 231/2026"></div>
        <label class="spunta"><input type="checkbox" name="visibile" id="ges-a-vis" checked> <span><b>Visibile al cliente</b><br><span class="pic">Lo trova nella sua area e riceve un avviso${A.DB.azienda.notificheEmail !== false ? ' e un\'email' : ''}.</span></span></label>
        ${divErr}`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: 'Carica', classe: 'pri', tipo: 'submit', icona: 'carica' }]
    });
  });
  // Le fatture si mostrano al cliente di norma; DICO e libretti sono spesso da controllare prima.
  A.azione('ges-all-tipo', el => { const v = A.$('#ges-a-vis'); if (v) v.checked = el.value === 'fattura'; });
  A.azione('ges-all-file', el => { const n = A.$('#ges-a-nome'); const f = el.files && el.files[0]; if (n && f && !n.value) n.value = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '); });
  A.azione('ges-all-salva', async (f, ev, d) => {
    const file = d.file && d.file[0];
    if (!file) return erroreModale('Scegli il file da caricare.');
    if (file.size > 1.5 * 1024 * 1024) return erroreModale('Il file è di ' + A.num(file.size / 1048576, 1) + ' MB: nella demo il limite è 1,5 MB. Comprimi il PDF o carica una foto più piccola.');
    let dataUrl;
    try { dataUrl = await A.leggiFile(file); } catch (_) { return erroreModale('Non riesco a leggere il file.'); }
    // La demo vive nel localStorage (~5 MB): meglio dirlo prima che perdere il salvataggio.
    const usato = (localStorage.getItem('idral.demo.v1') || '').length;
    if (usato + dataUrl.length > 4.6e6) return erroreModale('La memoria della demo è quasi piena: elimina qualche documento o foto, oppure riporta la demo all\'inizio.');
    const cid = d.clienteId; const nome = String(d.nome || '').trim() || file.name;
    const vis = !!d.visibile;
    A.modifica(db => {
      db.allegati.push({ id: A.uid('all'), clienteId: cid, impiantoId: d.impiantoId || null, tipo: TIPI_ALLEGATO[d.tipo] ? d.tipo : 'altro', nome, data: A.adesso(), dimensione: file.size, caricatoDa: A.utente().id, visibileCliente: vis, dataUrl, nomeFile: file.name });
      if (vis) avvisaCliente(db, cid, 'Nuovo documento nella tua area: ' + nome, '#/c/documenti', 'messaggio', 'IDRAL — nuovo documento: ' + nome, 'Gentile cliente, abbiamo caricato un nuovo documento nella sua area clienti: «' + nome + '». Può scaricarlo quando vuole.');
      A.registra('documento caricato', nomeCli(cid) + ' — ' + nome + (vis ? ' (visibile al cliente)' : ''));
    });
    A.chiudiModale(); A.toast(vis ? 'Documento caricato: il cliente è stato avvisato' : 'Documento caricato (solo ufficio)', 'ok'); A.render();
  });
  A.azione('ges-all-vis', el => {
    const a = A.trova('allegati', el.dataset.id); if (!a) return;
    const ora = !a.visibileCliente;
    A.modifica(db => {
      const x = db.allegati.find(y => y.id === a.id); x.visibileCliente = ora;
      if (ora) avvisaCliente(db, a.clienteId, 'Nuovo documento nella tua area: ' + a.nome, '#/c/documenti', 'messaggio', 'IDRAL — nuovo documento: ' + a.nome, 'Gentile cliente, trova un nuovo documento nella sua area clienti: «' + a.nome + '».');
      A.registra(ora ? 'documento mostrato al cliente' : 'documento nascosto al cliente', nomeCli(a.clienteId) + ' — ' + a.nome);
    });
    A.toast(ora ? 'Ora il cliente lo vede (e ha ricevuto un avviso)' : 'Nascosto al cliente', 'ok'); A.render();
  });
  A.azione('ges-all-elimina', async el => {
    const a = A.trova('allegati', el.dataset.id); if (!a) return;
    if (!await A.conferma('Eliminare «' + h(a.nome) + '»?' + (a.visibileCliente ? ' Sparisce anche dall\'area del cliente.' : ''), { ok: 'Elimina', pericolo: true })) return;
    A.modifica(db => { db.allegati = db.allegati.filter(x => x.id !== a.id); A.registra('documento eliminato', nomeCli(a.clienteId) + ' — ' + a.nome); });
    A.toast('Documento eliminato', 'ok'); A.render();
  });

  // ---- Area clienti: chi entra, con quale link, e chi e' stato spento
  function schedaArea(c, acc) {
    const carte = acc.map(u => {
      const altri = (u.clienti || []).filter(x => x !== c.id).map(nomeCli);
      const st = u.attivo === false ? A.pastiglia('Disattivato', 'grigio') : usaArea(u) ? A.pastiglia('Attivo', 'ok') : A.pastiglia('Invito non ancora aperto', 'blu');
      return `<div class="tessera ges-carta">
        <div class="tt"><h3><span class="avatar">${h(A.iniziali(u.nome))}</span> ${h(u.nome)}</h3>${st}</div>
        <div class="cp">
          <div class="ges-riga-i">${icona('posta', 'p')}<div>${h(u.email || '—')}</div></div>
          <div class="ges-riga-i">${icona('orologio', 'p')}<div>${u.ultimoAccesso ? 'Ultimo accesso ' + h(A.quando(u.ultimoAccesso)) : 'Non è ancora entrato'}</div></div>
          ${altri.length ? `<div class="ges-riga-i">${icona('edificio', 'p')}<div>Vede anche: ${h(altri.join(', '))}</div></div>` : ''}
          <div class="ges-riga-i">${icona('lucchetto', 'p')}<div class="t2">${u.invitoAccettato || u.password && !/^pw_/.test(u.password) ? 'Entra con il link via email o con la sua password' : 'Entra con il link via email, senza password'}</div></div>
        </div>
        <div class="ges-piede">
          ${u.attivo !== false ? `<button class="btn pic" type="button" data-az="ges-acc-link" data-id="${h(u.id)}" data-cliente="${h(c.id)}">${icona('invia', 'p')} Manda un nuovo link di accesso</button>` : ''}
          <button class="btn pic ${u.attivo === false ? '' : 'per'}" type="button" data-az="ges-acc-attivo" data-id="${h(u.id)}">${icona(u.attivo === false ? 'ricarica' : 'lucchetto', 'p')} ${u.attivo === false ? 'Riattiva accesso' : 'Disattiva accesso'}</button>
          ${altri.length ? `<button class="btn pic" type="button" data-az="ges-acc-scollega" data-id="${h(u.id)}" data-cliente="${h(c.id)}">${icona('x', 'p')} Scollega da questo cliente</button>` : ''}
        </div>
      </div>`;
    }).join('');
    const collegabili = A.DB.utenti.filter(u => u.ruolo === 'cliente' && !(u.clienti || []).includes(c.id)).length;
    return `<div class="avviso" style="margin-bottom:16px">${icona('scudo')}<div>Dall'area clienti ${h(c.nome)} vede i suoi preventivi (e li accetta con un clic), i rapportini approvati, le foto che scegli tu, i documenti visibili, e scrive all'ufficio. Non vede mai costi, margini, note interne né altri clienti. Si entra con un link via email, senza password da ricordare.</div></div>
      <div class="ges-intesta"><p>${acc.length ? plurale(acc.length, 'persona può', 'persone possono') + ' entrare per questo cliente.' : 'Nessuno può ancora entrare per questo cliente.'}</p>
        <div class="btns">${collegabili ? `<button class="btn" type="button" data-az="ges-acc-collega" data-cliente="${h(c.id)}">${icona('graffetta')} Collega un utente esistente</button>` : ''}<button class="btn pri" type="button" data-az="ges-acc-crea" data-cliente="${h(c.id)}">${icona('piu')} Crea accesso</button></div></div>
      ${acc.length ? `<div class="ges-carte">${carte}</div>` : vuotoTessera('Area clienti non attiva', 'Crea l\'accesso: il cliente riceve un\'email con il link per entrare. Un amministratore che ha già altri condomini si collega invece con «Collega un utente esistente».', 'utente')}`;
  }
  function nomeReferente(c) { return String(c.referente || '').replace(/\s*\(.*\)\s*$/, '').trim() || (c.tipo === 'privato' ? c.nome : ''); }
  /** Crea l'utente «cliente» e il link d'invito. FUORI da A.modifica (creaLink scrive da sé). */
  function creaAccesso(cid, nome, email) {
    const uid = A.uid('u');
    A.modifica(db => {
      const c = db.clienti.find(x => x.id === cid);
      // Nessuna password nota a nessuno: si entra con il link. La password,
      // se la vuole, se la sceglie il cliente all'invito.
      db.utenti.push({ id: uid, ruolo: 'cliente', nome, email, telefono: c ? c.telefono || '' : '', password: A.uid('pw'), clienti: [cid], attivo: true, preferenze: { email: true }, creato: A.adesso(), invitatoIl: A.adesso() });
      if (c) c.portale = true;
      A.registra('accesso area clienti creato', nome + ' — ' + (c ? c.nome : ''));
    });
    const link = A.creaLink(uid, 'invito');
    return { uid, link };
  }
  function emailInvito(db, nome, email, cid, link, extra) {
    db.email.unshift({ id: A.uid('eml'), data: A.adesso(), a: email, oggetto: 'IDRAL — il suo accesso all\'area clienti', testo: 'Gentile ' + nome + ',\nIDRAL le ha aperto l\'area clienti per «' + nomeCli(cid) + '»: da lì vede preventivi, lavori e documenti, e può scriverci.\n' + (extra ? '\n' + extra + '\n' : '') + '\nPer entrare (il link vale 24 ore, nessuna password da ricordare):\n' + link + '\n\nIDRAL — ' + db.azienda.telefono });
  }
  function mostraLinkCreato(titolo, testo, link) {
    A.modale({
      titolo, corpo: `<div class="avviso ok" style="margin-bottom:14px">${icona('spunta')}<div>${testo}</div></div>
        <p class="etichetta" style="margin-bottom:6px">Il link che riceve</p>${bloccoLink(link, 'Nella demo l\'email non parte davvero: la trovi in <a href="#/u/posta">Posta in uscita</a>. Il link si può anche mandare su WhatsApp o per SMS. Vale 24 ore.')}`,
      azioni: [{ testo: 'Fatto', classe: 'pri', chiudi: true }]
    });
  }
  A.azione('ges-acc-crea', el => {
    const c = A.cliente(el.dataset.cliente); if (!c) return;
    A.modale({
      titolo: 'Crea l\'accesso all\'area clienti', form: 'ges-acc-crea-ok',
      corpo: `<input type="hidden" name="clienteId" value="${h(c.id)}">
        <p style="font-size:14px;margin-bottom:14px">Per <b>${h(c.nome)}</b>. Riceve un'email con il link per entrare: niente password da inventare.</p>
        <div class="campo"><label for="ges-ac-nome">Nome di chi entra</label><input id="ges-ac-nome" name="nome" type="text" value="${h(nomeReferente(c))}" required></div>
        <div class="campo"><label for="ges-ac-email">Email</label><input id="ges-ac-email" name="email" type="email" value="${h(c.email || '')}" required></div>${divErr}`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: 'Crea e manda l\'invito', classe: 'pri', tipo: 'submit', icona: 'invia' }]
    });
  });
  A.azione('ges-acc-crea-ok', (f, ev, d) => {
    const cid = d.clienteId; const nome = String(d.nome || '').trim(); const email = String(d.email || '').trim().toLowerCase();
    if (!nome) return erroreModale('Scrivi il nome di chi entra.');
    if (!emailValida(email)) return erroreModale('Serve un\'email valida: il link arriva lì.');
    const gia = A.DB.utenti.find(u => u.email && u.email.toLowerCase() === email);
    if (gia && gia.ruolo !== 'cliente') return erroreModale('Questa email è già usata da ' + gia.nome + ' (' + A.ETICHETTA_RUOLO[gia.ruolo] + ').');
    if (gia) {
      // Stessa persona (es. un amministratore con altri condomini): si collega, non si duplica.
      if (!(gia.clienti || []).includes(cid)) A.modifica(db => { db.utenti.find(u => u.id === gia.id).clienti.push(cid); db.clienti.find(x => x.id === cid).portale = true; A.registra('accesso area clienti collegato', gia.nome + ' — ' + nomeCli(cid)); });
      const link = A.creaLink(gia.id, 'accesso');
      A.modifica(db => emailInvito(db, gia.nome, gia.email, cid, link, 'Da oggi nella sua area trova anche «' + nomeCli(cid) + '».'));
      A.render();
      return mostraLinkCreato('Utente collegato', h(gia.nome) + ' aveva già un accesso: ora vede anche <b>' + h(nomeCli(cid)) + '</b>.', link);
    }
    const r = creaAccesso(cid, nome, email);
    A.modifica(db => emailInvito(db, nome, email, cid, r.link));
    A.render();
    mostraLinkCreato('Accesso creato', 'Abbiamo mandato a <b>' + h(email) + '</b> l\'invito per entrare nell\'area clienti.', r.link);
  });
  A.azione('ges-acc-collega', el => {
    const c = A.cliente(el.dataset.cliente); if (!c) return;
    const lista = A.DB.utenti.filter(u => u.ruolo === 'cliente' && !(u.clienti || []).includes(c.id)).sort((a, b) => a.nome.localeCompare(b.nome));
    A.modale({
      titolo: 'Collega un utente esistente', form: 'ges-acc-collega-ok',
      corpo: `<input type="hidden" name="clienteId" value="${h(c.id)}">
        <p style="font-size:14px;margin-bottom:14px">Per chi ha già un accesso e segue anche <b>${h(c.nome)}</b> — per esempio l'amministratore di più condomini. Con lo stesso accesso passa da un cliente all'altro.</p>
        <div class="campo"><label for="ges-acc-u">Utente</label><select id="ges-acc-u" name="utenteId">${lista.map(u => `<option value="${h(u.id)}">${h(u.nome)} — ${h(u.email || '')} (${plurale((u.clienti || []).length, 'cliente', 'clienti')})</option>`).join('')}</select></div>
        <label class="spunta"><input type="checkbox" name="avvisa" checked> Mandagli un'email per dirglielo</label>`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: 'Collega', classe: 'pri', tipo: 'submit', icona: 'graffetta' }]
    });
  });
  A.azione('ges-acc-collega-ok', (f, ev, d) => {
    const u = A.utenteDa(d.utenteId); const cid = d.clienteId; if (!u) return;
    A.modifica(db => {
      const x = db.utenti.find(y => y.id === u.id); x.clienti = x.clienti || []; if (!x.clienti.includes(cid)) x.clienti.push(cid);
      db.clienti.find(y => y.id === cid).portale = true;
      if (d.avvisa && u.email) db.email.unshift({ id: A.uid('eml'), data: A.adesso(), a: u.email, oggetto: 'IDRAL — nella sua area clienti c\'è anche ' + nomeCli(cid), testo: 'Gentile ' + u.nome + ',\nda oggi nella sua area clienti IDRAL trova anche «' + nomeCli(cid) + '»: lo sceglie dal menu in alto.\n\n' + linkAssoluto('#/c/home') + '\n\nIDRAL — ' + db.azienda.telefono });
      A.registra('accesso area clienti collegato', u.nome + ' — ' + nomeCli(cid));
    });
    A.chiudiModale(); A.toast(u.nome + ' ora vede anche ' + nomeCli(cid), 'ok'); A.render();
  });
  A.azione('ges-acc-link', el => {
    const u = A.utenteDa(el.dataset.id); if (!u) return;
    const cid = el.dataset.cliente || (u.clienti || [])[0];
    const link = A.creaLink(u.id, 'accesso');
    A.modifica(db => {
      db.email.unshift({ id: A.uid('eml'), data: A.adesso(), a: u.email, oggetto: 'Il tuo link per entrare nell\'area clienti IDRAL', testo: 'Gentile ' + u.nome + ',\necco il link per entrare nell\'area clienti (vale 24 ore, si usa una volta):\n' + link + '\n\nIDRAL — ' + db.azienda.telefono });
      A.registra('link di accesso mandato', u.nome + (cid ? ' — ' + nomeCli(cid) : ''));
    });
    mostraLinkCreato('Nuovo link mandato', 'Abbiamo mandato a <b>' + h(u.email) + '</b> un nuovo link per entrare.', link);
  });
  A.azione('ges-acc-attivo', async el => {
    const u = A.utenteDa(el.dataset.id); if (!u) return;
    const spegni = u.attivo !== false;
    const altri = (u.clienti || []).length;
    if (spegni && !await A.conferma(h(u.nome) + ' non potrà più entrare nell\'area clienti' + (altri > 1 ? ' — per <b>tutti</b> i ' + altri + ' clienti che segue' : '') + '. I suoi dati restano.', { ok: 'Disattiva', pericolo: true, titolo: 'Disattivare l\'accesso?' })) return;
    A.modifica(db => {
      const x = db.utenti.find(y => y.id === u.id); x.attivo = !spegni;
      (x.clienti || []).forEach(cid => { const c = db.clienti.find(y => y.id === cid); if (c) c.portale = db.utenti.some(v => v.ruolo === 'cliente' && v.attivo !== false && (v.clienti || []).includes(cid)); });
      A.registra(spegni ? 'accesso disattivato' : 'accesso riattivato', u.nome + ' (' + A.ETICHETTA_RUOLO[u.ruolo] + ')');
    });
    A.toast(spegni ? 'Accesso disattivato' : 'Accesso riattivato', 'ok'); A.render();
  });
  A.azione('ges-acc-scollega', async el => {
    const u = A.utenteDa(el.dataset.id); const cid = el.dataset.cliente; if (!u) return;
    if (!await A.conferma(h(u.nome) + ' non vedrà più ' + h(nomeCli(cid)) + ' nella sua area. Gli altri clienti restano.', { ok: 'Scollega', pericolo: true })) return;
    A.modifica(db => {
      const x = db.utenti.find(y => y.id === u.id); x.clienti = (x.clienti || []).filter(k => k !== cid);
      const c = db.clienti.find(y => y.id === cid); if (c) c.portale = db.utenti.some(v => v.ruolo === 'cliente' && v.attivo !== false && (v.clienti || []).includes(cid));
      A.registra('accesso scollegato', u.nome + ' — ' + nomeCli(cid));
    });
    A.toast('Scollegato', 'ok'); A.render();
  });

  rotta('#/u/cliente/:id', paginaCliente);

  // ===========================================================================
  // 3. PREVENTIVI — elenco, editor, invio, revisioni, trasformazione in intervento
  // ===========================================================================
  const IN_ATTESA = ['inviato', 'visto'];
  const TIPI_RIGA = { materiale: 'Materiale', manodopera: 'Manodopera', servizio: 'Servizio', nota: 'Nota' };
  const ALIQUOTE = [22, 10, 4, 0];
  const CONDIZIONI = 'Validità 30 giorni. Pagamento: 30% all\'accettazione, saldo a fine lavori. Prezzi IVA esclusa.';
  const scadutoData = p => IN_ATTESA.includes(p.stato) && p.validoFino && String(p.validoFino).slice(0, 10) < A.oggi();
  const importoRiga = r => A.arrot((Number(r.qta) || 0) * (Number(r.prezzo) || 0) * (1 - (Number(r.sconto) || 0) / 100));
  function nPrev(p) { return 'N. ' + p.numero + (p.versione > 1 ? ' rev. ' + p.versione : ''); }
  function pillStatoPrev(p) { return scadutoData(p) ? A.pastiglia('Scaduto (' + A.STATI_PREVENTIVO[p.stato][0].toLowerCase() + ')', 'warn') : A.statoPreventivo(p.stato); }
  function cellaScadenza(p) {
    if (!p.validoFino) return '<span class="muto">—</span>';
    if (!IN_ATTESA.includes(p.stato)) return `<span class="muto ges-num">${h(A.data(p.validoFino))}</span>`;
    const g = A.diffGiorni(A.oggi(), p.validoFino);
    if (g < 0) return A.pastiglia('scaduto il ' + A.data(p.validoFino), 'dang');
    if (g <= 7) return A.pastiglia(g === 0 ? 'scade oggi' : 'scade tra ' + plurale(g, 'giorno', 'giorni'), 'warn');
    return `<span class="ges-num">${h(A.data(p.validoFino))}</span>`;
  }
  function tabellaPreventivi(lista, opz) {
    opz = opz || {};
    const conCli = opz.cliente !== false;
    const riga = p => {
      const t = A.totaliPreventivo(p); const c = A.cliente(p.clienteId);
      return `<tr class="clic" data-az="ges-prv-apri" data-id="${h(p.id)}">
        <td class="ges-prima"><a class="ges-cod" href="#/u/preventivo/${h(p.id)}">${h(p.numero)}</a>${p.versione > 1 ? ' <span class="ges-chip">rev. ' + p.versione + '</span>' : ''}<div class="t2">${h(A.data(p.creato))}</div></td>
        ${conCli ? `<td data-l="Cliente"><b>${h(c ? c.nome : '—')}</b></td>` : ''}
        <td data-l="Oggetto" class="ges-nome">${h(taglia(p.oggetto || 'senza oggetto', 90))}</td>
        <td data-l="Importo" class="num"><b>${h(A.euro(t.imponibile))}</b><div class="t2">${h(A.euro(t.totale))} con IVA</div></td>
        <td data-l="Stato">${pillStatoPrev(p)}</td>
        <td data-l="Validità" class="num">${cellaScadenza(p)}</td>
      </tr>`;
    };
    return `<div class="tessera"><div class="tab-w"><table class="tab ges-resp"><thead><tr><th>Numero</th>${conCli ? '<th>Cliente</th>' : ''}<th>Oggetto</th><th class="num">Importo</th><th>Stato</th><th class="num">Valido fino al</th></tr></thead><tbody>${lista.map(riga).join('')}</tbody></table></div></div>`;
  }
  A.azione('ges-prv-apri', el => A.vai('#/u/preventivo/' + el.dataset.id));

  const FILTRI_PREV = { tutti: 'Tutti gli stati', bozza: 'Bozze', attesa: 'In attesa di risposta', accettato: 'Accettati (da trasformare)', convertito: 'Diventati intervento', rifiutato: 'Rifiutati', scaduti: 'Scaduti' };
  function filtraPreventivi(q) {
    const parole = norm(q.q).split(/\s+/).filter(Boolean);
    return A.DB.preventivi.filter(p => {
      const st = q.stato || 'tutti';
      if (st === 'attesa' && !(IN_ATTESA.includes(p.stato) && !scadutoData(p))) return false;
      if (st === 'scaduti' && !(p.stato === 'scaduto' || scadutoData(p))) return false;
      if (['bozza', 'accettato', 'convertito', 'rifiutato'].includes(st) && p.stato !== st) return false;
      if (q.cliente && p.clienteId !== q.cliente) return false;
      if (parole.length) { const t = norm([p.numero, p.oggetto, nomeCli(p.clienteId), (p.righe || []).map(r => r.descrizione).join(' ')].join(' ')); if (!parole.every(x => t.includes(x))) return false; }
      return true;
    }).sort((a, b) => String(b.creato).localeCompare(String(a.creato)));
  }
  function paginaPreventivi(par) {
    segnaLettiQui();
    const q = par.q; const db = A.DB; const oggi = A.oggi();
    const attesa = db.preventivi.filter(p => IN_ATTESA.includes(p.stato) && !scadutoData(p));
    const imp = l => l.reduce((s, p) => s + A.totaliPreventivo(p).imponibile, 0);
    const mese = oggi.slice(0, 7);
    const accMese = db.preventivi.filter(p => ['accettato', 'convertito'].includes(p.stato) && String(p.decisoIl || '').slice(0, 7) === mese);
    const anno = A.piuGiorni(oggi, -365);
    const decisi = db.preventivi.filter(p => p.decisoIl && String(p.decisoIl).slice(0, 10) >= anno && ['accettato', 'convertito', 'rifiutato'].includes(p.stato));
    const acc = decisi.filter(p => p.stato !== 'rifiutato').length;
    const tasso = decisi.length ? Math.round(acc / decisi.length * 100) : null;
    const daTrasf = db.preventivi.filter(p => p.stato === 'accettato' && !p.interventoId);
    const visti = attesa.filter(p => p.stato === 'visto').length;
    const lista = filtraPreventivi(q);
    const conFiltri = (q.stato && q.stato !== 'tutti') || q.cliente || q.q;
    const clientiCon = Array.from(new Set(db.preventivi.map(p => p.clienteId))).map(A.cliente).filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome));
    const contenuto = `<div class="ges-kpis">
        ${kpi({ cl: 'evid', ic: 'orologio', l: 'In attesa di risposta', v: h(A.euro(imp(attesa), true)), d: `<b>${plurale(attesa.length, 'preventivo', 'preventivi')}</b>${visti ? ` · <b>${visti}</b> già aperti dal cliente` : ''} · IVA esclusa`, link: '#/u/preventivi?stato=attesa' })}
        ${kpi({ ic: 'spunta', l: 'Accettati questo mese', v: h(A.euro(imp(accMese), true)), d: accMese.length ? plurale(accMese.length, 'preventivo', 'preventivi') + ' · IVA esclusa' : 'Ancora nessuno questo mese' })}
        ${kpi({ ic: 'grafico', l: 'Tasso di accettazione', v: tasso === null ? '—' : tasso + '<small> %</small>', d: decisi.length ? `<b>${acc}</b> accettati su <b>${decisi.length}</b> decisi negli ultimi 12 mesi` : 'Nessun preventivo deciso negli ultimi 12 mesi' })}
        ${kpi({ cl: daTrasf.length ? '' : '', ic: 'chiave', l: 'Da trasformare in intervento', v: String(daTrasf.length), d: daTrasf.length ? 'Accettati che aspettano di essere pianificati' : 'Nessuno in attesa', link: '#/u/preventivi?stato=accettato' })}
      </div>
      <div class="ges-filtri">
        ${campoCerca('ges-prv-cerca', q.q, 'Cerca numero, oggetto, cliente, voce…')}
        ${selFiltro('stato', q.stato || 'tutti', Object.keys(FILTRI_PREV).map(k => [k, FILTRI_PREV[k]]), 'Stato')}
        ${selFiltro('cliente', q.cliente, [['', 'Tutti i clienti']].concat(clientiCon.map(c => [c.id, c.nome])), 'Cliente')}
        ${conFiltri ? `<a class="btn vuoto pic" href="#/u/preventivi">${icona('x', 'p')} Togli i filtri</a>` : ''}
      </div>
      ${lista.length ? tabellaPreventivi(lista) : vuotoTessera(conFiltri ? 'Nessun preventivo trovato' : 'Ancora nessun preventivo', conFiltri ? 'Prova a cambiare i filtri.' : 'Crea il primo: si compone dal catalogo in un minuto.', 'documento')}`;
    return pagina({ attivo: 'preventivi', titolo: 'Preventivi', briciole: [['Clienti', '#/u/clienti']], azioni: `<button class="btn acc" type="button" data-az="ges-prv-nuovo">${icona('piu')}<span class="ges-nt">Nuovo preventivo</span></button>`, contenuto });
  }

  function schedaPreventiviCliente(c, prevs) {
    const lista = prevs.slice().sort((a, b) => String(b.creato).localeCompare(String(a.creato)));
    return `<div class="ges-intesta"><p>${lista.length ? plurale(lista.length, 'preventivo', 'preventivi') + ' per questo cliente.' : 'Nessun preventivo per questo cliente.'}</p><button class="btn pri" type="button" data-az="ges-prv-nuovo" data-cliente="${h(c.id)}">${icona('piu')} Nuovo preventivo</button></div>
      ${lista.length ? tabellaPreventivi(lista, { cliente: false }) : vuotoTessera('Nessun preventivo', 'Crea il primo: scegli le voci dal catalogo e mandalo al cliente.', 'documento')}`;
  }

  // ---- nuovo preventivo: cliente e luogo, poi subito l'editor
  function opzioniSedi(cid, sel) {
    const s = cid ? A.sediDi(cid) : [];
    return s.length ? s.map(x => `<option value="${h(x.id)}"${sel === x.id ? ' selected' : ''}>${h(x.nome + ' — ' + A.indirizzo(x))}</option>`).join('') : '<option value="">— nessuna sede —</option>';
  }
  A.azione('ges-prv-nuovo', el => {
    const cid = el.dataset.cliente || '';
    const clienti = A.DB.clienti.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
    A.modale({
      titolo: 'Nuovo preventivo', form: 'ges-prv-crea',
      corpo: `<div class="campo"><label for="ges-np-cli">Cliente</label><select id="ges-np-cli" name="clienteId" data-cambia="ges-np-cli"><option value="">— scegli il cliente —</option>${clienti.map(c => `<option value="${h(c.id)}"${c.id === cid ? ' selected' : ''}>${h(c.nome)}</option>`).join('')}</select><span class="aiuto">Non c'è? <a href="#" data-az="ges-cli-nuovo">Crealo prima</a>.</span></div>
        <div class="campo"><label for="ges-np-sede">Luogo del lavoro</label><select id="ges-np-sede" name="sedeId">${opzioniSedi(cid)}</select></div>
        <div class="campo"><label for="ges-np-ogg">Oggetto <span class="muto">(si può scrivere dopo)</span></label><input id="ges-np-ogg" name="oggetto" type="text" placeholder="Sostituzione caldaia con condensazione"></div>${divErr}`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: 'Crea e compila', classe: 'pri', tipo: 'submit', icona: 'avanti' }]
    });
  });
  A.azione('ges-np-cli', el => { const s = A.$('#ges-np-sede'); if (s) s.innerHTML = opzioniSedi(el.value); });
  function creaBozza(db, clienteId, sedeId, oggetto) {
    const u = A.utente(); const id = A.uid('prv');
    db.preventivi.push({ id, numero: A.numera('PRV'), versione: 1, clienteId, sedeId: sedeId || (A.sediDi(clienteId)[0] || {}).id || null, oggetto: oggetto || '', righe: [], stato: 'bozza', creato: A.adesso(), inviatoIl: null, vistoIl: null, decisoIl: null, validoFino: A.piuGiorni(A.oggi(), 30), note: '', condizioni: CONDIZIONI, decisione: null, eventi: [{ tipo: 'creato', data: A.adesso(), chi: u.nome }], interventoId: null });
    return id;
  }
  A.azione('ges-prv-crea', (f, ev, d) => {
    if (!A.cliente(d.clienteId)) return erroreModale('Scegli il cliente.');
    let id;
    A.modifica(db => { id = creaBozza(db, d.clienteId, d.sedeId, String(d.oggetto || '').trim()); A.registra('preventivo creato', nomeCli(d.clienteId) + (d.oggetto ? ' — ' + d.oggetto : '')); });
    A.chiudiModale(); A.vai('#/u/preventivo/' + id);
  });

  // ---- l'editor
  function margineInterno(p) {
    let ricMat = 0, costoMat = 0, manod = 0, oreMan = 0, senzaCosto = 0;
    (p.righe || []).forEach(r => {
      if (r.tipo === 'nota' || (r.opzionale && !r.scelta)) return;
      const imp = importoRiga(r); const a = r.articoloId ? A.articolo(r.articoloId) : null;
      if (a) { ricMat += imp; costoMat += (Number(r.qta) || 0) * (Number(a.costo) || 0); }
      else if (r.tipo === 'manodopera') { manod += imp; oreMan += Number(r.qta) || 0; }
      else if (imp) senzaCosto++;
    });
    const marg = ricMat - costoMat;
    return { ricMat: A.arrot(ricMat), costoMat: A.arrot(costoMat), marg: A.arrot(marg), pct: ricMat ? Math.round(marg / ricMat * 100) : null, manod: A.arrot(manod), oreMan, senzaCosto };
  }
  function htmlTotali(p) {
    const t = A.totaliPreventivo(p);
    return `<div class="ges-tot-r"><span>Imponibile</span><b>${h(A.euro(t.imponibile))}</b></div>
      ${Object.keys(t.perAliquota).sort((a, b) => b - a).map(al => `<div class="ges-tot-r ges-t2"><span>IVA ${h(al)}% su ${h(A.euro(t.perAliquota[al]))}</span><span>${h(A.euro(A.arrot(t.perAliquota[al] * al / 100)))}</span></div>`).join('')}
      <div class="ges-tot-r ges-tot-f"><span>Totale</span><b>${h(A.euro(t.totale))}</b></div>
      ${t.opzionali ? `<div class="ges-tot-r ges-tot-opz"><span>${icona('stella', 'p')} Voci facoltative, a parte</span><span>+ ${h(A.euro(t.opzionali))} + IVA</span></div>` : ''}`;
  }
  function htmlMargine(p) {
    const m = margineInterno(p);
    const tono = m.pct === null ? '' : m.pct < 20 ? 'ges-giu' : 'ges-su';
    return `<div class="ges-tot-r"><span>Materiali da catalogo, a prezzo</span><b>${h(A.euro(m.ricMat))}</b></div>
      <div class="ges-tot-r"><span>Costo d'acquisto dei materiali</span><span>− ${h(A.euro(m.costoMat))}</span></div>
      <div class="ges-tot-r ges-tot-f"><span>Margine sui materiali</span><b class="${tono}">${h(A.euro(m.marg))}${m.pct !== null ? ' (' + m.pct + '%)' : ''}</b></div>
      ${m.manod ? `<div class="ges-tot-r ges-t2"><span>Manodopera: ${h(A.num(m.oreMan))} ore</span><span>${h(A.euro(m.manod))}</span></div>` : ''}
      ${m.senzaCosto ? `<div class="ges-tot-r ges-t2"><span>${plurale(m.senzaCosto, 'voce', 'voci')} senza costo noto (servizi, materiale fuori catalogo)</span><span></span></div>` : ''}`;
  }
  function rigaEditor(p, r, k, n) {
    const a = r.articoloId ? A.articolo(r.articoloId) : null;
    const disp = a ? A.giacenza(a.id, 'mag_sede') : null;
    const opz = r.opzionale;
    return `<div class="ges-riga ${h(r.tipo)}${opz ? ' opz' : ''}" data-r="${h(r.id)}">
      <div class="ges-r-sposta"><button type="button" data-az="ges-rg-sposta" data-v="-1" aria-label="Sposta su"${k === 0 ? ' disabled' : ''}>${icona('giu', 'p')}</button><button type="button" data-az="ges-rg-sposta" data-v="1" aria-label="Sposta giù"${k === n - 1 ? ' disabled' : ''}>${icona('giu', 'p')}</button></div>
      <div class="ges-r-corpo">
        <div class="ges-r-l1">
          <select data-cambia="ges-rg-campo" data-k="tipo" aria-label="Tipo di voce">${Object.keys(TIPI_RIGA).map(t => `<option value="${t}"${r.tipo === t ? ' selected' : ''}>${h(TIPI_RIGA[t])}</option>`).join('')}</select>
          ${r.tipo === 'nota' ? `<textarea rows="2" data-digita="ges-rg-campo" data-k="descrizione" placeholder="Una nota per il cliente (non ha prezzo)" aria-label="Testo della nota">${h(r.descrizione || '')}</textarea>` : `<input type="text" value="${h(r.descrizione || '')}" data-digita="ges-rg-campo" data-k="descrizione" placeholder="Descrizione della voce" aria-label="Descrizione">`}
        </div>
        ${r.tipo === 'nota' ? '' : `<div class="ges-r-l2">
          <label>Q.tà <input class="w-q" type="text" inputmode="decimal" value="${h(numCampo(r.qta))}" data-digita="ges-rg-campo" data-k="qta"></label>
          <label>Unità <input class="w-u" type="text" value="${h(r.unita || '')}" data-digita="ges-rg-campo" data-k="unita"></label>
          <label>Prezzo € <input class="w-p" type="text" inputmode="decimal" value="${h(numCampo(r.prezzo, 2))}" data-digita="ges-rg-campo" data-k="prezzo"></label>
          <label>Sconto % <input class="w-s" type="text" inputmode="decimal" value="${h(numCampo(r.sconto || 0, 2))}" data-digita="ges-rg-campo" data-k="sconto"></label>
          <label>IVA <select data-cambia="ges-rg-campo" data-k="iva">${ALIQUOTE.map(al => `<option value="${al}"${Number(r.iva === undefined ? 22 : r.iva) === al ? ' selected' : ''}>${al}%</option>`).join('')}</select></label>
          <label class="ges-r-opz"><input type="checkbox" data-cambia="ges-rg-campo" data-k="opzionale"${opz ? ' checked' : ''}> Facoltativa</label>
          ${a ? `<span class="ges-r-costo">${h(a.codice)} · costo ${h(A.euro(a.costo))} · al deposito ${h(A.num(disp))} ${h(a.unita)}</span>` : ''}
        </div>`}
      </div>
      <div class="ges-r-imp">${r.tipo === 'nota' ? '' : h(A.euro(importoRiga(r)))}${opz ? '<small>facoltativa, fuori dal totale</small>' : ''}</div>
      <button class="ges-r-x" type="button" data-az="ges-rg-togli" aria-label="Togli la voce">${icona('cestino', 'p')}</button>
    </div>`;
  }
  function rigaLettura(r) {
    if (r.tipo === 'nota') return `<div class="ges-riga ro nota"><div></div><div class="ges-r-corpo"><div class="ges-r-nota">${icona('info', 'p')} ${h(r.descrizione)}</div></div><div></div></div>`;
    const a = r.articoloId ? A.articolo(r.articoloId) : null;
    return `<div class="ges-riga ro${r.opzionale ? ' opz' : ''}"><div></div><div class="ges-r-corpo"><div class="ges-r-desc">${h(r.descrizione)}</div>
      <div class="ges-t2">${h(A.num(r.qta))} ${h(r.unita || '')} × ${h(A.euro(r.prezzo))}${r.sconto ? ' − ' + h(A.num(r.sconto)) + '%' : ''} · IVA ${h(r.iva === undefined ? 22 : r.iva)}%${a ? ' · ' + h(a.codice) + ' · costo ' + h(A.euro(a.costo)) : ''}${r.opzionale ? (r.scelta ? ' · <b style="color:var(--ok)">facoltativa scelta dal cliente</b>' : ' · facoltativa, non scelta') : ''}</div></div>
      <div class="ges-r-imp">${h(A.euro(importoRiga(r)))}${r.opzionale && !r.scelta ? '<small>fuori dal totale</small>' : ''}</div></div>`;
  }
  const NOMI_EVENTO = { creato: 'Creato', inviato: 'Inviato al cliente', aperto: 'Aperto dal cliente', accettato: 'Accettato dal cliente', rifiutato: 'Rifiutato dal cliente', convertito: 'Diventato intervento', revisione: 'Sostituito da una nuova revisione', scaduto: 'Segnato come scaduto', duplicato: 'Duplicato' };
  function cronologiaPrev(p) {
    const ev = (p.eventi || []);
    if (!ev.length) return '<p class="muto" style="font-size:14px">Nessun evento.</p>';
    return `<ol class="ges-eventi">${ev.map(e => {
      const cl = e.tipo === 'accettato' || e.tipo === 'convertito' ? 'ok' : e.tipo === 'rifiutato' ? 'dang' : e.tipo === 'aperto' ? 'acc' : '';
      let extra = '';
      if (e.tipo === 'accettato' && p.decisione && p.decisione.esito === 'accettato') extra = `<div class="t2">da ${h(p.decisione.nome)}${p.decisione.ua ? ' · ' + h(p.decisione.ua) : ''}</div>${p.decisione.hash ? `<div class="ges-impronta">Impronta SHA-256: ${h(p.decisione.hash)}</div>` : ''}`;
      if (e.tipo === 'rifiutato' && p.decisione && p.decisione.motivo) extra = `<div class="t2">Motivo: «${h(p.decisione.motivo)}»</div>`;
      if (e.nota) extra += `<div class="t2">${h(e.nota)}</div>`;
      return `<li class="${cl}"><b>${h(NOMI_EVENTO[e.tipo] || cap(e.tipo))}</b><div class="t2">${h(A.dataOra(e.data))}${e.chi ? ' · ' + h(e.chi) : ''}</div>${extra}</li>`;
    }).join('')}</ol>`;
  }
  function conversazioniDi(tipo, ids) { return A.DB.conversazioni.filter(x => x.contesto && x.contesto.tipo === tipo && ids.includes(x.contesto.id)); }
  function conversazioneBreve(convs, crea) {
    if (!convs.length) return `<p class="muto" style="font-size:14px;margin-bottom:10px">Nessun messaggio su questo preventivo.</p>${crea}`;
    const x = convs.sort((a, b) => String(b.aggiornato).localeCompare(String(a.aggiornato)))[0];
    const ultimi = (x.messaggi || []).slice(-3);
    return `<div class="ges-mini-chat">${ultimi.map(m => `<div class="bolla ${m.da === 'azienda' ? 'mia' : ''}">${h(taglia(m.testo, 220))}<span class="md">${h(m.da === 'azienda' ? A.nomeBreve(nomeUtente(m.autoreId)) : autoreMsg(m, x))} · ${h(A.quando(m.data))}</span></div>`).join('')}</div>
      <a class="btn pic" href="#/u/messaggi/${h(x.id)}" style="margin-top:10px">${icona('messaggio', 'p')} ${x.lettoAzienda ? 'Apri la conversazione' : 'Leggi e rispondi'}</a>`;
  }
  function autoreMsg(m, conv) { const u = m.autoreId ? A.utenteDa(m.autoreId) : null; return u ? u.nome : nomeCli(conv.clienteId); }

  function paginaPreventivo(par) {
    const p = A.preventivo(par.id);
    if (!p) return nonTrovato('preventivi', 'Preventivo non trovato', [['Preventivi', '#/u/preventivi']], 'Forse era una bozza ed è stata eliminata.', ['Torna ai preventivi', '#/u/preventivi']);
    segnaLettiQui();
    const c = A.cliente(p.clienteId) || { id: '', nome: 'Cliente' }; const s = A.sede(p.sedeId);
    const bozza = p.stato === 'bozza'; const id = h(p.id);
    const t = A.totaliPreventivo(p);
    const scad = scadutoData(p);
    const intv = p.interventoId ? A.intervento(p.interventoId) : null;
    const sost = p.sostituitoDa ? A.preventivo(p.sostituitoDa) : null, prima = p.revisioneDi ? A.preventivo(p.revisioneDi) : null;

    // --- azioni coerenti con lo stato
    const az = [], sec = [];
    const bStampa = `<a class="btn${bozza ? '' : ' pic'}" href="#/u/preventivo/${id}/stampa">${icona('stampa', bozza ? '' : 'p')} Anteprima e stampa</a>`;
    if (bozza) {
      az.push(`<button class="btn acc" type="button" data-az="ges-prv-invia" data-id="${id}">${icona('invia')} Invia al cliente</button>`);
      az.push(`<button class="btn pri" type="button" data-az="ges-prv-salva" data-id="${id}">${icona('spunta')} Salva</button>`);
      az.push(bStampa);
      sec.push(`<button class="btn pic" type="button" data-az="ges-prv-duplica" data-id="${id}">${icona('copia', 'p')} Duplica</button>`);
      if (!p.inviatoIl) sec.push(`<button class="btn pic per" type="button" data-az="ges-prv-elimina" data-id="${id}">${icona('cestino', 'p')} Elimina bozza</button>`);
    } else {
      if (p.stato === 'accettato' && !p.interventoId) az.push(`<button class="btn acc" type="button" data-az="ges-prv-intervento" data-id="${id}">${icona('chiave')} Trasforma in intervento</button>`);
      if (intv) az.push(`<a class="btn pri" href="#/u/intervento/${h(intv.id)}">${icona('chiave')} Vai all'intervento N. ${h(intv.numero)}</a>`);
      if (!sost && ['inviato', 'visto', 'rifiutato', 'scaduto', 'accettato'].includes(p.stato)) az.push(`<button class="btn ${p.stato === 'accettato' ? '' : 'pri'}" type="button" data-az="ges-prv-revisione" data-id="${id}">${icona('modifica')} Nuova revisione</button>`);
      sec.push(bStampa);
      sec.push(`<button class="btn pic" type="button" data-az="ges-prv-duplica" data-id="${id}">${icona('copia', 'p')} Duplica</button>`);
      if (IN_ATTESA.includes(p.stato)) sec.push(`<button class="btn pic${scad ? ' pri' : ''}" type="button" data-az="ges-prv-scaduto" data-id="${id}">${icona('orologio', 'p')} Segna scaduto</button>`);
    }
    const testata = `<div class="tessera ges-testata">
      <div class="ges-t-su">
        <div class="ges-t-1"><span class="ges-t-num">${h(nPrev(p))}</span>${pillStatoPrev(p)}${IN_ATTESA.includes(p.stato) && !scad ? cellaScadenza(p) : ''}</div>
        <h2 id="ges-prv-ogg">${h(p.oggetto || 'Preventivo senza oggetto')}</h2>
        <div class="ges-t-meta">
          <a href="#/u/cliente/${h(c.id)}">${icona('edificio', 'p')}${h(c.nome)}</a>
          ${s ? `<span>${icona('mappa', 'p')}${h(A.indirizzo(s))}</span>` : ''}
          <span>${icona('calendario', 'p')}del ${h(A.data(p.creato))} · valido fino al ${h(A.data(p.validoFino))}</span>
        </div>
      </div>
      <div class="ges-t-barra"><div class="btns">${az.join('')}</div><div class="btns">${sec.join('')}</div></div>
    </div>`;

    const avvisi = [];
    if (!bozza && !sost) avvisi.push(`<div class="avviso">${icona('lucchetto')}<div>${p.inviatoIl ? 'Inviato ' + h(A.quando(p.inviatoIl)) + ': ' : ''}un preventivo mandato al cliente non si modifica, così quello che ha accettato resta quello che ha visto. Per cambiarlo crea una <b>nuova revisione</b>.</div></div>`);
    if (p.stato === 'accettato' && p.decisione) avvisi.push(`<div class="avviso ok">${icona('spunta')}<div><b>Accettato online da ${h(p.decisione.nome)}</b> il ${h(A.dataOra(p.decisione.data))}${p.decisione.ua ? ' (' + h(p.decisione.ua) + ')' : ''}.${p.interventoId ? '' : ' Adesso va trasformato in intervento e pianificato.'}${p.decisione.hash ? `<div class="ges-impronta">Impronta del documento accettato (SHA-256): ${h(p.decisione.hash)}</div>` : ''}</div></div>`);
    if (p.stato === 'rifiutato' && p.decisione) avvisi.push(`<div class="avviso dang">${icona('x')}<div><b>Rifiutato da ${h(p.decisione.nome)}</b> il ${h(A.dataOra(p.decisione.data))}${p.decisione.motivo ? ' — «' + h(p.decisione.motivo) + '»' : ''}.</div></div>`);
    if (scad) avvisi.push(`<div class="avviso warn">${icona('orologio')}<div><b>Scaduto il ${h(A.data(p.validoFino))}</b> senza risposta. Il cliente non può più accettarlo: segnalo scaduto oppure manda una nuova revisione con una nuova data.</div></div>`);
    if (sost) avvisi.push(`<div class="avviso">${icona('info')}<div>Sostituito dalla <a href="#/u/preventivo/${h(sost.id)}"><b>revisione ${h(sost.versione)}</b></a> (${A.statoPreventivo(sost.stato)}).</div></div>`);
    if (prima) avvisi.push(`<div class="avviso">${icona('storico')}<div>Revisione del <a href="#/u/preventivo/${h(prima.id)}">preventivo ${h(nPrev(prima))}</a> del ${h(A.data(prima.creato))}.</div></div>`);

    // --- intestazione
    const intest = bozza ? `<div class="tessera" data-prv="${id}"><div class="tt"><h3>${icona('modifica')} Intestazione</h3><span class="pic" id="ges-salvato" role="status"></span></div><div class="cp">
        <div class="ges-form-g">
          <div class="campo tutta"><label for="ges-pe-ogg">Oggetto</label><input id="ges-pe-ogg" type="text" value="${h(p.oggetto || '')}" data-digita="ges-prv-campo" data-k="oggetto" placeholder="Sostituzione caldaia con condensazione"></div>
          <div class="campo"><label for="ges-pe-sede">Luogo del lavoro</label><select id="ges-pe-sede" data-cambia="ges-prv-campo" data-k="sedeId">${opzioniSedi(c.id, p.sedeId)}</select></div>
          <div class="campo"><label for="ges-pe-val">Valido fino al</label><input id="ges-pe-val" type="date" value="${h(dataIso(p.validoFino))}" data-cambia="ges-prv-campo" data-k="validoFino"></div>
          <div class="campo tutta"><label for="ges-pe-note">Note <span class="muto">(le vede il cliente)</span></label><textarea id="ges-pe-note" rows="2" data-digita="ges-prv-campo" data-k="note" placeholder="Tempi, cosa è incluso, cosa serve dal cliente…">${h(p.note || '')}</textarea></div>
          <div class="campo tutta"><label for="ges-pe-cond">Condizioni</label><textarea id="ges-pe-cond" rows="2" data-digita="ges-prv-campo" data-k="condizioni">${h(p.condizioni || '')}</textarea></div>
        </div></div></div>`
      : `<div class="tessera"><div class="tt"><h3>${icona('documento')} Intestazione</h3></div><div class="cp"><dl class="dl"><dt>Cliente</dt><dd><a href="#/u/cliente/${h(c.id)}">${h(c.nome)}</a></dd><dt>Luogo</dt><dd>${h(s ? A.indirizzo(s) : '—')}</dd><dt>Valido fino al</dt><dd>${h(A.data(p.validoFino))}</dd>${p.note ? `<dt>Note</dt><dd>${h(p.note)}</dd>` : ''}<dt>Condizioni</dt><dd>${h(p.condizioni || '—')}</dd></dl></div></div>`;

    // --- voci
    const righe = p.righe || [];
    const voci = `<div class="tessera" data-prv="${id}"><div class="tt"><h3>${icona('elenco')} Voci <span class="ges-conta">${righe.length}</span></h3>${bozza ? '<span class="pic">si salva da solo mentre scrivi</span>' : ''}</div>
      ${righe.length ? `<div class="ges-righe">${righe.map((r, k) => bozza ? rigaEditor(p, r, k, righe.length) : rigaLettura(r)).join('')}</div>`
        : `<div class="cp">${A.vuoto('Nessuna voce', bozza ? 'Aggiungi materiale dal catalogo, manodopera, servizi o una nota.' : 'Questo preventivo non ha voci.', 'elenco')}</div>`}
      ${bozza ? `<div class="ges-agg">
        <button class="btn pri" type="button" data-az="ges-rg-catalogo">${icona('pacco')} Da catalogo</button>
        <button class="btn" type="button" data-az="ges-rg-agg" data-tipo="manodopera">${icona('orologio')} Manodopera</button>
        <button class="btn" type="button" data-az="ges-rg-agg" data-tipo="servizio">${icona('chiave')} Servizio</button>
        <button class="btn" type="button" data-az="ges-rg-agg" data-tipo="nota">${icona('info')} Nota</button>
      </div>` : ''}
      <div class="ges-totali" id="ges-prv-totali">${htmlTotali(p)}</div>
    </div>`;

    // --- colonna destra
    const riep = `<div class="tessera ges-riep"><div class="cp">
        <div class="pic">Totale per il cliente</div>
        <div class="ges-riep-v" id="ges-prv-tot">${h(A.euro(t.totale))}</div>
        <div class="pic" id="ges-prv-imp">${h(A.euro(t.imponibile))} + IVA${t.opzionali ? ' · facoltative a parte ' + h(A.euro(t.opzionali)) : ''}</div>
      </div></div>
      <div class="tessera"><div class="tt"><h3>${icona('lucchetto')} Margine interno</h3>${A.pastiglia('solo per te', 'grigio', true)}</div>
        <div class="cp ges-totali" id="ges-prv-margine" style="padding-top:12px">${htmlMargine(p)}</div>
        <div class="ges-dida">${icona('info', 'p')} Il cliente non vede mai costi e margini: né qui, né nella stampa, né nella sua area.</div></div>`;
    const convs = conversazioniDi('preventivo', [p.id].concat(p.revisioneDi ? [p.revisioneDi] : []));
    const conv = `<div class="tessera"><div class="tt"><h3>${icona('messaggio')} Conversazione</h3></div><div class="cp">${conversazioneBreve(convs, `<button class="btn pic" type="button" data-az="ges-scrivi" data-cliente="${h(c.id)}" data-ctipo="preventivo" data-cid="${id}" data-oggetto="${h('Preventivo ' + nPrev(p))}">${icona('messaggio', 'p')} Scrivi al cliente</button>`)}</div></div>`;
    const crono = `<div class="tessera"><div class="tt"><h3>${icona('storico')} Cronologia</h3></div><div class="cp">${cronologiaPrev(p)}</div></div>`;

    const contenuto = `${testata}${avvisi.length ? `<div class="ges-col" style="margin-top:14px;gap:10px">${avvisi.join('')}</div>` : ''}
      <div class="griglia g-2-1 ges-gr ges-scheda"><div class="ges-col">${intest}</div><div class="ges-col">${riep}</div></div>
      <div style="margin-top:16px">${voci}</div>
      <div class="griglia g2 ges-gr" style="margin-top:16px">${crono}${conv}</div>`;
    return pagina({ attivo: 'preventivi', titolo: 'Preventivo ' + nPrev(p), briciole: [['Preventivi', '#/u/preventivi']], contenuto });
  }

  // ---- modifica in linea: si salva a ogni tasto, i conti si aggiornano senza ridisegnare
  function prevModificabile(el) {
    const box = el.closest('[data-prv]'); if (!box) return null;
    const p = A.preventivo(box.dataset.prv);
    if (!p || p.stato !== 'bozza') { A.toast('Questo preventivo non è più una bozza', 'warn'); A.render(); return null; }
    return p;
  }
  let timerSalvato = null;
  function segnaSalvato() {
    const s = A.$('#ges-salvato'); if (!s) return;
    s.innerHTML = icona('spunta', 'p') + ' Salvato alle ' + A.ora(A.adesso());
    clearTimeout(timerSalvato); timerSalvato = setTimeout(() => { const x = A.$('#ges-salvato'); if (x) x.textContent = ''; }, 4000);
  }
  function aggiornaConti(p) {
    p = A.preventivo(p.id); const t = A.totaliPreventivo(p);
    const set = (sel, html) => { const e = A.$(sel); if (e) e.innerHTML = html; };
    set('#ges-prv-totali', htmlTotali(p)); set('#ges-prv-margine', htmlMargine(p));
    set('#ges-prv-tot', h(A.euro(t.totale))); set('#ges-prv-imp', h(A.euro(t.imponibile)) + ' + IVA' + (t.opzionali ? ' · facoltative a parte ' + h(A.euro(t.opzionali)) : ''));
    (p.righe || []).forEach(r => { const e = A.$('.ges-riga[data-r="' + r.id + '"] .ges-r-imp'); if (e && r.tipo !== 'nota') e.innerHTML = h(A.euro(importoRiga(r))) + (r.opzionale ? '<small>facoltativa, fuori dal totale</small>' : ''); });
    segnaSalvato();
  }
  A.azione('ges-prv-campo', el => {
    const p = prevModificabile(el); if (!p) return;
    const k = el.dataset.k; const v = el.value;
    if (k === 'validoFino' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
    A.modifica(db => { const x = db.preventivi.find(y => y.id === p.id); x[k] = k === 'oggetto' ? v.trimStart() : v; });
    if (k === 'oggetto') { const o = A.$('#ges-prv-ogg'); if (o) o.textContent = v.trim() || 'Preventivo senza oggetto'; }
    segnaSalvato();
  });
  A.azione('ges-rg-campo', el => {
    const p = prevModificabile(el); if (!p) return;
    const rid = el.closest('.ges-riga').dataset.r; const k = el.dataset.k;
    let ridisegna = false;
    A.modifica(db => {
      const r = db.preventivi.find(y => y.id === p.id).righe.find(y => y.id === rid); if (!r) return;
      if (k === 'qta' || k === 'prezzo' || k === 'sconto') r[k] = k === 'sconto' ? Math.max(0, Math.min(100, numDa(el.value))) : numDa(el.value);
      else if (k === 'iva') r.iva = Number(el.value);
      else if (k === 'opzionale') { r.opzionale = el.checked; r.scelta = false; ridisegna = true; }
      else if (k === 'tipo') {
        r.tipo = el.value; ridisegna = true;
        if (r.tipo === 'nota') { r.qta = 0; r.prezzo = 0; r.unita = ''; r.articoloId = null; }
        else if (r.tipo === 'manodopera' && !r.prezzo) { r.qta = r.qta || 1; r.unita = 'h'; r.prezzo = A.DB.azienda.tariffe.manodopera; }
        else if (!r.qta) { r.qta = 1; r.unita = r.unita || 'corpo'; }
      }
      else r[k] = el.value;
    });
    if (ridisegna) A.render(); else aggiornaConti(p);
  });
  A.azione('ges-rg-sposta', el => {
    const p = prevModificabile(el); if (!p) return;
    const rid = el.closest('.ges-riga').dataset.r; const v = Number(el.dataset.v);
    A.modifica(db => { const rr = db.preventivi.find(y => y.id === p.id).righe; const i = rr.findIndex(y => y.id === rid); const j = i + v; if (i < 0 || j < 0 || j >= rr.length) return; const tmp = rr[i]; rr[i] = rr[j]; rr[j] = tmp; });
    A.render();
  });
  A.azione('ges-rg-togli', el => {
    const p = prevModificabile(el); if (!p) return;
    const rid = el.closest('.ges-riga').dataset.r;
    A.modifica(db => { const x = db.preventivi.find(y => y.id === p.id); x.righe = x.righe.filter(y => y.id !== rid); });
    A.toast('Voce tolta', 'ok'); A.render();
  });
  function nuovaRiga(tipo, extra) { return Object.assign({ id: A.uid('rp'), tipo, articoloId: null, descrizione: '', qta: 1, unita: 'pz', prezzo: 0, iva: 22, sconto: 0, opzionale: false, scelta: false }, extra || {}); }
  A.azione('ges-rg-agg', el => {
    const p = prevModificabile(el); if (!p) return;
    const tipo = el.dataset.tipo; const t = A.DB.azienda.tariffe;
    const r = tipo === 'manodopera' ? nuovaRiga('manodopera', { descrizione: 'Manodopera', qta: 1, unita: 'h', prezzo: t.manodopera })
      : tipo === 'nota' ? nuovaRiga('nota', { qta: 0, unita: '', prezzo: 0 }) : nuovaRiga('servizio', { unita: 'corpo' });
    A.modifica(db => db.preventivi.find(y => y.id === p.id).righe.push(r));
    A.render();
    // Il fuoco va dove si scrive subito: la descrizione (o le ore, per la manodopera).
    setTimeout(() => { const e = A.$('.ges-riga[data-r="' + r.id + '"] ' + (tipo === 'manodopera' ? 'input[data-k=qta]' : '[data-k=descrizione]')); if (e) { e.focus(); if (e.select) e.select(); } }, 30);
  });
  // ---- aggiungi da catalogo: la modale resta aperta per scegliere più articoli
  function listaCatalogo(testo) {
    const parole = norm(testo).split(/\s+/).filter(Boolean);
    const lista = A.DB.articoli.filter(a => a.attivo !== false && (!parole.length || parole.every(x => norm([a.codice, a.nome, a.marca, a.categoria, a.barcode].join(' ')).includes(x))))
      .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome)).slice(0, 60);
    if (!lista.length) return `<div class="stato-vuoto" style="padding:20px">${icona('cerca')}<b>Nessun articolo</b><span>Prova con il codice o con un'altra parola. Se non è a catalogo aggiungi una voce «Servizio».</span></div>`;
    let cat = '';
    return lista.map(a => {
      const testa = a.categoria !== cat ? (cat = a.categoria, `<div class="ges-cat-g">${h(a.categoria)}</div>`) : '';
      const disp = A.giacenza(a.id, 'mag_sede') - A.impegnata(a.id);
      return testa + `<button type="button" class="ges-cat-a" data-az="ges-cat-scegli" data-a="${h(a.id)}"><span class="ges-cod">${h(a.codice)}</span><span class="n"><b>${h(nomeArticolo(a))}</b><small>costo ${h(A.euro(a.costo))} · disponibili ${h(A.num(disp))} ${h(a.unita)}</small></span><span class="p">${h(A.euro(a.prezzo))}<small>/${h(a.unita)}</small></span>${icona('piu', 'p')}</button>`;
    }).join('');
  }
  let catPrev = null;
  A.azione('ges-rg-catalogo', el => {
    const p = prevModificabile(el); if (!p) return;
    catPrev = p.id;
    A.modale({
      titolo: 'Aggiungi dal catalogo', largo: true,
      corpo: `<div class="cerca" style="margin-bottom:12px">${icona('cerca')}<input id="ges-cat-q" type="search" placeholder="Codice, nome, marca o categoria…" data-digita="ges-cat-cerca" autocomplete="off" aria-label="Cerca nel catalogo"></div>
        <p class="pic" id="ges-cat-esito" style="margin:-4px 0 8px;min-height:18px" role="status">Tocca un articolo per aggiungerlo: descrizione, unità e prezzo si compilano da soli.</p>
        <div class="ges-cat" id="ges-cat-lista">${listaCatalogo('')}</div>`,
      azioni: [{ testo: 'Fatto', classe: 'pri', chiudi: true, icona: 'spunta' }]
    });
  });
  A.azione('ges-cat-cerca', el => { const b = A.$('#ges-cat-lista'); if (b) b.innerHTML = listaCatalogo(el.value); });
  A.azione('ges-cat-scegli', el => {
    const p = A.preventivo(catPrev); const a = A.articolo(el.dataset.a);
    if (!p || !a || p.stato !== 'bozza') return;
    A.modifica(db => {
      const x = db.preventivi.find(y => y.id === p.id);
      const gia = x.righe.find(r => r.articoloId === a.id && !r.opzionale);
      if (gia) gia.qta = (Number(gia.qta) || 0) + 1;
      else x.righe.push(nuovaRiga('materiale', { articoloId: a.id, descrizione: nomeArticolo(a), qta: 1, unita: a.unita, prezzo: a.prezzo }));
    });
    A.render();
    const e = A.$('#ges-cat-esito'); if (e) e.innerHTML = `<span style="color:var(--ok);font-weight:650">${icona('spunta', 'p')} Aggiunto: ${h(nomeArticolo(a))}</span> — puoi sceglierne altri.`;
  });
  A.azione('ges-prv-salva', el => {
    const p = A.preventivo(el.dataset.id); if (!p) return;
    A.modifica(() => A.registra('preventivo salvato', p.numero + ' — ' + nomeCli(p.clienteId)));
    A.toast('Preventivo salvato', 'ok'); A.render();
  });
  A.azione('ges-prv-elimina', async el => {
    const p = A.preventivo(el.dataset.id); if (!p || p.stato !== 'bozza') return;
    if (!await A.conferma('Eliminare la bozza del preventivo N. ' + h(p.numero) + '? Non è mai stata mandata al cliente.', { ok: 'Elimina', pericolo: true })) return;
    A.modifica(db => { db.preventivi = db.preventivi.filter(x => x.id !== p.id); A.registra('bozza di preventivo eliminata', p.numero + ' — ' + nomeCli(p.clienteId)); });
    A.toast('Bozza eliminata', 'ok'); A.vai('#/u/preventivi');
  });
  function copiaPreventivo(db, p, stessoNumero) {
    const u = A.utente(); const id = A.uid('prv');
    const versione = stessoNumero ? Math.max(...db.preventivi.filter(x => x.numero === p.numero).map(x => x.versione || 1)) + 1 : 1;
    const nuovo = JSON.parse(JSON.stringify(p));
    Object.assign(nuovo, {
      id, numero: stessoNumero ? p.numero : A.numera('PRV'), versione, stato: 'bozza', creato: A.adesso(), inviatoIl: null, vistoIl: null, decisoIl: null, decisione: null, interventoId: null,
      validoFino: A.piuGiorni(A.oggi(), 30), revisioneDi: stessoNumero ? p.id : null, sostituitoDa: null, daInterventoId: null,
      eventi: [{ tipo: 'creato', data: A.adesso(), chi: u.nome, nota: stessoNumero ? 'Revisione ' + versione + ' del preventivo N. ' + p.numero : 'Copia del preventivo N. ' + p.numero + (p.versione > 1 ? ' rev. ' + p.versione : '') }]
    });
    nuovo.righe = (nuovo.righe || []).map(r => Object.assign(r, { id: A.uid('rp'), scelta: false }));
    db.preventivi.push(nuovo);
    return nuovo;
  }
  A.azione('ges-prv-duplica', el => {
    const p = A.preventivo(el.dataset.id); if (!p) return;
    let n;
    A.modifica(db => { n = copiaPreventivo(db, p, false); A.registra('preventivo duplicato', p.numero + ' → ' + n.numero); });
    A.toast('Copia creata: N. ' + n.numero + ' (bozza)', 'ok'); A.vai('#/u/preventivo/' + n.id);
  });
  A.azione('ges-prv-revisione', async el => {
    const p = A.preventivo(el.dataset.id); if (!p) return;
    const inAttesa = IN_ATTESA.includes(p.stato);
    if (!await A.conferma('Si crea la <b>revisione ' + (Math.max(...A.DB.preventivi.filter(x => x.numero === p.numero).map(x => x.versione || 1)) + 1) + '</b> del preventivo N. ' + h(p.numero) + ', in bozza, da correggere e rimandare.' + (inAttesa ? ' Quella attuale non si potrà più accettare.' : ''), { ok: 'Crea la revisione', titolo: 'Nuova revisione' })) return;
    let n;
    A.modifica(db => {
      const x = db.preventivi.find(y => y.id === p.id);
      n = copiaPreventivo(db, x, true);
      x.sostituitoDa = n.id;
      x.eventi = x.eventi || []; x.eventi.unshift({ tipo: 'revisione', data: A.adesso(), chi: A.utente().nome, nota: 'Nuova revisione ' + n.versione });
      if (IN_ATTESA.includes(x.stato)) x.stato = 'scaduto';
      A.registra('nuova revisione del preventivo', x.numero + ' rev. ' + n.versione + ' — ' + nomeCli(x.clienteId));
    });
    A.toast('Revisione ' + n.versione + ' creata: correggila e mandala', 'ok'); A.vai('#/u/preventivo/' + n.id);
  });
  A.azione('ges-prv-scaduto', async el => {
    const p = A.preventivo(el.dataset.id); if (!p || !IN_ATTESA.includes(p.stato)) return;
    if (!await A.conferma('Il cliente non potrà più accettarlo. Si può sempre mandare una nuova revisione.', { ok: 'Segna scaduto', titolo: 'Segnare scaduto il preventivo N. ' + h(p.numero) + '?' })) return;
    A.modifica(db => { const x = db.preventivi.find(y => y.id === p.id); x.stato = 'scaduto'; x.eventi = x.eventi || []; x.eventi.unshift({ tipo: 'scaduto', data: A.adesso(), chi: A.utente().nome }); A.registra('preventivo segnato scaduto', x.numero + ' — ' + nomeCli(x.clienteId)); });
    A.toast('Segnato scaduto', 'ok'); A.render();
  });

  // ---- invio al cliente (con l'invito all'area clienti, se non ce l'ha)
  A.azione('ges-prv-invia', el => {
    const p = A.preventivo(el.dataset.id); if (!p || p.stato !== 'bozza') return;
    const voci = (p.righe || []).filter(r => r.tipo !== 'nota');
    const manca = !String(p.oggetto || '').trim() ? 'Scrivi l\'oggetto del preventivo: è la prima cosa che il cliente legge.'
      : !voci.length ? 'Aggiungi almeno una voce con un prezzo.'
        : voci.some(r => !String(r.descrizione || '').trim()) ? 'C\'è una voce senza descrizione.'
          : !p.validoFino || dataIso(p.validoFino) < A.oggi() ? 'La data di validità è già passata: spostala in avanti.' : '';
    if (manca) return A.toast(manca, 'per', 4500);
    const c = A.cliente(p.clienteId); const acc = accessiDi(c.id).filter(u => u.attivo !== false);
    const t = A.totaliPreventivo(p);
    const riep = `<div class="ges-pre" style="margin-bottom:14px"><b>${h(nPrev(p))}</b> — ${h(p.oggetto)}<br>${h(c.nome)} · <b>${h(A.euro(t.totale))}</b> IVA compresa${t.opzionali ? ' · voci facoltative ' + h(A.euro(t.opzionali)) + ' + IVA' : ''}</div>`;
    const msg = `<div class="campo"><label for="ges-inv-msg">Due righe per il cliente <span class="muto">(facoltative, vanno nell'email)</span></label><textarea id="ges-inv-msg" name="messaggio" rows="3" placeholder="Come d'accordo al sopralluogo, le mando il preventivo…"></textarea></div>`;
    const corpo = acc.length
      ? `${riep}<div class="avviso ok" style="margin-bottom:14px">${icona('posta')}<div>Lo ricevono ${acc.map(u => '<b>' + h(u.nome) + '</b> (' + h(u.email) + ')').join(', ')}: un avviso nell'area clienti e un'email con il link per aprirlo e accettarlo con un clic, senza password.</div></div>${msg}`
      : `${riep}<div class="avviso warn" style="margin-bottom:14px">${icona('attenzione')}<div><b>${h(c.nome)} non ha ancora l'accesso all'area clienti.</b> Senza, non può aprirlo e accettarlo online. Creiamolo adesso: il link d'invito parte nella stessa email del preventivo.</div></div>
        <label class="spunta"><input type="checkbox" name="crea" checked data-cambia="ges-inv-crea"> Crea l'accesso e manda il link d'invito</label>
        <div id="ges-inv-acc" class="riga-campi"><div class="campo"><label for="ges-inv-nome">Nome di chi lo riceve</label><input id="ges-inv-nome" name="nome" type="text" value="${h(nomeReferente(c))}"></div><div class="campo"><label for="ges-inv-email">Email</label><input id="ges-inv-email" name="email" type="email" value="${h(c.email || '')}"></div></div>${msg}`;
    A.modale({ titolo: 'Invia il preventivo al cliente', form: 'ges-prv-invia-ok', corpo: `<input type="hidden" name="id" value="${h(p.id)}">${corpo}${divErr}`, azioni: [{ testo: 'Annulla', chiudi: true }, { testo: 'Invia al cliente', classe: 'acc', tipo: 'submit', icona: 'invia' }] });
  });
  A.azione('ges-inv-crea', el => { const b = A.$('#ges-inv-acc'); if (b) b.style.display = el.checked ? '' : 'none'; });
  A.azione('ges-prv-invia-ok', (f, ev, d) => {
    const p = A.preventivo(d.id); if (!p || p.stato !== 'bozza') return A.chiudiModale();
    const c = A.cliente(p.clienteId); let acc = accessiDi(c.id).filter(u => u.attivo !== false);
    let link = '', a = '', nome = '', invito = false;
    if (!acc.length && d.crea) {
      nome = String(d.nome || '').trim(); a = String(d.email || '').trim().toLowerCase();
      if (!nome) return erroreModale('Scrivi il nome di chi riceve il preventivo.');
      if (!emailValida(a)) return erroreModale('Serve un\'email valida per mandare il preventivo.');
      const gia = A.DB.utenti.find(u => u.email && u.email.toLowerCase() === a);
      if (gia && gia.ruolo !== 'cliente') return erroreModale('Questa email è già usata da ' + gia.nome + '.');
      if (gia) {
        if (!(gia.clienti || []).includes(c.id)) A.modifica(db => { db.utenti.find(u => u.id === gia.id).clienti.push(c.id); db.clienti.find(x => x.id === c.id).portale = true; A.registra('accesso area clienti collegato', gia.nome + ' — ' + c.nome); });
        link = A.creaLink(gia.id, 'accesso', '#/c/preventivo/' + p.id); nome = gia.nome;
      } else { link = creaAccesso(c.id, nome, a).link; invito = true; }
    } else if (acc.length) {
      const u = acc[0]; a = u.email; nome = u.nome;
      link = A.creaLink(u.id, 'accesso', '#/c/preventivo/' + p.id);
    } else {
      a = c.email; nome = nomeReferente(c) || c.nome;
      if (!emailValida(a)) return erroreModale('Il cliente non ha un\'email: crea l\'accesso con un indirizzo valido.');
    }
    const t = A.totaliPreventivo(p); const u = A.utente();
    A.modifica(db => {
      const x = db.preventivi.find(y => y.id === p.id);
      x.stato = 'inviato'; x.inviatoIl = A.adesso();
      x.eventi = x.eventi || []; x.eventi.unshift({ tipo: 'inviato', data: x.inviatoIl, chi: u.nome, nota: 'a ' + a + (invito ? ' (con l\'invito all\'area clienti)' : '') });
      const testo = 'Gentile ' + nome + ',\n' + (String(d.messaggio || '').trim() ? String(d.messaggio).trim() + '\n\n' : '') + 'le inviamo il preventivo ' + nPrev(x) + ' per «' + x.oggetto + '»: totale ' + A.euro(t.totale) + ' IVA compresa, valido fino al ' + A.data(x.validoFino) + '.\n'
        + (link ? (invito ? '\nIDRAL le ha aperto l\'area clienti: da lì vede il preventivo e, se va bene, lo accetta con un clic. Per entrare (link valido 24 ore, nessuna password):\n' : '\nLo apre qui e, se va bene, lo accetta con un clic (senza password):\n') + link : '\nPer accettarlo ci risponda a questa email o ci chiami.')
        + '\n\nIDRAL — ' + db.azienda.telefono + ' · ' + db.azienda.email;
      A.avvisa('cliente:' + c.id, 'Nuovo preventivo da IDRAL: ' + x.oggetto, '#/c/preventivo/' + x.id, { tipo: 'preventivo', email: { a, oggetto: 'IDRAL — preventivo ' + nPrev(x), testo } });
      A.registra('preventivo inviato', x.numero + ' — ' + c.nome + ' (' + A.euro(t.totale) + ')');
    });
    A.chiudiModale(); A.render();
    if (link) mostraLinkCreato('Preventivo inviato', 'Abbiamo mandato il preventivo a <b>' + h(a) + '</b>' + (invito ? ', con l\'invito all\'area clienti' : '') + '. Quando lo apre o lo accetta ti arriva un avviso.', link);
    else A.toast('Preventivo inviato a ' + a, 'ok');
  });

  // ---- accettato: diventa un intervento (la modale e' quella di ufficio-lavori.js)
  A.azione('ges-prv-intervento', el => {
    const p = A.preventivo(el.dataset.id); if (!p) return;
    if (p.stato !== 'accettato' || p.interventoId) return A.toast('Questo preventivo è già diventato un intervento', 'warn');
    const voci = (p.righe || []).filter(r => r.tipo !== 'nota' && (!r.opzionale || r.scelta));
    const ore = voci.filter(r => r.tipo === 'manodopera').reduce((s, r) => s + (Number(r.qta) || 0), 0);
    const durata = [60, 90, 120, 180, 240, 300, 360, 480].find(x => x >= ore * 60) || 480;
    const richiesta = p.oggetto + ' — come da preventivo ' + nPrev(p) + ' accettato.\n' + voci.map(r => '• ' + r.descrizione + ' (' + A.num(r.qta) + ' ' + (r.unita || '') + ')').join('\n');
    if (!A.apriNuovoIntervento) return A.toast('La creazione degli interventi non è disponibile', 'per');
    A.apriNuovoIntervento({ clienteId: p.clienteId, sedeId: p.sedeId, preventivoId: p.id, tipo: 'installazione', origine: 'preventivo', richiesta, durataMin: durata }, idInt => {
      A.modifica(db => {
        const x = db.preventivi.find(y => y.id === p.id); if (!x) return;
        x.interventoId = idInt; x.stato = 'convertito';
        x.eventi = x.eventi || [];
        if (!x.eventi[0] || x.eventi[0].tipo !== 'convertito') x.eventi.unshift({ tipo: 'convertito', data: A.adesso(), chi: A.utente().nome });
        const i = db.interventi.find(y => y.id === idInt);
        A.registra('preventivo trasformato in intervento', x.numero + ' → intervento ' + (i ? i.numero : ''));
      });
    });
  });

  function paginaStampaPreventivo(par) {
    const p = A.preventivo(par.id);
    if (!p) { location.replace('#/u/preventivi'); return false; }
    return pagina({ attivo: 'preventivi', titolo: 'Preventivo ' + nPrev(p), briciole: [['Preventivi', '#/u/preventivi'], [nPrev(p), '#/u/preventivo/' + p.id]], contenuto: (p.stato === 'bozza' ? `<div class="avviso warn no-stampa" style="max-width:820px;margin:0 auto 14px">${icona('info')}<div>Anteprima di una <b>bozza</b>: è esattamente il foglio che vedrà il cliente. Costi e margini non ci sono.</div></div>` : '') + `<div class="ges-stampa">${A.paginaStampa(A.foglioPreventivo(p), '#/u/preventivo/' + p.id)}</div>` });
  }

  rotta('#/u/preventivi', paginaPreventivi);
  rotta('#/u/preventivo/:id', paginaPreventivo);
  rotta('#/u/preventivo/:id/stampa', paginaStampaPreventivo);

  // ===========================================================================
  // 4. COMUNICAZIONI — note dei tecnici e conversazioni con i clienti
  // ===========================================================================
  function coloreDi(u) { const c = u && u.colore; return /^#[0-9a-f]{3,8}$/i.test(c || '') ? c : '#5C7787'; }
  function avatarPersona(u, cl) { return `<span class="avatar ${cl || ''}" style="background:${coloreDi(u)}" aria-hidden="true">${h(A.iniziali(u ? u.nome : '?'))}</span>`; }
  const testoRisposta = x => typeof x === 'string' ? x : (x && x.testo) || '';
  function contaMessaggi() {
    const db = A.DB;
    return { clienti: db.conversazioni.filter(x => !x.lettoAzienda).length, tecnici: db.note.filter(n => !n.letta).length };
  }
  function schedeMessaggi(attiva) {
    const n = contaMessaggi();
    return schedeHtml([['clienti', 'Con i clienti', '#/u/messaggi?scheda=clienti', n.clienti || '', true], ['tecnici', 'Dai tecnici', '#/u/messaggi?scheda=tecnici', n.tecnici || '', true]], attiva);
  }
  function paginaMessaggi(par) {
    segnaLettiQui();
    const q = par.q; const n = contaMessaggi();
    const sc = q.scheda === 'tecnici' || q.scheda === 'clienti' ? q.scheda : (!n.clienti && n.tecnici ? 'tecnici' : 'clienti');
    const corpo = sc === 'tecnici' ? schedaNoteTecnici(q) : paneConversazioni(q, null);
    return {
      html: pagina({ attivo: 'messaggi', titolo: 'Comunicazioni', briciole: [['Clienti', '#/u/clienti']], azioni: `<button class="btn acc" type="button" data-az="ges-scrivi">${icona('piu')}<span class="ges-nt">Nuovo messaggio</span></button>`, contenuto: schedeMessaggi(sc) + corpo })
    };
  }

  // ---- note dei tecnici
  function schedaNoteTecnici(q) {
    const f = ['da-leggere', 'urgenti'].includes(q.f) ? q.f : '';
    const tutte = A.DB.note.slice().sort((a, b) => (a.letta ? 1 : 0) - (b.letta ? 1 : 0) || String(b.data).localeCompare(String(a.data)));
    const lista = tutte.filter(x => f === 'da-leggere' ? !x.letta : f === 'urgenti' ? x.urgente : true);
    const base = '#/u/messaggi?scheda=tecnici';
    const voce = x => {
      const t = A.utenteDa(x.autoreId); const i = x.interventoId ? A.intervento(x.interventoId) : null;
      return `<li class="${x.letta ? '' : 'nuova'}${x.urgente ? ' urg' : ''}">
        ${avatarPersona(t, 'g')}
        <div class="cx1">
          <div class="ges-nota-t"><b>${h(t ? t.nome : 'Tecnico')}</b><span class="pic">${h(A.quando(x.data))}</span>${x.urgente ? A.pastiglia('Urgente', 'dang') : ''}${x.letta ? '' : A.pastiglia('Da leggere', 'acc')}</div>
          ${i ? `<a class="ges-chip" href="#/u/intervento/${h(i.id)}" style="margin:4px 0 2px">${icona('chiave', 'p')}N. ${h(i.numero)} — ${h(nomeCli(i.clienteId))}</a>` : ''}
          <div class="ges-nota-testo">${h(x.testo)}</div>
          ${x.risposta ? `<div class="ges-risp">${icona('indietro', 'p')}<div><b>${h(x.risposta.chi || 'Ufficio')}</b>${x.risposta.data ? ' · ' + h(A.quando(x.risposta.data)) : ''}<br>${h(testoRisposta(x.risposta))}</div></div>` : ''}
          <div class="btns" style="margin-top:10px">${x.letta ? '' : `<button class="btn pic" type="button" data-az="ges-nota-letta" data-id="${h(x.id)}">${icona('spunta', 'p')} Segna letta</button>`}<button class="btn pic ${x.risposta ? '' : 'pri'}" type="button" data-az="ges-nota-rispondi" data-id="${h(x.id)}">${icona('messaggio', 'p')} ${x.risposta ? 'Rispondi di nuovo' : 'Rispondi'}</button></div>
        </div></li>`;
    };
    return `<div class="ges-intesta">${segmenti([['', 'Tutte', base, tutte.length], ['da-leggere', 'Da leggere', base + '&f=da-leggere', tutte.filter(x => !x.letta).length], ['urgenti', 'Urgenti', base + '&f=urgenti', tutte.filter(x => x.urgente).length]], f)}<p>Le note che i tecnici scrivono dal telefono per l'ufficio.</p></div>
      ${lista.length ? `<div class="tessera"><ul class="ges-note">${lista.map(voce).join('')}</ul></div>` : vuotoTessera(f ? 'Niente qui' : 'Nessuna nota dai tecnici', 'Quando un tecnico scrive all\'ufficio dal telefono, la nota compare qui (e, se urgente, anche fra le cose da fare).', 'messaggio')}`;
  }
  A.azione('ges-nota-letta', el => {
    A.modifica(db => { const n = db.note.find(x => x.id === el.dataset.id); if (n) n.letta = true; });
    A.render();
  });
  A.azione('ges-nota-rispondi', el => {
    const n = A.trova('note', el.dataset.id); if (!n) return;
    const t = A.utenteDa(n.autoreId);
    A.modale({
      titolo: 'Rispondi a ' + (t ? t.nome : 'tecnico'), form: 'ges-nota-rispondi-ok',
      corpo: `<input type="hidden" name="id" value="${h(n.id)}"><div class="ges-pre" style="margin-bottom:14px">${h(n.testo)}</div>
        <div class="campo"><label for="ges-nr-t">La tua risposta</label><textarea id="ges-nr-t" name="testo" rows="3" placeholder="Il preventivo è partito ieri, appena accetta ti metto in agenda."></textarea><span class="aiuto">Gli arriva come avviso sul telefono${n.interventoId ? ', con il link al lavoro' : ''}.</span></div>${divErr}`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: 'Invia', classe: 'pri', tipo: 'submit', icona: 'invia' }]
    });
  });
  A.azione('ges-nota-rispondi-ok', (f, ev, d) => {
    const testo = String(d.testo || '').trim(); if (!testo) return erroreModale('Scrivi la risposta.');
    const u = A.utente();
    A.modifica(db => {
      const n = db.note.find(x => x.id === d.id); if (!n) return;
      n.risposta = { testo, data: A.adesso(), chi: u.nome, autoreId: u.id }; n.letta = true;
      A.avvisa(n.autoreId, 'Risposta dall\'ufficio: ' + taglia(testo, 90), n.interventoId ? '#/t/lavoro/' + n.interventoId : '#/t/avvisi', { tipo: 'nota' });
      A.registra('risposta a un tecnico', nomeUtente(n.autoreId) + ': ' + taglia(testo, 60));
    });
    A.chiudiModale(); A.toast('Risposta inviata', 'ok'); A.render();
  });

  // ---- conversazioni con i clienti: elenco a sinistra, chat a destra
  function ultimoMsg(x) { return (x.messaggi || [])[x.messaggi.length - 1] || null; }
  function paneConversazioni(q, apertaId) {
    const parole = norm(q.q).split(/\s+/).filter(Boolean);
    const tutte = A.DB.conversazioni.slice().sort((a, b) => (a.lettoAzienda ? 1 : 0) - (b.lettoAzienda ? 1 : 0) || String(b.aggiornato).localeCompare(String(a.aggiornato)));
    const lista = parole.length ? tutte.filter(x => { const t = norm([nomeCli(x.clienteId), x.oggetto, (x.messaggi || []).map(m => m.testo).join(' ')].join(' ')); return parole.every(p => t.includes(p)); }) : tutte;
    const elenco = `<div class="tessera ges-conv-el">
      <div class="ges-conv-cerca">${campoCerca('ges-conv-q', q.q, 'Cerca cliente o parola…')}</div>
      ${lista.length ? `<ul class="ges-conv">${lista.map(x => {
        const m = ultimoMsg(x); const c = A.cliente(x.clienteId);
        return `<li><a href="#/u/messaggi/${h(x.id)}" class="${x.id === apertaId ? 'on' : ''}${x.lettoAzienda ? '' : ' nuova'}">
          <span class="avatar ${c && c.tipo === 'azienda' ? 'acc' : ''}">${h(A.iniziali(c ? c.nome : '?'))}</span>
          <span class="cx1"><span class="r1"><b>${h(c ? c.nome : 'Cliente')}</b><small>${h(A.quando(x.aggiornato))}</small></span>
          <span class="r2">${h(x.oggetto || 'Messaggio')}</span>
          <span class="r3">${m ? (m.da === 'azienda' ? 'Tu: ' : '') + h(taglia(m.testo, 80)) : ''}</span></span>
          ${x.lettoAzienda ? '' : '<span class="ges-punto" aria-label="da leggere"></span>'}</a></li>`;
      }).join('')}</ul>` : A.vuoto(parole.length ? 'Nessuna conversazione trovata' : 'Nessuna conversazione', parole.length ? 'Prova con un\'altra parola.' : 'I messaggi dei clienti dall\'area riservata arrivano qui.', 'messaggio')}
    </div>`;
    const destra = apertaId ? chatConversazione(apertaId) : `<div class="tessera ges-conv-vuota">${A.vuoto('Scegli una conversazione', 'Le conversazioni da leggere sono in cima, con il punto arancione.', 'messaggio')}</div>`;
    return `<div class="ges-msg-g${apertaId ? ' aperta' : ''}">${elenco}${destra}</div>`;
  }
  function chatConversazione(id) {
    const x = A.trova('conversazioni', id);
    if (!x) return `<div class="tessera">${A.vuoto('Conversazione non trovata', 'Forse il link è sbagliato.', 'cerca')}</div>`;
    const c = A.cliente(x.clienteId) || { id: '', nome: 'Cliente' };
    const ctx = x.contesto || {};
    const legame = ctx.tipo === 'preventivo' && A.preventivo(ctx.id) ? `<a href="#/u/preventivo/${h(ctx.id)}">${icona('documento', 'p')}Preventivo ${h(nPrev(A.preventivo(ctx.id)))}</a>`
      : ctx.tipo === 'intervento' && A.intervento(ctx.id) ? `<a href="#/u/intervento/${h(ctx.id)}">${icona('chiave', 'p')}Intervento N. ${h(A.intervento(ctx.id).numero)}</a>` : '';
    let giorno = '';
    const bolle = (x.messaggi || []).map(m => {
      const g = String(m.data).slice(0, 10); let sep = '';
      if (g !== giorno) { giorno = g; sep = `<div class="ges-chat-g">${h(cap(A.dataLunga(m.data)))}</div>`; }
      const chi = m.da === 'azienda' ? nomeUtente(m.autoreId) : autoreMsg(m, x);
      return sep + `<div class="bolla ${m.da === 'azienda' ? 'mia' : ''}">${h(m.testo)}<span class="md">${h(chi)} · ${h(A.ora(m.data))}</span></div>`;
    }).join('');
    const acc = areaAttiva(c.id); const em = emailCliente(c.id); const notif = A.DB.azienda.notificheEmail !== false;
    return `<div class="tessera ges-chatbox">
      <div class="tt"><div style="min-width:0"><a class="ges-indietro" href="#/u/messaggi?scheda=clienti">${icona('indietro', 'p')} Tutte</a><h3 style="overflow-wrap:anywhere">${h(x.oggetto || 'Messaggio')}</h3>
        <div class="ges-t-meta" style="margin-top:4px;font-size:13px"><a href="#/u/cliente/${h(c.id)}">${icona('edificio', 'p')}${h(c.nome)}</a>${legame}</div></div></div>
      <div class="chat" id="ges-chat">${bolle || '<p class="muto">Nessun messaggio.</p>'}</div>
      <form class="scrivi" data-form="ges-msg-rispondi" novalidate><input type="hidden" name="id" value="${h(x.id)}"><textarea name="testo" id="ges-msg-t" rows="2" placeholder="Scrivi una risposta…" aria-label="Risposta"></textarea><button class="btn pri" type="submit">${icona('invia')}<span class="ges-nt2">Invia</span></button></form>
      <div class="ges-dida">${icona('info', 'p')} ${acc ? 'Il cliente riceve un avviso nella sua area' + (notif && em ? ' e un\'email a ' + h(em) : '') + '.' : em ? 'Il cliente non ha l\'area clienti: la risposta gli arriva per email a ' + h(em) + '.' : 'Attenzione: il cliente non ha né area clienti né email. Meglio una telefonata.'}</div>
    </div>`;
  }
  function paginaConversazione(par) {
    const x = A.trova('conversazioni', par.id);
    if (x && !x.lettoAzienda) A.modifica(db => { const y = db.conversazioni.find(k => k.id === x.id); y.lettoAzienda = true; });
    segnaLettiQui();
    return {
      html: pagina({ attivo: 'messaggi', titolo: x ? (x.oggetto || 'Conversazione') : 'Comunicazioni', briciole: [['Comunicazioni', '#/u/messaggi?scheda=clienti']], azioni: `<button class="btn acc" type="button" data-az="ges-scrivi">${icona('piu')}<span class="ges-nt">Nuovo messaggio</span></button>`, contenuto: schedeMessaggi('clienti') + paneConversazioni(par.q, par.id) }),
      dopo: () => { const c = A.$('#ges-chat'); if (c) c.scrollTop = c.scrollHeight; }
    };
  }
  A.azione('ges-msg-rispondi', (f, ev, d) => {
    const testo = String(d.testo || '').trim(); if (!testo) return A.toast('Scrivi la risposta', 'warn');
    const x = A.trova('conversazioni', d.id); if (!x) return;
    const u = A.utente();
    A.modifica(db => {
      const y = db.conversazioni.find(k => k.id === x.id);
      y.messaggi.push({ id: A.uid('msg'), da: 'azienda', autoreId: u.id, testo, data: A.adesso() });
      y.lettoAzienda = true; y.lettoCliente = false; y.aggiornato = A.adesso();
      avvisaCliente(db, y.clienteId, 'IDRAL ha risposto: ' + taglia(testo, 80), '#/c/messaggi/' + y.id, 'messaggio', 'IDRAL ha risposto al suo messaggio', 'Gentile cliente,\n' + testo + '\n\n(Può rispondere dall\'area clienti.)', !areaAttiva(y.clienteId));
      A.registra('risposta a un cliente', nomeCli(y.clienteId) + ': ' + taglia(testo, 60));
    });
    A.toast('Risposta inviata', 'ok'); A.render();
    setTimeout(() => { const t = A.$('#ges-msg-t'); if (t && window.matchMedia('(pointer:fine)').matches) t.focus(); }, 30);
  });
  // ---- nuovo messaggio a un cliente (anche dalla scheda cliente e dal preventivo)
  A.azione('ges-scrivi', el => {
    const cid = el.dataset.cliente || '';
    const clienti = A.DB.clienti.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
    A.modale({
      titolo: 'Scrivi al cliente', form: 'ges-scrivi-ok',
      corpo: `<input type="hidden" name="ctipo" value="${h(el.dataset.ctipo || 'generale')}"><input type="hidden" name="cid" value="${h(el.dataset.cid || '')}">
        <div class="campo"><label for="ges-sc-cli">Cliente</label><select id="ges-sc-cli" name="clienteId" data-cambia="ges-scrivi-cli"><option value="">— scegli il cliente —</option>${clienti.map(c => `<option value="${h(c.id)}"${c.id === cid ? ' selected' : ''}>${h(c.nome)}</option>`).join('')}</select><span class="aiuto" id="ges-sc-canale">${cid ? canaleCliente(cid) : ''}</span></div>
        <div class="campo"><label for="ges-sc-ogg">Oggetto</label><input id="ges-sc-ogg" name="oggetto" type="text" value="${h(el.dataset.oggetto || '')}" placeholder="Appuntamento per la manutenzione"></div>
        <div class="campo"><label for="ges-sc-t">Messaggio</label><textarea id="ges-sc-t" name="testo" rows="5"></textarea></div>${divErr}`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: 'Invia', classe: 'pri', tipo: 'submit', icona: 'invia' }]
    });
  });
  function canaleCliente(cid) {
    const em = emailCliente(cid);
    return areaAttiva(cid) ? 'Lo legge nella sua area clienti' + (A.DB.azienda.notificheEmail !== false && em ? ' e riceve un\'email a ' + h(em) : '') + '.' : em ? 'Non ha l\'area clienti: gli arriva per email a ' + h(em) + '.' : '⚠️ Non ha né area clienti né email: il messaggio resta solo qui.';
  }
  A.azione('ges-scrivi-cli', el => { const s = A.$('#ges-sc-canale'); if (s) s.innerHTML = el.value ? canaleCliente(el.value) : ''; });
  A.azione('ges-scrivi-ok', (f, ev, d) => {
    const c = A.cliente(d.clienteId); if (!c) return erroreModale('Scegli il cliente.');
    const testo = String(d.testo || '').trim(); if (!testo) return erroreModale('Scrivi il messaggio.');
    const oggetto = String(d.oggetto || '').trim() || taglia(testo, 60);
    const u = A.utente(); const ora = A.adesso(); let cid;
    A.modifica(db => {
      // Un preventivo, una conversazione: se ce n'e' gia' una, si continua quella.
      let x = d.cid ? db.conversazioni.find(k => k.clienteId === c.id && k.contesto && k.contesto.tipo === d.ctipo && k.contesto.id === d.cid) : null;
      if (!x) { x = { id: A.uid('cnv'), clienteId: c.id, oggetto, contesto: { tipo: d.cid ? d.ctipo : 'generale', id: d.cid || null }, messaggi: [], lettoAzienda: true, lettoCliente: false, aggiornato: ora }; db.conversazioni.push(x); }
      x.messaggi.push({ id: A.uid('msg'), da: 'azienda', autoreId: u.id, testo, data: ora });
      x.lettoCliente = false; x.lettoAzienda = true; x.aggiornato = ora; cid = x.id;
      avvisaCliente(db, c.id, 'Messaggio da IDRAL: ' + oggetto, '#/c/messaggi/' + x.id, 'messaggio', 'IDRAL — ' + oggetto, 'Gentile cliente,\n' + testo, !areaAttiva(c.id));
      A.registra('messaggio a un cliente', c.nome + ': ' + oggetto);
    });
    A.chiudiModale(); A.toast('Messaggio inviato', 'ok'); A.vai('#/u/messaggi/' + cid);
  });

  rotta('#/u/messaggi', paginaMessaggi);
  rotta('#/u/messaggi/:id', paginaConversazione);

  // ===========================================================================
  // 5. ORDINI E MATERIALE — richieste dei tecnici, ordini dei clienti,
  //    sotto scorta, rubrica fornitori. Niente ordini automatici ai fornitori:
  //    il gestionale prepara la lista, l'ordine lo manda Andrea.
  // ===========================================================================
  const DEPOSITO = 'mag_sede';
  const APERTE_MAT = ['nuova', 'presa', 'ordinata'];
  const RANGO_URG = { blocca_lavoro: 0, urgente: 1, normale: 2 };
  /** Giacenze di tutti gli articoli in una passata sola (stessa regola di A.giacenza: somma dei movimenti). */
  function giacenzeTutte() {
    const g = {};
    A.DB.movimenti.forEach(m => { const x = g[m.articoloId] = g[m.articoloId] || { tot: 0, per: {} }; const q = Number(m.qta) || 0; x.tot += q; x.per[m.magazzinoId] = (x.per[m.magazzinoId] || 0) + q; });
    Object.values(g).forEach(x => { x.tot = Math.round(x.tot * 1000) / 1000; Object.keys(x.per).forEach(k => x.per[k] = Math.round(x.per[k] * 1000) / 1000); });
    return g;
  }
  const gq = (G, aid, mid) => { const x = G[aid]; if (!x) return 0; return mid ? (x.per[mid] || 0) : x.tot; };
  function nomeMag(id) { const m = A.trova('magazzini', id); return m ? m.nome : id || '—'; }
  function nomeMagBreve(id) { const m = A.trova('magazzini', id); return !m ? (id || '—') : m.tipo === 'sede' ? 'Deposito' : m.nome.split(' — ')[0]; }
  function fornitoreSuggerito(r) {
    const a = r.articoloId ? A.articolo(r.articoloId) : null;
    const testo = norm((a ? a.categoria + ' ' + a.nome + ' ' + a.marca + ' ' : '') + (r.descrizione || ''));
    let best = null, bestN = 0;
    A.DB.fornitori.forEach(f => {
      let n = 0;
      norm(f.categorie).split(/[,;]+/).map(x => x.trim()).filter(Boolean).forEach(c => { const radice = c.slice(0, Math.min(6, Math.max(3, c.length - 1))); if (testo.includes(radice)) n++; });
      if (n > bestN) { best = f; bestN = n; }
    });
    return best;
  }
  function chiSegnala(r) {
    const u = A.utenteDa(r.tecnicoId);
    if (!u) return 'Ufficio';
    return u.ruolo === 'tecnico' ? u.nome : 'Ufficio (' + A.nomeBreve(u.nome) + ')';
  }
  function contaMateriale() {
    const db = A.DB;
    const G = giacenzeTutte();
    return {
      richieste: db.richiesteMateriale.filter(r => APERTE_MAT.includes(r.stato)).length,
      nuove: db.richiesteMateriale.filter(r => r.stato === 'nuova').length,
      ordini: db.ordini.filter(o => ['nuovo', 'confermato', 'in_preparazione', 'pronto'].includes(o.stato)).length,
      ordiniNuovi: db.ordini.filter(o => o.stato === 'nuovo').length,
      scorta: db.articoli.filter(a => a.attivo !== false && a.scortaMin > 0 && gq(G, a.id) < a.scortaMin).length,
      fornitori: db.fornitori.length
    };
  }
  function paginaMateriale(par) {
    segnaLettiQui();
    const q = par.q;
    const sc = ['richieste', 'ordini', 'scorta', 'fornitori'].includes(q.scheda) ? q.scheda : 'richieste';
    const n = contaMateriale();
    const schede = schedeHtml([
      ['richieste', 'Materiale dai tecnici', '#/u/materiale?scheda=richieste', n.richieste || '', n.nuove > 0],
      ['ordini', 'Ordini dei clienti', '#/u/materiale?scheda=ordini', n.ordini || '', n.ordiniNuovi > 0],
      ['scorta', 'Sotto scorta', '#/u/materiale?scheda=scorta', n.scorta || ''],
      ['fornitori', 'Fornitori', '#/u/materiale?scheda=fornitori', n.fornitori]
    ], sc);
    const corpo = sc === 'ordini' ? schedaOrdini(q) : sc === 'scorta' ? schedaScorta() : sc === 'fornitori' ? schedaFornitori() : schedaRichiesteMat(q);
    return pagina({ attivo: 'materiale', titolo: 'Ordini e materiale', briciole: [['Materiale', '#/u/magazzino']], azioni: `<a class="btn" href="#/u/magazzino">${icona('pacco')}<span class="ges-nt">Magazzino</span></a>`, contenuto: schede + corpo });
  }

  // ---- materiale segnalato dal campo
  function schedaRichiesteMat(q) {
    const db = A.DB;
    const f = ['chiuse', 'tutte'].includes(q.f) ? q.f : '';
    const tutte = db.richiesteMateriale;
    const lista = tutte.filter(r => f === 'tutte' ? true : f === 'chiuse' ? !APERTE_MAT.includes(r.stato) : APERTE_MAT.includes(r.stato))
      .sort((a, b) => f ? String(b.data).localeCompare(String(a.data)) : (RANGO_URG[a.urgenza] || 2) - (RANGO_URG[b.urgenza] || 2) || String(a.data).localeCompare(String(b.data)));
    const prese = tutte.filter(r => r.stato === 'presa').length;
    const base = '#/u/materiale?scheda=richieste';
    const fornOpz = (sel, sugg) => '<option value="">— fornitore —</option>' + db.fornitori.map(x => `<option value="${h(x.id)}"${sel === x.id ? ' selected' : ''}>${h(x.nome)}${!sel && sugg && sugg.id === x.id ? ' (consigliato)' : ''}</option>`).join('');
    const riga = r => {
      const a = r.articoloId ? A.articolo(r.articoloId) : null; const i = r.interventoId ? A.intervento(r.interventoId) : null;
      const fo = r.fornitoreId ? A.trova('fornitori', r.fornitoreId) : null; const sugg = !fo ? fornitoreSuggerito(r) : null;
      const id = h(r.id);
      let az = '';
      if (r.stato === 'nuova') az = `<button class="btn pic pri" type="button" data-az="ges-rm-presa" data-id="${id}">${icona('spunta', 'p')} Presa in carico</button><button class="btn pic" type="button" data-az="ges-rm-rifiuta" data-id="${id}">Non ordinare</button>`;
      else if (r.stato === 'presa') az = `<button class="btn pic acc" type="button" data-az="ges-rm-ordinata" data-id="${id}">${icona('invia', 'p')} Segna ordinata</button><button class="btn pic" type="button" data-az="ges-rm-rifiuta" data-id="${id}">Non ordinare</button>`;
      else if (r.stato === 'ordinata') az = `<button class="btn pic ok" type="button" data-az="ges-rm-arrivata" data-id="${id}">${icona('pacco', 'p')} Arrivata</button>`;
      else if (r.stato === 'arrivata' && r.articoloId && !r.caricataIl) az = `<button class="btn pic pri" type="button" data-az="ges-rm-carica" data-id="${id}">${icona('carica', 'p')} Carica a magazzino</button>`;
      else if (r.stato === 'arrivata' && r.caricataIl) az = `<span class="pic">${icona('spunta', 'p')} caricata ${h(A.quando(r.caricataIl))}</span>`;
      return `<tr class="${r.urgenza === 'blocca_lavoro' && APERTE_MAT.includes(r.stato) ? 'ges-blocca' : ''}">
        <td class="ges-nome ges-prima"><b>${h(r.descrizione)}</b> <span class="ges-num" style="white-space:nowrap">× ${h(A.num(r.qta))} ${h(r.unita || '')}</span>
          <div class="t2">${a ? '<span class="ges-cod">' + h(a.codice) + '</span> · al deposito ' + h(A.num(A.giacenza(a.id, DEPOSITO))) + ' ' + h(a.unita) : 'fuori catalogo'}${r.note ? ' · ' + h(taglia(r.note, 90)) : ''}</div>
          ${r.motivo && r.stato === 'rifiutata' ? `<div class="t2">Non ordinata: ${h(r.motivo)}</div>` : ''}</td>
        <td data-l="Chi e dove">${h(chiSegnala(r))}${i ? `<div class="t2"><a href="#/u/intervento/${h(i.id)}">N. ${h(i.numero)}</a> · ${h(nomeCli(i.clienteId))}</div>` : ''}<div class="t2">${h(A.quando(r.data))}</div></td>
        <td data-l="Urgenza">${pDa(URG_MAT, r.urgenza)}</td>
        <td data-l="Stato">${pDa(STATI_MAT, r.stato)}${r.stato === 'presa' ? `<div style="margin-top:6px"><select class="ges-sel-pic" data-cambia="ges-rm-fornitore" data-id="${id}" aria-label="Fornitore">${fornOpz(r.fornitoreId || '', sugg)}</select></div>` : fo ? `<div class="t2">${h(fo.nome)}</div>` : ''}</td>
        <td class="ges-az"><div class="ges-azr">${az}</div></td>
      </tr>`;
    };
    return `<div class="ges-intesta">${segmenti([['', 'Da gestire', base, tutte.filter(r => APERTE_MAT.includes(r.stato)).length], ['chiuse', 'Arrivate e scartate', base + '&f=chiuse'], ['tutte', 'Tutte', base + '&f=tutte']], f)}
        <button class="btn pri" type="button" data-az="ges-lista-ordine"${prese ? '' : ' disabled'}>${icona('elenco')} Lista d'ordine per fornitore${prese ? ' (' + prese + ')' : ''}</button></div>
      ${lista.length ? `<div class="tessera"><div class="tab-w"><table class="tab ges-resp"><thead><tr><th>Materiale</th><th>Chi e dove</th><th>Urgenza</th><th>Stato</th><th></th></tr></thead><tbody>${lista.map(riga).join('')}</tbody></table></div>
        <div class="ges-dida">${icona('info', 'p')} Da vedere → presa in carico (scegli il fornitore) → ordinata → arrivata. Il tecnico riceve un avviso a ogni passaggio. L'ordine al fornitore lo mandi tu: la «Lista d'ordine» prepara il testo.</div></div>`
        : vuotoTessera(f ? 'Niente qui' : 'Nessun materiale da ordinare', 'Quando un tecnico segnala dal telefono un pezzo che manca, arriva qui.', 'carrello')}`;
  }
  function cambiaMateriale(id, stato, extra, testoTec, registro) {
    const u = A.utente();
    A.modifica(db => {
      const r = db.richiesteMateriale.find(x => x.id === id); if (!r) return;
      r.stato = stato; Object.assign(r, extra || {});
      (r.storico = r.storico || []).push({ stato, data: A.adesso(), utenteId: u.id });
      const t = A.utenteDa(r.tecnicoId);
      if (t && t.ruolo === 'tecnico' && testoTec) A.avvisa(t.id, testoTec, r.interventoId ? '#/t/lavoro/' + r.interventoId : '#/t/avvisi', { tipo: 'materiale' });
      A.registra('materiale: ' + registro, r.descrizione + ' ×' + A.num(r.qta) + ' ' + (r.unita || ''));
    });
  }
  A.azione('ges-rm-presa', el => {
    const r = A.trova('richiesteMateriale', el.dataset.id); if (!r) return;
    const sugg = fornitoreSuggerito(r);
    cambiaMateriale(r.id, 'presa', { fornitoreId: r.fornitoreId || (sugg ? sugg.id : null) }, 'L\'ufficio ha preso in carico: ' + r.descrizione + ' ×' + A.num(r.qta), 'presa in carico');
    A.toast('Presa in carico: ' + chiSegnala(r) + ' è stato avvisato', 'ok'); A.render();
  });
  A.azione('ges-rm-fornitore', el => {
    A.modifica(db => { const r = db.richiesteMateriale.find(x => x.id === el.dataset.id); if (r) r.fornitoreId = el.value || null; });
    A.toast('Fornitore scelto', 'ok');
  });
  A.azione('ges-rm-ordinata', el => {
    const r = A.trova('richiesteMateriale', el.dataset.id); if (!r) return;
    const def = r.fornitoreId || (fornitoreSuggerito(r) || {}).id || '';
    A.modale({
      titolo: 'Segna ordinata', form: 'ges-rm-ordinata-ok',
      corpo: `<input type="hidden" name="id" value="${h(r.id)}"><div class="ges-pre" style="margin-bottom:14px"><b>${h(r.descrizione)}</b> × ${h(A.num(r.qta))} ${h(r.unita || '')}</div>
        <div class="campo"><label for="ges-ro-f">Ordinata a</label><select id="ges-ro-f" name="fornitoreId"><option value="">— altro / non indicato —</option>${A.DB.fornitori.map(f => `<option value="${h(f.id)}"${def === f.id ? ' selected' : ''}>${h(f.nome)}</option>`).join('')}</select></div>
        <div class="campo"><label for="ges-ro-n">Nota <span class="muto">(facoltativa: consegna prevista, numero d'ordine…)</span></label><input id="ges-ro-n" name="nota" type="text"></div>`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: 'Segna ordinata', classe: 'acc', tipo: 'submit', icona: 'invia' }]
    });
  });
  A.azione('ges-rm-ordinata-ok', (f, ev, d) => {
    const r = A.trova('richiesteMateriale', d.id); if (!r) return;
    const fo = d.fornitoreId ? A.trova('fornitori', d.fornitoreId) : null;
    cambiaMateriale(r.id, 'ordinata', { fornitoreId: d.fornitoreId || null, ordinataIl: A.adesso(), notaOrdine: String(d.nota || '').trim() }, 'Ordinato: ' + r.descrizione + ' ×' + A.num(r.qta) + (fo ? ' (' + fo.nome + ')' : '') + (d.nota ? ' — ' + d.nota : ''), 'ordinata' + (fo ? ' a ' + fo.nome : ''));
    A.chiudiModale(); A.toast('Segnata ordinata', 'ok'); A.render();
  });
  function modaleCarico(r, arrivo) {
    const a = r.articoloId ? A.articolo(r.articoloId) : null;
    A.modale({
      titolo: arrivo ? 'Materiale arrivato' : 'Carica a magazzino', form: 'ges-rm-arrivata-ok',
      corpo: `<input type="hidden" name="id" value="${h(r.id)}"><input type="hidden" name="arrivo" value="${arrivo ? '1' : ''}">
        <div class="ges-pre" style="margin-bottom:14px"><b>${h(r.descrizione)}</b> × ${h(A.num(r.qta))} ${h(r.unita || '')}${a ? ' · <span class="ges-cod">' + h(a.codice) + '</span>' : ''}</div>
        ${a ? `<label class="spunta"><input type="checkbox" name="carica" checked> <span><b>Carica a magazzino</b><br><span class="pic">Registra un movimento di carico: la giacenza sale da sola.</span></span></label>
        <div class="riga-campi"><div class="campo"><label for="ges-ra-q">Quantità</label><input id="ges-ra-q" name="qta" type="text" inputmode="decimal" value="${h(numCampo(r.qta))}"></div>
          <div class="campo"><label for="ges-ra-m">Dove</label><select id="ges-ra-m" name="magazzinoId">${A.DB.magazzini.map(m => `<option value="${h(m.id)}"${m.id === DEPOSITO ? ' selected' : ''}>${h(m.nome)}</option>`).join('')}</select></div></div>
        <div class="campo"><label for="ges-ra-rif">Riferimento DDT <span class="muto">(facoltativo)</span></label><input id="ges-ra-rif" name="rif" type="text" placeholder="DDT 1234 del ${h(A.data(A.oggi()))}"></div>`
        : `<p class="pic">Articolo fuori catalogo: non entra in magazzino. ${arrivo ? 'Il tecnico riceve l\'avviso che è arrivato.' : ''}</p>`}${divErr}`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: arrivo ? 'Segna arrivata' : 'Carica', classe: 'ok', tipo: 'submit', icona: 'spunta' }]
    });
  }
  A.azione('ges-rm-arrivata', el => { const r = A.trova('richiesteMateriale', el.dataset.id); if (r) modaleCarico(r, true); });
  A.azione('ges-rm-carica', el => { const r = A.trova('richiesteMateriale', el.dataset.id); if (r) modaleCarico(r, false); });
  A.azione('ges-rm-arrivata-ok', (f, ev, d) => {
    const r = A.trova('richiesteMateriale', d.id); if (!r) return;
    const q = numDa(d.qta);
    if (d.carica && !(q > 0)) return erroreModale('Scrivi la quantità arrivata.');
    const carica = !!(d.carica && r.articoloId);
    const extra = {};
    if (carica) extra.caricataIl = A.adesso();
    if (d.arrivo) { extra.arrivataIl = A.adesso(); cambiaMateriale(r.id, 'arrivata', extra, 'È arrivato: ' + r.descrizione + ' ×' + A.num(r.qta) + (carica ? ' — è ' + (d.magazzinoId === DEPOSITO ? 'al deposito' : 'in ' + nomeMag(d.magazzinoId)) : ''), 'arrivata'); }
    else A.modifica(db => Object.assign(db.richiesteMateriale.find(x => x.id === r.id), extra));
    if (carica) A.modifica(db => {
      A.registraMovimento({ articoloId: r.articoloId, magazzinoId: d.magazzinoId || DEPOSITO, qta: q, tipo: 'carico', rif: String(d.rif || '').trim() || 'Arrivo materiale richiesto', nota: r.descrizione + (r.interventoId && A.intervento(r.interventoId) ? ' — per intervento N. ' + A.intervento(r.interventoId).numero : ''), controparte: r.fornitoreId || '' });
      A.registra('carico a magazzino', r.descrizione + ' +' + A.num(q) + ' ' + (r.unita || '') + ' → ' + nomeMag(d.magazzinoId));
    });
    A.chiudiModale(); A.toast(carica ? 'Arrivata e caricata a magazzino' : 'Segnata arrivata', 'ok'); A.render();
  });
  A.azione('ges-rm-rifiuta', el => {
    const r = A.trova('richiesteMateriale', el.dataset.id); if (!r) return;
    A.modale({
      titolo: 'Non ordinare', form: 'ges-rm-rifiuta-ok',
      corpo: `<input type="hidden" name="id" value="${h(r.id)}"><div class="ges-pre" style="margin-bottom:14px"><b>${h(r.descrizione)}</b> × ${h(A.num(r.qta))} ${h(r.unita || '')}</div>
        <div class="campo"><label for="ges-rr-m">Perché? <span class="muto">(lo legge il tecnico)</span></label><input id="ges-rr-m" name="motivo" type="text" placeholder="Ce ne sono ancora al deposito · Il cliente ha rinviato il lavoro"></div>`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: 'Non ordinare', classe: 'per', tipo: 'submit' }]
    });
  });
  A.azione('ges-rm-rifiuta-ok', (f, ev, d) => {
    const r = A.trova('richiesteMateriale', d.id); if (!r) return;
    const motivo = String(d.motivo || '').trim();
    cambiaMateriale(r.id, 'rifiutata', { motivo }, 'Non lo ordiniamo: ' + r.descrizione + (motivo ? ' — ' + motivo : ''), 'non ordinata');
    A.chiudiModale(); A.toast('Segnata come non da ordinare', 'ok'); A.render();
  });

  // ---- lista d'ordine per fornitore: testo da copiare, email, CSV. L'ordine lo manda Andrea.
  function gruppiOrdine() {
    const gr = {};
    A.DB.richiesteMateriale.filter(r => r.stato === 'presa').forEach(r => {
      const fid = r.fornitoreId || '';
      (gr[fid] = gr[fid] || []).push(r);
    });
    return gr;
  }
  function testoOrdine(f, righe) {
    const az = A.DB.azienda; const u = A.utente();
    return 'Buongiorno' + (f && f.referente ? ' ' + f.referente : '') + ',\nvi chiediamo per IDRAL:\n\n'
      + righe.map(r => { const a = r.articoloId ? A.articolo(r.articoloId) : null; return '- ' + A.num(r.qta) + ' ' + (r.unita || 'pz') + '  ' + (a ? nomeArticolo(a) + ' (cod. ' + a.codice + ')' : r.descrizione); }).join('\n')
      + '\n\nConsegna al deposito di ' + az.indirizzo + ', ' + az.cap + ' ' + az.citta + '.\nGrazie,\n' + u.nome + ' — IDRAL · ' + az.telefono;
  }
  A.azione('ges-lista-ordine', () => {
    const gr = gruppiOrdine(); const chiavi = Object.keys(gr).sort((a, b) => (a ? 0 : 1) - (b ? 0 : 1));
    if (!chiavi.length) return A.toast('Nessuna richiesta presa in carico', 'warn');
    const blocchi = chiavi.map((fid, k) => {
      const f = fid ? A.trova('fornitori', fid) : null; const righe = gr[fid];
      if (!f) return `<div class="ges-lo"><div class="ges-lo-t"><h3>${icona('attenzione')} Senza fornitore</h3></div><p class="pic" style="margin-bottom:8px">Scegli il fornitore nella colonna «Stato» della tabella: poi compaiono nella sua lista.</p><ul class="ges-lo-r">${righe.map(r => `<li>${h(A.num(r.qta))} ${h(r.unita || '')} — ${h(r.descrizione)}</li>`).join('')}</ul></div>`;
      const testo = testoOrdine(f, righe);
      const mailto = 'mailto:' + encodeURIComponent(f.email || '') + '?subject=' + encodeURIComponent('Ordine IDRAL del ' + A.data(A.oggi())) + '&body=' + encodeURIComponent(testo);
      return `<div class="ges-lo"><div class="ges-lo-t"><h3>${icona('furgone')} ${h(f.nome)}</h3><span class="pic">${h(f.email || '')}${f.telefono ? ' · ' + h(f.telefono) : ''}</span></div>
        <textarea id="ges-lo-${k}" class="ges-lo-testo" rows="${Math.min(14, righe.length + 7)}" readonly aria-label="Testo dell'ordine per ${h(f.nome)}">${h(testo)}</textarea>
        <div class="btns" style="margin-top:8px"><button class="btn pic pri" type="button" data-az="ges-copia" data-da="#ges-lo-${k}">${icona('copia', 'p')} Copia il testo</button>${f.email ? `<a class="btn pic" href="${h(mailto)}">${icona('posta', 'p')} Scrivi l'email</a>` : ''}<button class="btn pic" type="button" data-az="ges-lo-csv" data-f="${h(fid)}">${icona('scarica', 'p')} CSV</button><button class="btn pic acc" type="button" data-az="ges-lo-ordinate" data-f="${h(fid)}">${icona('spunta', 'p')} Segna ${righe.length === 1 ? 'ordinata' : 'tutte ordinate'}</button></div></div>`;
    }).join('');
    A.modale({ titolo: 'Lista d\'ordine per fornitore', largo: true, corpo: `<div class="avviso" style="margin-bottom:14px">${icona('info')}<div>Il gestionale non manda ordini ai fornitori: prepara il testo. Copialo nell'email o su WhatsApp, oppure apri l'email già pronta. Quando l'hai mandato, segna le righe come ordinate.</div></div>${blocchi}`, azioni: [{ testo: 'Chiudi', chiudi: true }] });
  });
  A.azione('ges-lo-csv', el => {
    const fid = el.dataset.f; const f = A.trova('fornitori', fid); const righe = (gruppiOrdine()[fid] || []);
    const csv = [['Codice', 'Articolo', 'Marca', 'Quantità', 'Unità', 'Per intervento', 'Note']].concat(righe.map(r => { const a = r.articoloId ? A.articolo(r.articoloId) : null; const i = r.interventoId ? A.intervento(r.interventoId) : null; return [a ? a.codice : '', a ? a.nome : r.descrizione, a ? a.marca : '', dec(r.qta), r.unita || '', i ? i.numero : '', r.note || '']; }));
    A.scarica('ordine-' + nomeFileSicuro(f ? f.nome : 'fornitore') + '-' + A.oggi() + '.csv', A.csv(csv), 'text/csv;charset=utf-8');
  });
  A.azione('ges-lo-ordinate', el => {
    const fid = el.dataset.f; const f = A.trova('fornitori', fid); const righe = (gruppiOrdine()[fid] || []);
    righe.forEach(r => cambiaMateriale(r.id, 'ordinata', { fornitoreId: fid, ordinataIl: A.adesso() }, 'Ordinato: ' + r.descrizione + ' ×' + A.num(r.qta) + (f ? ' (' + f.nome + ')' : ''), 'ordinata' + (f ? ' a ' + f.nome : '')));
    A.chiudiModale(); A.toast(plurale(righe.length, 'riga segnata ordinata', 'righe segnate ordinate'), 'ok'); A.render();
  });

  // ---- ordini dei clienti dall'area riservata
  const PROSSIMO_ORDINE = { nuovo: ['confermato', 'Conferma'], confermato: ['in_preparazione', 'In preparazione'], in_preparazione: ['pronto', 'Pronto'], pronto: ['consegnato', 'Consegnato'] };
  const totOrdine = o => A.arrot((o.righe || []).reduce((s, r) => s + (Number(r.qta) || 0) * (Number(r.prezzo) || 0), 0));
  function schedaOrdini(q) {
    const f = ['consegnati', 'annullati', 'tutti'].includes(q.f) ? q.f : '';
    const attivi = ['nuovo', 'confermato', 'in_preparazione', 'pronto'];
    const tutti = A.DB.ordini;
    const lista = tutti.filter(o => f === 'tutti' ? true : f === 'consegnati' ? o.stato === 'consegnato' : f === 'annullati' ? o.stato === 'annullato' : attivi.includes(o.stato))
      .sort((a, b) => f ? String(b.data).localeCompare(String(a.data)) : PASSI_ORDINE.indexOf(a.stato) - PASSI_ORDINE.indexOf(b.stato) || String(a.data).localeCompare(String(b.data)));
    const base = '#/u/materiale?scheda=ordini';
    const riga = o => {
      const c = A.cliente(o.clienteId); const s = o.sedeId ? A.sede(o.sedeId) : null; const u = o.utenteId ? A.utenteDa(o.utenteId) : null;
      const arts = (o.righe || []).map(r => { const a = A.articolo(r.articoloId); return (a ? a.nome : 'articolo') + ' ×' + A.num(r.qta); });
      const pr = PROSSIMO_ORDINE[o.stato];
      return `<tr class="${o.stato === 'nuovo' ? 'ges-da-leggere' : ''}">
        <td class="ges-prima"><span class="ges-cod">N. ${h(o.numero)}</span><div class="t2">${h(A.quando(o.data))}</div></td>
        <td data-l="Cliente" class="ges-nome"><a href="#/u/cliente/${h(o.clienteId)}"><b>${h(c ? c.nome : '—')}</b></a>${u ? `<div class="t2">da ${h(u.nome)}</div>` : ''}</td>
        <td data-l="Articoli"><span>${h(taglia(arts.slice(0, 2).join(', '), 70))}${arts.length > 2 ? ' <span class="muto">+' + (arts.length - 2) + '</span>' : ''}</span></td>
        <td data-l="Totale" class="num"><b>${h(A.euro(totOrdine(o)))}</b><div class="t2">+ IVA</div></td>
        <td data-l="Consegna">${o.consegna === 'consegna' ? `${icona('furgone', 'p')} Consegna${s ? `<div class="t2">${h(s.indirizzo)}</div>` : ''}` : `${icona('casa', 'p')} Ritiro al deposito`}</td>
        <td data-l="Stato">${pDa(STATI_ORDINE, o.stato)}</td>
        <td class="ges-az"><div class="ges-azr"><button class="btn pic" type="button" data-az="ges-ord-apri" data-id="${h(o.id)}">Dettaglio</button>${pr ? `<button class="btn pic ${o.stato === 'nuovo' ? 'acc' : pr[0] === 'consegnato' ? 'ok' : 'pri'}" type="button" data-az="ges-ord-avanza" data-id="${h(o.id)}">${h(pr[1])}</button>` : ''}</div></td>
      </tr>`;
    };
    return `<div class="ges-intesta">${segmenti([['', 'Da evadere', base, tutti.filter(o => attivi.includes(o.stato)).length], ['consegnati', 'Consegnati', base + '&f=consegnati'], ['annullati', 'Annullati', base + '&f=annullati'], ['tutti', 'Tutti', base + '&f=tutti']], f)}<p>Nuovo → confermato → in preparazione → pronto → consegnato. Il cliente riceve un avviso a ogni passaggio.</p></div>
      ${lista.length ? `<div class="tessera"><div class="tab-w"><table class="tab ges-resp"><thead><tr><th>Ordine</th><th>Cliente</th><th>Articoli</th><th class="num">Totale</th><th>Consegna</th><th>Stato</th><th></th></tr></thead><tbody>${lista.map(riga).join('')}</tbody></table></div>
        <div class="ges-dida">${icona('info', 'p')} Prezzi già scontati per il cliente, IVA esclusa. Alla consegna il materiale esce dal deposito con un movimento di scarico. Nessun pagamento online: si paga alla consegna o con la fattura.</div></div>`
        : vuotoTessera(f ? 'Niente qui' : 'Nessun ordine da evadere', 'I clienti ordinano sale, cartucce e ricambi dalla loro area: gli ordini arrivano qui.', 'carrello')}`;
  }
  A.azione('ges-ord-apri', el => {
    const o = A.trova('ordini', el.dataset.id); if (!o) return;
    const c = A.cliente(o.clienteId); const s = o.sedeId ? A.sede(o.sedeId) : null; const G = giacenzeTutte();
    const pr = PROSSIMO_ORDINE[o.stato];
    const righe = (o.righe || []).map(r => {
      const a = A.articolo(r.articoloId); const dep = gq(G, r.articoloId, DEPOSITO); const manca = dep < (Number(r.qta) || 0);
      return `<tr><td><b>${h(a ? a.nome : 'Articolo')}</b><div class="t2">${a ? h(a.codice) : ''}</div></td><td class="num">${h(A.num(r.qta))} ${h(a ? a.unita : '')}</td><td class="num">${h(A.euro(r.prezzo))}</td><td class="num">${h(A.euro((Number(r.qta) || 0) * (Number(r.prezzo) || 0)))}</td><td class="num">${manca ? A.pastiglia('al deposito ' + A.num(dep), 'warn') : '<span class="muto">' + h(A.num(dep)) + '</span>'}</td></tr>`;
    }).join('');
    const acc = [];
    if (pr) acc.push({ testo: pr[1], classe: pr[0] === 'consegnato' ? 'ok' : 'pri', az: 'ges-ord-avanza', attr: ` data-id="${h(o.id)}"`, icona: 'spunta' });
    if (!['consegnato', 'annullato'].includes(o.stato)) acc.unshift({ testo: 'Annulla l\'ordine', classe: 'per', az: 'ges-ord-annulla', attr: ` data-id="${h(o.id)}"` });
    acc.unshift({ testo: 'Chiudi', chiudi: true });
    A.modale({
      titolo: 'Ordine N. ' + o.numero, largo: true,
      corpo: `<div class="ges-chips" style="margin-bottom:12px">${pDa(STATI_ORDINE, o.stato)}<span class="pic">del ${h(A.dataOra(o.data))}</span></div>
        <dl class="dl" style="margin-bottom:14px"><dt>Cliente</dt><dd><a href="#/u/cliente/${h(o.clienteId)}" data-az="ges-vai" data-h="#/u/cliente/${h(o.clienteId)}">${h(c ? c.nome : '—')}</a></dd><dt>Consegna</dt><dd>${o.consegna === 'consegna' ? 'Consegna a ' + h(s ? A.indirizzo(s) : 'indirizzo del cliente') : 'Ritiro al deposito di ' + h(A.DB.azienda.indirizzo)}</dd>${o.note ? `<dt>Note</dt><dd>${h(o.note)}</dd>` : ''}${o.sconto ? `<dt>Sconto</dt><dd>${h(A.num(o.sconto))}% già applicato ai prezzi</dd>` : ''}</dl>
        <div class="tab-w"><table class="tab"><thead><tr><th>Articolo</th><th class="num">Q.tà</th><th class="num">Prezzo</th><th class="num">Totale</th><th class="num">Deposito</th></tr></thead><tbody>${righe}</tbody><tfoot><tr><td colspan="3">Totale (IVA esclusa)</td><td class="num">${h(A.euro(totOrdine(o)))}</td><td></td></tr></tfoot></table></div>
        ${(o.storico || []).length ? `<p class="ges-sez-t" style="margin-top:16px">Passaggi</p><ol class="ges-eventi">${o.storico.slice().reverse().map(x => `<li><b>${h((STATI_ORDINE[x.stato] || [x.stato])[0])}</b><div class="t2">${h(A.dataOra(x.data))} · ${h(nomeUtente(x.utenteId))}</div></li>`).join('')}</ol>` : ''}`,
      azioni: acc
    });
  });
  function testoOrdineCliente(o, stato, motivo) {
    const az = A.DB.azienda;
    return {
      confermato: 'Il tuo ordine N. ' + o.numero + ' è confermato',
      in_preparazione: 'Stiamo preparando il tuo ordine N. ' + o.numero,
      pronto: o.consegna === 'consegna' ? 'Il tuo ordine N. ' + o.numero + ' è pronto: te lo portiamo a breve' : 'Il tuo ordine N. ' + o.numero + ' è pronto: puoi ritirarlo al deposito di ' + az.indirizzo + ' (8-18)',
      consegnato: 'Ordine N. ' + o.numero + ' ' + (o.consegna === 'consegna' ? 'consegnato' : 'ritirato') + '. Grazie!',
      annullato: 'Il tuo ordine N. ' + o.numero + ' è stato annullato' + (motivo ? ': ' + motivo : '')
    }[stato];
  }
  function cambiaOrdine(id, stato, motivo) {
    const o0 = A.trova('ordini', id); if (!o0) return;
    const G = giacenzeTutte(); let sotto = [];
    A.modifica(db => {
      const o = db.ordini.find(x => x.id === id); const u = A.utente();
      o.stato = stato; if (motivo) o.motivo = motivo;
      (o.storico = o.storico || []).push({ stato, data: A.adesso(), utenteId: u.id });
      if (stato === 'consegnato') {
        // Il materiale esce dal deposito adesso. Mai rifiutare per giacenza a zero: si registra e si segnala.
        (o.righe || []).forEach(r => {
          if (gq(G, r.articoloId, DEPOSITO) < (Number(r.qta) || 0)) sotto.push((A.articolo(r.articoloId) || {}).nome || 'articolo');
          A.registraMovimento({ articoloId: r.articoloId, magazzinoId: DEPOSITO, qta: -(Number(r.qta) || 0), tipo: 'scarico', rif: 'Ordine cliente N. ' + o.numero, nota: (o.consegna === 'consegna' ? 'Consegnato a ' : 'Ritirato da ') + nomeCli(o.clienteId), controparte: o.clienteId });
        });
        o.consegnatoIl = A.adesso();
      }
      const t = testoOrdineCliente(o, stato, motivo);
      avvisaCliente(db, o.clienteId, t, '#/c/ordini', 'ordine', 'IDRAL — ordine N. ' + o.numero + ': ' + (STATI_ORDINE[stato] || [stato])[0].toLowerCase(), 'Gentile cliente,\n' + t + '.');
      A.registra('ordine cliente: ' + (STATI_ORDINE[stato] || [stato])[0].toLowerCase(), 'N. ' + o.numero + ' — ' + nomeCli(o.clienteId));
    });
    A.chiudiModale();
    if (sotto.length) A.toast('Consegnato. Attenzione: al deposito non ce n\'era abbastanza (' + sotto.join(', ') + '): controlla la conta.', 'warn', 6000);
    else A.toast('Ordine ' + (STATI_ORDINE[stato] || [stato])[0].toLowerCase() + ': il cliente è stato avvisato', 'ok');
    A.render();
  }
  A.azione('ges-ord-avanza', el => { const o = A.trova('ordini', el.dataset.id); const pr = o && PROSSIMO_ORDINE[o.stato]; if (pr) cambiaOrdine(o.id, pr[0]); });
  A.azione('ges-ord-annulla', el => {
    const o = A.trova('ordini', el.dataset.id); if (!o) return;
    A.modale({
      titolo: 'Annulla l\'ordine N. ' + o.numero, form: 'ges-ord-annulla-ok',
      corpo: `<input type="hidden" name="id" value="${h(o.id)}"><div class="campo"><label for="ges-oa-m">Motivo <span class="muto">(lo legge il cliente)</span></label><input id="ges-oa-m" name="motivo" type="text" placeholder="Articolo non più disponibile dal fornitore"></div>`,
      azioni: [{ testo: 'Indietro', chiudi: true }, { testo: 'Annulla l\'ordine', classe: 'per', tipo: 'submit' }]
    });
  });
  A.azione('ges-ord-annulla-ok', (f, ev, d) => cambiaOrdine(d.id, 'annullato', String(d.motivo || '').trim()));

  // ---- sotto scorta: cosa riordinare, con la quantita' suggerita
  function schedaScorta() {
    const db = A.DB; const G = giacenzeTutte();
    const aperte = new Set(db.richiesteMateriale.filter(r => APERTE_MAT.includes(r.stato) && r.articoloId).map(r => r.articoloId));
    const lista = db.articoli.filter(a => a.attivo !== false && a.scortaMin > 0 && gq(G, a.id) < a.scortaMin)
      .sort((a, b) => (gq(G, a.id) / a.scortaMin) - (gq(G, b.id) / b.scortaMin));
    if (!lista.length) return vuotoTessera('Magazzino in ordine', 'Nessun articolo è sotto la scorta minima.', 'spunta');
    const riga = a => {
      const tot = gq(G, a.id), dep = gq(G, a.id, DEPOSITO), imp = A.impegnata(a.id);
      // Si riporta a due volte la scorta minima, tenendo conto di quello gia' promesso nei preventivi accettati.
      const sugg = Math.max(1, Math.ceil(a.scortaMin * 2 - (tot - imp)));
      const f = fornitoreSuggerito({ articoloId: a.id, descrizione: a.nome }); const gia = aperte.has(a.id);
      return `<tr class="ges-con-cb">
        <td class="ges-cb"><input type="checkbox" name="sel" value="${h(a.id)}"${gia ? ' disabled' : ' checked'} aria-label="Scegli ${h(a.nome)}"></td>
        <td class="ges-nome ges-prima"><a href="#/u/articolo/${h(a.id)}" style="color:inherit"><b>${h(nomeArticolo(a))}</b></a><div class="t2"><span class="ges-cod">${h(a.codice)}</span> · ${h(a.categoria)}</div>${gia ? `<div style="margin-top:4px">${A.pastiglia('già nella lista d\'ordine', 'blu')}</div>` : ''}</td>
        <td data-l="In totale" class="num"><b class="${tot <= 0 ? 'ges-giu' : ''}">${h(A.num(tot))}</b> <span class="muto">${h(a.unita)}</span><div class="t2">deposito ${h(A.num(dep))} · furgoni ${h(A.num(tot - dep))}</div></td>
        <td data-l="Impegnata" class="num">${imp ? h(A.num(imp)) : '<span class="muto">0</span>'}</td>
        <td data-l="Scorta minima" class="num">${h(A.num(a.scortaMin))}</td>
        <td data-l="Da ordinare" class="num"><input class="ges-inp-num" type="text" inputmode="decimal" name="q_${h(a.id)}" value="${h(sugg)}" aria-label="Quantità da ordinare"${gia ? ' disabled' : ''}></td>
        <td data-l="Fornitore">${f ? h(f.nome) : '<span class="muto">—</span>'}</td>
      </tr>`;
    };
    return `<form data-form="ges-scorta-ok" novalidate>
      <div class="ges-intesta"><p>${plurale(lista.length, 'articolo è', 'articoli sono')} sotto la scorta minima (deposito più furgoni). La quantità suggerita riporta a due volte la scorta, tolto quello già promesso nei preventivi accettati.</p>
        <button class="btn pri" type="submit">${icona('carrello')} Aggiungi alla lista d'ordine</button></div>
      <div class="tessera"><div class="tab-w"><table class="tab ges-resp"><thead><tr><th class="ges-cb"></th><th>Articolo</th><th class="num">In totale</th><th class="num">Impegnata</th><th class="num">Scorta min.</th><th class="num">Da ordinare</th><th>Fornitore</th></tr></thead><tbody>${lista.map(riga).join('')}</tbody></table></div></div>
    </form>`;
  }
  A.azione('ges-scorta-ok', (f, ev, d) => {
    const sel = Array.isArray(d.sel) ? d.sel : d.sel ? [f.querySelector('input[name=sel]').value] : [];
    if (!sel.length) return A.toast('Scegli almeno un articolo', 'warn');
    const u = A.utente(); let n = 0;
    A.modifica(db => {
      sel.forEach(aid => {
        const a = db.articoli.find(x => x.id === aid); const q = numDa(d['q_' + aid]); if (!a || !(q > 0)) return;
        if (db.richiesteMateriale.some(r => r.articoloId === aid && APERTE_MAT.includes(r.stato))) return;
        const fo = fornitoreSuggerito({ articoloId: aid, descrizione: a.nome });
        db.richiesteMateriale.push({ id: A.uid('rmat'), interventoId: null, tecnicoId: u.id, articoloId: aid, descrizione: nomeArticolo(a), qta: q, unita: a.unita, urgenza: 'normale', stato: 'presa', data: A.adesso(), fornitoreId: fo ? fo.id : null, note: 'Riordino: sotto scorta', storico: [{ stato: 'presa', data: A.adesso(), utenteId: u.id }] });
        n++;
      });
      if (n) A.registra('riordino sotto scorta', plurale(n, 'articolo', 'articoli') + ' nella lista d\'ordine');
    });
    A.toast(n ? plurale(n, 'articolo aggiunto', 'articoli aggiunti') + ' alla lista d\'ordine' : 'Niente da aggiungere', n ? 'ok' : 'warn');
    A.vai('#/u/materiale?scheda=richieste');
  });

  // ---- fornitori: solo rubrica
  function schedaFornitori() {
    const db = A.DB;
    const carte = db.fornitori.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map(f => {
      const aperte = db.richiesteMateriale.filter(r => r.fornitoreId === f.id && ['presa', 'ordinata'].includes(r.stato)).length;
      return `<div class="tessera ges-carta"><div class="tt"><h3>${icona('furgone')} ${h(f.nome)}</h3>${aperte ? A.pastiglia(plurale(aperte, 'riga aperta', 'righe aperte'), 'acc') : ''}</div>
        <div class="cp">
          ${f.referente ? `<div class="ges-riga-i">${icona('utente', 'p')}<div>${h(f.referente)}</div></div>` : ''}
          ${f.telefono ? `<div class="ges-riga-i">${icona('telefono', 'p')}<div><a href="${h(telLink(f.telefono))}">${h(f.telefono)}</a></div></div>` : ''}
          ${f.email ? `<div class="ges-riga-i">${icona('posta', 'p')}<div><a href="mailto:${h(f.email)}">${h(f.email)}</a></div></div>` : ''}
          ${f.categorie ? `<div class="ges-chips">${String(f.categorie).split(',').map(x => x.trim()).filter(Boolean).map(x => `<span class="ges-chip">${h(x)}</span>`).join('')}</div>` : ''}
          ${f.note ? `<div class="t2" style="font-size:13px;color:var(--ink-3)">${h(f.note)}</div>` : ''}
        </div>
        <div class="ges-piede"><button class="btn pic" type="button" data-az="ges-for-mod" data-id="${h(f.id)}">${icona('modifica', 'p')} Modifica</button></div></div>`;
    }).join('');
    return `<div class="ges-intesta"><p>La rubrica dei fornitori: la «Lista d'ordine» usa le categorie per proporre a chi chiedere.</p><button class="btn pri" type="button" data-az="ges-for-mod">${icona('piu')} Nuovo fornitore</button></div>
      ${db.fornitori.length ? `<div class="ges-carte">${carte}</div>` : vuotoTessera('Nessun fornitore', 'Aggiungi i fornitori da cui compri: servono per preparare le liste d\'ordine.', 'furgone')}`;
  }
  A.azione('ges-for-mod', el => {
    const f = el.dataset.id ? A.trova('fornitori', el.dataset.id) : null; const x = f || {};
    A.modale({
      titolo: f ? 'Modifica fornitore' : 'Nuovo fornitore', form: 'ges-for-salva',
      corpo: `<input type="hidden" name="id" value="${h(f ? f.id : '')}">
        <div class="ges-form-g">
          <div class="campo tutta"><label for="ges-f-n">Nome</label><input id="ges-f-n" name="nome" type="text" value="${h(x.nome || '')}" required></div>
          <div class="campo"><label for="ges-f-r">Referente</label><input id="ges-f-r" name="referente" type="text" value="${h(x.referente || '')}"></div>
          <div class="campo"><label for="ges-f-t">Telefono</label><input id="ges-f-t" name="telefono" type="tel" value="${h(x.telefono || '')}"></div>
          <div class="campo tutta"><label for="ges-f-e">Email per gli ordini</label><input id="ges-f-e" name="email" type="email" value="${h(x.email || '')}"></div>
          <div class="campo tutta"><label for="ges-f-c">Cosa gli compri</label><input id="ges-f-c" name="categorie" type="text" value="${h(x.categorie || '')}" placeholder="Raccorderia, tubi, valvolame"><span class="aiuto">Separate da una virgola: servono a proporre il fornitore giusto.</span></div>
          <div class="campo tutta"><label for="ges-f-no">Note</label><textarea id="ges-f-no" name="note" rows="2" placeholder="Consegna in giornata se si ordina entro le 10">${h(x.note || '')}</textarea></div>
        </div>${divErr}`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: f ? 'Salva' : 'Aggiungi', classe: 'pri', tipo: 'submit', icona: 'spunta' }]
    });
  });
  A.azione('ges-for-salva', (f, ev, d) => {
    const nome = String(d.nome || '').trim(); if (!nome) return erroreModale('Scrivi il nome del fornitore.');
    if (d.email && !emailValida(d.email)) return erroreModale('L\'email non sembra giusta.');
    const x = { nome, referente: String(d.referente || '').trim(), telefono: String(d.telefono || '').trim(), email: String(d.email || '').trim(), categorie: String(d.categorie || '').trim(), note: String(d.note || '').trim() };
    A.modifica(db => {
      if (d.id) Object.assign(db.fornitori.find(y => y.id === d.id), x); else db.fornitori.push(Object.assign({ id: A.uid('for') }, x));
      A.registra(d.id ? 'fornitore modificato' : 'fornitore aggiunto', nome);
    });
    A.chiudiModale(); A.toast('Fornitore salvato', 'ok'); A.render();
  });

  rotta('#/u/materiale', paginaMateriale);

  // ===========================================================================
  // 6. MAGAZZINO — la giacenza e' la somma dei movimenti (A.registraMovimento
  //    e' l'unica porta); i movimenti non si toccano: si corregge con un altro.
  // ===========================================================================
  const UNITA = ['pz', 'm', 'lt', 'kg', 'kit', 'sacco', 'corpo', 'h'];
  function filtraArticoli(q, G) {
    const parole = norm(q.cerca).split(/\s+/).filter(Boolean);
    return A.DB.articoli.filter(a => {
      if (!q.tutti && a.attivo === false) return false;
      if (q.cat && a.categoria !== q.cat) return false;
      if (q.sotto && !(a.scortaMin > 0 && gq(G, a.id) < a.scortaMin)) return false;
      if (parole.length && !parole.every(p => norm([a.codice, a.nome, a.marca, a.categoria, a.barcode].join(' ')).includes(p))) return false;
      return true;
    }).sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome));
  }
  function paginaMagazzino(par) {
    const q = par.q; const db = A.DB; const G = giacenzeTutte();
    const mag = q.mag && A.trova('magazzini', q.mag) ? q.mag : '';
    const conImp = !mag || mag === DEPOSITO;
    const lista = filtraArticoli(q, G);
    let valore = 0, pezzi = 0;
    lista.forEach(a => { const f = gq(G, a.id, mag); if (f > 0) { valore += f * (Number(a.costo) || 0); pezzi++; } });
    const sotto = db.articoli.filter(a => a.attivo !== false && a.scortaMin > 0 && gq(G, a.id) < a.scortaMin).length;
    const negativi = lista.filter(a => gq(G, a.id, mag) < 0).length;
    const cats = Array.from(new Set(db.articoli.map(a => a.categoria))).sort();
    const movMese = db.movimenti.filter(m => String(m.data).slice(0, 10) >= A.piuGiorni(A.oggi(), -30) && (!mag || m.magazzinoId === mag)).length;
    const conFiltri = q.cerca || q.cat || q.sotto;
    const riga = a => {
      const fis = gq(G, a.id, mag), imp = conImp ? A.impegnata(a.id) : 0, disp = A.arrot(fis - imp), tot = gq(G, a.id);
      const sottoS = a.scortaMin > 0 && tot < a.scortaMin;
      return `<tr class="clic${a.attivo === false ? ' ges-spento' : ''}" data-az="ges-art-apri" data-id="${h(a.id)}">
        <td class="ges-prima"><span class="ges-cod">${h(a.codice)}</span><div><a href="#/u/articolo/${h(a.id)}" style="color:inherit"><b>${h(a.nome)}</b></a></div><div class="t2">${h(a.marca && a.marca !== 'generica' ? a.marca : '')}${a.solito ? (a.marca && a.marca !== 'generica' ? ' · ' : '') + 'dei soliti' : ''}</div></td>
        <td data-l="Categoria">${h(a.categoria)}</td>
        <td data-l="Fisica" class="num">${h(A.num(fis))} <span class="muto">${h(a.unita)}</span></td>
        <td data-l="Impegnata" class="num">${conImp ? (imp ? h(A.num(imp)) : '<span class="muto">0</span>') : '<span class="muto">—</span>'}</td>
        <td data-l="Disponibile" class="num"><span class="ges-disp ${disp < 0 ? 'neg' : disp === 0 ? 'zero' : ''}">${h(A.num(disp))}</span></td>
        <td data-l="Scorta minima" class="num">${a.scortaMin ? h(A.num(a.scortaMin)) : '<span class="muto">—</span>'}${sottoS ? '<div style="margin-top:3px">' + A.pastiglia('sotto scorta', 'warn') + '</div>' : ''}</td>
        <td data-l="Costo" class="num">${h(A.euro(a.costo))}</td>
        <td data-l="Prezzo" class="num">${h(A.euro(a.prezzo))}</td>
      </tr>`;
    };
    const magOpz = [['', 'Tutti i magazzini']].concat(db.magazzini.map(m => [m.id, m.tipo === 'sede' ? 'Deposito' : m.nome]));
    const contenuto = `<div class="ges-kpis">
        ${kpi({ cl: 'evid', ic: 'euro', l: 'Valore del magazzino' + (mag ? ' — ' + nomeMagBreve(mag) : ''), v: h(A.euro(valore, true)), d: 'Giacenza per costo d\'acquisto' + (conFiltri ? ', articoli filtrati' : '') })}
        ${kpi({ ic: 'pacco', l: 'Articoli presenti', v: String(pezzi), d: 'su ' + lista.length + (conFiltri ? ' filtrati' : ' a catalogo') })}
        ${kpi({ ic: 'attenzione', l: 'Sotto scorta', v: String(sotto), d: sotto ? '<a href="#/u/materiale?scheda=scorta">Prepara il riordino →</a>' : 'Tutto sopra la scorta minima', link: '' })}
        ${kpi({ ic: 'storico', l: 'Movimenti in 30 giorni', v: String(movMese), d: negativi ? `<b>${negativi}</b> ${negativi === 1 ? 'articolo' : 'articoli'} sotto zero: serve una conta` : 'Nessuna giacenza negativa' })}
      </div>
      <div class="ges-intesta" style="margin-bottom:12px"><div class="btns">
        <button class="btn pri" type="button" data-az="ges-mov-carico" data-m="${h(mag || DEPOSITO)}">${icona('carica')} Carico</button>
        <button class="btn" type="button" data-az="ges-mov-trasf" data-m="${h(mag || DEPOSITO)}">${icona('furgone')} Trasferimento</button>
        <button class="btn" type="button" data-az="ges-mov-conta" data-m="${h(mag || DEPOSITO)}">${icona('verifica')} Conta / rettifica</button>
        <button class="btn" type="button" data-az="ges-art-nuovo">${icona('piu')} Nuovo articolo</button></div>
        <button class="btn vuoto" type="button" data-az="ges-mag-csv">${icona('scarica')} Esporta CSV</button></div>
      <div class="ges-filtri">
        ${selFiltro('mag', mag, magOpz, 'Magazzino')}
        ${campoCerca('ges-mag-cerca', q.cerca, 'Codice, nome, marca, codice a barre…', 'cerca')}
        ${selFiltro('cat', q.cat, [['', 'Tutte le categorie']].concat(cats.map(c => [c, c])), 'Categoria')}
        <label class="spunta" style="padding:0 6px"><input type="checkbox" data-cambia="ges-filtro" data-k="sotto"${q.sotto ? ' checked' : ''}> Solo sotto scorta</label>
        ${conFiltri ? `<a class="btn vuoto pic" href="#/u/magazzino${mag ? '?mag=' + h(mag) : ''}">${icona('x', 'p')} Togli i filtri</a>` : ''}
      </div>
      ${lista.length ? `<div class="tessera"><div class="tab-w"><table class="tab ges-resp ges-tab-mag"><thead><tr><th>Articolo</th><th>Categoria</th><th class="num">Fisica</th><th class="num">Impegnata</th><th class="num">Disponibile</th><th class="num">Scorta min.</th><th class="num">Costo</th><th class="num">Prezzo</th></tr></thead><tbody>${lista.map(riga).join('')}</tbody></table></div>
        <div class="ges-dida">${icona('info', 'p')} La giacenza è la somma dei movimenti (carichi, scarichi dei rapportini, trasferimenti, rettifiche). I movimenti non si cancellano: un errore si corregge con una rettifica. «Impegnata» è il materiale già promesso nei preventivi accettati.</div></div>`
        : vuotoTessera('Nessun articolo', 'Nessun articolo corrisponde ai filtri.', 'cerca')}`;
    return pagina({ attivo: 'magazzino', titolo: 'Magazzino', briciole: [['Materiale', '#/u/magazzino']], azioni: `<a class="btn" href="#/u/materiale">${icona('carrello')}<span class="ges-nt">Ordini e materiale</span></a>`, contenuto });
  }
  A.azione('ges-art-apri', el => A.vai('#/u/articolo/' + el.dataset.id));
  A.azione('ges-mag-csv', () => {
    const q = qCorrente(); const G = giacenzeTutte(); const mag = q.mag || '';
    const lista = filtraArticoli(q, G);
    const righe = [['Codice', 'Articolo', 'Marca', 'Categoria', 'Unità', 'Magazzino', 'Fisica', 'Impegnata', 'Disponibile', 'Scorta minima', 'Costo', 'Prezzo', 'Valore a costo']].concat(lista.map(a => {
      const f = gq(G, a.id, mag), imp = !mag || mag === DEPOSITO ? A.impegnata(a.id) : 0;
      return [a.codice, a.nome, a.marca, a.categoria, a.unita, mag ? nomeMag(mag) : 'Tutti', dec(f), dec(imp), dec(f - imp), dec(a.scortaMin), dec(a.costo), dec(a.prezzo), dec(Math.max(0, f) * a.costo)];
    }));
    A.scarica('magazzino-' + A.oggi() + '.csv', A.csv(righe), 'text/csv;charset=utf-8');
    A.modifica(() => A.registra('export magazzino', lista.length + ' articoli'));
  });

  // ---- movimenti: carico, trasferimento, conta
  function opzArticoli(sel) {
    const per = {};
    A.DB.articoli.filter(a => a.attivo !== false || a.id === sel).forEach(a => { (per[a.categoria] = per[a.categoria] || []).push(a); });
    return '<option value="">— scegli l\'articolo —</option>' + Object.keys(per).sort().map(c => `<optgroup label="${h(c)}">${per[c].sort((a, b) => a.nome.localeCompare(b.nome)).map(a => `<option value="${h(a.id)}"${sel === a.id ? ' selected' : ''}>${h(a.codice + ' — ' + nomeArticolo(a))}</option>`).join('')}</optgroup>`).join('');
  }
  function opzMagazzini(sel, escludi) { return A.DB.magazzini.filter(m => m.id !== escludi).map(m => `<option value="${h(m.id)}"${sel === m.id ? ' selected' : ''}>${h(m.nome)}</option>`).join(''); }
  /** Riga informativa sotto i campi: quanto c'e' adesso, per non scrivere a occhio. */
  function infoGiacenza() {
    const a = A.articolo((A.$('#ges-mv-a') || {}).value); const m = (A.$('#ges-mv-m') || {}).value; const box = A.$('#ges-mv-info');
    if (!box) return;
    if (!a) { box.innerHTML = ''; return; }
    const g = A.giacenza(a.id, m);
    box.innerHTML = `${icona('pacco', 'p')} In archivio ${m ? 'in ' + h(nomeMag(m)) : ''}: <b>${h(A.num(g))} ${h(a.unita)}</b>${g < 0 ? ' — sotto zero, serve una conta' : ''}`;
  }
  A.azione('ges-mv-info', () => infoGiacenza());
  function modaleMovimento(tipo, el) {
    const a = el.dataset.a || ''; const m = el.dataset.m || DEPOSITO;
    const furg = A.DB.magazzini.find(x => x.tipo === 'furgone' && x.id !== m);
    const titoli = { carico: 'Carico a magazzino', trasf: 'Trasferimento', conta: 'Conta e rettifica' };
    let campi = '';
    if (tipo === 'carico') campi = `<div class="riga-campi"><div class="campo"><label for="ges-mv-q">Quantità arrivata</label><input id="ges-mv-q" name="qta" type="text" inputmode="decimal" required></div><div class="campo"><label for="ges-mv-m">In</label><select id="ges-mv-m" name="magazzinoId" data-cambia="ges-mv-info">${opzMagazzini(m)}</select></div></div>
        <div class="riga-campi"><div class="campo"><label for="ges-mv-rif">Riferimento DDT</label><input id="ges-mv-rif" name="rif" type="text" placeholder="DDT 1234 del ${h(A.data(A.oggi()))}"></div><div class="campo"><label for="ges-mv-f">Fornitore <span class="muto">(facoltativo)</span></label><select id="ges-mv-f" name="fornitoreId"><option value="">—</option>${A.DB.fornitori.map(f => `<option value="${h(f.id)}">${h(f.nome)}</option>`).join('')}</select></div></div>`;
    else if (tipo === 'trasf') campi = `<div class="campo"><label for="ges-mv-q">Quantità</label><input id="ges-mv-q" name="qta" type="text" inputmode="decimal" required></div>
        <div class="riga-campi"><div class="campo"><label for="ges-mv-m">Da</label><select id="ges-mv-m" name="da" data-cambia="ges-mv-info">${opzMagazzini(m)}</select></div><div class="campo"><label for="ges-mv-a2">A</label><select id="ges-mv-a2" name="a">${opzMagazzini(furg ? furg.id : '')}</select></div></div>
        <p class="pic">Il classico: dal deposito al furgone di un tecnico. Si registrano due movimenti, un'uscita e un'entrata.</p>`;
    else campi = `<div class="riga-campi"><div class="campo"><label for="ges-mv-m">Magazzino contato</label><select id="ges-mv-m" name="magazzinoId" data-cambia="ges-mv-info">${opzMagazzini(m)}</select></div><div class="campo"><label for="ges-mv-q">Quantità contata</label><input id="ges-mv-q" name="contata" type="text" inputmode="decimal" required></div></div>
        <p class="pic">Scrivi quanti pezzi ci sono davvero: la differenza con l'archivio diventa un movimento di rettifica. Il movimento sbagliato resta dov'è.</p>`;
    A.modale({
      titolo: titoli[tipo], form: 'ges-mv-' + tipo + '-ok',
      corpo: `<div class="campo"><label for="ges-mv-a">Articolo</label><select id="ges-mv-a" name="articoloId" data-cambia="ges-mv-info">${opzArticoli(a)}</select></div>
        ${campi}<div id="ges-mv-info" class="ges-mv-info" role="status"></div>
        <div class="campo" style="margin-top:12px"><label for="ges-mv-n">Nota <span class="muto">(facoltativa)</span></label><input id="ges-mv-n" name="nota" type="text" placeholder="${tipo === 'conta' ? 'Inventario di fine mese · pezzo rotto' : ''}"></div>${divErr}`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: tipo === 'carico' ? 'Registra il carico' : tipo === 'trasf' ? 'Registra il trasferimento' : 'Registra la conta', classe: 'pri', tipo: 'submit', icona: 'spunta' }],
      dopo: () => infoGiacenza()
    });
  }
  A.azione('ges-mov-carico', el => modaleMovimento('carico', el));
  A.azione('ges-mov-trasf', el => modaleMovimento('trasf', el));
  A.azione('ges-mov-conta', el => modaleMovimento('conta', el));
  A.azione('ges-mv-carico-ok', (f, ev, d) => {
    const a = A.articolo(d.articoloId); if (!a) return erroreModale('Scegli l\'articolo.');
    const q = numDa(d.qta); if (!(q > 0)) return erroreModale('Scrivi la quantità arrivata.');
    const fo = d.fornitoreId ? A.trova('fornitori', d.fornitoreId) : null;
    A.modifica(() => {
      A.registraMovimento({ articoloId: a.id, magazzinoId: d.magazzinoId, qta: q, tipo: 'carico', rif: String(d.rif || '').trim() || 'Carico', nota: String(d.nota || '').trim(), controparte: fo ? fo.id : '' });
      A.registra('carico a magazzino', a.codice + ' +' + A.num(q) + ' ' + a.unita + ' → ' + nomeMag(d.magazzinoId) + (d.rif ? ' (' + d.rif + ')' : ''));
    });
    A.chiudiModale(); A.toast('Carico registrato: ' + nomeArticolo(a) + ' +' + A.num(q), 'ok'); A.render();
  });
  A.azione('ges-mv-trasf-ok', (f, ev, d) => {
    const a = A.articolo(d.articoloId); if (!a) return erroreModale('Scegli l\'articolo.');
    const q = numDa(d.qta); if (!(q > 0)) return erroreModale('Scrivi la quantità da spostare.');
    if (d.da === d.a) return erroreModale('Partenza e arrivo sono lo stesso magazzino.');
    const prima = A.giacenza(a.id, d.da);
    const nota = String(d.nota || '').trim();
    A.modifica(() => {
      A.registraMovimento({ articoloId: a.id, magazzinoId: d.da, qta: -q, tipo: 'trasferimento', rif: 'Verso ' + nomeMagBreve(d.a), nota, controparte: d.a });
      A.registraMovimento({ articoloId: a.id, magazzinoId: d.a, qta: q, tipo: 'trasferimento', rif: 'Da ' + nomeMagBreve(d.da), nota, controparte: d.da });
      A.registra('trasferimento di magazzino', a.codice + ' ' + A.num(q) + ' ' + a.unita + ': ' + nomeMagBreve(d.da) + ' → ' + nomeMagBreve(d.a));
    });
    A.chiudiModale();
    // Mai bloccare: si registra e si segnala, la conta sistemera' l'archivio.
    if (prima < q) A.toast('Registrato, ma in ' + nomeMagBreve(d.da) + ' risultavano solo ' + A.num(prima) + ' ' + a.unita + ': ora è sotto zero. Fai una conta.', 'warn', 6000);
    else A.toast('Trasferiti ' + A.num(q) + ' ' + a.unita + ' → ' + nomeMagBreve(d.a), 'ok');
    A.render();
  });
  A.azione('ges-mv-conta-ok', (f, ev, d) => {
    const a = A.articolo(d.articoloId); if (!a) return erroreModale('Scegli l\'articolo.');
    if (String(d.contata || '').trim() === '') return erroreModale('Scrivi la quantità contata (anche 0).');
    const contata = numDa(d.contata); if (contata < 0) return erroreModale('La quantità contata non può essere negativa.');
    const attuale = A.giacenza(a.id, d.magazzinoId);
    const diff = Math.round((contata - attuale) * 1000) / 1000;
    if (!diff) { A.chiudiModale(); return A.toast('Nessuna differenza: l\'archivio era già giusto', 'ok'); }
    A.modifica(() => {
      A.registraMovimento({ articoloId: a.id, magazzinoId: d.magazzinoId, qta: diff, tipo: 'rettifica', rif: 'Conta del ' + A.data(A.oggi()), nota: String(d.nota || '').trim() || 'Contati ' + A.num(contata) + ', in archivio ' + A.num(attuale) });
      A.registra('rettifica di magazzino', a.codice + ' in ' + nomeMagBreve(d.magazzinoId) + ': ' + A.num(attuale) + ' → ' + A.num(contata) + ' (' + (diff > 0 ? '+' : '') + A.num(diff) + ')');
    });
    A.chiudiModale(); A.toast('Rettifica registrata: ' + (diff > 0 ? '+' : '') + A.num(diff) + ' ' + a.unita, 'ok'); A.render();
  });

  // ---- anagrafica articolo
  function campiArticolo(a) {
    a = a || {};
    const cats = Array.from(new Set(A.DB.articoli.map(x => x.categoria))).sort();
    return `<div class="ges-form-g">
      <div class="campo"><label for="ges-ar-cod">Codice</label><input id="ges-ar-cod" name="codice" type="text" value="${h(a.codice || '')}" required autocapitalize="characters"></div>
      <div class="campo"><label for="ges-ar-bc">Codice a barre <span class="muto">(facoltativo)</span></label><input id="ges-ar-bc" name="barcode" type="text" inputmode="numeric" value="${h(a.barcode || '')}"></div>
      <div class="campo tutta"><label for="ges-ar-nome">Nome</label><input id="ges-ar-nome" name="nome" type="text" value="${h(a.nome || '')}" required></div>
      <div class="campo"><label for="ges-ar-mar">Marca</label><input id="ges-ar-mar" name="marca" type="text" value="${h(a.marca || '')}"></div>
      <div class="campo"><label for="ges-ar-cat">Categoria</label><input id="ges-ar-cat" name="categoria" type="text" value="${h(a.categoria || '')}" list="ges-ar-cats"><datalist id="ges-ar-cats">${cats.map(c => `<option value="${h(c)}">`).join('')}</datalist></div>
      <div class="campo"><label for="ges-ar-un">Unità</label><select id="ges-ar-un" name="unita">${UNITA.concat(a.unita && !UNITA.includes(a.unita) ? [a.unita] : []).map(u => `<option value="${u}"${(a.unita || 'pz') === u ? ' selected' : ''}>${u}</option>`).join('')}</select></div>
      <div class="campo"><label for="ges-ar-sm">Scorta minima</label><input id="ges-ar-sm" name="scortaMin" type="text" inputmode="decimal" value="${h(numCampo(a.scortaMin || 0))}"><span class="aiuto">Sotto questa quantità (deposito più furgoni) compare fra i «sotto scorta».</span></div>
      <div class="campo"><label for="ges-ar-co">Costo d'acquisto €</label><input id="ges-ar-co" name="costo" type="text" inputmode="decimal" value="${h(numCampo(a.costo || 0, 2))}" data-digita="ges-ar-ricarico"></div>
      <div class="campo"><label for="ges-ar-pr">Prezzo di vendita €</label><input id="ges-ar-pr" name="prezzo" type="text" inputmode="decimal" value="${h(numCampo(a.prezzo || 0, 2))}" data-digita="ges-ar-ricarico"><span class="aiuto" id="ges-ar-ric">${ricaricoTesto(a.costo, a.prezzo)}</span></div>
      <label class="spunta tutta"><input type="checkbox" name="solito"${a.solito ? ' checked' : ''}> <span><b>Tra i «soliti» dei tecnici</b><br><span class="pic">Compare in cima quando il tecnico segna il materiale usato (senza prezzo).</span></span></label>
      ${a.id ? `<label class="spunta tutta"><input type="checkbox" name="attivo"${a.attivo !== false ? ' checked' : ''}> <span><b>Attivo</b><br><span class="pic">Un articolo spento non si propone più, ma i suoi movimenti restano.</span></span></label>` : ''}
    </div>`;
  }
  function ricaricoTesto(costo, prezzo) {
    costo = Number(costo) || 0; prezzo = Number(prezzo) || 0;
    if (!costo || !prezzo) return 'Il prezzo al cliente, IVA esclusa.';
    return 'Ricarico ' + Math.round((prezzo / costo - 1) * 100) + '% · margine ' + Math.round((1 - costo / prezzo) * 100) + '% sul prezzo';
  }
  A.azione('ges-ar-ricarico', () => { const r = A.$('#ges-ar-ric'); if (r) r.textContent = ricaricoTesto(numDa((A.$('#ges-ar-co') || {}).value), numDa((A.$('#ges-ar-pr') || {}).value)); });
  function datiArticolo(d) {
    return { codice: String(d.codice || '').trim().toUpperCase(), barcode: String(d.barcode || '').trim(), nome: String(d.nome || '').trim(), marca: String(d.marca || '').trim(), categoria: String(d.categoria || '').trim() || 'Varie', unita: d.unita || 'pz', scortaMin: Math.max(0, numDa(d.scortaMin)), costo: Math.max(0, numDa(d.costo)), prezzo: Math.max(0, numDa(d.prezzo)), solito: !!d.solito };
  }
  function controllaArticolo(x, id) {
    if (!x.codice) return 'Scrivi il codice.';
    if (!x.nome) return 'Scrivi il nome dell\'articolo.';
    if (A.DB.articoli.some(a => a.id !== id && a.codice.toUpperCase() === x.codice)) return 'C\'è già un articolo con il codice ' + x.codice + '.';
    return '';
  }
  A.azione('ges-art-nuovo', () => {
    A.modale({
      titolo: 'Nuovo articolo', largo: true, form: 'ges-art-crea',
      corpo: `${campiArticolo({ unita: 'pz' })}<div class="sep"></div><div class="riga-campi"><div class="campo"><label for="ges-ar-gi">Giacenza iniziale al deposito <span class="muto">(facoltativa)</span></label><input id="ges-ar-gi" name="iniziale" type="text" inputmode="decimal" placeholder="0"><span class="aiuto">Diventa un movimento di carico, come ogni altra entrata.</span></div></div>${divErr}`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: 'Crea l\'articolo', classe: 'pri', tipo: 'submit', icona: 'spunta' }]
    });
  });
  A.azione('ges-art-crea', (f, ev, d) => {
    const x = datiArticolo(d); const err = controllaArticolo(x); if (err) return erroreModale(err);
    const ini = numDa(d.iniziale); let id;
    A.modifica(db => {
      id = A.uid('art'); db.articoli.push(Object.assign({ id, attivo: true }, x));
      if (ini > 0) A.registraMovimento({ articoloId: id, magazzinoId: DEPOSITO, qta: ini, tipo: 'carico', rif: 'Carico iniziale', nota: 'Nuovo articolo' });
      A.registra('articolo creato', x.codice + ' — ' + x.nome);
    });
    A.chiudiModale(); A.toast('Articolo creato', 'ok'); A.vai('#/u/articolo/' + id);
  });

  function paginaArticolo(par) {
    const a = A.articolo(par.id);
    if (!a) return nonTrovato('magazzino', 'Articolo non trovato', [['Magazzino', '#/u/magazzino']], 'Questo articolo non c\'è.', ['Torna al magazzino', '#/u/magazzino']);
    const db = A.DB; const G = giacenzeTutte();
    const tot = gq(G, a.id), imp = A.impegnata(a.id), disp = A.arrot(tot - imp);
    const sotto = a.scortaMin > 0 && tot < a.scortaMin;
    const movs = db.movimenti.filter(m => m.articoloId === a.id).sort((x, y) => String(y.data).localeCompare(String(x.data)));
    const MAX = 80; const vis = par.q.tutti === '1' ? movs : movs.slice(0, MAX);
    const prev = db.preventivi.filter(p => p.stato === 'accettato' && (p.righe || []).some(r => r.articoloId === a.id && (!r.opzionale || r.scelta)));
    const id = h(a.id);
    const testata = `<div class="tessera ges-testata">
      <div class="ges-t-su"><div class="ges-t-1"><span class="ges-t-num">${h(a.codice)}</span><span class="ges-chip">${h(a.categoria)}</span>${a.attivo === false ? A.pastiglia('Disattivato', 'grigio') : ''}${sotto ? A.pastiglia('Sotto scorta', 'warn') : ''}${a.solito ? A.pastiglia('Dei soliti', 'blu', true) : ''}</div>
        <h2>${h(nomeArticolo(a))}</h2>
        <div class="ges-t-meta"><span>${icona('euro', 'p')}Costo ${h(A.euro(a.costo))} · prezzo ${h(A.euro(a.prezzo))} / ${h(a.unita)}</span>${a.barcode ? `<span>${icona('elenco', 'p')}<span class="ges-cod">${h(a.barcode)}</span></span>` : ''}</div></div>
      <div class="ges-t-cifre"><div><small>Giacenza fisica</small><b class="ges-num">${h(A.num(tot))} ${h(a.unita)}</b></div><div><small>Impegnata</small><b class="ges-num">${h(A.num(imp))}</b></div><div><small>Disponibile</small><b class="ges-num ${disp < 0 ? 'ges-giu' : ''}">${h(A.num(disp))}</b></div><div><small>Valore a costo</small><b>${h(A.euro(Math.max(0, tot) * a.costo))}</b></div></div>
      <div class="ges-t-barra"><div class="btns">
        <button class="btn pri" type="button" data-az="ges-mov-carico" data-a="${id}" data-m="${DEPOSITO}">${icona('carica')} Carico</button>
        <button class="btn" type="button" data-az="ges-mov-trasf" data-a="${id}" data-m="${DEPOSITO}">${icona('furgone')} Trasferimento</button>
        <button class="btn" type="button" data-az="ges-mov-conta" data-a="${id}" data-m="${DEPOSITO}">${icona('verifica')} Conta / rettifica</button></div></div>
    </div>`;
    const perMag = db.magazzini.map(m => { const g = gq(G, a.id, m.id); return `<tr><td class="ges-prima"><b>${h(m.tipo === 'sede' ? 'Deposito' : m.nome.split(' — ')[0])}</b><div class="t2">${h(m.tipo === 'sede' ? m.nome : (m.nome.split(' — ')[1] || '') + (m.tecnicoId ? ' · ' + nomeUtente(m.tecnicoId) : ''))}</div></td><td data-l="Giacenza" class="num"><b class="${g < 0 ? 'ges-giu' : ''}">${h(A.num(g))}</b> <span class="muto">${h(a.unita)}</span></td><td class="ges-az"><div class="ges-azr"><button class="btn pic" type="button" data-az="ges-mov-conta" data-a="${id}" data-m="${h(m.id)}">Conta</button></div></td></tr>`; }).join('');
    const tabMov = vis.map(m => {
      const i = m.interventoId ? A.intervento(m.interventoId) : null; const q = Number(m.qta) || 0;
      const contro = m.controparte ? (A.trova('magazzini', m.controparte) ? nomeMagBreve(m.controparte) : A.trova('fornitori', m.controparte) ? A.trova('fornitori', m.controparte).nome : A.cliente(m.controparte) ? A.cliente(m.controparte).nome : '') : '';
      return `<tr><td class="ges-prima ges-num">${h(A.dataOra(m.data))}</td><td data-l="Tipo">${pDa(TIPI_MOV, m.tipo)}</td><td data-l="Magazzino">${h(nomeMagBreve(m.magazzinoId))}</td>
        <td data-l="Quantità" class="num"><b class="${q > 0 ? 'ges-su' : q < 0 ? 'ges-giu' : ''}">${q > 0 ? '+' : ''}${h(A.num(q))}</b></td>
        <td data-l="Riferimento">${h(m.rif || '—')}${i ? ` · <a href="#/u/intervento/${h(i.id)}">N. ${h(i.numero)}</a>` : ''}${contro ? `<div class="t2">${h(contro)}</div>` : ''}${m.nota ? `<div class="t2">${h(m.nota)}</div>` : ''}</td>
        <td data-l="Chi">${h(A.nomeBreve(nomeUtente(m.utenteId)))}</td></tr>`;
    }).join('');
    const contenuto = `${testata}
      <div class="griglia g-2-1 ges-gr ges-scheda">
        <form class="tessera" data-form="ges-art-salva" novalidate><input type="hidden" name="id" value="${id}"><div class="tt"><h3>${icona('modifica')} Anagrafica e prezzi</h3></div><div class="cp">${campiArticolo(a)}${divErr}</div><div class="ges-dida" style="display:flex;justify-content:flex-end"><button class="btn pri" type="submit">${icona('spunta')} Salva</button></div></form>
        <div class="ges-col">
          <div class="tessera"><div class="tt"><h3>${icona('pacco')} Dove si trova</h3></div><div class="tab-w"><table class="tab ges-resp">${perMag}<tfoot><tr><td>Totale</td><td class="num">${h(A.num(tot))} ${h(a.unita)}</td><td></td></tr></tfoot></table></div></div>
          <div class="tessera"><div class="tt"><h3>${icona('documento')} Impegnata</h3></div><div class="cp">${prev.length ? prev.map(p => { const qq = p.righe.filter(r => r.articoloId === a.id && (!r.opzionale || r.scelta)).reduce((s, r) => s + (Number(r.qta) || 0), 0); return `<div class="ges-riga-i" style="margin-bottom:6px">${icona('documento', 'p')}<div><a href="#/u/preventivo/${h(p.id)}">N. ${h(p.numero)}</a> — ${h(nomeCli(p.clienteId))}<div class="t2">${h(A.num(qq))} ${h(a.unita)} promessi</div></div></div>`; }).join('') : '<p class="muto" style="font-size:14px">Nessun preventivo accettato usa questo articolo.</p>'}</div></div>
        </div>
      </div>
      <div class="tessera" style="margin-top:16px"><div class="tt"><h3>${icona('storico')} Movimenti <span class="ges-conta">${movs.length}</span></h3><span class="pic">dal più recente</span></div>
        ${movs.length ? `<div class="tab-w"><table class="tab ges-resp"><thead><tr><th>Quando</th><th>Tipo</th><th>Magazzino</th><th class="num">Quantità</th><th>Riferimento</th><th>Chi</th></tr></thead><tbody>${tabMov}</tbody></table></div>${movs.length > vis.length ? `<div class="ges-dida"><a href="#/u/articolo/${id}?tutti=1">Mostra tutti i ${movs.length} movimenti</a></div>` : ''}` : `<div class="cp">${A.vuoto('Nessun movimento', 'Il primo carico fa nascere la giacenza.', 'storico')}</div>`}
        <div class="ges-dida">${icona('lucchetto', 'p')} La giacenza è la somma di questi movimenti. Non si modificano e non si cancellano: un errore si corregge con una rettifica, così resta la traccia di chi ha fatto cosa.</div></div>`;
    return pagina({ attivo: 'magazzino', titolo: a.nome, briciole: [['Magazzino', '#/u/magazzino']], contenuto });
  }
  A.azione('ges-art-salva', (f, ev, d) => {
    const x = datiArticolo(d); const err = controllaArticolo(x, d.id); if (err) return erroreModale(err);
    x.attivo = !!d.attivo;
    A.modifica(db => { const a = db.articoli.find(y => y.id === d.id); const prima = a.prezzo; Object.assign(a, x); A.registra('articolo modificato', x.codice + ' — ' + x.nome + (prima !== x.prezzo ? ' (prezzo ' + A.euro(prima) + ' → ' + A.euro(x.prezzo) + ')' : '')); });
    A.toast('Articolo salvato', 'ok'); A.render();
  });

  rotta('#/u/magazzino', paginaMagazzino);
  rotta('#/u/articolo/:id', paginaArticolo);

  // ===========================================================================
  // 7. DA FATTURARE — documenti di vendita (pre-fatture) ed export per il
  //    commercialista. OPERA non emette fatture e non le numera.
  // ===========================================================================
  const FRASE_FISCALE = 'Il gestionale non emette fatture: prepara il documento di vendita e l\'export per chi le emette.';
  const daFatturare = () => A.DB.interventi.filter(i => i.stato === 'approvato' && i.tipo !== 'sopralluogo' && !i.documentoId);
  /** Aliquota proposta alle righe dal regime scelto. Il regime resta RIPORTATO: lo conferma il commercialista. */
  function aliquotaDi(regime) { regime = String(regime || ''); return /10%/.test(regime) ? 10 : /reverse|esente/i.test(regime) ? 0 : 22; }
  const nDoc = d => 'PRE-' + d.numero;
  /** Le righe del documento dal rapportino: stesse regole di dati.js e di A.valoreIntervento. */
  function righeDaIntervento(i, aliquota) {
    const t = A.DB.azienda.tariffe; const m = A.minutiIntervento(i); const v = A.valoreIntervento(i);
    const gratuito = i.modalita === 'garanzia' || i.modalita === 'contratto';
    const suff = gratuito ? (i.modalita === 'garanzia' ? ' (in garanzia)' : ' (compreso nel contratto)') : '';
    const testa = 'Intervento ' + i.numero + (i.data ? ' del ' + A.data(i.data) : '');
    const r = [];
    if (m.lavoro) r.push({ interventoId: i.id, descrizione: testa + ' — manodopera' + suff, qta: A.arrot(m.lavoro / 60), unita: 'h', prezzo: gratuito ? 0 : t.manodopera, iva: aliquota });
    if (m.straordinario) r.push({ interventoId: i.id, descrizione: testa + ' — manodopera straordinaria' + suff, qta: A.arrot(m.straordinario / 60), unita: 'h', prezzo: gratuito ? 0 : t.straordinario, iva: aliquota });
    if (!gratuito && v.uscita) r.push({ interventoId: i.id, descrizione: 'Diritto di uscita', qta: 1, unita: 'pz', prezzo: t.uscita, iva: aliquota });
    ((i.rapporto && i.rapporto.materiali) || []).forEach(x => {
      const a = x.articoloId ? A.articolo(x.articoloId) : null;
      const prezzo = x.prezzo !== undefined ? Number(x.prezzo) || 0 : a ? a.prezzo : 0;
      r.push({ interventoId: i.id, descrizione: a ? nomeArticolo(a) : x.nome, qta: Number(x.qta) || 0, unita: x.unita || (a ? a.unita : 'pz'), prezzo: gratuito ? 0 : prezzo, iva: aliquota });
    });
    if (!r.length) r.push({ interventoId: i.id, descrizione: testa + suff, qta: 1, unita: 'corpo', prezzo: 0, iva: aliquota });
    return r;
  }
  function numeriFatturazione() {
    const db = A.DB; const df = daFatturare();
    const imp = st => db.documenti.filter(d => d.stato === st).reduce((s, d) => s + A.totaliDocumento(d).imponibile, 0);
    return {
      df, valDF: df.reduce((s, i) => s + A.valoreIntervento(i).totale, 0), clientiDF: new Set(df.map(i => i.clienteId)).size, piuVecchio: df.map(i => i.data).filter(Boolean).sort()[0],
      pronti: db.documenti.filter(d => d.stato === 'pronto'), valPronti: imp('pronto'), bozze: db.documenti.filter(d => d.stato === 'bozza').length,
      esportati: db.documenti.filter(d => d.stato === 'esportato'), valEsportati: imp('esportato')
    };
  }
  let selDF = new Set();
  function paginaDocumenti(par) {
    segnaLettiQui();
    const q = par.q; const n = numeriFatturazione();
    const sc = q.scheda === 'documenti' ? 'documenti' : 'da-fatturare';
    // La selezione vale solo per gli interventi ancora da fatturare (altri moduli possono cambiarli).
    const idsDF = new Set(n.df.map(i => i.id)); selDF = new Set([...selDF].filter(x => idsDF.has(x)));
    const kpis = `<div class="ges-kpis">
      ${kpi({ cl: 'evid', ic: 'euro', l: 'Fatto e non fatturato', v: h(A.euro(n.valDF, true)), d: n.df.length ? `<b>${plurale(n.df.length, 'intervento approvato', 'interventi approvati')}</b> di ${plurale(n.clientiDF, 'cliente', 'clienti')}${n.piuVecchio ? ' · il più vecchio del ' + h(A.data(n.piuVecchio)) : ''}` : 'Tutto il lavoro approvato è in un documento di vendita', link: '#/u/documenti' })}
      ${kpi({ ic: 'invia', l: 'Pronto da esportare', v: h(A.euro(n.valPronti, true)), d: `<b>${plurale(n.pronti.length, 'documento', 'documenti')}</b>${n.bozze ? ' · ' + plurale(n.bozze, 'bozza', 'bozze') + ' da finire' : ''} · IVA esclusa`, link: '#/u/documenti?scheda=documenti&stato=pronto' })}
      ${kpi({ ic: 'orologio', l: 'Esportato, non ancora fatturato', v: h(A.euro(n.valEsportati, true)), d: n.esportati.length ? `<b>${plurale(n.esportati.length, 'documento', 'documenti')}</b> dal commercialista: segnali quando arriva il numero di fattura` : 'Nessuno in attesa del commercialista', link: '#/u/documenti?scheda=documenti&stato=esportato' })}
    </div>`;
    const schede = schedeHtml([['da-fatturare', 'Da fatturare', '#/u/documenti', n.df.length || ''], ['documenti', 'Documenti di vendita', '#/u/documenti?scheda=documenti', A.DB.documenti.length]], sc);
    const frase = `<div class="avviso ges-frase">${icona('info')}<div><b>${h(FRASE_FISCALE)}</b> Le fatture emesse dal software fiscale si caricano poi nei documenti del cliente, che le ritrova nella sua area.</div></div>`;
    const corpo = sc === 'documenti' ? schedaDocVendita(q) : schedaDaFatturare(n);
    return pagina({ attivo: 'documenti', titolo: 'Da fatturare', briciole: [['Conti', '#/u/documenti']], contenuto: kpis + frase + schede + corpo });
  }

  // ---- da fatturare: interventi approvati raggruppati per cliente
  function schedaDaFatturare(n) {
    if (!n.df.length) return vuotoTessera('Niente da fatturare', 'Quando approvi un rapportino, l\'intervento arriva qui con il suo valore: manodopera, uscita e materiali.', 'spunta', '<a class="btn" href="#/u/rapportini">Vai ai rapportini da approvare</a>');
    const gr = {};
    n.df.forEach(i => { (gr[i.clienteId] = gr[i.clienteId] || []).push(i); });
    const chiavi = Object.keys(gr).sort((a, b) => String(gr[a].map(i => i.data).sort()[0]).localeCompare(String(gr[b].map(i => i.data).sort()[0])));
    const sopralluoghi = A.DB.interventi.filter(i => i.stato === 'approvato' && i.tipo === 'sopralluogo' && !i.documentoId).length;
    const blocchi = chiavi.map(cid => {
      const c = A.cliente(cid) || { nome: 'Cliente' }; const lista = gr[cid].sort((a, b) => String(a.data).localeCompare(String(b.data)));
      const tot = lista.reduce((s, i) => s + A.valoreIntervento(i).totale, 0);
      const tutti = lista.every(i => selDF.has(i.id));
      const manc = datiFiscaliMancanti(c);
      return `<div class="tessera ges-df" data-cli="${h(cid)}">
        <div class="tt"><label class="ges-df-cli"><input type="checkbox" data-cambia="ges-df-cli" data-cli="${h(cid)}"${tutti ? ' checked' : ''} aria-label="Scegli tutti gli interventi di ${h(c.nome)}"><span><a href="#/u/cliente/${h(cid)}"><b>${h(c.nome)}</b></a> ${pTipoCliente(c.tipo)}${c.sconto ? ' <span class="ges-chip">sconto ' + h(A.num(c.sconto)) + '%</span>' : ''}${manc.length ? ' ' + A.pastiglia('mancano ' + manc.join(', '), 'warn') : ''}</span></label>
          <span class="ges-df-tot">${plurale(lista.length, 'intervento', 'interventi')} · <b>${h(A.euro(tot))}</b></span></div>
        <div class="tab-w"><table class="tab ges-resp"><thead><tr><th class="ges-cb"></th><th>Intervento</th><th class="num">Manodopera</th><th class="num">Uscita</th><th class="num">Materiali</th><th class="num">Totale</th></tr></thead><tbody>
        ${lista.map(i => {
          const v = A.valoreIntervento(i); const m = A.minutiIntervento(i);
          return `<tr class="ges-con-cb"><td class="ges-cb"><input type="checkbox" data-cambia="ges-df-sel" value="${h(i.id)}"${selDF.has(i.id) ? ' checked' : ''} aria-label="Scegli l'intervento N. ${h(i.numero)}"></td>
            <td class="ges-prima"><a href="#/u/intervento/${h(i.id)}"><b>N. ${h(i.numero)}</b></a> · ${h(A.data(i.data))}<div class="t2">${h(A.TIPI_INTERVENTO[i.tipo] || i.tipo)} · ${h(A.nomeTecnici(i.tecnici))} · ${h(taglia(i.richiesta, 60))}</div></td>
            <td data-l="Manodopera" class="num">${h(A.euro(v.manodopera))}<div class="t2">${h(A.oreDecimali(m.lavoro + m.straordinario))} h</div></td>
            <td data-l="Uscita" class="num">${v.uscita ? h(A.euro(v.uscita)) : '<span class="muto">—</span>'}</td>
            <td data-l="Materiali" class="num">${v.materiali ? h(A.euro(v.materiali)) : '<span class="muto">—</span>'}</td>
            <td data-l="Totale" class="num"><b>${h(A.euro(v.totale))}</b>${v.gratuito ? `<div style="margin-top:3px">${A.pastiglia(i.modalita === 'garanzia' ? 'in garanzia' : 'a contratto', 'warn')}</div>` : ''}</td></tr>`;
        }).join('')}</tbody></table></div></div>`;
    }).join('');
    return `<div class="ges-intesta"><p>Interventi approvati non ancora in un documento di vendita, dal cliente che aspetta da più tempo. In garanzia e a contratto valgono zero al cliente, ma entrano nel documento perché il commercialista li veda.${sopralluoghi ? ' I sopralluoghi (' + sopralluoghi + ') non si fatturano e restano fuori.' : ''}</p>
        <button class="btn pic" type="button" data-az="ges-df-tutti">${icona('spunta', 'p')} ${selDF.size === n.df.length ? 'Togli la selezione' : 'Seleziona tutto'}</button></div>
      <div class="ges-col">${blocchi}</div>
      <div class="ges-df-barra" id="ges-df-barra">${barraSelezione()}</div>`;
  }
  function barraSelezione() {
    const sel = daFatturare().filter(i => selDF.has(i.id));
    const tot = sel.reduce((s, i) => s + A.valoreIntervento(i).totale, 0); const cl = new Set(sel.map(i => i.clienteId)).size;
    return `<div class="cx1">${sel.length ? `<b>${plurale(sel.length, 'intervento scelto', 'interventi scelti')}</b> · ${h(A.euro(tot))} IVA esclusa · ${cl === 1 ? '1 documento' : cl + ' documenti, uno per cliente'}` : '<span class="muto">Scegli gli interventi da mettere nel documento di vendita.</span>'}</div>
      <button class="btn acc" type="button" data-az="ges-df-crea"${sel.length ? '' : ' disabled'}>${icona('documento')} Crea ${cl > 1 ? 'i documenti' : 'il documento'} di vendita</button>`;
  }
  function aggiornaSelezione() {
    const b = A.$('#ges-df-barra'); if (b) b.innerHTML = barraSelezione();
    A.$$('.ges-df').forEach(box => { const cbs = A.$$('input[data-cambia="ges-df-sel"]', box); const t = A.$('input[data-cambia="ges-df-cli"]', box); if (t) t.checked = cbs.length && cbs.every(x => x.checked); });
  }
  A.azione('ges-df-sel', el => { if (el.checked) selDF.add(el.value); else selDF.delete(el.value); aggiornaSelezione(); });
  A.azione('ges-df-cli', el => {
    const box = el.closest('.ges-df');
    A.$$('input[data-cambia="ges-df-sel"]', box).forEach(x => { x.checked = el.checked; if (el.checked) selDF.add(x.value); else selDF.delete(x.value); });
    aggiornaSelezione();
  });
  A.azione('ges-df-tutti', () => { const df = daFatturare(); if (selDF.size === df.length) selDF.clear(); else df.forEach(i => selDF.add(i.id)); A.render(); });
  A.azione('ges-df-crea', () => {
    const sel = daFatturare().filter(i => selDF.has(i.id)); if (!sel.length) return;
    const gr = {}; sel.forEach(i => { (gr[i.clienteId] = gr[i.clienteId] || []).push(i); });
    const riep = Object.keys(gr).map(cid => { const c = A.cliente(cid) || {}; const tot = gr[cid].reduce((s, i) => s + A.valoreIntervento(i).totale, 0); const manc = datiFiscaliMancanti(c); return `<li><span class="cx1"><b>${h(c.nome)}</b><span class="t2">${plurale(gr[cid].length, 'intervento', 'interventi')}${c.sconto ? ' · sconto ' + A.num(c.sconto) + '%' : ''}${manc.length ? ' · <span style="color:var(--warn)">mancano ' + h(manc.join(', ')) + '</span>' : ''}</span></span><b class="ges-num">${h(A.euro(tot))}</b></li>`; }).join('');
    const tuttiAz = Object.keys(gr).every(cid => (A.cliente(cid) || {}).tipo === 'azienda');
    A.modale({
      titolo: Object.keys(gr).length > 1 ? 'Crea ' + Object.keys(gr).length + ' documenti di vendita' : 'Crea il documento di vendita', form: 'ges-df-crea-ok',
      corpo: `<ul class="ges-riep-df">${riep}</ul>
        <div class="campo"><label for="ges-df-reg">Regime IVA</label><select id="ges-df-reg" name="regimeIva">${REGIMI_IVA.map(r => `<option${r === REGIMI_IVA[0] ? ' selected' : ''}>${h(r)}</option>`).join('')}</select><span class="aiuto">Il regime è riportato nel documento, non calcolato: lo conferma chi emette la fattura. ${tuttiAz ? '' : 'Per i privati nelle manutenzioni di casa spesso vale il 10%: da verificare.'}</span></div>
        <div class="campo"><label for="ges-df-note">Note <span class="muto">(facoltative, per il commercialista)</span></label><textarea id="ges-df-note" name="note" rows="2"></textarea></div>
        <p class="pic">${icona('info', 'p')} ${h(FRASE_FISCALE)}</p>`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: 'Crea', classe: 'acc', tipo: 'submit', icona: 'spunta' }]
    });
  });
  A.azione('ges-df-crea-ok', (f, ev, d) => {
    const sel = daFatturare().filter(i => selDF.has(i.id)); if (!sel.length) return A.chiudiModale();
    const regime = REGIMI_IVA.includes(d.regimeIva) ? d.regimeIva : REGIMI_IVA[0]; const al = aliquotaDi(regime);
    const gr = {}; sel.forEach(i => { (gr[i.clienteId] = gr[i.clienteId] || []).push(i); });
    const creati = [];
    A.modifica(db => {
      Object.keys(gr).forEach(cid => {
        const c = db.clienti.find(x => x.id === cid) || {};
        const lista = gr[cid].sort((a, b) => String(a.data).localeCompare(String(b.data)));
        const doc = { id: A.uid('doc'), numero: A.numera('PRE'), clienteId: cid, interventi: lista.map(i => i.id), stato: 'bozza', creato: A.adesso(), sconto: Number(c.sconto) || 0, regimeIva: regime, note: String(d.note || '').trim(), righe: [].concat(...lista.map(i => righeDaIntervento(i, al))), esportatoIl: null, fattura: null, creatoDa: A.utente().id };
        db.documenti.push(doc); creati.push(doc);
        lista.forEach(i0 => { const i = db.interventi.find(x => x.id === i0.id); i.documentoId = doc.id; passaA(i, 'valorizzato', 'Documento di vendita ' + nDoc(doc)); });
        A.registra('documento di vendita creato', nDoc(doc) + ' — ' + (c.nome || '') + ' (' + plurale(lista.length, 'intervento', 'interventi') + ')');
      });
    });
    selDF.clear(); A.chiudiModale();
    A.toast(creati.length === 1 ? 'Documento ' + nDoc(creati[0]) + ' creato (bozza)' : creati.length + ' documenti creati (bozza)', 'ok');
    A.vai(creati.length === 1 ? '#/u/documento/' + creati[0].id : '#/u/documenti?scheda=documenti&stato=bozza');
  });

  // ---- elenco dei documenti di vendita
  function schedaDocVendita(q) {
    const st = STATI_DOC[q.stato] ? q.stato : '';
    const parole = norm(q.q).split(/\s+/).filter(Boolean);
    const tutti = A.DB.documenti;
    const lista = tutti.filter(d => (!st || d.stato === st) && (!parole.length || parole.every(p => norm([nDoc(d), nomeCli(d.clienteId), d.fattura ? d.fattura.numero : ''].join(' ')).includes(p)))).sort((a, b) => String(b.creato).localeCompare(String(a.creato)));
    const base = '#/u/documenti?scheda=documenti';
    const pronti = tutti.filter(d => d.stato === 'pronto').length;
    const conta = k => tutti.filter(d => d.stato === k).length;
    const riga = d => {
      const t = A.totaliDocumento(d); const c = A.cliente(d.clienteId);
      return `<tr class="clic" data-az="ges-doc-apri" data-id="${h(d.id)}">
        <td class="ges-prima"><a class="ges-cod" href="#/u/documento/${h(d.id)}">${h(nDoc(d))}</a><div class="t2">${h(A.data(d.creato))}</div></td>
        <td data-l="Cliente" class="ges-nome"><b>${h(c ? c.nome : '—')}</b><div class="t2">${plurale((d.interventi || []).length, 'intervento', 'interventi')} · ${h(d.regimeIva || '')}</div></td>
        <td data-l="Imponibile" class="num">${h(A.euro(t.imponibile))}</td>
        <td data-l="Totale" class="num"><b>${h(A.euro(t.totale))}</b></td>
        <td data-l="Stato">${pDa(STATI_DOC, d.stato)}${d.stato === 'esportato' && d.esportatoIl ? `<div class="t2">il ${h(A.data(d.esportatoIl))}</div>` : ''}</td>
        <td data-l="Fattura">${d.fattura ? `<b>${h(d.fattura.numero)}</b><div class="t2">del ${h(A.data(d.fattura.data))}</div>` : '<span class="muto">—</span>'}</td>
      </tr>`;
    };
    return `<div class="ges-intesta">${segmenti([['', 'Tutti', base, tutti.length]].concat(Object.keys(STATI_DOC).map(k => [k, STATI_DOC[k][0], base + '&stato=' + k, conta(k)])), st)}
        <button class="btn pri" type="button" data-az="ges-doc-export-tutti"${pronti ? '' : ' disabled'}>${icona('scarica')} Esporta tutti i pronti${pronti ? ' (' + pronti + ')' : ''}</button></div>
      <div class="ges-filtri">${campoCerca('ges-doc-cerca', q.q, 'Cerca numero, cliente, numero di fattura…')}</div>
      ${lista.length ? `<div class="tessera"><div class="tab-w"><table class="tab ges-resp"><thead><tr><th>Documento</th><th>Cliente</th><th class="num">Imponibile</th><th class="num">Totale</th><th>Stato</th><th>Fattura</th></tr></thead><tbody>${lista.map(riga).join('')}</tbody></table></div>
        <div class="ges-dida">${icona('info', 'p')} Bozza → pronto → esportato per il commercialista → fatturato (con il numero della fattura emessa dal software fiscale). Un documento annullato rimette gli interventi fra quelli da fatturare.</div></div>`
        : vuotoTessera('Nessun documento', st ? 'Nessun documento in questo stato.' : 'Crea il primo dalla scheda «Da fatturare».', 'documento')}`;
  }
  A.azione('ges-doc-apri', el => A.vai('#/u/documento/' + el.dataset.id));

  // ---- export per il commercialista: un CSV che Excel apre senza chiedere niente
  const INTEST_CSV_DOC = ['Numero', 'Data', 'Cliente', 'P.IVA', 'C.F.', 'Codice SDI', 'PEC', 'Descrizione', 'Quantità', 'Prezzo', 'Sconto %', 'IVA %', 'Imponibile riga', 'Regime IVA'];
  function righeCsvDoc(d) {
    const c = A.cliente(d.clienteId) || {}; const sc = Number(d.sconto) || 0;
    return (d.righe || []).map(r => [nDoc(d), A.data(d.creato), c.nome || '', c.piva || '', c.cf || '', c.sdi || '', c.pec || '', r.descrizione, dec(r.qta), dec(r.prezzo), dec(sc), dec(r.iva), dec((Number(r.qta) || 0) * (Number(r.prezzo) || 0) * (1 - sc / 100)), d.regimeIva || '']);
  }
  function segnaEsportati(ids) {
    A.modifica(db => ids.forEach(id => { const d = db.documenti.find(x => x.id === id); if (d && d.stato === 'pronto') { d.stato = 'esportato'; d.esportatoIl = A.adesso(); } }));
  }
  A.azione('ges-doc-export', el => {
    const d = A.trova('documenti', el.dataset.id); if (!d) return;
    if (d.stato === 'bozza') return A.toast('Prima segna il documento come pronto', 'warn');
    A.scarica('export-commercialista-' + nDoc(d) + '.csv', A.csv([INTEST_CSV_DOC].concat(righeCsvDoc(d))), 'text/csv;charset=utf-8');
    const primo = d.stato === 'pronto';
    segnaEsportati([d.id]);
    A.modifica(() => A.registra('export per il commercialista', nDoc(d) + ' — ' + nomeCli(d.clienteId)));
    A.toast(primo ? 'Esportato: manda il file al commercialista' : 'File scaricato di nuovo', 'ok'); A.render();
  });
  A.azione('ges-doc-export-tutti', () => {
    const pronti = A.DB.documenti.filter(d => d.stato === 'pronto').sort((a, b) => String(a.numero).localeCompare(String(b.numero)));
    if (!pronti.length) return A.toast('Nessun documento pronto', 'warn');
    A.scarica('export-commercialista-' + A.oggi() + '.csv', A.csv([INTEST_CSV_DOC].concat(...pronti.map(righeCsvDoc))), 'text/csv;charset=utf-8');
    segnaEsportati(pronti.map(d => d.id));
    A.modifica(() => A.registra('export per il commercialista', plurale(pronti.length, 'documento', 'documenti') + ': ' + pronti.map(nDoc).join(', ')));
    A.toast(plurale(pronti.length, 'documento esportato', 'documenti esportati') + ' in un unico file', 'ok'); A.render();
  });

  // ---- il documento
  function htmlTotDoc(d) {
    const t = A.totaliDocumento(d);
    return `<div class="ges-tot-r"><span>Totale voci</span><span>${h(A.euro(t.lordo))}</span></div>
      ${d.sconto ? `<div class="ges-tot-r"><span>Sconto ${h(A.num(d.sconto))}%</span><span>− ${h(A.euro(t.sconto))}</span></div>` : ''}
      <div class="ges-tot-r"><span>Imponibile</span><b>${h(A.euro(t.imponibile))}</b></div>
      <div class="ges-tot-r ges-t2"><span>IVA (${h(d.regimeIva || '—')})</span><span>${h(A.euro(t.iva))}</span></div>
      <div class="ges-tot-r ges-tot-f"><span>Totale</span><b>${h(A.euro(t.totale))}</b></div>`;
  }
  function paginaDocumento(par) {
    const d = A.trova('documenti', par.id);
    if (!d) return nonTrovato('documenti', 'Documento non trovato', [['Da fatturare', '#/u/documenti']], 'Questo documento di vendita non c\'è.', ['Torna ai documenti', '#/u/documenti?scheda=documenti']);
    const c = A.cliente(d.clienteId) || { id: '', nome: 'Cliente' };
    const mod = d.stato === 'bozza' || d.stato === 'pronto'; const id = h(d.id);
    const manc = datiFiscaliMancanti(c);
    const az = [], sec = [];
    if (d.stato === 'bozza') az.push(`<button class="btn pri" type="button" data-az="ges-doc-pronto" data-id="${id}">${icona('spunta')} Segna pronto</button>`);
    if (d.stato === 'pronto') az.push(`<button class="btn acc" type="button" data-az="ges-doc-export" data-id="${id}">${icona('scarica')} Esporta per il commercialista</button>`);
    if (d.stato === 'esportato') { az.push(`<button class="btn ok" type="button" data-az="ges-doc-fatturato" data-id="${id}">${icona('verifica')} Segna fatturato altrove</button>`); sec.push(`<button class="btn pic" type="button" data-az="ges-doc-export" data-id="${id}">${icona('scarica', 'p')} Scarica di nuovo il CSV</button>`); }
    if (d.stato === 'fatturato') az.push(`<a class="btn pri" href="#/u/cliente/${h(c.id)}?scheda=documenti">${icona('carica')} Carica la fattura</a>`);
    az.push(`<a class="btn" href="#/u/documento/${id}/stampa">${icona('stampa')} Stampa</a>`);
    if (d.stato === 'pronto') sec.push(`<button class="btn pic" type="button" data-az="ges-doc-bozza" data-id="${id}">${icona('modifica', 'p')} Torna in bozza</button>`);
    if (['bozza', 'pronto', 'esportato'].includes(d.stato)) sec.push(`<button class="btn pic per" type="button" data-az="ges-doc-annulla" data-id="${id}">${icona('x', 'p')} Annulla</button>`);
    const testata = `<div class="tessera ges-testata">
      <div class="ges-t-su"><div class="ges-t-1"><span class="ges-t-num">${h(nDoc(d))}</span>${pDa(STATI_DOC, d.stato)}${d.fattura ? A.pastiglia('Fattura ' + d.fattura.numero, 'ok', true) : ''}</div>
        <h2><a href="#/u/cliente/${h(c.id)}" style="color:inherit">${h(c.nome)}</a></h2>
        <div class="ges-t-meta"><span>${icona('calendario', 'p')}del ${h(A.data(d.creato))}</span><span>${icona('chiave', 'p')}${plurale((d.interventi || []).length, 'intervento', 'interventi')}</span><span>${icona('euro', 'p')}${h(d.regimeIva || '—')}</span>${d.esportatoIl ? `<span>${icona('scarica', 'p')}esportato il ${h(A.data(d.esportatoIl))}</span>` : ''}</div></div>
      <div class="ges-t-barra"><div class="btns">${az.join('')}</div><div class="btns">${sec.join('')}</div></div>
    </div>`;
    const avvisi = [`<div class="avviso ges-frase">${icona('info')}<div><b>${h(FRASE_FISCALE)}</b></div></div>`];
    if (manc.length && d.stato !== 'fatturato' && d.stato !== 'annullato') avvisi.push(`<div class="avviso warn">${icona('attenzione')}<div><b>Dati del cliente incompleti: mancano ${h(manc.join(', '))}.</b> Il commercialista ne ha bisogno per la fattura. <a href="#/u/cliente/${h(c.id)}">Completa la scheda</a></div></div>`);
    if (d.fattura) avvisi.push(`<div class="avviso ok">${icona('verifica')}<div>Fatturato con la fattura <b>${h(d.fattura.numero)}</b> del ${h(A.data(d.fattura.data))}, emessa dal software fiscale.</div></div>`);
    if (d.stato === 'annullato') avvisi.push(`<div class="avviso">${icona('x')}<div>Documento annullato: i suoi interventi sono tornati fra quelli da fatturare.</div></div>`);
    if (!mod && ['esportato', 'fatturato'].includes(d.stato)) avvisi.push(`<div class="avviso">${icona('lucchetto')}<div>Il documento è già dal commercialista: le righe non si modificano più. Se c'è un errore, annullalo e rifallo.</div></div>`);

    // --- impostazioni e interventi
    const imp = mod ? `<div class="tessera" data-doc="${id}"><div class="tt"><h3>${icona('regolazioni')} Condizioni</h3><span class="pic" id="ges-salvato" role="status"></span></div><div class="cp">
        <div class="riga-campi"><div class="campo"><label for="ges-dc-sc">Sconto %</label><input id="ges-dc-sc" type="text" inputmode="decimal" value="${h(numCampo(d.sconto || 0, 2))}" data-digita="ges-doc-campo" data-k="sconto"><span class="aiuto">Dalla scheda del cliente: ${h(A.num(c.sconto || 0))}%.</span></div>
          <div class="campo"><label for="ges-dc-reg">Regime IVA</label><select id="ges-dc-reg" data-cambia="ges-doc-campo" data-k="regimeIva">${REGIMI_IVA.concat(REGIMI_IVA.includes(d.regimeIva) ? [] : [d.regimeIva]).map(r => `<option${r === d.regimeIva ? ' selected' : ''}>${h(r)}</option>`).join('')}</select><span class="aiuto">Riportato, non calcolato. Cambiandolo si aggiorna l'aliquota delle righe.</span></div></div>
        <div class="campo"><label for="ges-dc-note">Note per il commercialista</label><textarea id="ges-dc-note" rows="2" data-digita="ges-doc-campo" data-k="note">${h(d.note || '')}</textarea></div>
      </div></div>`
      : `<div class="tessera"><div class="tt"><h3>${icona('regolazioni')} Condizioni</h3></div><div class="cp"><dl class="dl"><dt>Sconto</dt><dd>${d.sconto ? h(A.num(d.sconto)) + '%' : 'nessuno'}</dd><dt>Regime IVA</dt><dd>${h(d.regimeIva || '—')}</dd>${d.note ? `<dt>Note</dt><dd>${h(d.note)}</dd>` : ''}</dl></div></div>`;
    const ints = `<div class="tessera"><div class="tt"><h3>${icona('chiave')} Interventi inclusi</h3></div><ul class="ges-linea">${(d.interventi || []).map(A.intervento).filter(Boolean).map(i => `<li><span class="ges-ic ${i.modalita === 'garanzia' || i.modalita === 'contratto' ? 'grigio' : 'ok'}">${icona('chiave', 'p')}</span><div class="cx1"><div class="t1"><a href="#/u/intervento/${h(i.id)}">N. ${h(i.numero)}</a> · ${h(A.data(i.data))}</div><div class="t2">${h(A.TIPI_INTERVENTO[i.tipo] || i.tipo)}${i.modalita && i.modalita !== 'misura' ? ' · ' + h(MODALITA[i.modalita]) : ''} · ${h(taglia(i.richiesta, 70))}</div></div><div class="ges-q">${A.statoIntervento(i.stato)}</div></li>`).join('') || '<li class="muto">Nessun intervento.</li>'}</ul></div>`;
    const tot = `<div class="tessera ges-riep"><div class="cp"><div class="pic">Totale documento</div><div class="ges-riep-v" id="ges-doc-grande">${h(A.euro(A.totaliDocumento(d).totale))}</div></div><div class="ges-totali" id="ges-doc-tot" style="border-top:1px solid var(--line-2)">${htmlTotDoc(d)}</div></div>`;

    // --- righe, raggruppate per intervento come nel foglio
    const perInt = {}; const ordine = [];
    (d.righe || []).forEach((r, k) => { const key = r.interventoId || '_'; if (!perInt[key]) { perInt[key] = []; ordine.push(key); } perInt[key].push([r, k]); });
    const rigaDoc = (r, k) => mod ? `<div class="ges-riga doc" data-k="${k}">
        <div class="ges-r-corpo"><div class="ges-r-l1"><input type="text" value="${h(r.descrizione || '')}" data-digita="ges-dr-campo" data-k="descrizione" aria-label="Descrizione"></div>
          <div class="ges-r-l2"><label>Q.tà <input class="w-q" type="text" inputmode="decimal" value="${h(numCampo(r.qta))}" data-digita="ges-dr-campo" data-k="qta"></label><label>Unità <input class="w-u" type="text" value="${h(r.unita || '')}" data-digita="ges-dr-campo" data-k="unita"></label><label>Prezzo € <input class="w-p" type="text" inputmode="decimal" value="${h(numCampo(r.prezzo, 2))}" data-digita="ges-dr-campo" data-k="prezzo"></label><label>IVA <select data-cambia="ges-dr-campo" data-k="iva">${ALIQUOTE.concat(ALIQUOTE.includes(Number(r.iva)) ? [] : [Number(r.iva)]).map(al => `<option value="${al}"${Number(r.iva) === al ? ' selected' : ''}>${al}%</option>`).join('')}</select></label></div></div>
        <div class="ges-r-imp">${h(A.euro((Number(r.qta) || 0) * (Number(r.prezzo) || 0)))}</div>
        <button class="ges-r-x" type="button" data-az="ges-dr-togli" aria-label="Togli la riga">${icona('cestino', 'p')}</button></div>`
      : `<div class="ges-riga ro"><div></div><div class="ges-r-corpo"><div class="ges-r-desc">${h(r.descrizione)}</div><div class="ges-t2">${h(A.num(r.qta))} ${h(r.unita || '')} × ${h(A.euro(r.prezzo))} · IVA ${h(r.iva)}%</div></div><div class="ges-r-imp">${h(A.euro((Number(r.qta) || 0) * (Number(r.prezzo) || 0)))}</div></div>`;
    const righe = ordine.map(key => { const i = key !== '_' ? A.intervento(key) : null; return `<div class="ges-doc-gr">${i ? `Intervento N. ${h(i.numero)} del ${h(A.data(i.data))} — ${h(A.TIPI_INTERVENTO[i.tipo] || i.tipo)}${i.modalita === 'garanzia' ? ' (in garanzia)' : i.modalita === 'contratto' ? ' (compreso nel contratto)' : ''}` : 'Altre voci'}</div>${perInt[key].map(([r, k]) => rigaDoc(r, k)).join('')}`; }).join('');
    const vociCard = `<div class="tessera" data-doc="${id}"><div class="tt"><h3>${icona('elenco')} Righe <span class="ges-conta">${(d.righe || []).length}</span></h3>${mod ? '<span class="pic">si salva da sola mentre scrivi</span>' : ''}</div>
      <div class="ges-righe">${righe || `<div class="cp">${A.vuoto('Nessuna riga', '', 'elenco')}</div>`}</div>
      ${mod ? `<div class="ges-agg"><button class="btn" type="button" data-az="ges-dr-agg">${icona('piu')} Aggiungi riga</button></div>` : ''}</div>`;
    const contenuto = `${testata}<div class="ges-col" style="margin-top:14px;gap:10px">${avvisi.join('')}</div>
      <div class="griglia g-2-1 ges-gr ges-scheda"><div class="ges-col">${imp}${ints}</div><div class="ges-col">${tot}</div></div>
      <div style="margin-top:16px">${vociCard}</div>`;
    return pagina({ attivo: 'documenti', titolo: 'Documento ' + nDoc(d), briciole: [['Da fatturare', '#/u/documenti?scheda=documenti']], contenuto });
  }
  function docModificabile(el) {
    const box = el.closest('[data-doc]'); const d = box ? A.trova('documenti', box.dataset.doc) : null;
    if (!d || !['bozza', 'pronto'].includes(d.stato)) { A.toast('Questo documento non si modifica più', 'warn'); A.render(); return null; }
    return d;
  }
  function aggiornaTotDoc(d) {
    d = A.trova('documenti', d.id);
    const t = A.$('#ges-doc-tot'); if (t) t.innerHTML = htmlTotDoc(d);
    const g = A.$('#ges-doc-grande'); if (g) g.textContent = A.euro(A.totaliDocumento(d).totale);
    (d.righe || []).forEach((r, k) => { const e = A.$('.ges-riga.doc[data-k="' + k + '"] .ges-r-imp'); if (e) e.textContent = A.euro((Number(r.qta) || 0) * (Number(r.prezzo) || 0)); });
    segnaSalvato();
  }
  A.azione('ges-doc-campo', el => {
    const d = docModificabile(el); if (!d) return;
    const k = el.dataset.k;
    A.modifica(db => {
      const x = db.documenti.find(y => y.id === d.id);
      if (k === 'sconto') x.sconto = Math.max(0, Math.min(100, numDa(el.value)));
      else if (k === 'regimeIva') { x.regimeIva = el.value; const al = aliquotaDi(el.value); x.righe.forEach(r => { r.iva = al; }); }
      else x[k] = el.value;
    });
    if (k === 'regimeIva') { A.toast('Regime cambiato: aliquota delle righe al ' + aliquotaDi(el.value) + '%', 'ok'); A.render(); } else aggiornaTotDoc(d);
  });
  A.azione('ges-dr-campo', el => {
    const d = docModificabile(el); if (!d) return;
    const idx = Number(el.closest('.ges-riga').dataset.k); const k = el.dataset.k;
    A.modifica(db => { const r = db.documenti.find(y => y.id === d.id).righe[idx]; if (!r) return; r[k] = k === 'qta' || k === 'prezzo' || k === 'iva' ? numDa(el.value) : el.value; });
    aggiornaTotDoc(d);
  });
  A.azione('ges-dr-togli', el => {
    const d = docModificabile(el); if (!d) return;
    const idx = Number(el.closest('.ges-riga').dataset.k);
    A.modifica(db => { db.documenti.find(y => y.id === d.id).righe.splice(idx, 1); });
    A.render();
  });
  A.azione('ges-dr-agg', el => {
    const d = docModificabile(el); if (!d) return;
    A.modifica(db => { db.documenti.find(y => y.id === d.id).righe.push({ interventoId: null, descrizione: '', qta: 1, unita: 'pz', prezzo: 0, iva: aliquotaDi(d.regimeIva) }); });
    A.render();
    setTimeout(() => { const e = A.$$('.ges-riga.doc input[data-k=descrizione]').pop(); if (e) e.focus(); }, 30);
  });
  A.azione('ges-doc-pronto', el => {
    const d = A.trova('documenti', el.dataset.id); if (!d || d.stato !== 'bozza') return;
    if (!(d.righe || []).length) return A.toast('Il documento non ha righe', 'per');
    if ((d.righe || []).some(r => !String(r.descrizione || '').trim())) return A.toast('C\'è una riga senza descrizione', 'per');
    const manc = datiFiscaliMancanti(A.cliente(d.clienteId) || {});
    A.modifica(db => { db.documenti.find(y => y.id === d.id).stato = 'pronto'; A.registra('documento di vendita pronto', nDoc(d) + ' — ' + nomeCli(d.clienteId)); });
    A.toast(manc.length ? 'Pronto — ma mancano ' + manc.join(', ') + ' del cliente: completali prima di esportare' : 'Pronto da esportare', manc.length ? 'warn' : 'ok', manc.length ? 5000 : 2800); A.render();
  });
  A.azione('ges-doc-bozza', el => {
    const d = A.trova('documenti', el.dataset.id); if (!d || d.stato !== 'pronto') return;
    A.modifica(db => { db.documenti.find(y => y.id === d.id).stato = 'bozza'; });
    A.render();
  });
  A.azione('ges-doc-fatturato', el => {
    const d = A.trova('documenti', el.dataset.id); if (!d) return;
    A.modale({
      titolo: 'Segna fatturato altrove', form: 'ges-doc-fatturato-ok',
      corpo: `<input type="hidden" name="id" value="${h(d.id)}"><p style="font-size:14px;margin-bottom:14px">Scrivi il numero e la data della fattura che il commercialista (o il software fiscale) ha emesso per <b>${h(nDoc(d))}</b>. Gli interventi passano a «fatturato».</p>
        <div class="riga-campi"><div class="campo"><label for="ges-fa-n">Numero della fattura</label><input id="ges-fa-n" name="numero" type="text" placeholder="FT 231/${new Date().getFullYear()}" required></div><div class="campo"><label for="ges-fa-d">Data</label><input id="ges-fa-d" name="data" type="date" value="${h(A.oggi())}"></div></div>${divErr}`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: 'Segna fatturato', classe: 'ok', tipo: 'submit', icona: 'spunta' }]
    });
  });
  A.azione('ges-doc-fatturato-ok', (f, ev, dd) => {
    const numero = String(dd.numero || '').trim(); if (!numero) return erroreModale('Scrivi il numero della fattura.');
    const data = /^\d{4}-\d{2}-\d{2}$/.test(dd.data || '') ? dd.data : A.oggi();
    const d = A.trova('documenti', dd.id); if (!d) return;
    A.modifica(db => {
      const x = db.documenti.find(y => y.id === d.id); x.stato = 'fatturato'; x.fattura = { numero, data };
      (x.interventi || []).forEach(iid => { const i = db.interventi.find(y => y.id === iid); if (i && i.stato !== 'fatturato') passaA(i, 'fatturato', 'Fattura ' + numero); });
      A.registra('documento fatturato altrove', nDoc(x) + ' → fattura ' + numero + ' del ' + A.data(data));
    });
    A.chiudiModale(); A.toast('Segnato fatturato con la fattura ' + numero, 'ok'); A.render();
  });
  A.azione('ges-doc-annulla', async el => {
    const d = A.trova('documenti', el.dataset.id); if (!d || !['bozza', 'pronto', 'esportato'].includes(d.stato)) return;
    if (!await A.conferma((d.stato === 'esportato' ? '<b>Il file è già stato mandato al commercialista:</b> avvisalo che questo documento non vale più. ' : '') + 'Gli interventi di ' + h(nDoc(d)) + ' tornano fra quelli da fatturare.', { ok: 'Annulla il documento', pericolo: true, titolo: 'Annullare il documento?' })) return;
    A.modifica(db => {
      const x = db.documenti.find(y => y.id === d.id); x.stato = 'annullato'; x.annullatoIl = A.adesso();
      (x.interventi || []).forEach(iid => { const i = db.interventi.find(y => y.id === iid); if (i && i.documentoId === x.id) { i.documentoId = null; passaA(i, 'approvato', 'Documento ' + nDoc(x) + ' annullato'); } });
      A.registra('documento di vendita annullato', nDoc(x) + ' — ' + nomeCli(x.clienteId));
    });
    A.toast('Documento annullato: interventi di nuovo da fatturare', 'ok'); A.render();
  });
  function paginaStampaDocumento(par) {
    const d = A.trova('documenti', par.id);
    if (!d) { location.replace('#/u/documenti'); return false; }
    return pagina({ attivo: 'documenti', titolo: 'Documento ' + nDoc(d), briciole: [['Da fatturare', '#/u/documenti?scheda=documenti'], [nDoc(d), '#/u/documento/' + d.id]], contenuto: `<div class="ges-stampa">${A.paginaStampa(A.foglioDocumento(d), '#/u/documento/' + d.id)}</div>` });
  }

  rotta('#/u/documenti', paginaDocumenti);
  rotta('#/u/documento/:id', paginaDocumento);
  rotta('#/u/documento/:id/stampa', paginaStampaDocumento);

  // ===========================================================================
  // 8. MANUTENZIONI — le macchine da controllare e i contratti
  // ===========================================================================
  const RINNOVI = ['tacito', 'da rinegoziare', 'disdetto'];
  function contrattoPer(m) {
    const oggi = A.oggi();
    return A.DB.contratti.find(k => k.clienteId === m.clienteId && (!k.impiantoId || k.impiantoId === m.id) && (!k.scadenza || dataIso(k.scadenza) >= oggi)) || null;
  }
  function paginaManutenzioni(par) {
    segnaLettiQui();
    const q = par.q; const db = A.DB; const oggi = A.oggi();
    const entro = ['scadute', '30', '60'].includes(q.entro) ? q.entro : '60';
    const lim = entro === 'scadute' ? A.piuGiorni(oggi, -1) : A.piuGiorni(oggi, Number(entro));
    const tutte60 = db.impianti.filter(m => m.prossimaManutenzione && dataIso(m.prossimaManutenzione) <= A.piuGiorni(oggi, 60));
    const lista = tutte60.filter(m => dataIso(m.prossimaManutenzione) <= lim).sort((a, b) => String(a.prossimaManutenzione).localeCompare(String(b.prossimaManutenzione)));
    const scadute = tutte60.filter(m => dataIso(m.prossimaManutenzione) < oggi).length;
    const entro30 = tutte60.filter(m => dataIso(m.prossimaManutenzione) <= A.piuGiorni(oggi, 30)).length;
    const conInt = tutte60.filter(m => interventoApertoPer(m.id, 'manutenzione')).length;
    const base = '#/u/manutenzioni';
    const riga = m => {
      const c = A.cliente(m.clienteId) || {}; const s = A.sede(m.sedeId); const k = contrattoPer(m); const ap = interventoApertoPer(m.id, 'manutenzione');
      return `<tr class="ges-con-cb">
        <td class="ges-cb"><input type="checkbox" name="man" value="${h(m.id)}" data-ap="${ap ? '1' : ''}" aria-label="Scegli ${h(nomeMacchina(m))}"></td>
        <td class="ges-nome ges-prima"><b>${h(nomeMacchina(m))}</b> <span class="ges-chip">${h(cap(m.categoria || 'macchina'))}</span><div class="t2">${m.matricola ? '<span class="ges-cod">' + h(m.matricola) + '</span> · ' : ''}ogni ${h(m.intervalloMesi || '—')} mesi</div></td>
        <td data-l="Cliente"><a href="#/u/cliente/${h(m.clienteId)}?scheda=macchine"><b>${h(c.nome || '—')}</b></a><div class="t2">${h(s ? A.indirizzo(s) : '')}</div></td>
        <td data-l="Ultima" class="num">${m.ultimaManutenzione ? h(A.data(m.ultimaManutenzione)) : '<span class="muto">—</span>'}</td>
        <td data-l="Prossima">${pillScadenza(m.prossimaManutenzione, 60)}</td>
        <td data-l="Contratto">${k ? A.pastiglia('sì', 'ok') + `<div class="t2">${h(taglia(k.nome, 40))}</div>` : '<span class="muto">no</span>'}</td>
        <td data-l="Intervento">${ap ? `<a class="ges-chip" href="#/u/intervento/${h(ap.id)}">${icona('chiave', 'p')}N. ${h(ap.numero)}</a><div class="t2">già aperto · ${ap.data ? h(A.dataBreve(ap.data)) : 'da pianificare'}</div>` : '<span class="muto">—</span>'}${m.avvisatoIl ? `<div class="t2">${icona('posta', 'p')} avvisato ${h(A.quando(m.avvisatoIl))}</div>` : ''}</td>
      </tr>`;
    };
    const contratti = db.contratti.slice().sort((a, b) => String(a.scadenza || '9').localeCompare(String(b.scadenza || '9')));
    const canoni = contratti.filter(k => !k.scadenza || dataIso(k.scadenza) >= oggi).reduce((s, k) => s + (Number(k.canoneAnnuo) || 0), 0);
    const rigaK = k => {
      const c = A.cliente(k.clienteId) || {}; const m = k.impiantoId ? A.impianto(k.impiantoId) : null;
      const g = k.scadenza ? A.diffGiorni(oggi, dataIso(k.scadenza)) : null;
      const pill = g === null ? '' : g < 0 ? A.pastiglia('scaduto', 'dang') : g <= 30 ? A.pastiglia('scade tra ' + g + ' gg', 'warn') : '';
      return `<tr><td class="ges-nome ges-prima"><b>${h(k.nome)}</b><div class="t2"><a href="#/u/cliente/${h(k.clienteId)}">${h(c.nome || '—')}</a>${m ? ' · ' + h(nomeMacchina(m)) : ' · tutte le macchine'}</div>${k.note ? `<div class="t2">${h(taglia(k.note, 90))}</div>` : ''}</td>
        <td data-l="Visite" class="num">${h(k.visiteAnno || 0)} / anno</td>
        <td data-l="Canone" class="num"><b>${h(A.euro(k.canoneAnnuo))}</b></td>
        <td data-l="Periodo" class="num">${h(A.data(k.inizio))} → ${h(A.data(k.scadenza))}${pill ? '<div style="margin-top:3px">' + pill + '</div>' : ''}</td>
        <td data-l="Rinnovo">${h(cap(k.rinnovo || '—'))}</td>
        <td class="ges-az"><div class="ges-azr"><button class="btn pic" type="button" data-az="ges-ctr-mod" data-id="${h(k.id)}">${icona('modifica', 'p')} Modifica</button></div></td></tr>`;
    };
    const contenuto = `<div class="ges-kpis">
        ${kpi({ cl: scadute ? 'evid' : '', ic: 'attenzione', l: 'Già scadute', v: String(scadute), d: scadute ? 'Da fare subito: il libretto va aggiornato' : 'Nessuna in ritardo', link: base + '?entro=scadute' })}
        ${kpi({ ic: 'calendario', l: 'Entro 30 giorni', v: String(entro30), d: 'comprese le scadute', link: base + '?entro=30' })}
        ${kpi({ ic: 'storico', l: 'Entro 60 giorni', v: String(tutte60.length), d: `<b>${conInt}</b> con l'intervento già aperto`, link: base })}
        ${kpi({ ic: 'euro', l: 'Canoni dei contratti attivi', v: h(A.euro(canoni, true)), d: plurale(contratti.length, 'contratto', 'contratti') + ' · l\'anno', link: base + '?vista=contratti' })}
      </div>
      <div class="ges-intesta">${segmenti([['scadute', 'Scadute', base + '?entro=scadute', scadute], ['30', 'Entro 30 giorni', base + '?entro=30', entro30], ['60', 'Entro 60 giorni', base, tutte60.length]], entro)}
        <div class="btns"><button class="btn pic" type="button" data-az="ges-man-tutte">${icona('spunta', 'p')} Seleziona tutte</button><button class="btn" type="button" data-az="ges-man-avvisa">${icona('posta')} Avvisa i clienti</button><button class="btn acc" type="button" data-az="ges-man-genera">${icona('calendario')} Genera gli interventi</button></div></div>
      ${lista.length ? `<div class="tessera"><div class="tab-w"><table class="tab ges-resp"><thead><tr><th class="ges-cb"></th><th>Macchina</th><th>Cliente e luogo</th><th class="num">Ultima</th><th>Prossima</th><th>Contratto</th><th>Intervento</th></tr></thead><tbody>${lista.map(riga).join('')}</tbody></table></div>
        <div class="ges-dida">${icona('info', 'p')} «Genera gli interventi» li mette fra quelli da pianificare (manutenzione ricorrente, a contratto se c'è un contratto), senza doppioni. «Avvisa i clienti» manda un avviso nell'area clienti e un'email: è ora del controllo.</div></div>`
        : vuotoTessera('Nessuna manutenzione in scadenza', 'Le macchine con la data della prossima manutenzione compaiono qui 60 giorni prima.', 'spunta')}
      <div class="ges-intesta" id="ges-contratti" style="margin-top:28px"><h2>${icona('verifica')} Contratti di manutenzione</h2><button class="btn pri" type="button" data-az="ges-ctr-mod">${icona('piu')} Nuovo contratto</button></div>
      ${contratti.length ? `<div class="tessera"><div class="tab-w"><table class="tab ges-resp"><thead><tr><th>Contratto</th><th class="num">Visite</th><th class="num">Canone annuo</th><th class="num">Periodo</th><th>Rinnovo</th><th></th></tr></thead><tbody>${contratti.map(rigaK).join('')}</tbody></table></div>
        <div class="ges-dida">${icona('info', 'p')} Le manutenzioni delle macchine sotto contratto nascono «a contratto»: al cliente valgono zero, il canone si fattura a parte.</div></div>`
        : vuotoTessera('Nessun contratto', 'Registra i contratti annuali: le manutenzioni collegate nascono già «a contratto».', 'verifica')}`;
    return { html: pagina({ attivo: 'manutenzioni', titolo: 'Manutenzioni', briciole: [['Conti', '#/u/documenti']], contenuto }), dopo: () => { if (q.vista === 'contratti') { const e = A.$('#ges-contratti'); if (e) e.scrollIntoView(); } } };
  }
  const macchineScelte = () => A.$$('input[name=man]:checked').map(x => A.impianto(x.value)).filter(Boolean);
  A.azione('ges-man-tutte', () => { const cb = A.$$('input[name=man]'); const tutte = cb.every(x => x.checked); cb.forEach(x => { x.checked = !tutte; }); });
  A.azione('ges-man-genera', () => {
    const scelte = macchineScelte(); if (!scelte.length) return A.toast('Scegli le macchine con la casella a sinistra', 'warn');
    const u = A.utente(); const nuovi = []; let saltate = 0;
    A.modifica(db => {
      scelte.forEach(m => {
        // Niente doppioni: se c'e' gia' una manutenzione aperta per quella macchina, si salta.
        if (db.interventi.some(i => i.impiantoId === m.id && i.tipo === 'manutenzione' && APERTI.includes(i.stato))) { saltate++; return; }
        const k = contrattoPer(m); const scad = dataIso(m.prossimaManutenzione) < A.oggi();
        const i = { id: A.uid('int'), numero: A.numera('INT'), clienteId: m.clienteId, sedeId: m.sedeId, impiantoId: m.id, tipo: 'manutenzione', priorita: scad ? 'alta' : 'normale', stato: 'da_pianificare', data: null, ora: '', durataMin: 90, tecnici: [],
          richiesta: 'Manutenzione periodica — ' + nomeMacchina(m) + (m.matricola ? ' (matricola ' + m.matricola + ')' : '') + ': scadenza del ' + A.data(m.prossimaManutenzione) + '.', noteInterne: k ? 'A contratto: ' + k.nome : '', noteCliente: '',
          origine: 'ricorrente', preventivoId: null, modalita: k ? 'contratto' : 'misura', rapporto: null, storico: [{ stato: 'creato', data: A.adesso(), utenteId: u.id }], documentoId: null, creato: A.adesso() };
        db.interventi.push(i); nuovi.push(i);
      });
      if (nuovi.length) A.registra('manutenzioni generate', plurale(nuovi.length, 'intervento', 'interventi') + ' da pianificare: ' + nuovi.map(i => i.numero).join(', '));
    });
    A.toast(nuovi.length ? plurale(nuovi.length, 'intervento creato', 'interventi creati') + ' fra quelli da pianificare' + (saltate ? ' (' + saltate + ' già aperti, saltati)' : '') : 'Tutte le macchine scelte hanno già un intervento aperto', nuovi.length ? 'ok' : 'warn', 4500);
    A.render();
  });
  A.azione('ges-man-avvisa', () => {
    const scelte = macchineScelte(); if (!scelte.length) return A.toast('Scegli le macchine con la casella a sinistra', 'warn');
    const gr = {}; scelte.forEach(m => { (gr[m.clienteId] = gr[m.clienteId] || []).push(m); });
    let avvisati = 0; const senza = [];
    A.modifica(db => {
      Object.keys(gr).forEach(cid => {
        if (!emailCliente(cid) && !areaAttiva(cid)) { senza.push(nomeCli(cid)); return; }
        const mm = gr[cid]; const nomi = mm.map(m => nomeMacchina(m) + (m.prossimaManutenzione ? ' (scadenza ' + A.data(m.prossimaManutenzione) + ')' : '')).join(', ');
        avvisaCliente(db, cid, 'È ora del controllo: ' + mm.map(nomeMacchina).join(', '), '#/c/impianti', 'messaggio', 'IDRAL — è ora del controllo ' + (mm.length === 1 ? 'della sua ' + (mm[0].categoria || 'macchina') : 'delle sue macchine'),
          'Gentile cliente,\nè ora della manutenzione periodica: ' + nomi + '.\nIl controllo tiene in regola il libretto di impianto e fa durare di più la macchina. Ci chiami o ci scriva dall\'area clienti per fissare il giorno che le va meglio.', true);
        mm.forEach(m => { const x = db.impianti.find(y => y.id === m.id); if (x) x.avvisatoIl = A.adesso(); });
        avvisati++;
      });
      if (avvisati) A.registra('clienti avvisati per la manutenzione', plurale(avvisati, 'cliente', 'clienti'));
    });
    A.toast(avvisati ? plurale(avvisati, 'cliente avvisato', 'clienti avvisati') + ' (area clienti ed email)' + (senza.length ? ' — senza recapiti: ' + senza.join(', ') : '') : 'Nessuno avvisato: mancano email e area clienti', avvisati ? 'ok' : 'warn', 5000);
    A.render();
  });

  // ---- contratti di manutenzione
  function opzMacchineCliente(cid, sel) { return '<option value="">— tutte le macchine del cliente —</option>' + (cid ? A.impiantiDi(cid) : []).map(m => `<option value="${h(m.id)}"${sel === m.id ? ' selected' : ''}>${h(nomeMacchina(m))}${m.matricola ? ' · ' + h(m.matricola) : ''}</option>`).join(''); }
  A.azione('ges-ctr-mod', el => {
    const k = el.dataset.id ? A.trova('contratti', el.dataset.id) : null;
    const x = k || { visiteAnno: 1, canoneAnnuo: 0, inizio: A.oggi(), scadenza: piuMesi(A.oggi(), 12), rinnovo: 'tacito' };
    const clienti = A.DB.clienti.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
    A.modale({
      titolo: k ? 'Modifica contratto' : 'Nuovo contratto di manutenzione', form: 'ges-ctr-salva', largo: true,
      corpo: `<input type="hidden" name="id" value="${h(k ? k.id : '')}">
        <div class="ges-form-g">
          <div class="campo"><label for="ges-k-c">Cliente</label><select id="ges-k-c" name="clienteId" data-cambia="ges-ctr-cli"><option value="">— scegli —</option>${clienti.map(c => `<option value="${h(c.id)}"${x.clienteId === c.id ? ' selected' : ''}>${h(c.nome)}</option>`).join('')}</select></div>
          <div class="campo"><label for="ges-k-m">Macchina</label><select id="ges-k-m" name="impiantoId">${opzMacchineCliente(x.clienteId, x.impiantoId)}</select></div>
          <div class="campo tutta"><label for="ges-k-n">Nome del contratto</label><input id="ges-k-n" name="nome" type="text" value="${h(x.nome || '')}" placeholder="Manutenzione annuale caldaia"></div>
          <div class="campo"><label for="ges-k-v">Visite l'anno</label><input id="ges-k-v" name="visiteAnno" type="number" min="0" max="24" value="${h(x.visiteAnno)}"></div>
          <div class="campo"><label for="ges-k-ca">Canone annuo € <span class="muto">(IVA esclusa)</span></label><input id="ges-k-ca" name="canoneAnnuo" type="text" inputmode="decimal" value="${h(numCampo(x.canoneAnnuo, 2))}"></div>
          <div class="campo"><label for="ges-k-i">Inizio</label><input id="ges-k-i" name="inizio" type="date" value="${h(dataIso(x.inizio))}"></div>
          <div class="campo"><label for="ges-k-s">Scadenza</label><input id="ges-k-s" name="scadenza" type="date" value="${h(dataIso(x.scadenza))}"></div>
          <div class="campo"><label for="ges-k-r">Rinnovo</label><select id="ges-k-r" name="rinnovo">${RINNOVI.concat(RINNOVI.includes(x.rinnovo) ? [] : [x.rinnovo]).map(r => `<option${r === x.rinnovo ? ' selected' : ''}>${h(r)}</option>`).join('')}</select></div>
          <div class="campo tutta"><label for="ges-k-no">Cosa comprende</label><textarea id="ges-k-no" name="note" rows="2" placeholder="Controllo fumi annuale, tempo di risposta 4 ore…">${h(x.note || '')}</textarea></div>
        </div>${divErr}`,
      azioni: (k ? [{ testo: 'Elimina', classe: 'per', az: 'ges-ctr-elimina', attr: ` data-id="${h(k.id)}"` }] : []).concat([{ testo: 'Annulla', chiudi: true }, { testo: k ? 'Salva' : 'Aggiungi', classe: 'pri', tipo: 'submit', icona: 'spunta' }])
    });
  });
  A.azione('ges-ctr-cli', el => { const s = A.$('#ges-k-m'); if (s) s.innerHTML = opzMacchineCliente(el.value); });
  A.azione('ges-ctr-salva', (f, ev, d) => {
    if (!A.cliente(d.clienteId)) return erroreModale('Scegli il cliente.');
    const nome = String(d.nome || '').trim(); if (!nome) return erroreModale('Dai un nome al contratto.');
    if (d.inizio && d.scadenza && d.scadenza < d.inizio) return erroreModale('La scadenza è prima dell\'inizio.');
    const x = { clienteId: d.clienteId, impiantoId: d.impiantoId || null, nome, visiteAnno: Math.max(0, Math.round(numDa(d.visiteAnno))), canoneAnnuo: Math.max(0, numDa(d.canoneAnnuo)), inizio: d.inizio || A.oggi(), scadenza: d.scadenza || '', rinnovo: d.rinnovo || 'tacito', note: String(d.note || '').trim() };
    A.modifica(db => {
      if (d.id) Object.assign(db.contratti.find(y => y.id === d.id), x); else db.contratti.push(Object.assign({ id: A.uid('ctr') }, x));
      A.registra(d.id ? 'contratto modificato' : 'contratto aggiunto', nomeCli(x.clienteId) + ' — ' + nome + ' (' + A.euro(x.canoneAnnuo) + '/anno)');
    });
    A.chiudiModale(); A.toast('Contratto salvato', 'ok'); A.render();
  });
  A.azione('ges-ctr-elimina', async el => {
    const k = A.trova('contratti', el.dataset.id); if (!k) return;
    if (!await A.conferma('Eliminare il contratto «' + h(k.nome) + '» di ' + h(nomeCli(k.clienteId)) + '? Gli interventi già fatti restano.', { ok: 'Elimina', pericolo: true })) return;
    A.modifica(db => { db.contratti = db.contratti.filter(x => x.id !== k.id); A.registra('contratto eliminato', nomeCli(k.clienteId) + ' — ' + k.nome); });
    A.toast('Contratto eliminato', 'ok'); A.render();
  });

  rotta('#/u/manutenzioni', paginaManutenzioni);

  // ===========================================================================
  // 9. STATISTICHE — grafici SVG in linea, senza librerie.
  //    Regola di prodotto: NESSUNA classifica fra tecnici. Si confrontano i
  //    tipi di lavoro, i clienti, i mesi; mai le persone.
  //    Metodo (skill dataviz): colonne sottili (<= 24px) con la cima arrotondata,
  //    2px di stacco fra i segmenti, griglia a filo, etichette solo dove serve,
  //    tooltip al passaggio e alla tastiera, tabella dei numeri sotto ogni grafico.
  //    Palette categoriale validata (validate_palette.js, sfondo bianco): blu
  //    del marchio, arancio, acqua, giallo, magenta, viola — nello stesso ordine.
  // ===========================================================================
  const SERIE_TIPO = { riparazione: 'var(--ges-s1)', manutenzione: 'var(--ges-s2)', installazione: 'var(--ges-s3)', sopralluogo: 'var(--ges-s4)', emergenza: 'var(--ges-s5)', collaudo: 'var(--ges-s6)' };
  const PERIODI = { '30': ['30 giorni', 30], '90': ['90 giorni', 90], anno: ['Anno', 365] };
  function passoBello(v) { if (!(v > 0)) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
  /** Colonna con la cima arrotondata e la base dritta sulla linea dello zero. */
  function pathColonna(x, y, w, hh, r) { r = Math.min(r, hh, w / 2); return `M${x},${y + hh}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + hh}Z`; }
  function pathBarra(x, y, w, hh, r) { r = Math.min(r, w, hh / 2); return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + hh - r}Q${x + w},${y + hh} ${x + w - r},${y + hh}H${x}Z`; }
  const euroK = v => v >= 1000 ? A.num(v / 1000, v >= 10000 ? 0 : 1) + 'k €' : A.num(v, 0) + ' €';
  const esc = s => h(s);
  const accorcia = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, Math.max(1, n - 1)).trimEnd() + '…' : s; };

  // ---- tooltip: un solo riquadro per grafico, testi con textContent (sono dati)
  function agganciaTooltip(box, dati) {
    // I dati cambiano a ogni ridisegno (resize): gli ascoltatori si agganciano una volta sola.
    box._gesDati = dati;
    if (box._gesTip) return;
    box._gesTip = true;
    const tip = document.createElement('div'); tip.className = 'ges-tip'; tip.setAttribute('role', 'status'); box.appendChild(tip);
    const mostra = el => {
      const d = (box._gesDati || [])[Number(el.dataset.i)]; if (!d) return;
      tip.textContent = '';
      const t = document.createElement('div'); t.className = 'ges-tip-t'; t.textContent = d.titolo; tip.appendChild(t);
      d.righe.forEach(r => {
        const riga = document.createElement('div'); riga.className = 'ges-tip-r';
        const k = document.createElement('i'); k.style.background = r.colore || 'var(--ges-s1)';
        const b = document.createElement('b'); b.textContent = r.valore;
        const sp = document.createElement('span'); sp.textContent = r.nome;
        riga.append(k, b, sp); tip.appendChild(riga);
      });
      tip.style.display = 'block';
      const bw = box.clientWidth, tw = tip.offsetWidth, th = tip.offsetHeight;
      tip.style.left = Math.max(0, Math.min(bw - tw, d.x - tw / 2)) + 'px';
      tip.style.top = Math.max(0, d.y - th - 10) + 'px';
      box.classList.add('ges-hov'); box.querySelectorAll('[data-g]').forEach(x => x.classList.toggle('ges-su', x.dataset.g === el.dataset.i));
    };
    const nascondi = () => { tip.style.display = 'none'; box.classList.remove('ges-hov'); };
    box.addEventListener('pointermove', e => { const el = e.target.closest && e.target.closest('.ges-hit'); if (el) mostra(el); else nascondi(); });
    box.addEventListener('pointerleave', nascondi);
    box.addEventListener('focusin', e => { if (e.target.classList && e.target.classList.contains('ges-hit')) mostra(e.target); });
    box.addEventListener('focusout', nascondi);
  }

  /** Sostituisce il grafico lasciando al suo posto il riquadro del tooltip. */
  function scriviSvg(box, svg) { const vecchio = box.querySelector('svg'); if (vecchio) vecchio.remove(); box.insertAdjacentHTML('afterbegin', svg); }
  /** Colonne (anche impilate). cfg: {titolo, etichette, titoli, serie:[{nome, colore, valori}], formato, asse, corrente, altezza} */
  function disegnaColonne(box, cfg) {
    if (!box) return;
    const W = Math.max(260, box.clientWidth), H = cfg.altezza || 230;
    const m = { l: 46, r: 8, t: 22, b: 26 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    const n = cfg.etichette.length;
    const tot = cfg.etichette.map((_, i) => cfg.serie.reduce((s, x) => s + (Number(x.valori[i]) || 0), 0));
    const max = Math.max(...tot, 0);
    const passo = passoBello((max || 1) / 4), cima = Math.max(passo, Math.ceil((max || 1) / passo) * passo);
    const Y = v => m.t + ph - v / cima * ph;
    const band = pw / n, bw = Math.min(24, band * 0.6);
    let g = '', hit = '', col = '', lab = '';
    for (let v = 0; v <= cima + 1e-9; v += passo) g += `<line class="ges-gl" x1="${m.l}" x2="${W - m.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="ges-ax" x="${m.l - 8}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${esc(cfg.asse(v))}</text>`;
    const ogni = Math.max(1, Math.ceil(n * 46 / pw));
    const dati = [];
    const iMax = tot.indexOf(max);
    cfg.etichette.forEach((et, i) => {
      const x0 = m.l + band * i, cx = x0 + band / 2;
      hit += `<rect class="ges-hit" x="${x0.toFixed(1)}" y="${m.t}" width="${band.toFixed(1)}" height="${ph}" data-i="${i}" tabindex="0" aria-label="${esc(cfg.titoli[i] + ': ' + cfg.formato(tot[i]))}"/>`;
      let base = Y(0); const ultimo = cfg.serie.map((s, k) => (Number(s.valori[i]) || 0) ? k : -1).filter(k => k >= 0).pop();
      cfg.serie.forEach((s, k) => {
        const v = Number(s.valori[i]) || 0; if (!v) return;
        const alto = v / cima * ph; const yTop = base - alto; const primo = Math.abs(base - Y(0)) < 0.01;
        const hh = primo ? alto : alto - 2; // 2px di stacco fra i segmenti
        if (hh > 0.6) col += k === ultimo ? `<path data-g="${i}" class="ges-col${i === cfg.corrente ? ' ges-corr' : ''}" d="${pathColonna(cx - bw / 2, yTop, bw, hh, 4)}" style="fill:${s.colore}"/>` : `<rect data-g="${i}" class="ges-col${i === cfg.corrente ? ' ges-corr' : ''}" x="${(cx - bw / 2).toFixed(1)}" y="${yTop.toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" style="fill:${s.colore}"/>`;
        base = yTop;
      });
      if ((n - 1 - i) % ogni === 0) lab += `<text class="ges-ax${i === cfg.corrente ? ' ges-ax-c' : ''}" x="${cx.toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(et)}</text>`;
      // Etichette dirette solo sull'ultima colonna completa e sulla piu' alta: il resto e' nel tooltip e nella tabella.
      const daEtichettare = i === iMax || i === (cfg.corrente === n - 1 ? n - 2 : n - 1);
      if (daEtichettare && tot[i]) lab += `<text class="ges-val" x="${cx.toFixed(1)}" y="${(Y(tot[i]) - 6).toFixed(1)}" text-anchor="middle">${esc(cfg.formato(tot[i]))}</text>`;
      dati.push({ x: cx, y: Y(tot[i]), titolo: cfg.titoli[i], righe: (cfg.serie.length > 1 ? [{ nome: 'Totale', valore: cfg.formato(tot[i]), colore: 'var(--ink-3)' }] : []).concat(cfg.serie.map(s => ({ nome: s.nome, valore: cfg.formato(Number(s.valori[i]) || 0), colore: s.colore })).filter(r => cfg.serie.length === 1 || r.valore !== cfg.formato(0))) });
    });
    scriviSvg(box, `<svg class="ges-g" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(cfg.titolo)}">${g}${hit}${col}<line class="ges-base" x1="${m.l}" x2="${W - m.r}" y1="${Y(0)}" y2="${Y(0)}"/>${lab}</svg>`);
    agganciaTooltip(box, dati);
  }
  /** Barre orizzontali, una serie: categorie nominali, stesso colore per tutte. cfg: {titolo, voci:[{nome, valore, nota}], formato, colore} */
  function disegnaBarre(box, cfg) {
    if (!box) return;
    const W = Math.max(260, box.clientWidth), riga = 32, H = cfg.voci.length * riga + 6;
    const lw = Math.round(Math.min(230, Math.max(96, W * 0.34))), vw = 86, x0 = lw + 10, pw = Math.max(40, W - x0 - vw);
    const max = Math.max(...cfg.voci.map(v => v.valore), 1);
    const car = Math.floor(lw / 7);
    let hit = '', bar = '', lab = ''; const dati = [];
    cfg.voci.forEach((v, i) => {
      const y = i * riga + 3, bh = 16, w = Math.max(v.valore ? 2 : 0, v.valore / max * pw);
      hit += `<rect class="ges-hit" x="0" y="${y}" width="${W}" height="${riga - 2}" data-i="${i}" tabindex="0" aria-label="${esc(v.nome + ': ' + cfg.formato(v.valore))}"/>`;
      if (w) bar += `<path data-g="${i}" class="ges-col" d="${pathBarra(x0, y + (riga - 2 - bh) / 2, w, bh, 4)}" style="fill:${cfg.colore || 'var(--ges-s1)'}"/>`;
      lab += `<text class="ges-nm" x="${lw}" y="${y + riga / 2 + 3}" text-anchor="end">${esc(accorcia(v.nome, car))}</text><text class="ges-val" x="${x0 + w + 6}" y="${y + riga / 2 + 3}">${esc(cfg.formato(v.valore))}</text>`;
      dati.push({ x: x0 + w / 2, y: y + 2, titolo: v.nome, righe: [{ nome: v.nota || cfg.titolo, valore: cfg.formato(v.valore), colore: cfg.colore || 'var(--ges-s1)' }] });
    });
    scriviSvg(box, `<svg class="ges-g" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(cfg.titolo)}">${hit}<line class="ges-base" x1="${x0}" x2="${x0}" y1="0" y2="${H}"/>${bar}${lab}</svg>`);
    agganciaTooltip(box, dati);
  }
  function tabNumeri(intest, righe) {
    return `<details class="ges-numeri"><summary>Vedi i numeri</summary><div class="tab-w"><table class="tab"><thead><tr>${intest.map((x, k) => `<th class="${k ? 'num' : ''}">${h(x)}</th>`).join('')}</tr></thead><tbody>${righe.map(r => `<tr>${r.map((c, k) => `<td class="${k ? 'num' : ''}">${h(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
  }

  // ---- i numeri
  function datiStatistiche(p) {
    const db = A.DB; const oggi = A.oggi(); const gg = PERIODI[p][1]; const da = A.piuGiorni(oggi, -(gg - 1));
    const chiuso = i => i.rapporto && FATTI.includes(i.stato) && i.data;
    const fatturabile = i => i.tipo !== 'sopralluogo' && i.modalita !== 'garanzia' && i.modalita !== 'contratto';
    // Andamento: 12 settimane (lunedi' per lunedi') e 6 mesi, sempre uguali.
    const lun0 = A.lunedi(oggi); const sett = []; for (let k = 11; k >= 0; k--) sett.push(A.piuGiorni(lun0, -7 * k));
    const tipi = Object.keys(A.TIPI_INTERVENTO);
    const perSett = {}; tipi.forEach(t => { perSett[t] = Array(12).fill(0); });
    const d0 = A.daGiorno(oggi); const mesi = []; for (let k = 5; k >= 0; k--) { const d = new Date(d0.getFullYear(), d0.getMonth() - k, 1); mesi.push(d.getFullYear() + '-' + A.pad(d.getMonth() + 1)); }
    const mano = Array(6).fill(0), mat = Array(6).fill(0), ore = Array(6).fill(0);
    db.interventi.forEach(i => {
      if (!chiuso(i)) return;
      const ks = sett.indexOf(A.lunedi(i.data)); if (ks >= 0 && perSett[i.tipo]) perSett[i.tipo][ks]++;
      const km = mesi.indexOf(i.data.slice(0, 7));
      if (km >= 0 && fatturabile(i)) { const v = A.valoreIntervento(i); const mm = A.minutiIntervento(i); mano[km] += v.manodopera + v.uscita; mat[km] += v.materiali; ore[km] += (mm.lavoro + mm.straordinario) / 60; }
    });
    // Nel periodo scelto
    const nel = db.interventi.filter(i => chiuso(i) && i.data >= da && i.data <= oggi);
    const fatt = nel.filter(fatturabile);
    let valore = 0, oreF = 0, valMano = 0, valMat = 0;
    fatt.forEach(i => { const v = A.valoreIntervento(i); const mm = A.minutiIntervento(i); valore += v.totale; valMano += v.manodopera + v.uscita; valMat += v.materiali; oreF += (mm.lavoro + mm.straordinario) / 60; });
    const durata = tipi.map(t => { const l = nel.filter(i => i.tipo === t).map(i => { const mm = A.minutiIntervento(i); return mm.lavoro + mm.straordinario; }).filter(x => x > 0); return { tipo: t, n: l.length, media: l.length ? l.reduce((s, x) => s + x, 0) / l.length : 0 }; }).filter(x => x.n);
    const valutabili = nel.filter(i => i.tipo !== 'sopralluogo' && i.rapporto.esito);
    const risolti = valutabili.filter(i => i.rapporto.esito === 'risolto' && !i.rapporto.secondoIntervento);
    const risPerTipo = tipi.map(t => { const l = valutabili.filter(i => i.tipo === t); return { tipo: t, n: l.length, ok: l.filter(i => i.rapporto.esito === 'risolto' && !i.rapporto.secondoIntervento).length }; }).filter(x => x.n);
    const perCli = {}; fatt.forEach(i => { perCli[i.clienteId] = (perCli[i.clienteId] || 0) + A.valoreIntervento(i).totale; });
    const top = Object.keys(perCli).map(cid => ({ cid, nome: nomeCli(cid), valore: A.arrot(perCli[cid]) })).sort((a, b) => b.valore - a.valore).slice(0, 10);
    const perTipoCli = Object.keys(TIPI_CLIENTE).map(t => { const l = nel.filter(i => (A.cliente(i.clienteId) || {}).tipo === t); return { tipo: t, n: l.length, valore: A.arrot(l.filter(fatturabile).reduce((s, i) => s + A.valoreIntervento(i).totale, 0)) }; });
    const prev = db.preventivi;
    const inPer = x => x && String(x).slice(0, 10) >= da && String(x).slice(0, 10) <= oggi;
    const inviati = prev.filter(x => inPer(x.inviatoIl)).length;
    const accettati = prev.filter(x => x.decisione && x.decisione.esito === 'accettato' && inPer(x.decisoIl));
    const rifiutati = prev.filter(x => x.decisione && x.decisione.esito === 'rifiutato' && inPer(x.decisoIl));
    const valAcc = accettati.reduce((s, x) => s + A.totaliPreventivo(x).imponibile, 0);
    return {
      da, oggi, sett, perSett, tipi, mesi, mano: mano.map(A.arrot), mat: mat.map(A.arrot), ore: ore.map(x => Math.round(x * 10) / 10),
      nChiusi: nel.length, valore: A.arrot(valore), valMano: A.arrot(valMano), valMat: A.arrot(valMat), oreF: Math.round(oreF * 10) / 10,
      durata, risolti: risolti.length, valutabili: valutabili.length, risPerTipo, top, perTipoCli,
      prev: { inviati, accettati: accettati.length, rifiutati: rifiutati.length, valAcc: A.arrot(valAcc), tasso: accettati.length + rifiutati.length ? Math.round(accettati.length / (accettati.length + rifiutati.length) * 100) : null }
    };
  }
  const nomeSett = lun => { const f = A.piuGiorni(lun, 6); const a = A.daGiorno(lun), b = A.daGiorno(f); return a.getMonth() === b.getMonth() ? a.getDate() + '–' + b.getDate() + ' ' + A.MESI_BREVI[b.getMonth()] : A.dataBreve(lun) + ' – ' + A.dataBreve(f); };
  const nomeMese = ym => { const [y, mm] = ym.split('-').map(Number); return cap(A.MESI[mm - 1]) + ' ' + y; };
  const meseBreve = ym => { const [y, mm] = ym.split('-').map(Number); return A.MESI_BREVI[mm - 1] + (mm === 1 ? ' ' + String(y).slice(2) : ''); };

  function paginaStatistiche(par) {
    const p = PERIODI[par.q.p] ? par.q.p : '90';
    const s = datiStatistiche(p);
    const tipiUsati = s.tipi.filter(t => s.perSett[t].some(x => x));
    const pct = s.valutabili ? Math.round(s.risolti / s.valutabili * 100) : null;
    const leg = voci => `<div class="legenda">${voci.map(([n, c]) => `<span><i style="background:${c}"></i>${h(n)}</span>`).join('')}</div>`;
    const andamento = `<div class="ges-intesta" style="margin-bottom:10px"><div><h2>Andamento</h2><p>Sempre le ultime 12 settimane e gli ultimi 6 mesi: la colonna chiara è quella in corso.</p></div></div>
      <div class="tessera"><div class="tt"><h3>${icona('grafico')} Interventi chiusi per settimana, per tipo di lavoro</h3></div><div class="cp">
        <div class="ges-viz" id="ges-g-sett" style="min-height:230px"></div>
        ${leg(tipiUsati.map(t => [A.TIPI_INTERVENTO[t], SERIE_TIPO[t]]))}
        ${tabNumeri(['Settimana'].concat(tipiUsati.map(t => A.TIPI_INTERVENTO[t])).concat(['Totale']), s.sett.map((l, k) => [nomeSett(l) + (k === 11 ? ' (in corso)' : '')].concat(tipiUsati.map(t => String(s.perSett[t][k]))).concat([String(tipiUsati.reduce((x, t) => x + s.perSett[t][k], 0))])))}
      </div></div>
      <div class="griglia g2 ges-gr" style="margin-top:16px">
        <div class="tessera"><div class="tt"><h3>${icona('euro')} Valore prodotto per mese</h3></div><div class="cp">
          <p class="ges-g-dida">A listino, IVA esclusa. Esclusi garanzia, contratto e sopralluoghi.</p>
          <div class="ges-viz" id="ges-g-valore" style="min-height:230px"></div>
          ${leg([['Manodopera e uscite', 'var(--ges-s1)'], ['Materiali', 'var(--ges-s2)']])}
          ${tabNumeri(['Mese', 'Manodopera e uscite', 'Materiali', 'Totale'], s.mesi.map((m, k) => [nomeMese(m) + (k === 5 ? ' (in corso)' : ''), A.euro(s.mano[k], true), A.euro(s.mat[k], true), A.euro(s.mano[k] + s.mat[k], true)]))}
        </div></div>
        <div class="tessera"><div class="tt"><h3>${icona('orologio')} Ore fatturabili per mese</h3></div><div class="cp">
          <p class="ges-g-dida">Ore di lavoro e straordinario dei rapportini, esclusi garanzia, contratto e sopralluoghi.</p>
          <div class="ges-viz" id="ges-g-ore" style="min-height:230px"></div>
          ${tabNumeri(['Mese', 'Ore fatturabili'], s.mesi.map((m, k) => [nomeMese(m) + (k === 5 ? ' (in corso)' : ''), A.num(s.ore[k], 1)]))}
        </div></div>
      </div>`;
    const filtri = `<div class="ges-stat-filtri" id="ges-stat-periodo"><div><h2>Nel periodo</h2><p>Dal ${h(A.data(s.da))} a oggi. Tutto quello che c'è sotto segue il periodo scelto.</p></div>
      <div class="btns">${segmenti(Object.keys(PERIODI).map(k => [k, PERIODI[k][0], '#/u/statistiche?p=' + k]), p)}<button class="btn" type="button" data-az="ges-stat-csv" data-p="${h(p)}">${icona('scarica')} Esporta il riepilogo (CSV)</button></div></div>`;
    const kp = `<div class="ges-kpis">
      ${kpi({ ic: 'chiave', l: 'Interventi chiusi', v: String(s.nChiusi), d: 'rapportini inviati o approvati' })}
      ${kpi({ ic: 'euro', l: 'Valore prodotto', v: h(A.euro(s.valore, true)), d: `manodopera ${h(euroK(s.valMano))} · materiali ${h(euroK(s.valMat))}` })}
      ${kpi({ ic: 'orologio', l: 'Ore fatturabili', v: h(A.num(s.oreF, 0)) + '<small> h</small>', d: s.oreF ? 'valore medio ' + h(A.euro(s.valMano / s.oreF, true)) + ' l\'ora (con le uscite)' : '—' })}
      ${kpi({ ic: 'spunta', l: 'Primo intervento risolutivo', v: pct === null ? '—' : pct + '<small> %</small>', d: s.valutabili ? `<b>${s.risolti}</b> su ${s.valutabili} risolti al primo passaggio` : 'Nessun intervento nel periodo' })}
    </div>`;
    const prevCard = `<div class="tessera"><div class="tt"><h3>${icona('documento')} Preventivi</h3><a class="btn pic" href="#/u/preventivi">Apri</a></div><div class="cp">
        <div class="ges-mini-kpi"><div><small>Inviati</small><b>${s.prev.inviati}</b></div><div><small>Accettati</small><b>${s.prev.accettati}</b></div><div><small>Rifiutati</small><b>${s.prev.rifiutati}</b></div><div><small>Valore accettato</small><b>${h(euroK(s.prev.valAcc))}</b></div></div>
        <div class="ges-metro-t"><span>Tasso di accettazione</span><b>${s.prev.tasso === null ? '—' : s.prev.tasso + '%'}</b></div>
        <div class="ges-metro" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s.prev.tasso || 0}" aria-label="Tasso di accettazione"><i style="width:${s.prev.tasso || 0}%"></i></div>
        <p class="pic" style="margin-top:6px">Accettati su decisi (accettati più rifiutati) nel periodo. Quelli ancora senza risposta non contano.</p>
      </div></div>`;
    const risCard = `<div class="tessera"><div class="tt"><h3>${icona('verifica')} Primo intervento risolutivo</h3></div><div class="cp">
        <div class="ges-metro-t"><span>Risolti al primo passaggio, senza un secondo intervento</span><b>${pct === null ? '—' : pct + '%'}</b></div>
        <div class="ges-metro" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct || 0}" aria-label="Primo intervento risolutivo"><i style="width:${pct || 0}%"></i></div>
        ${s.risPerTipo.length ? `<table class="tab" style="margin-top:12px"><thead><tr><th>Tipo di lavoro</th><th class="num">Risolti</th><th class="num">%</th></tr></thead><tbody>${s.risPerTipo.map(x => `<tr><td>${h(A.TIPI_INTERVENTO[x.tipo])}</td><td class="num">${x.ok} su ${x.n}</td><td class="num"><b>${Math.round(x.ok / x.n * 100)}%</b></td></tr>`).join('')}</tbody></table>` : ''}
        <p class="pic" style="margin-top:8px">Esclusi i sopralluoghi. Si confrontano i tipi di lavoro, non le persone.</p>
      </div></div>`;
    const durCard = `<div class="tessera"><div class="tt"><h3>${icona('orologio')} Durata media per tipo di lavoro</h3></div><div class="cp">
        <p class="ges-g-dida">Ore di lavoro sul posto (viaggio escluso), per intervento.</p>
        ${s.durata.length ? `<div class="ges-viz" id="ges-g-durata"></div>${tabNumeri(['Tipo di lavoro', 'Interventi', 'Durata media'], s.durata.map(x => [A.TIPI_INTERVENTO[x.tipo], String(x.n), A.durata(x.media)]))}` : A.vuoto('Nessun dato', 'Nessun intervento chiuso nel periodo.', 'grafico')}
      </div></div>`;
    const topCard = `<div class="tessera"><div class="tt"><h3>${icona('edificio')} Primi 10 clienti per valore</h3></div><div class="cp">
        <p class="ges-g-dida">Valore dei lavori chiusi nel periodo, IVA esclusa.</p>
        ${s.top.length ? `<div class="ges-viz" id="ges-g-top"></div>${tabNumeri(['Cliente', 'Valore'], s.top.map(x => [x.nome, A.euro(x.valore)]))}` : A.vuoto('Nessun dato', 'Nessun lavoro fatturabile nel periodo.', 'grafico')}
      </div></div>`;
    const totTipo = s.perTipoCli.reduce((x, t) => x + t.valore, 0);
    const tcCard = `<div class="tessera"><div class="tt"><h3>${icona('persone')} Lavoro per tipo di cliente</h3></div><div class="cp">
        <p class="ges-g-dida">Valore dei lavori chiusi nel periodo e numero di interventi.</p>
        <div class="ges-viz" id="ges-g-tipocli"></div>
        ${tabNumeri(['Tipo di cliente', 'Interventi', 'Valore', 'Quota'], s.perTipoCli.map(x => [TIPI_CLIENTE[x.tipo][0], String(x.n), A.euro(x.valore), totTipo ? Math.round(x.valore / totTipo * 100) + '%' : '—']))}
      </div></div>`;
    const contenuto = `<div class="ges-stat" id="ges-stat">
      <div class="avviso" style="margin-bottom:18px">${icona('scudo')}<div>Qui si confrontano i tipi di lavoro, i clienti e i mesi. <b>Nessuna classifica fra tecnici</b>: è una regola del gestionale.</div></div>
      ${andamento}${filtri}${kp}
      <div class="griglia g2 ges-gr">${prevCard}${risCard}</div>
      <div class="griglia g2 ges-gr" style="margin-top:16px">${durCard}${tcCard}</div>
      <div style="margin-top:16px">${topCard}</div>
    </div>`;
    ultimoPeriodoStat = p;
    return { html: pagina({ attivo: 'statistiche', titolo: 'Statistiche', briciole: [['Conti', '#/u/documenti']], contenuto }), dopo: () => disegnaStatistiche(p) };
  }
  let ultimoPeriodoStat = '90';
  function disegnaStatistiche(p) {
    if (!A.$('#ges-stat')) return;
    const s = datiStatistiche(p || ultimoPeriodoStat);
    const tipiUsati = s.tipi.filter(t => s.perSett[t].some(x => x));
    const intero = v => A.num(v, 0);
    disegnaColonne(A.$('#ges-g-sett'), { titolo: 'Interventi chiusi per settimana, per tipo di lavoro', etichette: s.sett.map((l, k) => k === 11 ? 'questa' : A.dataBreve(l)), titoli: s.sett.map((l, k) => 'Settimana ' + nomeSett(l) + (k === 11 ? ' (in corso)' : '')), serie: tipiUsati.map(t => ({ nome: A.TIPI_INTERVENTO[t], colore: SERIE_TIPO[t], valori: s.perSett[t] })), formato: intero, asse: intero, corrente: 11 });
    disegnaColonne(A.$('#ges-g-valore'), { titolo: 'Valore prodotto per mese', etichette: s.mesi.map(meseBreve), titoli: s.mesi.map((m, k) => nomeMese(m) + (k === 5 ? ' (in corso)' : '')), serie: [{ nome: 'Manodopera e uscite', colore: 'var(--ges-s1)', valori: s.mano }, { nome: 'Materiali', colore: 'var(--ges-s2)', valori: s.mat }], formato: v => A.euro(v, true), asse: euroK, corrente: 5 });
    disegnaColonne(A.$('#ges-g-ore'), { titolo: 'Ore fatturabili per mese', etichette: s.mesi.map(meseBreve), titoli: s.mesi.map((m, k) => nomeMese(m) + (k === 5 ? ' (in corso)' : '')), serie: [{ nome: 'Ore fatturabili', colore: 'var(--ges-s1)', valori: s.ore }], formato: v => A.num(v, 1) + ' h', asse: v => A.num(v, 0), corrente: 5 });
    disegnaBarre(A.$('#ges-g-durata'), { titolo: 'Durata media', voci: s.durata.map(x => ({ nome: A.TIPI_INTERVENTO[x.tipo], valore: Math.round(x.media), nota: 'durata media su ' + plurale(x.n, 'intervento', 'interventi') })), formato: v => A.durata(v) });
    disegnaBarre(A.$('#ges-g-top'), { titolo: 'Valore', voci: s.top.map(x => ({ nome: x.nome, valore: x.valore, nota: 'valore nel periodo' })), formato: v => A.euro(v, true) });
    const totTipo = s.perTipoCli.reduce((x, t) => x + t.valore, 0);
    disegnaBarre(A.$('#ges-g-tipocli'), { titolo: 'Valore', voci: s.perTipoCli.map(x => ({ nome: { privato: 'Privati', condominio: 'Condomini', azienda: 'Aziende' }[x.tipo], valore: x.valore, nota: plurale(x.n, 'intervento', 'interventi') + (totTipo ? ' · ' + Math.round(x.valore / totTipo * 100) + '% del valore' : '') })), formato: v => A.euro(v, true) });
  }
  let timerStat = null;
  window.addEventListener('resize', () => { clearTimeout(timerStat); timerStat = setTimeout(() => disegnaStatistiche(), 180); });
  A.azione('ges-stat-csv', el => {
    const p = PERIODI[el.dataset.p] ? el.dataset.p : '90'; const s = datiStatistiche(p);
    const tipiUsati = s.tipi.filter(t => s.perSett[t].some(x => x));
    const r = [['Riepilogo statistiche IDRAL', 'Periodo: ultimi ' + PERIODI[p][1] + ' giorni', 'dal ' + A.data(s.da) + ' al ' + A.data(s.oggi)], [],
      ['Indicatore', 'Valore'], ['Interventi chiusi', s.nChiusi], ['Valore prodotto (€, IVA esclusa)', dec(s.valore)], ['di cui manodopera e uscite (€)', dec(s.valMano)], ['di cui materiali (€)', dec(s.valMat)], ['Ore fatturabili', dec(s.oreF)],
      ['Primo intervento risolutivo (%)', s.valutabili ? Math.round(s.risolti / s.valutabili * 100) : ''], ['Preventivi inviati', s.prev.inviati], ['Preventivi accettati', s.prev.accettati], ['Preventivi rifiutati', s.prev.rifiutati], ['Tasso di accettazione (%)', s.prev.tasso === null ? '' : s.prev.tasso], ['Valore dei preventivi accettati (€)', dec(s.prev.valAcc)], [],
      ['Tipo di lavoro', 'Interventi chiusi', 'Durata media (ore)', 'Risolti al primo passaggio (%)']].concat(s.durata.map(x => { const rr = s.risPerTipo.find(y => y.tipo === x.tipo); return [A.TIPI_INTERVENTO[x.tipo], x.n, dec(x.media / 60), rr ? Math.round(rr.ok / rr.n * 100) : '']; }))
      .concat([[], ['Tipo di cliente', 'Interventi', 'Valore (€)']]).concat(s.perTipoCli.map(x => [TIPI_CLIENTE[x.tipo][0], x.n, dec(x.valore)]))
      .concat([[], ['Primi 10 clienti', 'Valore (€)']]).concat(s.top.map(x => [x.nome, dec(x.valore)]))
      .concat([[], ['Settimana (ultime 12)'].concat(tipiUsati.map(t => A.TIPI_INTERVENTO[t]))]).concat(s.sett.map((l, k) => [nomeSett(l)].concat(tipiUsati.map(t => s.perSett[t][k]))))
      .concat([[], ['Mese (ultimi 6)', 'Manodopera e uscite (€)', 'Materiali (€)', 'Ore fatturabili']]).concat(s.mesi.map((m, k) => [nomeMese(m), dec(s.mano[k]), dec(s.mat[k]), dec(s.ore[k])]));
    A.scarica('statistiche-idral-' + p + '-' + A.oggi() + '.csv', A.csv(r), 'text/csv;charset=utf-8');
    A.modifica(() => A.registra('export statistiche', 'ultimi ' + PERIODI[p][1] + ' giorni'));
  });

  rotta('#/u/statistiche', paginaStatistiche);

  // ===========================================================================
  // 10. PERSONE E ACCESSI (solo il titolare)
  // ===========================================================================
  const GRUPPI_PERSONE = [['titolare', 'Titolare', 'scudo'], ['ufficio', 'Ufficio', 'persone'], ['tecnico', 'Tecnici', 'chiave'], ['cliente', 'Clienti con accesso all\'area riservata', 'edificio']];
  const PERMESSI = [
    ['Agenda e interventi', 'tutti', 'tutti', 'solo i suoi lavori', 'solo i suoi, senza note interne'],
    ['Rapportini, foto e firma del cliente', '—', '—', 'sì', '—'],
    ['Approvare i rapportini', 'sì', 'sì', '—', '—'],
    ['Prezzi, costi e margini', 'sì', 'sì', 'mai, neanche nei totali', 'solo i prezzi dei suoi preventivi e ordini'],
    ['Preventivi: creare e inviare', 'sì', 'sì', '—', '—'],
    ['Preventivi: accettare o rifiutare', '—', '—', '—', 'solo i suoi'],
    ['Da fatturare ed export per il commercialista', 'sì', 'sì', '—', '—'],
    ['Fatture e documenti del cliente', 'sì', 'sì', '—', 'solo quelli resi visibili'],
    ['Magazzino', 'sì', 'sì', 'il suo furgone, senza prezzi', '—'],
    ['Clienti e macchine', 'sì', 'sì', 'solo il cliente del lavoro', 'solo i suoi dati'],
    ['Messaggi', 'sì', 'sì', 'note all\'ufficio', 'con l\'ufficio'],
    ['Statistiche', 'sì', 'sì', '—', '—'],
    ['Persone e accessi', 'sì', '—', '—', '—'],
    ['Impostazioni e backup', 'sì', '—', '—', '—'],
    ['Registro attività', 'sì', '—', '—', '—']
  ];
  function cellaPermesso(v) { return v === 'sì' || v === 'tutti' ? `<span class="ges-si">${icona('spunta', 'p')} ${v === 'tutti' ? 'tutto' : 'sì'}</span>` : v === '—' ? '<span class="muto">—</span>' : `<span class="ges-parz">${h(v)}</span>`; }
  function statoPersona(u) {
    if (u.attivo === false) return A.pastiglia('Disattivato', 'grigio');
    if (u.ruolo === 'cliente' && !usaArea(u)) return A.pastiglia('Invito non ancora aperto', 'blu');
    return A.pastiglia('Attivo', 'ok');
  }
  function paginaPersone() {
    const no = soloTitolare('persone', 'persone', 'Persone e accessi'); if (no) return no;
    const db = A.DB; const io = A.utente();
    const gruppo = ([ruolo, titolo, ic]) => {
      const lista = db.utenti.filter(u => u.ruolo === ruolo).sort((a, b) => (a.attivo === false ? 1 : 0) - (b.attivo === false ? 1 : 0) || a.nome.localeCompare(b.nome));
      const righe = lista.map(u => {
        const mag = ruolo === 'tecnico' ? A.magazzinoDiTecnico(u.id) : null;
        const extra = ruolo === 'tecnico' ? `${h(u.squadra || '—')}${mag ? `<div class="t2">${h(mag.nome)}</div>` : ''}` : ruolo === 'cliente' ? `${(u.clienti || []).map(cid => `<a href="#/u/cliente/${h(cid)}?scheda=area">${h(nomeCli(cid))}</a>`).join(', ') || '<span class="muto">nessun cliente collegato</span>'}` : `<span class="muto">${ruolo === 'titolare' ? 'vede e gestisce tutto' : 'tutto tranne persone, impostazioni e registro'}</span>`;
        const id = h(u.id); const sonoIo = u.id === io.id;
        return `<tr class="${u.attivo === false ? 'ges-spento' : ''}">
          <td class="ges-prima"><div class="ges-persona">${ruolo === 'tecnico' ? avatarPersona(u) : `<span class="avatar ${ruolo === 'cliente' ? 'acc' : ''}">${h(A.iniziali(u.nome))}</span>`}<div><b>${h(u.nome)}</b>${sonoIo ? ' <span class="ges-chip">sei tu</span>' : ''}<div class="t2">${h(ruolo === 'tecnico' ? (u.telefono || '—') : (u.email || '—'))}</div></div></div></td>
          <td data-l="${ruolo === 'tecnico' ? 'Squadra e furgone' : ruolo === 'cliente' ? 'Clienti' : 'Può'}">${extra}</td>
          <td data-l="Ultimo accesso">${u.ultimoAccesso ? h(A.quando(u.ultimoAccesso)) : '<span class="muto">mai</span>'}</td>
          <td data-l="Stato">${statoPersona(u)}</td>
          <td class="ges-az"><div class="ges-azr">
            <button class="btn pic" type="button" data-az="ges-per-mod" data-id="${id}">${icona('modifica', 'p')} Modifica</button>
            ${ruolo === 'cliente' ? (u.attivo !== false ? `<button class="btn pic" type="button" data-az="ges-acc-link" data-id="${id}">${icona('invia', 'p')} Nuovo link</button>` : '') : `<button class="btn pic" type="button" data-az="ges-per-pw" data-id="${id}" title="Reimposta la password">${icona('lucchetto', 'p')} Password</button>`}
            ${sonoIo ? '' : `<button class="btn pic ${u.attivo === false ? '' : 'per'}" type="button" data-az="ges-per-attivo" data-id="${id}">${u.attivo === false ? 'Riattiva' : 'Disattiva'}</button>`}
          </div></td></tr>`;
      }).join('');
      return `<div class="tessera"><div class="tt"><h3>${icona(ic)} ${h(titolo)} <span class="ges-conta">${lista.length}</span></h3></div>
        ${lista.length ? `<div class="tab-w"><table class="tab ges-resp ges-tab-per"><thead><tr><th>Persona</th><th>${ruolo === 'tecnico' ? 'Squadra e furgone' : ruolo === 'cliente' ? 'Clienti collegati' : 'Può'}</th><th>Ultimo accesso</th><th>Stato</th><th></th></tr></thead><tbody>${righe}</tbody></table></div>` : `<div class="cp"><p class="muto" style="font-size:14px">Nessuno.</p></div>`}</div>`;
    };
    const tabella = `<div class="tessera" style="margin-top:22px"><div class="tt"><h3>${icona('scudo')} Chi può fare cosa</h3><span class="pic">sola lettura: sono le regole del gestionale</span></div>
      <div class="tab-w"><table class="tab ges-permessi"><thead><tr><th>Funzione</th><th>Titolare</th><th>Ufficio</th><th>Tecnico</th><th>Cliente</th></tr></thead><tbody>${PERMESSI.map(r => `<tr><td><b>${h(r[0])}</b></td>${r.slice(1).map(v => `<td>${cellaPermesso(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <div class="ges-dida">${icona('lucchetto', 'p')} Nella demo le regole le applica l'app; nel prodotto vero le applica il database (ogni ruolo legge solo le righe che gli spettano).</div></div>`;
    const contenuto = `<div class="ges-intesta"><p>Chi entra nel gestionale e come. I tecnici entrano con il telefono e la password che gli consegni tu; i clienti con un link via email; l'ufficio con email e password.</p></div>
      <div class="ges-col">${GRUPPI_PERSONE.map(gruppo).join('')}</div>${tabella}`;
    return pagina({ attivo: 'persone', titolo: 'Persone e accessi', briciole: [['Azienda', '#/u/persone']], azioni: `<button class="btn acc" type="button" data-az="ges-per-nuova">${icona('piu')}<span class="ges-nt">Nuova persona</span></button>`, contenuto });
  }
  function campiPersona(ruolo, u) {
    u = u || {};
    const nuovo = !u.id;
    if (ruolo === 'tecnico') {
      const n = A.DB.utenti.filter(x => x.ruolo === 'tecnico').length + 1;
      const col = u.colore || COLORI_TECNICO.find(c => !A.DB.utenti.some(x => x.colore === c)) || COLORI_TECNICO[0];
      return `<div class="ges-form-g">
        <div class="campo"><label for="ges-p-n">Nome e cognome</label><input id="ges-p-n" name="nome" type="text" value="${h(u.nome || '')}" required></div>
        <div class="campo"><label for="ges-p-t">Telefono <span class="muto">(serve per entrare)</span></label><input id="ges-p-t" name="telefono" type="tel" value="${h(u.telefono || '')}" placeholder="333 123 4567" required></div>
        <div class="campo"><label for="ges-p-s">Squadra</label><input id="ges-p-s" name="squadra" type="text" value="${h(u.squadra || 'Squadra ' + n)}"></div>
        ${nuovo ? `<div class="campo"><label for="ges-p-f">Targa del furgone <span class="muto">(facoltativa)</span></label><input id="ges-p-f" name="targa" type="text" autocapitalize="characters" placeholder="FR 312 KD"></div>` : '<div></div>'}
        <div class="campo tutta"><span class="etichetta">Colore in agenda</span><div class="scelte ges-colori">${COLORI_TECNICO.map(c => `<label class="scelta"><input type="radio" name="colore" value="${c}"${c === col ? ' checked' : ''}><span style="--c:${c}" aria-label="Colore ${c}"><i></i></span></label>`).join('')}</div></div>
        ${nuovo ? `<div class="campo tutta"><label for="ges-p-pw">Password da consegnare</label><div class="ges-link"><input id="ges-p-pw" name="password" type="text" value="${h(parolaChiave())}" autocomplete="off"><button class="btn" type="button" data-az="ges-per-genera">${icona('ricarica', 'p')} Un'altra</button></div><span class="aiuto">Facile da dettare al telefono. La vedrai ancora una volta sola, dopo il salvataggio.</span></div>` : ''}
      </div>`;
    }
    if (ruolo === 'cliente') {
      const clienti = A.DB.clienti.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
      return `<div class="ges-form-g">
        <div class="campo"><label for="ges-p-n">Nome e cognome</label><input id="ges-p-n" name="nome" type="text" value="${h(u.nome || '')}" required></div>
        <div class="campo"><label for="ges-p-e">Email <span class="muto">(il link arriva qui)</span></label><input id="ges-p-e" name="email" type="email" value="${h(u.email || '')}" required></div>
        <div class="campo tutta"><span class="etichetta">Clienti che può vedere</span><div class="ges-cb-lista">${clienti.map(c => `<label class="spunta"><input type="checkbox" name="clienti" value="${h(c.id)}"${(u.clienti || []).includes(c.id) ? ' checked' : ''}> ${h(c.nome)} <span class="pic">${h(TIPI_CLIENTE[c.tipo] ? TIPI_CLIENTE[c.tipo][0] : '')}</span></label>`).join('')}</div><span class="aiuto">Un amministratore di condominio ne vede più di uno con lo stesso accesso.</span></div>
        ${nuovo ? '<label class="spunta tutta"><input type="checkbox" name="invito" checked> Manda subito l\'email d\'invito con il link</label>' : ''}
      </div>`;
    }
    return `<div class="ges-form-g">
      <div class="campo"><label for="ges-p-n">Nome e cognome</label><input id="ges-p-n" name="nome" type="text" value="${h(u.nome || '')}" required></div>
      <div class="campo"><label for="ges-p-e">Email <span class="muto">(serve per entrare)</span></label><input id="ges-p-e" name="email" type="email" value="${h(u.email || '')}" required></div>
      ${nuovo ? `<div class="campo tutta"><label for="ges-p-pw">Password</label><div class="ges-link"><input id="ges-p-pw" name="password" type="text" value="${h(parolaChiave())}" autocomplete="off"><button class="btn" type="button" data-az="ges-per-genera">${icona('ricarica', 'p')} Un'altra</button></div><span class="aiuto">Almeno 8 caratteri. Consegnala a voce: la persona potrà cambiarla.</span></div>` : ''}
    </div>`;
  }
  A.azione('ges-per-nuova', () => {
    A.modale({
      titolo: 'Nuova persona', form: 'ges-per-salva', largo: true,
      corpo: `<div class="campo"><span class="etichetta">Chi è</span><div class="scelte">${[['tecnico', 'Tecnico', 'chiave'], ['ufficio', 'Ufficio', 'persone'], ['cliente', 'Cliente (area riservata)', 'edificio']].map(([k, t, ic], i) => `<label class="scelta"><input type="radio" name="ruolo" value="${k}"${i === 0 ? ' checked' : ''} data-cambia="ges-per-ruolo"><span>${icona(ic, 'p')}${h(t)}</span></label>`).join('')}</div></div>
        <div id="ges-per-campi">${campiPersona('tecnico')}</div>${divErr}`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: 'Crea', classe: 'pri', tipo: 'submit', icona: 'spunta' }]
    });
  });
  A.azione('ges-per-ruolo', el => { const b = A.$('#ges-per-campi'); if (b) b.innerHTML = campiPersona(el.value); erroreModale(''); });
  A.azione('ges-per-genera', () => { const i = A.$('#ges-p-pw'); if (i) i.value = parolaChiave(); });
  function controllaPersona(ruolo, d, escludi) {
    const nome = String(d.nome || '').trim(); if (!nome) return 'Scrivi il nome.';
    if (ruolo === 'tecnico') {
      const t = A.normTel(d.telefono); if (t.length < 6) return 'Serve il numero di telefono: il tecnico entra con quello.';
      if (A.DB.utenti.some(u => u.id !== escludi && u.telefono && A.normTel(u.telefono) === t)) return 'Questo numero è già usato da un\'altra persona.';
    } else {
      const e = String(d.email || '').trim().toLowerCase(); if (!emailValida(e)) return 'Serve un\'email valida.';
      if (A.DB.utenti.some(u => u.id !== escludi && u.email && u.email.toLowerCase() === e)) return 'Questa email è già usata da un\'altra persona.';
    }
    if (d.password !== undefined && String(d.password).trim().length < 8) return 'La password deve avere almeno 8 caratteri.';
    return '';
  }
  function mostraCredenziali(titolo, testo, chi, pw) {
    A.modale({
      titolo, corpo: `<div class="avviso ok" style="margin-bottom:14px">${icona('spunta')}<div>${testo}</div></div>
        <dl class="dl" style="margin-bottom:12px"><dt>Entra con</dt><dd class="mono">${h(chi)}</dd></dl>
        <p class="etichetta" style="margin-bottom:6px">Password</p>${bloccoLink(pw, '<b>Te la mostriamo solo adesso.</b> Consegnala di persona o dettala al telefono; se si perde, la reimposti.')}`,
      azioni: [{ testo: 'Fatto', classe: 'pri', chiudi: true }]
    });
  }
  A.azione('ges-per-salva', (f, ev, d) => {
    const ruolo = ['tecnico', 'ufficio', 'cliente'].includes(d.ruolo) ? d.ruolo : 'tecnico';
    const err = controllaPersona(ruolo, d); if (err) return erroreModale(err);
    const nome = String(d.nome || '').trim(); const id = A.uid('u');
    if (ruolo === 'cliente') {
      const clienti = Array.isArray(d.clienti) ? d.clienti : [];
      if (!clienti.length) return erroreModale('Scegli almeno un cliente che può vedere.');
      const email = String(d.email).trim().toLowerCase();
      A.modifica(db => {
        db.utenti.push({ id, ruolo: 'cliente', nome, email, telefono: '', password: A.uid('pw'), clienti, attivo: true, preferenze: { email: true }, creato: A.adesso(), invitatoIl: A.adesso() });
        clienti.forEach(cid => { const c = db.clienti.find(x => x.id === cid); if (c) c.portale = true; });
        A.registra('persona creata', nome + ' (Cliente) — ' + clienti.map(nomeCli).join(', '));
      });
      if (d.invito) {
        const link = A.creaLink(id, 'invito');
        A.modifica(db => emailInvito(db, nome, email, clienti[0], link, clienti.length > 1 ? 'Con lo stesso accesso vede anche: ' + clienti.slice(1).map(nomeCli).join(', ') + '.' : ''));
        A.render(); return mostraLinkCreato('Accesso creato', 'Abbiamo mandato a <b>' + h(email) + '</b> l\'invito per entrare nell\'area clienti.', link);
      }
      A.chiudiModale(); A.toast('Accesso creato (invito non mandato)', 'ok'); return A.render();
    }
    const pw = String(d.password).trim();
    if (ruolo === 'tecnico') {
      const tel = String(d.telefono).trim(); const colore = COLORI_TECNICO.includes(d.colore) ? d.colore : COLORI_TECNICO[0];
      A.modifica(db => {
        db.utenti.push({ id, ruolo: 'tecnico', nome, email: '', telefono: tel, password: pw, squadra: String(d.squadra || '').trim(), colore, attivo: true, creato: A.adesso() });
        // Ogni tecnico ha il suo furgone: e' un magazzino come il deposito, con i suoi movimenti.
        let mid = 'mag_' + (nome.split(' ')[0] || 'tecnico').toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
        if (db.magazzini.some(m => m.id === mid)) mid = A.uid('mag');
        db.magazzini.push({ id: mid, nome: 'Furgone ' + nome.split(' ')[0] + (d.targa ? ' — ' + String(d.targa).trim().toUpperCase() : ''), tipo: 'furgone', tecnicoId: id });
        A.registra('persona creata', nome + ' (Tecnico) con il suo furgone');
      });
      A.render();
      return mostraCredenziali('Tecnico creato', '<b>' + h(nome) + '</b> può entrare dall\'app sul telefono. Abbiamo creato anche il magazzino del suo furgone.', tel, pw);
    }
    const email = String(d.email).trim().toLowerCase();
    A.modifica(db => { db.utenti.push({ id, ruolo: 'ufficio', nome, email, telefono: '', password: pw, attivo: true, creato: A.adesso() }); A.registra('persona creata', nome + ' (Ufficio)'); });
    A.render();
    mostraCredenziali('Persona creata', '<b>' + h(nome) + '</b> entra nel gestionale come Ufficio: vede tutto tranne persone, impostazioni e registro.', email, pw);
  });
  A.azione('ges-per-mod', el => {
    const u = A.utenteDa(el.dataset.id); if (!u) return;
    const ruolo = u.ruolo === 'titolare' ? 'ufficio' : u.ruolo;
    A.modale({
      titolo: 'Modifica — ' + u.nome, form: 'ges-per-mod-ok', largo: u.ruolo === 'cliente',
      corpo: `<input type="hidden" name="id" value="${h(u.id)}"><p class="pic" style="margin-bottom:12px">${h(A.ETICHETTA_RUOLO[u.ruolo])}. Il ruolo non si cambia: se serve, crea una nuova persona.</p>${campiPersona(ruolo, u)}${divErr}`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: 'Salva', classe: 'pri', tipo: 'submit', icona: 'spunta' }]
    });
  });
  A.azione('ges-per-mod-ok', (f, ev, d) => {
    const u = A.utenteDa(d.id); if (!u) return;
    const ruolo = u.ruolo === 'titolare' ? 'ufficio' : u.ruolo;
    const err = controllaPersona(ruolo, d, u.id); if (err) return erroreModale(err);
    if (u.ruolo === 'cliente' && !(Array.isArray(d.clienti) && d.clienti.length)) return erroreModale('Scegli almeno un cliente.');
    A.modifica(db => {
      const x = db.utenti.find(y => y.id === u.id); x.nome = String(d.nome).trim();
      if (ruolo === 'tecnico') { x.telefono = String(d.telefono).trim(); x.squadra = String(d.squadra || '').trim(); if (COLORI_TECNICO.includes(d.colore)) x.colore = d.colore; }
      else x.email = String(d.email).trim().toLowerCase();
      if (u.ruolo === 'cliente') {
        const prima = x.clienti || []; x.clienti = d.clienti;
        prima.concat(d.clienti).forEach(cid => { const c = db.clienti.find(y => y.id === cid); if (c) c.portale = db.utenti.some(v => v.ruolo === 'cliente' && v.attivo !== false && (v.clienti || []).includes(cid)); });
      }
      A.registra('persona modificata', x.nome + ' (' + A.ETICHETTA_RUOLO[x.ruolo] + ')');
    });
    A.chiudiModale(); A.toast('Salvato', 'ok'); A.render();
  });
  A.azione('ges-per-pw', async el => {
    const u = A.utenteDa(el.dataset.id); if (!u) return;
    if (!await A.conferma('La password attuale di ' + h(u.nome) + ' smette di funzionare subito. Te ne mostriamo una nuova da consegnare.', { ok: 'Reimposta', titolo: 'Reimpostare la password?' })) return;
    const pw = parolaChiave();
    A.modifica(db => { db.utenti.find(y => y.id === u.id).password = pw; A.registra('password reimpostata', u.nome + ' (' + A.ETICHETTA_RUOLO[u.ruolo] + ')'); });
    mostraCredenziali('Nuova password', 'Nuova password per <b>' + h(u.nome) + '</b>.', u.ruolo === 'tecnico' ? u.telefono : u.email, pw);
  });
  A.azione('ges-per-attivo', async el => {
    const u = A.utenteDa(el.dataset.id); if (!u || u.id === A.utente().id) return;
    const spegni = u.attivo !== false;
    if (spegni) {
      const lavori = u.ruolo === 'tecnico' ? A.DB.interventi.filter(i => (i.tecnici || []).includes(u.id) && APERTI.includes(i.stato)).length : 0;
      if (!await A.conferma(h(u.nome) + ' non potrà più entrare.' + (lavori ? ' <b>Ha ancora ' + plurale(lavori, 'lavoro aperto', 'lavori aperti') + ' in agenda:</b> riassegnali dalla pianificazione.' : '') + ' I suoi dati e la sua storia restano.', { ok: 'Disattiva', pericolo: true, titolo: 'Disattivare ' + h(u.nome) + '?' })) return;
    }
    A.modifica(db => {
      const x = db.utenti.find(y => y.id === u.id); x.attivo = !spegni;
      if (x.ruolo === 'cliente') (x.clienti || []).forEach(cid => { const c = db.clienti.find(y => y.id === cid); if (c) c.portale = db.utenti.some(v => v.ruolo === 'cliente' && v.attivo !== false && (v.clienti || []).includes(cid)); });
      A.registra(spegni ? 'accesso disattivato' : 'accesso riattivato', u.nome + ' (' + A.ETICHETTA_RUOLO[u.ruolo] + ')');
    });
    A.toast(spegni ? u.nome + ' disattivato' : u.nome + ' riattivato', 'ok'); A.render();
  });

  // ===========================================================================
  // 11. POSTA IN USCITA (simulata)
  // ===========================================================================
  /** Testo dell'email con i link cliccabili: nella demo e' l'unico modo di «ricevere» un invito. */
  function testoConLink(t) {
    return String(t || '').split(/(https?:\/\/[^\s]+)/g).map((p, k) => k % 2 ? `<a href="${h(p)}" target="_blank" rel="noopener">${h(p)}</a>` : h(p)).join('');
  }
  function paginaPosta(par) {
    const q = par.q; const parole = norm(q.q).split(/\s+/).filter(Boolean);
    const tutte = A.DB.email;
    const lista = tutte.filter(e => !parole.length || parole.every(p => norm([e.a, e.oggetto, e.testo].join(' ')).includes(p)));
    const MAX = 150; const vis = q.tutti === '1' ? lista : lista.slice(0, MAX);
    const riga = e => `<tr class="clic" data-az="ges-posta-apri" data-id="${h(e.id)}"><td class="ges-prima ges-num" style="white-space:nowrap">${h(A.quando(e.data))}</td><td data-l="A">${h(e.a || '—')}</td><td data-l="Oggetto" class="ges-nome"><b>${h(e.oggetto || '(senza oggetto)')}</b><div class="t2">${h(taglia(e.testo, 110))}</div></td></tr>`;
    const contenuto = `<div class="avviso" style="margin-bottom:16px">${icona('info')}<div><b>Nella demo le email non partono davvero:</b> finiscono qui, così si vede cosa riceverebbero clienti e fornitori. Nel prodotto vero partono dal server di IDRAL.</div></div>
      <div class="ges-filtri">${campoCerca('ges-posta-q', q.q, 'Cerca destinatario, oggetto, testo…')}<span class="pic">${plurale(lista.length, 'email', 'email')}</span></div>
      ${lista.length ? `<div class="tessera"><div class="tab-w"><table class="tab ges-resp"><thead><tr><th>Quando</th><th>A</th><th>Oggetto</th></tr></thead><tbody>${vis.map(riga).join('')}</tbody></table></div>${lista.length > vis.length ? `<div class="ges-dida"><a href="${hashDa(Object.assign({}, q, { tutti: '1' }), '#/u/posta')}">Mostra tutte (${lista.length})</a></div>` : ''}</div>`
        : vuotoTessera(parole.length ? 'Nessuna email trovata' : 'Nessuna email', 'Inviti, preventivi, risposte e avvisi ai clienti compaiono qui.', 'posta')}`;
    return pagina({ attivo: 'posta', titolo: 'Posta in uscita', briciole: [['Azienda', '#/u/persone']], contenuto });
  }
  A.azione('ges-posta-apri', el => {
    const e = A.trova('email', el.dataset.id); if (!e) return;
    A.modale({ titolo: e.oggetto || 'Email', largo: true, corpo: `<dl class="dl" style="margin-bottom:14px"><dt>A</dt><dd>${h(e.a || '—')}</dd><dt>Da</dt><dd>${h(A.DB.azienda.nome)} &lt;${h(A.DB.azienda.email)}&gt;</dd><dt>Quando</dt><dd>${h(A.dataOra(e.data))}</dd></dl><div class="ges-pre">${testoConLink(e.testo)}</div>`, azioni: [{ testo: 'Chiudi', classe: 'pri', chiudi: true }] });
  });

  // ===========================================================================
  // 12. REGISTRO ATTIVITA' (solo il titolare)
  // ===========================================================================
  function filtraRegistro(q) {
    const parole = norm(q.q).split(/\s+/).filter(Boolean);
    return A.DB.registro.filter(r => (!q.chi || r.chi === q.chi) && (!parole.length || parole.every(p => norm([r.azione, r.dettaglio, r.chi].join(' ')).includes(p))));
  }
  function paginaRegistro(par) {
    const no = soloTitolare('registro', 'registro', 'Registro attività'); if (no) return no;
    const q = par.q; const lista = filtraRegistro(q);
    const persone = Array.from(new Set(A.DB.registro.map(r => r.chi).filter(Boolean))).sort();
    const MAX = 200; const vis = q.tutti === '1' ? lista : lista.slice(0, MAX);
    const contenuto = `<div class="ges-intesta"><p>Chi ha fatto cosa, e quando: accessi, preventivi, documenti, magazzino, persone. Non si modifica e non si cancella.</p><button class="btn" type="button" data-az="ges-reg-csv">${icona('scarica')} Esporta CSV</button></div>
      <div class="ges-filtri">${campoCerca('ges-reg-q', q.q, 'Cerca azione o dettaglio…')}${selFiltro('chi', q.chi, [['', 'Tutte le persone']].concat(persone.map(p => [p, p])), 'Persona')}${q.q || q.chi ? `<a class="btn vuoto pic" href="#/u/registro">${icona('x', 'p')} Togli i filtri</a>` : ''}</div>
      ${lista.length ? `<div class="tessera"><div class="tab-w"><table class="tab ges-resp"><thead><tr><th>Quando</th><th>Chi</th><th>Azione</th><th>Dettaglio</th></tr></thead><tbody>${vis.map(r => `<tr><td class="ges-prima ges-num" style="white-space:nowrap">${h(A.dataOra(r.data))}</td><td data-l="Chi">${h(r.chi || '—')}</td><td data-l="Azione"><b>${h(cap(r.azione))}</b></td><td data-l="Dettaglio" class="ges-nome">${h(r.dettaglio || '')}</td></tr>`).join('')}</tbody></table></div>${lista.length > vis.length ? `<div class="ges-dida"><a href="${hashDa(Object.assign({}, q, { tutti: '1' }), '#/u/registro')}">Mostra tutte le ${lista.length} righe</a></div>` : ''}</div>`
        : vuotoTessera('Niente nel registro', 'Nessuna attività corrisponde ai filtri.', 'elenco')}`;
    return pagina({ attivo: 'registro', titolo: 'Registro attività', briciole: [['Azienda', '#/u/persone']], contenuto });
  }
  A.azione('ges-reg-csv', () => {
    const lista = filtraRegistro(qCorrente());
    A.scarica('registro-attivita-' + A.oggi() + '.csv', A.csv([['Data e ora', 'Persona', 'Azione', 'Dettaglio']].concat(lista.map(r => [A.dataOra(r.data), r.chi || '', r.azione, r.dettaglio || '']))), 'text/csv;charset=utf-8');
  });

  // ===========================================================================
  // 13. IMPOSTAZIONI (solo il titolare): azienda, tariffe, notifiche, backup
  // ===========================================================================
  function paginaImpostazioni() {
    const no = soloTitolare('impostazioni', 'impostazioni', 'Impostazioni'); if (no) return no;
    const az = A.DB.azienda; const t = az.tariffe || {};
    const kb = Math.round((localStorage.getItem('idral.demo.v1') || '').length / 1024);
    const campo = (k, et, tipo, extra) => `<div class="campo ${extra || ''}"><label for="ges-az-${k}">${h(et)}</label><input id="ges-az-${k}" name="${k}" type="${tipo || 'text'}" value="${h(az[k] || '')}"></div>`;
    const contenuto = `<div class="griglia g2 ges-gr">
      <form class="tessera" data-form="ges-set-azienda" novalidate><div class="tt"><h3>${icona('edificio')} Dati dell'azienda</h3></div><div class="cp">
        <p class="pic" style="margin-bottom:12px">Compaiono su preventivi, rapportini, documenti di vendita e nelle email.</p>
        <div class="ges-form-g">${campo('nome', 'Nome')}${campo('ragioneSociale', 'Ragione sociale')}${campo('piva', 'Partita IVA')}${campo('pec', 'PEC', 'email')}${campo('indirizzo', 'Indirizzo', 'text', 'tutta')}${campo('cap', 'CAP')}${campo('citta', 'Città')}${campo('telefono', 'Telefono', 'tel')}${campo('email', 'Email', 'email')}${campo('iban', 'IBAN')}${campo('sito', 'Sito')}</div>${divErr}
      </div><div class="ges-dida" style="display:flex;justify-content:flex-end"><button class="btn pri" type="submit">${icona('spunta')} Salva</button></div></form>
      <div class="ges-col">
        <form class="tessera" data-form="ges-set-tariffe" novalidate><div class="tt"><h3>${icona('euro')} Tariffe</h3>${az.prezziDiEsempio !== false ? A.pastiglia('di esempio', 'warn') : ''}</div><div class="cp">
          ${az.prezziDiEsempio !== false ? `<div class="avviso warn" style="margin-bottom:14px">${icona('attenzione')}<div><b>Prezzi e tariffe sono di esempio.</b> Prima di mostrarli come «di IDRAL» vanno sostituiti con il listino vero.</div></div>` : ''}
          <div class="riga-campi"><div class="campo"><label for="ges-t-m">Manodopera €/h</label><input id="ges-t-m" name="manodopera" type="text" inputmode="decimal" value="${h(numCampo(t.manodopera, 2))}"></div><div class="campo"><label for="ges-t-s">Straordinario €/h</label><input id="ges-t-s" name="straordinario" type="text" inputmode="decimal" value="${h(numCampo(t.straordinario, 2))}"></div><div class="campo"><label for="ges-t-u">Uscita €</label><input id="ges-t-u" name="uscita" type="text" inputmode="decimal" value="${h(numCampo(t.uscita, 2))}"></div></div>
          <label class="spunta"><input type="checkbox" name="veri"${az.prezziDiEsempio === false ? ' checked' : ''}> Sono le tariffe vere di IDRAL</label>
          <p class="pic">Valgono per i nuovi preventivi e per il valore dei lavori da fatturare. IVA esclusa.</p>
        </div><div class="ges-dida" style="display:flex;justify-content:flex-end"><button class="btn pri" type="submit">${icona('spunta')} Salva</button></div></form>
        <form class="tessera" data-form="ges-set-notifiche" novalidate><div class="tt"><h3>${icona('campanella')} Avvisi ai clienti</h3></div><div class="cp">
          <label class="spunta"><input type="checkbox" name="notificheEmail"${az.notificheEmail !== false ? ' checked' : ''}> <span><b>Manda anche un'email</b> quando rispondiamo a un messaggio, aggiorniamo un ordine o carichiamo un documento<br><span class="pic">L'avviso nell'area clienti arriva comunque. Preventivi e inviti partono sempre per email.</span></span></label>
          <div class="riga-campi"><div class="campo"><label for="ges-n-da">Avvisi dalle</label><input id="ges-n-da" name="da" type="time" value="${h((az.fasciaAvvisi || {}).da || '07:30')}"></div><div class="campo"><label for="ges-n-a">alle</label><input id="ges-n-a" name="a" type="time" value="${h((az.fasciaAvvisi || {}).a || '19:30')}"></div></div>
          <p class="pic">Fuori da questa fascia le notifiche ai telefoni aspettano il mattino dopo (nel prodotto vero).</p>
        </div><div class="ges-dida" style="display:flex;justify-content:flex-end"><button class="btn pri" type="submit">${icona('spunta')} Salva</button></div></form>
      </div>
    </div>
    <div class="griglia g2 ges-gr" style="margin-top:16px">
      <div class="tessera"><div class="tt"><h3>${icona('scudo')} Backup</h3><span class="pic">archivio: ${h(A.num(kb, 0))} KB</span></div><div class="cp">
        <p style="font-size:14px;margin-bottom:14px">Scarica tutti i dati in un file e conservalo: con quel file si torna esattamente a oggi. Nel prodotto vero i backup sono automatici, ogni notte.</p>
        <div class="btns"><button class="btn pri" type="button" data-az="ges-backup-scarica">${icona('scarica')} Scarica tutti i dati</button>
          <label class="btn" for="ges-backup-file" style="cursor:pointer">${icona('carica')} Ripristina da un backup</label><input id="ges-backup-file" class="sr" type="file" accept=".json,application/json" data-cambia="ges-backup-file"></div>
        <p class="pic" style="margin-top:10px">Il ripristino sostituisce tutto l'archivio di questo browser con quello del file: prima ti chiediamo conferma.</p>
      </div></div>
      <div class="tessera"><div class="tt"><h3>${icona('ricarica')} Demo</h3></div><div class="cp">
        <p style="font-size:14px;margin-bottom:14px">Cancella tutto quello che è stato inserito in questo browser e riparte dai dati di prova (clienti, interventi, preventivi di esempio).</p>
        <button class="btn per" type="button" data-az="demo-azzera">${icona('ricarica')} Riporta la demo all'inizio</button>
      </div></div>
    </div>`;
    return pagina({ attivo: 'impostazioni', titolo: 'Impostazioni', briciole: [['Azienda', '#/u/persone']], contenuto });
  }
  A.azione('ges-set-azienda', (f, ev, d) => {
    if (d.email && !emailValida(d.email)) return erroreModale('L\'email non sembra giusta.');
    if (d.pec && !emailValida(d.pec)) return erroreModale('La PEC non sembra giusta.');
    A.modifica(db => { ['nome', 'ragioneSociale', 'piva', 'pec', 'indirizzo', 'cap', 'citta', 'telefono', 'email', 'iban', 'sito'].forEach(k => { db.azienda[k] = String(d[k] || '').trim(); }); A.registra('impostazioni', 'dati dell\'azienda'); });
    A.toast('Dati dell\'azienda salvati', 'ok'); A.render();
  });
  A.azione('ges-set-tariffe', (f, ev, d) => {
    const t = { manodopera: numDa(d.manodopera), straordinario: numDa(d.straordinario), uscita: numDa(d.uscita) };
    if (!(t.manodopera > 0)) return A.toast('La tariffa della manodopera non può essere zero', 'per');
    A.modifica(db => { const prima = db.azienda.tariffe; db.azienda.tariffe = t; db.azienda.prezziDiEsempio = !d.veri; A.registra('tariffe cambiate', 'manodopera ' + A.euro(prima.manodopera) + ' → ' + A.euro(t.manodopera) + ', straordinario ' + A.euro(t.straordinario) + ', uscita ' + A.euro(t.uscita)); });
    A.toast('Tariffe salvate', 'ok'); A.render();
  });
  A.azione('ges-set-notifiche', (f, ev, d) => {
    A.modifica(db => { db.azienda.notificheEmail = !!d.notificheEmail; db.azienda.fasciaAvvisi = { da: d.da || '07:30', a: d.a || '19:30' }; A.registra('impostazioni', 'avvisi ai clienti: email ' + (d.notificheEmail ? 'sì' : 'no') + ', ' + d.da + '–' + d.a); });
    A.toast('Salvato', 'ok'); A.render();
  });
  A.azione('ges-backup-scarica', () => {
    A.modifica(() => A.registra('backup scaricato', 'tutti i dati'));
    A.scarica('idral-backup-' + A.oggi() + '.json', JSON.stringify(A.DB, null, 1), 'application/json');
    A.toast('Backup scaricato', 'ok');
  });
  A.azione('ges-backup-file', el => {
    const f = el.files && el.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = async () => {
      el.value = '';
      let nuovo = null;
      try { nuovo = JSON.parse(r.result); } catch (_) { return A.toast('Il file non è un backup valido (non è JSON)', 'per', 4500); }
      const ok = nuovo && nuovo.versione === 1 && nuovo.azienda && ['utenti', 'clienti', 'interventi', 'movimenti', 'articoli'].every(k => Array.isArray(nuovo[k]));
      if (!ok) return A.toast('Il file non è un backup del gestionale IDRAL', 'per', 4500);
      if (!await A.conferma('Tutto l\'archivio di questo browser viene sostituito con il backup del <b>' + h(A.dataOra(nuovo.aggiornato || nuovo.creato)) + '</b> (' + plurale(nuovo.clienti.length, 'cliente', 'clienti') + ', ' + plurale(nuovo.interventi.length, 'intervento', 'interventi') + '). Quello che c\'è adesso si perde.', { ok: 'Ripristina', pericolo: true, titolo: 'Ripristinare il backup?' })) return;
      ['coda', 'codaApplicate', 'avvisi', 'email', 'registro', 'link', 'contratti', 'allegati', 'conversazioni', 'ordini', 'richiesteMateriale', 'note', 'richieste', 'documenti', 'preventivi', 'fornitori', 'magazzini', 'sedi', 'impianti'].forEach(k => { if (!Array.isArray(nuovo[k])) nuovo[k] = []; });
      nuovo.contatori = nuovo.contatori || {};
      A.modifica(db => { Object.keys(db).forEach(k => { delete db[k]; }); Object.assign(db, nuovo); if (A.utente()) A.registra('backup ripristinato', 'archivio sostituito dal file ' + f.name); });
      A.toast('Backup ripristinato', 'ok');
      A.vai(A.utente() ? '#/u/impostazioni' : '#/accesso');
    };
    r.readAsText(f);
  });

  rotta('#/u/persone', paginaPersone);
  rotta('#/u/posta', paginaPosta);
  rotta('#/u/registro', paginaRegistro);
  rotta('#/u/impostazioni', paginaImpostazioni);

  // ==== FINE ====
})();
