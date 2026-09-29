/* =============================================================================
   IDRAL — gestionale (demo) · il guscio del back-office
   -----------------------------------------------------------------------------
   Barra laterale, testata, campanella degli avvisi. Le pagine dell'ufficio
   (ufficio-lavori.js e ufficio-gestione.js) chiamano A.guscioUfficio({...}).
   ============================================================================= */
(function () {
  'use strict';
  const { h, icona } = A;

  /** Contatori della barra laterale: quello che aspetta qualcuno. */
  function conteggiUfficio() {
    const db = A.DB; const oggi = A.oggi();
    const sottoScorta = db.articoli.filter(a => a.attivo !== false && a.scortaMin > 0 && A.giacenza(a.id) < a.scortaMin).length;
    return {
      richieste: db.richieste.filter(r => r.stato === 'nuova').length,
      daPianificare: db.interventi.filter(i => i.stato === 'da_pianificare').length,
      rapportini: db.interventi.filter(i => i.stato === 'completato' && i.rapporto && i.rapporto.stato === 'inviato').length,
      messaggi: db.conversazioni.filter(c => !c.lettoAzienda).length + db.note.filter(n => !n.letta).length,
      preventivi: db.preventivi.filter(p => p.stato === 'accettato' && !p.interventoId).length,
      sottoScorta,
      materiale: db.richiesteMateriale.filter(r => r.stato === 'nuova').length + db.ordini.filter(o => o.stato === 'nuovo').length,
      manutenzioni: db.impianti.filter(i => i.prossimaManutenzione && A.diffGiorni(oggi, i.prossimaManutenzione) <= 30).length,
      daFatturare: db.interventi.filter(i => i.stato === 'approvato' && i.tipo !== 'sopralluogo' && !i.documentoId).length
    };
  }
  A.conteggiUfficio = conteggiUfficio;

  const MENU = [
    { gr: null, voci: [['cruscotto', 'Cruscotto', 'cruscotto', '#/u/cruscotto']] },
    { gr: 'Lavoro', voci: [['richieste', 'Richieste', 'arrivo', '#/u/richieste', 'richieste'], ['pianificazione', 'Pianificazione', 'calendario', '#/u/pianificazione', 'daPianificare'], ['interventi', 'Interventi', 'chiave', '#/u/interventi'], ['rapportini', 'Rapportini', 'verifica', '#/u/rapportini', 'rapportini'], ['mappa', 'Giro del giorno', 'mappa', '#/u/mappa']] },
    { gr: 'Clienti', voci: [['clienti', 'Clienti', 'edificio', '#/u/clienti'], ['preventivi', 'Preventivi', 'documento', '#/u/preventivi', 'preventivi'], ['messaggi', 'Comunicazioni', 'messaggio', '#/u/messaggi', 'messaggi']] },
    { gr: 'Materiale', voci: [['magazzino', 'Magazzino', 'pacco', '#/u/magazzino', 'sottoScorta'], ['materiale', 'Ordini e materiale', 'carrello', '#/u/materiale', 'materiale']] },
    { gr: 'Conti', voci: [['documenti', 'Da fatturare', 'euro', '#/u/documenti', 'daFatturare'], ['manutenzioni', 'Manutenzioni', 'storico', '#/u/manutenzioni', 'manutenzioni'], ['statistiche', 'Statistiche', 'grafico', '#/u/statistiche']] },
    { gr: 'Azienda', voci: [['persone', 'Persone e accessi', 'persone', '#/u/persone', null, 'persone'], ['posta', 'Posta in uscita', 'posta', '#/u/posta'], ['registro', 'Registro attività', 'elenco', '#/u/registro', null, 'registro'], ['impostazioni', 'Impostazioni', 'regolazioni', '#/u/impostazioni', null, 'impostazioni']] }
  ];

  /**
   * guscioUfficio({ attivo, titolo, briciole:[[testo, link], ...], azioni: html, contenuto: html })
   */
  function guscioUfficio(o) {
    const u = A.utente();
    const n = conteggiUfficio();
    const nAvvisi = A.nonLetti();
    const lat = MENU.map(g => (g.gr ? `<div class="gr">${h(g.gr)}</div>` : '') + g.voci.filter(v => !v[5] || A.puo(v[5])).map(v => {
      const c = v[4] ? n[v[4]] : 0;
      return `<a href="${v[3]}" class="${o.attivo === v[0] ? 'on' : ''}">${icona(v[2])}<span>${h(v[1])}</span>${c ? `<span class="contatore ${v[4] === 'sottoScorta' || v[4] === 'daFatturare' || v[4] === 'manutenzioni' || v[4] === 'daPianificare' ? 'blu' : ''}">${c}</span>` : ''}</a>`;
    }).join('')).join('');
    const bric = (o.briciole || []).map(b => `<a href="${b[1]}">${h(b[0])}</a> / `).join('');
    return A.barraDemo() + `
    <div class="bo" id="bo">
      <aside class="lat">
        <a href="#/u/cruscotto" class="marchio" style="color:#fff"><span class="g">${A.GOCCIA}</span><span class="nm">IDRAL<small>Gestionale</small></span></a>
        ${lat}
        <div class="piede">IDRAL — Soluzioni per la tua casa<br><a href="../" style="color:rgba(255,255,255,.6)">Vai al sito</a></div>
      </aside>
      <div class="velo-lat" data-az="menu-chiudi"></div>
      <div class="corpo">
        <header class="testa">
          <button class="btn vuoto icona hamb" data-az="menu-apri" aria-label="Menu">${icona('menu')}</button>
          <div class="tit">${bric ? `<div class="briciole">${bric}</div>` : ''}<h1>${h(o.titolo || '')}</h1></div>
          <div class="btns">${o.azioni || ''}</div>
          <button class="btn vuoto icona campanella" data-az="avvisi-apri" aria-label="Avvisi">${icona('campanella')}${nAvvisi ? `<span class="contatore">${nAvvisi}</span>` : ''}</button>
          <button class="chip-utente" data-az="menu-utente"><span class="avatar">${h(A.iniziali(u.nome))}</span><span class="nm">${h(u.nome)}<small class="pic">${h(A.ETICHETTA_RUOLO[u.ruolo])}</small></span></button>
        </header>
        <main class="contenuto">${o.contenuto || ''}</main>
      </div>
    </div>`;
  }
  A.guscioUfficio = guscioUfficio;

  A.azione('menu-apri', () => A.$('#bo').classList.add('aperto'));
  A.azione('menu-chiudi', () => A.$('#bo').classList.remove('aperto'));
  A.azione('menu-utente', () => {
    const u = A.utente();
    A.modale({
      titolo: u.nome, corpo: `<p class="muto">${h(A.ETICHETTA_RUOLO[u.ruolo])} · ${h(u.email || u.telefono)}</p>
        <div class="sep"></div>
        <p style="font-size:14px">Per provare la sincronizzazione in tempo reale apri l'app in un'altra finestra dello stesso browser ed entra con un altro ruolo (per esempio il tecnico Marco): quello che fa lui compare qui senza ricaricare.</p>`,
      azioni: [{ testo: 'Apri un\'altra finestra', icona: 'esterno', az: 'nuova-finestra' }, { testo: 'Esci', classe: 'per', icona: 'esci', az: 'esci' }]
    });
  });
  A.azione('nuova-finestra', () => { A.chiudiModale(); window.open(location.pathname + '#/accesso?cambia=1', '_blank', 'noopener'); });

  // ---- avvisi
  function elencoAvvisi(lista) {
    if (!lista.length) return A.vuoto('Nessun avviso', 'Qui arrivano rapportini, richieste, preventivi accettati e messaggi.', 'campanella');
    return `<ul class="elenco">${lista.map(a => `<li class="clic" data-az="avviso-apri" data-id="${a.id}" style="${a.letto ? '' : 'background:var(--brand-50)'}">
      <span class="avatar ${a.tipo === 'materiale' ? 'acc' : a.tipo === 'preventivo' ? 'ok' : ''}" style="width:34px;height:34px;flex-basis:34px">${icona({ richiesta: 'arrivo', materiale: 'carrello', rapportino: 'verifica', preventivo: 'documento', messaggio: 'messaggio', assegnazione: 'calendario', nota: 'messaggio', ordine: 'carrello' }[a.tipo] || 'campanella', 'p')}</span>
      <div class="cx1"><div class="t1" style="white-space:normal;font-weight:${a.letto ? 500 : 700}">${h(a.testo)}</div><div class="t2">${A.quando(a.data)}</div></div></li>`).join('')}</ul>`;
  }
  A.elencoAvvisi = elencoAvvisi;
  A.azione('avvisi-apri', () => {
    const lista = A.mieiAvvisi().slice(0, 25);
    A.modale({ titolo: 'Avvisi', corpo: `<div style="margin:-18px -20px">${elencoAvvisi(lista)}</div>`, azioni: [{ testo: 'Segna tutti come letti', az: 'avvisi-letti' }, { testo: 'Attiva notifiche del browser', icona: 'campanella', az: 'notifiche-browser' }, { testo: 'Chiudi', chiudi: true }] });
  });
  A.azione('avviso-apri', el => {
    const id = el.dataset.id; let link = '';
    A.modifica(db => { const a = db.avvisi.find(x => x.id === id); if (a) { a.letto = true; link = a.link; } });
    A.chiudiModale(); if (link) A.vai(link); else A.render();
  });
  A.azione('avvisi-letti', () => {
    const miei = new Set(A.mieiAvvisi().map(a => a.id));
    A.modifica(db => db.avvisi.forEach(a => { if (miei.has(a.id)) a.letto = true; }));
    A.chiudiModale(); A.render();
  });
  A.azione('notifiche-browser', async () => {
    if (!('Notification' in window)) return A.toast('Questo browser non supporta le notifiche', 'per');
    const p = await Notification.requestPermission();
    A.toast(p === 'granted' ? 'Notifiche attive: arrivano anche se la finestra è in secondo piano' : 'Notifiche non autorizzate dal browser', p === 'granted' ? 'ok' : 'per');
  });
})();
