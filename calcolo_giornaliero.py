import pandas as pd
import yfinance as yf
import warnings
import numpy as np
import json
import os
from datetime import datetime

warnings.filterwarnings("ignore")

def aggiorna_dati():
    prezzo_obbligazione = 19.99

    print(">>> Avvio elaborazione dati...")

    # === CARICAMENTO CSV (dalla cartella /data del repo) ===
    BASE = os.path.join(os.path.dirname(__file__), "data")

    df = pd.read_csv(os.path.join(BASE, "portfolio5.csv"), sep=";")
    df['importo'] = df['importo'].astype(str).str.replace(',', '.').astype(float)
    df['importo'] = pd.to_numeric(df['importo'], errors='coerce')
    df['commissioni'] = pd.to_numeric(df['commissioni'], errors='coerce')
    df['quantità'] = pd.to_numeric(df['quantità'], errors='coerce')
    df['data'] = pd.to_datetime(df['data'], dayfirst=True)
    df.set_index('data', inplace=True)
    df.sort_index(inplace=True)
    df['ticker'] = df['ticker'].str.strip()
    df['categoria'] = df['categoria'].str.strip().str.capitalize()

    df_obbl = df[df['ticker'] == 'OBBL2030'].copy()
    df1 = df[df['ticker'] != 'OBBL2030'].copy()

    tickers_azionari = df1['ticker'].unique().tolist()
    tickers_usd = ['TSLA', 'NVDA', 'CVS', 'CVX', 'AMD']

    # === DOWNLOAD YFINANCE ===
    start_date = '2024-11-13'
    end_date = pd.Timestamp.today().strftime('%Y-%m-%d')
    lista_download = tickers_azionari + ['EURUSD=X']

    print(">>> Download dati da Yahoo Finance...")
    dati_yf = yf.download(lista_download, start=start_date, end=end_date)['Close']
    if isinstance(dati_yf, pd.Series):
        dati_yf = dati_yf.to_frame()

    dati_storici = dati_yf.ffill().bfill()
    prezzi_attuali = dati_storici.iloc[-1].to_dict()
    eur_usd_attuale = prezzi_attuali.get('EURUSD=X', 1.0)
    usd_to_eur_attuale = 1 / eur_usd_attuale if eur_usd_attuale else 1.0

    # === VALORI ATTUALI ===
    df1['prezzo_attuale'] = df1['ticker'].map(prezzi_attuali)
    df1['prezzo_attuale'] = np.where(
        df1['ticker'].isin(tickers_usd),
        df1['prezzo_attuale'] * usd_to_eur_attuale,
        df1['prezzo_attuale'])
    df1['valore_attuale'] = df1['quantità'] * df1['prezzo_attuale']

    df_obbl['prezzo_attuale'] = prezzo_obbligazione
    df_obbl['valore_attuale'] = df_obbl['quantità'] * df_obbl['prezzo_attuale']

    df_categorie = pd.concat([df1, df_obbl], ignore_index=True)

    # === PESI PER CATEGORIA ===
    valori_per_categoria = df_categorie.groupby('categoria')['valore_attuale'].sum().reset_index()
    valori_per_categoria['peso_percentuale'] = (
        valori_per_categoria['valore_attuale'] / valori_per_categoria['valore_attuale'].sum() * 100
    )

    # === VALORI PER TICKER ===
    valori_per_ticker = df_categorie.groupby('ticker')['valore_attuale'].sum().reset_index()
    valori_per_ticker['peso_percentuale'] = (
        valori_per_ticker['valore_attuale'] / valori_per_ticker['valore_attuale'].sum() * 100
    )
    df_prezzi_unici = df_categorie[['ticker', 'prezzo_attuale']].drop_duplicates()
    valori_per_ticker = valori_per_ticker.merge(df_prezzi_unici, on='ticker', how='left')
    df_titoli = df_categorie[['ticker', 'titolo']].drop_duplicates()
    valori_per_ticker = pd.merge(valori_per_ticker, df_titoli, on='ticker', how='outer')

    try:
        categorie = pd.read_csv(os.path.join(BASE, "categorie.csv"), sep=";")
        cat_map = dict(zip(categorie['ticker'], categorie['categoria']))
        valori_per_ticker['categoria'] = valori_per_ticker['ticker'].map(cat_map)
    except FileNotFoundError:
        cat_map = dict(zip(df_categorie['ticker'], df_categorie['categoria']))
        valori_per_ticker['categoria'] = valori_per_ticker['ticker'].map(cat_map)

    # === VARIAZIONE GIORNALIERA PER TICKER ===
    # Prezzo di ieri (penultima riga disponibile nei dati storici)
    if len(dati_storici) >= 2:
        prezzi_ieri = dati_storici.iloc[-2].to_dict()
    else:
        prezzi_ieri = {}

    def var_giornaliera(row):
        ticker = row['ticker']
        p_oggi = row['prezzo_attuale']
        p_ieri_raw = prezzi_ieri.get(ticker, None)
        if ticker in tickers_usd and 'EURUSD=X' in dati_yf.columns:
            eur_usd_ieri = float(dati_yf['EURUSD=X'].iloc[-2]) if len(dati_yf) >= 2 else eur_usd_attuale
            p_ieri = float(p_ieri_raw) * (1 / eur_usd_ieri) if p_ieri_raw else None
        else:
            p_ieri = float(p_ieri_raw) if p_ieri_raw else None
        if p_ieri and p_ieri > 0 and p_oggi:
            return round((p_oggi - p_ieri) / p_ieri * 100, 2)
        return 0.0

    valori_per_ticker['var_oggi_pct'] = valori_per_ticker.apply(var_giornaliera, axis=1)
    valori_per_ticker['var_oggi_eur'] = (
        valori_per_ticker['valore_attuale'] * valori_per_ticker['var_oggi_pct'] / 100
    ).round(2)

    # === PREZZO MEDIO DI CARICO (PMC) PER TICKER ===
    pmc_data = df_categorie.groupby('ticker').apply(
        lambda g: round(g['importo'].sum() / g['quantità'].sum(), 4) if g['quantità'].sum() > 0 else 0
    ).reset_index()
    pmc_data.columns = ['ticker', 'pmc']
    qty_data = df_categorie.groupby('ticker')['quantità'].sum().reset_index()
    qty_data.columns = ['ticker', 'quantità_totale']

    valori_per_ticker = valori_per_ticker.merge(pmc_data, on='ticker', how='left')
    valori_per_ticker = valori_per_ticker.merge(qty_data, on='ticker', how='left')

    # P&L totale per posizione
    valori_per_ticker['pl_eur'] = (
        valori_per_ticker['valore_attuale'] -
        valori_per_ticker['pmc'] * valori_per_ticker['quantità_totale']
    ).round(2)
    valori_per_ticker['pl_pct'] = np.where(
        valori_per_ticker['pmc'] > 0,
        ((valori_per_ticker['prezzo_attuale'] - valori_per_ticker['pmc']) / valori_per_ticker['pmc'] * 100).round(2),
        0.0
    )

    valori_per_ticker = valori_per_ticker.sort_values(
        by=['categoria', 'peso_percentuale'], ascending=[True, False])

    # === CONVERSIONE STORICA VALUTE ===
    if 'EURUSD=X' in dati_storici.columns:
        usd_to_eur_storico = 1 / dati_storici['EURUSD=X']
        dati_storici.drop(columns=['EURUSD=X'], inplace=True)
    else:
        usd_to_eur_storico = 1.0

    for ticker in tickers_usd:
        if ticker in dati_storici.columns:
            dati_storici[ticker] = dati_storici[ticker] * usd_to_eur_storico

    dati_storici['OBBL2030'] = prezzo_obbligazione

    # === NAV GIORNALIERO ===
    print(">>> Calcolo NAV giornaliero...")
    df3 = pd.concat([df1, df_obbl], ignore_index=False).sort_index()
    portafoglio_giornaliero = pd.DataFrame(index=dati_storici.index)

    flussi_giornalieri = df3.groupby(df3.index).agg({'importo': 'sum', 'commissioni': 'sum'})
    flussi_espansi = flussi_giornalieri.reindex(dati_storici.index).fillna(0)

    portafoglio_giornaliero["capitale_versato"] = flussi_espansi['importo'].cumsum().astype(float)
    portafoglio_giornaliero["costo_totale"] = (
        portafoglio_giornaliero["capitale_versato"] + flussi_espansi['commissioni'].cumsum()
    ).astype(float)

    qty_trades = df3.groupby([df3.index, 'ticker'])['quantità'].sum().unstack(fill_value=0)
    qty_matrice = qty_trades.reindex(dati_storici.index).fillna(0).cumsum()

    tickers_comuni = dati_storici.columns.intersection(qty_matrice.columns)
    valori_matrice = qty_matrice[tickers_comuni] * dati_storici[tickers_comuni]
    portafoglio_giornaliero["valore_totale"] = valori_matrice.sum(axis=1).astype(float)

    cap = portafoglio_giornaliero["capitale_versato"]
    costo = portafoglio_giornaliero["costo_totale"]
    val = portafoglio_giornaliero["valore_totale"]

    portafoglio_giornaliero["rendimento_percentuale"] = np.where(
        cap > 0, ((val - cap) / cap) * 100, 0.0)
    portafoglio_giornaliero["rendimento_netto_percentuale"] = np.where(
        costo > 0, ((val - costo) / costo) * 100, 0.0)

    # =====================================================================
    # SALVATAGGIO JSON (invece di CSV, per GitHub Pages + React)
    # =====================================================================
    out = os.path.join(BASE, "output")
    os.makedirs(out, exist_ok=True)

    # 1. nav_giornaliero.json — andamento storico del portafoglio
    nav = portafoglio_giornaliero.copy()
    nav.index = nav.index.strftime('%Y-%m-%d')
    nav_json = nav[nav['valore_totale'] > 0].reset_index().rename(columns={'index': 'data'})
    nav_json.to_json(os.path.join(out, "nav_giornaliero.json"), orient='records', indent=2)

    # 2. posizioni.json — snapshot attuale per ticker
    valori_per_ticker_out = valori_per_ticker.copy()
    for col in valori_per_ticker_out.select_dtypes(include='number').columns:
        valori_per_ticker_out[col] = valori_per_ticker_out[col].round(2)
    valori_per_ticker_out.to_json(os.path.join(out, "posizioni.json"), orient='records', indent=2)

    # 3. categorie.json — breakdown per categoria
    for col in valori_per_categoria.select_dtypes(include='number').columns:
        valori_per_categoria[col] = valori_per_categoria[col].round(2)
    valori_per_categoria.to_json(os.path.join(out, "categorie.json"), orient='records', indent=2)

    # 3b. ticker_pie.json — breakdown per ticker (per donut chart)
    ticker_pie = df_categorie.groupby(['ticker', 'categoria'])['valore_attuale'].sum().reset_index()
    ticker_pie['peso_percentuale'] = (ticker_pie['valore_attuale'] / ticker_pie['valore_attuale'].sum() * 100).round(2)
    ticker_pie['valore_attuale'] = ticker_pie['valore_attuale'].round(2)
    # aggiungi titolo
    ticker_pie = ticker_pie.merge(df_categorie[['ticker','titolo']].drop_duplicates(), on='ticker', how='left')
    ticker_pie.to_json(os.path.join(out, "ticker_pie.json"), orient='records', indent=2)

    # 4. summary.json — KPI principali per la homepage
    valore_totale = float(val.iloc[-1]) if len(val) > 0 else 0
    capitale = float(cap.iloc[-1]) if len(cap) > 0 else 0
    costo_tot = float(costo.iloc[-1]) if len(costo) > 0 else 0
    rend = float(portafoglio_giornaliero["rendimento_percentuale"].iloc[-1]) if len(portafoglio_giornaliero) > 0 else 0
    rend_netto = float(portafoglio_giornaliero["rendimento_netto_percentuale"].iloc[-1]) if len(portafoglio_giornaliero) > 0 else 0

    # Variazione rispetto a ieri
    if len(val) > 1:
        var_ieri = float(val.iloc[-1] - val.iloc[-2])
        var_ieri_pct = float((val.iloc[-1] - val.iloc[-2]) / val.iloc[-2] * 100) if val.iloc[-2] > 0 else 0
    else:
        var_ieri = 0
        var_ieri_pct = 0

    summary = {
        "aggiornato_il": datetime.now().strftime('%Y-%m-%d %H:%M'),
        "valore_totale": round(valore_totale, 2),
        "capitale_versato": round(capitale, 2),
        "profitto_lordo": round(valore_totale - capitale, 2),
        "profitto_lordo_pct": round(rend, 2),
        "profitto_netto_pct": round(rend_netto, 2),
        "variazione_ieri": round(var_ieri, 2),
        "variazione_ieri_pct": round(var_ieri_pct, 2),
        "n_posizioni": int(valori_per_ticker['ticker'].nunique()),
        "n_categorie": int(valori_per_categoria['categoria'].nunique()),
    }
    with open(os.path.join(out, "summary.json"), 'w') as f:
        json.dump(summary, f, indent=2)

    print(f">>> Aggiornamento completato ✅ — Valore portafoglio: €{valore_totale:,.2f}")
    return True

if __name__ == "__main__":
    aggiorna_dati()
