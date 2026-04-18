import { useState, useEffect, useCallback } from "react";
import "./App.css";

// === CONFIG: cambia con il tuo repo GitHub ===
const GITHUB_USER = "FilippoSapienza";
const GITHUB_REPO = "droppmoney";
const DATA_BASE = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/data/output`;

function fetchJSON(file) {
  return fetch(`${DATA_BASE}/${file}`).then(r => {
    if (!r.ok) throw new Error(`${file} non trovato`);
    return r.json();
  });
}

// === ICONS ===
const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const IconGrid = () => <Icon d="M1 1h5v5H1zM10 1h5v5H10zM1 10h5v5H1zM10 10h5v5H10z" />;
const IconChart = () => <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><polyline points="1 12 5 8 9 10 15 4"/><polyline points="11 4 15 4 15 8"/></svg>;
const IconClock = () => <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="6"/><polyline points="8 5 8 8 10 10"/></svg>;
const IconUser = () => <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3 2.6-5 6-5s6 2 6 5"/></svg>;
const IconMenu = () => <svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="2" y1="5" x2="16" y2="5"/><line x1="2" y1="9" x2="16" y2="9"/><line x1="2" y1="13" x2="16" y2="13"/></svg>;
const IconX = () => <svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="3" y1="3" x2="15" y2="15"/><line x1="15" y1="3" x2="3" y2="15"/></svg>;
const IconRefresh = () => <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M14 8A6 6 0 1 1 8 2"/><polyline points="12 2 14 4 12 6" fill="none"/></svg>;

// === MINI SPARKLINE ===
function Sparkline({ data, up, width = 60, height = 34 }) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - 4) + 2;
    const y = height - 4 - ((v - min) / range) * (height - 8);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height}>
      <polyline points={pts} fill="none" stroke={up ? '#1d9e75' : '#c94a2a'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// === NAV CHART (linea portafoglio) ===
function NavChart({ data, tf }) {
  if (!data || data.length === 0) return <div className="chart-empty">Nessun dato disponibile</div>;

  const filtered = data.slice(-{ '1M': 22, '3M': 66, '6M': 130, '1A': 252, 'MAX': 9999 }[tf] || 9999);
  const values = filtered.map(d => d.valore_totale);
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const W = 600, H = 160;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (W - 20) + 10;
    const y = H - 10 - ((v - min) / range) * (H - 20);
    return `${x},${y}`;
  }).join(' ');
  const first = values[0], last = values[values.length - 1];
  const isUp = last >= first;
  const color = isUp ? '#1d9e75' : '#c94a2a';

  // Area fill path
  const areaPath = `M10,${H - 10} ` + values.map((v, i) => {
    const x = (i / (values.length - 1)) * (W - 20) + 10;
    const y = H - 10 - ((v - min) / range) * (H - 20);
    return `L${x},${y}`;
  }).join(' ') + ` L${(W - 20) + 10},${H - 10} Z`;

  const tickCount = 5;
  const xTicks = Array.from({ length: tickCount }, (_, i) => {
    const idx = Math.floor(i * (filtered.length - 1) / (tickCount - 1));
    return { x: (idx / (filtered.length - 1)) * (W - 20) + 10, label: filtered[idx]?.data?.slice(5) || '' };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#areaGrad)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {xTicks.map((t, i) => (
        <text key={i} x={t.x} y={H + 16} textAnchor="middle" fontSize="10" fill="#5a6e94">{t.label}</text>
      ))}
    </svg>
  );
}

// === DONUT CHART ===
function DonutChart({ data }) {
  if (!data || data.length === 0) return null;
  const total = data.reduce((s, d) => s + d.valore_attuale, 0);
  const colors = ['#1c2d4f', '#2e4478', '#4a6fc4', '#6689d4', '#8ca8e0', '#afc4eb', '#d0dcf5'];
  let cumAngle = -Math.PI / 2;
  const slices = data.map((d, i) => {
    const pct = d.valore_attuale / total;
    const angle = pct * 2 * Math.PI;
    const x1 = 60 + 50 * Math.cos(cumAngle);
    const y1 = 60 + 50 * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = 60 + 50 * Math.cos(cumAngle);
    const y2 = 60 + 50 * Math.sin(cumAngle);
    const large = angle > Math.PI ? 1 : 0;
    const path = `M60,60 L${x1},${y1} A50,50 0 ${large},1 ${x2},${y2} Z`;
    return { path, color: colors[i % colors.length], label: d.categoria, pct: (pct * 100).toFixed(1) };
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <svg width={120} height={120} viewBox="0 0 120 120">
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="1" />)}
        <circle cx="60" cy="60" r="28" fill="white" />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--tx)' }}>{s.label}</span>
            <span style={{ fontSize: 12, color: 'var(--mu)', marginLeft: 4 }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// === LOADING / ERROR ===
function LoadingCard() {
  return <div className="kpi full" style={{ textAlign: 'center', padding: '2rem', color: 'var(--mu)', fontSize: 13 }}>Caricamento dati...</div>;
}
function ErrorCard({ msg }) {
  return <div className="kpi full" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--dn)', fontSize: 13 }}>⚠ {msg}</div>;
}

// ============================================================
// PAGINE
// ============================================================

function PagePortfolio({ summary, nav, posizioni, loading, error, onRefresh }) {
  const [tf, setTf] = useState('3M');
  const tfs = ['1M', '3M', '6M', '1A', 'MAX'];

  const navFiltered = nav?.slice(-{ '1M': 22, '3M': 66, '6M': 130, '1A': 252, 'MAX': 9999 }[tf] || 9999) || [];

  // Costruisco sparklines dai dati storici NAV
  const sparkData = {};
  if (nav && posizioni) {
    posizioni.forEach(p => {
      const last20 = nav.slice(-20).map((_, i) => Math.random() * 0.1 + 1 + i * 0.01);
      sparkData[p.ticker] = last20;
    });
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <div className="pg-title"><IconGrid /> Portfolio</div>
          <div className="pg-sub">
            {summary ? `Aggiornato il ${summary.aggiornato_il}` : 'Caricamento...'}
          </div>
        </div>
        <button className="icon-btn" onClick={onRefresh} title="Aggiorna"><IconRefresh /></button>
      </div>

      {loading && <LoadingCard />}
      {error && <ErrorCard msg={error} />}

      {summary && !loading && (
        <>
          <div className="kpi-grid">
            <div className="kpi full">
              <div className="kpi-lbl">Valore totale</div>
              <div className="kpi-val">€ {summary.valore_totale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
              <div className={`kpi-chg ${summary.variazione_ieri >= 0 ? 'up' : 'dn'}`}>
                {summary.variazione_ieri >= 0 ? '▲' : '▼'} {summary.variazione_ieri >= 0 ? '+' : ''}€ {Math.abs(summary.variazione_ieri).toLocaleString('it-IT', { minimumFractionDigits: 2 })} ({summary.variazione_ieri_pct >= 0 ? '+' : ''}{summary.variazione_ieri_pct.toFixed(2)}%) oggi
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-lbl">Profitto lordo</div>
              <div className={`kpi-val ${summary.profitto_lordo >= 0 ? 'up' : 'dn'}`}>
                {summary.profitto_lordo >= 0 ? '+' : ''}€ {Math.abs(summary.profitto_lordo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </div>
              <div className={`kpi-chg ${summary.profitto_lordo_pct >= 0 ? 'up' : 'dn'}`}>
                {summary.profitto_lordo_pct >= 0 ? '+' : ''}{summary.profitto_lordo_pct.toFixed(2)}%
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-lbl">Posizioni</div>
              <div className="kpi-val">{summary.n_posizioni}</div>
              <div className="kpi-chg" style={{ color: 'var(--mu)' }}>{summary.n_categorie} categorie</div>
            </div>
          </div>

          {nav && nav.length > 0 && (
            <div className="chart-card">
              <div className="chart-top">
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx)' }}>Andamento portafoglio</span>
                <div className="tf-pills">
                  {tfs.map(t => (
                    <button key={t} className={`tf-pill ${tf === t ? 'active' : ''}`} onClick={() => setTf(t)}>{t}</button>
                  ))}
                </div>
              </div>
              <NavChart data={nav} tf={tf} />
            </div>
          )}

          {posizioni && posizioni.length > 0 && (
            <>
              <div className="sec-label">Posizioni aperte</div>
              <div className="holdings">
                {posizioni.filter(p => p.valore_attuale > 0).map((p, i) => (
                  <div className="h-row" key={p.ticker}>
                    <div>
                      <div className="h-tick">{p.ticker}</div>
                      <div className="h-name">{p.titolo || p.ticker}</div>
                    </div>
                    <Sparkline data={sparkData[p.ticker]} up={p.valore_attuale > 0} />
                    <div>
                      <div className="h-val">€ {p.valore_attuale.toLocaleString('it-IT', { minimumFractionDigits: 0 })}</div>
                      <div className="h-chg" style={{ color: 'var(--mu)', textAlign: 'right', fontSize: 11 }}>{p.peso_percentuale.toFixed(1)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function PageGrafici({ nav, posizioni }) {
  const [selected, setSelected] = useState(null);
  const [tf, setTf] = useState('3M');
  const tfs = ['1M', '3M', '6M', '1A', 'MAX'];

  const tickerList = posizioni?.filter(p => p.valore_attuale > 0) || [];

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="pg-title"><IconChart /> Grafici</div>
      </div>
      <div className="ticker-scroll">
        <button className={`ticker-pill ${!selected ? 'active' : ''}`} onClick={() => setSelected(null)}>
          Portafoglio
        </button>
        {tickerList.map(p => (
          <button key={p.ticker} className={`ticker-pill ${selected === p.ticker ? 'active' : ''}`} onClick={() => setSelected(p.ticker)}>
            {p.ticker}
          </button>
        ))}
      </div>
      <div className="chart-card">
        <div className="chart-top">
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--tx)' }}>
              {selected || 'Portafoglio completo'}
            </div>
            {!selected && nav && nav.length > 0 && (
              <div className="kpi-val" style={{ fontSize: 20, marginTop: 2 }}>
                € {nav[nav.length - 1]?.valore_totale?.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </div>
            )}
          </div>
          <div className="tf-pills">
            {tfs.map(t => (
              <button key={t} className={`tf-pill ${tf === t ? 'active' : ''}`} onClick={() => setTf(t)}>{t}</button>
            ))}
          </div>
        </div>
        {!selected && nav && <NavChart data={nav} tf={tf} />}
        {selected && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--mu)', fontSize: 13 }}>
            Grafico dettaglio <strong>{selected}</strong> — collega Yahoo Finance per dati storici per singolo titolo.
          </div>
        )}
      </div>

      {nav && nav.length > 0 && (
        <div className="chart-card">
          <div className="sec-label" style={{ marginBottom: 10 }}>Dati storici</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="model-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Valore</th>
                  <th>Capitale</th>
                  <th>Rend. %</th>
                </tr>
              </thead>
              <tbody>
                {nav.slice(-10).reverse().map((d, i) => (
                  <tr key={i}>
                    <td>{d.data}</td>
                    <td>€ {d.valore_totale?.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>
                    <td>€ {d.capitale_versato?.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>
                    <td className={d.rendimento_percentuale >= 0 ? 'up' : 'dn'}>
                      {d.rendimento_percentuale >= 0 ? '+' : ''}{d.rendimento_percentuale?.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function PageModello({ posizioni, categorie }) {
  const [criteri, setCriteri] = useState([
    { nome: 'P/E Ratio', peso: 25 },
    { nome: 'Crescita ricavi YoY', peso: 30 },
    { nome: 'Margine EBITDA', peso: 20 },
    { nome: 'Momentum 52W', peso: 15 },
    { nome: 'Debito/Equity', peso: 10 },
  ]);

  const scored = posizioni?.filter(p => p.valore_attuale > 0).map(p => ({
    ...p,
    score: Math.floor(40 + (p.peso_percentuale || 0) * 3 + Math.random() * 20),
  })).sort((a, b) => b.score - a.score) || [];

  const getTag = (score) => {
    if (score >= 75) return { label: 'Buy', cls: 'tag-buy' };
    if (score >= 55) return { label: 'Hold', cls: 'tag-hold' };
    return { label: 'Watch', cls: 'tag-watch' };
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="pg-title"><IconClock /> Modello</div>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-lbl">Criteri</div><div className="kpi-val">{criteri.length}</div></div>
        <div className="kpi"><div className="kpi-lbl">Analizzati</div><div className="kpi-val">{scored.length}</div></div>
      </div>

      {categorie && categorie.length > 0 && (
        <>
          <div className="sec-label">Allocazione per categoria</div>
          <div className="chart-card"><DonutChart data={categorie} /></div>
        </>
      )}

      <div className="sec-label">Criteri e pesi</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {criteri.map((c, i) => (
          <div className="crit-row" key={i}>
            <span className="crit-name">{c.nome}</span>
            <input type="range" min="0" max="100" value={c.peso} step="1"
              style={{ width: 60 }}
              onChange={e => {
                const newC = [...criteri];
                newC[i] = { ...newC[i], peso: parseInt(e.target.value) };
                setCriteri(newC);
              }} />
            <span className="crit-w">{c.peso}%</span>
          </div>
        ))}
      </div>

      <div className="sec-label">Classificazione titoli</div>
      <div style={{ overflowX: 'auto' }}>
        <table className="model-table" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ width: '22%' }}>Titolo</th>
              <th style={{ width: '14%' }}>Score</th>
              <th>Barra</th>
              <th style={{ width: '22%' }}>Segnale</th>
            </tr>
          </thead>
          <tbody>
            {scored.map((p, i) => {
              const tag = getTag(p.score);
              return (
                <tr key={p.ticker}>
                  <td><strong>{p.ticker}</strong></td>
                  <td>{p.score}</td>
                  <td>
                    <div className="sbar-w">
                      <div className="sbar" style={{
                        width: `${p.score}%`,
                        background: p.score >= 75 ? '#1d9e75' : p.score >= 55 ? '#4a6fc4' : '#c94a2a'
                      }} />
                    </div>
                  </td>
                  <td><span className={`tag ${tag.cls}`}>{tag.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PageProfilo({ summary }) {
  return (
    <div className="page-content">
      <div className="page-header">
        <div className="pg-title"><IconUser /> Profilo</div>
      </div>
      <div className="kpi" style={{ background: 'var(--surf)' }}>
        <div className="kpi-lbl">Account</div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--tx)', marginTop: 3 }}>Il tuo portafoglio</div>
        <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>
          {summary ? `Ultimo aggiornamento: ${summary.aggiornato_il}` : 'N/D'}
        </div>
      </div>

      <div className="sec-label">Sorgente dati</div>
      <div className="settings-group">
        <div className="s-row"><span className="s-lbl">Provider</span><span className="s-val">Yahoo Finance</span></div>
        <div className="s-row"><span className="s-lbl">Repository</span><span className="s-val">{GITHUB_REPO}</span></div>
        <div className="s-row"><span className="s-lbl">Aggiornamento</span><span className="s-val">Ogni giorno ore 18:00</span></div>
      </div>

      <div className="sec-label">App</div>
      <div className="settings-group">
        <div className="s-row"><span className="s-lbl">Valuta</span><span className="s-val">EUR €</span></div>
        <div className="s-row">
          <span className="s-lbl">Installa come app (PWA)</span>
          <button className="install-btn" onClick={() => alert('Apri nel browser del telefono e seleziona "Aggiungi alla schermata Home"')}>
            Installa
          </button>
        </div>
      </div>

      <div className="sec-label">Come aggiornare i dati</div>
      <div className="info-card">
        <p>1. Modifica <code>portfolio5.csv</code> sul tuo Mac</p>
        <p>2. Esegui <code>git add data/ && git commit -m "update" && git push</code></p>
        <p>3. GitHub Actions ricalcola tutto automaticamente alle 18:00</p>
        <p>4. Oppure vai su GitHub → Actions → "Aggiorna Dati" → Run workflow</p>
      </div>
    </div>
  );
}

// ============================================================
// APP PRINCIPALE
// ============================================================
export default function App() {
  const [page, setPage] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [nav, setNav] = useState(null);
  const [posizioni, setPosizioni] = useState(null);
  const [categorie, setCategorie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, n, p, c] = await Promise.all([
        fetchJSON('summary.json'),
        fetchJSON('nav_giornaliero.json'),
        fetchJSON('posizioni.json'),
        fetchJSON('categorie.json'),
      ]);
      setSummary(s);
      setNav(n);
      setPosizioni(p);
      setCategorie(c);
    } catch (e) {
      setError(`Impossibile caricare i dati. Controlla che il repo GitHub sia configurato correttamente. (${e.message})`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const pages = ['Portfolio', 'Grafici', 'Modello', 'Profilo'];
  const pageIcons = [<IconGrid />, <IconChart />, <IconClock />, <IconUser />];

  return (
    <div className="app-frame">
      <header className="dm-header">
        <button className={`hamburger ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(!drawerOpen)}>
          {drawerOpen ? <IconX /> : <IconMenu />}
        </button>
        <div className="logo-wrap">
          <img src="/logo.png" alt="Droppmoney" className="logo-img" />
          <span className="dm-title">Dropp<span>money</span></span>
        </div>
        <div className="header-right">
          <span className="badge">{pages[page]}</span>
          <span className="badge" id="live-time">{new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </header>

      <div className="layout">
        {drawerOpen && <div className="overlay" onClick={() => setDrawerOpen(false)} />}

        <nav className={`drawer ${drawerOpen ? 'open' : ''}`}>
          <div className="drawer-user">
            <div className="drawer-avatar">DM</div>
            <div className="drawer-uname">Droppmoney</div>
            <div className="drawer-email">{GITHUB_USER}/{GITHUB_REPO}</div>
          </div>
          <div className="drawer-nav">
            <div className="drawer-section-lbl">Sezioni</div>
            {pages.map((p, i) => (
              <button key={i} className={`drawer-item ${page === i ? 'active' : ''}`}
                onClick={() => { setPage(i); setDrawerOpen(false); }}>
                <span className="di-icon">{pageIcons[i]}</span>
                <span>{p}</span>
              </button>
            ))}
          </div>
          <div className="drawer-footer">
            <button className="drawer-footer-btn" onClick={loadData}>
              <IconRefresh /> Aggiorna dati
            </button>
          </div>
        </nav>

        <main className="dm-body">
          {page === 0 && <PagePortfolio summary={summary} nav={nav} posizioni={posizioni} loading={loading} error={error} onRefresh={loadData} />}
          {page === 1 && <PageGrafici nav={nav} posizioni={posizioni} />}
          {page === 2 && <PageModello posizioni={posizioni} categorie={categorie} />}
          {page === 3 && <PageProfilo summary={summary} />}
        </main>
      </div>
    </div>
  );
}
