# IDRAL — sito e gestionale (anteprima)

Sito vetrina di **IDRAL — Soluzioni per la tua CASA** e, sotto `/gestionale/`, la **demo navigabile** del gestionale con i tre accessi richiesti da Andrea Albino: titolare/ufficio, tecnico, cliente.

Sito statico: niente build, niente dipendenze. Si pubblica così com'è.

## Cosa c'è

| Percorso | Cosa |
|---|---|
| `/` | Home: servizi, metodo, area clienti, realizzazioni, recensioni, consigli, modulo preventivo, contatti |
| `/chi-siamo/` | Storia, missione, valori, squadra, certificazioni, partner |
| `/servizi/<servizio>/` | Impianti idraulici · Riscaldamento · Manutenzione · Bagni e ristrutturazioni (descrizione, vantaggi, processo, galleria, FAQ) |
| `/privacy/`, `/cookie/` | Bozze da validare con un legale |
| `/gestionale/` | Il gestionale (demo): app installabile sul telefono |

## Accessi di prova al gestionale

Nella pagina di accesso ci sono i pulsanti «Accessi di prova»: si entra con un tocco.

| Ruolo | Utente | Password |
|---|---|---|
| Titolare | andrea@idral.it | idral2026 |
| Ufficio | ufficio@idral.it | ufficio2026 |
| Tecnico | 333 100 0001 (Marco) | marco2026 |
| Cliente (amministratore, 3 condomini) | s.puglisi@example.com | cliente2026 |
| Cliente (privata) | g.trapani@example.com | cliente2026 |

Il cliente può entrare anche **senza password**, con il link «via email» (nella demo il link compare a schermo e finisce in «Posta in uscita»).

**Prova in tempo reale:** apri il gestionale in due finestre dello stesso browser, entra come titolare in una e come tecnico nell'altra: quello che chiude il tecnico compare all'ufficio senza ricaricare. Nell'app del tecnico il pulsante «Togli la rete» mostra la coda offline.

## ⚠️ È una demo

- I dati sono salvati **solo nel browser di chi la usa** (localStorage): ognuno vede la propria copia, niente è condiviso fra persone o dispositivi. Il pulsante «Riporta la demo all'inizio» ricarica i dati di prova.
- Le email e le notifiche non partono davvero: finiscono in «Posta in uscita» e negli avvisi.
- Il modulo preventivo del sito scrive la richiesta nel gestionale **dello stesso browser**.
- Il prodotto vero (OPERA, prompt master v1.2) ha database Postgres in UE con permessi per ruolo imposti dal database, accessi Supabase, email Resend e notifiche push.

## Pubblicazione

Vercel: *Add New → Project → importa questo repository → Deploy*. Nessuna impostazione (niente build command, cartella di output = radice). Ogni push su `main` va online da solo.

## Prima del go-live del sito vero

1. Sostituire tutti i segnaposto evidenziati in arancio (`class="ph"`): zona, indirizzo, telefono (`TEL` in `costruisci_sito.py`), P.IVA, storia, certificazioni, numeri.
2. Mettere le foto vere al posto dei riquadri colorati (`class="iz"`).
3. Togliere `noindex` dalle pagine e sostituire `robots.txt`, aggiungere la sitemap con il dominio definitivo.
4. Far validare privacy e cookie policy; se si aggiungono GA4/Meta Pixel serve il banner di consenso.
5. Collegare il modulo preventivo al gestionale vero (oggi scrive nella memoria del browser).

Le pagine del sito si rigenerano con `python3 costruisci_sito.py` (nella cartella di lavoro, non nel repository).
