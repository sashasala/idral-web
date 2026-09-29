/* =============================================================================
   IDRAL — gestionale (demo) · i documenti stampabili
   -----------------------------------------------------------------------------
   Rapportino, preventivo, documento di vendita. Un posto solo, cosi' ufficio e
   cliente vedono esattamente lo stesso foglio. Il PDF lo fa il browser
   («Stampa → Salva come PDF»): nel prodotto vero lo genera il server con
   pdf-lib e il logo dell'azienda (§14).
   ============================================================================= */
(function () {
  'use strict';
  const { h } = A;

  function intestazione(titolo, numero, dataDoc) {
    const az = A.DB.azienda;
    return `<div class="intesta">
      <div><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><span style="width:34px;height:34px;border-radius:10px;background:linear-gradient(145deg,#1892BC,#0A4A6B);display:grid;place-items:center"><svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M12 2C12 2 5 10.2 5 14.8 5 18.8 8.1 22 12 22s7-3.2 7-7.2C19 10.2 12 2 12 2z"/></svg></span><b style="font-size:20px;letter-spacing:-.03em">IDRAL</b></div>
        <div style="font-size:12px;color:#5C7787;line-height:1.5">${h(az.ragioneSociale)}<br>${h(az.indirizzo)} — ${h(az.cap)} ${h(az.citta)}<br>Tel. ${h(az.telefono)} · ${h(az.email)}<br>P.IVA ${h(az.piva)}</div></div>
      <div style="text-align:right"><h1>${h(titolo)}</h1><div style="font-size:15px;font-weight:700">${h(numero)}</div><div style="font-size:12.5px;color:#5C7787">${h(dataDoc)}</div></div>
    </div>`;
  }
  function bloccoCliente(c, s) {
    return `<table style="margin-bottom:6px"><tr>
      <td style="width:50%;vertical-align:top;border:0;padding-left:0"><div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#5C7787">Cliente</div><b>${h(c.nome)}</b><br>${c.referente ? h(c.referente) + '<br>' : ''}${c.piva ? 'P.IVA ' + h(c.piva) + '<br>' : c.cf ? 'C.F. ' + h(c.cf) + '<br>' : ''}${h(c.email || '')}</td>
      <td style="vertical-align:top;border:0"><div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#5C7787">Luogo dell'intervento</div>${s ? h(A.indirizzo(s)) + (s.nome && s.nome !== 'Sede principale' ? '<br>' + h(s.nome) : '') : '—'}</td></tr></table>`;
  }

  /** Rapportino di intervento. perCliente: nasconde note interne e foto non visibili al cliente. */
  function foglioRapportino(i, opz) {
    opz = opz || {};
    const c = A.cliente(i.clienteId), s = A.sede(i.sedeId), m = i.impiantoId ? A.impianto(i.impiantoId) : null;
    const r = i.rapporto || {};
    const min = A.minutiIntervento(i);
    const foto = (r.foto || []).filter(f => !opz.perCliente || f.visibileCliente);
    const firma = r.firma;
    return `<div class="foglio">
      ${intestazione('Rapporto di intervento', 'N. ' + i.numero, A.data(i.data))}
      ${bloccoCliente(c, s)}
      <h2>Il lavoro</h2>
      <table><tr><th style="width:30%">Tipo</th><td>${h(A.TIPI_INTERVENTO[i.tipo] || i.tipo)}</td></tr>
        <tr><th>Tecnici</th><td>${h(A.nomeTecnici(i.tecnici))}</td></tr>
        ${m ? `<tr><th>Macchina</th><td>${h(m.marca + ' ' + m.modello)}${m.matricola ? ' — matricola <b>' + h(m.matricola) + '</b>' : ''}</td></tr>` : ''}
        <tr><th>Richiesta</th><td>${h(i.richiesta || '—')}</td></tr>
        <tr><th>Lavoro eseguito</th><td>${h(r.lavoro || '—')}</td></tr>
        ${r.trovato ? `<tr><th>Cosa abbiamo trovato</th><td>${h(r.trovato)}</td></tr>` : ''}
        ${r.consiglio ? `<tr><th>Cosa consigliamo</th><td>${h(r.consiglio)}</td></tr>` : ''}
        <tr><th>Esito</th><td><b>${h(A.ESITI[r.esito] || '—')}</b>${r.secondoIntervento ? ' — serve un secondo intervento' : ''}</td></tr>
      </table>
      <h2>Ore</h2>
      <table><thead><tr><th>Voce</th><th class="num">Tempo</th></tr></thead><tbody>
        ${Object.keys(A.TIPI_ORE).filter(k => min[k]).map(k => `<tr><td>${A.TIPI_ORE[k]}</td><td class="num">${A.durata(min[k])}</td></tr>`).join('') || '<tr><td colspan="2">—</td></tr>'}
      </tbody></table>
      <h2>Materiale utilizzato</h2>
      <table><thead><tr><th>Descrizione</th><th class="num">Quantità</th></tr></thead><tbody>
        ${(r.materiali || []).map(x => `<tr><td>${h(x.nome)}</td><td class="num">${A.num(x.qta)} ${h(x.unita || '')}</td></tr>`).join('') || '<tr><td colspan="2">Nessun materiale</td></tr>'}
      </tbody></table>
      ${foto.length ? `<h2>Fotografie</h2><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${foto.map(f => `<div><img src="${h(f.src)}" alt="" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;border:1px solid #DCE5EA"><div style="font-size:11px;color:#5C7787">${h(A.FASI_FOTO[f.fase] || f.fase)}</div></div>`).join('')}</div>` : ''}
      ${!opz.perCliente && r.note ? `<h2>Note per l'ufficio (non stampate per il cliente)</h2><p>${h(r.note)}</p>` : ''}
      <h2>Firma del cliente</h2>
      ${firma && !firma.assente && firma.png ? `<div style="display:flex;gap:20px;align-items:flex-end"><img src="${h(firma.png)}" alt="Firma" style="width:240px;border-bottom:1px solid #0A4A6B"><div style="font-size:12.5px">${h(firma.nome)}${firma.qualifica ? ' (' + h(firma.qualifica) + ')' : ''}<br>${A.dataOra(firma.data)}</div></div>`
        : firma && firma.assente ? `<p><b>Cliente non presente alla chiusura.</b> Motivo: ${h(firma.motivo || '—')}</p>` : '<p>—</p>'}
      <div class="piede">Firma elettronica semplice raccolta sul dispositivo del tecnico. Il rapportino è stato ${r.stato === 'approvato' ? 'approvato dall\'ufficio il ' + A.dataOra(r.approvatoIl) : 'inviato all\'ufficio il ' + A.dataOra(r.inviatoIl)}.</div>
    </div>`;
  }

  function foglioPreventivo(p) {
    const c = A.cliente(p.clienteId), s = A.sede(p.sedeId);
    const t = A.totaliPreventivo(p);
    const righe = (p.righe || []).filter(r => !r.opzionale || r.scelta);
    const opzionali = (p.righe || []).filter(r => r.opzionale && !r.scelta);
    const riga = r => r.tipo === 'nota' ? `<tr><td colspan="6" style="font-style:italic;color:#334F5E">${h(r.descrizione)}</td></tr>` :
      `<tr><td>${h(r.descrizione)}${r.opzionale ? ' <span style="font-size:11px;color:#15704A">(voce facoltativa scelta)</span>' : ''}</td><td class="num">${A.num(r.qta)} ${h(r.unita || '')}</td><td class="num">${A.euro(r.prezzo)}</td><td class="num">${r.sconto ? A.num(r.sconto) + '%' : ''}</td><td class="num">${A.num(r.iva === undefined ? 22 : r.iva, 0)}%</td><td class="num">${A.euro((r.qta || 0) * (r.prezzo || 0) * (1 - (r.sconto || 0) / 100))}</td></tr>`;
    return `<div class="foglio">
      ${intestazione('Preventivo', 'N. ' + p.numero + (p.versione > 1 ? ' — rev. ' + p.versione : ''), 'del ' + A.data(p.creato) + ' · valido fino al ' + A.data(p.validoFino))}
      ${bloccoCliente(c, s)}
      <h2>Oggetto</h2><p style="font-size:15px;font-weight:600">${h(p.oggetto)}</p>
      <h2>Voci</h2>
      <table><thead><tr><th>Descrizione</th><th class="num">Q.tà</th><th class="num">Prezzo</th><th class="num">Sconto</th><th class="num">IVA</th><th class="num">Importo</th></tr></thead><tbody>${righe.map(riga).join('')}</tbody></table>
      <table class="totali"><tr><td>Imponibile</td><td class="num">${A.euro(t.imponibile)}</td></tr>
        ${Object.keys(t.perAliquota).map(al => `<tr><td>IVA ${al}% su ${A.euro(t.perAliquota[al])}</td><td class="num">${A.euro(t.perAliquota[al] * al / 100)}</td></tr>`).join('')}
        <tr class="tot"><td>Totale</td><td class="num">${A.euro(t.totale)}</td></tr></table>
      ${opzionali.length ? `<h2>Voci facoltative (non incluse nel totale)</h2><table><tbody>${opzionali.map(r => `<tr><td>${h(r.descrizione)}</td><td class="num">${A.num(r.qta)} ${h(r.unita || '')}</td><td class="num">${A.euro(r.qta * r.prezzo)} + IVA</td></tr>`).join('')}</tbody></table>` : ''}
      ${p.note ? `<h2>Note</h2><p>${h(p.note)}</p>` : ''}
      <h2>Condizioni</h2><p>${h(p.condizioni || '')}</p>
      ${p.decisione ? `<div style="margin-top:18px;padding:12px 14px;border:1.5px solid ${p.decisione.esito === 'accettato' ? '#C6E3D5' : '#F3D2D2'};border-radius:8px;background:${p.decisione.esito === 'accettato' ? '#E6F4EE' : '#FCEBEB'};font-size:12.5px">
          <b>${p.decisione.esito === 'accettato' ? 'Accettato' : 'Rifiutato'} online</b> da ${h(p.decisione.nome)} il ${A.dataOra(p.decisione.data)}${p.decisione.ua ? ' · ' + h(p.decisione.ua) : ''}${p.decisione.motivo ? '<br>Motivo: ' + h(p.decisione.motivo) : ''}${p.decisione.hash ? '<br><span style="font-family:monospace;font-size:10.5px">Impronta del documento accettato (SHA-256): ' + h(p.decisione.hash) + '</span>' : ''}</div>` : ''}
      <div class="piede">Le aliquote IVA indicate sono da confermare in base al tipo di lavoro e di immobile. Il presente preventivo non è un documento fiscale.</div>
    </div>`;
  }

  /** Totali di un documento di vendita (pre-fattura). */
  function totaliDocumento(d) {
    let lordo = 0; const perAl = {};
    (d.righe || []).forEach(r => { const t = A.arrot((r.qta || 0) * (r.prezzo || 0)); lordo += t; perAl[r.iva] = (perAl[r.iva] || 0) + t; });
    const sconto = A.arrot(lordo * (d.sconto || 0) / 100);
    const imponibile = A.arrot(lordo - sconto);
    let iva = 0; Object.keys(perAl).forEach(al => iva += perAl[al] * (1 - (d.sconto || 0) / 100) * al / 100);
    iva = A.arrot(iva);
    return { lordo: A.arrot(lordo), sconto, imponibile, iva, totale: A.arrot(imponibile + iva) };
  }
  A.totaliDocumento = totaliDocumento;

  function foglioDocumento(d) {
    const c = A.cliente(d.clienteId);
    const t = totaliDocumento(d);
    const perInt = {};
    (d.righe || []).forEach(r => { (perInt[r.interventoId || '_'] = perInt[r.interventoId || '_'] || []).push(r); });
    return `<div class="foglio">
      ${intestazione('Documento di vendita', 'N. PRE-' + d.numero, 'del ' + A.data(d.creato))}
      ${bloccoCliente(c, null)}
      <h2>Lavori eseguiti</h2>
      <table><thead><tr><th>Descrizione</th><th class="num">Q.tà</th><th class="num">Prezzo</th><th class="num">IVA</th><th class="num">Importo</th></tr></thead><tbody>
      ${Object.keys(perInt).map(k => { const i = A.intervento(k); return (i ? `<tr><td colspan="5" style="background:#F4F7F9;font-weight:700">Intervento ${h(i.numero)} del ${A.data(i.data)} — ${h(A.TIPI_INTERVENTO[i.tipo])}${i.modalita === 'garanzia' ? ' (in garanzia)' : i.modalita === 'contratto' ? ' (compreso nel contratto)' : ''}</td></tr>` : '') + perInt[k].map(r => `<tr><td>${h(r.descrizione)}</td><td class="num">${A.num(r.qta)} ${h(r.unita || '')}</td><td class="num">${A.euro(r.prezzo)}</td><td class="num">${A.num(r.iva, 0)}%</td><td class="num">${A.euro(r.qta * r.prezzo)}</td></tr>`).join(''); }).join('')}
      </tbody></table>
      <table class="totali"><tr><td>Totale voci</td><td class="num">${A.euro(t.lordo)}</td></tr>
        ${d.sconto ? `<tr><td>Sconto ${A.num(d.sconto)}%</td><td class="num">−${A.euro(t.sconto)}</td></tr>` : ''}
        <tr><td>Imponibile</td><td class="num">${A.euro(t.imponibile)}</td></tr>
        <tr><td>IVA (${h(d.regimeIva)})</td><td class="num">${A.euro(t.iva)}</td></tr>
        <tr class="tot"><td>Totale</td><td class="num">${A.euro(t.totale)}</td></tr></table>
      ${d.note ? `<h2>Note</h2><p>${h(d.note)}</p>` : ''}
      ${d.fattura ? `<p style="margin-top:14px;font-weight:600">Fatturato con fattura n. ${h(d.fattura.numero)} del ${A.data(d.fattura.data)}.</p>` : ''}
      <div class="nonfiscale">Documento NON fiscale. Riepiloga i lavori eseguiti e il loro valore; la fattura viene emessa separatamente dal software di fatturazione dell'azienda. Il regime IVA è riportato, non calcolato: va confermato in fattura.</div>
    </div>`;
  }

  /** Una pagina di stampa: barra con «Stampa / Salva PDF» + foglio. */
  function paginaStampa(foglio, indietro) {
    return `<div class="barra-stampa no-stampa"><a class="btn" href="${indietro || 'javascript:history.back()'}">${A.icona('indietro')} Indietro</a><button class="btn pri" onclick="window.print()">${A.icona('stampa')} Stampa o salva PDF</button></div>${foglio}`;
  }

  /**
   * PDF minimale (testo semplice) per gli allegati di prova: nella demo i
   * documenti caricati «per finta» devono comunque aprirsi quando li scarichi.
   */
  function pdfSemplice(titolo, righe) {
    const pul = s => String(s).replace(/[^\x20-\xFF]/g, '?').replace(/([()\\])/g, '\\$1');
    const testo = ['BT /F1 18 Tf 56 780 Td (' + pul(titolo) + ') Tj ET'].concat((righe || []).map((r, i) => 'BT /F1 11 Tf 56 ' + (748 - i * 18) + ' Td (' + pul(r) + ') Tj ET')).join('\n');
    const ogg = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      '<< /Length ' + testo.length + ' >>\nstream\n' + testo + '\nendstream'
    ];
    let pdf = '%PDF-1.4\n'; const off = [];
    ogg.forEach((o, i) => { off.push(pdf.length); pdf += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
    const xref = pdf.length;
    pdf += 'xref\n0 ' + (ogg.length + 1) + '\n0000000000 65535 f \n' + off.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
    pdf += 'trailer\n<< /Size ' + (ogg.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
    const b = new Uint8Array(pdf.length); for (let i = 0; i < pdf.length; i++) b[i] = pdf.charCodeAt(i) & 255;
    return new Blob([b], { type: 'application/pdf' });
  }
  /** Scarica un allegato: se ha un file vero (dataUrl) quello, altrimenti un PDF di prova. */
  function scaricaAllegato(al) {
    if (al.dataUrl) { const a = document.createElement('a'); a.href = al.dataUrl; a.download = al.nomeFile || al.nome; document.body.appendChild(a); a.click(); a.remove(); return; }
    const c = A.cliente(al.clienteId);
    A.scarica((al.nome || 'documento').replace(/[^\w\- àèéìòù]+/gi, '_').slice(0, 60) + '.pdf', pdfSemplice(al.nome, ['Cliente: ' + (c ? c.nome : ''), 'Data: ' + A.data(al.data), '', 'Documento di prova della demo IDRAL.', 'Nel gestionale vero qui c\'e\' il file caricato dall\'ufficio.']));
  }

  Object.assign(A, { foglioRapportino, foglioPreventivo, foglioDocumento, paginaStampa, pdfSemplice, scaricaAllegato });
})();
