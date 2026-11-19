# Account utenti di Campi Aperti — come attivarli (circa 15 minuti)

Il sito è statico (GitHub Pages) e non può custodire password da solo. Gli account usano **Supabase**:
un servizio con database PostgreSQL e autenticazione già pronti, gratuito per progetti piccoli.
Le password non passano mai dal codice di Campi Aperti verso altri servizi: Supabase le salva solo come hash
(bcrypt) e tutto viaggia in HTTPS. Ogni utente vede e modifica **solo i propri campi** grazie alle regole
*Row Level Security* scritte in `supabase/schema.sql`.

## 1. Crea il progetto (lo fai tu: l'account Supabase è tuo)
1. Vai su https://supabase.com → **Start your project** → accedi (anche con GitHub).
2. **New project**: nome `campi-aperti`, regione **Central EU (Frankfurt)** (dati nell'UE, GDPR),
   scegli una password del database robusta e conservala tu (non serve al sito, non mandarla a nessuno).

## 2. Crea le tabelle e le regole di sicurezza
1. Menu a sinistra **SQL Editor** → **New query**.
2. Incolla tutto il contenuto di `supabase/schema.sql` → **Run**. Deve rispondere "Success".

## 3. Impostazioni di accesso
1. **Authentication → Sign In / Providers → Email**: attivo, con **Confirm email** acceso.
2. **Authentication → Sign In / Providers → Email → Password**: lunghezza minima **10**, con lettere e numeri.
3. **Authentication → URL Configuration**:
   - Site URL: `https://francescorossi3.github.io/columella/`
   - Redirect URLs: aggiungi lo stesso indirizzo.
4. (Consigliato quando gli utenti diventano molti) **Authentication → Emails → SMTP Settings**: collega un servizio
   di invio email (es. Brevo, gratuito fino a 300 email al giorno). Il mittente predefinito di Supabase
   invia pochissime email l'ora ed è pensato solo per le prove.

## 4. Collega il sito
1. **Project Settings → API Keys**: copia **Project URL** e la chiave **anon / publishable**.
2. Inseriscile in `js/config.js` (oppure mandale a Claude: queste due sono pubbliche per costruzione).
3. **Mai** usare nel sito la chiave **service_role / secret**: dà accesso a tutto il database.

## 5. Cose da sapere
- Piano gratuito: database da 500 MB e 50.000 utenti attivi al mese; il progetto **va in pausa dopo una settimana
  senza accessi** (si riattiva dal pannello).
- Informativa privacy: `privacy.html`. Va completata con i dati del titolare del trattamento (nome e contatto).
- Gli utenti possono scaricare i propri dati e cancellare l'account dal sito (pulsante 👤).
- I campi che un utente segna come "condivisi" sono leggibili in forma anonima (senza utente né nome) solo con la
  chiave di servizio, che va messa nei **Secrets** di GitHub come `SUPABASE_SERVICE_KEY` se si vuole usarli per addestrare i modelli.

## Mappe pubbliche ed editori

- Rieseguire `supabase/schema.sql` nel SQL editor: crea le tabelle `editori` e `mappe_pubbliche` e il bucket pubblico `mappe` (50 MB per file).
- **Il tuo account è sempre editore**: Table editor → `impostazioni` → Insert row con `chiave` = `email_proprietario` e `valore` = la tua email
  (quella dell'account Columella, confermata). Da allora il tuo account può sempre pubblicare e rendere permanenti le mappe, anche senza riga in `editori`.
- **Dare il permesso di editore** ad altri: Authentication → Users → copiare lo *User UID*; poi Table editor → `editori` → Insert row con quel `user_id`
  (e una nota). Per toglierlo, cancellare la riga. Nessun utente può aggiungersi da solo: la tabella non ha regole di scrittura.
- Gli editori vedono nella tab **Mappe → Mappe pubbliche** il modulo "Pubblica una mappa" (GeoTIFF, GeoJSON o KML, titolo, fonte, licenza).
  Tutti, anche senza account, vedono e aprono le mappe pubblicate; ogni editore può togliere solo le proprie.
- In **Campi → Le mie mappe** ogni mappa caricata ha, per gli editori, il pulsante **Rendi permanente (pubblica)**: la mappa viene salvata nel
  bucket `mappe` e resta disponibile a tutti anche dopo aver chiuso il browser.
- **Aspetto delle mappe pubbliche**: ogni editore, dalla lista delle mappe pubbliche, apre una mappa con "🎨 Modifica aspetto", cambia scala colori,
  limiti, trasparenza, classi (raster) o colore, bordo e riempimento (vettori) e preme "💾 Salva aspetto per tutti". L'aspetto sta nella colonna
  `stile` di `mappe_pubbliche` e si cambia solo con la funzione `salva_stile_mappa` (controlla che l'utente sia editore e tocca solo quella colonna).
