import { useState, useEffect, useCallback } from "react";
import "./App.css";

const GITHUB_USER = "FilippoSapienza";
const GITHUB_REPO = "droppmoney";
const DATA_BASE = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/data/output`;

function fetchJSON(file) {
  return fetch(`${DATA_BASE}/${file}?t=${Date.now()}`).then(r => {
    if (!r.ok) throw new Error(`${file} non trovato`);
    return r.json();
  });
}

const IconGrid  = () => <svg width={15} height={15} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="1" y="1" width="5" height="5" rx="1"/><rect x="10" y="1" width="5" height="5" rx="1"/><rect x="1" y="10" width="5" height="5" rx="1"/><rect x="10" y="10" width="5" height="5" rx="1"/></svg>;
const IconChart = () => <svg width={15} height={15} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><polyline points="1 12 5 8 9 10 15 4"/><polyline points="11 4 15 4 15 8"/></svg>;
const IconPie   = () => <svg width={15} height={15} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M8 2a6 6 0 1 0 6 6H8V2z"/><path d="M11 2.5A6 6 0 0 1 14 8"/></svg>;
const IconPlus  = () => <svg width={15} height={15} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/></svg>;
const IconUser  = () => <svg width={15} height={15} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3 2.6-5 6-5s6 2 6 5"/></svg>;
const IconMenu  = () => <svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="2" y1="5" x2="16" y2="5"/><line x1="2" y1="9" x2="16" y2="9"/><line x1="2" y1="13" x2="16" y2="13"/></svg>;
const IconX     = () => <svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="3" y1="3" x2="15" y2="15"/><line x1="15" y1="3" x2="3" y2="15"/></svg>;
const IconRefresh = () => <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M14 8A6 6 0 1 1 8 2"/><polyline points="12 2 14 4 12 6"/></svg>;

function Sparkline({ data, up, width = 60, height = 34 }) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - 4) + 2;
    const y = height - 4 - ((v - min) / range) * (height - 8);
    return `${x},${y}`;
  }).join(' ');
  return <svg width={width} height={height}><polyline points={pts} fill="none" stroke={up ? '#1d9e75' : '#c94a2a'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function NavChart({ data, tf }) {
  if (!data || data.length === 0) return <div className="chart-empty">Nessun dato</div>;
  const n = { '1M': 22, '3M': 66, '6M': 130, '1A': 252, 'MAX': 99999 }[tf] || 99999;
  const filtered = data.slice(-n);
  const values = filtered.map(d => d.valore_totale);
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const W = 600, H = 160;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (W - 20) + 10},${H - 10 - ((v - min) / range) * (H - 20)}`).join(' ');
  const isUp = values[values.length - 1] >= values[0];
  const color = isUp ? '#1d9e75' : '#c94a2a';
  const areaPath = `M10,${H - 10} ` + values.map((v, i) => `L${(i / (values.length - 1)) * (W - 20) + 10},${H - 10 - ((v - min) / range) * (H - 20)}`).join(' ') + ` L${W - 10},${H - 10} Z`;
  const ticks = Array.from({ length: 5 }, (_, i) => {
    const idx = Math.floor(i * (filtered.length - 1) / 4);
    return { x: (idx / (filtered.length - 1)) * (W - 20) + 10, label: filtered[idx]?.data?.slice(5) || '' };
  });
  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.15"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
      <path d={areaPath} fill="url(#ag)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {ticks.map((t, i) => <text key={i} x={t.x} y={H + 16} textAnchor="middle" fontSize="10" fill="#5a6e94">{t.label}</text>)}
    </svg>
  );
}

const PALETTE_CATEGORIA = { 'Crypto': '#4a6fc4', 'Etf': '#1d9e75', 'Azioni': '#1c2d4f', 'Obbligazioni': '#6689d4' };
const PALETTE_FALLBACK = ['#1c2d4f','#2e4478','#4a6fc4','#6689d4','#8ca8e0','#afc4eb','#1d9e75','#157a5a','#c94a2a','#e07a5f'];

function DonutChart({ data, labelKey, valueKey, colorMap }) {
  if (!data || data.length === 0) return null;
  const total = data.reduce((s, d) => s + (d[valueKey] || 0), 0);
  let cumAngle = -Math.PI / 2;
  const R = 54, cx = 65, cy = 65;
  const slices = data.map((d, i) => {
    const pct = (d[valueKey] || 0) / total;
    const angle = pct * 2 * Math.PI;
    const x1 = cx + R * Math.cos(cumAngle), y1 = cy + R * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + R * Math.cos(cumAngle), y2 = cy + R * Math.sin(cumAngle);
    const path = `M${cx},${cy} L${x1},${y1} A${R},${R} 0 ${angle > Math.PI ? 1 : 0},1 ${x2},${y2} Z`;
    return { path, color: colorMap?.[d[labelKey]] || PALETTE_FALLBACK[i % PALETTE_FALLBACK.length], label: d[labelKey], pct: (pct * 100).toFixed(1), val: d[valueKey] };
  });
  return (
    <div className="donut-wrap">
      <svg width={130} height={130} viewBox="0 0 130 130" style={{ flexShrink: 0 }}>
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="1.5" />)}
        <circle cx={cx} cy={cy} r="28" fill="var(--surf)" />
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize="9" fill="var(--mu)">Totale</text>
        <text x={cx} y={cy + 9} textAnchor="middle" fontSize="11" fontWeight="500" fill="var(--tx)">€{(total/1000).toFixed(1)}k</text>
      </svg>
      <div className="donut-legend">
        {slices.map((s, i) => (
          <div key={i} className="donut-legend-row">
            <div style={{ width: 9, height: 9, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span className="donut-legend-label">{s.label}</span>
            <span className="donut-legend-pct">{s.pct}%</span>
            <span className="donut-legend-val">€{s.val?.toLocaleString('it-IT', { minimumFractionDigits: 0 })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingCard() { return <div className="kpi full" style={{ textAlign:'center', padding:'2rem', color:'var(--mu)', fontSize:13 }}>Caricamento...</div>; }
function ErrorCard({ msg }) { return <div className="kpi full" style={{ textAlign:'center', padding:'1.5rem', color:'var(--dn)', fontSize:13 }}>⚠ {msg}</div>; }

function PagePortfolio({ summary, nav, posizioni, loading, error, onRefresh }) {
  const [tf, setTf] = useState('3M');
  const tfs = ['1M','3M','6M','1A','MAX'];
  const sparkData = {};
  posizioni?.forEach(p => {
    const s = p.ticker.charCodeAt(0);
    sparkData[p.ticker] = Array.from({length:20},(_,i) => 20 + Math.sin(i*s*0.3)*3 + i*0.1);
  });
  return (
    <div className="page-content">
      <div className="page-header">
        <div><div className="pg-title"><IconGrid /> Portfolio</div><div className="pg-sub">{summary ? `Aggiornato il ${summary.aggiornato_il}` : 'Caricamento...'}</div></div>
        <button className="icon-btn" onClick={onRefresh}><IconRefresh /></button>
      </div>
      {loading && <LoadingCard />}
      {error && <ErrorCard msg={error} />}
      {summary && !loading && (
        <>
          <div className="kpi-grid">
            <div className="kpi full">
              <div className="kpi-lbl">Valore totale</div>
              <div className="kpi-val">€ {summary.valore_totale.toLocaleString('it-IT',{minimumFractionDigits:2})}</div>
              <div className={`kpi-chg ${summary.variazione_ieri>=0?'up':'dn'}`}>
                {summary.variazione_ieri>=0?'▲':'▼'} {summary.variazione_ieri>=0?'+':''}€ {Math.abs(summary.variazione_ieri).toLocaleString('it-IT',{minimumFractionDigits:2})} ({summary.variazione_ieri_pct>=0?'+':''}{summary.variazione_ieri_pct.toFixed(2)}%) oggi
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-lbl">Profitto lordo</div>
              <div className={`kpi-val ${summary.profitto_lordo>=0?'up':'dn'}`}>{summary.profitto_lordo>=0?'+':''}€ {Math.abs(summary.profitto_lordo).toLocaleString('it-IT',{minimumFractionDigits:2})}</div>
              <div className={`kpi-chg ${summary.profitto_lordo_pct>=0?'up':'dn'}`}>{summary.profitto_lordo_pct>=0?'+':''}{summary.profitto_lordo_pct.toFixed(2)}%</div>
            </div>
            <div className="kpi">
              <div className="kpi-lbl">Posizioni</div>
              <div className="kpi-val">{summary.n_posizioni}</div>
              <div className="kpi-chg" style={{color:'var(--mu)'}}>{summary.n_categorie} categorie</div>
            </div>
          </div>
          {nav?.length > 0 && (
            <div className="chart-card">
              <div className="chart-top">
                <span style={{fontSize:13,fontWeight:500,color:'var(--tx)'}}>Andamento portafoglio</span>
                <div className="tf-pills">{tfs.map(t=><button key={t} className={`tf-pill ${tf===t?'active':''}`} onClick={()=>setTf(t)}>{t}</button>)}</div>
              </div>
              <NavChart data={nav} tf={tf} />
            </div>
          )}
          {posizioni?.filter(p=>p.valore_attuale>0).length > 0 && (
            <>
              <div className="sec-label">Posizioni aperte</div>
              <div className="holdings">
                {posizioni.filter(p=>p.valore_attuale>0).map(p=>(
                  <div className="h-row" key={p.ticker}>
                    <div><div className="h-tick">{p.ticker}</div><div className="h-name">{p.titolo||p.ticker}</div></div>
                    <Sparkline data={sparkData[p.ticker]} up={true} />
                    <div>
                      <div className="h-val">€ {p.valore_attuale.toLocaleString('it-IT',{minimumFractionDigits:0})}</div>
                      <div className="h-chg" style={{color:'var(--mu)',textAlign:'right',fontSize:11}}>{p.peso_percentuale?.toFixed(1)}%</div>
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

function PageGrafici({ nav }) {
  const [tf, setTf] = useState('3M');
  const tfs = ['1M','3M','6M','1A','MAX'];
  return (
    <div className="page-content">
      <div className="page-header"><div className="pg-title"><IconChart /> Grafici</div></div>
      <div className="chart-card">
        <div className="chart-top">
          <div>
            <div style={{fontSize:14,fontWeight:500,color:'var(--tx)'}}>Portafoglio completo</div>
            {nav?.length>0 && <div className="kpi-val" style={{fontSize:20,marginTop:2}}>€ {nav[nav.length-1]?.valore_totale?.toLocaleString('it-IT',{minimumFractionDigits:2})}</div>}
          </div>
          <div className="tf-pills">{tfs.map(t=><button key={t} className={`tf-pill ${tf===t?'active':''}`} onClick={()=>setTf(t)}>{t}</button>)}</div>
        </div>
        {nav && <NavChart data={nav} tf={tf} />}
      </div>
      {nav?.length>0 && (
        <div className="chart-card">
          <div className="sec-label" style={{marginBottom:10}}>Ultimi 10 giorni</div>
          <div style={{overflowX:'auto'}}>
            <table className="model-table">
              <thead><tr><th>Data</th><th>Valore</th><th>Capitale</th><th>Rend. %</th></tr></thead>
              <tbody>
                {nav.slice(-10).reverse().map((d,i)=>(
                  <tr key={i}>
                    <td>{d.data}</td>
                    <td>€ {d.valore_totale?.toLocaleString('it-IT',{minimumFractionDigits:2})}</td>
                    <td>€ {d.capitale_versato?.toLocaleString('it-IT',{minimumFractionDigits:2})}</td>
                    <td className={d.rendimento_percentuale>=0?'up':'dn'}>{d.rendimento_percentuale>=0?'+':''}{d.rendimento_percentuale?.toFixed(2)}%</td>
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

function PageAnalisi({ categorie, tickerPie }) {
  return (
    <div className="page-content">
      <div className="page-header"><div className="pg-title"><IconPie /> Analisi</div></div>
      <div className="sec-label">Allocazione per categoria</div>
      <div className="chart-card">
        {categorie?.length>0 ? <DonutChart data={categorie} labelKey="categoria" valueKey="valore_attuale" colorMap={PALETTE_CATEGORIA}/> : <div className="chart-empty">Nessun dato</div>}
      </div>
      <div className="sec-label">Allocazione per titolo</div>
      <div className="chart-card">
        {tickerPie?.length>0 ? <DonutChart data={tickerPie} labelKey="ticker" valueKey="valore_attuale" colorMap={null}/> : <div className="chart-empty">Nessun dato — esegui lo script per generare ticker_pie.json</div>}
      </div>
      {categorie?.length>0 && (
        <>
          <div className="sec-label">Dettaglio categorie</div>
          <div style={{overflowX:'auto'}}>
            <table className="model-table">
              <thead><tr><th>Categoria</th><th>Valore</th><th>Peso %</th></tr></thead>
              <tbody>
                {categorie.map((c,i)=>(
                  <tr key={i}>
                    <td><span className="cat-dot" style={{background:PALETTE_CATEGORIA[c.categoria]||PALETTE_FALLBACK[i]}}/>{c.categoria}</td>
                    <td>€ {c.valore_attuale?.toLocaleString('it-IT',{minimumFractionDigits:2})}</td>
                    <td><strong>{c.peso_percentuale?.toFixed(1)}%</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const CATEGORIE_OPTIONS = ['Azioni','Etf','Crypto','Obbligazioni','Altro'];
const PIATTAFORME_OPTIONS = ['Directa','Degiro','Binance','Fineco','Altro'];

function PageNuovoInvestimento() {
  const today = new Date().toISOString().slice(0,10);
  const [form, setForm] = useState({ data:today, titolo:'', categoria:'Azioni', ticker:'', piattaforma:'Directa', importo:'', commissioni:'0', quantità:'' });
  const [status, setStatus] = useState(null);
  const [msg, setMsg] = useState('');
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleSubmit = async () => {
    if (!form.titolo||!form.ticker||!form.importo||!form.quantità) { setStatus('error'); setMsg('Compila tutti i campi obbligatori (*)'); return; }
    setStatus('loading'); setMsg('Salvataggio in corso...');
    const riga = `${form.data};${form.titolo};${form.categoria};${form.ticker};${form.piattaforma};${parseFloat(form.importo).toFixed(2)};${parseFloat(form.commissioni||0).toFixed(2)};${parseFloat(form.quantità).toFixed(6)}`;
    try {
      const csvRes = await fetch(`https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/data/portfolio5.csv?t=${Date.now()}`);
      if (!csvRes.ok) throw new Error('Impossibile leggere portfolio5.csv');
      const csvText = await csvRes.text();
      const nuovoContenuto = csvText.trimEnd() + '\n' + riga + '\n';
      const shaRes = await fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/data/portfolio5.csv`,{headers:{'Accept':'application/vnd.github+json'}});
      if (!shaRes.ok) throw new Error('Impossibile leggere SHA');
      const shaData = await shaRes.json();
      let token = sessionStorage.getItem('gh_token');
      if (!token) {
        token = prompt('Inserisci il tuo GitHub Personal Access Token (scope: repo).\nViene salvato solo in questa sessione del browser:');
        if (!token) { setStatus('error'); setMsg('Token non inserito.'); return; }
        sessionStorage.setItem('gh_token', token);
      }
      const updateRes = await fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/data/portfolio5.csv`,{
        method:'PUT',
        headers:{'Authorization':`token ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify({ message:`📈 Nuovo investimento: ${form.ticker} (${form.data})`, content:btoa(unescape(encodeURIComponent(nuovoContenuto))), sha:shaData.sha })
      });
      if (!updateRes.ok) { const err=await updateRes.json(); throw new Error(err.message||'Errore GitHub'); }
      setStatus('ok'); setMsg(`✅ ${form.ticker} aggiunto con successo! I dati verranno ricalcolati entro 2 ore.`);
      setForm({data:today,titolo:'',categoria:'Azioni',ticker:'',piattaforma:'Directa',importo:'',commissioni:'0',quantità:''});
    } catch(e) {
      sessionStorage.removeItem('gh_token');
      setStatus('error'); setMsg(`Errore: ${e.message}`);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header"><div className="pg-title"><IconPlus /> Nuovo investimento</div></div>
      <div className="form-card">
        <div className="form-row"><label className="form-label">Data *</label><input type="date" className="form-input" value={form.data} onChange={e=>set('data',e.target.value)}/></div>
        <div className="form-row"><label className="form-label">Titolo *</label><input type="text" className="form-input" placeholder="es. Apple Inc." value={form.titolo} onChange={e=>set('titolo',e.target.value)}/></div>
        <div className="form-row"><label className="form-label">Ticker *</label><input type="text" className="form-input" placeholder="es. AAPL" value={form.ticker} onChange={e=>set('ticker',e.target.value.toUpperCase())}/></div>
        <div className="form-row">
          <label className="form-label">Categoria</label>
          <select className="form-input" value={form.categoria} onChange={e=>set('categoria',e.target.value)}>
            {CATEGORIE_OPTIONS.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label className="form-label">Piattaforma</label>
          <select className="form-input" value={form.piattaforma} onChange={e=>set('piattaforma',e.target.value)}>
            {PIATTAFORME_OPTIONS.map(p=><option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="form-row-2">
          <div><label className="form-label">Importo € *</label><input type="number" className="form-input" placeholder="0.00" min="0" step="0.01" value={form.importo} onChange={e=>set('importo',e.target.value)}/></div>
          <div><label className="form-label">Commissioni €</label><input type="number" className="form-input" placeholder="0.00" min="0" step="0.01" value={form.commissioni} onChange={e=>set('commissioni',e.target.value)}/></div>
        </div>
        <div className="form-row"><label className="form-label">Quantità *</label><input type="number" className="form-input" placeholder="es. 10" min="0" step="any" value={form.quantità} onChange={e=>set('quantità',e.target.value)}/></div>
        {status==='loading' && <div className="form-status loading">{msg}</div>}
        {status==='ok'      && <div className="form-status ok">{msg}</div>}
        {status==='error'   && <div className="form-status error">{msg}</div>}
        <button className="submit-btn" onClick={handleSubmit} disabled={status==='loading'}>
          {status==='loading'?'Salvataggio...':'Aggiungi al portafoglio'}
        </button>
        <div className="form-note">Il trade viene salvato direttamente su GitHub. GitHub Actions ricalcola i dati automaticamente ogni 2 ore.</div>
      </div>
    </div>
  );
}

function PageProfilo({ summary }) {
  return (
    <div className="page-content">
      <div className="page-header"><div className="pg-title"><IconUser /> Profilo</div></div>
      <div className="kpi" style={{background:'var(--surf)'}}>
        <div className="kpi-lbl">Account</div>
        <div style={{fontSize:14,fontWeight:500,color:'var(--tx)',marginTop:3}}>{GITHUB_USER}</div>
        <div style={{fontSize:11,color:'var(--mu)',marginTop:2}}>{summary?`Ultimo aggiornamento: ${summary.aggiornato_il}`:'N/D'}</div>
      </div>
      <div className="sec-label">Sorgente dati</div>
      <div className="settings-group">
        <div className="s-row"><span className="s-lbl">Provider</span><span className="s-val">Yahoo Finance</span></div>
        <div className="s-row"><span className="s-lbl">Repository</span><span className="s-val">{GITHUB_REPO}</span></div>
        <div className="s-row"><span className="s-lbl">Aggiornamento automatico</span><span className="s-val">Ogni 2 ore (lun-ven)</span></div>
      </div>
      <div className="sec-label">App</div>
      <div className="settings-group">
        <div className="s-row"><span className="s-lbl">Valuta</span><span className="s-val">EUR €</span></div>
        <div className="s-row"><span className="s-lbl">Installa come app (PWA)</span><button className="install-btn" onClick={()=>alert('Apri in Safari su iPhone → tasto condividi → "Aggiungi alla schermata Home"')}>Installa</button></div>
      </div>
    </div>
  );
}

const PAGES = [
  {label:'Portfolio', icon:<IconGrid/>},
  {label:'Grafici',   icon:<IconChart/>},
  {label:'Analisi',   icon:<IconPie/>},
  {label:'Aggiungi',  icon:<IconPlus/>},
  {label:'Profilo',   icon:<IconUser/>},
];

export default function App() {
  const [page, setPage]           = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [summary, setSummary]     = useState(null);
  const [nav, setNav]             = useState(null);
  const [posizioni, setPosizioni] = useState(null);
  const [categorie, setCategorie] = useState(null);
  const [tickerPie, setTickerPie] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [time, setTime]           = useState('');

  useEffect(()=>{
    const tick=()=>setTime(new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}));
    tick(); const id=setInterval(tick,30000); return ()=>clearInterval(id);
  },[]);

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [s,n,p,c,t] = await Promise.all([
        fetchJSON('summary.json'), fetchJSON('nav_giornaliero.json'),
        fetchJSON('posizioni.json'), fetchJSON('categorie.json'),
        fetchJSON('ticker_pie.json').catch(()=>null),
      ]);
      setSummary(s); setNav(n); setPosizioni(p); setCategorie(c); setTickerPie(t);
    } catch(e) { setError(`Impossibile caricare i dati. (${e.message})`); }
    finally { setLoading(false); }
  },[]);

  useEffect(()=>{ loadData(); },[loadData]);

  return (
    <div className="app-frame">
      <header className="dm-header">
        <button className="hamburger" onClick={()=>setDrawerOpen(o=>!o)}>{drawerOpen?<IconX/>:<IconMenu/>}</button>
        <div className="logo-wrap">
          <img src="/logo.png" alt="Droppmoney" className="logo-img"/>
          <span className="dm-title">Dropp<span>money</span></span>
        </div>
        <div className="header-right">
          <span className="badge">{PAGES[page].label}</span>
          <span className="badge">{time}</span>
        </div>
      </header>
      <div className="layout">
        {drawerOpen && <div className="overlay" onClick={()=>setDrawerOpen(false)}/>}
        <nav className={`drawer ${drawerOpen?'open':''}`}>
          <div className="drawer-user">
            <div className="drawer-avatar">DM</div>
            <div className="drawer-uname">{GITHUB_USER}</div>
            <div className="drawer-email">{summary?`Agg. ${summary.aggiornato_il?.slice(0,10)}`:'Caricamento...'}</div>
          </div>
          <div className="drawer-nav">
            <div className="drawer-section-lbl">Sezioni</div>
            {PAGES.map((p,i)=>(
              <button key={i} className={`drawer-item ${page===i?'active':''}`} onClick={()=>{setPage(i);setDrawerOpen(false);}}>
                <span className="di-icon">{p.icon}</span><span>{p.label}</span>
              </button>
            ))}
          </div>
          <div className="drawer-footer">
            <button className="drawer-footer-btn" onClick={()=>{loadData();setDrawerOpen(false);}}><IconRefresh /> Aggiorna dati</button>
          </div>
        </nav>
        <main className="dm-body">
          {page===0 && <PagePortfolio summary={summary} nav={nav} posizioni={posizioni} loading={loading} error={error} onRefresh={loadData}/>}
          {page===1 && <PageGrafici nav={nav}/>}
          {page===2 && <PageAnalisi categorie={categorie} tickerPie={tickerPie}/>}
          {page===3 && <PageNuovoInvestimento/>}
          {page===4 && <PageProfilo summary={summary}/>}
        </main>
      </div>
    </div>
  );
}
