# Droppmoney 📊

App personale per il monitoraggio del portafoglio finanziario.

## Struttura del progetto

```
droppmoney/
├── data/
│   ├── portfolio5.csv          ← i tuoi dati (aggiorni da Mac)
│   ├── categorie.csv           ← mapping ticker → categoria
│   └── output/                 ← generato automaticamente da GitHub Actions
│       ├── summary.json
│       ├── nav_giornaliero.json
│       ├── posizioni.json
│       └── categorie.json
├── src/                        ← app React (non toccare)
├── .github/workflows/
│   ├── aggiorna.yml            ← ricalcola dati ogni giorno alle 18:00
│   └── deploy.yml              ← pubblica app su GitHub Pages ad ogni push
├── calcolo_giornaliero.py      ← script Python adattato
├── vite.config.js
└── package.json
```

---

## Setup iniziale (una volta sola)

### 1. Crea il repo su GitHub
```bash
git init
git remote add origin https://github.com/TUO_USERNAME/droppmoney.git
```

### 2. Copia i tuoi CSV nella cartella /data
```bash
cp /Users/filipposapienzaa/dashboard/portfolio5.csv data/
cp /Users/filipposapienzaa/dashboard/categorie.csv data/
```

### 3. Modifica App.jsx — inserisci il tuo username GitHub
Apri `src/App.jsx` e cambia le righe in cima:
```js
const GITHUB_USER = "TUO_USERNAME";   // ← il tuo username GitHub
const GITHUB_REPO = "droppmoney";     // ← nome del repo
```

### 4. Modifica vite.config.js
```js
base: '/droppmoney/',   // ← deve corrispondere al nome del repo
```

### 5. Push iniziale
```bash
git add .
git commit -m "🚀 Setup iniziale Droppmoney"
git push -u origin main
```

### 6. Abilita GitHub Pages
1. Vai su GitHub → repository → **Settings** → **Pages**
2. In "Source" seleziona **GitHub Actions**
3. Salva

### 7. Prima esecuzione manuale dello script dati
1. Vai su GitHub → **Actions** → "Aggiorna Dati Portafoglio"
2. Clicca **Run workflow**
3. Attendi ~2 minuti
4. I file JSON appaiono in `data/output/`

---

## Aggiornamento quotidiano (automatico)

GitHub Actions esegue `calcolo_giornaliero.py` ogni giorno feriale alle 18:00 CET.
Lo script scarica i prezzi da Yahoo Finance e aggiorna i JSON in `data/output/`.

---

## Aggiornare i dati manualmente dal Mac

Quando aggiungi nuovi investimenti al CSV:

```bash
# 1. Modifica portfolio5.csv con il nuovo acquisto/vendita
# 2. Dal terminale nella cartella del progetto:
git add data/portfolio5.csv
git commit -m "📈 Nuovo investimento: TICKER"
git push

# GitHub Actions si occuperà di ricalcolare tutto automaticamente
```

---

## Accesso all'app

L'app sarà disponibile all'indirizzo:
```
https://TUO_USERNAME.github.io/droppmoney/
```

Su iPhone: apri Safari → vai sull'URL → tasto condividi → **"Aggiungi alla schermata Home"**

---

## Sviluppo locale

```bash
npm install
npm run dev
# App disponibile su http://localhost:5173
```
