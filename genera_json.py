"""
genera_json.py
==============
Legge i CSV locali e genera tutti i JSON per l'app Droppmoney.
Eseguilo ogni volta che vuoi aggiornare i dati senza attendere GitHub Actions.

Uso:
    python genera_json.py

Output in: data/output/
"""

import pandas as pd
import numpy as np
import json
import os
from datetime import datetime

# ============================================================
# CONFIGURAZIONE — modifica questi percorsi se necessario
# ============================================================
BASE_DIR        = os.path.dirname(os.path.abspath(__file__))
PORTFOLIO_CSV   = os.path.join(BASE_DIR, "data", "portfolio5.csv")
CATEGORIE_CSV   = os.path.join(BASE_DIR, "data", "categorie.csv")
STORICI_CSV     = os.path.join(BASE_DIR, "data", "dati_storici.csv")
PORTAFOGLIO_CSV = os.path.join(BASE_DIR, "data", "portafoglio_giornaliero.csv")
OUTPUT_DIR      = os.path.join(BASE_DIR, "data", "output")

PREZZO_OBBLIGAZIONE = 19.99
TICKERS_USD = ['TSLA', 'NVDA', 'CVS', 'CVX', 'AMD']
SPARKLINE_DAYS = 30   # giorni di storico per le sparkline

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ============================================================
# 1. CARICAMENTO DATI
# ============================================================
print(">>> Caricamento CSV...")

# Portfolio
df = pd.read_csv(PORTFOLIO_CSV, sep=";")
df['importo']     = df['importo'].astype(str).str.replace(',', '.').astype(float)
df['importo']     = pd.to_numeric(df['importo'], errors='coerce')
df['commissioni'] = pd.to_numeric(df['commissioni'], errors='coerce').fillna(0)
df['quantità']    = pd.to_numeric(df['quantità'], errors='coerce')
df['data']        = pd.to_datetime(df['data'], dayfirst=True)
df['ticker']      = df['ticker'].str.strip()
df['categoria']   = df['categoria'].str.strip().str.capitalize()
df = df.sort_values('data')

# Dati storici prezzi
storici = pd.read_csv(STORICI_CSV, sep=';', parse_dates=['Date'])
storici.set_index('Date', inplace=True)
storici = storici.sort_index()

# Portafoglio giornaliero (NAV)
nav_df = pd.read_csv(PORTAFOGLIO_CSV, parse_dates=['Date'])
nav_df = nav_df.rename(columns={'Date': 'data'})
nav_df = nav_df.sort_values('data')

# Categorie mapping
try:
    cat_df  = pd.read_csv(CATEGORIE_CSV, sep=";")
    cat_map = dict(zip(cat_df['ticker'], cat_df['categoria']))
except FileNotFoundError:
    cat_map = dict(zip(df['ticker'], df['categoria']))

print(f"    Portfolio: {len(df)} righe")
print(f"    Storici:   {len(storici)} giorni, {len(storici.columns)} ticker")
print(f"    NAV:       {len(nav_df)} giorni")

# ============================================================
# 2. PREZZI ATTUALI E VARIAZIONE GIORNALIERA
# ============================================================
prezzi_oggi = storici.iloc[-1].to_dict()
prezzi_ieri = storici.iloc[-2].to_dict() if len(storici) >= 2 else {}

def var_pct(ticker, p_oggi, p_ieri_dict):
    p_ieri = p_ieri_dict.get(ticker)
    if p_ieri and p_ieri > 0 and p_oggi and p_oggi > 0:
        return round((p_oggi - p_ieri) / p_ieri * 100, 2)
    return 0.0

# ============================================================
# 3. CALCOLO PMC, QUANTITÀ, P&L PER TICKER
# ============================================================
print(">>> Calcolo PMC e P&L per ticker...")

df_no_obbl = df[df['ticker'] != 'OBBL2030'].copy()
df_obbl    = df[df['ticker'] == 'OBBL2030'].copy()

# PMC = importo_totale / quantità_totale per ticker
pmc_rows = []
for ticker, grp in df_no_obbl.groupby('ticker'):
    qty_tot    = grp['quantità'].sum()
    importo_tot = grp['importo'].sum()
    pmc        = round(importo_tot / qty_tot, 4) if qty_tot > 0 else 0
    titolo     = grp['titolo'].iloc[-1] if 'titolo' in grp.columns else ticker
    categoria  = cat_map.get(ticker, grp['categoria'].iloc[-1] if 'categoria' in grp.columns else 'Altro')

    p_oggi = prezzi_oggi.get(ticker, 0) or 0
    var    = var_pct(ticker, p_oggi, prezzi_ieri)
    valore = round(qty_tot * p_oggi, 2)
    pl_eur = round(valore - importo_tot, 2)
    pl_pct = round((p_oggi - pmc) / pmc * 100, 2) if pmc > 0 else 0

    pmc_rows.append({
        'ticker':          ticker,
        'titolo':          titolo,
        'categoria':       categoria,
        'quantità_totale': round(qty_tot, 6),
        'pmc':             pmc,
        'prezzo_attuale':  round(p_oggi, 4),
        'valore_attuale':  valore,
        'var_oggi_pct':    var,
        'var_oggi_eur':    round(valore * var / 100, 2),
        'pl_eur':          pl_eur,
        'pl_pct':          pl_pct,
    })

# Obbligazione
if len(df_obbl) > 0:
    qty_obbl = df_obbl['quantità'].sum()
    imp_obbl = df_obbl['importo'].sum()
    pmc_obbl = round(imp_obbl / qty_obbl, 4) if qty_obbl > 0 else PREZZO_OBBLIGAZIONE
    val_obbl = round(qty_obbl * PREZZO_OBBLIGAZIONE, 2)
    pmc_rows.append({
        'ticker':          'OBBL2030',
        'titolo':          'Obbligazione 2030',
        'categoria':       'Obbligazioni',
        'quantità_totale': round(qty_obbl, 2),
        'pmc':             pmc_obbl,
        'prezzo_attuale':  PREZZO_OBBLIGAZIONE,
        'valore_attuale':  val_obbl,
        'var_oggi_pct':    0.0,
        'var_oggi_eur':    0.0,
        'pl_eur':          round(val_obbl - imp_obbl, 2),
        'pl_pct':          round((PREZZO_OBBLIGAZIONE - pmc_obbl) / pmc_obbl * 100, 2) if pmc_obbl > 0 else 0,
    })

posizioni_df = pd.DataFrame(pmc_rows)
valore_totale_att = posizioni_df['valore_attuale'].sum()
posizioni_df['peso_percentuale'] = (posizioni_df['valore_attuale'] / valore_totale_att * 100).round(2)
posizioni_df = posizioni_df.sort_values('peso_percentuale', ascending=False)

# ============================================================
# 4. SPARKLINE REALI (ultimi N giorni per ogni ticker)
# ============================================================
print(f">>> Generazione sparkline ({SPARKLINE_DAYS} giorni)...")

sparklines = {}
ultimi = storici.tail(SPARKLINE_DAYS)

for ticker in posizioni_df['ticker']:
    if ticker in ultimi.columns:
        vals = ultimi[ticker].dropna().tolist()
        sparklines[ticker] = [round(v, 4) for v in vals]
    elif ticker == 'OBBL2030':
        sparklines[ticker] = [PREZZO_OBBLIGAZIONE] * SPARKLINE_DAYS
    else:
        sparklines[ticker] = []

# Aggiungi sparkline a posizioni
posizioni_df['sparkline'] = posizioni_df['ticker'].map(sparklines)

# ============================================================
# 5. CATEGORIE
# ============================================================
cat_group = posizioni_df.groupby('categoria')['valore_attuale'].sum().reset_index()
cat_group['peso_percentuale'] = (cat_group['valore_attuale'] / cat_group['valore_attuale'].sum() * 100).round(2)
cat_group['valore_attuale']   = cat_group['valore_attuale'].round(2)

# Ticker pie
ticker_pie = posizioni_df[['ticker','categoria','valore_attuale','peso_percentuale']].copy()

# ============================================================
# 6. SUMMARY
# ============================================================
capitale_versato = df['importo'].sum()
costo_totale     = capitale_versato + df['commissioni'].sum()
profitto_lordo   = valore_totale_att - capitale_versato
profitto_lordo_pct = round(profitto_lordo / capitale_versato * 100, 2) if capitale_versato > 0 else 0
profitto_netto_pct = round((valore_totale_att - costo_totale) / costo_totale * 100, 2) if costo_totale > 0 else 0

# Variazione ieri a livello portafoglio
if len(nav_df) >= 2:
    v_oggi = float(nav_df['valore_totale'].iloc[-1])
    v_ieri = float(nav_df['valore_totale'].iloc[-2])
    var_ieri     = round(v_oggi - v_ieri, 2)
    var_ieri_pct = round((v_oggi - v_ieri) / v_ieri * 100, 2) if v_ieri > 0 else 0
else:
    var_ieri = var_ieri_pct = 0

summary = {
    "aggiornato_il":     datetime.now().strftime('%Y-%m-%d %H:%M'),
    "valore_totale":     round(valore_totale_att, 2),
    "capitale_versato":  round(capitale_versato, 2),
    "profitto_lordo":    round(profitto_lordo, 2),
    "profitto_lordo_pct": profitto_lordo_pct,
    "profitto_netto_pct": profitto_netto_pct,
    "variazione_ieri":   var_ieri,
    "variazione_ieri_pct": var_ieri_pct,
    "n_posizioni":       int(posizioni_df['ticker'].nunique()),
    "n_categorie":       int(cat_group['categoria'].nunique()),
}

# ============================================================
# 7. SALVATAGGIO JSON
# ============================================================
print(">>> Salvataggio JSON...")

# posizioni.json
posizioni_df.to_json(
    os.path.join(OUTPUT_DIR, "posizioni.json"),
    orient='records', indent=2, default_handler=str
)

# categorie.json
cat_group.to_json(
    os.path.join(OUTPUT_DIR, "categorie.json"),
    orient='records', indent=2
)

# ticker_pie.json
ticker_pie.to_json(
    os.path.join(OUTPUT_DIR, "ticker_pie.json"),
    orient='records', indent=2
)

# summary.json
with open(os.path.join(OUTPUT_DIR, "summary.json"), 'w') as f:
    json.dump(summary, f, indent=2)

# nav_giornaliero.json (da portafoglio_giornaliero.csv)
nav_out = nav_df[nav_df['valore_totale'] > 0].copy()
nav_out['data'] = nav_out['data'].dt.strftime('%Y-%m-%d')
nav_out.to_json(
    os.path.join(OUTPUT_DIR, "nav_giornaliero.json"),
    orient='records', indent=2
)

# sparklines.json — separato, usato dalla UI per i grafici
with open(os.path.join(OUTPUT_DIR, "sparklines.json"), 'w') as f:
    json.dump(sparklines, f, indent=2)

print(f"""
>>> Completato ✅
    Valore portafoglio: € {valore_totale_att:,.2f}
    Profitto lordo:     € {profitto_lordo:,.2f} ({profitto_lordo_pct:+.2f}%)
    Var. oggi:          € {var_ieri:+,.2f} ({var_ieri_pct:+.2f}%)
    Posizioni:          {summary['n_posizioni']}
    JSON salvati in:    {OUTPUT_DIR}
""")

if __name__ == "__main__":
    pass
