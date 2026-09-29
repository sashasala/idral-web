/* =============================================================================
   IDRAL — gestionale (demo) · accesso
   -----------------------------------------------------------------------------
   Tre porte diverse, come nel prodotto vero (§2.2 del prompt master):
   - il CLIENTE entra con un link che riceve per email, senza password da
     ricordare (la password e' facoltativa);
   - il TECNICO entra con telefono + password consegnata dall'ufficio: non ha,
     e non deve avere, un'email aziendale; e su iPhone un link aperto da Mail
     finisce nel browser, non nell'app installata;
   - TITOLARE e UFFICIO entrano con email + password.
   In questa demo il «link via email» non parte davvero: finisce nella Posta in
   uscita del gestionale e, per comodita', compare qui sotto da cliccare.
   ============================================================================= */
(function () {
  'use strict';
  const { h, icona, marchio } = A;

  /** Crea un link di accesso monouso (valido 24 ore). tipo: 'accesso' | 'invito' */
  function creaLink(utenteId, tipo, destinazione) {
    const token = A.uid('lnk').replace('lnk_', '') + A.uid('').slice(0, 6);
    A.modifica(db => {
      db.link = db.link || [];
      db.link = db.link.filter(l => new Date(l.scade) > new Date());
      db.link.push({ token, utenteId, tipo: tipo || 'accesso', destinazione: destinazione || '', creato: A.adesso(), scade: new Date(Date.now() + 24 * 3600e3).toISOString(), usato: false });
    });
    return location.origin + location.pathname + '#/accesso/link/' + token;
  }
  A.creaLink = creaLink;

  const DEMO = [
    { ruolo: 'Titolare', nome: 'Andrea Albino', chi: 'andrea@idral.it', pw: 'idral2026', porta: 'personale' },
    { ruolo: 'Ufficio', nome: 'Laura Ferrante', chi: 'ufficio@idral.it', pw: 'ufficio2026', porta: 'personale' },
    { ruolo: 'Tecnico', nome: 'Marco Sciarrone', chi: '333 100 0001', pw: 'marco2026', porta: 'personale' },
    { ruolo: 'Cliente', nome: 'Salvatore Puglisi — amministratore di 3 condomini', chi: 's.puglisi@example.com', pw: 'cliente2026', porta: 'cliente' },
    { ruolo: 'Cliente', nome: 'Giuseppina Trapani — privata', chi: 'g.trapani@example.com', pw: 'cliente2026', porta: 'cliente' }
  ];

  function pagina(par) {
    const u = A.utente();
    if (u && !par.q.cambia) { location.replace(A.casaDi(u)); return false; }
    const porta = par.q.porta === 'cliente' ? 'cliente' : par.q.porta === 'personale' ? 'personale' : 'cliente';
    const inviato = par.q.inviato;
    const moduloCliente = inviato ? linkInviato(inviato) : `
      <form data-form="accesso-link" novalidate>
        <div class="campo"><label for="em">La tua email</label><input id="em" name="email" type="email" autocomplete="email" placeholder="nome@esempio.it" required></div>
        <button class="btn acc g largo" type="submit">${icona('posta')} Mandami il link per entrare</button>
        <p class="pic" style="margin-top:10px">Nessuna password da ricordare: ti mandiamo un link valido 24 ore.</p>
      </form>
      <details style="margin-top:16px"><summary class="pic" style="cursor:pointer">Preferisco entrare con la password</summary>
        <form data-form="accesso-pw" novalidate style="margin-top:12px">
          <div class="campo"><label>Email</label><input name="chi" type="email" autocomplete="username"></div>
          <div class="campo"><label>Password</label><input name="pw" type="password" autocomplete="current-password"></div>
          <button class="btn pri largo" type="submit">Entra</button>
        </form>
      </details>`;
    const moduloPersonale = `
      <form data-form="accesso-pw" novalidate>
        <div class="campo"><label for="chi">Telefono o email</label><input id="chi" name="chi" type="text" autocomplete="username" placeholder="333 123 4567 oppure nome@idral.it" required></div>
        <div class="campo"><label for="pw">Password</label><input id="pw" name="pw" type="password" autocomplete="current-password" required><span class="aiuto">I tecnici usano la password consegnata dall'ufficio.</span></div>
        <label class="spunta"><input type="checkbox" name="ricorda" checked> Resta collegato su questo dispositivo</label>
        <button class="btn pri g largo" type="submit">Entra</button>
      </form>`;
    return `
    <div class="accesso">
      <div class="lato">
        <div>
          <a href="../" class="marchio" style="color:#fff">${A.GOCCIA ? '<span class="g">' + A.GOCCIA + '</span>' : ''}<span class="nm">IDRAL<small>Soluzioni per la tua casa</small></span></a>
          <h1>Il vostro impianto,<br>sempre sotto controllo.</h1>
          <p>Un solo accesso per tutto: i clienti seguono preventivi, lavori e documenti; i tecnici chiudono gli interventi dal telefono; l'ufficio vede tutto in tempo reale.</p>
          <ul>
            <li>${icona('spunta')} Preventivi da accettare con un clic, senza carta</li>
            <li>${icona('spunta')} Rapportini firmati e foto del lavoro, sempre scaricabili</li>
            <li>${icona('spunta')} Richieste di intervento e messaggi diretti con l'ufficio</li>
          </ul>
        </div>
        <p style="font-size:12.5px;color:rgba(255,255,255,.5)">← <a href="../" style="color:#FFB27A">Torna al sito</a></p>
      </div>
      <div class="modulo"><div>
        <h1 style="margin-bottom:4px">Entra</h1>
        <p class="muto" style="margin-bottom:18px">Scegli come vuoi entrare.</p>
        <div class="schede">
          <a href="#/accesso?porta=cliente" class="${porta === 'cliente' ? 'on' : ''}">${icona('casa')} Sono un cliente</a>
          <a href="#/accesso?porta=personale" class="${porta === 'personale' ? 'on' : ''}">${icona('chiave')} Personale IDRAL</a>
        </div>
        <div id="err-accesso"></div>
        ${porta === 'cliente' ? moduloCliente : moduloPersonale}
        <div class="credenziali">
          <div class="ct"><span>Accessi di prova</span><span style="font-weight:600;text-transform:none;letter-spacing:0;color:var(--ink-3)">tocca per entrare</span></div>
          ${DEMO.map((d, i) => `<button type="button" data-az="accesso-demo" data-i="${i}"><span class="ruolo">${h(d.ruolo)}</span><span class="chi"><b>${h(d.nome)}</b><span>${h(d.chi)} · ${h(d.pw)}</span></span>${icona('destra')}</button>`).join('')}
        </div>
        <p class="pic" style="margin-top:14px">Demo: i dati restano in questo browser. <a href="#" data-az="demo-azzera">Riporta la demo all'inizio</a></p>
      </div></div>
    </div>`;
  }

  function linkInviato(email) {
    const u = A.DB.utenti.find(x => x.email && x.email.toLowerCase() === email.toLowerCase() && x.ruolo === 'cliente');
    const ultimo = u && (A.DB.link || []).filter(l => l.utenteId === u.id && !l.usato).slice(-1)[0];
    return `<div class="avviso ok">${icona('posta')}<div><b>Controlla la posta.</b><br>Se ${h(email)} è registrato, ti abbiamo mandato un link per entrare. Vale 24 ore.</div></div>
      ${ultimo ? `<div class="avviso" style="margin-top:12px">${icona('info')}<div><b>Demo:</b> l'email non parte davvero. Ecco il link che avresti ricevuto:<br><a class="btn pri" style="margin-top:10px" href="#/accesso/link/${h(ultimo.token)}">${icona('esterno')} Apri il link dell'email</a></div></div>` : ''}
      <p style="margin-top:14px"><a href="#/accesso?porta=cliente">← Usa un altro indirizzo</a></p>`;
  }

  function errore(msg) { const e = A.$('#err-accesso'); if (e) e.innerHTML = `<div class="avviso dang" style="margin-bottom:14px">${icona('attenzione')}<div>${h(msg)}</div></div>`; }
  function dopoAccesso(u) {
    const dopo = sessionStorage.getItem('idral.demo.dopo'); sessionStorage.removeItem('idral.demo.dopo');
    const area = u.ruolo === 'tecnico' ? '#/t/' : u.ruolo === 'cliente' ? '#/c/' : '#/u/';
    A.toast('Ciao ' + u.nome.split(' ')[0] + '!', 'ok');
    location.hash = dopo && dopo.indexOf(area) === 0 ? dopo : A.casaDi(u);
  }

  A.azione('accesso-pw', (f, ev, d) => {
    const r = A.entra(d.chi, d.pw, d.ricorda !== false);
    if (!r.ok) return errore(r.errore);
    dopoAccesso(r.utente);
  });
  A.azione('accesso-link', (f, ev, d) => {
    const email = String(d.email || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return errore('Scrivi un indirizzo email valido.');
    const u = A.DB.utenti.find(x => x.email && x.email.toLowerCase() === email.toLowerCase());
    // Si risponde sempre allo stesso modo, esista o no l'indirizzo: chi prova
    // indirizzi a caso non deve poter scoprire chi e' cliente di IDRAL.
    if (u && u.ruolo === 'cliente' && u.attivo !== false) {
      const link = creaLink(u.id, 'accesso');
      A.modifica(db => db.email.unshift({ id: A.uid('eml'), data: A.adesso(), a: u.email, oggetto: 'Il tuo link per entrare nell\'area clienti IDRAL', testo: 'Clicca per entrare (valido 24 ore): ' + link }));
    }
    location.hash = '#/accesso?porta=cliente&inviato=' + encodeURIComponent(email);
  });
  A.azione('accesso-demo', el => {
    const d = DEMO[+el.dataset.i];
    const r = A.entra(d.chi, d.pw, true);
    if (!r.ok) return errore(r.errore + ' (la demo è stata modificata: riportala all\'inizio)');
    dopoAccesso(r.utente);
  });

  function paginaLink(par) {
    const l = (A.DB.link || []).find(x => x.token === par.token);
    const scaduto = !l || new Date(l.scade) < new Date() || (l.usato && l.tipo === 'accesso');
    if (scaduto) return `<div class="accesso" style="grid-template-columns:1fr"><div class="modulo"><div>${marchio()}<div class="spazio"></div>
      <div class="avviso warn">${icona('attenzione')}<div><b>Questo link non vale più.</b><br>I link per entrare durano 24 ore e si usano una volta sola. Chiedine uno nuovo: arriva in un minuto.</div></div>
      <p style="margin-top:16px"><a class="btn pri" href="#/accesso?porta=cliente">Chiedi un nuovo link</a></p></div></div></div>`;
    const u = A.utenteDa(l.utenteId);
    if (l.tipo === 'invito') {
      return `<div class="accesso" style="grid-template-columns:1fr"><div class="modulo"><div>${marchio()}<div class="spazio"></div>
        <h1>Benvenuto, ${h(u.nome.split(' ')[0])}</h1><p class="muto" style="margin:6px 0 18px">IDRAL ti ha aperto l'accesso all'area clienti. Da qui vedi preventivi, lavori, documenti e puoi scriverci.</p>
        <form data-form="accesso-invito" data-token="${h(l.token)}">
          <div class="campo"><label>Vuoi anche una password? (facoltativa)</label><input type="password" name="pw" autocomplete="new-password" placeholder="Lascia vuoto per entrare sempre con il link"><span class="aiuto">Almeno 8 caratteri. Se la lasci vuota, quando vuoi entrare ti mandiamo un link.</span></div>
          <button class="btn acc g largo" type="submit">Entra nell'area clienti</button>
        </form></div></div></div>`;
    }
    A.modifica(db => { const x = db.link.find(y => y.token === l.token); x.usato = true; });
    A.apriSessione(u, true);
    location.replace(l.destinazione || A.casaDi(u));
    return false;
  }
  A.azione('accesso-invito', (f, ev, d) => {
    const l = (A.DB.link || []).find(x => x.token === f.dataset.token);
    if (!l) return;
    if (d.pw && d.pw.length < 8) return A.toast('La password deve avere almeno 8 caratteri', 'per');
    const u = A.utenteDa(l.utenteId);
    A.modifica(db => { const x = db.link.find(y => y.token === l.token); x.usato = true; if (d.pw) u.password = d.pw; u.invitoAccettato = A.adesso(); A.registra('invito accettato', u.nome); });
    A.apriSessione(u, true);
    location.replace(A.casaDi(u));
  });

  A.rotta('#/accesso', 'libera', pagina);
  A.rotta('#/accesso/link/:token', 'libera', paginaLink);
})();
