import { useState, useRef, useEffect, useCallback } from 'react';

const BACKEND = import.meta.env.VITE_BACKEND_URL;

// ── localStorage cache (1 hr TTL — matches backend) ────────
const CACHE_KEY = 'bizhealth_company_v2';
const CACHE_TTL = 60 * 60 * 1000;

function getCached(sym) {
  try {
    const store = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const entry = store[sym];
    if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  } catch {}
  return null;
}
function setCached(sym, data) {
  try {
    const store = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    store[sym] = { data, ts: Date.now() };
    // Evict oldest entries if store grows > 30 items
    const keys = Object.keys(store);
    if (keys.length > 30) {
      keys.sort((a, b) => store[a].ts - store[b].ts).slice(0, 10).forEach(k => delete store[k]);
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {}
}

// ── Fetch via backend YF proxy ──────────────────────────────
async function fetchCompanyData(ticker) {
  const sym = ticker.toUpperCase().trim();

  const cached = getCached(sym);
  if (cached) return cached;

  if (!BACKEND) throw new Error('Backend URL not configured (VITE_BACKEND_URL).');

  const res = await fetch(`${BACKEND}/company/yf/${encodeURIComponent(sym)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Could not load data for ${sym} (${res.status})`);
  }

  const data = await res.json();
  setCached(sym, data);
  return data;
}

// ══════════════════════════════════════════════════════════
export default function CompanySearch({ onSelect }) {
  const [query,    setQuery]   = useState('');
  const [results,  setResults] = useState([]);
  const [open,     setOpen]    = useState(false);
  const [loading,  setLoading] = useState(false);
  const [fetching, setFetching]= useState(false);
  const [loaded,   setLoaded]  = useState(null);
  const [error,    setError]   = useState('');

  const debounceRef  = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const h = e => { if (!containerRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); setOpen(false); return; }
    if (!BACKEND) { setResults([]); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${BACKEND}/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
      setOpen(true);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 380);
    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch]);

  const selectCompany = async (company) => {
    setOpen(false); setLoaded(null); setError('');
    setQuery(company.name || company.ticker);
    setFetching(true);
    try {
      const d = await fetchCompanyData(company.ticker);
      setLoaded({ ticker: d.ticker || company.ticker, name: d.name || company.name,
                  currency: d.currency, coverage: d.coverage, filled: d.filled, total: d.total });
      onSelect(d);
    } catch (e) {
      setError(e.message || 'Could not load financials.');
    } finally { setFetching(false); }
  };

  const clear = () => { setQuery(''); setLoaded(null); setError(''); setResults([]); };

  if (!BACKEND) {
    return (
      <div className="px-3 py-2.5 rounded-xl mono text-[10px] leading-relaxed"
        style={{ background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.2)', color:'rgba(251,191,36,0.8)' }}>
        ⚠ Add <strong>VITE_BACKEND_URL</strong> to Vercel to enable company search
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">

      {/* Search input */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color:'rgba(34,211,238,0.45)', fontSize:14 }}>⌕</span>
        <input type="text" value={query}
          onChange={e => { setQuery(e.target.value); setLoaded(null); setError(''); }}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="AAPL, NVDA, TCS, RELIANCE…"
          className="w-full py-2 text-xs outline-none"
          style={{
            paddingLeft:28, paddingRight:28,
            background:'rgba(34,211,238,0.04)',
            border:'1px solid rgba(34,211,238,0.15)',
            borderRadius:10, color:'#f1f5f9',
            fontFamily:'var(--font-mono)',
            transition:'border-color .15s, box-shadow .15s',
          }}
          onFocusCapture={e => { e.target.style.borderColor='rgba(34,211,238,0.4)'; e.target.style.boxShadow='0 0 0 2px rgba(34,211,238,0.08)'; }}
          onBlurCapture={e =>  { e.target.style.borderColor='rgba(34,211,238,0.15)'; e.target.style.boxShadow='none'; }}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2">
          {(loading || fetching) ? (
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" style={{ color:'#22d3ee' }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31 11"/>
            </svg>
          ) : query ? (
            <button onClick={clear} className="text-slate-600 hover:text-slate-400 transition-colors" style={{ fontSize:12 }}>✕</button>
          ) : null}
        </span>
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 rounded-xl overflow-hidden"
          style={{ top:'100%', background:'rgba(4,9,22,0.98)', border:'1px solid rgba(34,211,238,0.14)', backdropFilter:'blur(24px)', boxShadow:'0 12px 40px rgba(0,0,0,0.6)' }}>
          {results.map((r, i) => (
            <button key={r.ticker} onClick={() => selectCompany(r)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
              style={{ borderBottom: i < results.length-1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}>
              <span className="mono text-[10px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0"
                style={{ background:'rgba(34,211,238,0.08)', color:'#22d3ee', border:'1px solid rgba(34,211,238,0.2)', minWidth:52, textAlign:'center' }}>
                {r.ticker}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-slate-200 text-xs truncate leading-tight">{r.name}</p>
                <p className="mono text-[10px] mt-0.5" style={{ color:'rgba(100,116,139,0.8)' }}>{r.exchange} · {r.type}</p>
              </div>
              <span className="text-slate-700 text-[10px] flex-shrink-0">→</span>
            </button>
          ))}
        </div>
      )}

      {/* Loaded chip */}
      {loaded && !fetching && (
        <div className="mt-2 rounded-xl overflow-hidden" style={{ border:'1px solid rgba(0,232,135,0.22)' }}>
          <div className="flex items-center gap-2 px-3 py-1.5" style={{ background:'rgba(0,232,135,0.07)' }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 pulse-dot" style={{ background:'#00e887', boxShadow:'0 0 5px #00e887' }} />
            <span className="mono text-[11px] font-bold flex-shrink-0" style={{ color:'#00e887' }}>{loaded.ticker}</span>
            <span className="text-slate-400 text-[11px] truncate flex-1">{loaded.name}</span>
            {loaded.currency && loaded.currency !== 'INR' && (
              <span className="mono text-[10px] flex-shrink-0 px-1.5 py-0.5 rounded"
                style={{ background:'rgba(251,191,36,0.1)', color:'#fbbf24', border:'1px solid rgba(251,191,36,0.2)' }}>
                {loaded.currency}
              </span>
            )}
            <button onClick={clear} className="text-slate-600 hover:text-slate-400 text-xs flex-shrink-0">✕</button>
          </div>
          {loaded.coverage !== undefined && (
            <div className="px-3 py-2" style={{ background:'rgba(0,0,0,0.2)' }}>
              <div className="flex justify-between mono text-[9px] mb-1">
                <span style={{ color:'rgba(148,163,184,0.5)' }}>FIELDS LOADED — {loaded.filled}/{loaded.total}</span>
                <span style={{ color: loaded.coverage >= 80 ? '#00e887' : '#fbbf24', fontWeight:700 }}>{loaded.coverage}%</span>
              </div>
              <div className="h-[2px] rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width:`${loaded.coverage}%`, background: loaded.coverage >= 80 ? 'linear-gradient(90deg,#00e887,#22d3ee)' : 'linear-gradient(90deg,#fbbf24,#f59e0b)' }} />
              </div>
              {loaded.coverage < 100 && (
                <p className="text-[9px] mt-1.5 leading-relaxed" style={{ color:'rgba(100,116,139,0.7)' }}>
                  Missing fields are normal for service/tech companies — those ratios show N/A.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-1.5 mono text-[10px] px-1 leading-relaxed" style={{ color:'rgba(244,63,94,0.8)' }}>⚠ {error}</p>
      )}
    </div>
  );
}
