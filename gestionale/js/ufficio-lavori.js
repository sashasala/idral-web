/* =============================================================================
   IDRAL — gestionale (demo) · il back-office del LAVORO (titolare e ufficio)
   -----------------------------------------------------------------------------
   Il «centro di controllo» di Andrea: cosa succede oggi, cosa aspetta lui,
   quanto lavoro fatto non e' ancora diventato un documento di vendita.

   Rotte: #/u/cruscotto · #/u/richieste · #/u/pianificazione · #/u/interventi ·
          #/u/intervento/:id · #/u/intervento/:id/stampa · #/u/rapportini ·
          #/u/mappa (+ #/u/rapportino/:id, alias usato negli avvisi)
   Esporta: A.apriNuovoIntervento(prefill, onCreato) — la usa anche
            ufficio-gestione.js (scheda cliente, preventivo accettato, manutenzioni).

   Regole che qui si vedono di piu' (prompt master OPERA v1.2):
   - nessuna classifica fra tecnici: il confronto si fa per TIPO di lavoro;
   - la mappa mostra i luoghi dei lavori, mai dove sono le persone;
   - le foto nascono chiuse al cliente e le apre l'ufficio, una per una;
   - OPERA non emette fatture: il lavoro approvato va in «Da fatturare»
     (documento di vendita), e da li' al commercialista.
   Qui i prezzi si vedono: e' il back-office. Il tecnico non arriva mai su
   queste rotte (il router lo rimanda alla sua giornata).
   ============================================================================= */
(function () {
  'use strict';
  const { h, icona } = A;

  // ---------------------------------------------------------------------------
  // Vocabolario del modulo
  // ---------------------------------------------------------------------------
  // «Fatto» dal punto di vista del campo: il tecnico ha chiuso e inviato.
  const FATTI = ['completato', 'approvato', 'valorizzato', 'fatturato'];
  const IN_CAMPO = ['in_viaggio', 'in_corso', 'sospeso'];
  const APERTI = ['da_pianificare', 'pianificato', 'in_viaggio', 'in_corso', 'sospeso'];
  // Si trascinano solo i lavori non ancora partiti: spostare un lavoro in
  // corso sul calendario non sposta il tecnico che ci sta lavorando.
  const SPOSTABILI = ['da_pianificare', 'pianificato'];
  const DURATE = [30, 45, 60, 75, 90, 120, 150, 180, 240, 300, 360, 480];
  const MODALITA = { misura: 'A misura', corpo: 'A corpo', garanzia: 'In garanzia', contratto: 'A contratto' };
  const ORIGINI = { ufficio: 'Ufficio', telefono: 'Telefono', portale: 'Area clienti', sito: 'Sito', ricorrente: 'Manutenzione ricorrente', preventivo: 'Da preventivo' };
  const ICONA_TIPO = { riparazione: 'chiave', manutenzione: 'ingranaggio', installazione: 'pacco', sopralluogo: 'occhio', emergenza: 'fulmine', collaudo: 'verifica' };
  const TIPI_RIC = { guasto: 'Guasto', intervento: 'Intervento', sopralluogo: 'Sopralluogo', preventivo: 'Preventivo' };
  const URG_RIC = { urgente: ['Urgente', 'dang'], questa_settimana: ['Questa settimana', 'warn'], quando_potete: ['Quando potete', 'grigio'] };
  const URG_MAT = { normale: ['Normale', 'grigio'], urgente: ['Urgente', 'acc'], blocca_lavoro: ['Blocca il lavoro', 'dang'] };
  const STATI_MAT = { nuova: ['Da vedere', 'blu'], presa: ['Presa in carico', 'blu'], ordinata: ['Ordinata', 'acc'], arrivata: ['Arrivata', 'ok'], rifiutata: ['Non ordinata', 'grigio'] };
  const DEPOSITO = { lat: 38.0870, lng: 13.3380, nome: 'Deposito IDRAL — Via Villagrazia' };
  const LEAFLET = {
    css: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', cssSri: 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=',
    js: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', jsSri: 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='
  };

  // ---------------------------------------------------------------------------
  // Piccoli attrezzi
  // ---------------------------------------------------------------------------
  const cap = s => s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '';
  const taglia = (s, n) => { s = String(s || '').trim().replace(/\s+/g, ' '); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const minDa = o => { if (!o) return null; const [hh, mm] = String(o).split(':').map(Number); return (hh || 0) * 60 + (mm || 0); };
  const oraDa = m => A.pad(Math.floor(m / 60)) + ':' + A.pad(m % 60);
  const nomeCli = i => (A.cliente(i.clienteId) || {}).nome || 'Cliente';
  const nomeTipo = t => A.TIPI_INTERVENTO[t] || t || '';
  /** 90 -> '1h30', 60 -> '1h', 45 -> '45 min': sta in una carta larga cento pixel. */
  const durataBreve = m => { m = Math.round(Number(m) || 0); const hh = Math.floor(m / 60), mm = m % 60; return hh ? hh + 'h' + (mm ? A.pad(mm) : '') : mm + ' min'; };
  const perOra = (a, b) => (a.ora || '99:99').localeCompare(b.ora || '99:99') || String(a.numero).localeCompare(String(b.numero));
  const telLink = t => 'tel:' + String(t || '').replace(/[^\d+]/g, '');
  const linkAssoluto = hash => location.origin + location.pathname + hash;
  const esiste = id => !!A.intervento(id);
  /** Il colore del tecnico arriva dall'archivio: lo si controlla prima di metterlo in uno style. */
  function coloreDi(u) { const c = u && u.colore; return /^#[0-9a-f]{3,8}$/i.test(c || '') ? c : '#5C7787'; }
  function avatarTec(id, cl) {
    const u = A.utenteDa(id);
    return `<span class="avatar uff-av ${cl || ''}" style="background:${coloreDi(u)}" title="${h(u ? u.nome : '')}" aria-hidden="true">${h(A.iniziali(u ? u.nome : '?'))}</span>`;
  }
  function tecniciHtml(ids, max) {
    ids = ids || [];
    if (!ids.length) return '<span class="muto">da assegnare</span>';
    return `<span class="uff-tecs">${ids.slice(0, max || 3).map(t => avatarTec(t, 'pic')).join('')}<span class="uff-tecs-n">${h(ids.map(t => A.nomeBreve((A.utenteDa(t) || {}).nome || '?')).join(', '))}</span></span>`;
  }
  /** 'oggi' · 'domani' · 'ieri' · 'giovedì 1 ottobre': come lo direbbe Laura al telefono. */
  function giornoParlato(iso) {
    if (!iso) return 'da pianificare';
    const d = A.diffGiorni(A.oggi(), iso);
    return d === 0 ? 'oggi' : d === 1 ? 'domani' : d === -1 ? 'ieri' : A.dataLunga(iso);
  }
  /** Settimana del lunedi' ISO: '22–28 set' oppure '29 set – 5 ott'. */
  function nomeSettimana(lun) {
    const fine = A.piuGiorni(lun, 6); const a = A.daGiorno(lun), b = A.daGiorno(fine);
    return a.getMonth() === b.getMonth() ? a.getDate() + '–' + b.getDate() + ' ' + A.MESI_BREVI[b.getMonth()] : A.dataBreve(lun) + ' – ' + A.dataBreve(fine);
  }
  function fineMese(iso) { const d = A.daGiorno(iso); return A.isoGiorno(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
  function periodo(p) {
    const o = A.oggi();
    if (p === 'settimana') { const l = A.lunedi(o); return [l, A.piuGiorni(l, 6)]; }
    if (p === 'mese') return [o.slice(0, 8) + '01', fineMese(o)];
    if (p === 'oggi') return [o, o];
    return [null, null];
  }
  const NOMI_PERIODO = { oggi: 'oggi', settimana: 'questa settimana', mese: 'questo mese' };

  /** Cambio di stato con la sua riga di storico: nessuno stato cambia senza lasciare traccia. */
  function passaA(i, stato, nota) {
    const u = A.utente();
    i.stato = stato;
    const r = { stato, data: A.adesso(), utenteId: u ? u.id : null };
    if (nota) r.nota = nota;
    (i.storico = i.storico || []).push(r);
  }
  /** Valore a listino, anche per i lavori in garanzia o a contratto (che al cliente valgono zero). */
  function valoreListino(i) { const v = A.valoreIntervento(i); return v.manodopera + v.uscita + v.materiali; }
  function prezzoRiga(m) { const a = m.articoloId ? A.articolo(m.articoloId) : null; return m.prezzo !== undefined ? Number(m.prezzo) || 0 : a ? a.prezzo : 0; }

  // ---------------------------------------------------------------------------
  // Agenda: sovrapposizioni e prima ora libera
  // ---------------------------------------------------------------------------
  /**
   * Due lavori dello stesso tecnico che si accavallano nello stesso giorno.
   * Ritorna Map(id -> [id degli altri]). Senza ora non si puo' dire: niente
   * falso allarme (il calendario lo segnala come «senza ora»).
   */
  function conflitti() {
    const per = {};
    A.DB.interventi.forEach(i => {
      if (i.stato === 'annullato' || !i.data || !i.ora) return;
      (i.tecnici || []).forEach(t => { (per[t + '|' + i.data] = per[t + '|' + i.data] || []).push(i); });
    });
    const out = new Map();
    const segna = (a, b) => { if (!out.has(a.id)) out.set(a.id, []); if (!out.get(a.id).includes(b.id)) out.get(a.id).push(b.id); };
    Object.values(per).forEach(lista => {
      for (let x = 0; x < lista.length; x++) for (let y = x + 1; y < lista.length; y++) {
        const a = lista[x], b = lista[y];
        const a0 = minDa(a.ora), a1 = a0 + (Number(a.durataMin) || 60), b0 = minDa(b.ora), b1 = b0 + (Number(b.durataMin) || 60);
        if (a0 < b1 && b0 < a1) { segna(a, b); segna(b, a); }
      }
    });
    return out;
  }
  /** La prima mezz'ora libera dalle 8:00 in cui il lavoro ci sta tutto. */
  function primaOraLibera(tecId, giorno, durata, escludiId) {
    durata = Number(durata) || 60;
    const occ = A.DB.interventi.filter(x => x.id !== escludiId && x.stato !== 'annullato' && x.data === giorno && x.ora && (x.tecnici || []).includes(tecId))
      .map(x => [minDa(x.ora), minDa(x.ora) + (Number(x.durataMin) || 60)]);
    for (let t = 8 * 60; t + durata <= 19 * 60; t += 30) if (!occ.some(([a, b]) => t < b && a < t + durata)) return oraDa(t);
    // Giornata piena: in coda all'ultimo lavoro. Il calendario lo mostrera' comunque pieno.
    const fine = Math.max(8 * 60, ...occ.map(o => o[1]));
    return oraDa(Math.min(23 * 60 + 30, Math.ceil(fine / 30) * 30));
  }

  /**
   * Avvisi ai tecnici dopo un cambio di data, ora o squadra. Dentro A.modifica.
   * Ritorna gli id degli avvisi creati (servono all'«Annulla» del calendario).
   */
  function avvisaCambi(db, i, prima) {
    const ids = [];
    const dopoT = i.stato === 'annullato' ? [] : (i.tecnici || []), primaT = prima.tecnici || [];
    const pian = !!i.data && i.stato !== 'da_pianificare' && i.stato !== 'annullato';
    const quando = giornoParlato(i.data) + (i.ora ? ' alle ' + i.ora : '');
    const cosa = nomeCli(i) + ' — ' + nomeTipo(i.tipo).toLowerCase();
    const manda = (t, testo, link) => { A.avvisa(t, testo, link, { tipo: 'assegnazione' }); ids.push(db.avvisi[0].id); };
    if (pian) dopoT.forEach(t => {
      if (!primaT.includes(t) || !prima.data) manda(t, 'Nuovo lavoro ' + quando + ': ' + cosa, '#/t/lavoro/' + i.id);
      else if (prima.data !== i.data || (prima.ora || '') !== (i.ora || '')) manda(t, 'Lavoro spostato: ' + cosa + ', ora ' + quando, '#/t/lavoro/' + i.id);
    });
    if (prima.data) primaT.filter(t => !pian || !dopoT.includes(t)).forEach(t => manda(t, 'Lavoro tolto dalla tua agenda: ' + cosa + ' (era ' + giornoParlato(prima.data) + ')', '#/t/oggi'));
    return ids;
  }

  // ---------------------------------------------------------------------------
  // Rapportini: le anomalie che l'ufficio deve vedere prima di approvare
  // ---------------------------------------------------------------------------
  /** Minuti medi di lavoro (lavoro + straordinario) per tipo di intervento. */
  function medieLavoro() {
    const s = {}, n = {};
    A.DB.interventi.forEach(i => {
      if (!i.rapporto || !FATTI.includes(i.stato)) return;
      const m = A.minutiIntervento(i); const l = m.lavoro + m.straordinario;
      if (!l) return;
      s[i.tipo] = (s[i.tipo] || 0) + l; n[i.tipo] = (n[i.tipo] || 0) + 1;
    });
    const out = {}; Object.keys(s).forEach(k => { if (n[k] >= 3) out[k] = s[k] / n[k]; });
    return out;
  }
  function anomalie(i, medie) {
    const r = i.rapporto || {}; const out = [];
    const f = r.firma;
    if (!f || f.assente || !f.png) out.push({ k: 'firma', t: f && f.assente ? 'Firma assente — cliente non presente' : 'Firma assente', tono: 'dang', ic: 'penna' });
    const m = A.minutiIntervento(i); const lav = m.lavoro + m.straordinario; const med = (medie || {})[i.tipo];
    // 1,8 volte la media: sotto e' normale variabilita' (una caldaia vecchia, un
    // condominio senza portiere); sopra, vale la pena di chiedere perche'.
    if (med && lav > med * 1.8) out.push({ k: 'ore', t: 'Ore fuori norma: ' + A.durata(lav) + ' contro una media di ' + A.durata(med), tono: 'warn', ic: 'orologio' });
    if (!(r.foto || []).length) out.push({ k: 'foto', t: 'Nessuna foto', tono: 'warn', ic: 'fotocamera' });
    if (!r.esito) out.push({ k: 'esito', t: 'Esito non indicato', tono: 'warn', ic: 'attenzione' });
    else if (r.esito !== 'risolto') out.push({ k: 'esito', t: 'Esito: ' + (A.ESITI[r.esito] || r.esito).toLowerCase(), tono: r.esito === 'non_eseguibile' ? 'dang' : 'warn', ic: 'attenzione' });
    if (r.secondoIntervento) out.push({ k: 'secondo', t: 'Serve un secondo intervento', tono: 'acc', ic: 'calendario' });
    return out;
  }
  function chipAnomalie(lista) {
    if (!lista.length) return `<span class="uff-chip ok">${icona('spunta', 'p')}Nessuna anomalia</span>`;
    return lista.map(a => `<span class="uff-chip ${a.tono}">${icona(a.ic, 'p')}${h(a.t)}</span>`).join('');
  }
  const daApprovare = () => A.DB.interventi.filter(i => i.stato === 'completato' && i.rapporto && i.rapporto.stato === 'inviato');

  // ---------------------------------------------------------------------------
  // Stile del modulo (una volta sola)
  // ---------------------------------------------------------------------------
  function stile() {
    if (document.getElementById('stile-uff')) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="stile-uff">
/* --- comuni --- */
.uff-av{width:26px;height:26px;flex:0 0 26px;font-size:10.5px;box-shadow:0 0 0 2px var(--surface)}
.uff-av.pic{width:22px;height:22px;flex-basis:22px;font-size:9.5px}
.uff-av.g{width:36px;height:36px;flex-basis:36px;font-size:13px}
.uff-tecs{display:inline-flex;align-items:center;gap:0;min-width:0}
.uff-tecs .uff-av+.uff-av{margin-left:-6px}
.uff-tecs-n{margin-left:8px;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.uff-pp{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
/* Nelle griglie la regola generale «.tessera+.tessera{margin-top}» spingerebbe giu' la seconda colonna. */
.uff-gr>.tessera+.tessera,.uff-kpis>.tessera+.tessera,.uff-rap-g>.tessera+.tessera,.uff-rics>.tessera+.tessera,.uff-giri>.tessera+.tessera{margin-top:0}
/* .btn.pic rimette il colore del testo a «inherit»: sui bottoni pieni il testo deve restare bianco. */
.btn.pic.ok,.btn.pic.pri,.btn.pic.acc{color:#fff}
.btn.pic.per{color:var(--dang)}
.uff-gr-campo{grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)}
@media(max-width:1100px){.uff-gr-campo{grid-template-columns:minmax(0,1fr)}}
.uff-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:8px;font-size:12.5px;font-weight:650;border:1px solid var(--line);background:var(--bg);color:var(--ink-2);line-height:1.35}
.uff-chip.dang{background:var(--dang-50);border-color:var(--dang-line);color:var(--dang)}
.uff-chip.warn{background:var(--warn-50);border-color:var(--warn-line);color:var(--warn)}
.uff-chip.acc{background:var(--accent-50);border-color:#F6D2B4;color:var(--accent-dark)}
.uff-chip.ok{background:var(--ok-50);border-color:var(--ok-line);color:var(--ok)}
.uff-chips{display:flex;gap:6px;flex-wrap:wrap}
.uff-sez-t{font-size:11.5px;font-weight:750;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-3);margin:0 0 8px}
.uff-num{font-variant-numeric:tabular-nums}
.uff-solo-stretto{display:none}
@media(max-width:760px){.uff-solo-largo{display:none!important}.uff-solo-stretto{display:block}}
.bo .testa .btns .uff-nt{display:inline}
@media(max-width:760px){.bo .testa .btns .uff-nt{display:none}.bo .testa .btns .btn{padding:8px 10px}}
.uff-toast-annulla{border:0;background:rgba(255,255,255,.18);color:#fff;font-weight:750;border-radius:8px;padding:5px 11px;margin-left:6px;cursor:pointer;font-size:13.5px}
.uff-toast-annulla:hover{background:rgba(255,255,255,.3)}
.uff-seg{display:inline-flex;background:var(--bg-2);border-radius:11px;padding:3px;gap:2px}
.uff-seg a,.uff-seg button{padding:7px 14px;border-radius:8px;font-size:13.5px;font-weight:650;color:var(--ink-2);text-decoration:none!important;border:0;background:none;cursor:pointer;white-space:nowrap}
.uff-seg a.on,.uff-seg button.on{background:var(--surface);color:var(--brand-700);box-shadow:var(--sh-1)}
.uff-conta{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 6px;border-radius:99px;background:var(--bg-2);color:var(--ink-2);font-size:11.5px;font-weight:750;font-variant-numeric:tabular-nums}
.schede .on .uff-conta{background:var(--brand-50);color:var(--brand-700)}
.uff-conta.acc{background:var(--accent);color:#fff}

/* --- cruscotto --- */
.uff-saluto h2{font-size:22px;letter-spacing:-.02em}
.uff-saluto p{color:var(--ink-3);font-size:14px;margin-top:2px}
.uff-kpis{display:grid;grid-template-columns:minmax(0,1.4fr) repeat(3,minmax(0,1fr));gap:14px;margin-bottom:18px}
.uff-kpis .uff-eroe{grid-row:span 2}
@media(max-width:1180px){.uff-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.uff-kpis .uff-eroe{grid-column:1/-1;grid-row:auto}}
@media(max-width:760px){.uff-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}}
a.uff-kpi{display:flex;flex-direction:column;padding:16px 18px;min-height:124px;position:relative}
.uff-kpi .uff-kl{display:flex;align-items:flex-start;gap:8px;font-size:13px;font-weight:650;color:var(--ink-2);line-height:1.3;min-height:2.6em;padding-right:14px}
.uff-kpi .uff-kl svg{margin-top:-1px}
.uff-kpi .uff-kl svg{color:var(--brand-500)}
.uff-kpi .v{font-size:30px;font-weight:780;letter-spacing:-.03em;line-height:1.1;margin-top:8px;font-variant-numeric:normal}
.uff-kpi .v small{font-size:15px;font-weight:650;color:var(--ink-3);letter-spacing:0}
.uff-kpi .d{font-size:12.5px;color:var(--ink-3);margin-top:auto;padding-top:8px;line-height:1.4}
.uff-kpi .d b{color:var(--ink-2);font-weight:650}
.uff-kpi.attn::after{content:"";position:absolute;top:16px;right:16px;width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 3px var(--accent-50)}
.uff-kpi.evid{padding:22px 24px;background:radial-gradient(420px 220px at 100% 0%,rgba(234,106,12,.22),transparent 65%),linear-gradient(150deg,var(--brand-800),var(--brand-600))}
.uff-kpi.evid .uff-kl{color:rgba(255,255,255,.85);font-size:14px;min-height:0}
.uff-kpi.evid .uff-kl svg{color:#FFB27A}
.uff-kpi.evid .v{font-size:50px;color:#fff;margin-top:10px}
.uff-kpi.evid .d{color:rgba(255,255,255,.75)}
.uff-kpi.evid .d b{color:#fff}
.uff-eroe-dett{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.14)}
.uff-eroe-dett div{font-size:12.5px;color:rgba(255,255,255,.7)}
.uff-eroe-dett b{display:block;font-size:17px;color:#fff;font-weight:700;margin-top:1px}
.uff-eroe-cta{display:inline-flex;align-items:center;gap:6px;margin-top:14px;font-weight:700;font-size:13.5px;color:#FFB27A}
@media(max-width:760px){.uff-kpi .v{font-size:25px;margin-top:4px}.uff-kpi.evid .v{font-size:40px}a.uff-kpi{min-height:0;padding:14px}.uff-kpi .uff-kl{font-size:12.5px;min-height:3.9em}.uff-kpi.evid .uff-kl{min-height:0}}
/* da fare adesso */
.uff-fare{list-style:none}
.uff-fare li{display:flex;align-items:center;gap:12px;padding:0 18px 0 0;border-bottom:1px solid var(--line-2);position:relative}
.uff-fare li:last-child{border-bottom:0}
.uff-fare li::before{content:"";position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:0 3px 3px 0;background:var(--line)}
.uff-fare li.l0::before{background:var(--dang)}
.uff-fare li.l1::before{background:var(--accent)}
.uff-fare li.l2::before{background:var(--brand-500)}
.uff-fare a.uff-fare-a{flex:1;min-width:0;display:flex;align-items:center;gap:12px;padding:12px 0 12px 18px;color:inherit;text-decoration:none!important}
.uff-fare a.uff-fare-a:hover .uff-fare-t{color:var(--brand-600)}
.uff-fare .uff-ic{width:36px;height:36px;flex:0 0 36px;border-radius:10px;display:grid;place-items:center;background:var(--brand-50);color:var(--brand-600)}
.uff-fare .l0 .uff-ic{background:var(--dang-50);color:var(--dang)}
.uff-fare .l1 .uff-ic{background:var(--accent-50);color:var(--accent-dark)}
.uff-fare .uff-cat{font-size:11px;font-weight:750;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3)}
.uff-fare .uff-fare-t{font-weight:650;font-size:14.5px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.uff-fare .uff-fare-s{font-size:13px;color:var(--ink-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.uff-fare .cx1{flex:1;min-width:0}
.uff-fare .uff-cat-r{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:22px}
.uff-fare .uff-cat{display:block;line-height:1.3}
.uff-fare li{flex-wrap:wrap}
.uff-fare li>.btn{margin:-4px 0 12px 66px}
@media(max-width:600px){.uff-fare .uff-fare-t,.uff-fare .uff-fare-s{white-space:normal}.uff-fare .uff-ic{display:none}.uff-fare li>.btn{margin-left:18px}.uff-fare a.uff-fare-a{padding-right:0}}
/* oggi in campo */
.uff-campo{display:flex;flex-direction:column;gap:16px}
.uff-tec-t{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.uff-tec-t b{font-size:14px}
.uff-tec-t b{display:block;line-height:1.25}
.uff-tappe{list-style:none;margin-left:17px;border-left:2px solid var(--line-2);padding-left:0}
.uff-tappe li{position:relative}
.uff-tappe li::before{content:"";position:absolute;left:-7px;top:13px;width:12px;height:12px;border-radius:50%;background:var(--surface);border:2.5px solid var(--brand-500)}
.uff-tappe li.st-fatto::before{background:var(--ok);border-color:var(--ok)}
.uff-tappe li.st-campo::before{background:var(--accent);border-color:var(--accent);box-shadow:0 0 0 4px var(--accent-50);animation:uff-pulsa 1.8s ease-in-out infinite}
.uff-tappe li.st-sospeso::before{border-color:var(--warn);background:var(--warn-50)}
.uff-tappe li.st-attesa::before{border-color:var(--brand-500)}
@keyframes uff-pulsa{50%{box-shadow:0 0 0 7px rgba(234,106,12,.08)}}
@media (prefers-reduced-motion:reduce){.uff-tappe li.st-campo::before{animation:none}}
.uff-tappe a{display:grid;grid-template-columns:42px minmax(0,1fr);gap:0 8px;align-items:baseline;padding:6px 8px 6px 16px;border-radius:9px;color:inherit;text-decoration:none!important;font-size:13.5px}
.uff-tappe .s{grid-column:2;font-size:12px;color:var(--ink-3);display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:2px}
.uff-tappe .s .pastiglia{font-size:11px;padding:0 7px}
.uff-tappe a:hover{background:var(--brand-50)}
.uff-tappe .o{font-weight:750;font-variant-numeric:tabular-nums}
.uff-tappe .c{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:550}
.uff-tappe .st-fatto .c{color:var(--ink-3)}
/* grafici */
.uff-viz{position:relative}
.uff-viz svg{display:block;overflow:visible}
.uff-g text{font-variant-numeric:tabular-nums}
.uff-g .uff-s1{fill:var(--brand-500)}
.uff-g .uff-s2{fill:var(--accent)}
.uff-g .uff-corr path,.uff-g .uff-corr rect{opacity:.45}
.uff-g .uff-hit{fill:transparent;pointer-events:all;cursor:default;outline:none}
.uff-g.uff-hov .uff-col{opacity:.55;transition:opacity .12s}
.uff-g.uff-hov .uff-col.uff-su{opacity:1}
.uff-g text.uff-val{fill:var(--ink);font-weight:700;font-size:11.5px}
.uff-g text.uff-t-corr{fill:var(--ink-2);font-weight:650}
.uff-tip{position:absolute;z-index:5;pointer-events:none;background:var(--surface);border:1px solid var(--line);border-radius:10px;box-shadow:var(--sh-2);padding:8px 11px;font-size:12.5px;min-width:150px}
.uff-tip-t{font-weight:700;color:var(--ink-2);margin-bottom:4px}
.uff-tip-r{display:flex;align-items:center;gap:8px;padding:1px 0}
.uff-tip-r i{width:12px;height:3px;border-radius:2px;flex:0 0 12px}
.uff-tip-r b{font-variant-numeric:tabular-nums;color:var(--ink);font-size:13px}
.uff-tip-r span{color:var(--ink-3)}
.uff-k1{background:var(--brand-500)}
.uff-k2{background:var(--accent)}
.uff-kc{background:var(--brand-500);opacity:.45}
.legenda i.uff-k1,.legenda i.uff-k2,.legenda i.uff-kc{border-radius:3px}
.uff-numeri{margin-top:10px}
.uff-numeri summary{cursor:pointer;font-size:12.5px;color:var(--ink-3);font-weight:600}
.uff-numeri table{margin-top:8px;font-size:13px}
.uff-numeri .tab td,.uff-numeri .tab th{padding:6px 10px}
.uff-grafico-dida{font-size:12.5px;color:var(--ink-3);margin-top:-6px;margin-bottom:10px}
/* redditivita' */
.uff-redd td:first-child{font-weight:650}
.uff-redd .barra-orizz{width:90px;display:inline-block;vertical-align:middle;margin-right:8px;height:7px}
.uff-redd .barra-orizz>i{background:var(--accent)}
.uff-dida{font-size:13px;color:var(--ink-2);padding:12px 18px;border-top:1px solid var(--line-2);background:var(--bg);border-radius:0 0 var(--r-l) var(--r-l)}

/* --- richieste --- */
.uff-rics{display:grid;gap:14px}
.uff-ric .cp{display:flex;flex-direction:column;gap:12px}
.uff-ric-testa{display:flex;gap:12px;align-items:flex-start}
.uff-ric-ic{width:42px;height:42px;flex:0 0 42px;border-radius:12px;display:grid;place-items:center;background:var(--brand-50);color:var(--brand-600)}
.uff-ric-ic.dang{background:var(--dang-50);color:var(--dang)}
.uff-ric-testa h3{font-size:16px}
.uff-ric-testa .cx1{flex:1;min-width:0}
.uff-ric-descr{font-size:14.5px;line-height:1.5;white-space:pre-wrap;background:var(--bg);border-radius:10px;padding:10px 12px;border:1px solid var(--line-2)}
.uff-recapiti{display:flex;gap:6px 16px;flex-wrap:wrap;font-size:13.5px}
.uff-recapiti a,.uff-recapiti span{display:inline-flex;align-items:center;gap:6px}
.uff-recapiti svg{color:var(--ink-3)}
.uff-mini-foto{display:flex;gap:8px;flex-wrap:wrap}
.uff-mini-foto button{width:72px;height:72px;border-radius:10px;overflow:hidden;border:1px solid var(--line);padding:0;cursor:zoom-in;background:var(--bg-2)}
.uff-mini-foto img{width:100%;height:100%;object-fit:cover;display:block}
.uff-ric-az{display:flex;gap:8px;flex-wrap:wrap;padding:12px 18px;border-top:1px solid var(--line-2);background:var(--bg);border-radius:0 0 var(--r-l) var(--r-l);align-items:center}
.uff-ric-az .esito{flex:1;min-width:200px;font-size:13.5px;color:var(--ink-2)}
.uff-motivi{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.uff-motivi button{border:1px solid var(--line);background:var(--surface);border-radius:99px;padding:5px 12px;font-size:13px;font-weight:600;cursor:pointer;color:var(--ink-2)}
.uff-motivi button:hover{border-color:var(--brand-500);color:var(--brand-700)}

/* --- pianificazione --- */
.uff-plan-wrap{display:grid;grid-template-columns:184px minmax(0,1fr);gap:12px;align-items:start}
@media(max-width:1100px){.uff-plan-wrap{grid-template-columns:minmax(0,1fr)}.uff-plan-wrap .colonna-libera{flex-direction:row;flex-wrap:wrap;min-height:0}.uff-plan-wrap .colonna-libera .carta{flex:1 1 200px;max-width:280px}}
.colonna-libera{position:sticky;top:76px}
@media(max-width:1100px){.colonna-libera{position:static}}
.colonna-libera .uff-lib-t{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;font-weight:750;color:var(--ink-2);letter-spacing:.02em;width:100%;padding:2px 2px 4px}
.uff-plan{grid-template-columns:104px repeat(var(--gg),minmax(106px,1fr))}
.colonna-libera{padding:8px}
.uff-plan .carta{padding:5px 7px}
.uff-plan .carta .c{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.25}
.plan .ph .gg{font-weight:600;color:var(--ink-3)}
.plan .ph.oggi{box-shadow:inset 0 -2.5px 0 var(--accent)}
.plan .ph.oggi .gg{color:var(--accent-dark)}
.plan .ph{display:flex;justify-content:space-between;align-items:baseline;gap:6px}
.plan .ph b{font-size:14px;color:var(--ink)}
.plan .ph.oggi b{color:var(--accent-dark)}
.plan .ph.vuoto{position:sticky;left:0;z-index:3}
.plan .pt{flex-direction:column;align-items:flex-start;justify-content:center;gap:5px;padding:10px 8px}
.plan .pt .cx1{min-width:0;line-height:1.2;font-size:13px}
.plan .pt small{display:block;font-weight:500;font-size:11.5px}
.plan .pc{min-height:104px}
.uff-carico{display:flex;align-items:center;gap:6px;font-size:10.5px;font-weight:700;color:var(--ink-3);letter-spacing:.02em;min-height:14px}
.uff-carico i{flex:1;height:3px;border-radius:9px;background:var(--line-2);overflow:hidden;position:relative;font-style:normal}
.uff-carico i>u{position:absolute;left:0;top:0;bottom:0;background:var(--brand-100);border-radius:9px;text-decoration:none}
.uff-carico.pieno{color:var(--warn)}
.uff-carico.pieno i>u{background:var(--warn-line)}
.carta{position:relative;user-select:none}
.carta[draggable=false]{cursor:pointer}
.carta:focus-visible{outline:2px solid var(--brand-500);outline-offset:1px}
.carta:hover{box-shadow:var(--sh-2)}
.carta .o{display:flex;align-items:center;gap:5px}
.carta .o .uff-dur{font-weight:550;color:var(--ink-3)}
.carta .o svg{margin-left:auto}
.carta.uff-confl{border-top-color:var(--dang);border-right-color:var(--dang);border-bottom-color:var(--dang);box-shadow:0 0 0 1px var(--dang);background:var(--dang-50)}
.carta.uff-confl .o svg{color:var(--dang)}
.carta.uff-campo-c{border-left-color:var(--accent);background:var(--accent-50)}
.carta .uff-st{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:4px;vertical-align:1px;background:var(--brand-500)}
.carta.chiuso .uff-st{background:var(--ok)}
.carta.uff-campo-c .uff-st{background:var(--accent)}
.plan.uff-trascinando .carta:not(.trascina){pointer-events:none}
.plan .pc.sopra,.colonna-libera.sopra{transition:none}
.uff-legenda{display:flex;gap:16px;flex-wrap:wrap;align-items:center;font-size:12.5px;color:var(--ink-2);margin:12px 0 0}
.uff-legenda span{display:inline-flex;align-items:center;gap:6px}
.uff-legenda i{display:inline-block;width:14px;height:12px;border-radius:3px;border:1px solid var(--line);border-left-width:3px;background:var(--surface)}
.uff-sett{font-size:17px;font-weight:720;letter-spacing:-.01em}
.uff-tec-scelte .scelta span{gap:8px}
.uff-tec-scelte .scelta i{width:10px;height:10px;border-radius:50%;display:inline-block}

/* --- elenco interventi --- */
.uff-filtri{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.uff-filtri .cerca{flex:1;min-width:220px;max-width:420px}
.uff-filtri select{width:auto;min-width:150px}
.uff-tab-int td{white-space:nowrap}
.uff-tab-int td.uff-cl{white-space:normal;min-width:220px}
.uff-schede-strette a{padding:10px 11px}
.uff-tab-int .t2{font-size:12.5px;color:var(--ink-3)}
.uff-tab-int .mono{font-size:12.5px}
.uff-el-int li{align-items:flex-start}
.uff-el-int .uff-pp{margin-top:6px}

/* --- scheda intervento --- */
.uff-testata .uff-t-su{padding:18px 22px}
.uff-t-barra{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:12px 22px;border-top:1px solid var(--line-2);background:var(--bg);border-radius:0 0 var(--r-l) var(--r-l)}
.uff-testata .uff-t-1{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.uff-testata .uff-t-num{font-family:var(--mono);font-size:13px;color:var(--ink-3);font-weight:600}
.uff-testata h2{font-size:24px;letter-spacing:-.02em;margin:8px 0 6px}
.uff-testata h2 a{color:inherit}
.uff-t-meta{display:flex;gap:6px 18px;flex-wrap:wrap;font-size:14px;color:var(--ink-2);align-items:center}
.uff-t-meta>span{display:inline-flex;align-items:center;gap:7px}
.uff-t-meta svg{color:var(--ink-3)}
@media(max-width:760px){.uff-testata .uff-t-su{padding:16px}.uff-t-barra{padding:12px 16px}.uff-testata h2{font-size:20px}}
.uff-scheda{margin-top:16px}
.uff-scheda .tessera+.tessera{margin-top:16px}
.uff-colonna{display:flex;flex-direction:column;gap:16px;min-width:0}
.uff-colonna>.tessera+.tessera{margin-top:0}
.uff-testo{font-size:14.5px;line-height:1.55;white-space:pre-wrap}
.uff-blocchi{display:grid;gap:14px}
.uff-blocco h4{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);margin-bottom:4px}
.uff-valore .riga{display:flex;justify-content:space-between;gap:10px;padding:6px 0;font-size:14px}
.uff-valore .riga span:last-child{font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap}
.uff-valore .riga.tot{border-top:1.5px solid var(--line);margin-top:4px;padding-top:10px;font-size:16px;font-weight:750}
.uff-valore .riga.tot span:last-child{font-weight:800}
.uff-valore .riga.sec{color:var(--ink-3);font-size:13.5px}
.uff-valore .riga.marg span:last-child{color:var(--ok)}
.uff-foto-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.uff-foto-g figure{margin:0}
.uff-foto-g .foto{cursor:zoom-in}
.uff-foto-g .foto button{position:absolute;inset:0;border:0;background:none;cursor:zoom-in;width:100%}
.uff-interr{display:flex;align-items:center;gap:9px;font-size:12.5px;font-weight:600;color:var(--ink-2);cursor:pointer;padding:8px 2px 0}
.uff-interr input[type=checkbox]{appearance:none;-webkit-appearance:none;width:34px;height:20px;border-radius:99px;background:var(--line);position:relative;transition:background .15s;flex:0 0 34px;cursor:pointer;margin:0}
.uff-interr input[type=checkbox]::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
.uff-interr input[type=checkbox]:checked{background:var(--ok)}
.uff-interr input[type=checkbox]:checked::after{transform:translateX(14px)}
.uff-interr input[type=checkbox]:focus-visible{outline:2px solid var(--brand-500);outline-offset:2px}
.uff-linea{list-style:none;position:relative;margin-left:6px}
.uff-linea li{position:relative;padding:0 0 14px 22px;border-left:2px solid var(--line-2)}
.uff-linea li:last-child{border-left-color:transparent;padding-bottom:0}
.uff-linea li::before{content:"";position:absolute;left:-7px;top:3px;width:12px;height:12px;border-radius:50%;background:var(--surface);border:2.5px solid var(--brand-500)}
.uff-linea li.ok::before{border-color:var(--ok);background:var(--ok)}
.uff-linea li.dang::before{border-color:var(--dang)}
.uff-linea li.acc::before{border-color:var(--accent)}
.uff-linea b{font-size:14px}
.uff-linea .pic{display:block}
.uff-linea .nota{font-size:13px;color:var(--ink-2);margin-top:2px}
.uff-com{list-style:none}
.uff-com li{padding:12px 0;border-bottom:1px solid var(--line-2);display:flex;gap:10px;align-items:flex-start}
.uff-com li:first-child{padding-top:0}
.uff-com li:last-child{border-bottom:0;padding-bottom:0}
.uff-com .cx1{flex:1;min-width:0}
.uff-com .tx{font-size:14px;line-height:1.45;margin:3px 0 6px;white-space:pre-wrap}
.uff-com li.nonletta .tx{font-weight:550;color:var(--ink)}
.uff-corr-riga{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line-2)}
.uff-corr-riga .inps{display:flex;gap:6px;align-items:center;font-size:13px;color:var(--ink-3)}
.uff-corr-riga input{width:74px;min-height:38px;text-align:right}
.uff-corr-riga .prima{font-size:12px;color:var(--ink-3)}
.uff-grande img{width:100%;max-height:70vh;object-fit:contain;background:var(--bg-2);border-radius:12px;display:block}

/* --- rapportini --- */
.uff-rap-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),1fr));gap:14px}
.uff-rap{display:flex;flex-direction:column}
.uff-rap .cp{flex:1;display:flex;flex-direction:column;gap:12px}
.uff-rap-t{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
.uff-rap-t h3{font-size:16px;line-height:1.25}
.uff-rap-meta{display:flex;gap:8px;align-items:center;font-size:13px;color:var(--ink-2);flex-wrap:wrap}
.uff-cifre{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid var(--line-2);border-radius:10px;overflow:hidden}
.uff-cifre div{padding:8px 10px;border-right:1px solid var(--line-2);min-width:0}
.uff-cifre div:last-child{border-right:0}
.uff-cifre small{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.06em;font-weight:700}
.uff-cifre b{font-size:14px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
.uff-rap .uff-ric-az{margin-top:auto}
.uff-rap.anom{border-color:var(--warn-line)}
.uff-rap.grave{border-color:var(--dang-line)}

@media screen and (max-width:600px){.bo .foglio{padding:20px 14px}.bo .foglio .intesta{flex-direction:column}.bo .foglio img{max-width:100%}}

/* --- mappa --- */
.uff-mappa-g{display:grid;grid-template-columns:minmax(0,1.75fr) minmax(300px,1fr);gap:16px;align-items:start}
@media(max-width:1100px){.uff-mappa-g{grid-template-columns:1fr}}
.uff-mappa-g .mappa{height:560px}
@media(min-width:1101px){.uff-mappa-g>div:first-child{position:sticky;top:76px}}
@media(max-width:760px){.uff-mappa-g .mappa{height:380px}}
.uff-pin{background:none;border:0}
.uff-pin span{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;color:#fff;font:800 12.5px/1 var(--font);border:2.5px solid #fff;box-shadow:0 2px 7px rgba(6,27,39,.45)}
.uff-pin.fatto span{filter:saturate(.55);opacity:.8}
.uff-pin.dep span{border-radius:9px;background:var(--brand-900);width:32px;height:32px}
.uff-pin.dep svg{width:17px;height:17px;stroke:#fff}
.uff-giri{display:flex;flex-direction:column;gap:12px}
.uff-giro .tt{padding:12px 16px}
.uff-giro ol{list-style:none;padding:6px 16px 4px}
.uff-giro li{display:grid;grid-template-columns:24px 44px minmax(0,1fr);gap:8px;align-items:start;padding:7px 0;border-bottom:1px solid var(--line-2);font-size:13.5px}
.uff-giro li:last-child{border-bottom:0}
.uff-giro .n{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:11px;font-weight:800;margin-top:1px}
.uff-giro .o{font-weight:750;font-variant-numeric:tabular-nums}
.uff-giro .c a{font-weight:650;color:var(--ink)}
.uff-giro .c small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.uff-giro .piede{padding:10px 16px 14px}
.uff-privacy{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;color:var(--ink-3);margin-top:10px}
.uff-privacy svg{flex:0 0 auto;margin-top:1px}
.uff-giorno-nav{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.uff-giorno-nav input[type=date]{width:auto;min-width:160px}
.leaflet-popup-content{font-family:var(--font);font-size:13px;line-height:1.45}
.leaflet-popup-content b{font-size:13.5px}

/* --- nuovo intervento --- */
.uff-ni .cerca{position:relative}
.uff-sugg{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:20;background:var(--surface);border:1px solid var(--line);border-radius:12px;box-shadow:var(--sh-2);padding:5px;display:none;max-height:300px;overflow-y:auto}
.uff-sugg.su{display:block}
.uff-ni .cerca .uff-sugg svg{position:static;transform:none;color:var(--ink-3)}
.uff-giorno-r{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.uff-giorno-r input{flex:1 1 150px;width:auto}
.uff-giorno-r .uff-rapide{margin:0}
.uff-sugg button{display:flex;width:100%;text-align:left;gap:10px;align-items:center;border:0;background:none;padding:8px 10px;border-radius:8px;cursor:pointer}
.uff-sugg button:hover,.uff-sugg button.on{background:var(--brand-50)}
.uff-sugg button b{display:block;font-size:14px;font-weight:650}
.uff-sugg button small{display:block}
.uff-sugg .nuovo{border-top:1px solid var(--line-2);border-radius:0 0 8px 8px;color:var(--brand-700);font-weight:650}
.uff-sugg .t{font-size:11px;font-weight:750;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);padding:6px 10px 2px}
.uff-ni .uff-scelto{display:flex;align-items:center;gap:10px;padding:8px 12px;border:1.5px solid var(--ok-line);background:var(--ok-50);border-radius:10px;margin-top:6px;font-size:13.5px;color:var(--ok);font-weight:600}
.uff-ni .scelte .scelta span{min-height:40px;padding:7px 12px;font-size:13.5px}
.uff-ni .scelta.urg input:checked+span{border-color:var(--dang);background:var(--dang-50);color:var(--dang);box-shadow:inset 0 0 0 1px var(--dang)}
.uff-rapide{display:flex;gap:6px;margin-top:6px}
.uff-rapide button{border:1px solid var(--line);background:var(--surface);border-radius:8px;padding:4px 10px;font-size:12.5px;font-weight:650;cursor:pointer;color:var(--ink-2)}
.uff-rapide button:hover{border-color:var(--brand-500);color:var(--brand-700)}
.uff-ni-g{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:0 22px}
@media(max-width:760px){.uff-ni-g{grid-template-columns:1fr}}
</style>`);
  }

  /** Un toast con «Annulla»: nel calendario uno spostamento sbagliato si rimedia con un tocco. */
  function toastAnnulla(msg, fn) {
    let c = A.$('#toast'); if (!c) { c = document.createElement('div'); c.id = 'toast'; document.body.appendChild(c); }
    const t = document.createElement('div');
    t.className = 'toast ok';
    t.innerHTML = icona('spunta') + '<span>' + h(msg) + '</span><button type="button" class="uff-toast-annulla">Annulla</button>';
    t.querySelector('button').addEventListener('click', () => { t.remove(); fn(); });
    c.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, 7000);
  }

  /** Chi apre la pagina a cui un avviso rimanda l'ha letto: niente «segna come letto» da cliccare. */
  function segnaLettiQui() {
    const qui = location.hash.split('?')[0];
    const miei = A.mieiAvvisi().filter(a => !a.letto && a.link && a.link.split('?')[0] === qui).map(a => a.id);
    if (miei.length) A.modifica(db => db.avvisi.forEach(a => { if (miei.includes(a.id)) a.letto = true; }));
  }

  /** Guscio + stile: tutte le pagine del modulo passano da qui. */
  function pagina(o) { stile(); return A.guscioUfficio(o); }
  const bottoneNuovo = () => `<button class="btn acc" type="button" data-az="uff-nuovo">${icona('piu')}<span class="uff-nt">Nuovo intervento</span></button>`;
  A.azione('uff-nuovo', () => A.apriNuovoIntervento({}));

  // ===========================================================================
  // 1. CRUSCOTTO
  // ===========================================================================
  /** Cosa aspetta qualcuno, in un solo elenco, dal piu' urgente. */
  function daFareAdesso() {
    const db = A.DB; const out = [];
    const medie = medieLavoro();
    db.richieste.filter(r => r.stato === 'nuova').forEach(r => {
      const liv = r.urgenza === 'urgente' ? 0 : r.urgenza === 'questa_settimana' ? 2 : 3;
      const c = r.clienteId ? A.cliente(r.clienteId) : null;
      out.push({ liv, data: r.data, ic: 'arrivo', cat: r.origine === 'sito' ? 'Richiesta dal sito' : 'Richiesta dall\'area clienti', t: (c ? c.nome : r.nome) + ' — ' + (TIPI_RIC[r.tipo] || r.tipo).toLowerCase(), s: taglia(r.descrizione, 110) + ' · ' + A.quando(r.data), link: '#/u/richieste', pill: URG_RIC[r.urgenza] });
    });
    db.note.filter(n => n.urgente && !n.letta).forEach(n => {
      const i = n.interventoId ? A.intervento(n.interventoId) : null; const t = A.utenteDa(n.autoreId) || {};
      out.push({ liv: 0, data: n.data, ic: 'messaggio', cat: 'Nota urgente dal campo', t: A.nomeBreve(t.nome || 'Tecnico') + (i ? ' — ' + nomeCli(i) : ''), s: taglia(n.testo, 120) + ' · ' + A.quando(n.data), link: i ? '#/u/intervento/' + i.id : '#/u/messaggi', pill: ['Urgente', 'dang'] });
    });
    db.richiesteMateriale.filter(m => m.stato === 'nuova' && (m.urgenza === 'urgente' || m.urgenza === 'blocca_lavoro')).forEach(m => {
      const t = A.utenteDa(m.tecnicoId) || {};
      out.push({ liv: m.urgenza === 'blocca_lavoro' ? 0 : 1, data: m.data, ic: 'carrello', cat: m.urgenza === 'blocca_lavoro' ? 'Materiale che blocca il lavoro' : 'Materiale urgente', t: m.descrizione + ' × ' + A.num(m.qta) + ' ' + (m.unita || ''), s: 'Segnalato da ' + A.nomeBreve(t.nome || 'tecnico') + ' · ' + A.quando(m.data) + (m.note ? ' · ' + taglia(m.note, 70) : ''), link: '#/u/materiale', pill: URG_MAT[m.urgenza] });
    });
    db.preventivi.filter(p => p.stato === 'accettato' && !p.interventoId).forEach(p => {
      const c = A.cliente(p.clienteId) || {};
      out.push({ liv: 1, data: p.decisoIl || p.creato, ic: 'documento', cat: 'Preventivo accettato', t: c.nome + ' — ' + taglia(p.oggetto, 70), s: 'N. ' + p.numero + ' · ' + A.euro(A.totaliPreventivo(p).imponibile, true) + ' + IVA · accettato ' + A.quando(p.decisoIl) + ': va trasformato in intervento', link: '#/u/preventivo/' + p.id, bottone: { testo: 'Crea l\'intervento', az: 'uff-da-prev', id: p.id } });
    });
    daApprovare().forEach(i => {
      const an = anomalie(i, medie).filter(a => a.k === 'firma' || a.k === 'esito' || a.k === 'secondo');
      if (!an.length) return;
      out.push({ liv: 2, data: i.rapporto.inviatoIl, ic: 'verifica', cat: 'Rapportino da guardare', t: nomeCli(i) + ' — ' + nomeTipo(i.tipo).toLowerCase(), s: an.map(a => a.t).join(' · ') + ' · ' + A.nomeBreve(A.nomeTecnici(i.tecnici)), link: '#/u/intervento/' + i.id });
    });
    db.interventi.filter(i => i.stato === 'da_pianificare').forEach(i => {
      const liv = i.priorita === 'urgente' ? 0 : i.priorita === 'alta' ? 1 : 3;
      out.push({ liv, data: i.creato, ic: 'calendario', cat: 'Da pianificare', t: nomeCli(i) + ' — ' + nomeTipo(i.tipo).toLowerCase(), s: taglia(i.richiesta, 100) + ' · arrivato ' + A.quando(i.creato), link: '#/u/pianificazione', pill: i.priorita === 'urgente' || i.priorita === 'alta' ? A.PRIORITA[i.priorita] : null });
    });
    // Dentro lo stesso livello, il piu' vecchio prima: e' quello che aspetta da piu' tempo.
    return out.sort((a, b) => a.liv - b.liv || String(a.data).localeCompare(String(b.data)));
  }

  function tileKpi(o) {
    return `<a class="tessera kpi uff-kpi ${o.cl || ''}" href="${o.link}">
      <div class="uff-kl">${icona(o.ic)}${h(o.l)}</div>
      <div class="v">${o.v}</div>
      ${o.d ? `<div class="d">${o.d}</div>` : ''}${o.extra || ''}
    </a>`;
  }

  function paginaCruscotto(par) {
    const db = A.DB; const oggi = A.oggi(); const u = A.utente();
    const p = ['oggi', 'settimana', 'mese'].includes(par.q.p) ? par.q.p : 'oggi';
    const [da, a] = periodo(p);
    const nelPeriodo = db.interventi.filter(i => i.data && i.data >= da && i.data <= a && i.stato !== 'annullato');
    const chiusi = nelPeriodo.filter(i => FATTI.includes(i.stato)).length;
    const inCorso = nelPeriodo.filter(i => IN_CAMPO.includes(i.stato)).length;
    const daIniziare = nelPeriodo.filter(i => i.stato === 'pianificato' || i.stato === 'da_pianificare').length;
    // Il numero piu' importante: lavoro fatto, approvato, che non e' ancora in un documento di vendita.
    const nonFatt = db.interventi.filter(i => i.stato === 'approvato' && i.tipo !== 'sopralluogo' && !i.documentoId);
    let totNF = 0, manoNF = 0, matNF = 0;
    nonFatt.forEach(i => { const v = A.valoreIntervento(i); totNF += v.totale; if (!v.gratuito) { manoNF += v.manodopera + v.uscita; matNF += v.materiali; } });
    const piuVecchio = nonFatt.map(i => i.data).filter(Boolean).sort()[0];
    const fattoPeriodo = nelPeriodo.filter(i => FATTI.includes(i.stato) && i.tipo !== 'sopralluogo').reduce((s, i) => s + A.valoreIntervento(i).totale, 0);
    const clientiNF = new Set(nonFatt.map(i => i.clienteId)).size;
    const daPian = db.interventi.filter(i => i.stato === 'da_pianificare');
    const daPianUrg = daPian.filter(i => i.priorita === 'urgente' || i.priorita === 'alta').length;
    const medie = medieLavoro();
    const rap = daApprovare();
    const rapAnom = rap.filter(i => anomalie(i, medie).some(x => x.k === 'firma' || x.k === 'esito' || x.k === 'ore')).length;
    const prevAttesa = db.preventivi.filter(x => x.stato === 'inviato' || x.stato === 'visto');
    const prevTot = prevAttesa.reduce((s, x) => s + A.totaliPreventivo(x).imponibile, 0);
    const prevScad = prevAttesa.filter(x => x.validoFino && x.validoFino < oggi).length;
    const prevVisti = prevAttesa.filter(x => x.stato === 'visto').length;
    const manut = db.impianti.filter(i => i.prossimaManutenzione && A.diffGiorni(oggi, i.prossimaManutenzione) <= 30);
    const manutScad = manut.filter(i => i.prossimaManutenzione < oggi).length;
    const sotto = db.articoli.filter(x => x.attivo !== false && x.scortaMin > 0 && A.giacenza(x.id) < x.scortaMin);
    const nomePer = { oggi: 'di oggi', settimana: 'della settimana', mese: 'del mese' }[p];

    const kpi = `<div class="uff-kpis">
      ${tileKpi({ cl: 'evid uff-eroe', link: '#/u/documenti', ic: 'euro', l: 'Fatto e non fatturato', v: h(A.euro(totNF, true)),
        d: nonFatt.length ? `<b>${nonFatt.length} ${nonFatt.length === 1 ? 'intervento approvato' : 'interventi approvati'}</b> di ${clientiNF} ${clientiNF === 1 ? 'cliente' : 'clienti'}, non ancora in un documento di vendita. IVA esclusa.` : 'Tutto il lavoro approvato è già in un documento di vendita.',
        extra: `<div class="uff-eroe-dett"><div>Manodopera e uscite<b>${h(A.euro(manoNF, true))}</b></div><div>Materiali<b>${h(A.euro(matNF, true))}</b></div><div>Il più vecchio<b>${piuVecchio ? h(A.diffGiorni(piuVecchio, oggi) + ' giorni fa') : '—'}</b></div><div>Lavoro fatto ${h(NOMI_PERIODO[p])}<b>${h(A.euro(fattoPeriodo, true))}</b></div></div><span class="uff-eroe-cta">Vai a Da fatturare ${icona('avanti', 'p')}</span>` })}
      ${tileKpi({ link: '#/u/interventi?periodo=' + p, ic: 'chiave', l: 'Interventi ' + nomePer, v: String(nelPeriodo.length), d: `<b>${chiusi}</b> chiusi · <b>${inCorso}</b> in corso · <b>${daIniziare}</b> da iniziare` })}
      ${tileKpi({ cl: daPian.length ? 'attn' : '', link: '#/u/pianificazione', ic: 'calendario', l: 'Da pianificare', v: String(daPian.length), d: daPian.length ? (daPianUrg ? `<b>${daPianUrg}</b> con priorità alta o urgente` : 'Nessuno urgente') : 'Tutto in agenda' })}
      ${tileKpi({ cl: rap.length ? 'attn' : '', link: '#/u/rapportini', ic: 'verifica', l: 'Rapportini da approvare', v: String(rap.length), d: rap.length ? (rapAnom ? `<b>${rapAnom}</b> da guardare con attenzione` : 'Nessuna anomalia seria') : 'Coda vuota' })}
      ${tileKpi({ link: '#/u/preventivi', ic: 'documento', l: 'Preventivi in attesa di risposta', v: h(A.euro(prevTot, true)), d: `<b>${prevAttesa.length}</b> inviati${prevVisti ? ` · <b>${prevVisti}</b> già aperti dal cliente` : ''}${prevScad ? ` · <b>${prevScad}</b> scaduti` : ''} · IVA esclusa` })}
      ${tileKpi({ link: '#/u/manutenzioni', ic: 'storico', l: 'Manutenzioni entro 30 giorni', v: String(manut.length), d: manutScad ? `<b>${manutScad}</b> già scadute` : 'Nessuna scaduta' })}
      ${tileKpi({ cl: sotto.length ? 'attn' : '', link: '#/u/magazzino', ic: 'pacco', l: 'Articoli sotto scorta', v: String(sotto.length), d: sotto.length ? h(taglia(sotto.slice(0, 2).map(x => x.nome).join(', '), 70)) + (sotto.length > 2 ? ' e altri' : '') : 'Magazzino in ordine' })}
    </div>`;

    // --- da fare adesso
    const lista = daFareAdesso();
    const tutti = par.q.tutto === '1';
    const vis = tutti ? lista : lista.slice(0, 8);
    const fare = `<div class="tessera">
      <div class="tt"><h2>${icona('fulmine')} Da fare adesso ${lista.length ? `<span class="uff-conta acc">${lista.length}</span>` : ''}</h2><span class="pic uff-solo-largo">dal più urgente</span></div>
      ${lista.length ? `<ul class="uff-fare">${vis.map(x => `<li class="l${x.liv}">
          <a class="uff-fare-a" href="${h(x.link)}"><span class="uff-ic">${icona(x.ic)}</span><span class="cx1"><span class="uff-cat-r"><span class="uff-cat">${h(x.cat)}</span>${x.pill ? A.pastiglia(x.pill[0], x.pill[1]) : ''}</span><span class="uff-fare-t" style="display:block">${h(x.t)}</span><span class="uff-fare-s" style="display:block">${h(x.s)}</span></span></a>
          ${x.bottone ? `<button class="btn pic pri" type="button" data-az="${x.bottone.az}" data-id="${h(x.bottone.id)}">${h(x.bottone.testo)}</button>` : ''}
        </li>`).join('')}</ul>
        ${lista.length > vis.length ? `<div class="cp stretto" style="padding:10px 18px;border-top:1px solid var(--line-2)"><a href="#/u/cruscotto?p=${p}&tutto=1">Mostra tutte (${lista.length})</a></div>` : ''}`
        : A.vuoto('Niente in sospeso', 'Richieste, rapportini, materiale urgente e lavori da pianificare compaiono qui appena arrivano.', 'spunta')}
    </div>`;

    // --- oggi in campo: la giornata di ciascuno, in ordine fisso (niente classifiche)
    const oggiTutti = db.interventi.filter(i => i.data === oggi && i.stato !== 'annullato');
    const campo = `<div class="tessera">
      <div class="tt"><h2>${icona('furgone')} Oggi in campo</h2><a class="btn pic" href="#/u/mappa">${icona('mappa', 'p')} Giro sulla mappa</a></div>
      <div class="cp uff-campo">${A.tecnici().map(t => {
        const sue = oggiTutti.filter(i => (i.tecnici || []).includes(t.id)).sort(perOra);
        const fatte = sue.filter(i => FATTI.includes(i.stato)).length;
        return `<div class="uff-tec"><div class="uff-tec-t">${avatarTec(t.id, 'g')}<div><b>${h(t.nome)}</b><div class="pic">${h(t.squadra || '')}${sue.length ? ' · ' + sue.length + (sue.length === 1 ? ' tappa' : ' tappe') + ', ' + fatte + (fatte === 1 ? ' fatta' : ' fatte') : ''}</div></div></div>
          ${sue.length ? `<ol class="uff-tappe">${sue.map(i => {
            const st = FATTI.includes(i.stato) ? 'st-fatto' : i.stato === 'sospeso' ? 'st-sospeso' : IN_CAMPO.includes(i.stato) ? 'st-campo' : 'st-attesa';
            return `<li class="${st}"><a href="#/u/intervento/${h(i.id)}"><span class="o">${h(i.ora || '—')}</span><span class="c">${h(nomeCli(i))}</span><span class="s">${h(nomeTipo(i.tipo))} ${A.statoIntervento(i.stato)}</span></a></li>`;
          }).join('')}</ol>` : '<p class="pic" style="margin-left:46px">Nessun lavoro oggi.</p>'}</div>`;
      }).join('')}</div>
    </div>`;

    // --- grafici (disegnati dopo, alla larghezza vera del riquadro)
    const w = datiSettimanali();
    const tabNumeri = (righe, intest) => `<details class="uff-numeri"><summary>Vedi i numeri</summary><div class="tab-w"><table class="tab"><thead><tr>${intest.map((x, k) => `<th class="${k ? 'num' : ''}">${h(x)}</th>`).join('')}</tr></thead><tbody>${righe.map(r => `<tr>${r.map((c, k) => `<td class="${k ? 'num' : ''}">${h(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
    const grafici = `<div class="griglia g2 uff-gr" style="margin-top:16px">
      <div class="tessera"><div class="tt"><h2>${icona('grafico')} Interventi chiusi per settimana</h2></div><div class="cp">
        <p class="uff-grafico-dida">Ultime 12 settimane. La colonna chiara è la settimana in corso.</p>
        <div class="uff-viz" id="uff-g-chiusi" style="min-height:230px"></div>
        ${tabNumeri(w.sett.map((s, k) => [nomeSettimana(s) + (k === 11 ? ' (in corso)' : ''), String(w.chiusi[k])]), ['Settimana', 'Interventi chiusi'])}
      </div></div>
      <div class="tessera"><div class="tt"><h2>${icona('euro')} Valore del lavoro fatto per settimana</h2></div><div class="cp">
        <p class="uff-grafico-dida">A listino, IVA esclusa. Esclusi garanzia, contratto e sopralluoghi.</p>
        <div class="uff-viz" id="uff-g-valore" style="min-height:230px"></div>
        <div class="legenda"><span><i class="uff-k1"></i>Manodopera e uscite</span><span><i class="uff-k2"></i>Materiali</span><span><i class="uff-kc"></i>Settimana in corso</span></div>
        ${tabNumeri(w.sett.map((s, k) => [nomeSettimana(s) + (k === 11 ? ' (in corso)' : ''), A.euro(w.mano[k], true), A.euro(w.mat[k], true), A.euro(w.mano[k] + w.mat[k], true)]), ['Settimana', 'Manodopera e uscite', 'Materiali', 'Totale'])}
      </div></div>
    </div>`;

    const contenuto = `
      <div class="intestazione-pagina uff-saluto">
        <div><h2>${h(saluto())}, ${h((u.nome || '').split(' ')[0])}</h2><p>${h(cap(A.dataLunga(oggi)))} · ${oggiTutti.length} ${oggiTutti.length === 1 ? 'lavoro' : 'lavori'} in agenda oggi</p></div>
        <nav class="uff-seg" aria-label="Periodo dei numeri">${['oggi', 'settimana', 'mese'].map(x => `<a href="#/u/cruscotto?p=${x}" class="${x === p ? 'on' : ''}" ${x === p ? 'aria-current="true"' : ''}>${{ oggi: 'Oggi', settimana: 'Settimana', mese: 'Mese' }[x]}</a>`).join('')}</nav>
      </div>
      ${kpi}
      <div class="griglia uff-gr uff-gr-campo">${fare}${campo}</div>
      ${grafici}
      ${redditivita()}`;
    return {
      html: pagina({ attivo: 'cruscotto', titolo: 'Cruscotto', azioni: bottoneNuovo(), contenuto }),
      dopo: disegnaGrafici
    };
  }
  function saluto() { const o = new Date().getHours(); return o < 13 ? 'Buongiorno' : o < 18 ? 'Buon pomeriggio' : 'Buonasera'; }

  // ---- dati dei grafici: le ultime 12 settimane, lunedi' per lunedi'
  function datiSettimanali() {
    const lun0 = A.lunedi(A.oggi());
    const sett = []; for (let k = 11; k >= 0; k--) sett.push(A.piuGiorni(lun0, -7 * k));
    const chiusi = Array(12).fill(0), mano = Array(12).fill(0), mat = Array(12).fill(0);
    A.DB.interventi.forEach(i => {
      if (!i.data || !i.rapporto || !FATTI.includes(i.stato)) return;
      const k = sett.indexOf(A.lunedi(i.data)); if (k < 0) return;
      chiusi[k]++;
      // Garanzia e contratto al cliente valgono zero, e il sopralluogo non si
      // fattura: metterli qui gonfierebbe un valore che non entrera' mai in cassa.
      if (i.tipo === 'sopralluogo' || i.modalita === 'garanzia' || i.modalita === 'contratto') return;
      const v = A.valoreIntervento(i); mano[k] += v.manodopera + v.uscita; mat[k] += v.materiali;
    });
    return { sett, chiusi, mano: mano.map(A.arrot), mat: mat.map(A.arrot) };
  }
  function disegnaGrafici() {
    const b1 = A.$('#uff-g-chiusi'), b2 = A.$('#uff-g-valore');
    if (!b1 && !b2) return;
    const w = datiSettimanali();
    const et = w.sett.map((s, k) => k === 11 ? 'questa' : A.dataBreve(s));
    const titoli = w.sett.map((s, k) => 'Settimana ' + nomeSettimana(s) + (k === 11 ? ' (in corso)' : ''));
    const intero = v => A.num(v, 0);
    const euroK = v => v >= 1000 ? A.num(v / 1000, 1) + 'k €' : A.num(v, 0) + ' €';
    if (b1) colonne(b1, { titolo: 'Interventi chiusi per settimana', etichette: et, titoli, serie: [{ nome: 'Interventi chiusi', cls: 'uff-s1', k: 'uff-k1', valori: w.chiusi }], formato: intero, asse: intero, corrente: 11, etichettate: [10, 11] });
    if (b2) colonne(b2, { titolo: 'Valore del lavoro fatto per settimana', etichette: et, titoli, serie: [{ nome: 'Manodopera e uscite', cls: 'uff-s1', k: 'uff-k1', valori: w.mano }, { nome: 'Materiali', cls: 'uff-s2', k: 'uff-k2', valori: w.mat }], formato: v => A.euro(v, true), asse: euroK, corrente: 11, etichettate: [10] });
  }
  let timerRidisegno = null;
  window.addEventListener('resize', () => { clearTimeout(timerRidisegno); timerRidisegno = setTimeout(disegnaGrafici, 160); });

  /** Passo «tondo» per l'asse: 1, 2, 2,5, 5 per potenze di dieci. */
  function passoBello(v) { if (!(v > 0)) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
  /** Colonna con gli angoli arrotondati solo in cima: la base resta dritta sulla linea dello zero. */
  function colonnaPath(x, y, w, hh, r) {
    r = Math.min(r, hh, w / 2);
    return `M${x},${y + hh}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + hh}Z`;
  }
  /**
   * Istogramma a colonne (anche impilate) disegnato alla larghezza vera del
   * riquadro: con un viewBox fisso, sul telefono le scritte diventerebbero di
   * 6 pixel. Una scala sola (mai due assi), colonne sottili, etichette dirette
   * solo dove servono; il resto sta nel tooltip e nella tabella «Vedi i numeri».
   */
  function colonne(box, cfg) {
    const W = Math.max(280, Math.round(box.clientWidth)), H = 230;
    const m = { s: 46, d: 6, a: 22, b: 28 };
    const pw = W - m.s - m.d, ph = H - m.a - m.b, n = cfg.etichette.length;
    const tot = cfg.etichette.map((_, k) => cfg.serie.reduce((s, se) => s + (se.valori[k] || 0), 0));
    const max = Math.max(1, ...tot);
    const passo = passoBello(max / 4), top = Math.ceil(max / passo) * passo;
    const Y = v => m.a + ph - v / top * ph;
    const band = pw / n, bw = Math.min(24, band * 0.58);
    const salto = band < 44 ? 2 : 1;
    let s = `<svg class="grafico uff-g" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${h(cfg.titolo)}">`;
    for (let v = 0; v <= top + 1e-9; v += passo) {
      const yy = Math.round(Y(v)) + 0.5;
      s += `<line class="${v === 0 ? 'asse' : 'griglia-l'}" x1="${m.s}" x2="${W - m.d}" y1="${yy}" y2="${yy}"/><text x="${m.s - 8}" y="${yy + 4}" text-anchor="end">${h(cfg.asse(v))}</text>`;
    }
    const base = Math.round(Y(0));
    cfg.etichette.forEach((et, k) => {
      const cx = m.s + band * k + band / 2, x = cx - bw / 2;
      const segs = cfg.serie.map(se => ({ cls: se.cls, v: se.valori[k] || 0 })).filter(z => z.v > 0);
      let acc = 0;
      s += `<g class="uff-col${k === cfg.corrente ? ' uff-corr' : ''}" data-i="${k}">`;
      segs.forEach((z, j) => {
        const y0 = j === 0 ? base : Y(acc), y1 = Y(acc + z.v); acc += z.v;
        // 2 px di fondo fra un segmento e l'altro: separa senza disegnare bordi.
        const hh = (y0 - y1) - (j > 0 ? 2 : 0);
        if (hh <= 0.5) return;
        s += j === segs.length - 1 ? `<path class="${z.cls}" d="${colonnaPath(x, y1, bw, hh, 4)}"/>` : `<rect class="${z.cls}" x="${x}" y="${y1}" width="${bw}" height="${hh}"/>`;
      });
      s += '</g>';
      if ((n - 1 - k) % salto === 0) s += `<text x="${cx}" y="${H - m.b + 17}" text-anchor="middle"${k === cfg.corrente ? ' class="uff-t-corr"' : ''}>${h(et)}</text>`;
      if (cfg.etichettate.includes(k) && tot[k] > 0) s += `<text class="uff-val" x="${cx}" y="${Y(tot[k]) - 7}" text-anchor="middle">${h(cfg.formato(tot[k]))}</text>`;
    });
    // Aree sensibili larghe quanto la fascia intera: nessuno deve mirare a una colonna di 20 px.
    cfg.etichette.forEach((et, k) => {
      s += `<rect class="uff-hit" x="${m.s + band * k}" y="${m.a}" width="${band}" height="${ph + m.b}" data-i="${k}" tabindex="0" role="img" aria-label="${h(cfg.titoli[k] + ': ' + cfg.serie.map(se => se.nome + ' ' + cfg.formato(se.valori[k] || 0)).join(', '))}"/>`;
    });
    s += '</svg>';
    box.innerHTML = s + '<div class="uff-tip" hidden></div>';
    const svg = box.querySelector('svg'), tip = box.querySelector('.uff-tip');
    const mostra = k => {
      tip.replaceChildren();
      const t = document.createElement('div'); t.className = 'uff-tip-t'; t.textContent = cfg.titoli[k]; tip.appendChild(t);
      const riga = (colore, val, nome) => {
        const r = document.createElement('div'); r.className = 'uff-tip-r';
        const i = document.createElement('i'); if (colore) i.className = colore; else i.style.background = 'transparent'; r.appendChild(i);
        const b = document.createElement('b'); b.textContent = val; r.appendChild(b);
        const sp = document.createElement('span'); sp.textContent = nome; r.appendChild(sp);
        tip.appendChild(r);
      };
      cfg.serie.slice().reverse().forEach(se => riga(se.k, cfg.formato(se.valori[k] || 0), se.nome));
      if (cfg.serie.length > 1) riga('', cfg.formato(tot[k]), 'in tutto');
      tip.hidden = false;
      svg.classList.add('uff-hov');
      svg.querySelectorAll('.uff-col').forEach(g => g.classList.toggle('uff-su', +g.dataset.i === k));
      const cx = m.s + band * k + band / 2;
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      tip.style.left = Math.max(0, Math.min(W - tw, cx - tw / 2)) + 'px';
      tip.style.top = Math.max(0, Y(tot[k]) - th - 12) + 'px';
    };
    const nascondi = () => { tip.hidden = true; svg.classList.remove('uff-hov'); };
    svg.addEventListener('pointermove', e => { const r = e.target.closest('.uff-hit'); if (r) mostra(+r.dataset.i); else nascondi(); });
    svg.addEventListener('pointerleave', nascondi);
    svg.addEventListener('focusin', e => { const r = e.target.closest('.uff-hit'); if (r) mostra(+r.dataset.i); });
    svg.addEventListener('focusout', nascondi);
  }

  /** Redditivita' per tipo di lavoro: il confronto giusto, fra lavori, non fra persone. */
  function redditivita() {
    const da = A.piuGiorni(A.lunedi(A.oggi()), -77);
    const per = {};
    A.DB.interventi.forEach(i => {
      if (!i.data || i.data < da || !i.rapporto || !FATTI.includes(i.stato)) return;
      const m = A.minutiIntervento(i); const v = A.valoreIntervento(i);
      const x = per[i.tipo] = per[i.tipo] || { n: 0, min: 0, val: 0, mat: 0 };
      x.n++; x.min += m.totale; x.val += v.manodopera + v.uscita + v.materiali; x.mat += v.materiali;
    });
    const tipi = Object.keys(per).sort((a, b) => per[b].n - per[a].n);
    if (!tipi.length) return '';
    const orari = tipi.filter(t => t !== 'sopralluogo' && per[t].min > 0).map(t => [t, per[t].val / (per[t].min / 60)]).sort((a, b) => b[1] - a[1]);
    const dida = orari.length > 1 ? `Il lavoro che rende di più per ogni ora spesa (viaggio compreso) è <b>${h(nomeTipo(orari[0][0]).toLowerCase())}</b> (${h(A.euro(orari[0][1], true))} all'ora); quello che rende di meno è <b>${h(nomeTipo(orari[orari.length - 1][0]).toLowerCase())}</b> (${h(A.euro(orari[orari.length - 1][1], true))} all'ora).` : '';
    return `<div class="tessera" style="margin-top:16px">
      <div class="tt"><h2>${icona('regolazioni')} Redditività per tipo di lavoro</h2><span class="pic uff-solo-largo">ultime 12 settimane · a listino, IVA esclusa</span></div>
      <div class="tab-w"><table class="tab uff-redd"><thead><tr><th>Tipo di lavoro</th><th class="num">Interventi</th><th class="num">Ore medie</th><th class="num">Valore medio</th><th class="num">Valore per ora</th><th>Peso dei materiali</th></tr></thead><tbody>
      ${tipi.map(t => {
        const x = per[t]; const sop = t === 'sopralluogo';
        const pm = x.val ? Math.round(x.mat / x.val * 100) : 0;
        return `<tr><td>${icona(ICONA_TIPO[t] || 'chiave', 'p')} ${h(nomeTipo(t))}</td><td class="num">${x.n}</td><td class="num">${h(A.oreDecimali(x.min / x.n))} h</td>
          <td class="num">${sop ? '<span class="muto" title="I sopralluoghi non si fatturano">non si fattura</span>' : h(A.euro(x.val / x.n, true))}</td>
          <td class="num">${sop || !x.min ? '—' : h(A.euro(x.val / (x.min / 60), true))}</td>
          <td class="nowrap">${sop ? '<span class="muto">—</span>' : `<span class="barra-orizz"><i style="width:${pm}%"></i></span><span class="uff-num">${pm}%</span>`}</td></tr>`;
      }).join('')}
      </tbody></table></div>
      ${dida ? `<div class="uff-dida">${dida} Le ore medie comprendono il viaggio.</div>` : ''}
    </div>`;
  }

  // Preventivo accettato → intervento, direttamente dal cruscotto.
  A.azione('uff-da-prev', el => {
    const p = A.preventivo(el.dataset.id); if (!p) return;
    A.apriNuovoIntervento({ clienteId: p.clienteId, sedeId: p.sedeId, tipo: 'installazione', richiesta: p.oggetto + ' — come da preventivo ' + p.numero + '.', preventivoId: p.id, origine: 'preventivo' });
  });

  // ===========================================================================
  // 2. RICHIESTE dal sito e dall'area clienti
  // ===========================================================================
  const TIPO_DA_RIC = { guasto: 'riparazione', intervento: 'riparazione', sopralluogo: 'sopralluogo', preventivo: 'sopralluogo' };
  const PRIO_DA_RIC = { urgente: 'urgente', questa_settimana: 'alta', quando_potete: 'normale' };
  function paginaRichieste(par) {
    segnaLettiQui();
    const sc = ['nuove', 'prese', 'chiuse'].includes(par.q.s) ? par.q.s : 'nuove';
    const tutte = A.DB.richieste.slice();
    const grp = { nuove: tutte.filter(r => r.stato === 'nuova'), prese: tutte.filter(r => r.stato === 'presa'), chiuse: tutte.filter(r => ['pianificata', 'rifiutata', 'chiusa'].includes(r.stato)) };
    const rank = { urgente: 0, questa_settimana: 1, quando_potete: 2 };
    const lista = grp[sc].sort((a, b) => sc === 'chiuse' ? String(b.data).localeCompare(String(a.data)) : (rank[a.urgenza] - rank[b.urgenza]) || String(b.data).localeCompare(String(a.data)));
    const schede = `<nav class="schede">${[['nuove', 'Nuove'], ['prese', 'Prese in carico'], ['chiuse', 'Chiuse']].map(([k, t]) => `<a href="#/u/richieste?s=${k}" class="${k === sc ? 'on' : ''}">${t} <span class="uff-conta ${k === 'nuove' && grp[k].length ? 'acc' : ''}">${grp[k].length}</span></a>`).join('')}</nav>`;
    const corpo = lista.length ? `<div class="uff-rics">${lista.map(schedaRichiesta).join('')}</div>`
      : `<div class="tessera">${A.vuoto(sc === 'nuove' ? 'Nessuna richiesta nuova' : sc === 'prese' ? 'Nessuna richiesta in lavorazione' : 'Nessuna richiesta chiusa', sc === 'nuove' ? 'Le richieste dal modulo del sito e dall\'area clienti arrivano qui, con un avviso.' : '', 'arrivo')}</div>`;
    const contenuto = `<div class="intestazione-pagina"><div><p style="margin:0">Dal modulo del sito e dall'area clienti. Rispondi entro la giornata: chi scrive dal sito sta chiedendo anche ad altri.</p></div></div>${schede}${corpo}`;
    return pagina({ attivo: 'richieste', titolo: 'Richieste', briciole: [['Lavoro', '#/u/cruscotto']], azioni: bottoneNuovo(), contenuto });
  }
  function schedaRichiesta(r) {
    const c = r.clienteId ? A.cliente(r.clienteId) : null;
    const s = r.sedeId ? A.sede(r.sedeId) : null;
    const imp = r.impiantoId ? A.impianto(r.impiantoId) : null;
    const u = URG_RIC[r.urgenza] || URG_RIC.quando_potete;
    const i = r.interventoId ? A.intervento(r.interventoId) : null;
    const indir = s ? A.indirizzo(s) : r.indirizzo;
    const mapsInd = s ? A.linkMappa(s) : (r.indirizzo ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(r.indirizzo) : '');
    const aperta = r.stato === 'nuova' || r.stato === 'presa';
    let esito = '';
    if (r.stato === 'pianificata') esito = i ? `${icona('spunta', 'p')} Diventata l'intervento <a href="#/u/intervento/${h(i.id)}"><b>N. ${h(i.numero)}</b></a> — ${h(i.data ? giornoParlato(i.data) + (i.ora ? ' alle ' + i.ora : '') : 'da pianificare')}` : 'Intervento creato';
    else if (r.stato === 'rifiutata') esito = `${icona('x', 'p')} Non presa: ${h(r.motivoRifiuto || '—')}`;
    else if (r.stato === 'chiusa') esito = `${icona('spunta', 'p')} Chiusa${r.notaChiusura ? ': ' + h(r.notaChiusura) : ''}`;
    else if (r.stato === 'presa') esito = `Presa in carico${r.presaDa ? ' da ' + h((A.utenteDa(r.presaDa) || {}).nome || '') : ''}${r.presaIl ? ' ' + h(A.quando(r.presaIl)) : ''}`;
    return `<article class="tessera uff-ric" id="ric-${h(r.id)}">
      <div class="cp">
        <div class="uff-ric-testa">
          <span class="uff-ric-ic ${r.urgenza === 'urgente' ? 'dang' : ''}">${icona(r.tipo === 'guasto' ? 'attenzione' : r.tipo === 'preventivo' ? 'documento' : r.tipo === 'sopralluogo' ? 'occhio' : 'chiave', 'g')}</span>
          <div class="cx1"><h3>${c ? `<a href="#/u/cliente/${h(c.id)}" style="color:inherit">${h(c.nome)}</a>` : h(r.nome)}</h3>
            <div class="pic">${h(TIPI_RIC[r.tipo] || r.tipo)} · arrivata ${h(A.quando(r.data))}${c && r.nome && r.nome !== c.nome ? ' · scrive ' + h(r.nome) : ''}</div></div>
          <div class="uff-pp">${r.origine === 'sito' ? A.pastiglia('dal sito', 'acc') : A.pastiglia('area clienti', 'blu')}${A.pastiglia(u[0], u[1])}</div>
        </div>
        <div class="uff-ric-descr">${h(r.descrizione || '—')}</div>
        ${(r.foto || []).length ? `<div class="uff-mini-foto">${r.foto.map((f, k) => `<button type="button" data-az="uff-ric-foto" data-id="${h(r.id)}" data-k="${k}" aria-label="Ingrandisci la foto ${k + 1}"><img src="${h(f)}" alt=""></button>`).join('')}</div>` : ''}
        <div class="uff-recapiti">
          ${r.telefono ? `<a href="${h(telLink(r.telefono))}">${icona('telefono', 'p')}${h(r.telefono)}</a>` : ''}
          ${r.email ? `<a href="mailto:${h(r.email)}">${icona('posta', 'p')}${h(r.email)}</a>` : ''}
          ${indir ? `<a href="${h(mapsInd)}" target="_blank" rel="noopener">${icona('mappa', 'p')}${h(indir)}</a>` : ''}
          ${imp ? `<span>${icona('impianto', 'p')}${h(imp.marca + ' ' + imp.modello)}</span>` : ''}
          ${!c ? `<span class="muto">${icona('utente', 'p')}Non ancora cliente</span>` : ''}
        </div>
      </div>
      <div class="uff-ric-az">
        <div class="esito">${esito}</div>
        ${aperta ? `${r.stato === 'nuova' ? `<button class="btn pic" type="button" data-az="uff-ric-presa" data-id="${h(r.id)}">${icona('spunta', 'p')} Presa in carico</button>` : ''}
          <button class="btn pic" type="button" data-az="uff-ric-chiudi" data-id="${h(r.id)}">Chiudi senza intervento</button>
          <button class="btn pic per" type="button" data-az="uff-ric-rifiuta" data-id="${h(r.id)}">Rifiuta</button>
          <button class="btn pri" type="button" data-az="uff-ric-crea" data-id="${h(r.id)}">${icona('piu', 'p')} Crea intervento</button>` : ''}
      </div>
    </article>`;
  }
  A.azione('uff-ric-foto', el => {
    const r = A.trova('richieste', el.dataset.id); if (!r) return;
    const src = (r.foto || [])[+el.dataset.k]; if (!src) return;
    A.modale({ titolo: 'Foto della richiesta — ' + r.nome, largo: true, corpo: `<div class="uff-grande"><img src="${h(src)}" alt="Foto inviata con la richiesta"></div>` });
  });
  A.azione('uff-ric-presa', el => {
    A.modifica(db => { const r = db.richieste.find(x => x.id === el.dataset.id); if (!r) return; r.stato = 'presa'; r.presaIl = A.adesso(); r.presaDa = A.utente().id; A.registra('richiesta presa in carico', r.nome + ' — ' + (TIPI_RIC[r.tipo] || r.tipo)); });
    A.toast('Presa in carico: la trovi in «Prese in carico»', 'ok'); A.render();
  });
  A.azione('uff-ric-chiudi', el => {
    const r = A.trova('richieste', el.dataset.id); if (!r) return;
    A.modale({ titolo: 'Chiudere la richiesta senza intervento?', form: 'uff-ric-chiudi-ok', corpo: `<input type="hidden" name="id" value="${h(r.id)}">
      <p style="margin-bottom:12px">Per esempio quando il problema si è risolto al telefono. La richiesta resta fra le chiuse.</p>
      <div class="campo"><label for="uff-rc-n">Come si è chiusa (facoltativo)</label><input id="uff-rc-n" type="text" name="nota" placeholder="Risolto al telefono: bastava riarmare la caldaia"></div>`,
      azioni: [{ testo: 'Lascia aperta', chiudi: true }, { testo: 'Chiudi la richiesta', classe: 'pri', tipo: 'submit' }] });
  });
  A.azione('uff-ric-chiudi-ok', (f, ev, d) => {
    A.modifica(db => { const r = db.richieste.find(x => x.id === d.id); if (!r) return; r.stato = 'chiusa'; r.notaChiusura = String(d.nota || '').trim(); r.chiusaIl = A.adesso(); A.registra('richiesta chiusa', r.nome + (r.notaChiusura ? ' — ' + r.notaChiusura : '')); });
    A.chiudiModale(); A.toast('Richiesta chiusa', 'ok'); A.render();
  });
  A.azione('uff-ric-rifiuta', el => {
    const r = A.trova('richieste', el.dataset.id); if (!r) return;
    const motivi = ['La zona non è servita', 'Non è un lavoro che facciamo', 'Agenda piena in quel periodo', 'Richiesta doppia'];
    A.modale({ titolo: 'Rifiutare la richiesta di ' + r.nome + '?', form: 'uff-ric-rifiuta-ok', corpo: `<input type="hidden" name="id" value="${h(r.id)}">
      <div class="uff-motivi">${motivi.map(m => `<button type="button" data-az="uff-motivo" data-t="${h(m)}">${h(m)}</button>`).join('')}</div>
      <div class="campo"><label for="uff-rr-m">Motivo</label><textarea id="uff-rr-m" name="motivo" rows="3" placeholder="Lo legge anche il cliente: scrivilo come glielo diresti al telefono."></textarea></div>
      ${r.email ? `<label class="spunta"><input type="checkbox" name="email" checked> ${r.origine === 'portale' ? 'Avvisa il cliente nell\'area clienti e con un\'email' : 'Manda un\'email di risposta'} a ${h(r.email)}</label>` : ''}
      <div id="uff-rr-err"></div>`,
      azioni: [{ testo: 'Lascia com\'è', chiudi: true }, { testo: 'Rifiuta la richiesta', classe: 'per', tipo: 'submit' }] });
  });
  A.azione('uff-motivo', el => { const t = A.$('.velo textarea'); if (t) { t.value = el.dataset.t + '.'; t.focus(); } });
  A.azione('uff-ric-rifiuta-ok', (f, ev, d) => {
    const motivo = String(d.motivo || '').trim();
    if (motivo.length < 3) { A.$('#uff-rr-err').innerHTML = `<div class="avviso dang">${icona('attenzione')}<div>Scrivi il motivo: il cliente deve sapere perché.</div></div>`; return; }
    A.modifica(db => {
      const r = db.richieste.find(x => x.id === d.id); if (!r) return;
      r.stato = 'rifiutata'; r.motivoRifiuto = motivo; r.chiusaIl = A.adesso();
      const email = d.email && r.email ? { a: r.email, oggetto: 'IDRAL — la sua richiesta del ' + A.data(r.data), testo: 'Gentile ' + r.nome + ', grazie per averci scritto. Purtroppo questa volta non possiamo occuparcene: ' + motivo + '\nPer qualunque cosa ci trova al ' + db.azienda.telefono + '.\nIDRAL' } : null;
      if (r.origine === 'portale' && r.clienteId) A.avvisa('cliente:' + r.clienteId, 'La tua richiesta non è stata presa: ' + taglia(motivo, 90), '#/c/richiedi', { tipo: 'richiesta', email });
      else if (email) db.email.unshift({ id: A.uid('eml'), data: A.adesso(), a: email.a, oggetto: email.oggetto, testo: email.testo });
      A.registra('richiesta rifiutata', r.nome + ' — ' + motivo);
    });
    A.chiudiModale(); A.toast('Richiesta rifiutata' + (d.email ? ': il cliente è stato avvisato' : ''), 'ok'); A.render();
  });
  A.azione('uff-ric-crea', el => {
    const r = A.trova('richieste', el.dataset.id); if (!r) return;
    const pre = { tipo: TIPO_DA_RIC[r.tipo] || 'riparazione', priorita: PRIO_DA_RIC[r.urgenza] || 'normale', richiesta: r.descrizione, richiestaId: r.id, origine: r.origine === 'sito' ? 'sito' : 'portale', impiantoId: r.impiantoId || null };
    if (r.clienteId) return A.apriNuovoIntervento(Object.assign(pre, { clienteId: r.clienteId, sedeId: r.sedeId }));
    // Dal sito arriva chi non e' ancora cliente: prima la scheda, poi il lavoro.
    const ind = spezzaIndirizzo(r.indirizzo);
    apriNuovoCliente({ nome: r.nome, telefono: r.telefono, email: r.email, indirizzo: ind.via, citta: ind.citta, cap: ind.cap, nota: 'Arrivato dal modulo del sito il ' + A.data(r.data) + '.' }, (cid, sid) => {
      A.modifica(db => { const x = db.richieste.find(y => y.id === r.id); if (x) { x.clienteId = cid; x.sedeId = sid; } });
      A.apriNuovoIntervento(Object.assign(pre, { clienteId: cid, sedeId: sid }));
    });
  });
  /** 'Via dei Cantieri 45, 90142 Palermo' -> {via, cap, citta}. Meglio un aiuto che un campo vuoto. */
  function spezzaIndirizzo(s) {
    s = String(s || '').trim(); const out = { via: s, cap: '', citta: 'Palermo' };
    const capM = s.match(/\b(\d{5})\b/); if (capM) out.cap = capM[1];
    const parti = s.split(',').map(x => x.trim()).filter(Boolean);
    if (parti.length > 1) { out.via = parti[0]; out.citta = parti.slice(1).join(', ').replace(/\b\d{5}\b/, '').trim() || 'Palermo'; }
    return out;
  }

  // ---- Nuovo cliente (dalla richiesta del sito o dalla modale del nuovo intervento)
  let ncStato = null;
  function apriNuovoCliente(pre, dopoCreato, indietro) {
    ncStato = { pre, dopoCreato, indietro };
    const tel = A.normTel(pre.telefono), em = String(pre.email || '').toLowerCase();
    // Chi scrive dal sito a volte e' gia' cliente: meglio accorgersene prima di fare un doppione.
    const simili = A.DB.clienti.filter(c => (em && String(c.email || '').toLowerCase() === em) || (tel.length >= 6 && A.normTel(c.telefono) === tel) || (pre.nome && norm(c.nome) === norm(pre.nome)));
    A.modale({
      titolo: 'Nuovo cliente', form: 'uff-nc-salva',
      corpo: `${simili.length ? `<div class="avviso warn" style="margin-bottom:14px">${icona('attenzione')}<div><b>Forse è già cliente.</b> ${simili.map(c => `<br>${h(c.nome)} — ${h(c.telefono || c.email || '')} <button type="button" class="btn pic" style="margin:4px 0 0 6px" data-az="uff-nc-usa" data-id="${h(c.id)}">Usa questo cliente</button>`).join('')}</div></div>` : ''}
        <div class="scelte" style="margin-bottom:14px">${[['privato', 'Privato'], ['condominio', 'Condominio'], ['azienda', 'Azienda']].map(([k, t], n) => `<label class="scelta"><input type="radio" name="tipo" value="${k}"${n === 0 ? ' checked' : ''}><span>${t}</span></label>`).join('')}</div>
        <div class="campo"><label for="uff-nc-nome">Nome e cognome, o ragione sociale</label><input id="uff-nc-nome" type="text" name="nome" value="${h(pre.nome || '')}" required></div>
        <div class="riga-campi"><div class="campo"><label for="uff-nc-tel">Telefono</label><input id="uff-nc-tel" type="tel" name="telefono" value="${h(pre.telefono || '')}"></div>
          <div class="campo"><label for="uff-nc-em">Email</label><input id="uff-nc-em" type="email" name="email" value="${h(pre.email || '')}"></div></div>
        <div class="campo"><label for="uff-nc-ind">Indirizzo del lavoro</label><input id="uff-nc-ind" type="text" name="indirizzo" value="${h(pre.indirizzo || '')}" placeholder="Via e numero civico"></div>
        <div class="riga-campi"><div class="campo"><label for="uff-nc-cap">CAP</label><input id="uff-nc-cap" type="text" name="cap" inputmode="numeric" value="${h(pre.cap || '')}"></div>
          <div class="campo"><label for="uff-nc-cit">Città</label><input id="uff-nc-cit" type="text" name="citta" value="${h(pre.citta || 'Palermo')}"></div></div>
        <p class="pic">Codice fiscale, partita IVA e dati di fatturazione si completano dopo, dalla scheda del cliente.</p>
        <div id="uff-nc-err"></div>`,
      azioni: [{ testo: indietro ? 'Indietro' : 'Annulla', az: 'uff-nc-indietro' }, { testo: 'Crea il cliente e continua', classe: 'pri', tipo: 'submit', icona: 'avanti' }]
    });
  }
  A.azione('uff-nc-indietro', () => { const s = ncStato; A.chiudiModale(); if (s && s.indietro) s.indietro(); });
  A.azione('uff-nc-usa', el => {
    const s = ncStato; const c = A.cliente(el.dataset.id); if (!s || !c) return;
    const sede = A.sediDi(c.id)[0];
    A.chiudiModale(); s.dopoCreato(c.id, sede ? sede.id : null);
  });
  A.azione('uff-nc-salva', (f, ev, d) => {
    const s = ncStato; if (!s) return;
    const nome = String(d.nome || '').trim();
    if (nome.length < 2) { A.$('#uff-nc-err').innerHTML = `<div class="avviso dang">${icona('attenzione')}<div>Scrivi almeno il nome.</div></div>`; return; }
    let cid, sid;
    A.modifica(db => {
      cid = A.uid('cli'); sid = A.uid('sed');
      db.clienti.push({ id: cid, tipo: d.tipo || 'privato', nome, referente: '', cf: '', piva: '', sdi: '', pec: '', email: String(d.email || '').trim(), telefono: String(d.telefono || '').trim(), listino: 'base', sconto: 0, note: s.pre.nota || '', tag: [], portale: false, creato: A.adesso() });
      // Niente coordinate: la sede nuova sulla mappa non compare finche' non la
      // si localizza. Meglio che un punto inventato nel posto sbagliato.
      db.sedi.push({ id: sid, clienteId: cid, nome: 'Sede principale', indirizzo: String(d.indirizzo || '').trim(), citta: String(d.citta || '').trim(), cap: String(d.cap || '').trim(), lat: null, lng: null, noteAccesso: '', referente: '', telefono: '' });
      A.registra('cliente creato', nome);
    });
    A.chiudiModale(); A.toast('Cliente creato: ' + nome, 'ok');
    s.dopoCreato(cid, sid);
  });

  // ===========================================================================
  // 3. PIANIFICAZIONE — il calendario della settimana, con il trascinamento
  // ===========================================================================
  function paginaPianificazione(par) {
    const db = A.DB; const oggi = A.oggi();
    const lun = /^\d{4}-\d{2}-\d{2}$/.test(par.q.settimana || '') ? A.lunedi(par.q.settimana) : A.lunedi(oggi);
    const giorni = []; for (let k = 0; k < 6; k++) giorni.push(A.piuGiorni(lun, k));
    const dom = A.piuGiorni(lun, 6);
    // La domenica compare solo se qualcuno ci lavora davvero (un pronto intervento).
    if (db.interventi.some(i => i.data === dom && i.stato !== 'annullato')) giorni.push(dom);
    const conf = conflitti();
    const tecs = A.tecnici();
    const nellaSett = db.interventi.filter(i => i.data && i.data >= lun && i.data <= dom && i.stato !== 'annullato');
    const rangoP = { urgente: 0, alta: 1, normale: 2, bassa: 3 };
    const liberi = db.interventi.filter(i => i.stato === 'da_pianificare').sort((a, b) => ((rangoP[a.priorita] ?? 2) - (rangoP[b.priorita] ?? 2)) || String(a.creato).localeCompare(String(b.creato)));
    const senzaTec = nellaSett.filter(i => !(i.tecnici || []).length);
    const cella = (tecId, g) => {
      const qui = nellaSett.filter(i => i.data === g && (i.tecnici || []).includes(tecId)).sort(perOra);
      const carico = qui.reduce((s, i) => s + (Number(i.durataMin) || 60), 0);
      return `<div class="pc${g === oggi ? ' oggi' : ''}" data-zona="1" data-tec="${h(tecId)}" data-giorno="${g}" aria-label="${h((A.utenteDa(tecId) || {}).nome + ', ' + A.dataLunga(g))}">
        ${carico ? `<div class="uff-carico${carico > 480 ? ' pieno' : ''}" title="Ore previste: ${h(A.durata(carico))}">${h(durataBreve(carico))}<i><u style="width:${Math.min(100, Math.round(carico / 480 * 100))}%"></u></i></div>` : ''}
        ${qui.map(i => carta(i, conf, tecId)).join('')}
      </div>`;
    };
    const grigl = `<div class="plan uff-plan" id="uff-plan" style="--gg:${giorni.length}">
      <div class="ph vuoto"></div>
      ${giorni.map(g => { const d = A.daGiorno(g); return `<div class="ph${g === oggi ? ' oggi' : ''}"${g === oggi ? ' aria-current="date"' : ''}><span><span class="gg">${g === oggi ? 'oggi' : A.GIORNI_BREVI[d.getDay()]}</span> <b>${d.getDate()}</b></span><span class="pic">${A.MESI_BREVI[d.getMonth()]}</span></div>`; }).join('')}
      ${tecs.map(t => {
        const ore = nellaSett.filter(i => (i.tecnici || []).includes(t.id)).reduce((s, i) => s + (Number(i.durataMin) || 60), 0);
        return `<div class="pt">${avatarTec(t.id)}<div class="cx1">${h(A.nomeBreve(t.nome))}<small class="pic">${ore ? h(durataBreve(ore)) + ' in sett.' : 'settimana libera'}</small></div></div>${giorni.map(g => cella(t.id, g)).join('')}`;
      }).join('')}
      ${senzaTec.length ? `<div class="pt"><span class="avatar uff-av" style="background:var(--ink-3)">?</span><div class="cx1">Senza tecnico<small class="pic">da assegnare</small></div></div>${giorni.map(g => `<div class="pc${g === oggi ? ' oggi' : ''}">${senzaTec.filter(i => i.data === g).sort(perOra).map(i => carta(i, conf, '')).join('')}</div>`).join('')}` : ''}
    </div>`;
    const colonna = `<div class="colonna-libera" id="uff-libera" data-zona="libera">
      <div class="uff-lib-t"><span>DA PIANIFICARE</span><span class="uff-conta ${liberi.length ? 'acc' : ''}">${liberi.length}</span></div>
      ${liberi.map(i => carta(i, conf, '', true)).join('') || `<p class="pic" style="padding:8px 4px">Niente da pianificare. Trascina qui un lavoro per toglierlo dall'agenda.</p>`}
    </div>`;
    const nConf = [...conf.keys()].filter(id => nellaSett.some(i => i.id === id)).length;
    const contenuto = `
      <div class="intestazione-pagina">
        <div><div class="uff-sett">${h(nomeSettimana(lun))} ${A.daGiorno(lun).getFullYear()}</div>
          <p>${nellaSett.length} lavori in agenda${nConf ? ` · <b style="color:var(--dang)">${nConf} sovrapposti</b>` : ''} · trascina una carta su un tecnico e un giorno per assegnarla</p></div>
        <div class="btns">
          <a class="btn icona" href="#/u/pianificazione?settimana=${A.piuGiorni(lun, -7)}" aria-label="Settimana precedente">${icona('sinistra')}</a>
          <a class="btn" href="#/u/pianificazione">Oggi</a>
          <a class="btn icona" href="#/u/pianificazione?settimana=${A.piuGiorni(lun, 7)}" aria-label="Settimana successiva">${icona('destra')}</a>
        </div>
      </div>
      <div class="uff-plan-wrap" id="uff-plan-box">${colonna}<div>${grigl}
        <div class="uff-legenda"><span><i style="border-left-color:var(--dang)"></i>Urgente</span><span><i style="border-left-color:var(--accent)"></i>Alta</span><span><i style="border-left-color:var(--brand-500)"></i>Normale</span><span><i style="border-left-color:var(--ok);opacity:.6"></i>Fatto</span><span><i style="border-color:var(--dang);background:var(--dang-50);box-shadow:0 0 0 1px var(--dang)"></i>Si sovrappone a un altro lavoro</span></div>
        <p class="pic uff-solo-stretto" style="margin-top:8px">Sul telefono tocca una carta per cambiarle giorno, ora e tecnici.</p>
      </div></div>`;
    return { html: pagina({ attivo: 'pianificazione', titolo: 'Pianificazione', briciole: [['Lavoro', '#/u/cruscotto']], azioni: bottoneNuovo(), contenuto }), dopo: agganciaTrascinamento };
  }
  function carta(i, conf, tecRiga, libera) {
    const sp = SPOSTABILI.includes(i.stato);
    const altri = conf.get(i.id) || [];
    const fatto = FATTI.includes(i.stato);
    const titolo = [nomeCli(i), nomeTipo(i.tipo), A.STATI_INTERVENTO[i.stato] ? A.STATI_INTERVENTO[i.stato][0] : i.stato].concat(altri.length ? ['Si sovrappone con: ' + altri.map(id => { const x = A.intervento(id); return x ? x.ora + ' ' + nomeCli(x) : ''; }).join(', ')] : []).join(' · ');
    const cl = ['carta', i.priorita === 'urgente' ? 'urgente' : i.priorita === 'alta' ? 'alta' : '', fatto ? 'chiuso' : '', IN_CAMPO.includes(i.stato) ? 'uff-campo-c' : '', altri.length ? 'uff-confl' : ''].filter(Boolean).join(' ');
    return `<div class="${cl}" draggable="${sp ? 'true' : 'false'}" data-id="${h(i.id)}" data-tec="${h(tecRiga || '')}" data-az="uff-carta" tabindex="0" role="button" title="${h(titolo)}">
      <div class="o">${libera ? h(A.PRIORITA[i.priorita] ? A.PRIORITA[i.priorita][0] : '') : h(i.ora || 'senza ora')}<span class="uff-dur">· ${h(durataBreve(i.durataMin || 60))}</span>${altri.length ? icona('attenzione', 'p') : ''}</div>
      <div class="c">${h(nomeCli(i))}</div>
      <div class="x"><span class="uff-st"></span>${h(nomeTipo(i.tipo))}${libera ? ' · ' + h(A.quando(i.creato)) : fatto ? ' · fatto' : ''}</div>
    </div>`;
  }
  /**
   * HTML5 drag & drop con la delega sul riquadro: la pagina si ridisegna a
   * ogni modifica, quindi gli ascoltatori si riagganciano a ogni disegno.
   * Sul telefono il trascinamento nativo non c'e': resta il tocco sulla carta.
   */
  function agganciaTrascinamento() {
    const box = A.$('#uff-plan-box'); if (!box) return;
    let trascinato = null, daTec = '';
    const pulisci = () => { box.querySelectorAll('.sopra').forEach(x => x.classList.remove('sopra')); box.querySelectorAll('.trascina').forEach(x => x.classList.remove('trascina')); const p = A.$('#uff-plan'); if (p) p.classList.remove('uff-trascinando'); };
    box.addEventListener('dragstart', e => {
      const c = e.target.closest && e.target.closest('.carta[draggable="true"]'); if (!c) return;
      trascinato = c.dataset.id; daTec = c.dataset.tec || '';
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', c.dataset.id);
      c.classList.add('trascina');
      // Mentre si trascina, le altre carte non devono «rubare» il rilascio alla cella.
      setTimeout(() => { const p = A.$('#uff-plan'); if (p) p.classList.add('uff-trascinando'); }, 0);
    });
    box.addEventListener('dragend', () => { trascinato = null; pulisci(); });
    box.addEventListener('dragover', e => {
      if (!trascinato) return;
      const z = e.target.closest && e.target.closest('[data-zona]'); if (!z) return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      if (!z.classList.contains('sopra')) { box.querySelectorAll('.sopra').forEach(x => x.classList.remove('sopra')); z.classList.add('sopra'); }
    });
    box.addEventListener('dragleave', e => { const z = e.target.closest && e.target.closest('[data-zona]'); if (z && !z.contains(e.relatedTarget)) z.classList.remove('sopra'); });
    box.addEventListener('drop', e => {
      const z = e.target.closest && e.target.closest('[data-zona]'); if (!z) return;
      e.preventDefault();
      const id = trascinato || e.dataTransfer.getData('text/plain'); const da = daTec;
      trascinato = null; pulisci();
      if (!id) return;
      if (z.dataset.zona === 'libera') spostaInLibera(id); else sposta(id, z.dataset.tec, z.dataset.giorno, da);
    });
    // Tastiera: Invio sulla carta apre la modale rapida, come il clic.
    box.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('carta')) { e.preventDefault(); e.target.click(); } });
  }
  /** Fotografia dello stato prima dello spostamento: serve all'«Annulla». */
  function istantanea(i) { return { data: i.data, ora: i.ora, tecnici: (i.tecnici || []).slice(), stato: i.stato, storico: (i.storico || []).length }; }
  function ripristina(id, snap, avvisiIds) {
    A.modifica(db => {
      const i = db.interventi.find(x => x.id === id); if (!i) return;
      const cambiato = istantanea(i);
      i.data = snap.data; i.ora = snap.ora; i.tecnici = snap.tecnici; i.stato = snap.stato;
      i.storico.length = Math.min(i.storico.length, snap.storico);
      // Gli avvisi ancora da leggere spariscono; se qualcuno li ha gia' letti, gli arriva il contrordine.
      const letti = db.avvisi.filter(a => avvisiIds.includes(a.id) && a.letto).map(a => a.a);
      db.avvisi = db.avvisi.filter(a => !(avvisiIds.includes(a.id) && !a.letto));
      [...new Set(letti)].forEach(t => A.avvisa(t, 'Contrordine: ' + nomeCli(i) + ' resta ' + (i.data ? giornoParlato(i.data) + (i.ora ? ' alle ' + i.ora : '') : 'da pianificare'), i.data ? '#/t/lavoro/' + i.id : '#/t/oggi', { tipo: 'assegnazione' }));
      A.registra('spostamento annullato', 'Intervento ' + i.numero + ' — ' + nomeCli(i) + ' torna ' + (i.data ? A.data(i.data) + ' ' + (i.ora || '') + ' (' + A.nomeTecnici(i.tecnici) + ')' : 'da pianificare') + ' (era ' + (cambiato.data ? A.data(cambiato.data) + ' ' + (cambiato.ora || '') : 'da pianificare') + ')');
    });
    A.toast('Spostamento annullato', 'ok'); A.render();
  }
  function sposta(id, tecId, giorno, daTec) {
    const i0 = A.intervento(id); if (!i0 || !tecId || !giorno) return;
    if (!SPOSTABILI.includes(i0.stato)) { A.toast('Questo lavoro è già partito: si cambia dalla sua scheda', 'warn'); return; }
    let nuovi = (i0.tecnici || []).slice();
    if (daTec && nuovi.includes(daTec)) nuovi = nuovi.map(t => t === daTec ? tecId : t);
    else nuovi = [tecId];
    nuovi = [...new Set(nuovi)];
    if (i0.data === giorno && JSON.stringify(nuovi) === JSON.stringify(i0.tecnici || [])) return;
    const snap = istantanea(i0);
    let avv = [], proposta = '';
    A.modifica(db => {
      const i = db.interventi.find(x => x.id === id);
      const prima = istantanea(i);
      i.data = giorno; i.tecnici = nuovi;
      if (!i.ora) { i.ora = primaOraLibera(tecId, giorno, i.durataMin, i.id); proposta = i.ora; }
      const nota = (prima.data ? 'spostato' : 'pianificato') + ' a ' + A.data(giorno) + ' ' + i.ora + ' — ' + A.nomeTecnici(nuovi);
      if (i.stato === 'da_pianificare') passaA(i, 'pianificato', nota); else i.storico.push({ stato: i.stato, data: A.adesso(), utenteId: A.utente().id, nota });
      avv = avvisaCambi(db, i, prima);
      A.registra(prima.data ? 'intervento spostato' : 'intervento pianificato', 'N. ' + i.numero + ' — ' + nomeCli(i) + ': ' + (prima.data ? A.data(prima.data) + ' ' + (prima.ora || '') + ' (' + A.nomeTecnici(prima.tecnici) + ') → ' : '') + A.data(giorno) + ' ' + i.ora + ' (' + A.nomeTecnici(nuovi) + ')');
    });
    const i = A.intervento(id);
    A.render();
    toastAnnulla(nomeCli(i) + ': ' + giornoParlato(giorno) + ' alle ' + i.ora + ' con ' + A.nomeTecnici(nuovi).split(' ')[0] + (proposta ? ' (prima ora libera)' : '') + ' — avvisato', () => ripristina(id, snap, avv));
  }
  function spostaInLibera(id) {
    const i0 = A.intervento(id); if (!i0 || i0.stato === 'da_pianificare') return;
    if (!SPOSTABILI.includes(i0.stato)) { A.toast('Questo lavoro è già partito: si cambia dalla sua scheda', 'warn'); return; }
    const snap = istantanea(i0); let avv = [];
    A.modifica(db => {
      const i = db.interventi.find(x => x.id === id); const prima = istantanea(i);
      i.data = null; i.ora = ''; i.tecnici = [];
      passaA(i, 'da_pianificare', 'tolto dall\'agenda');
      avv = avvisaCambi(db, i, prima);
      A.registra('intervento tolto dall\'agenda', 'N. ' + i.numero + ' — ' + nomeCli(i) + ' (era ' + A.data(prima.data) + ', ' + A.nomeTecnici(prima.tecnici) + ')');
    });
    A.render();
    toastAnnulla(nomeCli(i0) + ' torna fra i lavori da pianificare', () => ripristina(id, snap, avv));
  }
  // Clic (o tocco) sulla carta: la modale rapida.
  A.azione('uff-carta', el => apriRapida(el.dataset.id));
  function campiTecnici(sel) {
    return `<div class="scelte uff-tec-scelte">${A.tecnici().map(t => `<label class="scelta"><input type="checkbox" name="tecnici" value="${h(t.id)}"${(sel || []).includes(t.id) ? ' checked' : ''}><span><i style="background:${coloreDi(t)}"></i>${h(A.nomeBreve(t.nome))}</span></label>`).join('')}</div>`;
  }
  const opzDurata = sel => DURATE.concat(DURATE.includes(Number(sel)) || !sel ? [] : [Number(sel)]).sort((a, b) => a - b).map(m => `<option value="${m}"${Number(sel) === m ? ' selected' : ''}>${h(A.durata(m))}</option>`).join('');
  function apriRapida(id) {
    const i = A.intervento(id); if (!i) return;
    const altri = (conflitti().get(i.id) || []).map(x => A.intervento(x)).filter(Boolean);
    const blocc = !SPOSTABILI.includes(i.stato);
    A.modale({
      titolo: nomeCli(i), form: 'uff-rap-salva',
      corpo: `<input type="hidden" name="id" value="${h(i.id)}">
        <div class="uff-pp" style="margin-bottom:10px"><span class="pic mono">N. ${h(i.numero)}</span>${A.statoIntervento(i.stato)}${A.priorita(i.priorita)}${A.pastiglia(nomeTipo(i.tipo), 'grigio', true)}</div>
        ${i.richiesta ? `<p class="uff-testo" style="margin-bottom:14px;color:var(--ink-2)">${h(taglia(i.richiesta, 220))}</p>` : ''}
        ${altri.length ? `<div class="avviso dang" style="margin-bottom:14px">${icona('attenzione')}<div><b>Si sovrappone</b> con ${altri.map(x => h(x.ora + ' ' + nomeCli(x) + ' (' + A.durata(x.durataMin) + ')')).join(', ')}.</div></div>` : ''}
        ${blocc ? `<div class="avviso" style="margin-bottom:14px">${icona('info')}<div>Il lavoro è ${h((A.STATI_INTERVENTO[i.stato] || [i.stato])[0].toLowerCase())}: il tecnico viene avvisato di ogni cambio.</div></div>` : ''}
        <div class="riga-campi">
          <div class="campo"><label for="uff-r-d">Giorno</label><input id="uff-r-d" type="date" name="data" value="${h(i.data || '')}"></div>
          <div class="campo"><label for="uff-r-o">Ora</label><input id="uff-r-o" type="time" name="ora" step="900" value="${h(i.ora || '')}"></div>
          <div class="campo"><label for="uff-r-du">Durata</label><select id="uff-r-du" name="durataMin">${opzDurata(i.durataMin || 60)}</select></div>
        </div>
        <div class="campo"><span class="etichetta">Tecnici</span>${campiTecnici(i.tecnici)}</div>
        <div class="campo"><label for="uff-r-p">Priorità</label><select id="uff-r-p" name="priorita">${Object.keys(A.PRIORITA).map(k => `<option value="${k}"${i.priorita === k ? ' selected' : ''}>${A.PRIORITA[k][0]}</option>`).join('')}</select></div>`,
      azioni: [{ testo: 'Apri la scheda', az: 'uff-rap-scheda', icona: 'esterno', attr: ` data-id="${h(i.id)}"` }, { testo: 'Salva', classe: 'pri', tipo: 'submit' }]
    });
  }
  A.azione('uff-rap-scheda', el => { A.chiudiModale(); A.vai('#/u/intervento/' + el.dataset.id); });
  A.azione('uff-rap-salva', (f, ev, d) => {
    const tecnici = Array.from(f.querySelectorAll('input[name=tecnici]:checked')).map(x => x.value);
    const es = salvaModifiche(d.id, { data: d.data || null, ora: d.ora || '', durataMin: Number(d.durataMin) || 60, tecnici, priorita: d.priorita });
    A.chiudiModale(); esitoSalvataggio(es); A.render();
  });
  function esitoSalvataggio(es) {
    if (!es) return;
    if (es.nulla) return A.toast('Nessuna modifica', '');
    A.toast('Salvato' + (es.proposta ? ': ora proposta ' + es.proposta + ' (prima libera)' : '') + (es.avvisati ? ' · ' + es.avvisati + (es.avvisati === 1 ? ' tecnico avvisato' : ' tecnici avvisati') : ''), 'ok');
  }
  /**
   * Un posto solo per cambiare data, ora, squadra e il resto: la modale rapida
   * del calendario e la modale «Modifica» della scheda dicono le stesse cose ai
   * tecnici e lasciano la stessa traccia nel registro.
   */
  function salvaModifiche(id, n) {
    let esito = null;
    A.modifica(db => {
      const i = db.interventi.find(x => x.id === id); if (!i) return;
      const prima = { data: i.data, ora: i.ora, tecnici: (i.tecnici || []).slice(), stato: i.stato };
      const cambi = [];
      const fmt = { data: v => v ? A.data(v) : 'da pianificare', tecnici: v => A.nomeTecnici(v), durataMin: v => A.durata(v), tipo: nomeTipo, priorita: v => (A.PRIORITA[v] || [v])[0], modalita: v => MODALITA[v] || v, ora: v => v || '—', richiesta: v => '«' + taglia(v, 40) + '»', noteInterne: v => '«' + taglia(v, 40) + '»', impiantoId: v => { const m = v ? A.impianto(v) : null; return m ? m.marca + ' ' + m.modello : 'nessuna'; } };
      const nomi = { data: 'giorno', ora: 'ora', tecnici: 'tecnici', durataMin: 'durata', tipo: 'tipo', priorita: 'priorità', modalita: 'modalità', richiesta: 'richiesta', noteInterne: 'note interne', impiantoId: 'macchina' };
      Object.keys(nomi).forEach(k => {
        if (!(k in n) || n[k] === undefined) return;
        const vecchio = i[k] === undefined ? null : i[k], nuovo = n[k];
        if (JSON.stringify(vecchio || (k === 'tecnici' ? [] : null)) === JSON.stringify(nuovo || (k === 'tecnici' ? [] : null))) return;
        i[k] = nuovo;
        cambi.push(nomi[k] + ': ' + fmt[k](vecchio) + ' → ' + fmt[k](nuovo));
      });
      let proposta = '';
      if (i.data && (i.tecnici || []).length && !i.ora && APERTI.includes(i.stato)) { i.ora = primaOraLibera(i.tecnici[0], i.data, i.durataMin, i.id); proposta = i.ora; cambi.push('ora proposta: ' + i.ora); }
      if (!cambi.length) { esito = { nulla: true }; return; }
      const pian = !!(i.data && (i.tecnici || []).length);
      const quando = prima.data !== i.data || (prima.ora || '') !== (i.ora || '') || JSON.stringify(prima.tecnici) !== JSON.stringify(i.tecnici || []);
      if (i.stato === 'da_pianificare' && pian) passaA(i, 'pianificato', A.data(i.data) + ' ' + i.ora + ' — ' + A.nomeTecnici(i.tecnici));
      else if (i.stato === 'pianificato' && !pian) passaA(i, 'da_pianificare', 'tolto dall\'agenda');
      else if (quando && APERTI.includes(i.stato)) i.storico.push({ stato: i.stato, data: A.adesso(), utenteId: A.utente().id, nota: 'spostato a ' + (i.data ? A.data(i.data) + ' ' + (i.ora || '') : 'da pianificare') + ' — ' + A.nomeTecnici(i.tecnici) });
      const avv = quando && APERTI.includes(prima.stato) ? avvisaCambi(db, i, prima) : [];
      A.registra('intervento modificato', 'N. ' + i.numero + ' — ' + nomeCli(i) + ': ' + cambi.join('; '));
      esito = { proposta, avvisati: new Set(avv.map(aid => (db.avvisi.find(a => a.id === aid) || {}).a)).size };
    });
    return esito;
  }

  // ===========================================================================
  // 4. ELENCO INTERVENTI
  // ===========================================================================
  const GRUPPI_STATO = [
    ['tutti', 'Tutti', null], ['da_pianificare', 'Da pianificare', ['da_pianificare']], ['pianificato', 'Pianificati', ['pianificato']],
    ['in_campo', 'In corso', IN_CAMPO], ['completato', 'Da approvare', ['completato']], ['approvato', 'Approvati', ['approvato']],
    ['chiusi', 'Valorizzati e fatturati', ['valorizzato', 'fatturato']], ['annullato', 'Annullati', ['annullato']]
  ];
  function testoRicerca(i) {
    const c = A.cliente(i.clienteId) || {}, s = A.sede(i.sedeId), m = i.impiantoId ? A.impianto(i.impiantoId) : null;
    return norm([i.numero, c.nome, c.referente, s ? A.indirizzo(s) : '', i.richiesta, nomeTipo(i.tipo), A.nomeTecnici(i.tecnici), m ? m.marca + ' ' + m.modello + ' ' + m.matricola : ''].join(' '));
  }
  function filtraInterventi(q, conStato) {
    const [da, a] = periodo(q.periodo);
    const parole = norm(q.q || '').split(/\s+/).filter(Boolean);
    const gr = GRUPPI_STATO.find(g => g[0] === q.stato);
    return A.DB.interventi.filter(i => {
      if (da && !(i.data && i.data >= da && i.data <= a)) return false;
      if (q.tec && !(i.tecnici || []).includes(q.tec)) return false;
      if (q.tipo && i.tipo !== q.tipo) return false;
      if (conStato && gr && gr[2] && !gr[2].includes(i.stato)) return false;
      if (parole.length) { const t = testoRicerca(i); if (!parole.every(p => t.includes(p))) return false; }
      return true;
    });
  }
  const perDataDesc = (a, b) => (a.data ? 1 : 0) - (b.data ? 1 : 0) || String(b.data || '').localeCompare(String(a.data || '')) || String(a.ora || '').localeCompare(String(b.ora || ''));
  function hashInterventi(q) {
    const p = new URLSearchParams(); ['q', 'stato', 'tec', 'tipo', 'periodo'].forEach(k => { if (q[k] && !(k === 'stato' && q[k] === 'tutti') && !(k === 'periodo' && q[k] === 'tutti')) p.set(k, q[k]); });
    const s = p.toString(); return '#/u/interventi' + (s ? '?' + s : '');
  }
  let rifocusCerca = false;
  function paginaInterventi(par) {
    const q = Object.assign({ stato: 'tutti', periodo: 'tutti' }, par.q);
    const base = filtraInterventi(q, false);
    const lista = filtraInterventi(q, true).sort(perDataDesc);
    const tuttiVis = q.tutti === '1'; const MAX = 120;
    const vis = tuttiVis ? lista : lista.slice(0, MAX);
    const conta = g => g[2] ? base.filter(i => g[2].includes(i.stato)).length : base.length;
    const schede = `<nav class="schede uff-schede-strette">${GRUPPI_STATO.map(g => { const n = conta(g); if (!n && g[0] !== 'tutti' && g[0] !== q.stato) return ''; return `<a href="${hashInterventi(Object.assign({}, q, { stato: g[0] }))}" class="${q.stato === g[0] ? 'on' : ''}">${h(g[1])} <span class="uff-conta">${n}</span></a>`; }).join('')}</nav>`;
    const filtri = `<div class="uff-filtri">
      <div class="cerca">${icona('cerca')}<input id="uff-cerca" type="search" placeholder="Cerca cliente, via, numero, macchina…" value="${h(q.q || '')}" data-digita="uff-int-cerca" aria-label="Cerca negli interventi"></div>
      <select data-cambia="uff-int-filtro" data-k="periodo" aria-label="Periodo">${[['tutti', 'Tutto il periodo'], ['oggi', 'Oggi'], ['settimana', 'Questa settimana'], ['mese', 'Questo mese']].map(([k, t]) => `<option value="${k}"${q.periodo === k ? ' selected' : ''}>${t}</option>`).join('')}</select>
      <select data-cambia="uff-int-filtro" data-k="tec" aria-label="Tecnico"><option value="">Tutti i tecnici</option>${A.tecnici().map(t => `<option value="${h(t.id)}"${q.tec === t.id ? ' selected' : ''}>${h(t.nome)}</option>`).join('')}</select>
      <select data-cambia="uff-int-filtro" data-k="tipo" aria-label="Tipo di lavoro"><option value="">Tutti i tipi</option>${Object.keys(A.TIPI_INTERVENTO).map(k => `<option value="${k}"${q.tipo === k ? ' selected' : ''}>${h(A.TIPI_INTERVENTO[k])}</option>`).join('')}</select>
      ${q.q || q.tec || q.tipo || (q.periodo && q.periodo !== 'tutti') || (q.stato && q.stato !== 'tutti') ? `<a class="btn vuoto pic" href="#/u/interventi">${icona('x', 'p')} Togli i filtri</a>` : ''}
    </div>`;
    const riga = i => {
      const s = A.sede(i.sedeId);
      return `<tr class="clic" data-az="uff-apri" data-id="${h(i.id)}">
        <td class="mono">${h(i.numero)}</td>
        <td class="uff-num">${i.data ? h(A.data(i.data)) + (i.ora ? ' <span class="muto">' + h(i.ora) + '</span>' : '') : '<span class="muto">da pianificare</span>'}</td>
        <td class="uff-cl"><b>${h(nomeCli(i))}</b><div class="t2">${h(s ? A.indirizzo(s) : '—')}</div></td>
        <td>${h(nomeTipo(i.tipo))}</td>
        <td>${tecniciHtml(i.tecnici, 2)}</td>
        <td>${A.statoIntervento(i.stato)}</td>
        <td>${i.priorita === 'normale' ? '<span class="muto">normale</span>' : A.priorita(i.priorita)}</td>
      </tr>`;
    };
    const tabella = lista.length ? `<div class="tessera uff-solo-largo"><div class="tab-w"><table class="tab uff-tab-int"><thead><tr><th>Numero</th><th>Data e ora</th><th>Cliente e luogo</th><th>Tipo</th><th>Tecnici</th><th>Stato</th><th>Priorità</th></tr></thead><tbody>${vis.map(riga).join('')}</tbody></table></div></div>
      <div class="tessera uff-solo-stretto"><ul class="elenco uff-el-int">${vis.map(i => `<li class="clic" data-az="uff-apri" data-id="${h(i.id)}"><span class="uff-ric-ic" style="width:36px;height:36px;flex-basis:36px">${icona(ICONA_TIPO[i.tipo] || 'chiave')}</span><div class="cx1"><div class="t1">${h(nomeCli(i))}</div><div class="t2">${i.data ? h(A.data(i.data)) + (i.ora ? ' · ' + h(i.ora) : '') : 'da pianificare'} · ${h(nomeTipo(i.tipo))} · N. ${h(i.numero)}</div><div class="uff-pp">${A.statoIntervento(i.stato)}${i.priorita === 'urgente' || i.priorita === 'alta' ? A.priorita(i.priorita) : ''}<span class="pic">${h(A.nomeTecnici(i.tecnici))}</span></div></div>${icona('destra')}</li>`).join('')}</ul></div>
      ${lista.length > vis.length ? `<p style="margin-top:12px"><a class="btn" href="${hashInterventi(q)}${hashInterventi(q).includes('?') ? '&' : '?'}tutti=1">Mostra tutti i ${lista.length}</a></p>` : ''}`
      : `<div class="tessera">${A.vuoto('Nessun intervento', 'Nessun intervento corrisponde ai filtri scelti.', 'cerca')}</div>`;
    const contenuto = `<div class="intestazione-pagina"><div><p style="margin:0">${lista.length} ${lista.length === 1 ? 'intervento' : 'interventi'}${lista.length > vis.length ? ' · ne mostriamo ' + vis.length : ''}</p></div>
        <div class="btns"><button class="btn" type="button" data-az="uff-int-csv">${icona('scarica')} Esporta CSV</button></div></div>
      ${filtri}${schede}${tabella}`;
    return {
      html: pagina({ attivo: 'interventi', titolo: 'Interventi', briciole: [['Lavoro', '#/u/cruscotto']], azioni: bottoneNuovo(), contenuto }),
      dopo: () => { if (rifocusCerca) { rifocusCerca = false; const c = A.$('#uff-cerca'); if (c) { c.focus(); const n = c.value.length; c.setSelectionRange(n, n); } } }
    };
  }
  A.azione('uff-apri', el => A.vai('#/u/intervento/' + el.dataset.id));
  let timerCerca = null;
  A.azione('uff-int-cerca', el => {
    clearTimeout(timerCerca);
    timerCerca = setTimeout(() => {
      // replaceState: ogni lettera digitata non deve diventare un passo del «indietro».
      const q = Object.fromEntries(new URLSearchParams((location.hash.split('?')[1]) || ''));
      q.q = el.value.trim(); delete q.tutti;
      history.replaceState(null, '', hashInterventi(q));
      rifocusCerca = true; A.render();
    }, 250);
  });
  A.azione('uff-int-filtro', el => {
    const q = Object.fromEntries(new URLSearchParams((location.hash.split('?')[1]) || ''));
    q[el.dataset.k] = el.value; delete q.tutti;
    A.vai(hashInterventi(q));
  });
  A.azione('uff-int-csv', () => {
    const q = Object.assign({ stato: 'tutti', periodo: 'tutti' }, Object.fromEntries(new URLSearchParams((location.hash.split('?')[1]) || '')));
    const lista = filtraInterventi(q, true).sort(perDataDesc);
    const dec = n => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2).replace('.', ',');
    const righe = [['Numero', 'Data', 'Ora', 'Cliente', 'Luogo', 'Tipo', 'Tecnici', 'Stato', 'Priorità', 'Modalità', 'Origine', 'Ore di lavoro', 'Valore (€, IVA esclusa)']].concat(lista.map(i => {
      const s = A.sede(i.sedeId); const m = A.minutiIntervento(i);
      return [i.numero, i.data ? A.data(i.data) : '', i.ora || '', nomeCli(i), s ? A.indirizzo(s) : '', nomeTipo(i.tipo), A.nomeTecnici(i.tecnici), (A.STATI_INTERVENTO[i.stato] || [i.stato])[0], (A.PRIORITA[i.priorita] || [i.priorita])[0], MODALITA[i.modalita] || '', ORIGINI[i.origine] || i.origine || '', i.rapporto ? dec((m.lavoro + m.straordinario) / 60) : '', i.rapporto && i.rapporto.stato !== 'bozza' ? dec(A.valoreIntervento(i).totale) : ''];
    }));
    A.scarica('interventi-' + A.oggi() + '.csv', A.csv(righe), 'text/csv;charset=utf-8');
    A.modifica(() => A.registra('export interventi', lista.length + ' righe'));
    A.toast(lista.length + ' interventi esportati', 'ok');
  });

  // ===========================================================================
  // 5. LA SCHEDA DELL'INTERVENTO
  // ===========================================================================
  function paginaIntervento(par) {
    const i = A.intervento(par.id);
    if (!i) return pagina({ attivo: 'interventi', titolo: 'Intervento non trovato', briciole: [['Interventi', '#/u/interventi']], contenuto: `<div class="tessera">${A.vuoto('Questo intervento non c\'è', 'Forse è stato annullato e rimosso, oppure il link è sbagliato.', 'cerca')}<p class="cx" style="padding-bottom:20px"><a class="btn" href="#/u/interventi">Torna agli interventi</a></p></div>` });
    segnaLettiQui();
    const c = A.cliente(i.clienteId) || { nome: 'Cliente' }, s = A.sede(i.sedeId), m = i.impiantoId ? A.impianto(i.impiantoId) : null;
    const r = i.rapporto && i.rapporto.stato && i.rapporto.stato !== 'bozza' ? i.rapporto : null;
    const medie = medieLavoro();
    const an = r ? anomalie(i, medie) : [];
    const altri = (conflitti().get(i.id) || []).map(x => A.intervento(x)).filter(Boolean);
    const prev = i.preventivoId ? A.preventivo(i.preventivoId) : null;
    const prevNati = A.DB.preventivi.filter(p => p.daInterventoId === i.id);
    const doc = i.documentoId ? A.trova('documenti', i.documentoId) : null;
    const ric = A.DB.richieste.find(x => x.interventoId === i.id);

    // --- azioni coerenti con lo stato
    const az = [];
    const id = h(i.id);
    if (i.stato === 'completato' && i.rapporto && i.rapporto.stato === 'inviato') {
      az.push(`<button class="btn ok" type="button" data-az="uff-approva" data-id="${id}">${icona('spunta')} Approva</button>`);
      az.push(`<button class="btn" type="button" data-az="uff-correggi" data-id="${id}">${icona('penna')} Correggi e approva</button>`);
      az.push(`<button class="btn per" type="button" data-az="uff-rimanda" data-id="${id}">${icona('indietro')} Rimanda al tecnico</button>`);
    } else if (i.stato === 'da_pianificare') {
      az.push(`<button class="btn pri" type="button" data-az="uff-modifica" data-id="${id}">${icona('calendario')} Pianifica</button>`);
    } else if (APERTI.includes(i.stato)) {
      az.push(`<button class="btn pri" type="button" data-az="uff-modifica" data-id="${id}">${icona('modifica')} Modifica</button>`);
    } else if (i.stato === 'approvato' && i.tipo !== 'sopralluogo' && !i.documentoId) {
      az.push(`<a class="btn acc" href="#/u/documenti">${icona('euro')} Vai a Da fatturare</a>`);
    } else if (i.stato === 'annullato') {
      az.push(`<button class="btn pri" type="button" data-az="uff-ripristina" data-id="${id}">${icona('ricarica')} Ripristina</button>`);
    }
    const sec = [];
    if (r) sec.push(`<a class="btn pic" href="#/u/intervento/${id}/stampa">${icona('stampa', 'p')} Stampa rapportino</a>`);
    if (r) sec.push(`<button class="btn pic" type="button" data-az="uff-crea-prev" data-id="${id}">${icona('documento', 'p')} Crea preventivo</button>`);
    sec.push(`<button class="btn pic" type="button" data-az="uff-duplica" data-id="${id}">${icona('copia', 'p')} Duplica</button>`);
    if (!APERTI.includes(i.stato) && i.stato !== 'annullato' && i.stato !== 'completato') { /* chiuso: niente modifica della pianificazione */ }
    if (APERTI.includes(i.stato)) sec.push(`<button class="btn pic per" type="button" data-az="uff-annulla" data-id="${id}">${icona('x', 'p')} Annulla intervento</button>`);

    const testata = `<div class="tessera uff-testata">
      <div class="uff-t-su">
        <div class="uff-t-1"><span class="uff-t-num">N. ${h(i.numero)}</span>${A.statoIntervento(i.stato)}${i.priorita !== 'normale' ? A.priorita(i.priorita) : ''}${A.pastiglia(nomeTipo(i.tipo), 'grigio', true)}${i.modalita && i.modalita !== 'misura' ? A.pastiglia(MODALITA[i.modalita], i.modalita === 'garanzia' || i.modalita === 'contratto' ? 'warn' : 'grigio', true) : ''}</div>
        <h2><a href="#/u/cliente/${h(c.id)}">${h(c.nome)}</a></h2>
        <div class="uff-t-meta">
          <span>${icona('calendario', 'p')}${i.data ? h(cap(A.dataLunga(i.data))) + (i.ora ? ' · ' + h(i.ora) : '') + ' · ' + h(A.durata(i.durataMin || 60)) : '<b>Da pianificare</b>'}</span>
          <span>${(i.tecnici || []).length ? tecniciHtml(i.tecnici, 3) : icona('utente', 'p') + '<span class="muto">nessun tecnico</span>'}</span>
          ${s ? `<span>${icona('mappa', 'p')}${h(A.indirizzo(s))}</span>` : ''}
        </div>
      </div>
      <div class="uff-t-barra"><div class="btns">${az.join('')}</div><div class="btns">${sec.join('')}</div></div>
    </div>`;

    const avvisi = [];
    if (altri.length && APERTI.includes(i.stato)) avvisi.push(`<div class="avviso dang">${icona('attenzione')}<div><b>Si sovrappone ad altri lavori dello stesso tecnico:</b> ${altri.map(x => `<a href="#/u/intervento/${h(x.id)}">${h(x.ora + ' ' + nomeCli(x))}</a>`).join(', ')}. <a href="#/u/pianificazione?settimana=${h(A.lunedi(i.data))}">Apri il calendario</a></div></div>`);
    if (i.stato === 'completato' && r) avvisi.push(`<div class="avviso ${an.some(a => a.tono === 'dang') ? 'dang' : an.length ? 'warn' : 'ok'}">${icona(an.length ? 'attenzione' : 'spunta')}<div><b>Rapportino da approvare</b> — inviato da ${h(A.nomeTecnici(i.tecnici))} ${h(A.quando(r.inviatoIl))}.${an.length ? '<div class="uff-chips" style="margin-top:8px">' + chipAnomalie(an) + '</div>' : ' Nessuna anomalia: si può approvare.'}</div></div>`);
    if (i.rapporto && i.rapporto.stato === 'rimandato') avvisi.push(`<div class="avviso warn">${icona('indietro')}<div><b>Rimandato al tecnico</b>${i.rapporto.rimandatoIl ? ' ' + h(A.quando(i.rapporto.rimandatoIl)) : ''}: «${h(i.rapporto.motivoRimando || '')}». Aspettiamo che lo corregga e lo reinvii.</div></div>`);
    if (i.stato === 'annullato') avvisi.push(`<div class="avviso">${icona('info')}<div>Intervento annullato${i.motivoAnnullo ? ': ' + h(i.motivoAnnullo) : ''}.</div></div>`);

    // --- colonna sinistra
    const daFare = `<div class="tessera"><div class="tt"><h3>${icona('messaggio')} Cosa chiede il cliente</h3><span class="pic">${h(ORIGINI[i.origine] || i.origine || '')} · ${h(A.quando(i.creato))}</span></div><div class="cp uff-blocchi">
      <div class="uff-testo">${h(i.richiesta || '—')}</div>
      ${ric && (ric.foto || []).length ? `<div><div class="uff-sez-t">Foto mandate dal cliente</div><div class="uff-mini-foto">${ric.foto.map((f, k) => `<button type="button" data-az="uff-ric-foto" data-id="${h(ric.id)}" data-k="${k}" aria-label="Ingrandisci la foto ${k + 1}"><img src="${h(f)}" alt=""></button>`).join('')}</div></div>` : ''}
      <div class="uff-blocco"><h4>${icona('lucchetto', 'p')} Note interne <span class="muto" style="text-transform:none;letter-spacing:0;font-weight:500">— il cliente non le vede</span></h4><div class="uff-testo">${i.noteInterne ? h(i.noteInterne) : '<span class="muto">Nessuna nota.</span>'}</div></div>
    </div></div>`;
    const rapportino = rapportinoHtml(i, r);
    const foto = r ? fotoHtml(i, r) : '';
    const firma = r ? firmaHtml(r) : '';
    const storico = storicoHtml(i);

    // --- colonna destra
    const valore = r ? valoreHtml(i) : '';
    const cliente = `<div class="tessera"><div class="tt"><h3>${icona('edificio')} Cliente e luogo</h3><a class="btn pic" href="#/u/cliente/${h(c.id)}">Scheda</a></div><div class="cp uff-blocchi">
      <div><b style="font-size:15px">${h(c.nome)}</b>${c.referente ? `<div class="pic">${h(c.referente)}</div>` : ''}
        <div class="uff-recapiti" style="margin-top:6px">${c.telefono ? `<a href="${h(telLink(c.telefono))}">${icona('telefono', 'p')}${h(c.telefono)}</a>` : ''}${c.email ? `<a href="mailto:${h(c.email)}">${icona('posta', 'p')}${h(c.email)}</a>` : ''}</div></div>
      ${s ? `<div class="uff-blocco"><h4>${h(s.nome || 'Luogo')}</h4><div>${h(A.indirizzo(s))}${s.cap ? ' <span class="muto">' + h(s.cap) + '</span>' : ''}</div>
        <div class="btns" style="margin-top:8px"><a class="btn pic" href="${h(A.linkMappa(s))}" target="_blank" rel="noopener">${icona('mappa', 'p')} Apri in Google Maps</a><a class="btn pic" href="${h(A.linkNaviga(s))}" target="_blank" rel="noopener">${icona('naviga', 'p')} Indicazioni</a></div>
        ${s.noteAccesso ? `<div class="avviso warn" style="margin-top:10px">${icona('chiave')}<div><b>Come si entra:</b> ${h(s.noteAccesso)}</div></div>` : ''}
        ${s.referente || s.telefono ? `<div class="pic" style="margin-top:6px">Sul posto: ${h(s.referente || '')}${s.telefono ? ' · <a href="' + h(telLink(s.telefono)) + '">' + h(s.telefono) + '</a>' : ''}</div>` : ''}</div>` : ''}
    </div></div>`;
    const macchina = m ? macchinaHtml(i, m) : `<div class="tessera"><div class="tt"><h3>${icona('impianto')} La macchina</h3></div><div class="cp"><p class="muto" style="font-size:14px">Nessuna macchina indicata.</p></div></div>`;
    const com = comunicazioniHtml(i);
    const legami = (prev || prevNati.length || doc) ? `<div class="tessera"><div class="tt"><h3>${icona('graffetta')} Collegamenti</h3></div><div class="cp uff-blocchi">
      ${prev ? `<div>${icona('documento', 'p')} Nato dal preventivo <a href="#/u/preventivo/${h(prev.id)}"><b>N. ${h(prev.numero)}</b></a> ${A.statoPreventivo(prev.stato)}</div>` : ''}
      ${prevNati.map(p => `<div>${icona('documento', 'p')} Preventivo <a href="#/u/preventivo/${h(p.id)}"><b>N. ${h(p.numero)}</b></a> creato da qui ${A.statoPreventivo(p.stato)}</div>`).join('')}
      ${doc ? `<div>${icona('euro', 'p')} Nel documento di vendita <a href="#/u/documenti"><b>PRE-${h(doc.numero)}</b></a> ${A.pastiglia({ bozza: 'Bozza', pronto: 'Pronto', esportato: 'Esportato', fatturato: 'Fatturato', annullato: 'Annullato' }[doc.stato] || doc.stato, doc.stato === 'fatturato' ? 'grigio' : 'ok')}</div>` : ''}
    </div></div>` : '';

    const contenuto = `${testata}
      ${avvisi.length ? `<div class="uff-blocchi" style="margin-top:14px">${avvisi.join('')}</div>` : ''}
      <div class="griglia g-2-1 uff-gr uff-scheda">
        <div class="uff-colonna">${daFare}${rapportino}${foto}${firma}${storico}</div>
        <div class="uff-colonna">${valore}${cliente}${macchina}${com}${legami}</div>
      </div>`;
    return pagina({ attivo: 'interventi', titolo: 'Intervento N. ' + i.numero, briciole: [['Interventi', '#/u/interventi']], azioni: bottoneNuovo(), contenuto });
  }

  function rapportinoHtml(i, r) {
    const bozza = i.rapporto && i.rapporto.stato === 'bozza' ? i.rapporto : null;
    if (!r) {
      let testo = 'Il rapportino lo scrive il tecnico dal telefono alla fine del lavoro: quando lo invia compare qui, e arriva un avviso.';
      if (bozza && bozza.inizio) testo = 'Il tecnico ci sta lavorando (iniziato ' + A.quando(bozza.inizio) + '). Il rapportino è ancora sul suo telefono: compare qui quando lo invia.';
      if (i.stato === 'annullato') testo = 'Intervento annullato: nessun rapportino.';
      return `<div class="tessera"><div class="tt"><h3>${icona('verifica')} Rapportino</h3></div><div class="cp"><p class="muto" style="font-size:14px">${h(testo)}</p></div></div>`;
    }
    const min = A.minutiIntervento(i);
    const mats = r.materiali || [];
    let totMat = 0;
    const righeMat = mats.map(x => {
      const a = x.articoloId ? A.articolo(x.articoloId) : null; const pr = prezzoRiga(x); const t = A.arrot((Number(x.qta) || 0) * pr); totMat += t;
      return `<tr><td>${h(x.nome)}${a ? ` <span class="muto mono">${h(a.codice)}</span>` : ''}${x.da === 'fuori catalogo' ? ' ' + A.pastiglia('fuori catalogo', 'warn', true) : ''}</td><td class="num">${h(A.num(x.qta))} ${h(x.unita || '')}</td><td class="num">${h(A.euro(pr))}</td><td class="num">${h(A.euro(t))}</td></tr>`;
    }).join('');
    const corr = (r.correzioni || []).slice(-1)[0];
    return `<div class="tessera"><div class="tt"><h3>${icona('verifica')} Rapportino</h3><span class="pic">${r.stato === 'approvato' ? 'approvato ' + h(A.quando(r.approvatoIl)) + (r.approvatoDa ? ' da ' + h(A.nomeBreve((A.utenteDa(r.approvatoDa) || {}).nome || '')) : '') : 'inviato ' + h(A.quando(r.inviatoIl))}</span></div>
      <div class="cp uff-blocchi">
        ${corr ? `<div class="avviso">${icona('penna')}<div><b>Corretto dall'ufficio</b> ${h(A.quando(corr.data))}: ${h(corr.voci.map(v => v.voce + ' ' + v.prima + ' → ' + v.dopo).join('; '))}</div></div>` : ''}
        <div class="uff-blocco"><h4>Lavoro eseguito</h4><div class="uff-testo">${h(r.lavoro || '—')}</div></div>
        ${r.trovato ? `<div class="uff-blocco"><h4>Cosa ha trovato</h4><div class="uff-testo">${h(r.trovato)}</div></div>` : ''}
        ${r.consiglio ? `<div class="uff-blocco"><h4>Cosa consiglia</h4><div class="uff-testo">${h(r.consiglio)}</div></div>` : ''}
        <div class="uff-blocco"><h4>Esito</h4><div class="uff-pp">${A.pastiglia(A.ESITI[r.esito] || 'non indicato', r.esito === 'risolto' ? 'ok' : r.esito === 'non_eseguibile' ? 'dang' : 'warn')}${r.secondoIntervento ? A.pastiglia('Serve un secondo intervento', 'acc') : ''}</div></div>
        ${r.note ? `<div class="avviso">${icona('messaggio')}<div><b>Nota del tecnico per l'ufficio:</b> ${h(r.note)}</div></div>` : ''}
        <div class="uff-blocco"><h4>Ore</h4>
          <div class="tab-w"><table class="tab"><tbody>${Object.keys(A.TIPI_ORE).filter(k => min[k]).map(k => `<tr><td>${h(A.TIPI_ORE[k])}</td><td class="num">${h(A.durata(min[k]))}</td></tr>`).join('') || '<tr><td colspan="2" class="muto">Nessuna ora registrata</td></tr>'}</tbody>
          ${min.totale ? `<tfoot><tr><td>In tutto</td><td class="num">${h(A.durata(min.totale))}</td></tr></tfoot>` : ''}</table></div>
          ${r.inizio ? `<p class="pic" style="margin-top:6px">Sul posto dalle ${h(A.ora(r.inizio))} alle ${h(A.ora(r.fine))}</p>` : ''}</div>
        <div class="uff-blocco"><h4>Materiali usati</h4>
          ${mats.length ? `<div class="tab-w"><table class="tab"><thead><tr><th>Articolo</th><th class="num">Q.tà</th><th class="num">Prezzo</th><th class="num">Totale</th></tr></thead><tbody>${righeMat}</tbody><tfoot><tr><td colspan="3">Materiali a listino</td><td class="num">${h(A.euro(totMat))}</td></tr></tfoot></table></div>` : '<p class="muto" style="font-size:14px">Nessun materiale.</p>'}</div>
      </div></div>`;
  }
  function valoreHtml(i) {
    const v = A.valoreIntervento(i); const t = A.DB.azienda.tariffe; const min = A.minutiIntervento(i);
    const marg = A.arrot(v.materiali - v.costoMateriali);
    const pm = v.materiali ? Math.round(marg / v.materiali * 100) : 0;
    const listino = A.arrot(v.manodopera + v.uscita + v.materiali);
    return `<div class="tessera uff-valore"><div class="tt"><h3>${icona('euro')} Valore dell'intervento</h3></div><div class="cp">
      ${v.gratuito ? `<div class="avviso warn" style="margin-bottom:10px">${icona('info')}<div><b>${i.modalita === 'garanzia' ? 'In garanzia' : 'Compreso nel contratto'}:</b> al cliente non si addebita niente. A listino varrebbe ${h(A.euro(listino))}.</div></div>` : ''}
      ${i.tipo === 'sopralluogo' ? `<div class="avviso" style="margin-bottom:10px">${icona('info')}<div>I sopralluoghi non si fatturano: il valore serve solo a sapere quanto costano.</div></div>` : ''}
      <div class="riga"><span>Manodopera <span class="muto">${h(A.oreDecimali(min.lavoro + min.straordinario))} h × ${h(A.euro(t.manodopera))}${min.straordinario ? ' (straord. ' + h(A.euro(t.straordinario)) + ')' : ''}</span></span><span>${h(A.euro(v.manodopera))}</span></div>
      <div class="riga"><span>Uscita</span><span>${h(A.euro(v.uscita))}</span></div>
      <div class="riga"><span>Materiali</span><span>${h(A.euro(v.materiali))}</span></div>
      <div class="riga tot"><span>${v.gratuito ? 'Al cliente' : 'Totale'} <span class="muto" style="font-size:12.5px;font-weight:500">IVA esclusa</span></span><span>${h(A.euro(v.totale))}</span></div>
      <div class="sep"></div>
      <div class="riga sec"><span>Costo d'acquisto dei materiali</span><span>${h(A.euro(v.costoMateriali))}</span></div>
      <div class="riga marg"><span>Margine sui materiali${v.materiali ? ' <span class="muto">(' + pm + '%)</span>' : ''}</span><span>${h(A.euro(marg))}</span></div>
      ${A.DB.azienda.prezziDiEsempio ? '<p class="pic" style="margin-top:8px">Tariffe e prezzi di esempio: da sostituire con il listino vero di IDRAL.</p>' : ''}
    </div></div>`;
  }
  function fotoHtml(i, r) {
    const lista = r.foto || [];
    const vis = lista.filter(f => f.visibileCliente).length;
    return `<div class="tessera"><div class="tt"><h3>${icona('fotocamera')} Foto <span class="uff-conta">${lista.length}</span></h3>${lista.length ? `<span class="pic">${vis} visibili al cliente</span>` : ''}</div><div class="cp">
      ${lista.length ? `<p class="pic" style="margin:-4px 0 12px">Le foto nascono visibili solo all'ufficio: nell'inquadratura può esserci la casa del cliente. Apri solo quelle che servono a lui.</p>
      <div class="uff-foto-g">${lista.map(f => `<figure>
          <div class="foto"><img src="${h(f.src)}" alt="Foto ${h(A.FASI_FOTO[f.fase] || f.fase || '')}" loading="lazy"><span class="tag">${h(A.FASI_FOTO[f.fase] || f.fase || 'Foto')}</span>${f.visibileCliente ? `<span class="vis si">${icona('occhio', 'p')}</span>` : ''}<button type="button" data-az="uff-foto-grande" data-id="${h(i.id)}" data-f="${h(f.id)}" aria-label="Ingrandisci"></button></div>
          <label class="uff-interr"><input type="checkbox" role="switch" data-cambia="uff-foto-vis" data-id="${h(i.id)}" data-f="${h(f.id)}"${f.visibileCliente ? ' checked' : ''}> Visibile al cliente</label>
        </figure>`).join('')}</div>` : '<p class="muto" style="font-size:14px">Il tecnico non ha allegato foto.</p>'}
    </div></div>`;
  }
  function firmaHtml(r) {
    const f = r.firma;
    let corpo;
    if (f && !f.assente && f.png) corpo = `<div style="display:flex;gap:18px;align-items:flex-end;flex-wrap:wrap"><img class="firma-img" src="${h(f.png)}" alt="Firma di ${h(f.nome)}"><div style="font-size:14px"><b>${h(f.nome || '—')}</b>${f.qualifica ? `<div class="muto">${h(f.qualifica)}</div>` : ''}<div class="pic">${h(A.dataOra(f.data))}</div></div></div><p class="pic" style="margin-top:10px">Firma elettronica semplice raccolta sul telefono del tecnico.</p>`;
    else if (f && f.assente) corpo = `<div class="avviso dang">${icona('attenzione')}<div><b>Cliente non presente alla firma.</b><br>Motivo: ${h(f.motivo || 'non indicato')}</div></div>`;
    else corpo = `<div class="avviso dang">${icona('attenzione')}<div><b>Nessuna firma.</b> Il rapportino è arrivato senza la firma del cliente.</div></div>`;
    return `<div class="tessera"><div class="tt"><h3>${icona('penna')} Firma del cliente</h3></div><div class="cp">${corpo}</div></div>`;
  }
  function macchinaHtml(i, m) {
    const oggi = A.oggi();
    const inGar = m.garanziaFino && m.garanziaFino >= oggi;
    const prima = A.DB.interventi.filter(x => x.id !== i.id && x.impiantoId === m.id && x.rapporto && x.data && FATTI.includes(x.stato)).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 4);
    return `<div class="tessera"><div class="tt"><h3>${icona('impianto')} La macchina</h3>${inGar ? A.pastiglia('in garanzia', 'ok') : ''}</div><div class="cp uff-blocchi">
      <div><b style="font-size:15px">${h(m.marca + ' ' + m.modello)}</b><div class="pic">${h(cap(m.categoria || ''))}${m.potenzaKw ? ' · ' + h(m.potenzaKw) + ' kW' : ''}${m.combustibile ? ' · ' + h(m.combustibile) : ''}</div></div>
      <dl class="dl">
        ${m.matricola ? `<dt>Matricola</dt><dd class="mono">${h(m.matricola)}</dd>` : ''}
        ${m.installato ? `<dt>Installata</dt><dd>${h(A.data(m.installato))}</dd>` : ''}
        ${m.garanziaFino ? `<dt>Garanzia</dt><dd>fino al ${h(A.data(m.garanziaFino))}</dd>` : ''}
        ${m.ultimaManutenzione ? `<dt>Ultima manut.</dt><dd>${h(A.data(m.ultimaManutenzione))}</dd>` : ''}
        ${m.prossimaManutenzione ? `<dt>Prossima</dt><dd>${h(A.data(m.prossimaManutenzione))}${m.prossimaManutenzione < oggi ? ' ' + A.pastiglia('scaduta', 'dang') : ''}</dd>` : ''}
      </dl>
      ${m.note ? `<div class="uff-testo" style="font-size:13.5px;color:var(--ink-2)">${h(m.note)}</div>` : ''}
      ${prima.length ? `<div><div class="uff-sez-t">Interventi precedenti</div><ul class="uff-com">${prima.map(x => `<li><div class="cx1"><a href="#/u/intervento/${h(x.id)}"><b>${h(A.data(x.data))}</b></a> · ${h(nomeTipo(x.tipo))}<div class="pic">${h(taglia((x.rapporto || {}).lavoro || x.richiesta, 90))}</div></div></li>`).join('')}</ul></div>` : ''}
    </div></div>`;
  }
  function comunicazioniHtml(i) {
    const note = A.DB.note.filter(n => n.interventoId === i.id).sort((a, b) => String(b.data).localeCompare(String(a.data)));
    const mat = A.DB.richiesteMateriale.filter(x => x.interventoId === i.id).sort((a, b) => String(b.data).localeCompare(String(a.data)));
    if (!note.length && !mat.length) return `<div class="tessera"><div class="tt"><h3>${icona('messaggio')} Comunicazioni del tecnico</h3></div><div class="cp"><p class="muto" style="font-size:14px">Nessuna nota e nessun materiale da ordinare su questo lavoro.</p></div></div>`;
    const nonLette = note.filter(n => !n.letta).length;
    return `<div class="tessera"><div class="tt"><h3>${icona('messaggio')} Comunicazioni del tecnico ${nonLette ? `<span class="uff-conta acc">${nonLette}</span>` : ''}</h3></div><div class="cp"><ul class="uff-com">
      ${note.map(n => { const t = A.utenteDa(n.autoreId) || {}; return `<li class="${n.letta ? '' : 'nonletta'}">${avatarTec(n.autoreId)}<div class="cx1"><div class="pic"><b style="color:var(--ink-2)">${h(A.nomeBreve(t.nome || 'Tecnico'))}</b> · ${h(A.quando(n.data))} ${n.urgente ? A.pastiglia('urgente', 'dang') : ''}</div><div class="tx">${h(n.testo)}</div>
        ${n.letta ? `<span class="pic">${icona('spunta', 'p')} Letta</span>` : `<button class="btn pic" type="button" data-az="uff-nota-letta" data-id="${h(n.id)}">${icona('spunta', 'p')} Segna letta</button>`}</div></li>`; }).join('')}
      ${mat.map(x => { const t = A.utenteDa(x.tecnicoId) || {}; const st = STATI_MAT[x.stato] || [x.stato, 'grigio']; const ur = URG_MAT[x.urgenza] || URG_MAT.normale; return `<li><span class="uff-ric-ic" style="width:26px;height:26px;flex-basis:26px;border-radius:8px">${icona('carrello', 'p')}</span><div class="cx1"><div class="pic"><b style="color:var(--ink-2)">Materiale da ordinare</b> · ${h(A.nomeBreve(t.nome || ''))} · ${h(A.quando(x.data))}</div><div class="tx">${h(x.descrizione)} × ${h(A.num(x.qta))} ${h(x.unita || '')}${x.note ? '\n' + h(x.note) : ''}</div>
        <div class="uff-pp">${A.pastiglia(ur[0], ur[1])}${A.pastiglia(st[0], st[1])}${x.stato === 'nuova' ? `<button class="btn pic" type="button" data-az="uff-mat-presa" data-id="${h(x.id)}">Presa in carico</button>` : ''}<a class="pic" href="#/u/materiale">Ordini e materiale →</a></div></div></li>`; }).join('')}
    </ul></div></div>`;
  }
  const NOMI_STORICO = Object.assign({ creato: 'Creato' }, Object.fromEntries(Object.keys(A.STATI_INTERVENTO).map(k => [k, A.STATI_INTERVENTO[k][0]])));
  function storicoHtml(i) {
    const st = (i.storico || []).slice().sort((a, b) => String(a.data).localeCompare(String(b.data)));
    const tono = s => ['approvato', 'valorizzato', 'fatturato', 'completato'].includes(s) ? 'ok' : s === 'annullato' ? 'dang' : IN_CAMPO.includes(s) ? 'acc' : '';
    return `<div class="tessera"><div class="tt"><h3>${icona('storico')} Storico</h3></div><div class="cp"><ol class="uff-linea">
      ${st.map(x => { const u = x.utenteId ? A.utenteDa(x.utenteId) : null; return `<li class="${tono(x.stato)}"><b>${h(NOMI_STORICO[x.stato] || x.stato)}</b> <span class="pic" style="display:inline">· ${h(A.dataOra(x.data))}${u ? ' · ' + h(u.nome) : ''}</span>${x.nota ? `<div class="nota">${h(x.nota)}</div>` : ''}</li>`; }).join('') || '<li>Nessun passaggio registrato.</li>'}
    </ol></div></div>`;
  }

  // ---- stampa
  function paginaStampa(par) {
    const i = A.intervento(par.id);
    if (!i || !i.rapporto || i.rapporto.stato === 'bozza') { location.replace('#/u/intervento/' + par.id); return false; }
    stile();
    return A.guscioUfficio({ attivo: 'interventi', titolo: 'Rapportino N. ' + i.numero, briciole: [['Interventi', '#/u/interventi'], ['N. ' + i.numero, '#/u/intervento/' + i.id]], contenuto: A.paginaStampa(A.foglioRapportino(i), '#/u/intervento/' + i.id) });
  }

  // ---- azioni della scheda
  A.azione('uff-foto-vis', el => {
    const acceso = !!el.checked;
    A.modifica(db => {
      const i = db.interventi.find(x => x.id === el.dataset.id); if (!i || !i.rapporto) return;
      const f = (i.rapporto.foto || []).find(x => x.id === el.dataset.f); if (!f) return;
      f.visibileCliente = acceso;
      A.registra(acceso ? 'foto resa visibile al cliente' : 'foto nascosta al cliente', 'Intervento ' + i.numero + ' — ' + nomeCli(i) + ' (' + (A.FASI_FOTO[f.fase] || f.fase) + ')');
    });
    A.toast(acceso ? 'Il cliente ora vede questa foto' : 'Foto di nuovo solo interna', 'ok');
    A.render();
  });
  A.azione('uff-foto-grande', el => {
    const i = A.intervento(el.dataset.id); if (!i || !i.rapporto) return;
    const f = (i.rapporto.foto || []).find(x => x.id === el.dataset.f); if (!f) return;
    A.modale({ titolo: (A.FASI_FOTO[f.fase] || 'Foto') + ' — ' + nomeCli(i), largo: true, corpo: `<div class="uff-grande"><img src="${h(f.src)}" alt=""></div><p class="pic" style="margin-top:8px">Scattata ${h(A.quando(f.data))} · ${f.visibileCliente ? 'visibile al cliente' : 'solo per l\'ufficio'}</p>` });
  });
  A.azione('uff-nota-letta', el => {
    A.modifica(db => { const n = db.note.find(x => x.id === el.dataset.id); if (n) n.letta = true; });
    A.render();
  });
  A.azione('uff-mat-presa', el => {
    A.modifica(db => { const x = db.richiesteMateriale.find(y => y.id === el.dataset.id); if (!x) return; x.stato = 'presa'; A.registra('materiale preso in carico', x.descrizione + ' ×' + A.num(x.qta)); });
    A.toast('Materiale preso in carico', 'ok'); A.render();
  });

  // Modifica / Pianifica
  A.azione('uff-modifica', el => {
    const i = A.intervento(el.dataset.id); if (!i) return;
    const imps = A.impiantiDi(i.clienteId);
    A.modale({
      titolo: (i.stato === 'da_pianificare' ? 'Pianifica' : 'Modifica') + ' — ' + nomeCli(i), largo: true, form: 'uff-mod-salva',
      corpo: `<input type="hidden" name="id" value="${h(i.id)}"><div class="uff-ni-g">
        <div>
          <div class="riga-campi">
            <div class="campo"><label for="uff-m-d">Giorno</label><input id="uff-m-d" type="date" name="data" value="${h(i.data || '')}"></div>
            <div class="campo"><label for="uff-m-o">Ora</label><input id="uff-m-o" type="time" name="ora" step="900" value="${h(i.ora || '')}"></div>
          </div>
          <div class="campo"><label for="uff-m-du">Durata prevista</label><select id="uff-m-du" name="durataMin">${opzDurata(i.durataMin || 60)}</select></div>
          <div class="campo"><span class="etichetta">Tecnici</span>${campiTecnici(i.tecnici)}<span class="aiuto">Se cambiano giorno o tecnici, i tecnici ricevono un avviso.</span></div>
          <div class="riga-campi">
            <div class="campo"><label for="uff-m-t">Tipo</label><select id="uff-m-t" name="tipo">${Object.keys(A.TIPI_INTERVENTO).map(k => `<option value="${k}"${i.tipo === k ? ' selected' : ''}>${h(A.TIPI_INTERVENTO[k])}</option>`).join('')}</select></div>
            <div class="campo"><label for="uff-m-p">Priorità</label><select id="uff-m-p" name="priorita">${Object.keys(A.PRIORITA).map(k => `<option value="${k}"${i.priorita === k ? ' selected' : ''}>${A.PRIORITA[k][0]}</option>`).join('')}</select></div>
          </div>
        </div>
        <div>
          <div class="campo"><span class="etichetta">Come si fa pagare</span><div class="scelte">${Object.keys(MODALITA).map(k => `<label class="scelta"><input type="radio" name="modalita" value="${k}"${(i.modalita || 'misura') === k ? ' checked' : ''}><span>${h(MODALITA[k])}</span></label>`).join('')}</div></div>
          ${imps.length ? `<div class="campo"><label for="uff-m-i">Macchina</label><select id="uff-m-i" name="impiantoId"><option value="">— nessuna in particolare —</option>${imps.map(x => `<option value="${h(x.id)}"${i.impiantoId === x.id ? ' selected' : ''}>${h(x.marca + ' ' + x.modello)}${x.matricola ? ' · ' + h(x.matricola) : ''}</option>`).join('')}</select></div>` : ''}
          <div class="campo"><label for="uff-m-r">Cosa chiede il cliente</label><textarea id="uff-m-r" name="richiesta" rows="3">${h(i.richiesta || '')}</textarea></div>
          <div class="campo"><label for="uff-m-n">Note interne <span class="muto">(il cliente non le vede)</span></label><textarea id="uff-m-n" name="noteInterne" rows="2">${h(i.noteInterne || '')}</textarea></div>
        </div></div>`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: 'Salva', classe: 'pri', tipo: 'submit', icona: 'spunta' }]
    });
  });
  A.azione('uff-mod-salva', (f, ev, d) => {
    const tecnici = Array.from(f.querySelectorAll('input[name=tecnici]:checked')).map(x => x.value);
    const n = { data: d.data || null, ora: d.ora || '', durataMin: Number(d.durataMin) || 60, tecnici, tipo: d.tipo, priorita: d.priorita, modalita: d.modalita || 'misura', richiesta: String(d.richiesta || '').trim(), noteInterne: String(d.noteInterne || '').trim() };
    if ('impiantoId' in d) n.impiantoId = d.impiantoId || null;
    const es = salvaModifiche(d.id, n);
    A.chiudiModale(); esitoSalvataggio(es); A.render();
  });

  // Annulla / ripristina
  A.azione('uff-annulla', el => {
    const i = A.intervento(el.dataset.id); if (!i) return;
    A.modale({ titolo: 'Annullare l\'intervento N. ' + i.numero + '?', form: 'uff-annulla-ok', corpo: `<input type="hidden" name="id" value="${h(i.id)}">
      <p style="margin-bottom:12px"><b>${h(nomeCli(i))}</b> — ${h(nomeTipo(i.tipo).toLowerCase())}${i.data ? ', ' + h(giornoParlato(i.data)) + (i.ora ? ' alle ' + h(i.ora) : '') : ''}.${(i.tecnici || []).length && i.data ? ' ' + h(A.nomeTecnici(i.tecnici)) + ' riceve un avviso.' : ''}</p>
      <div class="campo"><label for="uff-an-m">Perché (facoltativo)</label><input id="uff-an-m" type="text" name="motivo" placeholder="Il cliente ha disdetto"></div>`,
      azioni: [{ testo: 'Lascia com\'è', chiudi: true }, { testo: 'Annulla l\'intervento', classe: 'per', tipo: 'submit' }] });
  });
  A.azione('uff-annulla-ok', (f, ev, d) => {
    A.modifica(db => {
      const i = db.interventi.find(x => x.id === d.id); if (!i) return;
      const prima = istantanea(i); const motivo = String(d.motivo || '').trim();
      passaA(i, 'annullato', motivo || '');
      if (motivo) i.motivoAnnullo = motivo;
      avvisaCambi(db, i, prima);
      A.registra('intervento annullato', 'N. ' + i.numero + ' — ' + nomeCli(i) + (motivo ? ': ' + motivo : ''));
    });
    A.chiudiModale(); A.toast('Intervento annullato', 'ok'); A.render();
  });
  A.azione('uff-ripristina', el => {
    let n;
    A.modifica(db => {
      const i = db.interventi.find(x => x.id === el.dataset.id); if (!i) return;
      const prima = { data: null, ora: i.ora, tecnici: [], stato: 'annullato' };
      passaA(i, i.data && (i.tecnici || []).length ? 'pianificato' : 'da_pianificare', 'ripristinato');
      delete i.motivoAnnullo;
      avvisaCambi(db, i, prima);
      A.registra('intervento ripristinato', 'N. ' + i.numero + ' — ' + nomeCli(i)); n = i.numero;
    });
    A.toast('Intervento ' + n + ' ripristinato', 'ok'); A.render();
  });

  // ---- approvazione
  /** Dentro A.modifica. Il cliente viene avvisato: il rapportino e' suo, da oggi lo vede. */
  function approvaIn(db, i, dettaglio) {
    const r = i.rapporto; const u = A.utente();
    r.stato = 'approvato'; r.approvatoIl = A.adesso(); r.approvatoDa = u.id;
    passaA(i, 'approvato');
    const c = db.clienti.find(x => x.id === i.clienteId) || {};
    A.registra(dettaglio ? 'rapportino corretto e approvato' : 'rapportino approvato', 'Intervento ' + i.numero + ' — ' + (c.nome || '') + (dettaglio ? ': ' + dettaglio : ''));
    const chi = String(c.tipo === 'privato' ? c.nome : (c.referente || c.nome) || '').replace(/\s*\(.*\)$/, '');
    const email = c.email && db.azienda.notificheEmail !== false ? {
      a: c.email, oggetto: 'IDRAL — il rapportino dell\'intervento del ' + A.data(i.data) + ' è disponibile',
      testo: 'Gentile ' + chi + ', il rapportino dell\'intervento N. ' + i.numero + ' (' + nomeTipo(i.tipo).toLowerCase() + ' del ' + A.data(i.data) + ') è disponibile nella sua area clienti: può leggerlo e scaricarlo quando vuole.\n' + linkAssoluto('#/c/intervento/' + i.id) + '\nIDRAL'
    } : null;
    A.avvisa('cliente:' + i.clienteId, 'Il rapportino è disponibile: ' + nomeTipo(i.tipo).toLowerCase() + ' del ' + A.data(i.data), '#/c/intervento/' + i.id, { tipo: 'rapportino', email });
  }
  async function approva(id, dalla) {
    const i = A.intervento(id); if (!i || !i.rapporto || i.rapporto.stato !== 'inviato') return;
    const gravi = anomalie(i, medieLavoro()).filter(a => a.tono === 'dang');
    if (gravi.length && !await A.conferma('<b>' + h(gravi.map(a => a.t).join(' · ')) + '</b><br>Il rapportino va al cliente così com\'è. Approvi lo stesso?', { ok: 'Approva lo stesso', titolo: 'Da guardare prima' })) return;
    A.modifica(db => approvaIn(db, db.interventi.find(x => x.id === id)));
    A.toast('Approvato: il cliente trova il rapportino nella sua area', 'ok');
    if (dalla) A.vai(dalla); else A.render();
  }
  A.azione('uff-approva', el => approva(el.dataset.id, el.dataset.poi));

  A.azione('uff-rimanda', el => {
    const i = A.intervento(el.dataset.id); if (!i) return;
    const an = anomalie(i, medieLavoro());
    const motivi = ['Manca la firma del cliente: richiamalo o spiega perché', 'Mancano le foto del prima e del dopo', 'Controlla le ore: sembrano troppe', 'Controlla i materiali usati', 'Scrivi meglio cosa hai fatto'];
    A.modale({ titolo: 'Rimanda il rapportino a ' + A.nomeTecnici(i.tecnici), form: 'uff-rimanda-ok', corpo: `<input type="hidden" name="id" value="${h(i.id)}">
      ${an.length ? `<div class="uff-chips" style="margin-bottom:12px">${chipAnomalie(an)}</div>` : ''}
      <div class="uff-motivi">${motivi.map(m => `<button type="button" data-az="uff-motivo" data-t="${h(m)}">${h(m.split(':')[0])}</button>`).join('')}</div>
      <div class="campo"><label for="uff-rm-m">Cosa deve correggere <span class="muto">(obbligatorio)</span></label><textarea id="uff-rm-m" name="motivo" rows="3" placeholder="Il tecnico lo legge sul telefono, in cima alla sua giornata."></textarea></div>
      <div id="uff-rm-err"></div>`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: 'Rimanda al tecnico', classe: 'per', tipo: 'submit', icona: 'indietro' }] });
  });
  A.azione('uff-rimanda-ok', (f, ev, d) => {
    const motivo = String(d.motivo || '').trim();
    if (motivo.length < 3) { A.$('#uff-rm-err').innerHTML = `<div class="avviso dang">${icona('attenzione')}<div>Scrivi cosa deve correggere: senza motivo il tecnico non sa cosa cambiare.</div></div>`; return; }
    A.modifica(db => {
      const i = db.interventi.find(x => x.id === d.id); if (!i || !i.rapporto) return;
      const r = i.rapporto; const u = A.utente();
      r.stato = 'rimandato'; r.motivoRimando = motivo; r.rimandatoIl = A.adesso(); r.rimandatoDa = u.id;
      passaA(i, 'in_corso', 'rapportino rimandato al tecnico: ' + motivo);
      (i.tecnici || []).forEach(t => A.avvisa(t, 'Rapportino da correggere — ' + nomeCli(i) + ': ' + taglia(motivo, 90), '#/t/rapportino/' + i.id, { tipo: 'rapportino' }));
      A.registra('rapportino rimandato', 'Intervento ' + i.numero + ' — ' + nomeCli(i) + ': ' + motivo);
    });
    A.chiudiModale(); A.toast('Rimandato: il tecnico lo trova in cima alla sua giornata', 'ok'); A.render();
  });

  // Correggi e approva: ore e quantita', con il prima e il dopo nel registro.
  A.azione('uff-correggi', el => {
    const i = A.intervento(el.dataset.id); if (!i || !i.rapporto) return;
    const r = i.rapporto;
    A.modale({ titolo: 'Correggi e approva — ' + nomeCli(i), form: 'uff-correggi-ok', corpo: `<input type="hidden" name="id" value="${h(i.id)}">
      <div class="uff-sez-t">Ore</div>
      ${(r.ore || []).map(o => `<div class="uff-corr-riga"><div>${h(A.TIPI_ORE[o.tipo] || o.tipo)}<div class="prima">dal tecnico: ${h(A.durata(o.minuti))}</div></div><div class="inps"><input type="number" name="oh_${h(o.id)}" min="0" max="23" value="${Math.floor((o.minuti || 0) / 60)}" aria-label="Ore ${h(A.TIPI_ORE[o.tipo] || o.tipo)}"> h <input type="number" name="om_${h(o.id)}" min="0" max="59" step="5" value="${(o.minuti || 0) % 60}" aria-label="Minuti ${h(A.TIPI_ORE[o.tipo] || o.tipo)}"> min</div></div>`).join('') || '<p class="muto">Nessuna ora registrata.</p>'}
      <div class="uff-sez-t" style="margin-top:18px">Materiali</div>
      ${(r.materiali || []).map(x => `<div class="uff-corr-riga"><div>${h(x.nome)}<div class="prima">dal tecnico: ${h(A.num(x.qta))} ${h(x.unita || '')}</div></div><div class="inps"><input type="number" name="mq_${h(x.id)}" min="0" step="any" value="${h(x.qta)}" aria-label="Quantità ${h(x.nome)}"> ${h(x.unita || '')}</div></div>`).join('') || '<p class="muto">Nessun materiale.</p>'}
      <p class="pic" style="margin-top:12px">Con 0 la riga sparisce. Ogni correzione resta nel registro con il prima e il dopo; il magazzino si riallinea con un movimento di correzione, mai cambiando quelli vecchi.</p>`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: 'Salva e approva', classe: 'ok', tipo: 'submit', icona: 'spunta' }] });
  });
  A.azione('uff-correggi-ok', (f, ev, d) => {
    const num = v => { const n = parseFloat(String(v === undefined ? '' : v).replace(',', '.')); return isFinite(n) && n >= 0 ? n : null; };
    let voci = [];
    A.modifica(db => {
      const i = db.interventi.find(x => x.id === d.id); if (!i || !i.rapporto) return;
      const r = i.rapporto;
      (r.ore || []).forEach(o => {
        const hh = num(d['oh_' + o.id]), mm = num(d['om_' + o.id]); if (hh === null && mm === null) return;
        const nuovi = Math.round((hh || 0) * 60 + (mm || 0));
        if (nuovi !== (o.minuti || 0)) { voci.push({ voce: 'Ore ' + (A.TIPI_ORE[o.tipo] || o.tipo).toLowerCase(), prima: A.durata(o.minuti), dopo: A.durata(nuovi) }); o.minuti = nuovi; }
      });
      r.ore = (r.ore || []).filter(o => o.minuti > 0);
      let matCambiati = false;
      (r.materiali || []).forEach(x => {
        const q = num(d['mq_' + x.id]); if (q === null || q === Number(x.qta)) return;
        voci.push({ voce: x.nome, prima: A.num(x.qta) + ' ' + (x.unita || ''), dopo: A.num(q) + ' ' + (x.unita || '') });
        x.qta = q; matCambiati = true;
      });
      r.materiali = (r.materiali || []).filter(x => Number(x.qta) > 0);
      if (matCambiati) allineaMagazzino(db, i);
      if (voci.length) (r.correzioni = r.correzioni || []).push({ data: A.adesso(), utenteId: A.utente().id, voci });
      approvaIn(db, i, voci.length ? voci.map(v => v.voce + ' ' + v.prima.trim() + ' → ' + v.dopo.trim()).join('; ') : '');
    });
    A.chiudiModale();
    A.toast(voci.length ? 'Corretto (' + voci.length + (voci.length === 1 ? ' voce' : ' voci') + ') e approvato' : 'Nessuna correzione: approvato così', 'ok');
    A.render();
  });
  /**
   * Stessa regola del telefono (tecnico.js): il magazzino si allinea al
   * rapportino con la DIFFERENZA fra voluto e gia' scaricato per questo
   * intervento. Append-only: un pezzo tolto torna con un «reso», mai
   * modificando lo scarico di ieri (§12.2).
   */
  function allineaMagazzino(db, i) {
    const furgone = A.magazzinoDiTecnico((i.tecnici || [])[0]);
    const sede = (db.magazzini || []).find(m => m.tipo === 'sede');
    const voluto = {}, gia = {};
    (i.rapporto.materiali || []).forEach(m => {
      if (!m.articoloId || m.da === 'fuori catalogo') return;
      const mag = m.da === 'deposito' ? sede : (furgone || sede); if (!mag) return;
      const k = m.articoloId + '|' + mag.id; voluto[k] = (voluto[k] || 0) + (Number(m.qta) || 0);
    });
    db.movimenti.forEach(mv => {
      if (mv.interventoId !== i.id || (mv.tipo !== 'scarico' && mv.tipo !== 'reso')) return;
      const k = mv.articoloId + '|' + mv.magazzinoId; gia[k] = (gia[k] || 0) - (Number(mv.qta) || 0);
    });
    new Set(Object.keys(voluto).concat(Object.keys(gia))).forEach(k => {
      const delta = Math.round(((voluto[k] || 0) - (gia[k] || 0)) * 1000) / 1000; if (!delta) return;
      const [articoloId, magazzinoId] = k.split('|');
      A.registraMovimento({ articoloId, magazzinoId, qta: -delta, tipo: delta > 0 ? 'scarico' : 'reso', rif: 'Intervento ' + i.numero, nota: 'Correzione del rapportino in ufficio', controparte: '', interventoId: i.id });
    });
  }

  // ---- crea preventivo dal consiglio del tecnico
  A.azione('uff-crea-prev', el => {
    const i = A.intervento(el.dataset.id); if (!i || !i.rapporto) return;
    const r = i.rapporto; const cons = String(r.consiglio || '').trim();
    const utile = cons && !/^(nessun|nessuna|—|-)/i.test(cons);
    let pid;
    A.modifica(db => {
      const u = A.utente();
      const righe = [];
      if (utile) righe.push({ id: A.uid('rp'), tipo: 'nota', descrizione: 'Dal rapportino del ' + A.data(i.data) + ': ' + cons, qta: 0, unita: '', prezzo: 0, iva: 22, sconto: 0, opzionale: false, scelta: false });
      (r.materiali || []).forEach(x => {
        const a = x.articoloId ? A.articolo(x.articoloId) : null;
        righe.push({ id: A.uid('rp'), tipo: 'materiale', articoloId: x.articoloId || null, descrizione: a ? (a.marca && a.marca !== 'generica' ? a.marca + ' ' : '') + a.nome : x.nome, qta: Number(x.qta) || 1, unita: x.unita || 'pz', prezzo: prezzoRiga(x), iva: 22, sconto: 0, opzionale: false, scelta: false });
      });
      pid = A.uid('prv');
      db.preventivi.push({
        id: pid, numero: A.numera('PRV'), versione: 1, clienteId: i.clienteId, sedeId: i.sedeId,
        oggetto: utile ? taglia(cons.replace(/\.$/, ''), 90) : 'Lavori dopo l\'intervento N. ' + i.numero,
        righe, stato: 'bozza', creato: A.adesso(), inviatoIl: null, vistoIl: null, decisoIl: null, validoFino: A.piuGiorni(A.oggi(), 30),
        note: 'Nato dall\'intervento N. ' + i.numero + ' del ' + A.data(i.data) + '.', condizioni: 'Validità 30 giorni. Pagamento: 30% all\'accettazione, saldo a fine lavori. Prezzi IVA esclusa.',
        decisione: null, eventi: [{ tipo: 'creato', data: A.adesso(), chi: u.nome }], interventoId: null, daInterventoId: i.id
      });
      A.registra('preventivo creato da intervento', 'Intervento ' + i.numero + ' — ' + nomeCli(i));
    });
    A.toast('Bozza di preventivo creata: completala e mandala', 'ok');
    A.vai('#/u/preventivo/' + pid);
  });
  A.azione('uff-duplica', el => {
    const i = A.intervento(el.dataset.id); if (!i) return;
    A.apriNuovoIntervento({ clienteId: i.clienteId, sedeId: i.sedeId, impiantoId: i.impiantoId, tipo: i.tipo, priorita: i.priorita, richiesta: i.richiesta, tecnici: (i.tecnici || []).slice(), durataMin: i.durataMin, noteInterne: i.noteInterne, modalita: i.modalita, origine: 'ufficio' });
  });

  // ===========================================================================
  // 6. RAPPORTINI — la coda di approvazione
  // ===========================================================================
  function paginaRapportini(par) {
    segnaLettiQui();
    const sc = ['attesa', 'rimandati', 'approvati'].includes(par.q.s) ? par.q.s : 'attesa';
    const medie = medieLavoro();
    const da = daApprovare().sort((a, b) => String(a.rapporto.inviatoIl).localeCompare(String(b.rapporto.inviatoIl)));
    const rim = A.DB.interventi.filter(i => i.rapporto && i.rapporto.stato === 'rimandato').sort((a, b) => String(b.rapporto.rimandatoIl || '').localeCompare(String(a.rapporto.rimandatoIl || '')));
    const limite = new Date(Date.now() - 14 * 86400000).toISOString();
    const app = A.DB.interventi.filter(i => i.rapporto && i.rapporto.stato === 'approvato' && i.rapporto.approvatoIl && i.rapporto.approvatoIl >= limite).sort((a, b) => String(b.rapporto.approvatoIl).localeCompare(String(a.rapporto.approvatoIl))).slice(0, 30);
    const puliti = da.filter(i => !anomalie(i, medie).length);
    const lista = sc === 'attesa' ? da : sc === 'rimandati' ? rim : app;
    const schede = `<nav class="schede">
      <a href="#/u/rapportini" class="${sc === 'attesa' ? 'on' : ''}">Da approvare <span class="uff-conta ${da.length ? 'acc' : ''}">${da.length}</span></a>
      <a href="#/u/rapportini?s=rimandati" class="${sc === 'rimandati' ? 'on' : ''}">Rimandati <span class="uff-conta">${rim.length}</span></a>
      <a href="#/u/rapportini?s=approvati" class="${sc === 'approvati' ? 'on' : ''}">Approvati di recente <span class="uff-conta">${app.length}</span></a></nav>`;
    const testa = sc === 'attesa' && da.length ? `<div class="intestazione-pagina"><div><p style="margin:0">Il cliente vede il rapportino solo dopo l'approvazione. Le anomalie non bloccano: dicono dove guardare.</p></div>
      <button class="btn ok" type="button" data-az="uff-approva-tutti"${puliti.length ? '' : ' disabled'}>${icona('spunta')} Approva tutti quelli senza anomalie (${puliti.length})</button></div>` : '';
    const card = i => {
      const r = i.rapporto; const an = sc === 'attesa' ? anomalie(i, medie) : []; const m = A.minutiIntervento(i);
      const grave = an.some(a => a.tono === 'dang');
      const quando = sc === 'attesa' ? 'inviato ' + A.quando(r.inviatoIl) : sc === 'rimandati' ? 'rimandato ' + A.quando(r.rimandatoIl) : 'approvato ' + A.quando(r.approvatoIl);
      return `<article class="tessera uff-rap ${grave ? 'grave' : an.length ? 'anom' : ''}">
        <div class="cp">
          <div class="uff-rap-t"><div style="min-width:0"><h3><a href="#/u/intervento/${h(i.id)}" style="color:inherit">${h(nomeCli(i))}</a></h3><div class="pic">N. ${h(i.numero)} · ${h(A.data(i.data))} · ${h(quando)}</div></div>${A.pastiglia(nomeTipo(i.tipo), 'grigio', true)}</div>
          <div class="uff-rap-meta">${tecniciHtml(i.tecnici, 2)}</div>
          <div class="uff-cifre"><div><small>Esito</small><b>${h(A.ESITI[r.esito] || '—')}</b></div><div><small>Ore</small><b>${h(A.durata(m.totale))}</b></div><div><small>Materiali</small><b>${(r.materiali || []).length}</b></div><div><small>Foto</small><b>${(r.foto || []).length}</b></div></div>
          ${sc === 'attesa' ? `<div class="uff-chips">${chipAnomalie(an)}</div>` : ''}
          ${sc === 'rimandati' ? `<div class="avviso warn">${icona('indietro')}<div>«${h(r.motivoRimando || '')}»<br><span style="font-size:13px">In attesa che il tecnico lo corregga.</span></div></div>` : ''}
          ${sc === 'approvati' ? `<div class="pic">Approvato da ${h((A.utenteDa(r.approvatoDa) || {}).nome || '—')} · valore ${h(A.euro(A.valoreIntervento(i).totale))}</div>` : ''}
        </div>
        <div class="uff-ric-az"><div class="esito"></div><a class="btn pic" href="#/u/intervento/${h(i.id)}">Apri</a>${sc === 'attesa' ? `<button class="btn pic ok" type="button" data-az="uff-approva" data-id="${h(i.id)}">${icona('spunta', 'p')} Approva</button>` : ''}</div>
      </article>`;
    };
    const vuoti = { attesa: ['Nessun rapportino da approvare', 'Quando un tecnico chiude un lavoro, il rapportino arriva qui con un avviso.'], rimandati: ['Nessun rapportino rimandato', 'I rapportini che rimandi al tecnico restano qui finché non li corregge.'], approvati: ['Nessun rapportino approvato di recente', 'Qui compaiono quelli approvati negli ultimi 14 giorni.'] };
    const corpo = lista.length ? `<div class="uff-rap-g">${lista.map(card).join('')}</div>` : `<div class="tessera">${A.vuoto(vuoti[sc][0], vuoti[sc][1], 'verifica')}</div>`;
    return pagina({ attivo: 'rapportini', titolo: 'Rapportini', briciole: [['Lavoro', '#/u/cruscotto']], azioni: bottoneNuovo(), contenuto: testa + schede + corpo });
  }
  A.azione('uff-approva-tutti', async () => {
    const medie = medieLavoro();
    const ids = daApprovare().filter(i => !anomalie(i, medie).length).map(i => i.id);
    if (!ids.length) return;
    if (!await A.conferma('Approvi ' + ids.length + (ids.length === 1 ? ' rapportino' : ' rapportini') + ' senza anomalie (firma presente, ore nella norma, foto allegate, lavoro risolto)? I clienti vengono avvisati.', { ok: 'Approva ' + ids.length, titolo: 'Approvazione di gruppo' })) return;
    A.modifica(db => ids.forEach(id => { const i = db.interventi.find(x => x.id === id); if (i && i.rapporto && i.rapporto.stato === 'inviato') approvaIn(db, i); }));
    A.toast(ids.length + (ids.length === 1 ? ' rapportino approvato' : ' rapportini approvati'), 'ok'); A.render();
  });

  // ===========================================================================
  // 7. MAPPA — il giro del giorno
  // ===========================================================================
  let promessaLeaflet = null, mappaViva = null;
  /** Leaflet si carica solo qui, una volta sola. Senza rete: si vive senza mappa. */
  function caricaLeaflet() {
    if (window.L && window.L.map) return Promise.resolve(window.L);
    if (promessaLeaflet) return promessaLeaflet;
    promessaLeaflet = new Promise((res, rej) => {
      if (!document.getElementById('uff-leaflet-css')) {
        const l = document.createElement('link'); l.id = 'uff-leaflet-css'; l.rel = 'stylesheet'; l.href = LEAFLET.css; l.integrity = LEAFLET.cssSri; l.crossOrigin = '';
        document.head.appendChild(l);
      }
      const s = document.createElement('script'); s.src = LEAFLET.js; s.integrity = LEAFLET.jsSri; s.crossOrigin = ''; s.async = true;
      const t = setTimeout(() => { s.remove(); rej(new Error('Leaflet non arriva')); }, 9000);
      s.onload = () => { clearTimeout(t); if (window.L && window.L.map) res(window.L); else rej(new Error('Leaflet incompleto')); };
      s.onerror = () => { clearTimeout(t); s.remove(); rej(new Error('Leaflet non raggiungibile')); };
      document.head.appendChild(s);
    });
    // Se fallisce si potra' riprovare alla prossima apertura (la rete puo' tornare).
    promessaLeaflet.catch(() => { promessaLeaflet = null; });
    return promessaLeaflet;
  }
  function giriDelGiorno(g) {
    const del = A.DB.interventi.filter(i => i.data === g && i.stato !== 'annullato').sort(perOra);
    const giri = A.tecnici().map(t => ({ t, tappe: del.filter(i => (i.tecnici || []).includes(t.id)) })).filter(x => x.tappe.length);
    const senza = del.filter(i => !(i.tecnici || []).length);
    return { del, giri, senza };
  }
  const coord = s => s && typeof s.lat === 'number' && typeof s.lng === 'number' ? s.lat + ',' + s.lng : null;
  function linkGiro(tappe) {
    const punti = tappe.map(i => { const s = A.sede(i.sedeId); return coord(s) || (s ? A.indirizzo(s) : ''); }).filter(Boolean);
    if (!punti.length) return '';
    const dest = punti[punti.length - 1], via = punti.slice(0, -1);
    return 'https://www.google.com/maps/dir/?api=1&origin=' + DEPOSITO.lat + ',' + DEPOSITO.lng + '&destination=' + encodeURIComponent(dest) + (via.length ? '&waypoints=' + via.map(encodeURIComponent).join('%7C') : '') + '&travelmode=driving';
  }
  function paginaMappa(par) {
    const oggi = A.oggi();
    const g = /^\d{4}-\d{2}-\d{2}$/.test(par.q.g || '') ? par.q.g : oggi;
    const { del, giri, senza } = giriDelGiorno(g);
    const senzaPos = del.filter(i => !coord(A.sede(i.sedeId)));
    const tappa = (i, n, col) => { const s = A.sede(i.sedeId); return `<li><span class="n" style="background:${col}">${n}</span><span class="o">${h(i.ora || '—')}</span><span class="c"><a href="#/u/intervento/${h(i.id)}">${h(nomeCli(i))}</a><small class="pic">${h(s ? A.indirizzo(s) : '')} · ${h(nomeTipo(i.tipo))}</small><span style="display:inline-block;margin-top:3px">${A.statoIntervento(i.stato)}</span></span></li>`; };
    const elenco = giri.map(({ t, tappe }) => {
      const col = coloreDi(t);
      const link = linkGiro(tappe);
      return `<div class="tessera uff-giro"><div class="tt"><h3>${avatarTec(t.id)} ${h(t.nome)}</h3><span class="pic">${tappe.length} ${tappe.length === 1 ? 'tappa' : 'tappe'}</span></div>
        <ol>${tappe.map((i, k) => tappa(i, k + 1, col)).join('')}</ol>
        ${link ? `<div class="piede"><a class="btn pic largo" href="${h(link)}" target="_blank" rel="noopener">${icona('naviga', 'p')} Apri il giro in Google Maps</a></div>` : ''}</div>`;
    }).join('') + (senza.length ? `<div class="tessera uff-giro"><div class="tt"><h3>Senza tecnico</h3></div><ol>${senza.map((i, k) => tappa(i, k + 1, 'var(--ink-3)')).join('')}</ol></div>` : '');
    const contenuto = `
      <div class="intestazione-pagina">
        <div><div class="uff-sett">${h(cap(A.dataLunga(g)))}${g === oggi ? ' · oggi' : ''}</div><p>${del.length} ${del.length === 1 ? 'lavoro' : 'lavori'}, ${giri.length} ${giri.length === 1 ? 'tecnico' : 'tecnici'} in giro · partenza dal deposito di Via Villagrazia</p></div>
        <div class="uff-giorno-nav">
          <a class="btn icona" href="#/u/mappa?g=${A.piuGiorni(g, -1)}" aria-label="Giorno prima">${icona('sinistra')}</a>
          <input type="date" value="${g}" data-cambia="uff-mappa-giorno" aria-label="Scegli il giorno">
          <a class="btn icona" href="#/u/mappa?g=${A.piuGiorni(g, 1)}" aria-label="Giorno dopo">${icona('destra')}</a>
          ${g !== oggi ? '<a class="btn" href="#/u/mappa">Oggi</a>' : ''}
        </div>
      </div>
      <div class="uff-mappa-g">
        <div>
          <div class="mappa" id="uff-mappa" role="region" aria-label="Mappa dei lavori del giorno"><div class="stato-vuoto">${icona('mappa')}<b>Carico la mappa…</b></div></div>
          <p class="uff-privacy">${icona('scudo', 'p')}<span>La mappa mostra i luoghi degli interventi, non dove si trovano i tecnici: la posizione delle persone non viene tracciata.${senzaPos.length ? ' ' + senzaPos.length + (senzaPos.length === 1 ? ' luogo non ha' : ' luoghi non hanno') + ' ancora le coordinate e non compare' + (senzaPos.length === 1 ? '' : 'no') + ' sulla mappa.' : ''}</span></p>
        </div>
        <div class="uff-giri">${elenco || `<div class="tessera">${A.vuoto('Nessun lavoro in questo giorno', 'Scegli un altro giorno, o pianifica qualcosa dal calendario.', 'calendario')}</div>`}</div>
      </div>`;
    return { html: pagina({ attivo: 'mappa', titolo: 'Giro del giorno', briciole: [['Lavoro', '#/u/cruscotto']], contenuto }), dopo: () => disegnaMappa(g) };
  }
  A.azione('uff-mappa-giorno', el => { if (/^\d{4}-\d{2}-\d{2}$/.test(el.value)) A.vai('#/u/mappa?g=' + el.value); });
  function disegnaMappa(g) {
    const box = A.$('#uff-mappa'); if (!box) return;
    caricaLeaflet().then(L => {
      const qui = A.$('#uff-mappa'); if (!qui || qui !== box) return; // la pagina e' cambiata nel frattempo
      if (mappaViva) { try { mappaViva.remove(); } catch (_) { } mappaViva = null; }
      box.innerHTML = '';
      const mappa = L.map(box, { scrollWheelZoom: false, zoomControl: true }).setView([DEPOSITO.lat, DEPOSITO.lng], 13);
      mappaViva = mappa;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(mappa);
      const punti = [[DEPOSITO.lat, DEPOSITO.lng]];
      L.marker([DEPOSITO.lat, DEPOSITO.lng], { icon: L.divIcon({ className: 'uff-pin dep', html: '<span>' + icona('casa') + '</span>', iconSize: [32, 32], iconAnchor: [16, 16] }), title: DEPOSITO.nome, zIndexOffset: 1000 })
        .addTo(mappa).bindPopup('<b>' + h(DEPOSITO.nome) + '</b><br>Partenza dei giri');
      const { giri } = giriDelGiorno(g);
      // Due tecnici nello stesso posto (l'hotel con la squadra doppia): i segnaposto
      // si affiancano spostando il disegno, non le coordinate — il luogo resta quello vero.
      const gia = {};
      giri.forEach(({ t, tappe }) => {
        const col = coloreDi(t); const linea = [[DEPOSITO.lat, DEPOSITO.lng]];
        tappe.forEach((i, k) => {
          const s = A.sede(i.sedeId); if (!coord(s)) return;
          linea.push([s.lat, s.lng]); punti.push([s.lat, s.lng]);
          const fatto = FATTI.includes(i.stato);
          const chiave = s.lat.toFixed(5) + ',' + s.lng.toFixed(5); const n = gia[chiave] = (gia[chiave] || 0) + 1;
          const dx = (n - 1) * 24;
          L.marker([s.lat, s.lng], { icon: L.divIcon({ className: 'uff-pin' + (fatto ? ' fatto' : ''), html: '<span style="background:' + col + '">' + (k + 1) + '</span>', iconSize: [28, 28], iconAnchor: [14 - dx, 14], popupAnchor: [dx, -12] }), title: (i.ora || '') + ' ' + nomeCli(i), riseOnHover: true })
            .addTo(mappa)
            .bindPopup(`<b>${h(i.ora || '—')} · ${h(nomeCli(i))}</b><br>${h(nomeTipo(i.tipo))} · ${h((A.STATI_INTERVENTO[i.stato] || [i.stato])[0])}<br><span style="color:#5C7787">${h(A.indirizzo(s))} · ${h(A.nomeBreve(t.nome))}</span><br><a href="#/u/intervento/${h(i.id)}">Apri la scheda →</a>`);
        });
        if (linea.length > 1) L.polyline(linea, { color: col, weight: 3, opacity: 0.75, lineJoin: 'round' }).addTo(mappa);
      });
      if (punti.length > 1) mappa.fitBounds(punti, { padding: [36, 36], maxZoom: 15 });
      setTimeout(() => { try { mappa.invalidateSize(); } catch (_) { } }, 60);
    }).catch(() => {
      const qui = A.$('#uff-mappa'); if (!qui) return;
      qui.style.height = 'auto';
      qui.innerHTML = `<div class="avviso warn" style="margin:16px">${icona('senzarete')}<div><b>La mappa non si è caricata.</b><br>Serve la connessione a internet per scaricarla. Qui accanto trovi comunque il giro di ogni tecnico, con il bottone per aprirlo in Google Maps. <button class="btn pic" type="button" data-az="uff-mappa-riprova" style="margin-top:8px">${icona('ricarica', 'p')} Riprova</button></div></div>`;
    });
  }
  A.azione('uff-mappa-riprova', () => A.render());

  // ===========================================================================
  // 8. NUOVO INTERVENTO — la modale che si compila in meno di 30 secondi
  // ===========================================================================
  let niStato = null;
  function sediOpzioni(cid, sel) {
    const sedi = cid ? A.sediDi(cid) : [];
    if (!cid) return '<option value="">Scegli prima il cliente</option>';
    if (!sedi.length) return '<option value="">Nessun luogo in scheda</option>';
    return sedi.map((s, k) => `<option value="${h(s.id)}"${(sel ? sel === s.id : k === 0) ? ' selected' : ''}>${h(s.nome && s.nome !== 'Sede principale' ? s.nome + ' — ' : '')}${h(A.indirizzo(s))}</option>`).join('');
  }
  function impiantiOpzioni(cid, sedeId, sel) {
    if (!cid) return '<option value="">—</option>';
    const tutti = A.impiantiDi(cid);
    const lista = sedeId ? tutti.filter(m => m.sedeId === sedeId) : tutti;
    return '<option value="">— nessuna in particolare —</option>' + lista.map(m => `<option value="${h(m.id)}"${sel === m.id ? ' selected' : ''}>${h(m.marca + ' ' + m.modello)}${m.matricola ? ' · ' + h(m.matricola) : ''}</option>`).join('');
  }
  /**
   * A.apriNuovoIntervento(prefill, onCreato)
   * prefill: {clienteId, sedeId, impiantoId, tipo, priorita, richiesta, preventivoId,
   *           richiestaId, origine, data, ora, tecnici, durataMin, noteInterne, modalita}
   * onCreato(id): chiamata dopo il salvataggio; se restituisce false non si va alla scheda.
   */
  function apriNuovoIntervento(prefill, onCreato) {
    stile();
    const p = Object.assign({ tipo: 'riparazione', priorita: 'normale', durataMin: 90 }, prefill || {});
    niStato = { prefill: p, onCreato: typeof onCreato === 'function' ? onCreato : null };
    const c = p.clienteId ? A.cliente(p.clienteId) : null;
    const sedeSel = p.sedeId || (c && (A.sediDi(c.id)[0] || {}).id) || '';
    const oggi = A.oggi();
    A.modale({
      titolo: 'Nuovo intervento', largo: true, form: 'uff-ni-salva',
      corpo: `<div class="uff-ni"><div class="uff-ni-g">
        <div>
          <div class="campo">
            <label for="uff-ni-cerca">Cliente</label>
            <div class="cerca">${icona('cerca')}<input id="uff-ni-cerca" type="search" autocomplete="off" placeholder="Scrivi nome, telefono o via" value="${h(c ? c.nome : '')}" data-digita="uff-ni-cerca" role="combobox" aria-autocomplete="list" aria-controls="uff-ni-sugg" aria-expanded="false">
              <div class="uff-sugg" id="uff-ni-sugg" role="listbox"></div></div>
            <input type="hidden" name="clienteId" id="uff-ni-cid" value="${h(c ? c.id : '')}">
          </div>
          <div class="riga-campi">
            <div class="campo"><label for="uff-ni-sede">Luogo</label><select id="uff-ni-sede" name="sedeId" data-cambia="uff-ni-sede">${sediOpzioni(c && c.id, sedeSel)}</select></div>
            <div class="campo"><label for="uff-ni-imp">Macchina <span class="muto">(facoltativa)</span></label><select id="uff-ni-imp" name="impiantoId">${impiantiOpzioni(c && c.id, sedeSel, p.impiantoId)}</select></div>
          </div>
          <div class="campo"><span class="etichetta">Tipo di lavoro</span><div class="scelte">${Object.keys(A.TIPI_INTERVENTO).map(k => `<label class="scelta"><input type="radio" name="tipo" value="${k}"${p.tipo === k ? ' checked' : ''}><span>${icona(ICONA_TIPO[k] || 'chiave', 'p')}${h(A.TIPI_INTERVENTO[k])}</span></label>`).join('')}</div></div>
          <div class="campo"><span class="etichetta">Priorità</span><div class="scelte">${Object.keys(A.PRIORITA).map(k => `<label class="scelta${k === 'urgente' ? ' urg' : ''}"><input type="radio" name="priorita" value="${k}"${p.priorita === k ? ' checked' : ''}><span>${h(A.PRIORITA[k][0])}</span></label>`).join('')}</div></div>
          <div class="campo"><label for="uff-ni-ric">Cosa chiede il cliente</label><textarea id="uff-ni-ric" name="richiesta" rows="3" placeholder="Caldaia in blocco, codice F28…">${h(p.richiesta || '')}</textarea></div>
        </div>
        <div>
          <div class="campo"><label for="uff-ni-data">Giorno</label>
            <div class="uff-giorno-r"><input id="uff-ni-data" type="date" name="data" value="${h(p.data || '')}"><div class="uff-rapide"><button type="button" data-az="uff-ni-giorno" data-v="${oggi}">Oggi</button><button type="button" data-az="uff-ni-giorno" data-v="${A.piuGiorni(oggi, 1)}">Domani</button><button type="button" data-az="uff-ni-giorno" data-v="">Da pianificare</button></div></div>
            <span class="aiuto">Senza giorno il lavoro va fra quelli da pianificare.</span></div>
          <div class="riga-campi">
            <div class="campo"><label for="uff-ni-ora">Ora</label><input id="uff-ni-ora" type="time" name="ora" step="900" value="${h(p.ora || '')}"><span class="aiuto">Vuota = la prima libera.</span></div>
            <div class="campo"><label for="uff-ni-dur">Durata prevista</label><select id="uff-ni-dur" name="durataMin">${opzDurata(p.durataMin)}</select></div>
          </div>
          <div class="campo"><span class="etichetta">Tecnici</span>${campiTecnici(p.tecnici)}</div>
          <div class="campo"><label for="uff-ni-note">Note interne <span class="muto">(il cliente non le vede)</span></label><textarea id="uff-ni-note" name="noteInterne" rows="2" placeholder="Chiavi dal portiere, cliente attento ai costi…">${h(p.noteInterne || '')}</textarea></div>
        </div>
      </div>
      ${p.richiestaId ? `<div class="avviso" style="margin-top:4px">${icona('arrivo')}<div>Nasce da una richiesta ${p.origine === 'sito' ? 'arrivata dal sito' : 'dell\'area clienti'}: alla conferma la richiesta passa fra quelle con l'intervento fissato${p.origine === 'portale' ? ' e il cliente riceve un avviso' : ''}.</div></div>` : ''}
      ${p.preventivoId && A.preventivo(p.preventivoId) ? `<div class="avviso ok" style="margin-top:4px">${icona('documento')}<div>Dal preventivo <b>N. ${h(A.preventivo(p.preventivoId).numero)}</b>: alla conferma il preventivo risulta «diventato intervento».</div></div>` : ''}
      <div id="uff-ni-err"></div></div>`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: 'Crea l\'intervento', classe: 'acc', tipo: 'submit', icona: 'spunta' }],
      dopo: v => agganciaCercaCliente(v)
    });
  }
  A.apriNuovoIntervento = apriNuovoIntervento;

  function agganciaCercaCliente(v) {
    const inp = v.querySelector('#uff-ni-cerca'); if (!inp) return;
    inp.addEventListener('focus', () => { if (!v.querySelector('#uff-ni-cid').value) mostraSuggerimenti(inp.value); });
    inp.addEventListener('keydown', e => {
      const box = v.querySelector('#uff-ni-sugg');
      const voci = Array.from(box.querySelectorAll('button'));
      const on = voci.findIndex(b => b.classList.contains('on'));
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!voci.length) return; e.preventDefault();
        const n = e.key === 'ArrowDown' ? (on + 1) % voci.length : (on <= 0 ? voci.length - 1 : on - 1);
        voci.forEach((b, k) => b.classList.toggle('on', k === n)); voci[n].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        // Invio sceglie il cliente evidenziato (o il primo): non deve inviare il modulo a meta'.
        if (box.classList.contains('su') && voci.length) { e.preventDefault(); (voci[on >= 0 ? on : 0]).click(); }
      } else if (e.key === 'Escape' && box.classList.contains('su')) { e.stopPropagation(); box.classList.remove('su'); }
    });
    v.addEventListener('click', e => { if (!e.target.closest('.uff-ni .cerca')) { const b = v.querySelector('#uff-ni-sugg'); if (b) b.classList.remove('su'); } });
  }
  function mostraSuggerimenti(testo) {
    const box = A.$('#uff-ni-sugg'); if (!box) return;
    const parole = norm(testo).split(/\s+/).filter(Boolean);
    const db = A.DB;
    let lista, titolo = '';
    if (!parole.length) {
      // Senza testo: i clienti degli ultimi lavori, che sono quelli che richiamano.
      const visti = []; db.interventi.slice().sort((a, b) => String(b.creato).localeCompare(String(a.creato))).forEach(i => { if (!visti.includes(i.clienteId)) visti.push(i.clienteId); });
      lista = visti.slice(0, 6).map(A.cliente).filter(Boolean); titolo = 'Clienti recenti';
    } else {
      const tn = testo.replace(/[^\d]/g, '');
      lista = db.clienti.filter(c => {
        const t = norm([c.nome, c.referente, c.email, A.sediDi(c.id).map(A.indirizzo).join(' ')].join(' '));
        return parole.every(p => t.includes(p)) || (tn.length >= 4 && A.normTel(c.telefono).includes(tn));
      }).sort((a, b) => (norm(a.nome).startsWith(parole[0]) ? 0 : 1) - (norm(b.nome).startsWith(parole[0]) ? 0 : 1) || a.nome.localeCompare(b.nome)).slice(0, 7);
    }
    box.innerHTML = (titolo ? `<div class="t">${h(titolo)}</div>` : '') + lista.map((c, k) => { const s = A.sediDi(c.id)[0]; return `<button type="button" role="option" data-az="uff-ni-scegli" data-id="${h(c.id)}" class="${k === 0 && parole.length ? 'on' : ''}">${icona(c.tipo === 'condominio' ? 'edificio' : c.tipo === 'azienda' ? 'edificio' : 'utente')}<span><b>${h(c.nome)}</b><small class="pic">${h(s ? A.indirizzo(s) : '')}${c.telefono ? ' · ' + h(c.telefono) : ''}</small></span></button>`; }).join('')
      + (parole.length ? `<button type="button" class="nuovo" data-az="uff-ni-nuovocli">${icona('piu')}<span><b>Nuovo cliente${lista.length ? '' : ': «' + h(testo.trim()) + '»'}</b><small class="pic">${lista.length ? 'Non è fra questi? Crealo' : 'Nessun cliente trovato: crealo adesso'}</small></span></button>` : '');
    box.classList.toggle('su', !!(lista.length || parole.length));
    const inp = A.$('#uff-ni-cerca'); if (inp) inp.setAttribute('aria-expanded', box.classList.contains('su') ? 'true' : 'false');
  }
  A.azione('uff-ni-cerca', el => {
    // Chi riscrive il nome sta cambiando cliente: il luogo di prima non vale piu'.
    const cid = A.$('#uff-ni-cid');
    if (cid && cid.value) { const c = A.cliente(cid.value); if (!c || c.nome !== el.value) { cid.value = ''; A.$('#uff-ni-sede').innerHTML = sediOpzioni(null); A.$('#uff-ni-imp').innerHTML = impiantiOpzioni(null); } }
    mostraSuggerimenti(el.value);
  });
  function scegliCliente(id) {
    const c = A.cliente(id); if (!c) return;
    A.$('#uff-ni-cid').value = c.id; A.$('#uff-ni-cerca').value = c.nome;
    const sedi = A.sediDi(c.id); const s0 = sedi[0] ? sedi[0].id : '';
    A.$('#uff-ni-sede').innerHTML = sediOpzioni(c.id, s0);
    A.$('#uff-ni-imp').innerHTML = impiantiOpzioni(c.id, s0);
    const box = A.$('#uff-ni-sugg'); if (box) box.classList.remove('su');
    const e = A.$('#uff-ni-err'); if (e) e.innerHTML = '';
    const r = A.$('#uff-ni-ric'); if (r && window.matchMedia('(pointer:fine)').matches) r.focus();
  }
  A.azione('uff-ni-scegli', el => scegliCliente(el.dataset.id));
  A.azione('uff-ni-sede', el => { const cid = A.$('#uff-ni-cid').value; A.$('#uff-ni-imp').innerHTML = impiantiOpzioni(cid, el.value); });
  A.azione('uff-ni-giorno', el => { const d = A.$('#uff-ni-data'); if (d) d.value = el.dataset.v; });
  /** Il modulo com'e' adesso, per non perderlo passando dalla scheda «Nuovo cliente». */
  function bozzaNI() {
    const f = A.$('form[data-form="uff-ni-salva"]'); if (!f) return {};
    const d = A.datiForm(f);
    return Object.assign({}, niStato ? niStato.prefill : {}, { tipo: d.tipo, priorita: d.priorita, richiesta: d.richiesta, data: d.data, ora: d.ora, durataMin: Number(d.durataMin) || 90, noteInterne: d.noteInterne, tecnici: Array.from(f.querySelectorAll('input[name=tecnici]:checked')).map(x => x.value) });
  }
  A.azione('uff-ni-nuovocli', () => {
    const bozza = bozzaNI(); const cb = niStato ? niStato.onCreato : null;
    const testo = (A.$('#uff-ni-cerca') || {}).value || '';
    const tel = /\d{6,}/.test(testo.replace(/\s/g, '')) ? testo : '';
    apriNuovoCliente({ nome: tel ? '' : testo.trim(), telefono: tel }, (cid, sid) => apriNuovoIntervento(Object.assign(bozza, { clienteId: cid, sedeId: sid, impiantoId: null }), cb), () => apriNuovoIntervento(Object.assign(bozza, { clienteId: null, sedeId: null }), cb));
  });
  A.azione('uff-ni-salva', (f, ev, d) => {
    const st = niStato || { prefill: {} }; const pre = st.prefill;
    const errore = t => { const e = A.$('#uff-ni-err'); if (e) e.innerHTML = `<div class="avviso dang" style="margin-top:10px">${icona('attenzione')}<div>${h(t)}</div></div>`; };
    const c = A.cliente(d.clienteId);
    if (!c) { errore('Scegli il cliente: scrivi le prime lettere del nome e toccalo nell\'elenco.'); const i = A.$('#uff-ni-cerca'); if (i) { i.focus(); mostraSuggerimenti(i.value); } return; }
    const tecnici = Array.from(f.querySelectorAll('input[name=tecnici]:checked')).map(x => x.value);
    const data = /^\d{4}-\d{2}-\d{2}$/.test(d.data || '') ? d.data : null;
    const tipo = A.TIPI_INTERVENTO[d.tipo] ? d.tipo : 'riparazione';
    const durata = Number(d.durataMin) || 90;
    let id, numero, ora = d.ora || '', proposta = '';
    A.modifica(db => {
      const u = A.utente();
      id = A.uid('int'); numero = A.numera('INT');
      const sedeId = d.sedeId || (A.sediDi(c.id)[0] || {}).id || null;
      const pian = !!(data && tecnici.length);
      if (pian && !ora) { ora = primaOraLibera(tecnici[0], data, durata, null); proposta = ora; }
      // La manutenzione di una macchina sotto contratto e' «a contratto»: al cliente vale zero.
      let modalita = pre.modalita;
      if (!modalita) modalita = tipo === 'manutenzione' && (db.contratti || []).some(k => k.clienteId === c.id && (!k.impiantoId || !d.impiantoId || k.impiantoId === d.impiantoId) && (!k.scadenza || k.scadenza >= A.oggi())) ? 'contratto' : 'misura';
      const i = {
        id, numero, clienteId: c.id, sedeId, impiantoId: d.impiantoId || null, tipo, priorita: A.PRIORITA[d.priorita] ? d.priorita : 'normale',
        stato: pian ? 'pianificato' : 'da_pianificare', data, ora: data ? ora : '', durataMin: durata, tecnici,
        richiesta: String(d.richiesta || '').trim(), noteInterne: String(d.noteInterne || '').trim(), noteCliente: '',
        origine: pre.origine || (pre.preventivoId ? 'preventivo' : 'ufficio'), preventivoId: pre.preventivoId || null, modalita,
        rapporto: null, storico: [{ stato: 'creato', data: A.adesso(), utenteId: u.id }], documentoId: null, creato: A.adesso()
      };
      if (pian) i.storico.push({ stato: 'pianificato', data: A.adesso(), utenteId: u.id });
      db.interventi.push(i);
      if (pian) avvisaCambi(db, i, { data: null, ora: '', tecnici: [], stato: 'da_pianificare' });
      A.registra('intervento creato', 'N. ' + numero + ' — ' + c.nome + ' (' + nomeTipo(tipo).toLowerCase() + (pian ? ', ' + A.data(data) + ' ' + ora + ', ' + A.nomeTecnici(tecnici) : ', da pianificare') + ')');
      // Richiesta collegata: passa a «intervento fissato», e il cliente dell'area riservata lo sa.
      if (pre.richiestaId) {
        const r = db.richieste.find(x => x.id === pre.richiestaId);
        if (r && !r.interventoId) {
          r.stato = 'pianificata'; r.interventoId = id; r.clienteId = r.clienteId || c.id;
          if (r.origine === 'portale' && r.clienteId) {
            const quando = pian ? giornoParlato(data) + ' alle ' + ora : '';
            A.avvisa('cliente:' + r.clienteId, pian ? 'Intervento fissato: ' + quando + ' (' + nomeTipo(tipo).toLowerCase() + ')' : 'Abbiamo preso la tua richiesta: ti chiamiamo per fissare il giorno', '#/c/intervento/' + id, {
              tipo: 'richiesta', email: r.email && db.azienda.notificheEmail !== false ? { a: r.email, oggetto: 'IDRAL — la sua richiesta è stata presa', testo: 'Gentile ' + r.nome + ', abbiamo preso la sua richiesta. ' + (pian ? 'Il tecnico passerà ' + A.dataLunga(data) + ' alle ' + ora + '.' : 'La chiamiamo a breve per fissare il giorno.') + '\n' + linkAssoluto('#/c/intervento/' + id) + '\nIDRAL' } : null
            });
          }
        }
      }
      // Preventivo collegato: diventa «convertito» una volta sola, chiunque lo chiami.
      if (pre.preventivoId) {
        const p = db.preventivi.find(x => x.id === pre.preventivoId);
        if (p && !p.interventoId) {
          p.interventoId = id; if (p.stato === 'accettato') p.stato = 'convertito';
          (p.eventi = p.eventi || []).unshift({ tipo: 'convertito', data: A.adesso(), chi: u.nome });
        }
      }
    });
    A.chiudiModale();
    A.toast('Intervento N. ' + numero + ' creato' + (proposta ? ' — ora proposta ' + proposta + ' (prima libera)' : data && tecnici.length ? ' — ' + A.nomeTecnici(tecnici).split(',')[0] + ' avvisato' : ' — da pianificare'), 'ok');
    let vai = true;
    if (st.onCreato) { try { vai = st.onCreato(id) !== false; } catch (e) { console.error(e); } }
    niStato = null;
    if (vai) A.vai('#/u/intervento/' + id); else A.render();
  });

  // ===========================================================================
  // ROTTE
  // ===========================================================================
  A.rotta('#/u/cruscotto', 'ufficio', paginaCruscotto);
  A.rotta('#/u/richieste', 'ufficio', paginaRichieste);
  A.rotta('#/u/pianificazione', 'ufficio', paginaPianificazione);
  A.rotta('#/u/interventi', 'ufficio', paginaInterventi);
  A.rotta('#/u/intervento/:id', 'ufficio', paginaIntervento);
  A.rotta('#/u/intervento/:id/stampa', 'ufficio', paginaStampa);
  A.rotta('#/u/rapportini', 'ufficio', paginaRapportini);
  // Alias: qualche avviso punta al rapportino, che vive dentro la scheda dell'intervento.
  A.rotta('#/u/rapportino/:id', 'ufficio', par => { location.replace(esiste(par.id) ? '#/u/intervento/' + par.id : '#/u/rapportini'); return false; });
  A.rotta('#/u/mappa', 'ufficio', paginaMappa);
})();
