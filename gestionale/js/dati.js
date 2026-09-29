/* =============================================================================
   IDRAL — gestionale (demo) · i dati di prova
   -----------------------------------------------------------------------------
   Nomi, macchine e indirizzi sono quelli del prototipo del 20/08/2026, che
   Andrea ha gia' visto: cambiarli adesso gli farebbe perdere il filo.
   Le date sono calcolate sul giorno in cui si apre la demo, cosi' «oggi» ha
   sempre dei lavori, e il cruscotto ha sempre tre mesi di storia dietro.
   ⚠️ Prezzi e tariffe sono DI ESEMPIO (38 €/h, uscita 25 €): vanno sostituiti
   con il listino vero di IDRAL prima di mostrarli come «suoi».
   ============================================================================= */
(function () {
  'use strict';

  // Generatore pseudo-casuale con seme fisso: la demo e' uguale per tutti e a
  // ogni azzeramento, cosi' quello che si racconta in riunione non cambia.
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  window.SEME = function () {
    const rnd = mulberry32(20260918);
    const pesca = arr => arr[Math.floor(rnd() * arr.length)];
    const tra = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const pad = n => String(n).padStart(2, '0');
    const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const OGGI = new Date(); OGGI.setHours(0, 0, 0, 0);
    const giorno = n => { const d = new Date(OGGI); d.setDate(d.getDate() + n); return iso(d); };
    const istante = (n, hh, mm) => { const d = new Date(OGGI); d.setDate(d.getDate() + n); d.setHours(hh, mm || 0, 0, 0); return d.toISOString(); };
    const dow = n => { const d = new Date(OGGI); d.setDate(d.getDate() + n); return d.getDay(); };
    let seq = 0; const id = p => p + '_' + (++seq).toString(36).padStart(4, '0');
    const ANNO = OGGI.getFullYear();

    // Firma disegnata a mano (vettoriale, piccola): serve solo a far vedere com'e'.
    const firmaSvg = (nome) => {
      const n = (nome || 'x').length;
      const d = 'M12 58 C 28 12, 40 88, 58 44 S 82 22, 96 52 S 122 70, 136 36 C 146 20, 158 64, 176 46 S ' + (190 + n) + ' 30, ' + (214 + n) + ' 50';
      return 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 90"><path d="' + d + '" fill="none" stroke="#0A2A3D" stroke-width="3" stroke-linecap="round"/></svg>');
    };
    // «Foto» di prova: un riquadro con scritto cosa rappresenta. Le foto vere le
    // scatta il tecnico dall'app.
    const fotoProva = (titolo, tono) => {
      const c = tono === 'caldo' ? ['#6B3A12', '#9A5210'] : tono === 'chiaro' ? ['#C3D8E4', '#E7EFF4'] : ['#0B3D57', '#1687AE'];
      const fg = tono === 'chiaro' ? '#0A4A6B' : '#ffffff';
      return 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c[0] + '"/><stop offset="1" stop-color="' + c[1] + '"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/><path d="M200 120c0 0-52 62-52 96 0 29 23 52 52 52s52-23 52-52c0-34-52-96-52-96z" fill="' + fg + '" opacity=".22"/><text x="200" y="330" font-family="system-ui,sans-serif" font-size="22" font-weight="700" fill="' + fg + '" text-anchor="middle" opacity=".85">' + titolo + '</text><text x="200" y="358" font-family="system-ui,sans-serif" font-size="14" fill="' + fg + '" text-anchor="middle" opacity=".55">foto di prova</text></svg>');
    };

    // ------------------------------------------------------------------ persone
    const U = {
      andrea: { id: 'u_andrea', ruolo: 'titolare', nome: 'Andrea Albino', email: 'andrea@idral.it', telefono: '', password: 'idral2026', attivo: true },
      laura: { id: 'u_laura', ruolo: 'ufficio', nome: 'Laura Ferrante', email: 'ufficio@idral.it', telefono: '', password: 'ufficio2026', attivo: true },
      marco: { id: 'u_marco', ruolo: 'tecnico', nome: 'Marco Sciarrone', email: '', telefono: '333 100 0001', password: 'marco2026', squadra: 'Squadra 1', colore: '#127EA3', attivo: true },
      nino: { id: 'u_nino', ruolo: 'tecnico', nome: 'Nino Vaccaro', email: '', telefono: '333 100 0002', password: 'nino2026', squadra: 'Squadra 2', colore: '#EA6A0C', attivo: true },
      giuseppe: { id: 'u_giuseppe', ruolo: 'tecnico', nome: 'Giuseppe Randazzo', email: '', telefono: '333 100 0003', password: 'giuseppe2026', squadra: 'Squadra 3', colore: '#15704A', attivo: true },
      salvo: { id: 'u_salvo', ruolo: 'tecnico', nome: 'Salvo Cannata', email: '', telefono: '333 100 0004', password: 'salvo2026', squadra: 'Squadra 4', colore: '#7B4FB5', attivo: true }
    };
    const TEC = [U.marco, U.nino, U.giuseppe, U.salvo];

    // ------------------------------------------------------------------ clienti
    const clienti = [], sedi = [], impianti = [];
    function nuovoCliente(o, sediDef) {
      const c = Object.assign({ id: id('cli'), tipo: 'privato', referente: '', cf: '', piva: '', sdi: '', pec: '', email: '', telefono: '', listino: 'base', sconto: 0, note: '', tag: [], portale: false, creato: istante(-400 + tra(0, 300), 10) }, o);
      clienti.push(c);
      (sediDef || []).forEach((s, i) => sedi.push(Object.assign({ id: id('sed'), clienteId: c.id, nome: i === 0 ? 'Sede principale' : 'Sede ' + (i + 1), citta: 'Palermo', cap: '', noteAccesso: '', referente: '', telefono: '' }, s)));
      return c;
    }
    const C = {};
    C.sciuti = nuovoCliente({ tipo: 'condominio', nome: 'Condominio Via Sciuti 88', referente: 'Salvatore Puglisi (amministratore)', cf: '97012340825', email: 's.puglisi@example.com', telefono: '091 000 1101', listino: 'condomini', sconto: 5, tag: ['contratto', 'centrale termica'], portale: true, note: 'Contratto di manutenzione annuale. Chiavi della centrale termica dal portiere.' },
      [{ nome: 'Centrale termica', indirizzo: 'Via Sciuti 88', cap: '90144', lat: 38.1336, lng: 13.3441, noteAccesso: 'Citofono 3B, portiere 7-13. Centrale termica interrata: niente campo, scaricare i lavori prima di scendere.', referente: 'Portiere — Sig. Lo Presti', telefono: '091 000 1102' }]);
    C.notarbartolo = nuovoCliente({ tipo: 'condominio', nome: 'Condominio Notarbartolo 12', referente: 'Salvatore Puglisi (amministratore)', cf: '97033210827', email: 's.puglisi@example.com', telefono: '091 000 1101', listino: 'condomini', sconto: 5, tag: ['contratto'], portale: true },
      [{ indirizzo: 'Via Notarbartolo 12', cap: '90141', lat: 38.1289, lng: 13.3478, noteAccesso: 'Locale caldaia sul terrazzo, chiave in portineria.' }]);
    C.bar = nuovoCliente({ tipo: 'azienda', nome: 'Bar Centrale', referente: 'Giovanni Russo', piva: '06123450827', sdi: 'M5UXCR1', email: 'bar.centrale@example.com', telefono: '091 000 2201', listino: 'aziende', portale: true, tag: ['bar'] },
      [{ indirizzo: 'Piazza Marina 8', cap: '90133', lat: 38.1167, lng: 13.3702, noteAccesso: 'Entrare dal retro (Via Merlo) prima delle 7:30.' }]);
    C.ingrassia = nuovoCliente({ tipo: 'azienda', nome: 'Panificio Ingrassia', referente: 'Rosa Ingrassia', piva: '05987650823', sdi: 'KRRH6B9', email: 'panificio.ingrassia@example.com', telefono: '091 000 2301', listino: 'aziende' },
      [{ indirizzo: 'Via Oreto 210', cap: '90127', lat: 38.1031, lng: 13.3622, noteAccesso: 'Laboratorio attivo di notte: venire dopo le 10.' }]);
    C.battaglia = nuovoCliente({ nome: 'Rosario Battaglia', cf: 'BTTRSR61A01G273X', email: 'r.battaglia@example.com', telefono: '333 000 3301' },
      [{ indirizzo: 'Via Notarbartolo 55', cap: '90145', lat: 38.1276, lng: 13.3462, noteAccesso: '4° piano, ascensore.' }]);
    C.trapani = nuovoCliente({ nome: 'Giuseppina Trapani', cf: 'TRPGPP52C41G273Y', email: 'g.trapani@example.com', telefono: '333 000 3401', portale: true, note: 'Preferisce essere chiamata dalla figlia (Anna, 333 000 3402).' },
      [{ indirizzo: 'Via Alcide De Gasperi 12', cap: '90146', lat: 38.1498, lng: 13.3374, noteAccesso: 'Villetta, cancello verde. Cane nel giardino (tranquillo).' }]);
    C.locascio = nuovoCliente({ tipo: 'azienda', nome: 'Studio Dentistico Lo Cascio', referente: 'Dott. Filippo Lo Cascio', piva: '04455660829', sdi: 'USAL8PV', email: 'studio.locascio@example.com', telefono: '091 000 2401', listino: 'aziende' },
      [{ indirizzo: 'Via Libertà 128', cap: '90143', lat: 38.1331, lng: 13.3486, noteAccesso: 'Studio aperto 9-19. Lavori rumorosi solo in pausa pranzo.' }]);
    C.aragona = nuovoCliente({ tipo: 'azienda', nome: 'Hotel Palazzo Aragona', referente: 'Ing. Marta Di Stefano (manutenzione)', piva: '03322110826', sdi: 'T04ZHR3', email: 'manutenzione.aragona@example.com', telefono: '091 000 2501', listino: 'aziende', sconto: 3, tag: ['hotel', 'contratto'] },
      [{ indirizzo: 'Via Roma 190', cap: '90133', lat: 38.1193, lng: 13.3627, noteAccesso: 'Ingresso fornitori da Via Venezia. Chiedere di Marta.' }]);
    C.molo = nuovoCliente({ tipo: 'azienda', nome: 'Ristorante Al Molo', referente: 'Ciccio Ferrara', piva: '06677880824', email: 'almolo@example.com', telefono: '091 000 2601', listino: 'aziende' },
      [{ indirizzo: 'Via Cristoforo Colombo 12', cap: '90142', lat: 38.1496, lng: 13.3738 }]);
    C.cusmano = nuovoCliente({ tipo: 'azienda', nome: 'Farmacia Cusmano', referente: 'Dott.ssa Elena Cusmano', piva: '05544330821', email: 'farmacia.cusmano@example.com', telefono: '091 000 2701', listino: 'aziende' },
      [{ indirizzo: 'Via Maqueda 300', cap: '90134', lat: 38.1152, lng: 13.3612 }]);
    C.serena = nuovoCliente({ nome: 'Villa Serena — Fam. Mangano', cf: 'MNGPLA70B12G273Z', email: 'p.mangano@example.com', telefono: '333 000 3501' },
      [{ indirizzo: 'Viale Regina Elena 40', citta: 'Mondello (PA)', cap: '90151', lat: 38.1985, lng: 13.3302, noteAccesso: 'Casa estiva, chiavi dal vicino (Sig. Caruso) da ottobre a maggio.' }]);
    C.settimo = nuovoCliente({ tipo: 'condominio', nome: 'Condominio Ruggero Settimo 21', referente: 'Studio Amministrazioni Lipari', cf: '97055440821', email: 'amministrazioni.lipari@example.com', telefono: '091 000 1201', listino: 'condomini' },
      [{ indirizzo: 'Via Ruggero Settimo 21', cap: '90139', lat: 38.1224, lng: 13.3571 }]);
    C.crocerossa = nuovoCliente({ tipo: 'condominio', nome: 'Condominio Croce Rossa 40', referente: 'Studio Amministrazioni Lipari', cf: '97066550829', email: 'amministrazioni.lipari@example.com', telefono: '091 000 1201', listino: 'condomini' },
      [{ indirizzo: 'Via Croce Rossa 40', cap: '90144', lat: 38.1372, lng: 13.3455 }]);
    C.ugo = nuovoCliente({ tipo: 'condominio', nome: 'Condominio Marchese Ugo 10', referente: 'Salvatore Puglisi (amministratore)', cf: '97077660820', email: 's.puglisi@example.com', telefono: '091 000 1101', listino: 'condomini', sconto: 5 },
      [{ indirizzo: 'Via Marchese Ugo 10', cap: '90141', lat: 38.1263, lng: 13.3529 }]);
    C.cracolici = nuovoCliente({ nome: 'Maria Cracolici', cf: 'CRCMRA58D45G273W', email: 'm.cracolici@example.com', telefono: '333 000 3601' },
      [{ indirizzo: 'Via Leonardo da Vinci 150', cap: '90145', lat: 38.1178, lng: 13.3189 }]);
    C.alagna = nuovoCliente({ nome: 'Vincenzo Alagna', cf: 'LGNVCN66E10G273V', email: 'v.alagna@example.com', telefono: '333 000 3701' },
      [{ indirizzo: 'Corso Calatafimi 400', cap: '90129', lat: 38.1029, lng: 13.3311 }]);
    const sedeDi = c => sedi.find(s => s.clienteId === c.id);

    // ------------------------------------------------------------------ macchine
    function nuovoImpianto(c, o) {
      const i = Object.assign({ id: id('imp'), clienteId: c.id, sedeId: sedeDi(c).id, categoria: 'caldaia', marca: '', modello: '', matricola: '', potenzaKw: '', combustibile: 'metano', installato: '', garanziaFino: '', ultimaManutenzione: '', prossimaManutenzione: '', intervalloMesi: 12, libretto: true, note: '' }, o);
      impianti.push(i); return i;
    }
    const I = {};
    I.sciuti = nuovoImpianto(C.sciuti, { categoria: 'caldaia', marca: 'Ferroli', modello: 'Prextherm RSW 300', matricola: 'FE-2017-009134', potenzaKw: 300, installato: '2017-10-12', ultimaManutenzione: giorno(-340), prossimaManutenzione: giorno(12), note: 'Centrale termica condominiale, 24 unità.' });
    I.sciutiAddolc = nuovoImpianto(C.sciuti, { categoria: 'trattamento acqua', marca: 'Cillit', modello: 'Bio-Protect addolcitore', matricola: 'AL-2019-22841', combustibile: '', installato: '2019-03-02', ultimaManutenzione: giorno(-170), prossimaManutenzione: giorno(8), intervalloMesi: 6, libretto: false });
    I.sciutiPompa = nuovoImpianto(C.sciuti, { categoria: 'circolatore', marca: 'Wilo', modello: 'Yonos PARA 25/6', matricola: 'WI-2021-117733', combustibile: '', installato: '2021-11-20', intervalloMesi: 0, libretto: false });
    I.notar = nuovoImpianto(C.notarbartolo, { marca: 'Baxi', modello: 'Luna Duo-tec MP 1.110', matricola: 'BX-2020-551208', potenzaKw: 110, installato: '2020-09-15', ultimaManutenzione: giorno(-355), prossimaManutenzione: giorno(10) });
    I.bar = nuovoImpianto(C.bar, { categoria: 'scaldabagno', marca: 'Ariston', modello: 'Next Evo X 16 lt', matricola: 'AR-2023-771204', installato: '2023-04-18', garanziaFino: giorno(200), ultimaManutenzione: giorno(-300), prossimaManutenzione: giorno(65) });
    I.ingrassia = nuovoImpianto(C.ingrassia, { marca: 'Immergas', modello: 'Victrix Tera 32', matricola: 'IM-2019-338812', potenzaKw: 32, installato: '2019-06-10', ultimaManutenzione: giorno(-372), prossimaManutenzione: giorno(-7) });
    I.battaglia = nuovoImpianto(C.battaglia, { marca: 'Vaillant', modello: 'ecoTEC pure VMW 236', matricola: 'VA-2016-210044', potenzaKw: 23, installato: '2016-01-20', ultimaManutenzione: giorno(-380), prossimaManutenzione: giorno(-15), note: 'Macchina di 10 anni: valutare sostituzione.' });
    I.trapani = nuovoImpianto(C.trapani, { marca: 'Vaillant', modello: 'ecoTEC plus VMW 246', matricola: 'VA-2021-884501', potenzaKw: 24, installato: '2021-10-05', garanziaFino: giorno(380), ultimaManutenzione: giorno(-360), prossimaManutenzione: giorno(0) });
    I.locascio = nuovoImpianto(C.locascio, { categoria: 'trattamento acqua', marca: 'Cillit', modello: 'Bio-Protect', matricola: 'CI-2022-100731', combustibile: '', installato: '2022-02-14', ultimaManutenzione: giorno(-175), prossimaManutenzione: giorno(5), intervalloMesi: 6, libretto: false });
    I.locascioPdc = nuovoImpianto(C.locascio, { categoria: 'pompa di calore', marca: 'Daikin', modello: 'Altherma 3 R 8 kW', matricola: 'DA-2022-455120', potenzaKw: 8, combustibile: 'elettrico', installato: '2022-05-20', ultimaManutenzione: giorno(-330), prossimaManutenzione: giorno(35) });
    I.aragona = nuovoImpianto(C.aragona, { marca: 'Riello', modello: 'RS 34 MZ (bruciatore)', matricola: 'RI-2018-000912', potenzaKw: 340, installato: '2018-02-01', ultimaManutenzione: giorno(-160), prossimaManutenzione: giorno(20), intervalloMesi: 6 });
    I.aragonaVaso = nuovoImpianto(C.aragona, { categoria: 'vaso di espansione', marca: 'Zilmet', modello: 'Ultra-Pro 200 lt', matricola: 'ZI-2018-44021', combustibile: '', installato: '2018-02-01', intervalloMesi: 0, libretto: false, note: 'Precarica da verificare: perde pressione.' });
    I.molo = nuovoImpianto(C.molo, { categoria: 'scaldabagno', marca: 'Ariston', modello: 'Velis Evo 80', matricola: 'AR-2020-661029', combustibile: 'elettrico', installato: '2020-05-11', ultimaManutenzione: giorno(-400), prossimaManutenzione: giorno(-35) });
    I.cusmano = nuovoImpianto(C.cusmano, { categoria: 'climatizzatore', marca: 'Mitsubishi', modello: 'MSZ-LN35 dual split', matricola: 'MI-2021-80011', combustibile: 'elettrico', installato: '2021-06-01', ultimaManutenzione: giorno(-320), prossimaManutenzione: giorno(45) });
    I.serena = nuovoImpianto(C.serena, { marca: 'Immergas', modello: 'Victrix Exa 24', matricola: 'IM-2018-220190', potenzaKw: 24, installato: '2018-09-09', ultimaManutenzione: giorno(-345), prossimaManutenzione: giorno(20) });
    I.settimo = nuovoImpianto(C.settimo, { marca: 'Riello', modello: 'Condexa PRO 115', matricola: 'RI-2020-310988', potenzaKw: 115, installato: '2020-10-01', ultimaManutenzione: giorno(-350), prossimaManutenzione: giorno(15) });
    I.crocerossa = nuovoImpianto(C.crocerossa, { marca: 'Viessmann', modello: 'Vitodens 200-W 80', matricola: 'VI-2019-771400', potenzaKw: 80, installato: '2019-10-20', ultimaManutenzione: giorno(-330), prossimaManutenzione: giorno(30) });
    I.ugo = nuovoImpianto(C.ugo, { marca: 'Baxi', modello: 'Power HT+ 1.650', matricola: 'BX-2017-903311', potenzaKw: 65, installato: '2017-11-02', ultimaManutenzione: giorno(-340), prossimaManutenzione: giorno(25) });
    I.cracolici = nuovoImpianto(C.cracolici, { marca: 'Ariston', modello: 'Clas One 24', matricola: 'AR-2022-004188', potenzaKw: 24, installato: '2022-12-01', garanziaFino: giorno(60), ultimaManutenzione: giorno(-300), prossimaManutenzione: giorno(58) });
    I.alagna = nuovoImpianto(C.alagna, { marca: 'Beretta', modello: 'Mynute Green 25 C', matricola: 'BE-2015-66201', potenzaKw: 25, installato: '2015-03-15', ultimaManutenzione: giorno(-500), prossimaManutenzione: giorno(-130) });

    // ------------------------------------------------------------------ articoli
    // [codice, nome, marca, unita, costo, prezzo, scorta minima, categoria, «dei soliti» per i tecnici]
    const A0 = [
      ['R554X-16', 'Raccordo a pressare 16x1/2" M', 'Giacomini', 'pz', 2.10, 4.90, 40, 'Raccorderia', 1],
      ['R554X-20', 'Raccordo a pressare 20x3/4" M', 'Giacomini', 'pz', 2.80, 6.20, 30, 'Raccorderia', 1],
      ['R999-16', 'Gomito a pressare 16x16', 'Giacomini', 'pz', 2.40, 5.30, 40, 'Raccorderia', 1],
      ['MST-16', 'Tubo multistrato 16x2', 'Giacomini', 'm', 1.15, 2.90, 100, 'Tubi', 1],
      ['MST-20', 'Tubo multistrato 20x2', 'Giacomini', 'm', 1.65, 3.90, 60, 'Tubi', 0],
      ['PPR-25', 'Tubo PP-R 25 mm', 'Aquatherm', 'm', 1.40, 3.20, 40, 'Tubi', 0],
      ['311430', 'Valvola di sicurezza 3 bar 1/2"', 'Caleffi', 'pz', 9.80, 19.50, 10, 'Valvolame', 1],
      ['5024', 'Rubinetto a sfera 1/2" F-F', 'Caleffi', 'pz', 6.20, 12.80, 15, 'Valvolame', 1],
      ['3383', 'Riduttore di pressione 1/2"', 'Caleffi', 'pz', 28.00, 54.00, 4, 'Valvolame', 0],
      ['545005', 'Defangatore magnetico DIRTMAG 3/4"', 'Caleffi', 'pz', 62.00, 118.00, 3, 'Trattamento acqua', 0],
      ['X100-1L', 'Inibitore Sentinel X100', 'Sentinel', 'lt', 14.50, 29.00, 10, 'Trattamento acqua', 1],
      ['X400-1L', 'Risanante Sentinel X400', 'Sentinel', 'lt', 18.00, 36.00, 6, 'Trattamento acqua', 0],
      ['OR-24x3', 'Guarnizione OR 24x3 EPDM', 'generica', 'pz', 0.35, 1.20, 50, 'Minuteria', 1],
      ['GUAR-KIT', 'Kit guarnizioni caldaia assortite', 'generica', 'kit', 6.50, 15.00, 6, 'Minuteria', 1],
      ['TEF-12', 'Nastro PTFE 12 mm', 'generica', 'pz', 0.60, 1.80, 30, 'Minuteria', 1],
      ['CAN-100', 'Canapa per raccordi 100 g', 'generica', 'pz', 2.20, 4.50, 10, 'Minuteria', 0],
      ['FLEX-30', 'Flessibile inox 1/2" F-F 30 cm', 'generica', 'pz', 3.10, 7.50, 20, 'Minuteria', 1],
      ['SIF-40', 'Sifone lavabo 1"1/4', 'generica', 'pz', 4.80, 11.00, 8, 'Sanitari', 0],
      ['ZIL-18', 'Vaso di espansione 18 lt riscaldamento', 'Zilmet', 'pz', 32.00, 64.00, 3, 'Riscaldamento', 0],
      ['ZIL-200', 'Vaso di espansione 200 lt Ultra-Pro', 'Zilmet', 'pz', 270.00, 540.00, 0, 'Riscaldamento', 0],
      ['WILO-25', 'Circolatore Yonos PARA 25/6', 'Wilo', 'pz', 118.00, 210.00, 2, 'Riscaldamento', 0],
      ['TV-12', 'Valvola termostatica 1/2" con testa', 'Caleffi', 'pz', 17.00, 34.00, 10, 'Riscaldamento', 0],
      ['SFI-1/2', 'Valvola sfiato automatica 3/8"', 'Caleffi', 'pz', 5.10, 11.50, 12, 'Riscaldamento', 1],
      ['TERM-WIFI', 'Termostato ambiente WiFi', 'BTicino', 'pz', 78.00, 149.00, 2, 'Riscaldamento', 0],
      ['SCH-VAIL', 'Scheda elettronica caldaia (ricambio)', 'Vaillant', 'pz', 165.00, 295.00, 1, 'Ricambi caldaia', 0],
      ['ELT-ACC', 'Elettrodo di accensione/rilevazione', 'generica', 'pz', 14.00, 32.00, 6, 'Ricambi caldaia', 1],
      ['SCAMB-SEC', 'Scambiatore sanitario a piastre', 'generica', 'pz', 58.00, 115.00, 2, 'Ricambi caldaia', 0],
      ['VAIL-VMW246', 'Caldaia a condensazione ecoTEC plus VMW 246', 'Vaillant', 'pz', 1180.00, 1650.00, 0, 'Caldaie', 0],
      ['IMM-TERA32', 'Caldaia a condensazione Victrix Tera 32', 'Immergas', 'pz', 1240.00, 1790.00, 0, 'Caldaie', 0],
      ['BAXI-DT28', 'Caldaia a condensazione Luna Duo-tec E 28', 'Baxi', 'pz', 1090.00, 1540.00, 0, 'Caldaie', 0],
      ['KIT-FUMI', 'Kit scarico fumi coassiale 60/100', 'generica', 'pz', 48.00, 96.00, 2, 'Caldaie', 0],
      ['ARI-VELIS80', 'Scaldabagno elettrico Velis Evo 80 lt', 'Ariston', 'pz', 310.00, 480.00, 1, 'Scaldabagni', 0],
      ['CILLIT-SALE', 'Sale per addolcitore 25 kg', 'Cillit', 'sacco', 7.50, 14.00, 10, 'Trattamento acqua', 0],
      ['CILLIT-CART', 'Cartuccia filtro addolcitore', 'Cillit', 'pz', 21.00, 44.00, 4, 'Trattamento acqua', 0],
      ['MISC-LAV', 'Miscelatore lavabo monocomando', 'Grohe', 'pz', 62.00, 119.00, 3, 'Sanitari', 0],
      ['MISC-DOC', 'Miscelatore doccia termostatico', 'Grohe', 'pz', 145.00, 260.00, 1, 'Sanitari', 0],
      ['VASO-SOSP', 'Vaso sospeso rimless con sedile', 'Ideal Standard', 'pz', 155.00, 290.00, 1, 'Sanitari', 0],
      ['CASS-INC', 'Cassetta incasso con placca', 'Geberit', 'pz', 128.00, 235.00, 1, 'Sanitari', 0],
      ['PIATTO-80', 'Piatto doccia 80x120 resina', 'generica', 'pz', 135.00, 250.00, 1, 'Sanitari', 0],
      ['SILIC-B', 'Silicone sanitario bianco', 'generica', 'pz', 3.20, 7.00, 12, 'Minuteria', 1],
      ['COLL-3', 'Collettore complanare 3 vie 3/4"', 'Caleffi', 'pz', 42.00, 86.00, 2, 'Riscaldamento', 0],
      ['GAS-TEST', 'Prova di tenuta gas (materiale di consumo)', 'generica', 'pz', 1.50, 5.00, 20, 'Minuteria', 1]
    ];
    const articoli = A0.map(a => ({ id: id('art'), codice: a[0], nome: a[1], marca: a[2], unita: a[3], costo: a[4], prezzo: a[5], scortaMin: a[6], categoria: a[7], solito: !!a[8], attivo: true, barcode: '80' + String(1000000000 + Math.floor(rnd() * 8999999999)).slice(0, 11) }));
    const art = cod => articoli.find(a => a.codice === cod);
    const consumabili = articoli.filter(a => a.solito);

    // ------------------------------------------------------------------ magazzini
    const SOTTO_SCORTA = ['WILO-25', 'TV-12', 'CILLIT-CART', 'ZIL-18', 'SCAMB-SEC', '3383', 'TERM-WIFI'];
    const magazzini = [{ id: 'mag_sede', nome: 'Deposito Via Villagrazia', tipo: 'sede', tecnicoId: null }].concat(TEC.map((t, i) => ({ id: 'mag_' + t.id.slice(2), nome: 'Furgone ' + t.nome.split(' ')[0] + ' — ' + ['FR 312 KD', 'GB 118 XP', 'FW 902 LM', 'GA 447 RT'][i], tipo: 'furgone', tecnicoId: t.id })));
    const movimenti = [];
    const mov = (o) => movimenti.push(Object.assign({ id: id('mov'), utenteId: 'u_laura' }, o));
    // Carico iniziale al deposito, poi un po' di roba su ogni furgone.
    articoli.forEach((a, ix) => {
      let q = a.scortaMin * 3 + tra(2, 12);
      if (['ZIL-200'].includes(a.codice)) q = 1;
      if (['VAIL-VMW246', 'IMM-TERA32', 'BAXI-DT28'].includes(a.codice)) q = tra(1, 2);
      // Sette articoli sotto scorta, di proposito: il cruscotto deve dirlo.
      if (SOTTO_SCORTA.includes(a.codice)) q = Math.max(0, a.scortaMin - tra(1, 2));
      mov({ data: istante(-95, 8, ix % 50), articoloId: a.id, magazzinoId: 'mag_sede', qta: q, tipo: 'carico', rif: 'Carico iniziale', nota: 'Inventario di apertura' });
    });
    TEC.forEach((t, k) => consumabili.forEach(a => {
      const q = a.unita === 'm' ? 25 : a.unita === 'lt' ? 4 : 8;
      mov({ data: istante(-94, 9, k), articoloId: a.id, magazzinoId: 'mag_sede', qta: -q, tipo: 'trasferimento', rif: 'Al furgone', controparte: 'mag_' + t.id.slice(2) });
      mov({ data: istante(-94, 9, k), articoloId: a.id, magazzinoId: 'mag_' + t.id.slice(2), qta: q, tipo: 'trasferimento', rif: 'Dal deposito', controparte: 'mag_sede' });
    }));

    // ------------------------------------------------------------------ interventi
    const interventi = [];
    const contatori = {};
    const numero = (tipo) => { const k = tipo + '-' + ANNO; contatori[k] = (contatori[k] || (tipo === 'INT' ? 300 : tipo === 'PRV' ? 30 : tipo === 'PRE' ? 60 : tipo === 'ORD' ? 10 : 0)) + 1; return ANNO + '-' + String(contatori[k]).padStart(4, '0'); };
    const clientiLista = Object.values(C);
    const lavori = {
      riparazione: [
        ['Caldaia in blocco, codice F28', 'Mancata accensione: elettrodo di rilevazione ossidato. Sostituito, pulito bruciatore, verificata combustione.', 'Elettrodo consumato e condensa sporca.', 'Pulizia scambiatore primario al prossimo controllo.'],
        ['Perdita sotto il lavello', 'Sostituito flessibile e rubinetto sottolavello, rifatta tenuta sul sifone.', 'Flessibile corroso, gocciolamento da mesi (mobile rovinato).', 'Controllare anche il flessibile del bagno: stessa età.'],
        ['Radiatori freddi al piano alto', 'Sfiato impianto, sostituita valvola di sfiato automatica, ripristinata pressione a 1,5 bar.', 'Aria in impianto, valvola di sfiato bloccata.', 'Installare defangatore magnetico: acqua dell\'impianto molto sporca.'],
        ['Acqua calda a intermittenza', 'Sostituito scambiatore sanitario a piastre, lavaggio circuito.', 'Scambiatore sanitario intasato dal calcare.', 'Valutare addolcitore o dosatore di polifosfati.'],
        ['Pressione caldaia che scende', 'Ricerca perdita: sostituita valvola di sicurezza 3 bar che trafilava. Ricaricato vaso di espansione.', 'Valvola di sicurezza che scaricava, vaso scarico.', 'Nessuna.']
      ],
      manutenzione: [
        ['Manutenzione annuale caldaia', 'Pulizia bruciatore e scambiatore, controllo combustione e tiraggio, verifica dispositivi di sicurezza, compilazione libretto.', 'Combustione nei parametri. Guarnizione camera stagna indurita, sostituita.', 'Prossimo controllo fumi alla scadenza indicata sul libretto.'],
        ['Controllo addolcitore', 'Rigenerazione manuale, rabbocco sale, sostituita cartuccia filtro, verifica durezza in uscita.', 'Durezza in uscita 8 °f: nei valori.', 'Nessuna.'],
        ['Manutenzione centrale termica', 'Controllo bruciatore, pulizia filtri, verifica pompe e vaso di espansione, trattamento acqua impianto.', 'Circolatore rumoroso sul ramo B.', 'Sostituzione circolatore ramo B entro la stagione.']
      ],
      installazione: [
        ['Sostituzione scaldabagno', 'Smontaggio vecchio scaldabagno, installazione nuovo 80 lt, collegamenti e prova.', 'Vecchio apparecchio con resistenza bruciata e caldaia forata.', 'Nessuna.'],
        ['Installazione termostato WiFi', 'Installato cronotermostato WiFi, configurata app sul telefono del cliente.', '—', 'Mostrato al cliente come programmare le fasce.']
      ],
      sopralluogo: [
        ['Sopralluogo rifacimento bagno', 'Rilievo misure, verifica scarichi e colonne, foto dello stato attuale.', 'Scarichi in ghisa da sostituire fino alla colonna.', 'Preventivo con rifacimento completo scarichi.'],
        ['Sopralluogo sostituzione caldaia', 'Verificati canna fumaria, allacci gas e acqua, spazio per nuova caldaia.', 'Canna fumaria da intubare.', 'Preventivo caldaia a condensazione con kit scarico fumi.']
      ],
      emergenza: [
        ['Tubo rotto, acqua in casa', 'Chiusura generale, individuata rottura su tubo in rame sotto traccia, riparazione con manicotto a pressare.', 'Tubo in rame corroso in un punto.', 'Valutare sostituzione tratta con multistrato.']
      ]
    };
    function materialiPer(tipo) {
      const n = tipo === 'sopralluogo' ? 0 : tra(1, 4);
      const scelti = [];
      for (let k = 0; k < n; k++) {
        const a = pesca(consumabili.concat(k === 0 && tipo === 'riparazione' ? [art('311430'), art('ELT-ACC'), art('SFI-1/2')] : []));
        if (scelti.find(s => s.articoloId === a.id)) continue;
        const q = a.unita === 'm' ? tra(2, 6) : a.unita === 'lt' ? 1 : tra(1, 4);
        scelti.push({ id: id('rm'), articoloId: a.id, nome: a.nome, qta: q, unita: a.unita, da: 'furgone' });
      }
      if (tipo === 'installazione' && rnd() < 0.6) { const a = art('ARI-VELIS80'); scelti.push({ id: id('rm'), articoloId: a.id, nome: a.nome, qta: 1, unita: a.unita, da: 'deposito' }); }
      return scelti;
    }
    function nuovoIntervento(o) {
      const c = o.cliente; const s = o.sede || sedeDi(c);
      const imps = impianti.filter(x => x.sedeId === s.id);
      const i = {
        id: id('int'), numero: numero('INT'), clienteId: c.id, sedeId: s.id, impiantoId: o.impianto === null ? null : (o.impianto || (imps[0] && imps[0].id) || null),
        tipo: o.tipo || 'riparazione', priorita: o.priorita || 'normale', stato: o.stato || 'pianificato', data: o.data || null, ora: o.ora || '', durataMin: o.durataMin || 90,
        tecnici: o.tecnici || [], richiesta: o.richiesta || '', noteInterne: o.noteInterne || '', noteCliente: '', origine: o.origine || 'ufficio', preventivoId: o.preventivoId || null,
        modalita: o.modalita || 'misura', rapporto: o.rapporto || null, storico: [], documentoId: null, creato: o.creato || istante(-3, 9)
      };
      i.storico.push({ stato: 'creato', data: i.creato, utenteId: 'u_laura' });
      if (i.data && i.tecnici.length) i.storico.push({ stato: 'pianificato', data: i.creato, utenteId: 'u_laura' });
      interventi.push(i); return i;
    }
    function chiudi(i, g, oreMin, extra) {
      const tipo = i.tipo;
      const L = pesca(lavori[tipo] || lavori.riparazione);
      if (!i.richiesta) i.richiesta = L[0];
      const [hh, mm] = (i.ora || '09:00').split(':').map(Number);
      const inizio = istante(g, hh, mm); const fine = new Date(new Date(inizio).getTime() + oreMin * 60000).toISOString();
      const c = clienti.find(x => x.id === i.clienteId);
      const firmatario = c.tipo === 'condominio' ? pesca(['Sig. Lo Presti', 'Sig.ra Amato', 'Sig. Greco']) : c.tipo === 'azienda' ? (c.referente || c.nome).split(' (')[0] : c.nome;
      i.rapporto = Object.assign({
        lavoro: L[1], trovato: L[2], consiglio: L[3], esito: 'risolto', secondoIntervento: false,
        ore: [{ id: id('ore'), tipo: 'viaggio', minuti: tra(2, 5) * 5 }, { id: id('ore'), tipo: 'lavoro', minuti: oreMin }],
        materiali: materialiPer(tipo), foto: [], note: '',
        firma: { nome: firmatario, qualifica: c.tipo === 'condominio' ? 'portiere / delegato' : c.tipo === 'azienda' ? 'referente' : 'titolare', png: firmaSvg(firmatario), data: fine, assente: false, motivo: '' },
        inizio, fine, inviatoIl: fine, stato: 'inviato', approvatoIl: null, approvatoDa: null
      }, extra || {});
      i.storico.push({ stato: 'in_corso', data: inizio, utenteId: i.tecnici[0] }, { stato: 'completato', data: fine, utenteId: i.tecnici[0] });
      i.stato = 'completato';
      // Scarico dal furgone nella stessa operazione della chiusura (§12).
      i.rapporto.materiali.forEach(r => {
        const magId = r.da === 'deposito' ? 'mag_sede' : 'mag_' + i.tecnici[0].slice(2);
        mov({ data: fine, articoloId: r.articoloId, magazzinoId: magId, qta: -r.qta, tipo: 'scarico', rif: 'Intervento ' + i.numero, interventoId: i.id, utenteId: i.tecnici[0] });
      });
      return i;
    }
    function approva(i, g) {
      i.rapporto.stato = 'approvato'; i.rapporto.approvatoIl = istante(g, 17, 30); i.rapporto.approvatoDa = 'u_andrea';
      i.stato = 'approvato'; i.storico.push({ stato: 'approvato', data: i.rapporto.approvatoIl, utenteId: 'u_andrea' });
    }

    // Tre mesi di storia: ~3 interventi al giorno lavorativo, fra i quattro tecnici.
    const ORE_POSSIBILI = ['08:00', '08:30', '09:30', '10:00', '11:00', '11:30', '14:00', '14:30', '15:30', '16:00'];
    let ultimoLavorativo = -1; while (dow(ultimoLavorativo) === 0) ultimoLavorativo--;
    for (let g = -92; g <= -1; g++) {
      if (dow(g) === 0) continue;
      const n = dow(g) === 6 ? tra(0, 1) : tra(2, 4);
      for (let k = 0; k < n; k++) {
        const c = pesca(clientiLista);
        const tipo = pesca(['riparazione', 'riparazione', 'riparazione', 'manutenzione', 'manutenzione', 'installazione', 'sopralluogo', 'emergenza']);
        const t = pesca(TEC);
        const i = nuovoIntervento({ cliente: c, tipo, data: giorno(g), ora: pesca(ORE_POSSIBILI), tecnici: [t.id], priorita: tipo === 'emergenza' ? 'urgente' : pesca(['normale', 'normale', 'normale', 'alta', 'bassa']), creato: istante(g - tra(1, 6), 9, tra(0, 59)), origine: pesca(['telefono', 'telefono', 'ufficio', 'portale']), modalita: c.tag.includes('contratto') && tipo === 'manutenzione' ? 'contratto' : 'misura' });
        chiudi(i, g, tipo === 'sopralluogo' ? tra(3, 6) * 10 : tra(4, 16) * 15);
        if (g < ultimoLavorativo) approva(i, g);
      }
    }
    // Foto di prova su alcuni lavori recenti (due visibili al cliente, le altre interne).
    interventi.filter(i => i.rapporto).slice(-24).forEach((i, k) => {
      if (k % 3) return;
      i.rapporto.foto = [
        { id: id('fot'), fase: 'prima', src: fotoProva('Prima', 'caldo'), visibileCliente: k % 2 === 0, data: i.rapporto.inizio },
        { id: id('fot'), fase: 'dopo', src: fotoProva('Dopo'), visibileCliente: k % 2 === 0, data: i.rapporto.fine },
        { id: id('fot'), fase: 'matricola', src: fotoProva('Matricola', 'chiaro'), visibileCliente: false, data: i.rapporto.fine }
      ];
    });

    // ------------------------------------------------------------------ rifornimenti
    // Nella vita vera il furgone si ricarica ogni settimana e il deposito riceve
    // dai fornitori. Senza questo passaggio tre mesi di scarichi portano tutto
    // sotto zero, e il magazzino della demo racconterebbe un'azienda che non esiste.
    const giac = (aid, mid) => movimenti.reduce((q, m) => q + (m.articoloId === aid && (!mid || m.magazzinoId === mid) ? m.qta : 0), 0);
    TEC.forEach(t => consumabili.forEach(a => {
      const mid = 'mag_' + t.id.slice(2);
      const obiettivo = a.unita === 'm' ? 25 : a.unita === 'lt' ? 4 : 8;
      const q = obiettivo - tra(0, 2) - giac(a.id, mid);
      if (q <= 0) return;
      const g = -tra(2, 9);
      mov({ data: istante(g, 7, 30), articoloId: a.id, magazzinoId: 'mag_sede', qta: -q, tipo: 'trasferimento', rif: 'Ricarica furgone', controparte: mid });
      mov({ data: istante(g, 7, 30), articoloId: a.id, magazzinoId: mid, qta: q, tipo: 'trasferimento', rif: 'Ricarica dal deposito', controparte: 'mag_sede' });
    }));
    articoli.forEach(a => {
      const corto = SOTTO_SCORTA.includes(a.codice);
      const inFurgoni = giac(a.id) - giac(a.id, 'mag_sede');
      const voluto = corto ? Math.max(0, a.scortaMin - 1 - inFurgoni) : Math.max(1, a.scortaMin * 2 + tra(1, 8) - inFurgoni);
      const q = voluto - giac(a.id, 'mag_sede');
      if (q > 0) mov({ data: istante(-tra(4, 20), 11), articoloId: a.id, magazzinoId: 'mag_sede', qta: q, tipo: 'carico', rif: 'DDT fornitore', nota: '' });
      else if (q < 0 && corto) mov({ data: istante(-30, 17), articoloId: a.id, magazzinoId: 'mag_sede', qta: q, tipo: 'rettifica', rif: 'Inventario', nota: 'Differenza di conta' });
    });

    // ------------------------------------------------------------------ documenti di vendita
    // Tutto cio' che e' piu' vecchio di 30 giorni e' gia' stato fatturato
    // (dal software del commercialista, non da qui: §11). Fra 8 e 30 giorni e'
    // valorizzato ed esportato. Gli ultimi 7 giorni sono «fatto e non fatturato».
    const documenti = [];
    const T = { manodopera: 38, straordinario: 48, uscita: 25 };
    function righeDa(i) {
      const r = [];
      const min = i.rapporto.ore.filter(o => o.tipo === 'lavoro' || o.tipo === 'straordinario').reduce((s, o) => s + o.minuti, 0);
      const gratuito = i.modalita === 'contratto' || i.modalita === 'garanzia';
      r.push({ interventoId: i.id, descrizione: 'Intervento ' + i.numero + ' del ' + i.data.split('-').reverse().join('/') + ' — manodopera', qta: Math.round(min / 60 * 100) / 100, unita: 'h', prezzo: gratuito ? 0 : T.manodopera, iva: 22 });
      if (!gratuito) r.push({ interventoId: i.id, descrizione: 'Diritto di uscita', qta: 1, unita: 'pz', prezzo: T.uscita, iva: 22 });
      i.rapporto.materiali.forEach(m => { const a = articoli.find(x => x.id === m.articoloId); r.push({ interventoId: i.id, descrizione: m.nome, qta: m.qta, unita: m.unita, prezzo: gratuito ? 0 : (a ? a.prezzo : 0), iva: 22 }); });
      return r;
    }
    const approvati = interventi.filter(i => i.stato === 'approvato' && i.tipo !== 'sopralluogo');
    const gruppi = {};
    approvati.forEach(i => {
      const eta = Math.round((OGGI - new Date(i.data)) / 86400000);
      if (eta <= 7) return;
      const mese = i.data.slice(0, 7);
      const k = i.clienteId + '|' + (eta > 30 ? mese : 'recenti');
      (gruppi[k] = gruppi[k] || []).push(i);
    });
    Object.keys(gruppi).sort((a, b) => gruppi[a][0].data.localeCompare(gruppi[b][0].data)).forEach(k => {
      const lista = gruppi[k]; const cl = clienti.find(c => c.id === lista[0].clienteId);
      const ultima = lista.map(i => i.data).sort().pop();
      const eta = Math.round((OGGI - new Date(ultima)) / 86400000);
      const recenti = k.endsWith('recenti');
      const stato = !recenti ? 'fatturato' : (eta > 15 ? 'esportato' : 'pronto');
      const d = {
        id: id('doc'), numero: numero('PRE'), clienteId: cl.id, interventi: lista.map(i => i.id), stato, creato: new Date(new Date(ultima).getTime() + 2 * 86400000).toISOString(),
        sconto: cl.sconto || 0, regimeIva: 'IVA ordinaria 22%', note: '', righe: [].concat(...lista.map(righeDa)),
        esportatoIl: stato !== 'pronto' ? new Date(new Date(ultima).getTime() + 4 * 86400000).toISOString() : null,
        fattura: stato === 'fatturato' ? { numero: 'FT ' + tra(100, 480) + '/' + ANNO, data: iso(new Date(new Date(ultima).getTime() + 6 * 86400000)) } : null
      };
      documenti.push(d);
      lista.forEach(i => { i.documentoId = d.id; i.stato = stato === 'fatturato' ? 'fatturato' : 'valorizzato'; i.storico.push({ stato: i.stato, data: d.creato, utenteId: 'u_laura' }); });
    });
    // I sopralluoghi approvati non si fatturano: restano approvati e basta.

    // ------------------------------------------------------------------ oggi e i prossimi giorni
    const S = (c) => sedeDi(c);
    // Marco: la giornata del prototipo. Il primo lavoro e' gia' chiuso e inviato.
    const m1 = nuovoIntervento({ cliente: C.bar, tipo: 'riparazione', priorita: 'alta', data: giorno(0), ora: '08:00', durataMin: 60, tecnici: [U.marco.id], richiesta: 'Scaldabagno che non scalda: il bar apre alle 7, serve acqua calda per la lavastoviglie.', origine: 'telefono', creato: istante(-1, 17, 40) });
    chiudi(m1, 0, 55);
    m1.rapporto.foto = [{ id: id('fot'), fase: 'prima', src: fotoProva('Resistenza', 'caldo'), visibileCliente: false, data: m1.rapporto.inizio }];
    nuovoIntervento({ cliente: C.trapani, tipo: 'manutenzione', data: giorno(0), ora: '09:30', durataMin: 75, tecnici: [U.marco.id], richiesta: 'Manutenzione annuale della caldaia e controllo fumi. La signora vuole capire perché la bolletta del gas è salita.', origine: 'ricorrente', impianto: I.trapani.id, creato: istante(-20, 9) });
    nuovoIntervento({ cliente: C.sciuti, tipo: 'riparazione', priorita: 'alta', data: giorno(0), ora: '11:00', durataMin: 120, tecnici: [U.marco.id], richiesta: 'Centrale termica: pressione che scende di notte, corpo B freddo al mattino. Già segnalato due volte dagli inquilini.', noteInterne: 'Amministratore attento ai costi: foto di tutto, prima e dopo.', origine: 'portale', impianto: I.sciuti.id, creato: istante(-2, 10, 12) });
    nuovoIntervento({ cliente: C.locascio, tipo: 'manutenzione', data: giorno(0), ora: '14:30', durataMin: 45, tecnici: [U.marco.id], richiesta: 'Controllo addolcitore semestrale (l\'autoclave dello studio non deve fermarsi).', origine: 'ricorrente', impianto: I.locascio.id, modalita: 'misura', creato: istante(-15, 9) });
    nuovoIntervento({ cliente: C.ingrassia, tipo: 'sopralluogo', data: giorno(0), ora: '16:30', durataMin: 40, tecnici: [U.marco.id], richiesta: 'Sopralluogo per sostituzione caldaia del laboratorio (Victrix Tera 32, 7 anni). Vogliono un preventivo entro la settimana.', origine: 'telefono', impianto: I.ingrassia.id, creato: istante(-3, 11) });
    // Gli altri tecnici, oggi.
    const n1 = nuovoIntervento({ cliente: C.aragona, tipo: 'manutenzione', data: giorno(0), ora: '08:30', durataMin: 180, tecnici: [U.nino.id, U.salvo.id], richiesta: 'Manutenzione semestrale bruciatore e verifica vaso di espansione 200 lt.', origine: 'ricorrente', impianto: I.aragona.id, modalita: 'contratto', creato: istante(-10, 9) });
    n1.stato = 'in_corso'; n1.storico.push({ stato: 'in_viaggio', data: istante(0, 8, 5), utenteId: U.nino.id }, { stato: 'in_corso', data: istante(0, 8, 32), utenteId: U.nino.id });
    n1.rapporto = { lavoro: '', trovato: '', consiglio: '', esito: '', ore: [], materiali: [], foto: [], note: '', firma: null, inizio: istante(0, 8, 32), fine: null, stato: 'bozza', cronometro: { avviato: istante(0, 8, 32) } };
    nuovoIntervento({ cliente: C.molo, tipo: 'riparazione', data: giorno(0), ora: '14:00', durataMin: 90, tecnici: [U.nino.id], richiesta: 'Scaldabagno della cucina che perde dalla valvola.', impianto: I.molo.id, origine: 'telefono', creato: istante(-1, 12) });
    const g1 = nuovoIntervento({ cliente: C.cracolici, tipo: 'riparazione', data: giorno(0), ora: '09:00', durataMin: 60, tecnici: [U.giuseppe.id], richiesta: 'Caldaia che fa rumore all\'accensione.', impianto: I.cracolici.id, modalita: 'garanzia', origine: 'telefono', creato: istante(-2, 15) });
    chiudi(g1, 0, 50, { consiglio: 'In garanzia fino a ' + giorno(60).split('-').reverse().join('/') + ': segnalato al centro assistenza.' });
    nuovoIntervento({ cliente: C.settimo, tipo: 'manutenzione', data: giorno(0), ora: '11:30', durataMin: 120, tecnici: [U.giuseppe.id], richiesta: 'Manutenzione annuale caldaia condominiale.', impianto: I.settimo.id, origine: 'ricorrente', creato: istante(-12, 9) });
    nuovoIntervento({ cliente: C.cusmano, tipo: 'manutenzione', data: giorno(0), ora: '15:00', durataMin: 60, tecnici: [U.salvo.id], richiesta: 'Pulizia filtri climatizzatore e controllo gas.', impianto: I.cusmano.id, origine: 'portale', creato: istante(-5, 10) });
    // L'ultimo giorno lavorativo: inviati e ancora da approvare. (Di lunedi'
    // «ieri» e' domenica: senza questo, la coda dell'ufficio restava vuota.)
    let ieri = -1; while (dow(ieri) === 0) ieri--;
    [[C.battaglia, U.salvo, 'riparazione', '10:00', 90], [C.alagna, U.giuseppe, 'riparazione', '15:30', 120], [C.crocerossa, U.nino, 'manutenzione', '09:00', 150]].forEach(([c, t, tipo, o, mi]) => {
      const i = nuovoIntervento({ cliente: c, tipo, data: giorno(ieri), ora: o, tecnici: [t.id], origine: 'telefono', creato: istante(ieri - 3, 9) });
      chiudi(i, ieri, mi);
    });
    // Uno senza firma: il cliente non c'era. L'ufficio deve vederlo in rosso.
    const senzaFirma = interventi.filter(i => i.stato === 'completato' && i.clienteId === C.alagna.id)[0];
    if (senzaFirma) { senzaFirma.rapporto.firma = { nome: '', qualifica: '', png: null, data: senzaFirma.rapporto.fine, assente: true, motivo: 'Cliente al lavoro, ha lasciato le chiavi alla vicina.' }; senzaFirma.rapporto.esito = 'parziale'; senzaFirma.rapporto.secondoIntervento = true; }
    // Prossimi giorni.
    const futuri = [
      [1, U.marco, C.notarbartolo, 'manutenzione', '08:30', 120, I.notar],
      [1, U.marco, C.serena, 'manutenzione', '14:00', 90, I.serena],
      [1, U.nino, C.ugo, 'manutenzione', '09:00', 120, I.ugo],
      [1, U.giuseppe, C.battaglia, 'sopralluogo', '10:30', 45, I.battaglia],
      [1, U.salvo, C.aragona, 'riparazione', '09:00', 180, I.aragonaVaso],
      [2, U.marco, C.sciuti, 'manutenzione', '09:00', 120, I.sciutiAddolc],
      [2, U.nino, C.crocerossa, 'riparazione', '11:00', 90, I.crocerossa],
      [2, U.giuseppe, C.molo, 'installazione', '08:30', 240, I.molo],
      [3, U.salvo, C.cusmano, 'riparazione', '10:00', 60, I.cusmano],
      [3, U.marco, C.alagna, 'riparazione', '09:30', 90, I.alagna],
      [4, U.nino, C.settimo, 'riparazione', '15:00', 60, I.settimo]
    ];
    futuri.forEach(([g, t, c, tipo, o, d, im]) => {
      let gg = g; while (dow(gg) === 0) gg++;
      nuovoIntervento({ cliente: c, tipo, data: giorno(gg), ora: o, durataMin: d, tecnici: [t.id], impianto: im ? im.id : null, origine: pesca(['telefono', 'ufficio', 'portale']), creato: istante(-1, 11) });
    });
    // Da pianificare: nessuna data, nessun tecnico.
    nuovoIntervento({ cliente: C.cracolici, tipo: 'riparazione', stato: 'da_pianificare', priorita: 'alta', richiesta: 'Termosifone del bagno che non si scalda.', origine: 'telefono', creato: istante(0, 8, 40) });
    nuovoIntervento({ cliente: C.ugo, tipo: 'sopralluogo', stato: 'da_pianificare', richiesta: 'Sopralluogo per sostituzione colonne di scarico (preventivo richiesto in assemblea).', origine: 'ufficio', creato: istante(-1, 16) });
    nuovoIntervento({ cliente: C.alagna, tipo: 'installazione', stato: 'da_pianificare', richiesta: 'Montaggio termostato WiFi acquistato dal cliente.', origine: 'portale', impianto: I.alagna.id, creato: istante(-2, 18) });

    // ------------------------------------------------------------------ preventivi
    const preventivi = [];
    function nuovoPreventivo(o) {
      const p = Object.assign({ id: id('prv'), numero: numero('PRV'), versione: 1, sedeId: sedeDi(o.cliente).id, stato: 'bozza', creato: istante(-5, 10), inviatoIl: null, vistoIl: null, decisoIl: null, validoFino: giorno(25), note: '', condizioni: 'Validità 30 giorni. Pagamento: 30% all\'accettazione, saldo a fine lavori. Prezzi IVA esclusa.', decisione: null, eventi: [], interventoId: null }, o);
      p.clienteId = o.cliente.id; delete p.cliente;
      p.righe = (o.righe || []).map(r => Object.assign({ id: id('rp'), tipo: 'materiale', sconto: 0, iva: 22, opzionale: false, scelta: false }, r));
      p.eventi.unshift({ tipo: 'creato', data: p.creato, chi: 'Laura Ferrante' });
      preventivi.push(p); return p;
    }
    const riga = (cod, qta, extra) => { const a = art(cod); return Object.assign({ tipo: 'materiale', articoloId: a.id, descrizione: a.marca + ' ' + a.nome, qta, unita: a.unita, prezzo: a.prezzo }, extra || {}); };
    const man = (ore, desc) => ({ tipo: 'manodopera', descrizione: desc || 'Manodopera', qta: ore, unita: 'h', prezzo: 38 });
    const P1 = nuovoPreventivo({ cliente: C.aragona, oggetto: 'Sostituzione vaso di espansione 200 lt — centrale termica', stato: 'inviato', creato: istante(-3, 11), inviatoIl: istante(-3, 12), validoFino: giorno(27),
      righe: [riga('ZIL-200', 1), { tipo: 'materiale', descrizione: 'Valvolame di intercettazione e raccorderia', qta: 1, unita: 'corpo', prezzo: 160 }, man(8, 'Manodopera (2 tecnici, 4 ore)'), { tipo: 'servizio', descrizione: 'Svuotamento e ricarica impianto, trattamento acqua', qta: 1, unita: 'corpo', prezzo: 64 }, { tipo: 'servizio', descrizione: 'Smaltimento vaso esistente', qta: 1, unita: 'corpo', prezzo: 112 }, riga('545005', 1, { opzionale: true, descrizione: 'Opzionale — defangatore magnetico Caleffi DIRTMAG sul ritorno' })] });
    P1.eventi.unshift({ tipo: 'inviato', data: P1.inviatoIl, chi: 'Laura Ferrante' });
    const P2 = nuovoPreventivo({ cliente: C.sciuti, oggetto: 'Sostituzione circolatore ramo B e defangatore', stato: 'visto', creato: istante(-6, 10), inviatoIl: istante(-6, 11), vistoIl: istante(-4, 20, 14), validoFino: giorno(24),
      righe: [riga('WILO-25', 1), riga('545005', 1), riga('R554X-20', 4), man(4), { tipo: 'nota', descrizione: 'Intervento eseguibile senza fermare il ramo A: nessun disagio per gli inquilini del corpo A.', qta: 0, unita: '', prezzo: 0 }] });
    P2.eventi.unshift({ tipo: 'inviato', data: P2.inviatoIl, chi: 'Andrea Albino' }, { tipo: 'aperto', data: P2.vistoIl, chi: 'Salvatore Puglisi' });
    const P3 = nuovoPreventivo({ cliente: C.trapani, oggetto: 'Rifacimento bagno padronale', stato: 'accettato', creato: istante(-20, 10), inviatoIl: istante(-20, 16), vistoIl: istante(-19, 9), decisoIl: istante(-17, 18, 42), validoFino: giorno(10),
      righe: [riga('PIATTO-80', 1), riga('MISC-DOC', 1), riga('VASO-SOSP', 1), riga('CASS-INC', 1), riga('MISC-LAV', 1), riga('MST-16', 30), { tipo: 'servizio', descrizione: 'Demolizioni e smaltimento macerie', qta: 1, unita: 'corpo', prezzo: 650, iva: 10 }, man(40, 'Manodopera idraulica e posa'), riga('TERM-WIFI', 1, { opzionale: true, scelta: true, descrizione: 'Opzionale — termostato WiFi per il nuovo scaldasalviette' })],
      decisione: { esito: 'accettato', nome: 'Giuseppina Trapani', data: istante(-17, 18, 42), ua: 'Safari su iPhone', hash: 'b41f0c9e2d7a5f31c8e0a9d4b6e2f7c1a3d5e8f0b2c4d6e8f0a1b3c5d7e9f1a3' } });
    P3.eventi.unshift({ tipo: 'inviato', data: P3.inviatoIl, chi: 'Andrea Albino' }, { tipo: 'aperto', data: P3.vistoIl, chi: 'Giuseppina Trapani' }, { tipo: 'accettato', data: P3.decisoIl, chi: 'Giuseppina Trapani' });
    const P4 = nuovoPreventivo({ cliente: C.battaglia, oggetto: 'Sostituzione caldaia con condensazione', stato: 'bozza', creato: istante(0, 8, 10), validoFino: giorno(30),
      righe: [riga('VAIL-VMW246', 1), riga('KIT-FUMI', 1), riga('545005', 1), riga('X100-1L', 1), man(7), { tipo: 'servizio', descrizione: 'Dichiarazione di conformità e prima accensione', qta: 1, unita: 'corpo', prezzo: 90 }] });
    const P5 = nuovoPreventivo({ cliente: C.molo, oggetto: 'Sostituzione scaldabagno cucina', stato: 'convertito', creato: istante(-9, 10), inviatoIl: istante(-9, 12), vistoIl: istante(-9, 15), decisoIl: istante(-8, 10), validoFino: giorno(20),
      righe: [riga('ARI-VELIS80', 1), riga('FLEX-30', 2), riga('311430', 1), man(3)],
      decisione: { esito: 'accettato', nome: 'Ciccio Ferrara', data: istante(-8, 10), ua: 'Chrome su Android', hash: '7c2e91d04a3f5b6c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c' } });
    P5.eventi.unshift({ tipo: 'inviato', data: P5.inviatoIl, chi: 'Laura Ferrante' }, { tipo: 'accettato', data: P5.decisoIl, chi: 'Ciccio Ferrara' }, { tipo: 'convertito', data: istante(-8, 11), chi: 'Laura Ferrante' });
    const intMolo = interventi.find(i => i.clienteId === C.molo.id && i.tipo === 'installazione' && !i.rapporto);
    if (intMolo) { intMolo.preventivoId = P5.id; intMolo.origine = 'preventivo'; P5.interventoId = intMolo.id; intMolo.richiesta = 'Sostituzione scaldabagno come da preventivo ' + P5.numero + '.'; }
    const P6 = nuovoPreventivo({ cliente: C.settimo, oggetto: 'Rifacimento collettori centrale termica', stato: 'rifiutato', creato: istante(-40, 10), inviatoIl: istante(-40, 12), vistoIl: istante(-38, 9), decisoIl: istante(-30, 11), validoFino: giorno(-10),
      righe: [riga('COLL-3', 4), riga('MST-20', 40), man(24)], decisione: { esito: 'rifiutato', nome: 'Studio Amministrazioni Lipari', data: istante(-30, 11), motivo: 'L\'assemblea ha rinviato i lavori al prossimo anno.' } });
    P6.eventi.unshift({ tipo: 'inviato', data: P6.inviatoIl, chi: 'Andrea Albino' }, { tipo: 'rifiutato', data: P6.decisoIl, chi: 'Studio Amministrazioni Lipari' });
    const P7 = nuovoPreventivo({ cliente: C.notarbartolo, oggetto: 'Installazione defangatore e trattamento acqua impianto', stato: 'inviato', creato: istante(-12, 10), inviatoIl: istante(-12, 12), validoFino: giorno(3),
      righe: [riga('545005', 1), riga('X400-1L', 2), riga('X100-1L', 2), man(3)] });
    P7.eventi.unshift({ tipo: 'inviato', data: P7.inviatoIl, chi: 'Laura Ferrante' });
    const P8 = nuovoPreventivo({ cliente: C.ingrassia, oggetto: 'Sostituzione caldaia laboratorio (dopo sopralluogo)', stato: 'bozza', creato: istante(0, 7, 50), validoFino: giorno(30), note: 'Da completare dopo il sopralluogo di oggi pomeriggio.',
      righe: [riga('IMM-TERA32', 1), riga('KIT-FUMI', 1), man(8)] });

    // ------------------------------------------------------------------ richieste, note, materiale
    const richieste = [
      { id: id('ric'), origine: 'sito', clienteId: null, nome: 'Francesca Lombardo', telefono: '333 000 4101', email: 'f.lombardo@example.com', indirizzo: 'Via dei Cantieri 45, Palermo', tipo: 'preventivo', urgenza: 'quando_potete', sedeId: null, descrizione: 'Vorrei un preventivo per sostituire la caldaia (ha 15 anni) con una a condensazione. Appartamento di 90 mq.', stato: 'nuova', data: istante(0, 7, 12), interventoId: null, foto: [] },
      { id: id('ric'), origine: 'portale', clienteId: C.sciuti.id, nome: 'Salvatore Puglisi', telefono: '091 000 1101', email: 's.puglisi@example.com', indirizzo: '', tipo: 'guasto', urgenza: 'questa_settimana', sedeId: S(C.sciuti).id, descrizione: 'Gli inquilini del 4° piano segnalano un rumore forte nei tubi quando si apre l\'acqua calda.', stato: 'nuova', data: istante(-1, 19, 3), interventoId: null, foto: [] },
      { id: id('ric'), origine: 'portale', clienteId: C.trapani.id, nome: 'Giuseppina Trapani', telefono: '333 000 3401', email: 'g.trapani@example.com', indirizzo: '', tipo: 'sopralluogo', urgenza: 'quando_potete', sedeId: S(C.trapani).id, descrizione: 'Per il bagno: quando potete venire a prendere le misure del mobile?', stato: 'presa', data: istante(-2, 11, 30), interventoId: null, foto: [] }
    ];
    const note = [
      { id: id('not'), interventoId: m1.id, autoreId: U.marco.id, testo: 'Al Bar Centrale lo scaldabagno ha 3 anni ma la resistenza era già incrostata: acqua durissima. Proporrei un dosatore di polifosfati.', urgente: false, letta: false, data: istante(0, 9, 5) },
      { id: id('not'), interventoId: n1.id, autoreId: U.nino.id, testo: 'Hotel Aragona: il vaso da 200 lt è da cambiare davvero, perde precarica. Il preventivo c\'è già? Il manutentore chiede tempi.', urgente: true, letta: false, data: istante(0, 10, 20) },
      { id: id('not'), interventoId: g1.id, autoreId: U.giuseppe.id, testo: 'Caldaia Cracolici in garanzia: ho aperto la chiamata al centro assistenza Ariston, numero pratica 4471.', urgente: false, letta: true, data: istante(0, 10, 2) }
    ];
    const richiesteMateriale = [
      { id: id('rmat'), interventoId: n1.id, tecnicoId: U.nino.id, articoloId: art('ZIL-200').id, descrizione: 'Vaso di espansione 200 lt Ultra-Pro', qta: 1, unita: 'pz', urgenza: 'urgente', stato: 'nuova', data: istante(0, 10, 22), fornitoreId: null, note: 'Per Hotel Aragona, se il preventivo viene accettato.' },
      { id: id('rmat'), interventoId: m1.id, tecnicoId: U.marco.id, articoloId: art('ELT-ACC').id, descrizione: 'Elettrodo di accensione/rilevazione', qta: 4, unita: 'pz', urgenza: 'normale', stato: 'nuova', data: istante(0, 9, 0), fornitoreId: null, note: 'Sul furgone ne resta uno.' },
      { id: id('rmat'), interventoId: null, tecnicoId: U.giuseppe.id, articoloId: art('WILO-25').id, descrizione: 'Circolatore Yonos PARA 25/6', qta: 1, unita: 'pz', urgenza: 'blocca_lavoro', stato: 'ordinata', data: istante(-2, 16), fornitoreId: 'for_2', note: 'Per il Condominio Via Sciuti, ramo B.' },
      { id: id('rmat'), interventoId: null, tecnicoId: U.salvo.id, articoloId: null, descrizione: 'Cartucce filtro per climatizzatori Mitsubishi', qta: 2, unita: 'pz', urgenza: 'normale', stato: 'arrivata', data: istante(-6, 12), fornitoreId: 'for_3', note: '' }
    ];
    const fornitori = [
      { id: 'for_1', nome: 'Idrotermica Sicula S.r.l.', referente: 'Banco vendita', telefono: '091 000 5101', email: 'ordini@idrotermica.example.com', categorie: 'Raccorderia, tubi, valvolame', note: 'Consegna in giornata se si ordina entro le 10.' },
      { id: 'for_2', nome: 'Comet Termoidraulica', referente: 'Giorgio', telefono: '091 000 5201', email: 'vendite@comet.example.com', categorie: 'Caldaie, circolatori, ricambi', note: '' },
      { id: 'for_3', nome: 'Clima Service Palermo', referente: 'Ufficio ricambi', telefono: '091 000 5301', email: 'ricambi@climaservice.example.com', categorie: 'Climatizzazione, pompe di calore', note: '' },
      { id: 'for_4', nome: 'Arredobagno Oreto', referente: 'Sig. Pollara', telefono: '091 000 5401', email: 'info@arredobagno.example.com', categorie: 'Sanitari, rubinetteria, piatti doccia', note: 'Showroom per portare i clienti.' }
    ];

    // ------------------------------------------------------------------ area cliente
    const ordini = [
      { id: id('ord'), numero: numero('ORD'), clienteId: C.sciuti.id, righe: [{ articoloId: art('CILLIT-SALE').id, qta: 4, prezzo: art('CILLIT-SALE').prezzo }], consegna: 'consegna', sedeId: S(C.sciuti).id, note: 'Lasciare al portiere.', stato: 'nuovo', data: istante(-1, 18, 20) },
      { id: id('ord'), numero: numero('ORD'), clienteId: C.bar.id, righe: [{ articoloId: art('FLEX-30').id, qta: 2, prezzo: art('FLEX-30').prezzo }, { articoloId: art('TEF-12').id, qta: 3, prezzo: art('TEF-12').prezzo }], consegna: 'ritiro', sedeId: null, note: '', stato: 'pronto', data: istante(-4, 9, 40) }
    ];
    const conversazioni = [
      { id: id('cnv'), clienteId: C.sciuti.id, oggetto: 'Preventivo circolatore ramo B', contesto: { tipo: 'preventivo', id: P2.id }, lettoAzienda: false, lettoCliente: true, aggiornato: istante(-1, 20, 45), messaggi: [
        { id: id('msg'), da: 'azienda', autoreId: 'u_andrea', testo: 'Buongiorno, le abbiamo inviato il preventivo per il circolatore del ramo B. Il lavoro si fa in mezza giornata senza lasciare nessuno al freddo.', data: istante(-6, 11, 5) },
        { id: id('msg'), da: 'cliente', autoreId: null, testo: 'Grazie. Lo porto in assemblea giovedì. Il defangatore è proprio necessario o si può fare dopo?', data: istante(-1, 20, 45) }
      ] },
      { id: id('cnv'), clienteId: C.trapani.id, oggetto: 'Bagno: scelta del piatto doccia', contesto: { tipo: 'preventivo', id: P3.id }, lettoAzienda: true, lettoCliente: false, aggiornato: istante(-2, 12, 10), messaggi: [
        { id: id('msg'), da: 'cliente', autoreId: null, testo: 'Buongiorno, mia figlia vorrebbe vedere dei piatti doccia di colore grigio. Si può?', data: istante(-3, 17, 2) },
        { id: id('msg'), da: 'azienda', autoreId: 'u_laura', testo: 'Certo signora. Lo showroom di Arredobagno Oreto ne ha diversi: le fissiamo un appuntamento? Il prezzo non cambia.', data: istante(-2, 12, 10) }
      ] },
      { id: id('cnv'), clienteId: C.bar.id, oggetto: 'Ordine flessibili', contesto: { tipo: 'generale', id: null }, lettoAzienda: true, lettoCliente: true, aggiornato: istante(-3, 10), messaggi: [
        { id: id('msg'), da: 'azienda', autoreId: 'u_laura', testo: 'Il vostro ordine è pronto al deposito di Via Villagrazia, potete passare dalle 8 alle 18.', data: istante(-3, 10) }
      ] }
    ];
    const allegati = [];
    const alleg = (c, tipo, nome, g, imp) => allegati.push({ id: id('all'), clienteId: c.id, impiantoId: imp ? imp.id : null, tipo, nome, data: istante(g, 12), dimensione: tra(80, 900) * 1024, caricatoDa: 'u_laura', visibileCliente: true });
    alleg(C.sciuti, 'libretto', 'Libretto di impianto — centrale termica', -340, I.sciuti);
    alleg(C.sciuti, 'certificazione', 'Rapporto di efficienza energetica (controllo fumi)', -340, I.sciuti);
    alleg(C.sciuti, 'fattura', 'Fattura FT 212/' + ANNO + ' (emessa dal vostro fornitore di fatturazione)', -40);
    alleg(C.sciuti, 'dico', 'Dichiarazione di conformità — sostituzione circolatore 2021', -1400, I.sciutiPompa);
    alleg(C.trapani, 'libretto', 'Libretto di impianto — Vaillant ecoTEC plus', -360, I.trapani);
    alleg(C.trapani, 'dico', 'Dichiarazione di conformità — installazione caldaia', -1090, I.trapani);
    alleg(C.trapani, 'fattura', 'Fattura FT 198/' + ANNO + ' — acconto bagno', -16);
    alleg(C.bar, 'fattura', 'Fattura FT 205/' + ANNO, -33);
    alleg(C.bar, 'certificazione', 'Garanzia scaldabagno Ariston', -520, I.bar);
    alleg(C.notarbartolo, 'libretto', 'Libretto di impianto — Baxi Luna Duo-tec MP', -355, I.notar);

    const contratti = [
      { id: id('ctr'), clienteId: C.sciuti.id, impiantoId: I.sciuti.id, nome: 'Manutenzione centrale termica + addolcitore', visiteAnno: 3, canoneAnnuo: 980, inizio: giorno(-340), scadenza: giorno(25), rinnovo: 'tacito', note: 'Include controllo fumi annuale e 2 controlli addolcitore.' },
      { id: id('ctr'), clienteId: C.notarbartolo.id, impiantoId: I.notar.id, nome: 'Manutenzione annuale caldaia', visiteAnno: 1, canoneAnnuo: 320, inizio: giorno(-355), scadenza: giorno(10), rinnovo: 'tacito', note: '' },
      { id: id('ctr'), clienteId: C.aragona.id, impiantoId: I.aragona.id, nome: 'Assistenza centrale termica hotel', visiteAnno: 2, canoneAnnuo: 1450, inizio: giorno(-160), scadenza: giorno(205), rinnovo: 'da rinegoziare', note: 'Tempo di risposta garantito: 4 ore lavorative.' }
    ];

    // ------------------------------------------------------------------ avvisi iniziali
    const avvisi = [
      { id: id('avv'), a: 'ufficio', testo: 'Nuova richiesta dal sito: Francesca Lombardo chiede un preventivo caldaia', link: '#/u/richieste', data: istante(0, 7, 12), letto: false, tipo: 'richiesta' },
      { id: id('avv'), a: 'ufficio', testo: 'Nino Vaccaro: materiale URGENTE — vaso di espansione 200 lt', link: '#/u/materiale', data: istante(0, 10, 22), letto: false, tipo: 'materiale' },
      { id: id('avv'), a: 'ufficio', testo: 'Marco Sciarrone ha inviato il rapportino del Bar Centrale', link: '#/u/rapportini', data: istante(0, 8, 57), letto: false, tipo: 'rapportino' },
      { id: id('avv'), a: 'ufficio', testo: 'Salvatore Puglisi ha aperto il preventivo ' + P2.numero, link: '#/u/preventivo/' + P2.id, data: P2.vistoIl, letto: true, tipo: 'preventivo' },
      { id: id('avv'), a: U.marco.id, testo: 'Nuovo lavoro domani alle 14:00: Villa Serena — manutenzione', link: '#/t/oggi?g=' + giorno(1), data: istante(-1, 11), letto: false, tipo: 'assegnazione' },
      { id: id('avv'), a: 'cliente:' + C.sciuti.id, testo: 'Nuovo preventivo da IDRAL: ' + P2.oggetto, link: '#/c/preventivo/' + P2.id, data: P2.inviatoIl, letto: true, tipo: 'preventivo' },
      { id: id('avv'), a: 'cliente:' + C.trapani.id, testo: 'IDRAL ha risposto al tuo messaggio', link: '#/c/messaggi', data: istante(-2, 12, 10), letto: false, tipo: 'messaggio' }
    ];
    const email = [
      { id: id('eml'), data: P2.inviatoIl, a: 's.puglisi@example.com', oggetto: 'IDRAL — preventivo ' + P2.numero, testo: 'Gentile Salvatore Puglisi, trova il preventivo nell\'area clienti: può accettarlo o rifiutarlo con un clic, senza password.' },
      { id: id('eml'), data: istante(-2, 12, 10), a: 'g.trapani@example.com', oggetto: 'IDRAL ha risposto al suo messaggio', testo: 'Legga la risposta nell\'area clienti.' }
    ];

    // ------------------------------------------------------------------ accessi dei clienti
    const utenti = Object.values(U).concat([
      { id: 'u_puglisi', ruolo: 'cliente', nome: 'Salvatore Puglisi', email: 's.puglisi@example.com', telefono: '091 000 1101', password: 'cliente2026', clienti: [C.sciuti.id, C.notarbartolo.id, C.ugo.id], attivo: true, preferenze: { email: true } },
      { id: 'u_trapani', ruolo: 'cliente', nome: 'Giuseppina Trapani', email: 'g.trapani@example.com', telefono: '333 000 3401', password: 'cliente2026', clienti: [C.trapani.id], attivo: true, preferenze: { email: true } },
      { id: 'u_bar', ruolo: 'cliente', nome: 'Giovanni Russo (Bar Centrale)', email: 'bar.centrale@example.com', telefono: '091 000 2201', password: 'cliente2026', clienti: [C.bar.id], attivo: true, preferenze: { email: true } }
    ]);

    // Registro di partenza
    const registro = [
      { id: id('reg'), data: istante(-95, 8), utenteId: 'u_andrea', chi: 'Andrea Albino', azione: 'apertura', dettaglio: 'Configurazione iniziale del gestionale e import anagrafiche' }
    ];

    return {
      versione: 1, creato: new Date().toISOString(), aggiornato: new Date().toISOString(),
      azienda: { nome: 'IDRAL', ragioneSociale: 'IDRAL — Soluzioni per la tua CASA', piva: '[P.IVA da completare]', indirizzo: 'Via Villagrazia 120', cap: '90124', citta: 'Palermo', telefono: '035 000 0000', email: 'info@idral.it', pec: '', iban: '', sito: 'idral.it', tariffe: T, notificheEmail: true, fasciaAvvisi: { da: '07:30', a: '19:30' }, prezziDiEsempio: true },
      utenti, clienti, sedi, impianti, articoli, magazzini, movimenti, fornitori,
      interventi, preventivi, documenti, richieste, note, richiesteMateriale, ordini, conversazioni, allegati, contratti,
      avvisi, email, registro, coda: [], codaApplicate: [], contatori
    };
  };
})();
