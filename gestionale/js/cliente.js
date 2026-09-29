/* =============================================================================
   IDRAL — gestionale (demo) · AREA CLIENTI
   -----------------------------------------------------------------------------
   Il metro di questa superficie e' «una persona di 65 anni che arriva da un
   link via email» (§8 del prompt master): caratteri grandi, parole semplici,
   un'azione principale per schermata, niente gergo. E' web e basta: niente
   offline, niente coda.

   ⚠️ SICUREZZA. Nel prodotto vero cosa vede un cliente lo decide il database
   (RLS per azienda e per cliente, §5.1). In questa demo l'archivio sta tutto
   nel browser, quindi il cancello e' qui: OGNI pagina passa da mio() prima di
   mostrare un documento, e ogni azione ricontrolla l'id che arriva dal markup
   (il markup si manipola con due clic). Un id che non e' di questo utente
   produce «Non trovato» — la stessa identica pagina di un id che non esiste,
   cosi' per tentativi non si scopre cosa c'e' nell'archivio di IDRAL.

   Il cliente NON vede mai: costi d'acquisto, margini, note interne
   (noteInterne, rapporto.note, cliente.note), foto che l'ufficio non ha reso
   visibili, rapportini non ancora approvati, fornitori, altri clienti.

   Un utente cliente puo' avere piu' clienti (l'amministratore di condominio
   ne ha tre): tutto quello che si vede riguarda il «cliente attivo», scelto
   in testata e ricordato per la sessione.
   ============================================================================= */
(function () {
  'use strict';
  const { h, icona } = A;

  const CHIAVE_ATTIVO = 'idral.demo.clienteAttivo';
  const PREF_CARRELLO = 'idral.demo.carrello.';

  // ===========================================================================
  // STILE — iniettato una volta sola, selettori prefissati.
  // Tutto un gradino piu' grande del back-office: chi legge qui non ha il
  // gestionale aperto otto ore al giorno, e spesso ha gli occhiali sul tavolo.
  // ===========================================================================
  const CSS = `
body.sup-cliente .cli-testa .w{flex-wrap:wrap;row-gap:10px;min-height:68px}
.cli-marchio{display:flex;color:var(--brand-900);text-decoration:none!important;flex:0 0 auto}
.cli-sel{display:flex;flex-direction:column;gap:3px;min-width:0}
.cli-sel small{font-size:11.5px!important;font-weight:750;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
body.sup-cliente .cli-sel select{min-height:44px;font-size:16px;font-weight:650;min-width:280px;max-width:420px;background-color:var(--brand-50);border-color:var(--brand-100)}
.cli-unico{display:flex;align-items:center;gap:8px;font-weight:650;color:var(--ink-2);padding:8px 14px;background:var(--bg);border:1px solid var(--line-2);border-radius:12px;min-width:0}
.cli-unico span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cli-chi{display:flex;align-items:center;gap:7px;color:var(--ink-2);font-weight:600;font-size:15px;white-space:nowrap}
body.sup-cliente .cli-nav a{padding:14px 10px;font-size:14.5px;gap:7px}
body.sup-cliente .cli-nav .w{padding:0 6px}
/* Nove voci con l'icona non stanno in 1100 px: meglio tutte leggibili che mezze nascoste. */
body.sup-cliente .cli-nav a svg{display:none}
.cli-nav{position:relative}
@media(max-width:760px){
  body.sup-cliente .cli-testa .w{padding:10px 14px;gap:10px;min-height:0}
  .cli-chi{display:none}
  .cli-sel,.cli-unico{order:3;flex:1 1 100%}
  .cli-sel small{display:none}
  body.sup-cliente .cli-sel select{max-width:none;width:100%;min-width:0}
  body.sup-cliente .cli-nav .w{padding:0 4px}
  body.sup-cliente .cli-nav a{padding:13px 11px}
}
/* sotto i 1180 px il menu scorre: la sfumatura a destra dice che c'e' dell'altro */
@media(max-width:1180px){.cli-nav::after{content:"";position:absolute;right:0;top:0;bottom:0;width:30px;background:linear-gradient(90deg,rgba(8,58,82,0),var(--brand-800));pointer-events:none}}

/* testo e controlli: un gradino piu' grandi */
body.sup-cliente .btn{font-size:15.5px;min-height:46px;border-radius:12px}
body.sup-cliente .cli-corpo .btn,body.sup-cliente .modale .btn{white-space:normal;text-align:center;line-height:1.25}
body.sup-cliente .griglia>.tessera+.tessera,body.sup-cliente .griglia>section+section{margin-top:0}
body.sup-cliente .btn.pic{font-size:14.5px;min-height:40px;padding:6px 13px;border-radius:10px}
body.sup-cliente .btn.g{font-size:16.5px;min-height:54px}
body.sup-cliente .btn.xl{font-size:17.5px;min-height:60px}
body.sup-cliente .campo>label,body.sup-cliente .etichetta{font-size:15px;color:var(--ink);font-weight:650}
body.sup-cliente .campo .aiuto{font-size:14px}
body.sup-cliente input[type=text],body.sup-cliente input[type=email],body.sup-cliente input[type=tel],body.sup-cliente input[type=password],body.sup-cliente input[type=search],body.sup-cliente input[type=number],body.sup-cliente select,body.sup-cliente textarea{font-size:16px;min-height:48px;border-radius:12px}
body.sup-cliente input[readonly]{background:var(--bg);color:var(--ink-2)}
body.sup-cliente .pastiglia{font-size:13px;padding:3px 10px}
body.sup-cliente .pic{font-size:14px}
body.sup-cliente .dl{font-size:15.5px;gap:9px 20px}
body.sup-cliente .avviso{font-size:15px;line-height:1.5}
body.sup-cliente .avviso a{font-weight:700}
body.sup-cliente .tessera>.tt h2{font-size:18px}
body.sup-cliente .tessera>.tt a{font-weight:650;font-size:15px}
body.sup-cliente .stato-vuoto{padding:26px 18px}
body.sup-cliente .stato-vuoto svg{color:var(--brand-100)}
body.sup-cliente .stato-vuoto b{font-size:16.5px}
body.sup-cliente .stato-vuoto span{font-size:15px;display:block;max-width:440px;margin:0 auto}
body.sup-cliente .spunta{font-size:16px}
body.sup-cliente .scelta span{font-size:15.5px;min-height:48px}
body.sup-cliente .modale .mt h2{font-size:20px}
body.sup-cliente .modale .mc{font-size:16px}
body.sup-cliente .bolla{font-size:16px;max-width:84%;line-height:1.45}
body.sup-cliente .bolla .md{font-size:13px}
body.sup-cliente .cli-corpo .sotto{font-size:16.5px;max-width:720px}
body.sup-cliente .cli-corpo .sotto b{color:var(--ink)}

.cli-sez{display:flex;align-items:center;gap:10px;font-size:19px;margin:30px 0 12px}
.cli-sez:first-child{margin-top:0}
.cli-sez .muto{font-weight:500;font-size:15px}
.cli-cambio{margin-bottom:16px}
.cli-indietro{display:inline-flex;align-items:center;gap:6px;min-height:44px;font-weight:650;font-size:15.5px;margin:-10px 0 4px}
.cli-grande{font-size:17px;line-height:1.5}
.cli-etich{font-size:12.5px;font-weight:750;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3)}
.cli-importo{font-size:34px;font-weight:800;letter-spacing:-.03em;line-height:1.1;font-variant-numeric:tabular-nums;color:var(--ink);margin-top:2px}
.cli-lista-t{display:flex;flex-direction:column;gap:12px}
.cli-lista-t>.tessera+.tessera{margin-top:0}
.cli-testa-pag{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:18px}
.cli-testa-pag .sotto{margin-bottom:0}
.cli-testa-pag h1{overflow-wrap:anywhere}

/* righe cliccabili: link veri (si aprono anche in una scheda nuova) */
.cli-righe{list-style:none}
.cli-righe>li+li{border-top:1px solid var(--line-2)}
.cli-riga{display:flex;align-items:center;gap:14px;padding:14px 18px;color:var(--ink);text-decoration:none!important;min-height:66px;width:100%;border:0;background:none;text-align:left;font:inherit;cursor:pointer}
.cli-riga:hover{background:var(--brand-50)}
.cli-riga .cx1{flex:1;min-width:0}
.cli-riga .t1{display:block;font-weight:650;font-size:16px;line-height:1.35}
.cli-riga .t2{display:block;font-size:14.5px;color:var(--ink-3);margin-top:2px;line-height:1.4}
.cli-riga .dxx{text-align:right;flex:0 0 auto;display:flex;flex-direction:column;align-items:flex-end;gap:5px}
.cli-riga .imp{font-weight:750;font-variant-numeric:tabular-nums;font-size:16.5px;white-space:nowrap}
.cli-riga>svg.ic:last-child{color:var(--ink-3)}
.cli-riga.nuovo .t1::before{content:"";display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--accent);margin-right:8px;vertical-align:1px}
.cli-riga.letto .t1{font-weight:500;color:var(--ink-2)}
.cli-ico{width:42px;height:42px;border-radius:12px;background:var(--brand-50);color:var(--brand-600);display:grid;place-items:center;flex:0 0 42px}
.cli-ico.acc{background:var(--accent-50);color:var(--accent-dark)}
.cli-ico.ok{background:var(--ok-50);color:var(--ok)}
@media(max-width:560px){
  .cli-riga{padding:13px 14px;gap:11px}
  .cli-ico{width:38px;height:38px;flex-basis:38px}
  .cli-riga:has(.dxx){display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:11px;row-gap:7px}
  .cli-riga:has(.dxx) .dxx{grid-column:1;grid-row:2;flex-direction:row;align-items:center;justify-content:flex-start;flex-wrap:wrap;text-align:left;gap:6px 10px}
  .cli-riga:has(.dxx)>svg.ic:last-child{grid-column:2;grid-row:1/span 2;align-self:center}
  .cli-riga:has(.dxx):has(.cli-ico){grid-template-columns:auto minmax(0,1fr) auto}
  .cli-riga:has(.dxx):has(.cli-ico) .cli-ico{grid-column:1;grid-row:1/span 2;align-self:start}
  .cli-riga:has(.dxx):has(.cli-ico) .cx1,.cli-riga:has(.dxx):has(.cli-ico) .dxx{grid-column:2}
  .cli-riga:has(.dxx):has(.cli-ico)>svg.ic:last-child{grid-column:3}
}

/* home */
.benvenuto .cli-ben-t{flex:1 1 380px;min-width:0}
body.sup-cliente .benvenuto h1{font-size:29px}
body.sup-cliente .benvenuto p{font-size:17px;margin-top:6px}
.benvenuto p b{color:#fff}
.cli-altri{margin-top:14px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:15px;color:rgba(255,255,255,.85)}
.cli-altri button{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.1);color:#fff;border-radius:99px;padding:6px 8px 6px 14px;font-weight:650;cursor:pointer;min-height:40px;font-size:15px}
.cli-altri button:hover{background:rgba(255,255,255,.2)}
.cli-home-az{margin:18px 0}
@media(max-width:760px){
  .benvenuto>.btn{width:100%}
  .cli-home-az{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  body.sup-cliente .cli-home-az .azione-card{flex-direction:column;align-items:flex-start;gap:10px;padding:14px;min-height:0}
  body.sup-cliente .cli-home-az .azione-card b{font-size:16px;line-height:1.25}
  body.sup-cliente .cli-home-az .azione-card div>span{font-size:13.5px;display:block;margin-top:3px;line-height:1.35}
}
body.sup-cliente .azione-card{min-height:92px}
body.sup-cliente .azione-card b{font-size:16.5px}
body.sup-cliente .azione-card span{font-size:14.5px}
.cli-cal{flex:0 0 66px;width:66px;border-radius:14px;background:var(--accent-50);border:1px solid #F6D2B4;text-align:center;padding:7px 0 6px;line-height:1.1;color:var(--accent-dark)}
.cli-cal small{display:block;font-size:11.5px!important;font-weight:750;letter-spacing:.08em;text-transform:uppercase;color:inherit}
.cli-cal b{display:block;font-size:27px;font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums;margin:1px 0}
.cli-cal.grigio{background:var(--bg);border-color:var(--line);color:var(--ink-3)}
.cli-cal.grigio b{color:var(--ink-3)}
.cli-prossimo{display:flex;gap:16px;align-items:center;color:var(--ink);text-decoration:none!important;border-radius:14px;padding:4px}
.cli-prossimo:hover{background:var(--brand-50)}
.cli-prossimo .cx1{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;align-items:flex-start}
.cli-prossimo .g1{font-size:21px;font-weight:750;line-height:1.2}
.cli-prossimo .g2{font-size:16px;color:var(--ink-2)}
.cli-prossimo .g3{font-size:15.5px;color:var(--ink-3)}
.cli-nota{display:flex;gap:9px;align-items:flex-start;margin-top:14px;padding-top:12px;border-top:1px solid var(--line-2);font-size:15px;color:var(--ink-2)}
.cli-nota svg{color:var(--brand-500);margin-top:2px}
.cli-blocco .cp.stretto{padding:4px 0}
.cli-vuoto-link{text-align:center;margin:-10px 0 18px}

/* interventi */
.cli-int{display:flex;gap:16px;align-items:center;padding:16px 18px;color:var(--ink);text-decoration:none!important;transition:box-shadow .15s}
.cli-int:hover{box-shadow:var(--sh-2)}
.cli-int .cx1{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;align-items:flex-start}
.cli-int .g1{font-size:18px;font-weight:750}
.cli-int .g1 .muto{font-weight:550}
.cli-int .g2{font-size:16px;color:var(--ink-2)}
.cli-int .g3{font-size:15px;color:var(--ink-3)}
.cli-int>svg.ic:last-child{color:var(--ink-3)}
.cli-filtri{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:6px}
.cli-filtri .campo{margin:0;min-width:220px;flex:0 1 320px}
.cli-dett{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:18px;align-items:start}
.cli-dett>.cli-lato{display:flex;flex-direction:column;gap:14px;position:sticky;top:90px}
.cli-dett .tessera+.tessera{margin-top:16px}
.cli-dett>.cli-lato>.tessera+.tessera{margin-top:0}
@media(max-width:980px){.cli-dett{grid-template-columns:minmax(0,1fr)}.cli-dett>.cli-lato{position:static;order:-1}}
.cli-testo h3{font-size:14px;font-weight:750;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);margin:16px 0 4px}
.cli-testo h3:first-child{margin-top:0}
.cli-testo p{font-size:16.5px;line-height:1.55;white-space:pre-wrap}
.cli-mat{list-style:none;margin-top:4px}
.cli-mat li{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--line-2);font-size:15.5px}
.cli-mat li:last-child{border-bottom:0}
.cli-mat li span:last-child{font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--ink-2)}
.cli-galleria{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
.cli-galleria button{position:relative;border:1px solid var(--line);border-radius:12px;overflow:hidden;padding:0;background:var(--bg-2);aspect-ratio:1;cursor:zoom-in}
.cli-galleria img{width:100%;height:100%;object-fit:cover;display:block}
.cli-galleria .tag{position:absolute;left:8px;bottom:8px;background:rgba(6,27,39,.75);color:#fff;font-size:12.5px;font-weight:650;padding:3px 9px;border-radius:99px}
.cli-foto-grande{width:100%;border-radius:12px;display:block;background:var(--bg-2)}
.cli-firma{display:flex;gap:18px;align-items:flex-end;flex-wrap:wrap}
.cli-firma img{max-width:280px;width:100%;background:#fff;border:1px solid var(--line);border-radius:12px;padding:8px}
.cli-firma div{font-size:15.5px;line-height:1.45}
.cli-tel{font-size:22px;font-weight:800;letter-spacing:-.01em;display:inline-flex;align-items:center;gap:8px;margin:4px 0}

/* preventivi */
.cli-prv{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:20px;align-items:start}
.cli-prv>.cli-lato{grid-column:2;grid-row:1;position:sticky;top:90px;display:flex;flex-direction:column;gap:14px}
.cli-prv>.cli-lato>.tessera+.tessera{margin-top:0}
.cli-prv>.cli-foglio{grid-column:1;grid-row:1}
@media(max-width:980px){.cli-prv{grid-template-columns:minmax(0,1fr)}.cli-prv>.cli-lato,.cli-prv>.cli-foglio{grid-column:1;grid-row:auto;position:static}}
.cli-decidi .btn.xl{margin-top:16px}
.cli-decidi .cli-sec{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:8px;margin-top:10px}
.cli-validita{display:flex;gap:8px;align-items:center;margin-top:12px;font-size:15.5px;color:var(--ink-2)}
.cli-validita.warn{color:var(--warn);font-weight:650}
.cli-carta-prv{display:flex;flex-direction:column;gap:6px;padding:18px;color:var(--ink);text-decoration:none!important;transition:box-shadow .15s}
.cli-carta-prv:hover{box-shadow:var(--sh-2)}
.cli-carta-prv h3{font-size:18px;line-height:1.3}
.cli-carta-prv .cli-importo{font-size:28px}
.cli-carta-prv .btn{margin-top:8px;align-self:flex-start}
.cli-ricevuta{border-color:var(--ok-line)!important;background:linear-gradient(180deg,var(--ok-50),var(--surface) 130px)}
.cli-ric-testa{display:flex;gap:12px;align-items:flex-start;margin-bottom:14px}
.cli-ric-testa>svg.ic{color:#fff;background:var(--ok);border-radius:50%;padding:8px;width:40px;height:40px;flex:0 0 40px;stroke-width:2.6}
.cli-ric-testa b{display:block;font-size:19px;color:var(--ok)}
.cli-ric-testa span{font-size:15.5px;color:var(--ink-2)}
.cli-ricevuta.no{border-color:var(--line)!important;background:var(--surface)}
.cli-ricevuta.no .cli-ric-testa>svg.ic{background:var(--ink-3)}
.cli-ricevuta.no .cli-ric-testa b{color:var(--ink-2)}
.cli-impronta{margin-top:14px;padding:12px;border-radius:12px;background:var(--bg);border:1px dashed var(--line)}
.cli-impronta code{display:block;font-family:var(--mono);font-size:13px;word-break:break-all;margin:4px 0 6px;color:var(--ink)}
.cli-impronta small{font-size:13.5px!important;display:block;line-height:1.45}
.cli-totale-live{display:flex;flex-direction:column;gap:2px;padding:14px 16px;border-radius:14px;background:var(--brand-50);border:1px solid var(--brand-100);margin:14px 0}
.cli-totale-live span{font-size:14px;font-weight:650;color:var(--brand-700)}
.cli-totale-live b{font-size:30px;font-weight:800;font-variant-numeric:tabular-nums;color:var(--brand-900);letter-spacing:-.02em}
.cli-totale-live small{font-size:14px!important;color:var(--ink-3)}
.cli-opz{border:0;margin:12px 0 4px}
.cli-opz legend{font-weight:700;font-size:16px;margin-bottom:8px}
.cli-opz-riga,.cli-radio{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border:1.5px solid var(--line);border-radius:14px;cursor:pointer;margin-bottom:8px;background:var(--surface)}
.cli-opz-riga:has(input:checked){border-color:var(--ok);background:var(--ok-50)}
.cli-radio:has(input:checked){border-color:var(--brand-600);background:var(--brand-50)}
.cli-opz-riga input,.cli-radio input{width:24px;height:24px;margin-top:1px}
.cli-opz-riga b,.cli-radio b{display:block;font-size:16px;font-weight:650;line-height:1.35}
.cli-opz-riga small,.cli-radio small{font-size:14.5px!important;display:block}
.cli-spunta-g{padding:14px!important;border:1.5px solid var(--line);border-radius:14px;align-items:center!important;font-weight:600;margin-top:4px}
.cli-spunta-g input{width:24px;height:24px}
.cli-spunta-g:has(input:checked){border-color:var(--ok);background:var(--ok-50)}
.cli-spunta-g small{font-weight:500}
.cli-passo{font-size:12.5px;font-weight:750;letter-spacing:.08em;text-transform:uppercase;color:var(--accent-dark);margin-bottom:6px}
.cli-riep{background:var(--bg);border-radius:14px;padding:14px 16px;margin:14px 0}
.cli-motivi{margin-top:10px}

/* il foglio (preventivo, rapportino) leggibile anche sul telefono */
/* l'impronta del preventivo accettato e' una parola sola di 64 caratteri: sul telefono deve andare a capo */
.cli-foglio .foglio{max-width:none;overflow-wrap:break-word}
.cli-foglio table.cli-senza-sconto th:nth-child(4),.cli-foglio table.cli-senza-sconto td:nth-child(4){display:none}
.cli-foglio .barra-stampa{max-width:none}
@media(max-width:760px){
  .cli-foglio .foglio{padding:18px 14px;font-size:13px;border-radius:12px}
  .cli-foglio .foglio .intesta{flex-direction:column;gap:12px}
  .cli-foglio .foglio .intesta>div:last-child{text-align:left!important}
  .cli-foglio .foglio .intesta+table td{display:block;width:auto!important;padding:4px 0}
  .cli-foglio .foglio table{font-size:12.5px}
  .cli-foglio .foglio th,.cli-foglio .foglio td{padding:6px 3px}
  .cli-foglio .foglio .totali{width:100%}
}

/* richiesta di intervento */
.cli-richiedi{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:20px;align-items:start}
.cli-richiedi>aside{position:sticky;top:90px}
@media(max-width:980px){.cli-richiedi{grid-template-columns:minmax(0,1fr)}.cli-richiedi>aside{position:static}}
.cli-dom{border:0;margin:0 0 24px;min-width:0}
.cli-dom legend{display:flex;align-items:center;gap:10px;font-size:18.5px;font-weight:750;margin-bottom:12px;color:var(--ink)}
.cli-dom legend .muto{font-weight:500;font-size:15px}
.cli-n{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;background:var(--brand-700);color:#fff;font-size:15px;font-weight:750;flex:0 0 30px}
.cli-tipi{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.cli-tipi .scelta{display:flex}
body.sup-cliente .cli-tipi .scelta span{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:3px;width:100%;min-height:96px;padding:14px 16px;border-radius:16px;font-size:17.5px;line-height:1.25}
.cli-tipi .scelta span svg{color:var(--brand-600);width:26px;height:26px;margin-bottom:2px}
.cli-tipi .scelta span small{font-size:14.5px!important;font-weight:500;color:var(--ink-3)}
body.sup-cliente .cli-urg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
.cli-urg .scelta{display:flex}
body.sup-cliente .cli-urg .scelta span{min-height:54px;padding:10px 14px;font-size:16.5px;width:100%;justify-content:center;text-align:center}
@media(max-width:560px){body.sup-cliente .cli-urg{grid-template-columns:minmax(0,1fr)}}
.cli-urg .scelta.urg input:checked+span{border-color:var(--dang);background:var(--dang-50);color:var(--dang);box-shadow:inset 0 0 0 1px var(--dang)}
.cli-gas{margin-top:14px}
.cli-gas a{font-weight:800;font-size:18px;white-space:nowrap}
.cli-foto-anteprime{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.cli-foto-anteprime:empty{display:none}
.cli-foto-mini{position:relative;width:100px;height:100px;border-radius:12px;overflow:hidden;border:1px solid var(--line);background:var(--bg-2)}
.cli-foto-mini img{width:100%;height:100%;object-fit:cover;display:block}
.cli-foto-mini button{position:absolute;top:5px;right:5px;width:32px;height:32px;border-radius:50%;border:0;background:rgba(6,27,39,.78);color:#fff;display:grid;place-items:center;cursor:pointer}
.cli-passi{list-style:none;counter-reset:p;display:flex;flex-direction:column;gap:14px}
.cli-passi li{position:relative;padding-left:42px;min-height:30px;font-size:16px;line-height:1.45;padding-top:3px}
.cli-passi li::before{counter-increment:p;content:counter(p);position:absolute;left:0;top:0;display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:var(--brand-50);color:var(--brand-700);font-weight:800;border:1px solid var(--brand-100)}
.cli-fatto{text-align:center;padding:14px 0 4px}
.cli-fatto .tondo{width:76px;height:76px;border-radius:50%;background:var(--ok);color:#fff;display:grid;place-items:center;margin:0 auto 14px;box-shadow:0 8px 24px rgba(21,112,74,.28)}
.cli-fatto .tondo svg{width:38px;height:38px;stroke-width:2.6}
.cli-fatto h1{margin-bottom:6px}
.cli-fatto p{font-size:17px;color:var(--ink-2)}
.cli-fatto-corpo{max-width:640px;margin:0 auto}

/* ordina materiale */
.cli-ordina{display:grid;grid-template-columns:minmax(0,1fr) 370px;gap:20px;align-items:start}
.cli-ordina .carrello{top:90px}
@media(max-width:980px){.cli-ordina{grid-template-columns:minmax(0,1fr)}.cli-ordina .carrello{position:static}}
.cli-catalogo{margin-top:14px}
.cli-cat{scroll-margin-top:90px}
.cli-cat-testa{display:flex;align-items:center;gap:14px;width:100%;padding:14px 18px;border:0;background:none;cursor:pointer;text-align:left;font:inherit;color:var(--ink);min-height:72px;border-radius:var(--r-l)}
.cli-cat-testa:hover{background:var(--brand-50)}
.cli-cat-testa .cx1{flex:1;min-width:0}
.cli-cat-testa b{display:block;font-size:17px;line-height:1.3}
.cli-cat-testa small{font-size:14px!important}
.cli-cat-testa small.nel{color:var(--ok);font-weight:650}
.cli-cat-testa>svg.ic:last-child{width:24px;height:24px;color:var(--ink-3);transition:transform .15s}
.cli-cat.aperta .cli-cat-testa>svg.ic:last-child{transform:rotate(180deg)}
.cli-cat.aperta .cli-cat-testa{border-bottom:1px solid var(--line-2);border-radius:var(--r-l) var(--r-l) 0 0}
.cli-cat:not(.aperta) .cli-cat-lista{display:none}
.cli-cercando .cli-cat .cli-cat-lista{display:block}
.cli-cercando .cli-cat-testa>svg.ic:last-child{visibility:hidden}
.cli-art{display:flex;align-items:center;gap:14px;padding:12px 18px;min-height:70px}
.cli-art+.cli-art{border-top:1px solid var(--line-2)}
.cli-art .cx1{flex:1;min-width:0}
.cli-art .cx1 b{display:block;font-weight:650;font-size:16px;line-height:1.3}
.cli-art .cx1 small{font-size:13.5px!important}
.cli-art-prezzo{text-align:right;flex:0 0 auto;line-height:1.25}
.cli-art-prezzo b{display:block;font-variant-numeric:tabular-nums;font-size:16.5px}
.cli-art-prezzo small{font-size:13px!important}
.cli-art .azz{flex:0 0 150px;display:flex;justify-content:flex-end}
body.sup-cliente .cli-step button{width:44px;height:44px}
.cli-step input::-webkit-outer-spin-button,.cli-step input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.cli-step input{-moz-appearance:textfield;appearance:textfield}
body.sup-cliente .stepper input{width:54px;min-height:44px;border:0;border-left:1px solid var(--line-2);border-right:1px solid var(--line-2);border-radius:0;font-size:16px;padding:0;box-shadow:none}
@media(max-width:560px){.cli-art{flex-wrap:wrap;padding:12px 14px;gap:6px 12px}.cli-art .cx1{flex:1 1 55%}.cli-art .azz{flex:1 1 100%}}
.cli-carr-righe{list-style:none;padding:0 18px}
.cli-carr-righe li{display:grid;grid-template-columns:1fr auto;gap:6px 10px;padding:12px 0;border-bottom:1px solid var(--line-2);align-items:center}
.cli-carr-righe .nm{grid-column:1/-1;font-weight:650;line-height:1.3}
.cli-carr-righe .nm small{display:block;font-weight:500;font-size:13.5px!important}
.cli-carr-righe .stepper{justify-self:start}
.cli-carr-righe .imp{font-weight:750;font-variant-numeric:tabular-nums;text-align:right}
.cli-carr-tot{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:14px 18px;border-bottom:1px solid var(--line-2);font-weight:650}
.cli-carr-tot b{font-size:24px;font-variant-numeric:tabular-nums}
.cli-carr-tot small{display:block;font-weight:500}
.cli-barra-carr{display:none}
@media(max-width:980px){
  .cli-barra-carr{display:flex;position:fixed;left:12px;right:12px;bottom:12px;z-index:40;align-items:center;gap:12px;padding:12px 18px;border-radius:16px;background:var(--brand-800);color:#fff;border:0;box-shadow:var(--sh-3);font-size:16px;font-weight:650;cursor:pointer;min-height:62px;text-align:left}
  .cli-barra-carr .cx1{flex:1}
  .cli-barra-carr b{font-variant-numeric:tabular-nums}
  .cli-spazio-barra{height:84px}
}
.cli-ord-tab{width:100%;border-collapse:collapse;font-size:15px}
.cli-ord-tab td{padding:9px 4px;border-bottom:1px solid var(--line-2)}
.cli-ord-tab td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.cli-ord-tab tr.tot td{font-weight:800;border-bottom:0;border-top:2px solid var(--line)}

/* documenti */
.cli-doc{display:flex;align-items:center;gap:14px;padding:13px 18px}
.cli-doc+.cli-doc{border-top:1px solid var(--line-2)}
.cli-doc .cx1{flex:1;min-width:0}
.cli-doc .cx1 b{display:block;font-weight:650;font-size:16px;line-height:1.35}
.cli-doc .cx1 small{font-size:14px!important}
@media(max-width:560px){.cli-doc{flex-wrap:wrap;padding:13px 14px}.cli-doc .btn{flex:1 1 calc(100% - 56px);margin-left:56px}}

/* impianti */
.cli-imp{display:flex;flex-direction:column}
.cli-imp>.cp{flex:1;display:flex;flex-direction:column;gap:14px}
.cli-imp-testa{display:flex;gap:14px;align-items:center}
.cli-imp-testa .cli-ico{width:52px;height:52px;flex-basis:52px;border-radius:14px}
.cli-imp-testa .cli-ico svg{width:26px;height:26px}
.cli-imp-testa small{display:block;font-size:12.5px!important;font-weight:750;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3)}
.cli-imp-testa h2{font-size:19px;line-height:1.25}
.cli-imp .dl{grid-template-columns:auto minmax(0,1fr);align-items:center}
.cli-corpo .dl .pastiglia{white-space:normal;line-height:1.35}
.cli-imp .piede{margin-top:auto;display:flex;flex-direction:column;gap:8px}
.cli-imp .contratto{font-size:14.5px;color:var(--ink-2);display:flex;gap:8px;align-items:flex-start}
.cli-imp .contratto svg{color:var(--ok);margin-top:2px}

/* messaggi */
body.sup-cliente .cli-chat .chat{max-height:58vh;min-height:260px;padding:18px}
.cli-chat{overflow:hidden}
.cli-chat .scrivi{align-items:flex-end}
body.sup-cliente .cli-chat .scrivi textarea{height:auto;min-height:64px}
.cli-chat .scrivi .btn{min-height:56px}
.bolla .chi{display:block;font-size:13px;font-weight:750;opacity:.75;margin-bottom:2px}
.cli-giorno{align-self:center;font-size:13px;color:var(--ink-3);background:var(--surface);border:1px solid var(--line-2);padding:3px 11px;border-radius:99px}
.cli-contesto{display:flex;gap:8px;align-items:center;font-size:15px;color:var(--ink-2);margin-bottom:14px}

/* profilo */
.cli-profilo{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;align-items:start}
.cli-profilo .tessera+.tessera{margin-top:16px}
@media(max-width:860px){.cli-profilo{grid-template-columns:minmax(0,1fr)}}

/* non trovato */
.cli-nontrovato{max-width:560px;margin:30px auto;text-align:center}
.cli-nontrovato .cp{padding:38px 26px!important}
.cli-nontrovato svg.ic{width:46px;height:46px;color:var(--brand-500);margin-bottom:10px}
.cli-nontrovato p{font-size:17px;color:var(--ink-2);margin:8px 0 22px}
`;
  function stile() {
    if (!document.getElementById('stile-cliente')) document.head.insertAdjacentHTML('beforeend', '<style id="stile-cliente">' + CSS + '</style>');
  }

  // ===========================================================================
  // ATTREZZI
  // ===========================================================================
  const maiuscola = s => { s = String(s || ''); return s ? s[0].toUpperCase() + s.slice(1) : s; };
  const taglia = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
  const giorno10 = v => String(v || '').slice(0, 10);
  const telLink = t => 'tel:' + String(t || '').replace(/[^\d+]/g, '');
  const UNITA = { pz: 'pezzo', m: 'metro', lt: 'litro', kit: 'kit', sacco: 'sacco', kg: 'kg', corpo: 'corpo' };

  /** «Oggi», «Domani», «Mercoledì 30 settembre»: chi legge non deve fare i conti col calendario. */
  function giornoUmano(iso) {
    if (!iso) return 'Data da fissare';
    const d = A.diffGiorni(A.oggi(), giorno10(iso));
    if (d === 0) return 'Oggi';
    if (d === 1) return 'Domani';
    if (d === -1) return 'Ieri';
    return maiuscola(A.dataLunga(giorno10(iso)));
  }
  /**
   * Fascia di arrivo: un'ora a partire dall'orario fissato. Dire «alle 9:30»
   * a un cliente e arrivare alle 9:50 e' una promessa mancata; «tra le 9:30 e
   * le 10:30» e' la stessa informazione, mantenuta.
   */
  function fascia(i) {
    if (!i.ora) return 'orario da confermare';
    const [hh, mm] = i.ora.split(':').map(Number);
    const f = hh * 60 + mm + 60;
    return 'tra le ' + hh + ':' + A.pad(mm) + ' e le ' + Math.floor(f / 60) + ':' + A.pad(f % 60);
  }
  /** Solo il nome di battesimo: al cliente basta sapere chi suona il campanello. */
  function nomiTecnici(ids) {
    const n = (ids || []).map(id => (A.utenteDa(id) || {}).nome).filter(Boolean).map(x => x.split(' ')[0]);
    if (!n.length) return '';
    return n.length === 1 ? n[0] : n.slice(0, -1).join(', ') + ' e ' + n[n.length - 1];
  }
  function descrMacchina(m) { return m ? maiuscola(m.categoria) + ' ' + [m.marca, m.modello].filter(Boolean).join(' ') : ''; }
  function iconaMacchina(m) {
    const c = String((m && m.categoria) || '').toLowerCase();
    if (/caldaia|bruciatore/.test(c)) return 'fiamma';
    if (/acqua|scaldabagno|addolc/.test(c)) return 'goccia';
    if (/pompa|clima/.test(c)) return 'fulmine';
    if (/circolatore|vaso/.test(c)) return 'ricarica';
    return 'impianto';
  }
  function kb(n) { n = Number(n) || 0; if (!n) return ''; return n >= 1048576 ? A.num(n / 1048576, 1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' kB'; }
  function importoRiga(r) { return A.arrot((Number(r.qta) || 0) * (Number(r.prezzo) || 0) * (1 - (Number(r.sconto) || 0) / 100)); }
  /** Totali del preventivo con una scelta di voci facoltative, senza toccare l'archivio. */
  function totaliCon(p, scelte) {
    const copia = JSON.parse(JSON.stringify(p));
    copia.righe.forEach(r => { if (r.opzionale) r.scelta = scelte.includes(r.id); });
    return { copia, t: A.totaliPreventivo(copia) };
  }
  /** «Chrome su Android», «Safari su iPhone»: e' parte della prova dell'accettazione, e deve leggerla anche un avvocato. */
  function browserInParole() {
    const ua = navigator.userAgent || '';
    let b = 'Browser', s = 'computer';
    if (/Edg\//.test(ua)) b = 'Edge';
    else if (/OPR\//.test(ua)) b = 'Opera';
    else if (/SamsungBrowser/.test(ua)) b = 'Samsung Internet';
    else if (/Firefox|FxiOS/.test(ua)) b = 'Firefox';
    else if (/CriOS|Chrome|Chromium/.test(ua)) b = 'Chrome';
    else if (/Safari/.test(ua)) b = 'Safari';
    if (/iPhone/.test(ua)) s = 'iPhone';
    else if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) s = 'iPad';
    else if (/Android/.test(ua)) s = 'Android';
    else if (/Windows/.test(ua)) s = 'Windows';
    else if (/CrOS/.test(ua)) s = 'Chromebook';
    else if (/Mac OS X|Macintosh/.test(ua)) s = 'Mac';
    else if (/Linux/.test(ua)) s = 'Linux';
    return b + ' su ' + s;
  }
  function erroreIn(sel, msg) {
    const e = A.$(sel); if (!e) return A.toast(msg, 'per');
    e.innerHTML = '<div class="avviso dang" style="margin-top:12px">' + icona('attenzione') + '<div>' + h(msg) + '</div></div>';
    e.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // ===========================================================================
  // CHI SONO E PER CHI STO GUARDANDO — il cancello
  // ===========================================================================
  function idsMiei() {
    const u = A.utente();
    return (u && Array.isArray(u.clienti)) ? u.clienti.filter(id => A.cliente(id)) : [];
  }
  function idAttivo() {
    const miei = idsMiei();
    let id = null;
    try { id = sessionStorage.getItem(CHIAVE_ATTIVO); } catch (_) { }
    // Un valore scritto a mano nella sessione (o rimasto da un altro utente
    // sullo stesso computer) non apre niente: vale solo se e' fra i SUOI clienti.
    return miei.includes(id) ? id : (miei[0] || null);
  }
  function clienteAttivo() { const id = idAttivo(); return id ? A.cliente(id) : null; }
  function impostaAttivo(id) {
    if (!idsMiei().includes(id)) return false;
    try { sessionStorage.setItem(CHIAVE_ATTIVO, id); } catch (_) { }
    return true;
  }
  /**
   * Il cancello. Restituisce il documento solo se appartiene a uno dei clienti
   * dell'utente; altrimenti null (→ «Non trovato»). Se appartiene a un suo
   * cliente diverso da quello attivo — l'amministratore apre dall'email il
   * preventivo di un altro condominio — quel cliente diventa l'attivo: cosi'
   * la pagina resta coerente con la testata, e nessuna pagina mescola due clienti.
   */
  function mio(rec) {
    if (!rec || !idsMiei().includes(rec.clienteId)) return null;
    if (rec.clienteId !== idAttivo()) {
      impostaAttivo(rec.clienteId);
      // Detto in pagina e non con un messaggio a comparsa: sul telefono il
      // messaggio copriva proprio il bottone «Accetta».
      passatoA = rec.clienteId;
    }
    return rec;
  }
  let passatoA = null;
  const prvVisibile = p => !!p && p.stato !== 'bozza';
  const allVisibile = a => !!a && a.visibileCliente === true;
  const rapportoPronto = i => !!(i && i.rapporto && i.rapporto.stato === 'approvato');
  /** Documenti di una raccolta che appartengono al cliente attivo. */
  function miei(coll, filtro) { const id = idAttivo(); return (A.DB[coll] || []).filter(x => x.clienteId === id && (!filtro || filtro(x))); }

  // ---- stati detti come li direbbe l'ufficio al telefono, non come li scrive il gestionale
  const APERTI = ['da_pianificare', 'pianificato', 'in_viaggio', 'in_corso', 'sospeso'];
  const CHIUSI = ['completato', 'approvato', 'valorizzato', 'fatturato'];
  // «Valorizzato» e «fatturato» sono fatti interni dell'ufficio: per il cliente il lavoro e' «fatto» e basta.
  const STATO_INT = { da_pianificare: ['Da fissare', 'grigio'], pianificato: ['Fissato', 'blu'], in_viaggio: ['Il tecnico sta arrivando', 'acc'], in_corso: ['In corso', 'acc'], sospeso: ['In pausa', 'warn'], completato: ['Fatto · in controllo', 'blu'], approvato: ['Fatto', 'ok'], valorizzato: ['Fatto', 'ok'], fatturato: ['Fatto', 'ok'], annullato: ['Annullato', 'grigio'] };
  const statoInt = s => { const x = STATO_INT[s] || [s, '']; return A.pastiglia(x[0], x[1]); };
  function daDecidere(p) { return (p.stato === 'inviato' || p.stato === 'visto') && !scadutoData(p); }
  function scadutoData(p) { return !!p.validoFino && giorno10(p.validoFino) < A.oggi(); }
  function scaduto(p) { return p.stato === 'scaduto' || ((p.stato === 'inviato' || p.stato === 'visto') && scadutoData(p)); }
  function statoPrv(p) {
    if (scaduto(p)) return A.pastiglia('Scaduto', 'warn');
    const x = { inviato: ['Da decidere', 'acc'], visto: ['Da decidere', 'acc'], accettato: ['Accettato', 'ok'], convertito: ['Accettato', 'ok'], rifiutato: ['Rifiutato', 'grigio'] }[p.stato] || [p.stato, 'grigio'];
    return A.pastiglia(x[0], x[1]);
  }
  const TIPI_RIC = { guasto: 'Un guasto', intervento: 'Un intervento', sopralluogo: 'Un sopralluogo', preventivo: 'Un preventivo' };
  const URGENZE = { quando_potete: 'Quando potete', questa_settimana: 'Questa settimana', urgente: 'È urgente' };
  const STATO_RIC = { nuova: ['Ricevuta', 'blu'], presa: ['Presa in carico', 'acc'], pianificata: ['Intervento fissato', 'ok'], rifiutata: ['Non possiamo farla', 'grigio'], chiusa: ['Chiusa', 'grigio'] };
  function statoOrdine(o) {
    const x = { nuovo: ['Ricevuto', 'blu'], confermato: ['Confermato', 'blu'], in_preparazione: ['In preparazione', 'acc'], pronto: [o.consegna === 'consegna' ? 'Pronto per la consegna' : 'Pronto per il ritiro', 'ok'], consegnato: ['Consegnato', 'grigio'], annullato: ['Annullato', 'grigio'] }[o.stato] || [o.stato, 'grigio'];
    return A.pastiglia(x[0], x[1]);
  }

  function conteggi(cid) {
    const db = A.DB;
    return {
      preventivi: db.preventivi.filter(p => p.clienteId === cid && daDecidere(p)).length,
      messaggi: db.conversazioni.filter(c => c.clienteId === cid && !c.lettoCliente).length
    };
  }
  function daVedere(cid) { const n = conteggi(cid); return n.preventivi + n.messaggi; }
  function avvisiDi(cid) { const u = A.utente(); return A.mieiAvvisi().filter(a => a.a === 'cliente:' + cid || a.a === u.id); }
  /** Segna letti gli avvisi dell'utente che soddisfano il filtro. Scrive solo se serve. */
  function segnaLetti(filtro) {
    const ids = new Set(A.mieiAvvisi().filter(a => !a.letto && filtro(a)).map(a => a.id));
    if (!ids.size) return;
    A.modifica(db => db.avvisi.forEach(a => { if (ids.has(a.id)) a.letto = true; }));
  }

  // ===========================================================================
  // GUSCIO — testata con il selettore del cliente, menu, corpo
  // ===========================================================================
  const VOCI = [
    ['home', 'Home', 'casa', '#/c/home'],
    ['preventivi', 'Preventivi', 'documento', '#/c/preventivi', 'preventivi'],
    ['interventi', 'Interventi', 'chiave', '#/c/interventi'],
    ['documenti', 'Documenti', 'graffetta', '#/c/documenti'],
    ['impianti', 'I miei impianti', 'impianto', '#/c/impianti'],
    ['richiedi', 'Richiedi intervento', 'telefono', '#/c/richiedi'],
    ['ordina', 'Ordina materiale', 'carrello', '#/c/ordina', 'carrello'],
    ['messaggi', 'Messaggi', 'messaggio', '#/c/messaggi', 'messaggi'],
    ['profilo', 'Profilo', 'utente', '#/c/profilo']
  ];
  const ETICHETTA_CONTATORE = { preventivi: 'da decidere', messaggi: 'da leggere', carrello: 'nel carrello' };

  function guscio(voce, contenuto) {
    const u = A.utente();
    const att = clienteAttivo();
    const clienti = idsMiei().map(A.cliente);
    const n = att ? conteggi(att.id) : { preventivi: 0, messaggi: 0 };
    n.carrello = att ? Object.keys(leggiCarrello(att.id)).length : 0;
    let sel = '';
    if (clienti.length > 1) {
      sel = `<label class="cli-sel"><small>Stai guardando</small><select data-cambia="cli-cambia-cliente" aria-label="Cliente che stai guardando">${clienti.map(c => {
        const k = c.id === att.id ? 0 : daVedere(c.id);
        return `<option value="${h(c.id)}"${c.id === att.id ? ' selected' : ''}>${h(c.nome)}${k ? ' — ' + k + ' da vedere' : ''}</option>`;
      }).join('')}</select></label>`;
    } else if (att && att.nome !== u.nome) {
      sel = `<div class="cli-unico">${icona(att.tipo === 'privato' ? 'casa' : 'edificio')}<span>${h(att.nome)}</span></div>`;
    }
    const nav = VOCI.map(v => {
      const k = v[4] ? n[v[4]] : 0;
      const on = v[0] === voce;
      return `<a href="${v[3]}"${on ? ' class="on" aria-current="page"' : ''}>${icona(v[2])}<span>${h(v[1])}</span>${k ? `<span class="contatore${v[4] === 'carrello' ? ' blu' : ''}" aria-label="${k} ${ETICHETTA_CONTATORE[v[4]]}">${k}</span>` : ''}</a>`;
    }).join('');
    return A.barraDemo() + `
    <header class="cli-testa"><div class="w">
      <a href="#/c/home" class="cli-marchio" aria-label="IDRAL, pagina iniziale">${A.marchio('Area clienti')}</a>
      ${sel}
      <div class="dx"><span class="cli-chi">${icona('utente')}${h(u.nome)}</span><button class="btn" type="button" data-az="cli-esci">${icona('esci')}<span>Esci</span></button></div>
    </div></header>
    <nav class="cli-nav" aria-label="Menu dell'area clienti"><div class="w">${nav}</div></nav>
    <main class="cli-corpo">${contenuto}</main>`;
  }
  /** Il menu scorre di lato sul telefono: la voce attiva deve restare in vista. */
  function centraMenu() {
    const w = A.$('.cli-nav .w'), on = A.$('.cli-nav a.on');
    if (w && on && w.scrollWidth > w.clientWidth) w.scrollLeft = on.offsetLeft - (w.clientWidth - on.offsetWidth) / 2;
  }

  /** Nel foglio del preventivo la colonna «Sconto» senza nessuno sconto e' solo rumore: si nasconde a schermo. */
  function scontoVuoto() {
    A.$$('.cli-foglio .foglio table').forEach(t => {
      const th = A.$$('thead th', t);
      if (th.length !== 6 || th[3].textContent.trim().toLowerCase() !== 'sconto') return;
      const vuota = A.$$('tbody tr', t).every(tr => { const td = tr.children; return td.length < 6 || !td[3].textContent.trim(); });
      if (vuota) t.classList.add('cli-senza-sconto');
    });
  }
  function nonTrovato() {
    return `<div class="tessera cli-nontrovato"><div class="cp">${icona('cerca')}
      <h1>Non trovato</h1>
      <p>Non troviamo quello che cerchi. Forse il link è vecchio, oppure riguarda un altro cliente.</p>
      <a class="btn pri g" href="#/c/home">${icona('casa')} Torna alla pagina iniziale</a></div></div>`;
  }
  function senzaClienti() {
    const az = A.DB.azienda;
    return `<div class="tessera cli-nontrovato"><div class="cp">${icona('info')}
      <h1>Ci siamo quasi</h1>
      <p>Il tuo accesso non è ancora collegato alla tua scheda cliente. Chiamaci e lo sistemiamo subito.</p>
      <a class="btn pri g" href="${telLink(az.telefono)}">${icona('telefono')} ${h(az.telefono)}</a></div></div>`;
  }

  /**
   * Tutte le rotte dell'area passano da qui: controllo che l'utente abbia
   * almeno un cliente, contenuto PRIMA del guscio (mio() puo' cambiare il
   * cliente attivo e la testata deve mostrarlo gia' cambiato), avvisi letti.
   */
  function rottaCliente(schema, voce, fn) {
    A.rotta(schema, 'cliente', par => {
      stile();
      if (!clienteAttivo()) return guscioVuoto();
      const out = fn(par);
      if (out === false) return false;
      let corpo = typeof out === 'string' ? out : out.html;
      if (passatoA) {
        const c = A.cliente(passatoA); passatoA = null;
        if (c) corpo = `<div class="avviso cli-cambio" role="status">${icona('info')}<div>Questo riguarda <b>${h(c.nome)}</b>: ora stai guardando questo cliente.</div></div>` + corpo;
      }
      // Chi apre la pagina a cui un avviso rimanda l'ha gia' letto: la novita'
      // sparisce da sola, senza chiedere a nessuno di «segnare come letto».
      const qui = location.hash.split('?')[0];
      segnaLetti(a => !!a.link && a.link.split('?')[0] === qui);
      return { html: guscio(voce, corpo), dopo: () => { centraMenu(); scontoVuoto(); if (out && out.dopo) out.dopo(); } };
    });
  }
  function guscioVuoto() {
    const u = A.utente();
    return A.barraDemo() + `<header class="cli-testa"><div class="w"><span class="cli-marchio">${A.marchio('Area clienti')}</span><div class="dx"><span class="cli-chi">${icona('utente')}${h(u.nome)}</span><button class="btn" type="button" data-az="cli-esci">${icona('esci')}<span>Esci</span></button></div></div></header><main class="cli-corpo">${senzaClienti()}</main>`;
  }

  // ===========================================================================
  // HOME
  // ===========================================================================
  const perData = (a, b) => ((a.data || '9999') + (a.ora || '')).localeCompare((b.data || '9999') + (b.ora || ''));
  const perDataDesc = (a, b) => ((b.data || '') + (b.ora || '')).localeCompare((a.data || '') + (a.ora || ''));

  function tessCal(iso) {
    if (!iso) return `<span class="cli-cal grigio" aria-hidden="true"><small>data</small><b>?</b><small>da fissare</small></span>`;
    const d = A.daGiorno(giorno10(iso));
    return `<span class="cli-cal" aria-hidden="true"><small>${A.MESI_BREVI[d.getMonth()]}</small><b>${d.getDate()}</b><small>${A.GIORNI_BREVI[d.getDay()]}</small></span>`;
  }
  function chiViene(i) {
    const t = nomiTecnici(i.tecnici);
    if (!t) return 'Il nome del tecnico te lo diciamo appena fissato';
    if (i.stato === 'in_viaggio') return t + (i.tecnici.length > 1 ? ' stanno arrivando' : ' sta arrivando');
    if (i.stato === 'in_corso') return t + (i.tecnici.length > 1 ? ' sono al lavoro' : ' è al lavoro');
    return 'Viene ' + t;
  }

  function paginaHome() {
    const u = A.utente(), c = clienteAttivo();
    const oraH = new Date().getHours();
    const saluto = oraH < 14 ? 'Buongiorno' : oraH < 18 ? 'Buon pomeriggio' : 'Buonasera';
    const molti = idsMiei().length > 1;
    const aperti = miei('interventi', i => APERTI.includes(i.stato)).sort(perData);
    const prossimo = aperti.find(i => i.data && i.stato !== 'da_pianificare');
    const daFissare = aperti.filter(i => !i.data || i.stato === 'da_pianificare');
    const prv = miei('preventivi', daDecidere).sort((a, b) => giorno10(a.validoFino).localeCompare(giorno10(b.validoFino)));
    const rapp = miei('interventi', rapportoPronto).sort(perDataDesc).slice(0, 3);
    const conv = miei('conversazioni', x => !x.lettoCliente).sort((a, b) => String(b.aggiornato).localeCompare(String(a.aggiornato)));
    const avvisi = avvisiDi(c.id).slice(0, 5);
    const altri = molti ? idsMiei().filter(id => id !== c.id).map(id => [A.cliente(id), daVedere(id)]).filter(x => x[1]) : [];

    // Un'azione principale: se c'e' un preventivo che aspetta una risposta e'
    // quella; altrimenti la cosa per cui il cliente apre l'area, chiedere aiuto.
    const cta = prv.length
      ? `<a class="btn acc g" href="${prv.length === 1 ? '#/c/preventivo/' + h(prv[0].id) : '#/c/preventivi'}">${icona('documento')} ${prv.length === 1 ? 'Guarda il preventivo da decidere' : 'Guarda i ' + prv.length + ' preventivi da decidere'}</a>`
      : `<a class="btn acc g" href="#/c/richiedi">${icona('piu')} Richiedi un intervento</a>`;

    const ben = `<section class="benvenuto">
      <div class="cli-ben-t">
        <h1>${saluto}, ${h(u.nome.split(' ')[0])}</h1>
        <p>${molti ? 'Stai guardando <b>' + h(c.nome) + '</b>.' : 'Qui trovi i tuoi lavori, i preventivi e i documenti di IDRAL.'}</p>
        ${altri.length ? `<div class="cli-altri"><span>Novità anche per:</span>${altri.map(([x, k]) => `<button type="button" data-az="cli-passa" data-id="${h(x.id)}">${h(x.nome)}<span class="contatore">${k}</span></button>`).join('')}</div>` : ''}
      </div>
      ${cta}
    </section>`;

    const bloccoProssimo = `<section class="tessera cli-blocco">
      <div class="tt"><h2>${icona('calendario')} Prossimo intervento</h2>${aperti.length > 1 ? '<a href="#/c/interventi">Tutti</a>' : ''}</div>
      <div class="cp">
        ${prossimo ? `<a class="cli-prossimo" href="#/c/intervento/${h(prossimo.id)}">
            ${tessCal(prossimo.data)}
            <span class="cx1"><span class="g1">${h(giornoUmano(prossimo.data))}, ${h(fascia(prossimo))}</span>
              <span class="g2">${h(A.TIPI_INTERVENTO[prossimo.tipo] || prossimo.tipo)}${prossimo.impiantoId && A.impianto(prossimo.impiantoId) ? ' · ' + h(descrMacchina(A.impianto(prossimo.impiantoId))) : ''}</span>
              <span class="g3">${h(chiViene(prossimo))}</span>
              ${prossimo.stato !== 'pianificato' ? statoInt(prossimo.stato) : ''}</span>
            ${icona('destra')}</a>`
          : A.vuoto('Nessun intervento in programma', 'Se ti serve qualcosa, chiedicelo: ti richiamiamo noi.', 'calendario')}
        ${daFissare.length ? `<p class="cli-nota">${icona('orologio')}<span>${daFissare.length === 1 ? 'C\'è 1 intervento' : 'Ci sono ' + daFissare.length + ' interventi'} in attesa di data: ti chiamiamo noi per fissarla.</span></p>` : ''}
      </div></section>`;

    const bloccoPreventivi = `<section class="tessera cli-blocco">
      <div class="tt"><h2>${icona('documento')} Preventivi da decidere</h2><a href="#/c/preventivi">Tutti</a></div>
      ${prv.length ? `<ul class="cli-righe">${prv.map(p => {
        const t = A.totaliPreventivo(p); const g = A.diffGiorni(A.oggi(), giorno10(p.validoFino));
        return `<li><a class="cli-riga" href="#/c/preventivo/${h(p.id)}"><span class="cx1"><span class="t1">${h(p.oggetto)}</span><span class="t2">${g <= 3 ? '<b style="color:var(--warn)">' + h(g === 0 ? 'Scade oggi' : 'Scade tra ' + g + (g === 1 ? ' giorno' : ' giorni')) + '</b>' : 'Valido fino al ' + A.data(p.validoFino)}</span></span>
          <span class="dxx"><span class="imp">${A.euro(t.totale)}</span><small>IVA compresa</small></span>${icona('destra')}</a></li>`;
      }).join('')}</ul>` : `<div class="cp">${A.vuoto('Nessun preventivo da decidere', 'Quando ti mandiamo un preventivo, lo trovi qui e ti avvisiamo per email.', 'documento')}</div>`}
    </section>`;

    const bloccoRapportini = `<section class="tessera cli-blocco">
      <div class="tt"><h2>${icona('verifica')} Ultimi rapportini</h2><a href="#/c/documenti">Tutti</a></div>
      ${rapp.length ? `<ul class="cli-righe">${rapp.map(i => `<li><a class="cli-riga" href="#/c/intervento/${h(i.id)}"><span class="cli-ico ok">${icona('verifica')}</span><span class="cx1"><span class="t1">${h(A.TIPI_INTERVENTO[i.tipo] || i.tipo)}</span><span class="t2">${A.data(i.data)}${i.impiantoId && A.impianto(i.impiantoId) ? ' · ' + h(descrMacchina(A.impianto(i.impiantoId))) : ''}</span></span>${icona('destra')}</a></li>`).join('')}</ul>`
        : `<div class="cp">${A.vuoto('Ancora nessun rapportino', 'Qui trovi il resoconto di ogni lavoro, appena l\'ufficio l\'ha controllato.', 'verifica')}</div>`}
    </section>`;

    const bloccoMessaggi = `<section class="tessera cli-blocco">
      <div class="tt"><h2>${icona('messaggio')} Messaggi da leggere</h2><a href="#/c/messaggi">Tutti</a></div>
      ${conv.length ? `<ul class="cli-righe">${conv.slice(0, 3).map(x => { const ult = x.messaggi[x.messaggi.length - 1] || {}; return `<li><a class="cli-riga nuovo" href="#/c/messaggi/${h(x.id)}"><span class="cx1"><span class="t1">${h(x.oggetto)}</span><span class="t2">${h(taglia(ult.testo, 80))}</span></span>${icona('destra')}</a></li>`; }).join('')}</ul>`
        : `<div class="cp">${A.vuoto('Nessun messaggio da leggere', 'Hai una domanda? Scrivici: ti rispondiamo qui.', 'messaggio')}<div class="cli-vuoto-link"><a class="btn pic" href="#/c/messaggi?nuovo=1">${icona('penna')} Scrivici</a></div></div>`}
    </section>`;

    const ICONA_AVV = { rapportino: 'verifica', preventivo: 'documento', messaggio: 'messaggio', ordine: 'carrello', richiesta: 'arrivo', assegnazione: 'calendario', nota: 'messaggio', materiale: 'pacco' };
    const bloccoNovita = `<section class="tessera cli-blocco">
      <div class="tt"><h2>${icona('campanella')} Novità</h2></div>
      ${avvisi.length ? `<ul class="cli-righe">${avvisi.map(a => `<li><button type="button" class="cli-riga ${a.letto ? 'letto' : 'nuovo'}" data-az="cli-avviso" data-id="${h(a.id)}"><span class="cx1"><span class="t1">${h(a.testo)}</span><span class="t2">${h(A.quando(a.data))}</span></span>${icona('destra')}</button></li>`).join('')}</ul>`
        : `<div class="cp">${A.vuoto('Nessuna novità', 'Quando c\'è qualcosa di nuovo per te te lo diciamo qui.', 'campanella')}</div>`}
    </section>`;

    const azioni = `<section class="griglia g4 cli-home-az" aria-label="Azioni rapide">
      <a class="azione-card" href="#/c/richiedi"><span class="ic2 acc">${icona('telefono', 'g')}</span><div><b>Richiedi un intervento</b><span>Un guasto, una manutenzione, un sopralluogo</span></div></a>
      <a class="azione-card" href="#/c/ordina"><span class="ic2">${icona('carrello', 'g')}</span><div><b>Ordina materiale</b><span>Sale, filtri, ricambi: li prepariamo noi</span></div></a>
      <a class="azione-card" href="#/c/messaggi?nuovo=1"><span class="ic2">${icona('messaggio', 'g')}</span><div><b>Scrivici</b><span>Ti rispondiamo qui e per email</span></div></a>
      <a class="azione-card" href="#/c/documenti"><span class="ic2">${icona('graffetta', 'g')}</span><div><b>I miei documenti</b><span>Fatture, libretti, rapportini</span></div></a>
    </section>`;

    // Ordine: prima cosa succede (appuntamento, decisioni), poi cosa posso
    // fare, poi l'archivio. Chi ha fretta si ferma alla prima riga di schede.
    return ben + `<div class="griglia g2">${bloccoProssimo}${bloccoPreventivi}</div>` + azioni + `<div class="griglia g3">${bloccoRapportini}${bloccoMessaggi}${bloccoNovita}</div>`;
  }

  // ===========================================================================
  // PREVENTIVI
  // ===========================================================================
  function validita(p) {
    if (!p.validoFino) return { testo: 'Senza scadenza', warn: false };
    const g = A.diffGiorni(A.oggi(), giorno10(p.validoFino));
    if (g < 0) return { testo: 'Scaduto il ' + A.data(p.validoFino), warn: true };
    if (g === 0) return { testo: 'Scade oggi', warn: true };
    if (g <= 3) return { testo: 'Scade tra ' + g + (g === 1 ? ' giorno' : ' giorni') + ' (' + A.data(p.validoFino) + ')', warn: true };
    return { testo: 'Valido fino al ' + A.data(p.validoFino), warn: false };
  }

  function paginaPreventivi() {
    const tutti = miei('preventivi', prvVisibile);
    const aperti = tutti.filter(daDecidere).sort((a, b) => giorno10(a.validoFino).localeCompare(giorno10(b.validoFino)));
    const scad = tutti.filter(scaduto).sort((a, b) => String(b.creato).localeCompare(String(a.creato)));
    const decisi = tutti.filter(p => !daDecidere(p) && !scaduto(p)).sort((a, b) => String(b.decisoIl || b.creato).localeCompare(String(a.decisoIl || a.creato)));
    const carta = p => {
      const t = A.totaliPreventivo(p); const v = validita(p);
      return `<a class="tessera cli-carta-prv" href="#/c/preventivo/${h(p.id)}">
        <span class="cli-etich">Preventivo N. ${h(p.numero)} · del ${A.data(p.creato)}</span>
        <h3>${h(p.oggetto)}</h3>
        <span class="cli-importo">${A.euro(t.totale)}</span><small>IVA compresa${t.opzionali ? ' · più voci facoltative da scegliere' : ''}</small>
        <span class="cli-validita${v.warn ? ' warn' : ''}">${icona('orologio')} ${h(v.testo)}</span>
        <span class="btn acc">${icona('occhio')} Apri e decidi</span></a>`;
    };
    const riga = p => {
      const t = A.totaliPreventivo(p);
      const quando = p.decisione && p.decisione.data ? (p.decisione.esito === 'accettato' ? 'Accettato il ' : 'Rifiutato il ') + A.data(p.decisione.data) : scaduto(p) ? 'Scaduto il ' + A.data(p.validoFino) : 'Del ' + A.data(p.creato);
      return `<li><a class="cli-riga" href="#/c/preventivo/${h(p.id)}"><span class="cx1"><span class="t1">${h(p.oggetto)}</span><span class="t2">N. ${h(p.numero)} · ${h(quando)}</span></span>
        <span class="dxx"><span class="imp">${A.euro(t.totale)}</span>${statoPrv(p)}</span>${icona('destra')}</a></li>`;
    };
    return `<h1>I tuoi preventivi</h1>
      <p class="sotto">Qui trovi i preventivi che ti abbiamo mandato. Li puoi leggere, accettare o rifiutare da qui, senza carta.</p>
      <h2 class="cli-sez">Da decidere ${aperti.length ? '<span class="contatore">' + aperti.length + '</span>' : ''}</h2>
      ${aperti.length ? `<div class="griglia g2">${aperti.map(carta).join('')}</div>` : `<div class="tessera">${A.vuoto('Nessun preventivo da decidere', 'Quando ti mandiamo un preventivo nuovo lo trovi qui, e ti avvisiamo per email.', 'documento')}</div>`}
      ${scad.length ? `<h2 class="cli-sez">Scaduti <span class="muto">— puoi chiederci di rinnovarli</span></h2><div class="tessera"><ul class="cli-righe">${scad.map(riga).join('')}</ul></div>` : ''}
      <h2 class="cli-sez">Già decisi</h2>
      ${decisi.length ? `<div class="tessera"><ul class="cli-righe">${decisi.map(riga).join('')}</ul></div>` : `<div class="tessera">${A.vuoto('Ancora nessun preventivo deciso', 'I preventivi che accetti o rifiuti restano qui, con la ricevuta.', 'arrivo')}</div>`}`;
  }

  /** Prima apertura di un preventivo inviato: l'ufficio sa che il cliente l'ha visto (e quando). */
  function segnaVisto(p) {
    if (p.stato !== 'inviato') return;
    const u = A.utente(); const c = A.cliente(p.clienteId);
    A.modifica(db => {
      const x = db.preventivi.find(y => y.id === p.id);
      if (!x || x.stato !== 'inviato') return;
      const ora = A.adesso();
      x.stato = 'visto'; x.vistoIl = ora;
      x.eventi = x.eventi || [];
      x.eventi.unshift({ tipo: 'aperto', data: ora, chi: u.nome });
      A.avvisa('ufficio', u.nome + ' ha aperto il preventivo ' + x.numero + ' (' + c.nome + ')', '#/u/preventivo/' + x.id, { tipo: 'preventivo' });
      A.registra('preventivo aperto dal cliente', x.numero + ' — ' + c.nome);
    });
  }

  function ricevuta(p) {
    const d = p.decisione || {}; const t = A.totaliPreventivo(p);
    const aggiunte = (p.righe || []).filter(r => r.opzionale && r.scelta);
    const intv = p.interventoId ? A.intervento(p.interventoId) : null;
    return `<div class="tessera cli-ricevuta"><div class="cp">
      <div class="cli-ric-testa">${icona('spunta')}<div><b>Preventivo accettato</b><span>${p.stato === 'convertito' ? 'Il lavoro è in programma.' : 'Grazie! Ti chiamiamo per fissare la data dei lavori.'}</span></div></div>
      <dl class="dl">
        <dt>Accettato da</dt><dd>${h(d.nome || '—')}</dd>
        <dt>Quando</dt><dd>${d.data ? A.data(d.data) + ' alle ' + A.ora(d.data) : '—'}</dd>
        ${d.ua ? `<dt>Da</dt><dd>${h(d.ua)}</dd>` : ''}
        <dt>Totale</dt><dd>${A.euro(t.totale)} IVA compresa</dd>
        ${aggiunte.length ? `<dt>Con</dt><dd>${aggiunte.map(r => h(r.descrizione)).join('<br>')}</dd>` : ''}
      </dl>
      ${d.hash ? `<div class="cli-impronta"><small><b>Impronta del documento</b> (SHA-256)</small><code>${h(d.hash)}</code><small>È il «sigillo» del preventivo che hai accettato: se qualcuno cambiasse anche una virgola, l'impronta non corrisponderebbe più.</small></div>` : ''}
      ${intv && intv.clienteId === p.clienteId ? `<a class="btn largo" style="margin-top:14px" href="#/c/intervento/${h(intv.id)}">${icona('calendario')} Vedi l'intervento</a>` : ''}
    </div></div>`;
  }

  function paginaPreventivo(par) {
    const p0 = mio(A.preventivo(par.id));
    if (!prvVisibile(p0)) return nonTrovato();
    segnaVisto(p0);
    const p = A.preventivo(p0.id);
    const t = A.totaliPreventivo(p);
    const opz = (p.righe || []).filter(r => r.opzionale);
    const az = A.DB.azienda;
    let lato;
    if (daDecidere(p)) {
      const v = validita(p);
      lato = `<div class="tessera cli-decidi"><div class="cp">
        <div class="cli-etich">Totale, IVA compresa</div>
        <div class="cli-importo">${A.euro(t.totale)}</div>
        <div class="pic">Imponibile ${A.euro(t.imponibile)} + IVA ${A.euro(t.iva)}</div>
        ${opz.length ? `<div class="avviso" style="margin-top:12px">${icona('info')}<div>${opz.length === 1 ? 'C\'è una voce facoltativa' : 'Ci sono ' + opz.length + ' voci facoltative'} (${A.euro(t.opzionali)} + IVA): ${opz.length === 1 ? 'la puoi aggiungere' : 'le puoi aggiungere'} quando accetti.</div></div>` : ''}
        <p class="cli-validita${v.warn ? ' warn' : ''}">${icona('orologio')} ${h(v.testo)}</p>
        <button class="btn acc xl" type="button" data-az="cli-accetta" data-id="${h(p.id)}">${icona('spunta')} Accetta il preventivo</button>
        <div class="cli-sec">
          <button class="btn" type="button" data-az="cli-prv-modifica" data-id="${h(p.id)}">${icona('messaggio')} Chiedi una modifica</button>
          <button class="btn per" type="button" data-az="cli-rifiuta" data-id="${h(p.id)}">Rifiuta</button>
        </div>
      </div></div>`;
    } else if (scaduto(p)) {
      lato = `<div class="tessera"><div class="cp">
        <div class="avviso warn">${icona('orologio')}<div><b>Questo preventivo è scaduto il ${A.data(p.validoFino)}.</b><br>I prezzi potrebbero essere cambiati: chiedici di rinnovarlo e te lo rimandiamo aggiornato.</div></div>
        <button class="btn acc xl" type="button" style="margin-top:16px" data-az="cli-prv-rinnovo" data-id="${h(p.id)}">${icona('ricarica')} Chiedi di rinnovarlo</button>
      </div></div>`;
    } else if (p.decisione && p.decisione.esito === 'rifiutato') {
      lato = `<div class="tessera cli-ricevuta no"><div class="cp">
        <div class="cli-ric-testa">${icona('x')}<div><b>Preventivo rifiutato</b><span>il ${A.data(p.decisione.data)} alle ${A.ora(p.decisione.data)}</span></div></div>
        ${p.decisione.motivo ? `<p class="cli-grande" style="font-size:16px">Motivo: ${h(p.decisione.motivo)}</p>` : ''}
        <button class="btn largo" type="button" style="margin-top:14px" data-az="cli-prv-modifica" data-id="${h(p.id)}">${icona('messaggio')} Hai cambiato idea? Scrivici</button>
      </div></div>`;
    } else if (p.stato === 'accettato' || p.stato === 'convertito') {
      lato = ricevuta(p);
    } else {
      lato = `<div class="tessera"><div class="cp">${statoPrv(p)}</div></div>`;
    }
    lato += `<div class="tessera"><div class="cp">
      <a class="btn largo" href="#/c/stampa/preventivo/${h(p.id)}">${icona('stampa')} Stampa o salva PDF</a>
      <p class="pic" style="margin-top:10px">Domande? Chiamaci al <a href="${telLink(az.telefono)}">${h(az.telefono)}</a>.</p>
    </div></div>`;
    return `<a class="cli-indietro" href="#/c/preventivi">${icona('indietro')} Tutti i preventivi</a>
      <div class="cli-testa-pag"><div><h1>${h(p.oggetto)}</h1><p class="sotto">Preventivo N. ${h(p.numero)}${p.versione > 1 ? ' — revisione ' + h(p.versione) : ''} · del ${A.data(p.creato)}</p></div>${statoPrv(p)}</div>
      <div class="cli-prv"><div class="cli-lato">${lato}</div><div class="cli-foglio">${A.foglioPreventivo(p)}</div></div>`;
  }

  function paginaStampaPreventivo(par) {
    const p = mio(A.preventivo(par.id));
    if (!prvVisibile(p)) return nonTrovato();
    segnaVisto(p);
    return `<div class="cli-foglio">${A.paginaStampa(A.foglioPreventivo(A.preventivo(p.id)), '#/c/preventivo/' + p.id)}</div>`;
  }

  // ---- accettazione con prova (§10.3): due passaggi, poi impronta del documento
  let accInCorso = null;
  function aggiornaTotaleLive(root, pid) {
    const p = A.preventivo(pid); if (!p || !root) return;
    const scelte = A.$$('input[name=opz]', root).filter(x => x.checked).map(x => x.value);
    const { t } = totaliCon(p, scelte);
    const b = A.$('#cli-tot-live', root), s = A.$('#cli-tot-dett', root);
    if (b) b.textContent = A.euro(t.totale);
    if (s) s.textContent = 'Imponibile ' + A.euro(t.imponibile) + ' + IVA ' + A.euro(t.iva);
  }
  function apriAccetta(pid, stato) {
    const p = mio(A.preventivo(pid));
    if (!p || !daDecidere(p)) { A.toast('Questo preventivo non si può più accettare', 'per'); A.render(); return; }
    const u = A.utente();
    const scelte = stato ? stato.scelte : p.righe.filter(r => r.opzionale && r.scelta).map(r => r.id);
    const opz = p.righe.filter(r => r.opzionale);
    A.modale({
      titolo: 'Accetta il preventivo', form: 'cli-accetta-1', nofocus: true,
      corpo: `<input type="hidden" name="pid" value="${h(p.id)}">
        <p class="cli-passo">Passo 1 di 2</p>
        <p class="cli-grande">Preventivo <b>N. ${h(p.numero)}</b><br>${h(p.oggetto)}</p>
        ${opz.length ? `<fieldset class="cli-opz"><legend>${opz.length === 1 ? 'Vuoi aggiungere la voce facoltativa?' : 'Vuoi aggiungere qualcuna delle voci facoltative?'}</legend>
          ${opz.map(r => `<label class="cli-opz-riga"><input type="checkbox" name="opz" value="${h(r.id)}" data-cambia="cli-opz-cambia"${scelte.includes(r.id) ? ' checked' : ''}><span><b>${h(r.descrizione)}</b><small>${A.euro(importoRiga(r))} + IVA</small></span></label>`).join('')}</fieldset>` : ''}
        <div class="cli-totale-live" aria-live="polite"><span>Totale da pagare, IVA compresa</span><b id="cli-tot-live">—</b><small id="cli-tot-dett"></small></div>
        <div class="campo"><label for="cli-acc-nome">Nome e cognome di chi accetta</label><input id="cli-acc-nome" type="text" name="nome" value="${h(stato ? stato.nome : u.nome)}" autocomplete="name"></div>
        <label class="spunta cli-spunta-g"><input type="checkbox" name="letto"${stato && stato.letto ? ' checked' : ''}><span>Ho letto il preventivo e le condizioni e lo accetto</span></label>
        <div id="cli-acc-err" aria-live="polite"></div>`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: 'Continua', classe: 'acc', tipo: 'submit', icona: 'avanti' }],
      dopo: v => aggiornaTotaleLive(v, p.id)
    });
  }
  A.azione('cli-accetta', el => apriAccetta(el.dataset.id));
  A.azione('cli-opz-cambia', el => { const f = el.closest('form'); const pid = f && f.querySelector('input[name=pid]'); if (pid) aggiornaTotaleLive(f, pid.value); });
  A.azione('cli-accetta-1', (form, ev, d) => {
    const scelte = A.$$('input[name=opz]', form).filter(x => x.checked).map(x => x.value);
    const nome = String(d.nome || '').trim().replace(/\s+/g, ' ');
    if (nome.length < 3) return erroreIn('#cli-acc-err', 'Scrivi nome e cognome di chi accetta.');
    if (!d.letto) return erroreIn('#cli-acc-err', 'Per andare avanti spunta la casella «Ho letto il preventivo e le condizioni e lo accetto».');
    accInCorso = { pid: d.pid, scelte, nome, letto: true };
    apriConfermaFinale();
  });
  function apriConfermaFinale() {
    const s = accInCorso; const p = s && mio(A.preventivo(s.pid));
    if (!p || !daDecidere(p)) { A.chiudiModale(); return; }
    const { t } = totaliCon(p, s.scelte); const c = A.cliente(p.clienteId);
    const opz = p.righe.filter(r => r.opzionale);
    const aggiunte = opz.filter(r => s.scelte.includes(r.id));
    A.modale({
      titolo: 'Confermi?',
      corpo: `<p class="cli-passo">Passo 2 di 2 · ultimo</p>
        <p class="cli-grande">Stai accettando il preventivo <b>N. ${h(p.numero)}</b>.</p>
        <dl class="dl cli-riep">
          <dt>Lavoro</dt><dd>${h(p.oggetto)}</dd>
          <dt>Per</dt><dd>${h(c.nome)}</dd>
          ${opz.length ? `<dt>Facoltative</dt><dd>${aggiunte.length ? aggiunte.map(r => h(r.descrizione)).join('<br>') : 'nessuna aggiunta'}</dd>` : ''}
          <dt>Totale</dt><dd><b style="font-size:19px">${A.euro(t.totale)}</b> IVA compresa</dd>
          <dt>Accetta</dt><dd>${h(s.nome)}</dd>
        </dl>
        <div class="avviso">${icona('scudo')}<div>Quando confermi registriamo il nome, la data e l'ora, e un'impronta del documento: è la prova che hai accettato proprio questo preventivo. Ricevi subito una conferma per email.</div></div>`,
      azioni: [{ testo: 'Indietro', az: 'cli-accetta-indietro', icona: 'indietro' }, { testo: 'Sì, accetto il preventivo', classe: 'ok', az: 'cli-accetta-conferma', icona: 'spunta' }]
    });
  }
  A.azione('cli-accetta-indietro', () => { if (accInCorso) apriAccetta(accInCorso.pid, accInCorso); });
  A.azione('cli-accetta-conferma', async el => {
    const s = accInCorso; if (!s) return;
    const p = mio(A.preventivo(s.pid));
    if (!p || !daDecidere(p)) { A.chiudiModale(); A.toast('Questo preventivo non si può più accettare', 'per'); A.render(); return; }
    el.disabled = true;
    const u = A.utente(); const c = A.cliente(p.clienteId);
    // L'impronta si calcola sul documento COME LO VEDE il cliente, con le sue
    // scelte: numero, versione, voci, totali, condizioni. Se domani qualcuno
    // cambiasse una riga, l'impronta ricalcolata non tornerebbe piu'.
    const { copia, t } = totaliCon(p, s.scelte);
    const hash = await A.impronta(JSON.stringify({ numero: copia.numero, versione: copia.versione, righe: copia.righe, totali: t, condizioni: copia.condizioni }));
    const ora = A.adesso(); const ua = browserInParole();
    const quando = A.data(ora) + ' alle ' + A.ora(ora);
    A.modifica(db => {
      const x = db.preventivi.find(y => y.id === p.id);
      x.righe.forEach(r => { if (r.opzionale) r.scelta = s.scelte.includes(r.id); });
      x.decisione = { esito: 'accettato', nome: s.nome, data: ora, ua, hash };
      x.stato = 'accettato'; x.decisoIl = ora;
      x.eventi = x.eventi || [];
      x.eventi.unshift({ tipo: 'accettato', data: ora, chi: s.nome });
      A.avvisa('ufficio', c.nome + ': ' + s.nome + ' ha accettato il preventivo ' + x.numero + ' (' + A.euro(t.totale) + ')', '#/u/preventivo/' + x.id, { tipo: 'preventivo' });
      // Conferma a entrambe le parti: al cliente (e' la sua copia della prova) e all'azienda.
      const corpo = 'Preventivo N. ' + x.numero + ' — ' + x.oggetto + '\nCliente: ' + c.nome + '\nAccettato da: ' + s.nome + ' il ' + quando + ' (' + ua + ')\nTotale: ' + A.euro(t.totale) + ' IVA compresa\nImpronta del documento (SHA-256): ' + hash;
      db.email.unshift({ id: A.uid('eml'), data: ora, a: u.email || c.email, oggetto: 'IDRAL — hai accettato il preventivo ' + x.numero, testo: 'Gentile ' + s.nome + ', le confermiamo l\'accettazione del preventivo. La ricevuta resta nell\'area clienti.\n\n' + corpo });
      db.email.unshift({ id: A.uid('eml'), data: ora, a: db.azienda.email, oggetto: 'Preventivo ' + x.numero + ' accettato da ' + c.nome, testo: corpo });
      A.registra('preventivo accettato dal cliente', x.numero + ' — ' + c.nome + ' — ' + s.nome);
    });
    accInCorso = null;
    A.chiudiModale();
    A.render();
    A.modale({ titolo: 'Fatto!', corpo: ricevuta(A.preventivo(p.id)), azioni: [{ testo: 'Chiudi', classe: 'pri', chiudi: true }] });
  });

  // ---- rifiuto: il motivo e' facoltativo, ma proposto (all'ufficio serve saperlo)
  const MOTIVI = ['Costa troppo', 'Ho scelto un\'altra ditta', 'Rimandiamo i lavori', 'Non serve più', 'Altro'];
  A.azione('cli-rifiuta', el => {
    const p = mio(A.preventivo(el.dataset.id)); if (!p || !daDecidere(p)) return;
    A.modale({
      titolo: 'Rifiuta il preventivo', form: 'cli-rifiuta-invia', nofocus: true,
      corpo: `<input type="hidden" name="pid" value="${h(p.id)}">
        <p class="cli-grande">Ci dispiace. Ci dici perché? <span class="muto">(facoltativo)</span></p>
        <div class="scelte cli-motivi">${MOTIVI.map(m => `<label class="scelta"><input type="radio" name="motivo" value="${h(m)}"><span>${h(m)}</span></label>`).join('')}</div>
        <div class="campo" style="margin-top:16px"><label for="cli-rif-det">Vuoi aggiungere qualcosa? <span class="muto">(facoltativo)</span></label><textarea id="cli-rif-det" name="dettaglio" rows="3"></textarea></div>
        <div class="avviso">${icona('info')}<div>Se vuoi cambiare qualcosa, invece di rifiutarlo puoi <a href="#" data-az="cli-prv-modifica" data-id="${h(p.id)}">chiederci una modifica</a>.</div></div>`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: 'Rifiuta il preventivo', classe: 'per', tipo: 'submit' }]
    });
  });
  A.azione('cli-rifiuta-invia', (f, ev, d) => {
    const p = mio(A.preventivo(d.pid)); if (!p || !daDecidere(p)) { A.chiudiModale(); return; }
    const u = A.utente(); const c = A.cliente(p.clienteId);
    const motivo = [d.motivo, String(d.dettaglio || '').trim()].filter(Boolean).join(' — ');
    const ora = A.adesso();
    A.modifica(db => {
      const x = db.preventivi.find(y => y.id === p.id);
      x.decisione = { esito: 'rifiutato', nome: u.nome, data: ora, ua: browserInParole(), motivo };
      x.stato = 'rifiutato'; x.decisoIl = ora;
      x.eventi = x.eventi || [];
      x.eventi.unshift({ tipo: 'rifiutato', data: ora, chi: u.nome });
      A.avvisa('ufficio', c.nome + ' ha rifiutato il preventivo ' + x.numero + (motivo ? ': ' + taglia(motivo, 80) : ''), '#/u/preventivo/' + x.id, { tipo: 'preventivo' });
      A.registra('preventivo rifiutato dal cliente', x.numero + ' — ' + c.nome);
    });
    A.chiudiModale(); A.toast('Abbiamo registrato la tua risposta. Grazie!', 'ok'); A.render();
  });

  // ---- chiedi una modifica / chiedi di rinnovarlo: un messaggio nella conversazione del preventivo
  function apriScriviPreventivo(pid, rinnovo) {
    const p = mio(A.preventivo(pid)); if (!prvVisibile(p)) return;
    const testo = rinnovo ? 'Buongiorno, il preventivo N. ' + p.numero + ' («' + p.oggetto + '») è scaduto il ' + A.data(p.validoFino) + '. Potete rinnovarlo? Grazie.' : '';
    A.modale({
      titolo: rinnovo ? 'Chiedi di rinnovarlo' : 'Chiedi una modifica', form: 'cli-prv-scrivi',
      corpo: `<input type="hidden" name="pid" value="${h(p.id)}"><input type="hidden" name="rinnovo" value="${rinnovo ? '1' : ''}">
        <p style="margin-bottom:14px">${rinnovo ? 'Mandiamo questo messaggio all\'ufficio: puoi cambiarlo come vuoi.' : 'Scrivici cosa vorresti cambiare: ti rispondiamo nei messaggi e, se serve, ti mandiamo un preventivo aggiornato.'}</p>
        <div class="campo"><label for="cli-prv-testo">Il tuo messaggio</label><textarea id="cli-prv-testo" name="testo" rows="5" placeholder="${rinnovo ? '' : 'Per esempio: vorrei togliere una voce, oppure fare il lavoro a novembre.'}">${h(testo)}</textarea></div>
        <div id="cli-prv-err"></div>`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: 'Invia il messaggio', classe: 'acc', tipo: 'submit', icona: 'invia' }]
    });
  }
  A.azione('cli-prv-modifica', el => apriScriviPreventivo(el.dataset.id, false));
  A.azione('cli-prv-rinnovo', el => apriScriviPreventivo(el.dataset.id, true));
  A.azione('cli-prv-scrivi', (f, ev, d) => {
    const p = mio(A.preventivo(d.pid)); if (!prvVisibile(p)) return A.chiudiModale();
    const testo = String(d.testo || '').trim();
    if (testo.length < 2) return erroreIn('#cli-prv-err', 'Scrivi il tuo messaggio.');
    const id = scriviAllAzienda({ clienteId: p.clienteId, contesto: { tipo: 'preventivo', id: p.id }, oggetto: (d.rinnovo ? 'Rinnovo del preventivo N. ' : 'Preventivo N. ') + p.numero + ' — ' + p.oggetto, testo });
    A.chiudiModale(); A.toast('Messaggio inviato all\'ufficio', 'ok'); A.vai('#/c/messaggi/' + id);
  });

  // ===========================================================================
  // INTERVENTI
  // ===========================================================================
  function cartaIntervento(i) {
    const m = i.impiantoId ? A.impianto(i.impiantoId) : null;
    const fissato = i.data && i.stato !== 'da_pianificare';
    return `<a class="tessera cli-int" href="#/c/intervento/${h(i.id)}">
      ${tessCal(fissato ? i.data : null)}
      <span class="cx1">
        <span class="g1">${fissato ? h(giornoUmano(i.data)) + '<span class="muto">, ' + h(fascia(i)) + '</span>' : 'Data da fissare'}</span>
        <span class="g2">${h(A.TIPI_INTERVENTO[i.tipo] || i.tipo)}${m ? ' · ' + h(descrMacchina(m)) : ''}</span>
        <span class="g3">${fissato ? h(chiViene(i)) : 'Ti chiamiamo noi per fissare giorno e ora'}</span>
        ${statoInt(i.stato)}
      </span>${icona('destra')}</a>`;
  }
  function rigaStorico(i) {
    const m = i.impiantoId ? A.impianto(i.impiantoId) : null;
    const pill = i.stato === 'annullato' ? A.pastiglia('Annullato', 'grigio') : rapportoPronto(i) ? A.pastiglia('Rapportino pronto', 'ok') : A.pastiglia('In controllo', 'blu');
    return `<li><a class="cli-riga" href="#/c/intervento/${h(i.id)}"><span class="cli-ico${rapportoPronto(i) ? ' ok' : ''}">${icona(rapportoPronto(i) ? 'verifica' : 'chiave')}</span>
      <span class="cx1"><span class="t1">${h(A.TIPI_INTERVENTO[i.tipo] || i.tipo)} — ${A.data(i.data)}</span><span class="t2">${m ? h(descrMacchina(m)) : h(taglia(i.richiesta, 70))}</span></span>
      <span class="dxx">${pill}</span>${icona('destra')}</a></li>`;
  }

  function paginaInterventi(par) {
    const c = clienteAttivo();
    const sedi = A.sediDi(c.id), imps = A.impiantiDi(c.id);
    const fSede = sedi.some(s => s.id === par.q.sede) ? par.q.sede : '';
    const fImp = imps.some(m => m.id === par.q.impianto) ? par.q.impianto : '';
    const filtra = i => (!fSede || i.sedeId === fSede) && (!fImp || i.impiantoId === fImp);
    const tutti = miei('interventi', filtra);
    const aperti = tutti.filter(i => APERTI.includes(i.stato)).sort(perData);
    const chiusi = tutti.filter(i => CHIUSI.includes(i.stato) || i.stato === 'annullato').sort(perDataDesc);
    const quanti = par.q.tutti ? chiusi.length : 15;
    const filtri = (sedi.length > 1 || imps.length > 1) ? `<div class="cli-filtri">
      ${sedi.length > 1 ? `<div class="campo"><label for="cli-f-sede">Dove</label><select id="cli-f-sede" data-cambia="cli-filtro-int"><option value="">Tutte le sedi</option>${sedi.map(s => `<option value="${h(s.id)}"${s.id === fSede ? ' selected' : ''}>${h(A.indirizzo(s))}</option>`).join('')}</select></div>` : ''}
      ${imps.length > 1 ? `<div class="campo"><label for="cli-f-imp">Macchina</label><select id="cli-f-imp" data-cambia="cli-filtro-int"><option value="">Tutte le macchine</option>${imps.map(m => `<option value="${h(m.id)}"${m.id === fImp ? ' selected' : ''}>${h(descrMacchina(m))}</option>`).join('')}</select></div>` : ''}
      ${fSede || fImp ? '<a class="btn vuoto" href="#/c/interventi">' + icona('x') + ' Togli il filtro</a>' : ''}
    </div>` : '';
    return `<div class="cli-testa-pag"><div><h1>I tuoi interventi</h1><p class="sotto">Gli appuntamenti in programma e tutti i lavori fatti, con il loro rapportino.</p></div>
        <a class="btn acc" href="#/c/richiedi">${icona('piu')} Richiedi un intervento</a></div>
      ${filtri}
      <h2 class="cli-sez">In programma</h2>
      ${aperti.length ? `<div class="cli-lista-t">${aperti.map(cartaIntervento).join('')}</div>` : `<div class="tessera">${A.vuoto('Nessun intervento in programma', fSede || fImp ? 'Con questo filtro non c\'è niente in programma.' : 'Quando fissiamo un appuntamento lo trovi qui, con il giorno, l\'ora e il nome del tecnico.', 'calendario')}</div>`}
      <h2 class="cli-sez">Già fatti ${chiusi.length ? '<span class="muto">— ' + chiusi.length + '</span>' : ''}</h2>
      ${chiusi.length ? `<div class="tessera"><ul class="cli-righe">${chiusi.slice(0, quanti).map(rigaStorico).join('')}</ul></div>
        ${chiusi.length > quanti ? `<p style="text-align:center;margin-top:14px"><a class="btn" href="#/c/interventi?${new URLSearchParams(Object.assign({}, fSede ? { sede: fSede } : {}, fImp ? { impianto: fImp } : {}, { tutti: 1 })).toString()}">Mostra tutti (${chiusi.length})</a></p>` : ''}`
        : `<div class="tessera">${A.vuoto('Ancora nessun lavoro', 'Qui troverai lo storico dei lavori fatti, dal più recente.', 'storico')}</div>`}`;
  }
  A.azione('cli-filtro-int', () => {
    const s = A.$('#cli-f-sede'), m = A.$('#cli-f-imp');
    const q = new URLSearchParams();
    if (s && s.value) q.set('sede', s.value);
    if (m && m.value) q.set('impianto', m.value);
    A.vai('#/c/interventi' + (q.toString() ? '?' + q : ''));
  });

  function paginaIntervento(par) {
    const i = mio(A.intervento(par.id));
    if (!i) return nonTrovato();
    const s = A.sede(i.sedeId), m = i.impiantoId ? A.impianto(i.impiantoId) : null;
    const r = i.rapporto || {};
    const pronto = rapportoPronto(i);
    const futuro = APERTI.includes(i.stato);
    const fissato = futuro && i.data && i.stato !== 'da_pianificare';
    const az = A.DB.azienda;
    const tec = nomiTecnici(i.tecnici);
    // Le foto passano da QUESTO filtro e da nessun altro: nascono non visibili
    // e le rende visibili l'ufficio, una per una (la caldaia e' in salotto).
    const foto = pronto ? (r.foto || []).filter(f => f.visibileCliente === true) : [];

    let principale = `<section class="tessera"><div class="tt"><h2>${icona('chiave')} Il lavoro</h2></div><div class="cp"><dl class="dl">
      <dt>Quando</dt><dd>${i.data && i.stato !== 'da_pianificare' ? h(maiuscola(A.dataLunga(i.data))) + ' ' + new Date(A.daGiorno(i.data)).getFullYear() : 'Da fissare: ti chiamiamo noi'}</dd>
      ${fissato ? `<dt>Arrivo previsto</dt><dd>${h(fascia(i))}</dd>` : ''}
      <dt>Tecnico</dt><dd>${tec ? h(tec) : 'Te lo diciamo appena fissato'}</dd>
      ${s ? `<dt>Dove</dt><dd>${h(A.indirizzo(s))}</dd>` : ''}
      ${m ? `<dt>Macchina</dt><dd>${h(descrMacchina(m))}${m.matricola ? '<br><span class="pic">matricola <span class="mono">' + h(m.matricola) + '</span></span>' : ''}</dd>` : ''}
      ${i.richiesta ? `<dt>Cosa ci hai chiesto</dt><dd style="font-weight:500">${h(i.richiesta)}</dd>` : ''}
      ${i.noteCliente ? `<dt>Nota per te</dt><dd style="font-weight:500">${h(i.noteCliente)}</dd>` : ''}
    </dl></div></section>`;

    if (pronto) {
      principale += `<section class="tessera"><div class="tt"><h2>${icona('verifica')} Cosa abbiamo fatto</h2>${A.pastiglia(A.ESITI[r.esito] || 'Fatto', r.esito === 'risolto' ? 'ok' : 'warn')}</div><div class="cp cli-testo">
        ${r.lavoro ? `<h3>Il lavoro</h3><p>${h(r.lavoro)}</p>` : ''}
        ${r.trovato && r.trovato !== '—' ? `<h3>Cosa abbiamo trovato</h3><p>${h(r.trovato)}</p>` : ''}
        ${r.consiglio && r.consiglio !== 'Nessuna.' ? `<h3>Cosa ti consigliamo</h3><p>${h(r.consiglio)}</p>` : ''}
        ${r.secondoIntervento ? `<div class="avviso warn" style="margin-top:14px">${icona('info')}<div>Serve un secondo intervento: ti chiamiamo per fissarlo.</div></div>` : ''}
        ${(r.materiali || []).length ? `<h3>Materiale usato</h3><ul class="cli-mat">${r.materiali.map(x => `<li><span>${h(x.nome)}</span><span>${A.num(x.qta)} ${h(x.unita || '')}</span></li>`).join('')}</ul>` : ''}
      </div></section>`;
      if (foto.length) principale += `<section class="tessera"><div class="tt"><h2>${icona('fotocamera')} Le foto</h2><span class="pic">Tocca per ingrandire</span></div><div class="cp"><div class="cli-galleria">
        ${foto.map(f => `<button type="button" data-az="cli-foto-apri" data-iid="${h(i.id)}" data-fid="${h(f.id)}" aria-label="Ingrandisci la foto ${h(A.FASI_FOTO[f.fase] || '')}"><img src="${h(f.src)}" alt="Foto ${h(A.FASI_FOTO[f.fase] || '')}" loading="lazy"><span class="tag">${h(A.FASI_FOTO[f.fase] || f.fase)}</span></button>`).join('')}
      </div></div></section>`;
      const fi = r.firma;
      principale += `<section class="tessera"><div class="tt"><h2>${icona('penna')} Firma</h2></div><div class="cp">
        ${fi && !fi.assente && fi.png ? `<div class="cli-firma"><img src="${h(fi.png)}" alt="Firma di ${h(fi.nome)}"><div><b>${h(fi.nome)}</b>${fi.qualifica ? ' (' + h(fi.qualifica) + ')' : ''}<br><span class="muto">${A.data(fi.data)} alle ${A.ora(fi.data)}</span></div></div>`
          : fi && fi.assente ? `<p class="cli-grande" style="font-size:16px">Alla fine del lavoro non c'era nessuno per firmare.${fi.motivo ? '<br><span class="muto">' + h(fi.motivo) + '</span>' : ''}</p>` : '<p class="muto">Nessuna firma.</p>'}
        <p class="pic" style="margin-top:10px">Firma elettronica semplice raccolta sul telefono del tecnico.</p>
      </div></section>`;
    } else if (CHIUSI.includes(i.stato)) {
      principale += `<div class="avviso" style="margin-top:16px">${icona('orologio')}<div><b>Il lavoro è stato fatto.</b><br>Il rapportino sarà disponibile appena l'ufficio lo avrà controllato: te lo diciamo noi, anche per email.</div></div>`;
    } else if (i.stato === 'annullato') {
      principale += `<div class="avviso warn" style="margin-top:16px">${icona('info')}<div>Questo intervento è stato annullato. Per qualsiasi domanda scrivici o chiamaci.</div></div>`;
    }

    let lato = '';
    if (pronto) lato += `<div class="tessera"><div class="cp">
      <a class="btn acc xl" href="#/c/stampa/rapporto/${h(i.id)}">${icona('scarica')} Scarica il rapportino (PDF)</a>
      <p class="pic" style="margin-top:10px">Si apre il documento: poi tocca «Stampa o salva PDF».</p></div></div>`;
    if (fissato) lato += `<div class="tessera"><div class="cp">
      <div class="cli-etich">Ti aspettiamo</div>
      <p class="cli-grande" style="margin-top:4px"><b>${h(giornoUmano(i.data))}</b>, ${h(fascia(i))}</p>
      <p class="pic" style="margin-top:8px">Devi spostare l'appuntamento? Chiamaci:</p>
      <a class="cli-tel" href="${telLink(az.telefono)}">${icona('telefono')} ${h(az.telefono)}</a></div></div>`;
    lato += `<div class="tessera"><div class="cp">
      <p style="font-weight:650;margin-bottom:10px">Hai una domanda su questo intervento?</p>
      <button class="btn largo" type="button" data-az="cli-int-scrivi" data-id="${h(i.id)}">${icona('messaggio')} Scrivici</button></div></div>`;

    return `<a class="cli-indietro" href="#/c/interventi">${icona('indietro')} Tutti gli interventi</a>
      <div class="cli-testa-pag"><div><h1>${h(A.TIPI_INTERVENTO[i.tipo] || i.tipo)}</h1><p class="sotto">${i.data && i.stato !== 'da_pianificare' ? h(giornoUmano(i.data)) + (A.diffGiorni(A.oggi(), i.data) > 1 || A.diffGiorni(A.oggi(), i.data) < -1 ? '' : ' · ' + A.data(i.data)) : 'Data da fissare'}${m ? ' · ' + h(descrMacchina(m)) : ''}</p></div>${statoInt(i.stato)}</div>
      <div class="cli-dett"><div>${principale}</div><div class="cli-lato">${lato}</div></div>`;
  }

  A.azione('cli-foto-apri', el => {
    const i = mio(A.intervento(el.dataset.iid));
    if (!rapportoPronto(i)) return;
    const foto = (i.rapporto.foto || []).filter(f => f.visibileCliente === true);
    const k = foto.findIndex(f => f.id === el.dataset.fid);
    if (k < 0) return;
    const f = foto[k];
    const az = [];
    if (k > 0) az.push({ testo: 'Precedente', icona: 'sinistra', az: 'cli-foto-apri', attr: ` data-iid="${h(i.id)}" data-fid="${h(foto[k - 1].id)}"` });
    if (k < foto.length - 1) az.push({ testo: 'Successiva', icona: 'destra', az: 'cli-foto-apri', attr: ` data-iid="${h(i.id)}" data-fid="${h(foto[k + 1].id)}"` });
    az.push({ testo: 'Chiudi', classe: 'pri', chiudi: true });
    A.modale({ titolo: 'Foto ' + (k + 1) + ' di ' + foto.length + ' — ' + (A.FASI_FOTO[f.fase] || f.fase), largo: true, corpo: `<img class="cli-foto-grande" src="${h(f.src)}" alt="Foto ${h(A.FASI_FOTO[f.fase] || '')}"><p class="pic" style="margin-top:8px">${f.data ? A.data(f.data) + ' alle ' + A.ora(f.data) : ''}</p>`, azioni: az });
  });
  A.azione('cli-int-scrivi', el => {
    const i = mio(A.intervento(el.dataset.id)); if (!i) return;
    A.modale({
      titolo: 'Scrivici su questo intervento', form: 'cli-int-scrivi-invia',
      corpo: `<input type="hidden" name="iid" value="${h(i.id)}">
        <p class="muto" style="margin-bottom:14px">${h(A.TIPI_INTERVENTO[i.tipo] || i.tipo)}${i.data ? ' del ' + A.data(i.data) : ''}. Ti rispondiamo nei messaggi e ti avvisiamo per email.</p>
        <div class="campo"><label for="cli-int-testo">Il tuo messaggio</label><textarea id="cli-int-testo" name="testo" rows="5"></textarea></div><div id="cli-int-err"></div>`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: 'Invia', classe: 'acc', tipo: 'submit', icona: 'invia' }]
    });
  });
  A.azione('cli-int-scrivi-invia', (f, ev, d) => {
    const i = mio(A.intervento(d.iid)); if (!i) return A.chiudiModale();
    const testo = String(d.testo || '').trim();
    if (testo.length < 2) return erroreIn('#cli-int-err', 'Scrivi il tuo messaggio.');
    const id = scriviAllAzienda({ clienteId: i.clienteId, contesto: { tipo: 'intervento', id: i.id }, oggetto: (A.TIPI_INTERVENTO[i.tipo] || 'Intervento') + (i.data ? ' del ' + A.data(i.data) : ''), testo });
    A.chiudiModale(); A.toast('Messaggio inviato', 'ok'); A.vai('#/c/messaggi/' + id);
  });

  function paginaStampaRapporto(par) {
    const i = mio(A.intervento(par.id));
    if (!i) return nonTrovato();
    // Suo, ma non ancora controllato dall'ufficio: si dice com'e', senza foglio.
    if (!rapportoPronto(i)) return `<a class="cli-indietro" href="#/c/intervento/${h(i.id)}">${icona('indietro')} Torna all'intervento</a>
      <div class="tessera cli-nontrovato"><div class="cp">${icona('orologio')}<h1>Non ancora pronto</h1><p>Il rapportino sarà disponibile appena l'ufficio lo avrà controllato.</p><a class="btn pri g" href="#/c/intervento/${h(i.id)}">Torna all'intervento</a></div></div>`;
    return `<div class="cli-foglio">${A.paginaStampa(A.foglioRapportino(i, { perCliente: true }), '#/c/intervento/' + i.id)}</div>`;
  }

  // ===========================================================================
  // DOCUMENTI
  // ===========================================================================
  const GRUPPI_DOC = [['dico', 'Dichiarazioni di conformità', 'verifica'], ['libretto', 'Libretti di impianto', 'documento'], ['certificazione', 'Certificazioni e garanzie', 'scudo'], ['altro', 'Altri documenti', 'graffetta']];
  function paginaDocumenti() {
    const c = clienteAttivo();
    const all = miei('allegati', allVisibile).sort((a, b) => String(b.data).localeCompare(String(a.data)));
    const rapp = miei('interventi', rapportoPronto).sort(perDataDesc);
    const prv = miei('preventivi', prvVisibile).sort((a, b) => String(b.creato).localeCompare(String(a.creato)));
    const rigaAll = al => {
      const m = al.impiantoId ? A.impianto(al.impiantoId) : null;
      return `<li class="cli-doc"><span class="cli-ico${al.tipo === 'fattura' ? ' acc' : ''}">${icona(al.tipo === 'fattura' ? 'euro' : 'documento')}</span>
        <div class="cx1"><b>${h(al.nome)}</b><small>${A.data(al.data)}${kb(al.dimensione) ? ' · ' + kb(al.dimensione) : ''}${m && m.clienteId === c.id ? ' · ' + h(descrMacchina(m)) : ''}</small></div>
        <button class="btn" type="button" data-az="cli-scarica-all" data-id="${h(al.id)}">${icona('scarica')} Scarica</button></li>`;
    };
    const sezione = (titolo, ic, righe, vuoto) => `<section class="tessera"><div class="tt"><h2>${icona(ic)} ${h(titolo)}</h2>${righe.length ? '<span class="pastiglia grigio nopunto">' + righe.length + '</span>' : ''}</div>
      ${righe.length ? '<ul class="cli-righe">' + righe.join('') + '</ul>' : '<div class="cp">' + A.vuoto(vuoto[0], vuoto[1], ic) + '</div>'}</section>`;
    const fatture = all.filter(a => a.tipo === 'fattura').map(rigaAll);
    const rapportini = rapp.map(i => `<li class="cli-doc"><span class="cli-ico ok">${icona('verifica')}</span>
      <div class="cx1"><b>Rapportino N. ${h(i.numero)} — ${h(A.TIPI_INTERVENTO[i.tipo] || i.tipo)}</b><small>${A.data(i.data)}${i.impiantoId && A.impianto(i.impiantoId) ? ' · ' + h(descrMacchina(A.impianto(i.impiantoId))) : ''}</small></div>
      <a class="btn" href="#/c/stampa/rapporto/${h(i.id)}">${icona('scarica')} Scarica</a></li>`);
    const preventivi = prv.map(p => `<li class="cli-doc"><span class="cli-ico">${icona('documento')}</span>
      <div class="cx1"><b>Preventivo N. ${h(p.numero)} — ${h(p.oggetto)}</b><small>${A.data(p.creato)} · ${A.euro(A.totaliPreventivo(p).totale)} IVA compresa</small></div>
      <a class="btn" href="#/c/stampa/preventivo/${h(p.id)}">${icona('scarica')} Scarica</a></li>`);
    return `<h1>I tuoi documenti</h1>
      <p class="sotto">Tutti i documenti di <b>${h(c.nome)}</b> in un posto solo. Le fatture le carica qui l'ufficio amministrativo appena vengono emesse.</p>
      <div class="griglia g2">
        <div>${sezione('Fatture', 'euro', fatture, ['Nessuna fattura caricata', 'Appena l\'ufficio emette una fattura la trovi qui.'])}
          ${sezione('Rapportini di intervento', 'verifica', rapportini, ['Ancora nessun rapportino', 'Il resoconto di ogni lavoro arriva qui dopo il controllo dell\'ufficio.'])}</div>
        <div>${GRUPPI_DOC.map(g => { const r = all.filter(a => (a.tipo || 'altro') === g[0] || (g[0] === 'altro' && !['fattura', 'dico', 'libretto', 'certificazione'].includes(a.tipo))).map(rigaAll); return r.length ? sezione(g[1], g[2], r) : ''; }).join('')}
          ${sezione('Preventivi', 'documento', preventivi, ['Nessun preventivo', 'I preventivi che ti mandiamo restano qui.'])}</div>
      </div>`;
  }
  A.azione('cli-scarica-all', el => {
    const al = mio(A.trova('allegati', el.dataset.id));
    if (!allVisibile(al)) return A.toast('Documento non disponibile', 'per');
    A.scaricaAllegato(al);
    A.toast('Download avviato: lo trovi nella cartella «Download»', 'ok');
  });

  // ===========================================================================
  // I MIEI IMPIANTI
  // ===========================================================================
  function paginaImpianti() {
    const c = clienteAttivo(); const oggi = A.oggi();
    const imps = A.impiantiDi(c.id);
    const piuSedi = A.sediDi(c.id).length > 1;
    const carta = m => {
      let garanzia = '<span class="muto">—</span>';
      if (m.garanziaFino) {
        const g = A.diffGiorni(oggi, giorno10(m.garanziaFino));
        garanzia = g < 0 ? A.pastiglia('Scaduta il ' + A.data(m.garanziaFino), 'grigio') : g <= 60 ? A.pastiglia('In scadenza: ' + A.data(m.garanziaFino), 'warn') : A.pastiglia('Fino al ' + A.data(m.garanziaFino), 'ok');
      }
      // Se la manutenzione e' gia' fissata, dirlo vale piu' di un bottone «prenota».
      const giaFissata = A.DB.interventi.filter(i => i.clienteId === c.id && i.impiantoId === m.id && i.tipo === 'manutenzione' && APERTI.includes(i.stato)).sort(perData)[0];
      let manut;
      if (m.prossimaManutenzione) {
        const g = A.diffGiorni(oggi, giorno10(m.prossimaManutenzione));
        manut = g < 0 ? A.pastiglia('Scaduta dal ' + A.data(m.prossimaManutenzione), 'dang') : g <= 30 ? A.pastiglia(g === 0 ? 'Da fare oggi' : 'Entro il ' + A.data(m.prossimaManutenzione), 'acc') : h(A.data(m.prossimaManutenzione));
      } else manut = m.intervalloMesi ? 'da fissare' : '<span class="muto">Solo quando serve</span>';
      const ultimo = A.DB.interventi.filter(i => i.clienteId === c.id && i.impiantoId === m.id && CHIUSI.includes(i.stato)).sort(perDataDesc)[0];
      const libretto = A.DB.allegati.find(a => a.clienteId === c.id && a.impiantoId === m.id && a.tipo === 'libretto' && allVisibile(a));
      const contratto = (A.DB.contratti || []).find(k => k.clienteId === c.id && k.impiantoId === m.id);
      const sede = piuSedi ? A.sede(m.sedeId) : null;
      return `<section class="tessera cli-imp"><div class="cp">
        <div class="cli-imp-testa"><span class="cli-ico">${icona(iconaMacchina(m))}</span><div><small>${h(maiuscola(m.categoria))}</small><h2>${h([m.marca, m.modello].filter(Boolean).join(' '))}</h2></div></div>
        <dl class="dl">
          ${m.matricola ? `<dt>Matricola</dt><dd class="mono">${h(m.matricola)}</dd>` : ''}
          ${sede ? `<dt>Dove</dt><dd>${h(A.indirizzo(sede))}</dd>` : ''}
          <dt>Installata il</dt><dd>${m.installato ? A.data(m.installato) : '—'}</dd>
          <dt>Garanzia</dt><dd>${garanzia}</dd>
          <dt>Manutenzione</dt><dd>${giaFissata ? A.pastiglia('Fissata: ' + (giaFissata.data ? giornoUmano(giaFissata.data).toLowerCase() : 'data da fissare'), 'blu') : manut}</dd>
          <dt>Ultimo lavoro</dt><dd>${ultimo ? `<a href="#/c/intervento/${h(ultimo.id)}">${A.data(ultimo.data)} — ${h(A.TIPI_INTERVENTO[ultimo.tipo] || ultimo.tipo)}</a>` : '<span class="muto">—</span>'}</dd>
        </dl>
        ${contratto ? `<p class="contratto">${icona('scudo')}<span>Contratto di manutenzione: ${h(contratto.nome)}${contratto.scadenza ? ' · fino al ' + A.data(contratto.scadenza) : ''}</span></p>` : ''}
        <div class="piede">
          ${giaFissata ? `<a class="btn pri largo" href="#/c/intervento/${h(giaFissata.id)}">${icona('calendario')} Vedi l'appuntamento</a>`
            : m.intervalloMesi || m.prossimaManutenzione ? `<a class="btn acc largo" href="#/c/richiedi?impianto=${encodeURIComponent(m.id)}&tipo=manutenzione">${icona('calendario')} Prenota la manutenzione</a>`
            : `<a class="btn largo" href="#/c/richiedi?impianto=${encodeURIComponent(m.id)}">${icona('chiave')} Chiedi un intervento</a>`}
          ${libretto ? `<button class="btn vuoto largo" type="button" data-az="cli-scarica-all" data-id="${h(libretto.id)}">${icona('scarica')} Scarica il libretto</button>` : ''}
        </div>
      </div></section>`;
    };
    return `<h1>I miei impianti</h1>
      <p class="sotto">Le macchine che seguiamo per <b>${h(c.nome)}</b>: garanzia, manutenzioni e l'ultimo lavoro fatto.</p>
      ${imps.length ? `<div class="griglia g2">${imps.map(carta).join('')}</div>` : `<div class="tessera">${A.vuoto('Nessuna macchina registrata', 'Quando installiamo o controlliamo una caldaia, uno scaldabagno o un addolcitore, lo trovi qui con le scadenze.', 'impianto')}</div>`}`;
  }

  // ===========================================================================
  // RICHIEDI UN INTERVENTO
  // ===========================================================================
  // Le foto scelte stanno qui e non nel DOM: se la pagina si ridisegna
  // (dati nuovi da un'altra finestra) non si perdono.
  let fotoRichiesta = [];
  function anteprimeHtml() {
    return fotoRichiesta.map((src, k) => `<div class="cli-foto-mini"><img src="${h(src)}" alt="Foto ${k + 1}"><button type="button" data-az="cli-foto-togli" data-i="${k}" aria-label="Togli la foto ${k + 1}">${icona('x', 'p')}</button></div>`).join('');
  }
  function disegnaAnteprime() {
    const box = A.$('#cli-foto-anteprime'); if (box) box.innerHTML = anteprimeHtml();
    const b = A.$('#cli-foto-btn'); if (b) b.classList.toggle('nascosto', fotoRichiesta.length >= 3);
  }
  const TEMPI = { urgente: 'al più presto, di solito entro un\'ora in orario di lavoro', questa_settimana: 'di solito entro domani', quando_potete: 'di solito entro due giorni lavorativi' };

  function elencoRichieste() {
    const lista = miei('richieste').sort((a, b) => String(b.data).localeCompare(String(a.data)));
    if (!lista.length) return `<div class="tessera">${A.vuoto('Nessuna richiesta', 'Le richieste che ci mandi da qui restano in questo elenco, con lo stato.', 'arrivo')}</div>`;
    return `<div class="tessera"><ul class="cli-righe">${lista.map(r => {
      const st = STATO_RIC[r.stato] || [r.stato, 'grigio'];
      const intv = r.interventoId ? A.intervento(r.interventoId) : null;
      const inner = `<span class="cli-ico${r.urgenza === 'urgente' ? ' acc' : ''}">${icona(r.tipo === 'guasto' ? 'attenzione' : r.tipo === 'preventivo' ? 'documento' : r.tipo === 'sopralluogo' ? 'occhio' : 'chiave')}</span>
        <span class="cx1"><span class="t1">${h(TIPI_RIC[r.tipo] || r.tipo)}${r.urgenza === 'urgente' ? ' — urgente' : ''}</span><span class="t2">${h(taglia(r.descrizione, 110))}</span><span class="t2">${h(A.quando(r.data))}${(r.foto || []).length ? ' · ' + r.foto.length + ' foto' : ''}</span></span>
        <span class="dxx">${A.pastiglia(st[0], st[1])}${intv && intv.clienteId === r.clienteId ? '<small>Vedi l\'intervento</small>' : ''}</span>`;
      return `<li>${intv && intv.clienteId === r.clienteId ? `<a class="cli-riga" href="#/c/intervento/${h(intv.id)}">${inner}${icona('destra')}</a>` : `<div class="cli-riga" style="cursor:default">${inner}</div>`}</li>`;
    }).join('')}</ul></div>`;
  }

  function paginaRichiedi(par) {
    const c = clienteAttivo(), u = A.utente(), az = A.DB.azienda;
    if (par.q.inviata) return confermaRichiesta(par.q.inviata);
    const sedi = A.sediDi(c.id), imps = A.impiantiDi(c.id);
    const impQ = imps.find(m => m.id === par.q.impianto) || null;
    const manut = par.q.tipo === 'manutenzione';
    const tipoSel = manut || impQ ? 'intervento' : (TIPI_RIC[par.q.tipo] ? par.q.tipo : '');
    const descr = impQ ? (manut ? 'Vorrei prenotare la manutenzione di: ' : 'Ho bisogno di un intervento su: ') + descrMacchina(impQ) + (impQ.matricola ? ' (matricola ' + impQ.matricola + ')' : '') + '.' : '';
    const sedeSel = impQ ? impQ.sedeId : (sedi[0] ? sedi[0].id : '');
    const TIPI = [['guasto', 'Qualcosa non funziona', 'attenzione'], ['intervento', 'Una manutenzione o un lavoro', 'chiave'], ['sopralluogo', 'Venite a vedere', 'occhio'], ['preventivo', 'Voglio sapere quanto costa', 'documento']];
    return `<h1>Richiedi un intervento</h1>
      <p class="sotto">Dicci cosa ti serve: ti richiamiamo noi per fissare giorno e ora.</p>
      <div class="cli-richiedi">
        <form class="tessera" data-form="cli-richiedi" novalidate><div class="cp">
          <fieldset class="cli-dom"><legend><span class="cli-n">1</span> Cosa ti serve?</legend>
            <div class="cli-tipi">${TIPI.map(t => `<label class="scelta"><input type="radio" name="tipo" value="${t[0]}"${tipoSel === t[0] ? ' checked' : ''}><span>${icona(t[2])}${h(TIPI_RIC[t[0]])}<small>${h(t[1])}</small></span></label>`).join('')}</div>
          </fieldset>
          <fieldset class="cli-dom"><legend><span class="cli-n">2</span> Quanto è urgente?</legend>
            <div class="scelte cli-urg">${Object.keys(URGENZE).map(k => `<label class="scelta${k === 'urgente' ? ' urg' : ''}"><input type="radio" name="urgenza" value="${k}"${k === 'quando_potete' ? ' checked' : ''}><span>${h(URGENZE[k])}</span></label>`).join('')}</div>
            <div class="avviso warn cli-gas">${icona('attenzione')}<div><b>Se c'è acqua che esce o odore di gas chiamateci subito:</b><br><a href="${telLink(az.telefono)}">${icona('telefono')} ${h(az.telefono)}</a></div></div>
          </fieldset>
          <fieldset class="cli-dom"><legend><span class="cli-n">3</span> Dove e su cosa?</legend>
            ${sedi.length > 1 ? `<div class="campo"><label for="cli-ric-sede">Dove</label><select id="cli-ric-sede" name="sedeId">${sedi.map(s => `<option value="${h(s.id)}"${s.id === sedeSel ? ' selected' : ''}>${h(A.indirizzo(s))}</option>`).join('')}</select></div>`
              : `<input type="hidden" name="sedeId" value="${h(sedeSel)}"><p class="cli-grande" style="font-size:16px;margin-bottom:12px">${icona('mappa')} ${sedi[0] ? h(A.indirizzo(sedi[0])) : h(c.nome)}</p>`}
            ${imps.length ? `<div class="campo"><label for="cli-ric-imp">Su quale macchina? <span class="muto">(facoltativo)</span></label><select id="cli-ric-imp" name="impiantoId"><option value="">Non lo so, oppure nessuna in particolare</option>${imps.map(m => `<option value="${h(m.id)}"${impQ && impQ.id === m.id ? ' selected' : ''}>${h(descrMacchina(m))}</option>`).join('')}</select></div>` : ''}
          </fieldset>
          <fieldset class="cli-dom"><legend><span class="cli-n">4</span> Raccontaci cosa succede</legend>
            <div class="campo"><label for="cli-ric-descr" class="sr">Descrizione</label><textarea id="cli-ric-descr" name="descrizione" rows="5" placeholder="Per esempio: la caldaia si blocca e sul display c'è scritto F28.">${h(descr)}</textarea></div>
            <span class="etichetta">Foto <span class="muto">(facoltative, fino a 3)</span></span>
            <p class="pic" style="margin:2px 0 10px">Una foto del display o della perdita ci aiuta a portare il pezzo giusto.</p>
            <div id="cli-foto-anteprime" class="cli-foto-anteprime">${anteprimeHtml()}</div>
            <label id="cli-foto-btn" class="btn${fotoRichiesta.length >= 3 ? ' nascosto' : ''}" for="cli-foto-in">${icona('fotocamera')} Aggiungi una foto</label>
            <input id="cli-foto-in" type="file" accept="image/*" multiple class="sr" data-cambia="cli-foto-aggiungi">
          </fieldset>
          <fieldset class="cli-dom"><legend><span class="cli-n">5</span> A che numero ti chiamiamo?</legend>
            <div class="campo"><label for="cli-ric-tel" class="sr">Telefono</label><input id="cli-ric-tel" type="tel" name="telefono" value="${h(u.telefono || c.telefono || '')}" autocomplete="tel" inputmode="tel"></div>
          </fieldset>
          <div id="cli-ric-err" aria-live="polite"></div>
          <button class="btn acc xl" type="submit" style="margin-top:6px">${icona('invia')} Invia la richiesta</button>
        </div></form>
        <aside><div class="tessera"><div class="tt"><h2>${icona('info')} Come funziona</h2></div><div class="cp">
          <ol class="cli-passi"><li>Ci mandi la richiesta da qui.</li><li>Ti richiamiamo per fissare giorno e ora.</li><li>L'intervento compare in «Interventi», con il nome del tecnico.</li><li>Dopo il lavoro trovi qui il rapportino firmato.</li></ol>
        </div></div></aside>
      </div>
      <h2 class="cli-sez">Le tue richieste</h2>
      ${elencoRichieste()}`;
  }

  function confermaRichiesta(id) {
    const r = mio(A.trova('richieste', id));
    if (!r) return nonTrovato();
    const u = A.utente(), az = A.DB.azienda;
    return `<div class="cli-fatto-corpo"><div class="tessera"><div class="cp">
        <div class="cli-fatto"><div class="tondo">${icona('spunta')}</div>
          <h1>Richiesta inviata!</h1>
          <p>Grazie, ${h(u.nome.split(' ')[0])}. L'abbiamo ricevuta ${h(A.quando(r.data))}.</p></div>
        <div class="sep"></div>
        <h2 style="margin-bottom:14px">Cosa succede adesso</h2>
        <ol class="cli-passi">
          <li>L'ufficio legge la tua richiesta.</li>
          <li>Ti richiamiamo${r.telefono ? ' al <b>' + h(r.telefono) + '</b>' : ''} ${h(TEMPI[r.urgenza] || TEMPI.quando_potete)}, per fissare giorno e ora.</li>
          <li>Appena fissato, vedrai l'intervento qui in «Interventi» e ti avvisiamo anche per email.</li>
        </ol>
        ${r.urgenza === 'urgente' ? `<div class="avviso warn" style="margin-top:16px">${icona('attenzione')}<div><b>Se c'è acqua che esce o odore di gas non aspettare:</b> chiamaci subito al <a href="${telLink(az.telefono)}">${h(az.telefono)}</a>.</div></div>` : ''}
        <div class="btns" style="margin-top:22px;justify-content:center"><a class="btn pri g" href="#/c/home">${icona('casa')} Torna alla pagina iniziale</a><a class="btn g" href="#/c/richiedi">Fai un'altra richiesta</a></div>
      </div></div></div>
      <h2 class="cli-sez">Le tue richieste</h2>
      ${elencoRichieste()}`;
  }

  A.azione('cli-foto-aggiungi', async el => {
    const files = Array.from(el.files || []); el.value = '';
    const posto = 3 - fotoRichiesta.length;
    if (posto <= 0) return A.toast('Puoi mandare al massimo 3 foto', 'warn');
    if (files.length > posto) A.toast('Ne prendiamo ' + posto + ': al massimo 3 foto', 'warn');
    for (const f of files.slice(0, posto)) {
      try { fotoRichiesta.push(await A.comprimiFoto(f)); }
      catch (e) { A.toast('Questa foto non si riesce ad aprire: provane un\'altra', 'per'); }
    }
    disegnaAnteprime();
  });
  A.azione('cli-foto-togli', el => { fotoRichiesta.splice(+el.dataset.i, 1); disegnaAnteprime(); });
  A.azione('cli-richiedi', (f, ev, d) => {
    const c = clienteAttivo(), u = A.utente();
    if (!TIPI_RIC[d.tipo]) return erroreIn('#cli-ric-err', 'Scegli cosa ti serve (punto 1).');
    const descr = String(d.descrizione || '').trim();
    if (descr.length < 3) return erroreIn('#cli-ric-err', 'Scrivi due parole su cosa succede (punto 4): ci aiuta a mandare il tecnico giusto.');
    const sedi = A.sediDi(c.id);
    const sede = sedi.find(s => s.id === d.sedeId) || sedi[0] || null;
    const imp = d.impiantoId ? A.impiantiDi(c.id).find(m => m.id === d.impiantoId) || null : null;
    const urgenza = URGENZE[d.urgenza] ? d.urgenza : 'quando_potete';
    // La macchina scelta finisce anche nel testo: l'ufficio la legge subito,
    // senza dover aprire la scheda del cliente per capire di quale caldaia si parla.
    const testo = descr + (imp && descr.indexOf(imp.modello) < 0 ? '\n\nMacchina: ' + descrMacchina(imp) + (imp.matricola ? ' (matricola ' + imp.matricola + ')' : '') : '');
    let id;
    A.modifica(db => {
      id = A.uid('ric');
      db.richieste.unshift({
        id, origine: 'portale', clienteId: c.id, utenteId: u.id, nome: u.nome,
        telefono: String(d.telefono || '').trim() || u.telefono || c.telefono || '', email: u.email || c.email || '',
        indirizzo: sede ? A.indirizzo(sede) : '', tipo: d.tipo, urgenza, sedeId: sede ? sede.id : null, impiantoId: imp ? imp.id : null,
        descrizione: testo, stato: 'nuova', data: A.adesso(), interventoId: null, foto: fotoRichiesta.slice()
      });
      A.avvisa('ufficio', (urgenza === 'urgente' ? 'URGENTE — ' : '') + 'Richiesta dall\'area clienti: ' + c.nome + ' (' + TIPI_RIC[d.tipo].replace(/^Un /, '').toLowerCase() + ')', '#/u/richieste', { tipo: 'richiesta' });
      A.registra('richiesta dal cliente', c.nome + ' — ' + d.tipo + (urgenza === 'urgente' ? ' (urgente)' : '') + (fotoRichiesta.length ? ' — ' + fotoRichiesta.length + ' foto' : ''));
    });
    fotoRichiesta = [];
    A.vai('#/c/richiedi?inviata=' + id);
  });

  // ===========================================================================
  // ORDINA MATERIALE
  // ===========================================================================
  // Il carrello sta nella sessione, uno per cliente: l'amministratore che
  // ordina il sale per un condominio non deve ritrovarselo nell'altro.
  function leggiCarrello(cid) { try { const x = JSON.parse(sessionStorage.getItem(PREF_CARRELLO + cid) || '{}'); return x && typeof x === 'object' ? x : {}; } catch (_) { return {}; } }
  function scriviCarrello(cid, carr) { try { sessionStorage.setItem(PREF_CARRELLO + cid, JSON.stringify(carr)); } catch (_) { } }
  /** Prezzo al cliente: listino meno il suo sconto. Mai il costo d'acquisto. */
  function prezzoCliente(a, c) { return A.arrot((Number(a.prezzo) || 0) * (1 - (Number(c.sconto) || 0) / 100)); }
  const articoliVendibili = () => A.DB.articoli.filter(a => a.attivo !== false && Number(a.prezzo) > 0);
  const ORDINE_CAT = ['Trattamento acqua', 'Minuteria', 'Sanitari', 'Raccorderia', 'Valvolame', 'Tubi', 'Riscaldamento', 'Ricambi caldaia', 'Scaldabagni', 'Caldaie'];
  const ICONA_CAT = { 'Trattamento acqua': 'goccia', Minuteria: 'scatola', Sanitari: 'goccia', Raccorderia: 'ingranaggio', Valvolame: 'regolazioni', Tubi: 'elenco', Riscaldamento: 'fiamma', 'Ricambi caldaia': 'chiave', Scaldabagni: 'goccia', Caldaie: 'fiamma' };
  let catAperte = null;
  let cercaArt = '';
  let moduloOrdine = { consegna: 'ritiro', sedeId: '', note: '' };
  const testoArt = a => [a.nome, a.marca, a.codice, a.categoria].join(' ').toLowerCase();

  function stepper(id, q) {
    return `<div class="stepper cli-step"><button type="button" data-az="cli-carr-meno" data-id="${h(id)}" aria-label="Togli uno">−</button><input type="number" min="0" step="1" inputmode="numeric" value="${h(q)}" data-cambia="cli-carr-qta" data-id="${h(id)}" aria-label="Quantità"><button type="button" data-az="cli-carr-piu" data-id="${h(id)}" aria-label="Aggiungi uno">+</button></div>`;
  }

  function paginaOrdina() {
    const c = clienteAttivo(), az = A.DB.azienda;
    const carr = leggiCarrello(c.id);
    const arts = articoliVendibili();
    // Prima quello che un cliente compra da solo (sale, filtri, guarnizioni),
    // in fondo le caldaie: chi cerca il sale non deve scorrere tre caldaie.
    const pos = cat => { const k = ORDINE_CAT.indexOf(cat); return k < 0 ? 50 : k; };
    const cats = Array.from(new Set(arts.map(a => a.categoria || 'Altro'))).sort((a, b) => pos(a) - pos(b) || a.localeCompare(b, 'it'));
    const q = cercaArt.trim().toLowerCase();
    // Categorie chiuse, da aprire con un tocco: 42 articoli in fila sono una
    // pagina da 15.000 pixel sul telefono. La prima e' aperta per far vedere
    // com'e' fatto un articolo; cercando, si aprono da sole quelle che c'entrano.
    if (!catAperte) catAperte = new Set(cats.slice(0, 1));
    const catalogo = cats.map(cat => {
      const lista = arts.filter(a => (a.categoria || 'Altro') === cat).sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
      const vis = lista.filter(a => !q || testoArt(a).includes(q));
      const aperta = catAperte.has(cat);
      const nel = lista.filter(a => Number(carr[a.id]) > 0).length;
      return `<section class="tessera cli-cat${aperta ? ' aperta' : ''}" data-cat="${h(cat)}"${vis.length ? '' : ' hidden'}>
        <button type="button" class="cli-cat-testa" data-az="cli-cat-apri" aria-expanded="${aperta}"><span class="cli-ico">${icona(ICONA_CAT[cat] || 'pacco')}</span><span class="cx1"><b>${h(cat)}</b><small>${lista.length} ${lista.length === 1 ? 'articolo' : 'articoli'}</small>${nel ? '<small class="nel"> · ' + nel + ' nel tuo ordine</small>' : ''}</span>${icona('giu')}</button>
        <ul class="cli-righe cli-cat-lista">
        ${lista.map(a => {
          const n = Number(carr[a.id]) || 0;
          return `<li class="cli-art" data-testo="${h(testoArt(a))}"${q && !testoArt(a).includes(q) ? ' hidden' : ''}>
            <div class="cx1"><b>${h(a.nome)}</b><small>${a.marca && a.marca !== 'generica' ? h(a.marca) + ' · ' : ''}cod. ${h(a.codice)}</small></div>
            <div class="cli-art-prezzo"><b>${A.euro(prezzoCliente(a, c))}</b><small>${a.unita === 'm' || a.unita === 'lt' || a.unita === 'pz' ? 'al ' + UNITA[a.unita] : 'per ' + h(UNITA[a.unita] || a.unita)}</small></div>
            <div class="azz">${n ? stepper(a.id, n) : `<button class="btn pic" type="button" data-az="cli-carr-piu" data-id="${h(a.id)}">${icona('piu', 'p')} Aggiungi</button>`}</div></li>`;
        }).join('')}</ul></section>`;
    }).join('');

    const righe = Object.keys(carr).map(id => { const a = A.articolo(id); return a && a.attivo !== false && carr[id] > 0 ? { a, q: Number(carr[id]) } : null; }).filter(Boolean);
    const tot = A.arrot(righe.reduce((s, r) => s + r.q * prezzoCliente(r.a, c), 0));
    const sedi = A.sediDi(c.id);
    const sedeSel = sedi.some(s => s.id === moduloOrdine.sedeId) ? moduloOrdine.sedeId : (sedi[0] ? sedi[0].id : '');
    const noPagamento = `<div class="avviso">${icona('euro')}<div><b>Nessun pagamento online:</b> paghi alla consegna o con la prossima fattura.</div></div>`;
    const carrello = `<aside class="carrello" id="cli-carrello"><div class="tessera">
      <div class="tt"><h2>${icona('carrello')} Il tuo ordine</h2>${righe.length ? '<span class="contatore blu">' + righe.length + '</span>' : ''}</div>
      ${righe.length ? `<ul class="cli-carr-righe">${righe.map(r => `<li><span class="nm">${h(r.a.nome)}<small>${A.euro(prezzoCliente(r.a, c))} ${r.a.unita === 'm' || r.a.unita === 'lt' || r.a.unita === 'pz' ? 'al ' + UNITA[r.a.unita] : 'per ' + h(UNITA[r.a.unita] || r.a.unita)}</small></span>${stepper(r.a.id, r.q)}<span class="imp">${A.euro(r.q * prezzoCliente(r.a, c))}</span></li>`).join('')}</ul>
        <div class="cli-carr-tot"><span>Totale<small>IVA esclusa</small></span><b>${A.euro(tot)}</b></div>
        <form class="cp" data-form="cli-ordina" novalidate>
          <fieldset style="border:0;margin-bottom:6px"><legend class="etichetta" style="margin-bottom:8px">Come lo vuoi?</legend>
            <label class="cli-radio"><input type="radio" name="consegna" value="ritiro" data-cambia="cli-ord-campo"${moduloOrdine.consegna !== 'consegna' ? ' checked' : ''}><span><b>Lo ritiro io al deposito</b><small>${h(az.indirizzo)}, ${h(az.cap)} ${h(az.citta)}</small></span></label>
            <label class="cli-radio"><input type="radio" name="consegna" value="consegna" data-cambia="cli-ord-campo"${moduloOrdine.consegna === 'consegna' ? ' checked' : ''}><span><b>Portatemelo voi</b><small>${sedi.length === 1 ? h(A.indirizzo(sedi[0])) : 'in una delle tue sedi'}</small></span></label>
          </fieldset>
          ${sedi.length > 1 ? `<div class="campo"${moduloOrdine.consegna === 'consegna' ? '' : ' hidden'} id="cli-ord-dove"><label for="cli-ord-sede">Dove lo portiamo?</label><select id="cli-ord-sede" name="sedeId" data-cambia="cli-ord-campo">${sedi.map(s => `<option value="${h(s.id)}"${s.id === sedeSel ? ' selected' : ''}>${h(A.indirizzo(s))}</option>`).join('')}</select></div>` : `<input type="hidden" name="sedeId" value="${h(sedeSel)}">`}
          <div class="campo"><label for="cli-ord-note">Note <span class="muto">(facoltative)</span></label><textarea id="cli-ord-note" name="note" rows="2" data-digita="cli-ord-note" placeholder="Per esempio: lasciare al portiere">${h(moduloOrdine.note)}</textarea></div>
          ${noPagamento}
          <button class="btn acc xl" type="submit" style="margin-top:14px">${icona('invia')} Invia l'ordine</button>
        </form>`
        : `<div class="cp">${A.vuoto('Il tuo ordine è vuoto', 'Tocca «Aggiungi» accanto a quello che ti serve.', 'carrello')}${noPagamento}</div>`}
    </div></aside>`;

    const ordini = miei('ordini').sort((a, b) => String(b.data).localeCompare(String(a.data)));
    const elencoOrdini = ordini.length ? `<div class="tessera"><ul class="cli-righe">${ordini.map(o => {
      const t = A.arrot((o.righe || []).reduce((s, r) => s + (Number(r.qta) || 0) * (Number(r.prezzo) || 0), 0));
      return `<li><button type="button" class="cli-riga" data-az="cli-ordine-apri" data-id="${h(o.id)}"><span class="cli-ico">${icona('pacco')}</span>
        <span class="cx1"><span class="t1">Ordine N. ${h(o.numero)}</span><span class="t2">${A.data(o.data)} · ${(o.righe || []).length} ${(o.righe || []).length === 1 ? 'articolo' : 'articoli'} · ${o.consegna === 'consegna' ? 'consegna' : 'ritiro al deposito'}</span></span>
        <span class="dxx"><span class="imp">${A.euro(t)}</span>${statoOrdine(o)}</span></button></li>`;
    }).join('')}</ul></div>` : `<div class="tessera">${A.vuoto('Nessun ordine', 'Gli ordini che ci mandi da qui restano in questo elenco, con lo stato.', 'pacco')}</div>`;

    return {
      html: `<h1>Ordina materiale</h1>
        <p class="sotto">Scegli quello che ti serve: lo prepariamo noi e lo ritiri al deposito, oppure te lo portiamo. Prezzi IVA esclusa${Number(c.sconto) ? ', con il tuo sconto del ' + A.num(c.sconto) + '% già applicato' : ''}.</p>
        <div class="cli-ordina">
          <div>
            <div class="cerca"><label for="cli-cerca-art" class="sr">Cerca</label>${icona('cerca')}<input id="cli-cerca-art" type="search" value="${h(cercaArt)}" data-digita="cli-cerca-art" placeholder="Cerca: sale, rubinetto, guarnizione…" autocomplete="off"></div>
            <div id="cli-nessun-art" class="cli-catalogo"${arts.some(a => !q || testoArt(a).includes(q)) ? ' hidden' : ''}><div class="tessera">${A.vuoto('Non troviamo niente con queste parole', 'Prova con una parola sola, oppure scrivici: lo cerchiamo noi.', 'cerca')}</div></div>
            <div id="cli-catalogo" class="cli-lista-t cli-catalogo${q ? ' cli-cercando' : ''}">${catalogo}</div>
          </div>
          ${carrello}
        </div>
        <h2 class="cli-sez">I miei ordini</h2>
        ${elencoOrdini}
        ${righe.length ? `<button type="button" class="cli-barra-carr" data-az="cli-vai-carrello">${icona('carrello', 'g')}<span class="cx1">${righe.length} ${righe.length === 1 ? 'articolo' : 'articoli'} · <b>${A.euro(tot)}</b></span><span>Vedi l'ordine ${icona('giu')}</span></button><div class="cli-spazio-barra"></div>` : ''}`
    };
  }
  function cambiaQta(id, fn) {
    const c = clienteAttivo(); const a = A.articolo(id);
    if (!a || a.attivo === false) return;
    const carr = leggiCarrello(c.id);
    const n = Math.max(0, Math.min(999, Math.round(fn(Number(carr[id]) || 0))));
    if (n) carr[id] = n; else delete carr[id];
    scriviCarrello(c.id, carr);
    A.render();
  }
  A.azione('cli-carr-piu', el => cambiaQta(el.dataset.id, n => n + 1));
  A.azione('cli-carr-meno', el => cambiaQta(el.dataset.id, n => n - 1));
  A.azione('cli-carr-qta', el => cambiaQta(el.dataset.id, () => Number(String(el.value).replace(',', '.')) || 0));
  A.azione('cli-cerca-art', el => {
    // Filtra nel DOM, senza ridisegnare: chi scrive non deve perdere il cursore.
    cercaArt = el.value;
    const q = cercaArt.trim().toLowerCase();
    let tot = 0;
    A.$$('.cli-cat').forEach(sez => {
      let n = 0;
      A.$$('.cli-art', sez).forEach(li => { const ok = !q || li.dataset.testo.includes(q); li.hidden = !ok; if (ok) n++; });
      sez.hidden = !n; tot += n;
    });
    const v = A.$('#cli-nessun-art'); if (v) v.hidden = !!tot;
    const cat = A.$('#cli-catalogo'); if (cat) cat.classList.toggle('cli-cercando', !!q);
  });
  A.azione('cli-cat-apri', el => {
    // Si apre e si chiude nel DOM; l'insieme delle aperte sopravvive ai ridisegni (+/- sul carrello).
    const sez = el.closest('.cli-cat'); const cat = sez.dataset.cat;
    if (catAperte.has(cat)) catAperte.delete(cat); else catAperte.add(cat);
    sez.classList.toggle('aperta', catAperte.has(cat));
    el.setAttribute('aria-expanded', String(catAperte.has(cat)));
  });
  A.azione('cli-vai-carrello', () => { const s = A.$('#cli-carrello'); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  A.azione('cli-ord-campo', el => {
    if (el.name === 'consegna') { moduloOrdine.consegna = el.value; const d = A.$('#cli-ord-dove'); if (d) d.hidden = el.value !== 'consegna'; }
    if (el.name === 'sedeId') moduloOrdine.sedeId = el.value;
  });
  A.azione('cli-ord-note', el => { moduloOrdine.note = el.value; });
  A.azione('cli-ordina', (f, ev, d) => {
    const c = clienteAttivo(), u = A.utente(), az = A.DB.azienda;
    const carr = leggiCarrello(c.id);
    const righe = Object.keys(carr).map(id => { const a = A.articolo(id); return a && a.attivo !== false && carr[id] > 0 ? { articoloId: id, qta: Number(carr[id]), prezzo: prezzoCliente(a, c) } : null; }).filter(Boolean);
    if (!righe.length) return A.toast('Il tuo ordine è vuoto', 'per');
    const consegna = d.consegna === 'consegna' ? 'consegna' : 'ritiro';
    const sedi = A.sediDi(c.id);
    const sede = consegna === 'consegna' ? (sedi.find(s => s.id === d.sedeId) || sedi[0] || null) : null;
    const tot = A.arrot(righe.reduce((s, r) => s + r.qta * r.prezzo, 0));
    let numero, oid;
    A.modifica(db => {
      numero = A.numera('ORD'); oid = A.uid('ord');
      // Il prezzo salvato e' quello che il cliente ha visto (gia' scontato):
      // l'ufficio conferma quel numero, non ne ricalcola un altro.
      db.ordini.unshift({ id: oid, numero, clienteId: c.id, utenteId: u.id, righe, consegna, sedeId: sede ? sede.id : null, note: String(d.note || '').trim(), stato: 'nuovo', data: A.adesso(), sconto: Number(c.sconto) || 0 });
      A.avvisa('ufficio', 'Nuovo ordine di materiale da ' + c.nome + ' (' + righe.length + (righe.length === 1 ? ' articolo, ' : ' articoli, ') + A.euro(tot) + ' + IVA)', '#/u/materiale?scheda=ordini', { tipo: 'ordine' });
      if (!u.preferenze || u.preferenze.email !== false) db.email.unshift({ id: A.uid('eml'), data: A.adesso(), a: u.email || c.email, oggetto: 'IDRAL — abbiamo ricevuto il tuo ordine N. ' + numero, testo: 'Ordine N. ' + numero + ' per ' + c.nome + ': ' + righe.length + ' articoli, ' + A.euro(tot) + ' IVA esclusa. ' + (consegna === 'consegna' ? 'Consegna in ' + (sede ? A.indirizzo(sede) : 'sede') : 'Ritiro al deposito di ' + az.indirizzo) + '. Nessun pagamento online: paghi alla consegna o con la prossima fattura.' });
      A.registra('ordine dal cliente', 'ORD ' + numero + ' — ' + c.nome);
    });
    scriviCarrello(c.id, {});
    moduloOrdine = { consegna: 'ritiro', sedeId: '', note: '' };
    A.render();
    A.modale({
      titolo: 'Ordine inviato',
      corpo: `<div class="cli-fatto" style="padding-top:0"><div class="tondo">${icona('spunta')}</div><p class="cli-grande">Ordine <b>N. ${h(numero)}</b> ricevuto. Grazie!</p></div>
        <h3 style="margin:12px 0 10px">Cosa succede adesso</h3>
        <ol class="cli-passi"><li>L'ufficio controlla l'ordine e te lo conferma.</li><li>Prepariamo il materiale.</li><li>${consegna === 'consegna' ? 'Te lo portiamo e ti avvisiamo prima di passare.' : 'Ti avvisiamo quando è pronto da ritirare in ' + h(az.indirizzo) + '.'}</li></ol>
        <div class="avviso" style="margin-top:16px">${icona('euro')}<div><b>Nessun pagamento online:</b> paghi alla consegna o con la prossima fattura.</div></div>`,
      azioni: [{ testo: 'Va bene', classe: 'pri', chiudi: true }]
    });
  });
  A.azione('cli-ordine-apri', el => {
    const o = mio(A.trova('ordini', el.dataset.id)); if (!o) return;
    const s = o.sedeId ? A.sede(o.sedeId) : null; const az = A.DB.azienda;
    const t = A.arrot((o.righe || []).reduce((x, r) => x + (Number(r.qta) || 0) * (Number(r.prezzo) || 0), 0));
    A.modale({
      titolo: 'Ordine N. ' + o.numero,
      corpo: `<p style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px">${statoOrdine(o)}<span class="muto">del ${A.data(o.data)}</span></p>
        <table class="cli-ord-tab"><tbody>${(o.righe || []).map(r => { const a = A.articolo(r.articoloId); return `<tr><td>${h(a ? a.nome : 'Articolo')}</td><td class="num">${A.num(r.qta)} ${h(a ? a.unita : '')}</td><td class="num">${A.euro(r.qta * r.prezzo)}</td></tr>`; }).join('')}
          <tr class="tot"><td colspan="2">Totale IVA esclusa</td><td class="num">${A.euro(t)}</td></tr></tbody></table>
        <dl class="dl" style="margin-top:14px"><dt>${o.consegna === 'consegna' ? 'Consegna' : 'Ritiro'}</dt><dd>${o.consegna === 'consegna' ? (s ? h(A.indirizzo(s)) : '—') : 'Al deposito: ' + h(az.indirizzo)}</dd>${o.note ? `<dt>Note</dt><dd>${h(o.note)}</dd>` : ''}</dl>`,
      azioni: [{ testo: 'Chiudi', classe: 'pri', chiudi: true }]
    });
  });

  // ===========================================================================
  // MESSAGGI
  // ===========================================================================
  /**
   * Un solo punto da cui il cliente scrive all'azienda: messaggi, modifica di un
   * preventivo, domanda su un intervento, cambio dati. Se esiste gia' la
   * conversazione di quel preventivo/intervento si continua quella: l'ufficio
   * deve trovare la storia intera in un posto, non tre fili sparsi.
   */
  function scriviAllAzienda(o) {
    const u = A.utente(); const c = A.cliente(o.clienteId);
    let id = null;
    A.modifica(db => {
      let conv = o.conversazioneId ? db.conversazioni.find(x => x.id === o.conversazioneId && x.clienteId === o.clienteId) : null;
      if (!conv && o.contesto && o.contesto.id) conv = db.conversazioni.find(x => x.clienteId === o.clienteId && x.contesto && x.contesto.tipo === o.contesto.tipo && x.contesto.id === o.contesto.id);
      const ora = A.adesso();
      if (!conv) {
        conv = { id: A.uid('cnv'), clienteId: o.clienteId, oggetto: o.oggetto || taglia(o.testo, 60), contesto: o.contesto || { tipo: 'generale', id: null }, messaggi: [], lettoAzienda: false, lettoCliente: true, aggiornato: ora };
        db.conversazioni.unshift(conv);
      }
      conv.messaggi.push({ id: A.uid('msg'), da: 'cliente', autoreId: u.id, testo: o.testo, data: ora });
      conv.lettoAzienda = false; conv.lettoCliente = true; conv.aggiornato = ora;
      A.avvisa('ufficio', 'Messaggio da ' + c.nome + ': ' + taglia(o.testo, 70), '#/u/messaggi/' + conv.id, { tipo: 'messaggio' });
      A.registra('messaggio dal cliente', c.nome + ' — ' + conv.oggetto);
      id = conv.id;
    });
    return id;
  }
  function apriNuovoMessaggio(o) {
    o = o || {};
    A.modale({
      titolo: 'Nuovo messaggio', form: 'cli-msg-nuovo',
      corpo: `<p class="muto" style="margin-bottom:14px">Scrivi all'ufficio IDRAL. Ti rispondiamo qui e ti avvisiamo per email.</p>
        <div class="campo"><label for="cli-nm-ogg">Di cosa si tratta?</label><input id="cli-nm-ogg" type="text" name="oggetto" value="${h(o.oggetto || '')}" placeholder="Per esempio: domanda sulla caldaia"></div>
        <div class="campo"><label for="cli-nm-testo">Il tuo messaggio</label><textarea id="cli-nm-testo" name="testo" rows="6" placeholder="${h(o.segnaposto || 'Scrivi qui…')}"></textarea></div>
        <div id="cli-nm-err"></div>`,
      azioni: [{ testo: 'Annulla', chiudi: true }, { testo: 'Invia', classe: 'acc', tipo: 'submit', icona: 'invia' }]
    });
  }
  A.azione('cli-msg-nuovo-apri', () => apriNuovoMessaggio());
  A.azione('cli-msg-nuovo', (f, ev, d) => {
    const c = clienteAttivo();
    const testo = String(d.testo || '').trim();
    if (testo.length < 2) return erroreIn('#cli-nm-err', 'Scrivi il tuo messaggio.');
    const id = scriviAllAzienda({ clienteId: c.id, contesto: { tipo: 'generale', id: null }, oggetto: String(d.oggetto || '').trim() || taglia(testo, 60), testo });
    A.chiudiModale(); A.toast('Messaggio inviato', 'ok'); A.vai('#/c/messaggi/' + id);
  });

  function paginaMessaggi(par) {
    const lista = miei('conversazioni').sort((a, b) => String(b.aggiornato).localeCompare(String(a.aggiornato)));
    const riga = x => {
      const ult = x.messaggi[x.messaggi.length - 1] || {};
      const chi = ult.da === 'cliente' ? 'Tu' : nomeAzienda(ult);
      return `<li><a class="cli-riga${x.lettoCliente ? '' : ' nuovo'}" href="#/c/messaggi/${h(x.id)}"><span class="cli-ico${x.lettoCliente ? '' : ' acc'}">${icona('messaggio')}</span>
        <span class="cx1"><span class="t1">${h(x.oggetto)}</span><span class="t2">${h(chi)}: ${h(taglia(ult.testo, 90))}</span></span>
        <span class="dxx"><small>${h(A.quando(x.aggiornato))}</small>${x.lettoCliente ? '' : A.pastiglia('Da leggere', 'acc')}</span>${icona('destra')}</a></li>`;
    };
    return {
      html: `<div class="cli-testa-pag"><div><h1>Messaggi</h1><p class="sotto">Scrivi all'ufficio IDRAL: ti rispondiamo qui e ti avvisiamo per email.</p></div>
          <button class="btn acc g" type="button" data-az="cli-msg-nuovo-apri">${icona('penna')} Nuovo messaggio</button></div>
        ${lista.length ? `<div class="tessera"><ul class="cli-righe">${lista.map(riga).join('')}</ul></div>` : `<div class="tessera">${A.vuoto('Nessun messaggio', 'Hai una domanda? Tocca «Nuovo messaggio»: ti risponde una persona dell\'ufficio.', 'messaggio')}</div>`}`,
      dopo: () => {
        // «Scrivici» dalla home apre subito il modulo. Il segnale si toglie
        // dall'indirizzo, altrimenti ogni ridisegno lo riaprirebbe.
        if (par.q.nuovo) { history.replaceState(null, '', '#/c/messaggi'); apriNuovoMessaggio(); }
      }
    };
  }
  function nomeAzienda(m) { const a = m && m.autoreId ? A.utenteDa(m.autoreId) : null; return a && (a.ruolo === 'titolare' || a.ruolo === 'ufficio') ? a.nome.split(' ')[0] + ' · IDRAL' : 'IDRAL'; }

  function paginaConversazione(par) {
    const x0 = mio(A.trova('conversazioni', par.id));
    if (!x0) return nonTrovato();
    if (!x0.lettoCliente) A.modifica(db => { const y = db.conversazioni.find(k => k.id === x0.id); if (y) y.lettoCliente = true; });
    segnaLetti(a => a.tipo === 'messaggio' && a.a === 'cliente:' + x0.clienteId && (a.link === '#/c/messaggi' || a.link === '#/c/messaggi/' + x0.id));
    const x = A.trova('conversazioni', x0.id);
    let ultimoGiorno = '';
    const bolle = x.messaggi.map(m => {
      const g = giorno10(A.isoGiorno(new Date(m.data)));
      const sep = g !== ultimoGiorno ? `<span class="cli-giorno">${h(giornoUmano(g))}${Math.abs(A.diffGiorni(A.oggi(), g)) > 1 ? ' ' + new Date(m.data).getFullYear() : ''}</span>` : '';
      ultimoGiorno = g;
      const mia = m.da === 'cliente';
      return sep + `<div class="bolla${mia ? ' mia' : ''}"><span class="chi">${mia ? (m.autoreId && m.autoreId !== A.utente().id ? h((A.utenteDa(m.autoreId) || {}).nome || 'Tu') : 'Tu') : h(nomeAzienda(m))}</span>${h(m.testo)}<span class="md">${A.ora(m.data)}</span></div>`;
    }).join('');
    let ctx = '';
    if (x.contesto && x.contesto.tipo === 'preventivo') { const p = A.preventivo(x.contesto.id); if (p && p.clienteId === x.clienteId && prvVisibile(p)) ctx = `<p class="cli-contesto">${icona('documento')} Riguarda il <a href="#/c/preventivo/${h(p.id)}">preventivo N. ${h(p.numero)}</a></p>`; }
    if (x.contesto && x.contesto.tipo === 'intervento') { const i = A.intervento(x.contesto.id); if (i && i.clienteId === x.clienteId) ctx = `<p class="cli-contesto">${icona('chiave')} Riguarda l'<a href="#/c/intervento/${h(i.id)}">intervento${i.data ? ' del ' + A.data(i.data) : ''}</a></p>`; }
    return {
      html: `<a class="cli-indietro" href="#/c/messaggi">${icona('indietro')} Tutti i messaggi</a>
        <h1 style="margin-bottom:8px">${h(x.oggetto)}</h1>${ctx}
        <div class="tessera cli-chat">
          <div class="chat" id="cli-chat">${bolle || '<p class="muto">Ancora nessun messaggio.</p>'}</div>
          <form class="scrivi" data-form="cli-msg-invia" novalidate><input type="hidden" name="cid" value="${h(x.id)}">
            <label class="sr" for="cli-msg-testo">Scrivi una risposta</label>
            <textarea id="cli-msg-testo" name="testo" rows="2" placeholder="Scrivi qui la tua risposta…"></textarea>
            <button class="btn acc" type="submit">${icona('invia')} Invia</button></form>
        </div>`,
      dopo: () => { const ch = A.$('#cli-chat'); if (ch) ch.scrollTop = ch.scrollHeight; }
    };
  }
  A.azione('cli-msg-invia', (f, ev, d) => {
    const x = mio(A.trova('conversazioni', d.cid)); if (!x) return;
    const testo = String(d.testo || '').trim();
    if (!testo) return A.toast('Scrivi il messaggio prima di inviarlo', 'warn');
    scriviAllAzienda({ clienteId: x.clienteId, conversazioneId: x.id, testo });
    A.toast('Messaggio inviato', 'ok');
    A.render();
    const t = A.$('#cli-msg-testo'); if (t) t.value = '';
  });

  // ===========================================================================
  // PROFILO
  // ===========================================================================
  function paginaProfilo() {
    const u = A.utente(), c = clienteAttivo();
    const sedi = A.sediDi(c.id);
    const TIPO = { privato: 'Privato', condominio: 'Condominio', azienda: 'Azienda' };
    return `<h1>Il tuo profilo</h1>
      <p class="sotto">I tuoi dati di accesso e come preferisci essere avvisato.</p>
      <div class="cli-profilo">
        <div>
          <form class="tessera" data-form="cli-profilo-salva" novalidate><div class="tt"><h2>${icona('utente')} I tuoi dati</h2></div><div class="cp">
            <div class="campo"><label for="cli-pr-nome">Nome</label><input id="cli-pr-nome" type="text" value="${h(u.nome)}" readonly></div>
            <div class="campo"><label for="cli-pr-email">Email</label><input id="cli-pr-email" type="email" value="${h(u.email || '')}" readonly><span class="aiuto">È l'indirizzo con cui entri. Per cambiarlo scrivici.</span></div>
            <div class="campo"><label for="cli-pr-tel">Telefono</label><input id="cli-pr-tel" type="tel" name="telefono" value="${h(u.telefono || '')}" autocomplete="tel" inputmode="tel"><span class="aiuto">Lo usiamo per chiamarti quando fissiamo un intervento.</span></div>
            <label class="spunta cli-spunta-g"><input type="checkbox" name="avvisiEmail"${!u.preferenze || u.preferenze.email !== false ? ' checked' : ''}><span>Avvisami anche per email<br><small class="muto">Nuovi preventivi, rapportini pronti, risposte ai messaggi.</small></span></label>
            <button class="btn pri g largo" type="submit" style="margin-top:14px">${icona('spunta')} Salva</button>
          </div></form>
          <form class="tessera" data-form="cli-password" novalidate><div class="tt"><h2>${icona('lucchetto')} Password</h2><span class="pastiglia grigio nopunto">facoltativa</span></div><div class="cp">
            <p style="margin-bottom:14px;color:var(--ink-2)">Non è obbligatoria: puoi sempre entrare con il link che ti mandiamo via email. Se preferisci, puoi ${u.password ? 'cambiarla' : 'impostarne una'} qui.</p>
            <input type="text" name="utente" value="${h(u.email || '')}" autocomplete="username" hidden>
            <div class="campo"><label for="cli-pw1">${u.password ? 'Nuova password' : 'Password'}</label><input id="cli-pw1" type="password" name="pw1" autocomplete="new-password"><span class="aiuto">Almeno 8 caratteri.</span></div>
            <div class="campo"><label for="cli-pw2">Scrivila di nuovo</label><input id="cli-pw2" type="password" name="pw2" autocomplete="new-password"></div>
            <div id="cli-pw-err"></div>
            <button class="btn g largo" type="submit" style="margin-top:6px">${u.password ? 'Cambia la password' : 'Imposta la password'}</button>
          </div></form>
        </div>
        <div>
          <section class="tessera"><div class="tt"><h2>${icona(c.tipo === 'privato' ? 'casa' : 'edificio')} ${idsMiei().length > 1 ? 'Il cliente che stai guardando' : 'I dati del cliente'}</h2></div><div class="cp">
            <dl class="dl">
              <dt>Nome</dt><dd>${h(c.nome)}</dd>
              <dt>Tipo</dt><dd>${h(TIPO[c.tipo] || c.tipo)}</dd>
              ${c.referente ? `<dt>Referente</dt><dd>${h(c.referente)}</dd>` : ''}
              ${c.piva ? `<dt>Partita IVA</dt><dd class="mono">${h(c.piva)}</dd>` : ''}
              ${c.cf ? `<dt>Codice fiscale</dt><dd class="mono">${h(c.cf)}</dd>` : ''}
              ${c.email ? `<dt>Email</dt><dd>${h(c.email)}</dd>` : ''}
              ${c.telefono ? `<dt>Telefono</dt><dd>${h(c.telefono)}</dd>` : ''}
              ${sedi.map((s, k) => `<dt>${sedi.length > 1 ? 'Sede ' + (k + 1) : 'Indirizzo'}</dt><dd>${h(A.indirizzo(s))}${s.cap ? ' (' + h(s.cap) + ')' : ''}</dd>`).join('')}
            </dl>
            <div class="avviso" style="margin-top:16px">${icona('info')}<div>Questi dati li tiene aggiornati l'ufficio. Se qualcosa non va, <a href="#" data-az="cli-cambia-dati">scrivici</a> e li correggiamo.</div></div>
          </div></section>
          <section class="tessera"><div class="cp">
            <p style="margin-bottom:12px;color:var(--ink-2)">Hai finito? Se il computer non è tuo, esci sempre.</p>
            <button class="btn per g largo" type="button" data-az="cli-esci">${icona('esci')} Esci dall'area clienti</button>
          </div></section>
        </div>
      </div>`;
  }
  A.azione('cli-profilo-salva', (f, ev, d) => {
    const u = A.utente();
    const tel = String(d.telefono || '').trim();
    A.modifica(db => {
      const x = db.utenti.find(y => y.id === u.id);
      x.telefono = tel;
      x.preferenze = Object.assign({}, x.preferenze, { email: !!d.avvisiEmail });
      A.registra('profilo aggiornato dal cliente', x.nome);
    });
    A.toast('Dati salvati', 'ok'); A.render();
  });
  A.azione('cli-password', (f, ev, d) => {
    const p1 = String(d.pw1 || ''), p2 = String(d.pw2 || '');
    if (p1.length < 8) return erroreIn('#cli-pw-err', 'La password deve avere almeno 8 caratteri.');
    if (p1 !== p2) return erroreIn('#cli-pw-err', 'Le due password non sono uguali: riscrivile.');
    const u = A.utente();
    // Nel registro va il fatto, mai la password.
    A.modifica(db => { const x = db.utenti.find(y => y.id === u.id); x.password = p1; A.registra('password impostata dal cliente', x.nome); });
    A.toast('Password salvata', 'ok'); A.render();
  });
  A.azione('cli-cambia-dati', () => apriNuovoMessaggio({ oggetto: 'Aggiornamento dei dati', segnaposto: 'Per esempio: il nuovo numero di telefono è…' }));

  // ===========================================================================
  // AZIONI DEL GUSCIO
  // ===========================================================================
  A.azione('cli-cambia-cliente', el => {
    if (!impostaAttivo(el.value)) return A.render();
    const c = A.cliente(el.value);
    A.toast('Ora stai guardando: ' + c.nome, 'ok');
    // Una pagina di dettaglio riguarda il cliente di prima: si torna al suo
    // elenco. Anche i filtri (una macchina, una sede) erano del cliente di prima.
    const perc = location.hash.split('?')[0];
    const m = perc.match(/^#\/c\/(preventivo|intervento|rapportino|messaggi|stampa\/preventivo|stampa\/rapporto)\/[^/]+$/);
    const lista = m ? { preventivo: '#/c/preventivi', intervento: '#/c/interventi', rapportino: '#/c/interventi', messaggi: '#/c/messaggi', 'stampa/preventivo': '#/c/preventivi', 'stampa/rapporto': '#/c/interventi' }[m[1]] : perc;
    A.vai(lista);
  });
  A.azione('cli-passa', el => {
    if (!impostaAttivo(el.dataset.id)) return;
    A.toast('Ora stai guardando: ' + A.cliente(el.dataset.id).nome, 'ok');
    A.vai('#/c/home');
  });
  A.azione('cli-avviso', el => {
    const a = A.mieiAvvisi().find(x => x.id === el.dataset.id);
    if (!a) return;
    A.modifica(db => { const x = db.avvisi.find(y => y.id === a.id); if (x) x.letto = true; });
    // Solo link dell'area clienti: un avviso non deve poter portare altrove.
    if (a.link && a.link.indexOf('#/c/') === 0) A.vai(a.link); else A.render();
  });
  A.azione('cli-esci', () => {
    try {
      sessionStorage.removeItem(CHIAVE_ATTIVO);
      Object.keys(sessionStorage).filter(k => k.indexOf(PREF_CARRELLO) === 0).forEach(k => sessionStorage.removeItem(k));
    } catch (_) { }
    // Sul computer di casa o dello studio dopo di te entra qualcun altro: via
    // anche i messaggi a comparsa, che possono ancora nominare il tuo condominio.
    const t = A.$('#toast'); if (t) t.innerHTML = '';
    fotoRichiesta = []; cercaArt = ''; catAperte = null; moduloOrdine = { consegna: 'ritiro', sedeId: '', note: '' }; accInCorso = null;
    A.esci();
  });

  // ===========================================================================
  // ROTTE
  // ===========================================================================
  rottaCliente('#/c/home', 'home', paginaHome);
  rottaCliente('#/c/preventivi', 'preventivi', paginaPreventivi);
  rottaCliente('#/c/preventivo/:id', 'preventivi', paginaPreventivo);
  rottaCliente('#/c/stampa/preventivo/:id', 'preventivi', paginaStampaPreventivo);
  rottaCliente('#/c/interventi', 'interventi', paginaInterventi);
  rottaCliente('#/c/intervento/:id', 'interventi', paginaIntervento);
  rottaCliente('#/c/rapportino/:id', 'interventi', paginaIntervento);
  rottaCliente('#/c/stampa/rapporto/:id', 'interventi', paginaStampaRapporto);
  rottaCliente('#/c/documenti', 'documenti', paginaDocumenti);
  rottaCliente('#/c/impianti', 'impianti', paginaImpianti);
  rottaCliente('#/c/richiedi', 'richiedi', paginaRichiedi);
  rottaCliente('#/c/ordina', 'ordina', paginaOrdina);
  rottaCliente('#/c/ordini', 'ordina', paginaOrdina);
  rottaCliente('#/c/messaggi', 'messaggi', paginaMessaggi);
  rottaCliente('#/c/messaggi/:id', 'messaggi', paginaConversazione);
  rottaCliente('#/c/profilo', 'profilo', paginaProfilo);
})();
