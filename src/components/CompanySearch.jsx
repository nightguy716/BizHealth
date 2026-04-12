import { useState, useRef, useEffect, useCallback } from 'react';

const BACKEND  = import.meta.env.VITE_BACKEND_URL;
const FMP_KEY  = import.meta.env.VITE_FMP_API_KEY;
const FMP_BASE = 'https://financialmodelingprep.com/api/v3';

const SECTOR_MAP = {
  'Technology': 'tech', 'Communication Services': 'tech',
  'Healthcare': 'healthcare', 'Financial Services': 'finance',
  'Consumer Defensive': 'retail', 'Consumer Cyclical': 'retail',
  'Industrials': 'manufacturing', 'Basic Materials': 'manufacturing',
  'Energy': 'manufacturing',
};

function fv(obj, ...keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null && !Number.isNaN(Number(v))) return Number(v);
  }
  return null;
}

async function fetchCompanyData(ticker) {
  // FMP uses bare tickers (no .NS / .BO suffix)
  const sym = ticker.replace(/\.(NS|BO|L|PA|AS|TO|AX)$/i, '').toUpperCase();

  const [incR, balR, profileR] = await Promise.all([
    fetch(`${FMP_BASE}/income-statement/${sym}?limit=1&apikey=${FMP_KEY}`),
    fetch(`${FMP_BASE}/balance-sheet-statement/${sym}?limit=1&apikey=${FMP_KEY}`),
    fetch(`${FMP_BASE}/profile/${sym}?apikey=${FMP_KEY}`),
  ]);

  const [incList, balList, profileList] = await Promise.all([
    incR.json(), balR.json(), profileR.json(),
  ]);

  if (!Array.isArray(incList) || !incList.length) {
    throw new Error(`No financial data found for ${sym}`);
  }

  const inc     = incList[0];
  const bal     = Array.isArray(balList) && balList.length ? balList[0] : {};
  const profile = Array.isArray(profileList) && profileList.length ? profileList[0] : {};

  const revenue   = fv(inc, 'revenue');
  const grossP    = fv(inc, 'grossProfit');
  const cogsRaw   = fv(inc, 'costOfRevenue');
  const opExp     = fv(inc, 'operatingExpenses');
  const netIncome = fv(inc, 'netIncome');
  const interest  = fv(inc, 'interestExpense');

  const raw = {
    currentAssets:      fv(bal, 'totalCurrentAssets'),
    currentLiabilities: fv(bal, 'totalCurrentLiabilities'),
    inventory:          fv(bal, 'inventory'),
    cash:               fv(bal, 'cashAndCashEquivalents', 'cashAndShortTermInvestments'),
    totalAssets:        fv(bal, 'totalAssets'),
    equity:             fv(bal, 'totalStockholdersEquity', 'stockholdersEquity'),
    totalDebt:          fv(bal, 'totalDebt', 'longTermDebt'),
    revenue,
    grossProfit:  grossP  ?? (revenue && cogsRaw ? revenue - cogsRaw : null),
    operatingExpenses: opExp,
    netProfit:    netIncome,
    interestExpense: interest != null ? Math.abs(interest) : null,
    receivables:  fv(bal, 'netReceivables', 'accountsReceivable'),
    cogs:         cogsRaw ?? (revenue && grossP ? revenue - grossP : null),
  };

  const data = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v != null && !Number.isNaN(v) && Math.abs(v) > 0) {
      data[k] = String(Math.round(Math.abs(v)));
    }
  }

  const total    = Object.keys(raw).length;
  const filled   = Object.keys(data).length;
  const coverage = Math.round((filled / total) * 100);

  return {
    ticker:   sym,
    name:     profile.companyName || sym,
    sector:   profile.sector || '',
    industry: SECTOR_MAP[profile.sector] || 'general',
    currency: profile.currency || inc.reportedCurrency || 'USD',
    coverage, filled, total,
    data,
  };
}

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
    const handler = e => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
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
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 380);
    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch]);

  const selectCompany = async (company) => {
    setOpen(false);
    setLoaded(null);
    setError('');
    setQuery(company.name || company.ticker);
    setFetching(true);
    try {
      if (!FMP_KEY) throw new Error('VITE_FMP_API_KEY not set in Vercel');
      const companyData = await fetchCompanyData(company.ticker);
      setLoaded({
        ticker:   companyData.ticker,
        name:     companyData.name,
        currency: companyData.currency,
        coverage: companyData.coverage,
        filled:   companyData.filled,
        total:    companyData.total,
      });
      onSelect(companyData);
    } catch (e) {
      setError(e.message || 'Could not load financials. Try another ticker.');
    } finally {
      setFetching(false);
    }
  };

  const clear = () => { setQuery(''); setLoaded(null); setError(''); setResults([]); };

  if (!FMP_KEY) {
    return (
      <div className="px-3 py-2.5 rounded-xl mono text-[10px] leading-relaxed"
        style={{ background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.2)', color:'rgba(251,191,36,0.8)' }}>
        ⚠ Add <strong>VITE_FMP_API_KEY</strong> to Vercel to enable company search
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color:'rgba(34,211,238,0.45)', fontSize:14 }}>⌕</span>

        <input type="text" value={query}
          onChange={e => { setQuery(e.target.value); setLoaded(null); setError(''); }}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="AAPL, TCS, RELIANCE…"
          className="w-full py-2 text-xs outline-none"
          style={{
            paddingLeft: 28, paddingRight: 28,
            background: 'rgba(34,211,238,0.04)',
            border: '1px solid rgba(34,211,238,0.15)',
            borderRadius: 10, color: '#f1f5f9',
            fontFamily: 'var(--font-mono)',
            transition: 'border-color .15s, box-shadow .15s',
          }}
          onFocusCapture={e => {
            e.target.style.borderColor = 'rgba(34,211,238,0.4)';
            e.target.style.boxShadow   = '0 0 0 2px rgba(34,211,238,0.08)';
          }}
          onBlurCapture={e => {
            e.target.style.borderColor = 'rgba(34,211,238,0.15)';
            e.target.style.boxShadow   = 'none';
          }}
        />

        <span className="absolute right-3 top-1/2 -translate-y-1/2">
          {(loading || fetching) ? (
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none"
              style={{ color:'#22d3ee' }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
                strokeDasharray="31 11" />
            </svg>
          ) : query ? (
            <button onClick={clear}
              className="text-slate-600 hover:text-slate-400 transition-colors leading-none"
              style={{ fontSize:12 }}>✕</button>
          ) : null}
        </span>
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 rounded-xl overflow-hidden"
          style={{
            top: '100%',
            background: 'rgba(4,9,22,0.98)',
            border: '1px solid rgba(34,211,238,0.14)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          }}>
          {results.map((r, i) => (
            <button key={r.ticker} onClick={() => selectCompany(r)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
              style={{ borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span className="mono text-[10px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0"
                style={{ background:'rgba(34,211,238,0.08)', color:'#22d3ee', border:'1px solid rgba(34,211,238,0.2)', minWidth:52, textAlign:'center' }}>
                {r.ticker}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-slate-200 text-xs truncate leading-tight">{r.name}</p>
                <p className="mono text-[10px] mt-0.5" style={{ color:'rgba(100,116,139,0.8)' }}>
                  {r.exchange} · {r.type}
                </p>
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
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 pulse-dot"
              style={{ background:'#00e887', boxShadow:'0 0 5px #00e887' }} />
            <span className="mono text-[11px] font-bold flex-shrink-0" style={{ color:'#00e887' }}>
              {loaded.ticker}
            </span>
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
                  style={{
                    width: `${loaded.coverage}%`,
                    background: loaded.coverage >= 80 ? 'linear-gradient(90deg,#00e887,#22d3ee)' : 'linear-gradient(90deg,#fbbf24,#f59e0b)',
                  }} />
              </div>
              {loaded.coverage < 100 && (
                <p className="text-[9px] mt-1.5 leading-relaxed" style={{ color:'rgba(100,116,139,0.7)' }}>
                  Missing fields (Inventory, Interest) are normal for service/tech companies.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-1.5 mono text-[10px] px-1" style={{ color:'rgba(244,63,94,0.8)' }}>⚠ {error}</p>
      )}
    </div>
  );
}
