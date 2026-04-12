import { useState, useRef, useEffect, useCallback } from 'react';

const BACKEND = import.meta.env.VITE_BACKEND_URL;

export default function CompanySearch({ onSelect }) {
  const [query,    setQuery]   = useState('');
  const [results,  setResults] = useState([]);
  const [open,     setOpen]    = useState(false);
  const [loading,  setLoading] = useState(false);
  const [fetching, setFetching]= useState(false);
  const [loaded,   setLoaded]  = useState(null);   // { ticker, name }
  const [error,    setError]   = useState('');

  const debounceRef  = useRef(null);
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
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
      const res = await fetch(`${BACKEND}/company/${company.ticker}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setLoaded({ ticker: data.ticker, name: data.name, currency: data.currency });
      onSelect(data);
    } catch (e) {
      setError('Could not load financials. Try another ticker.');
    } finally {
      setFetching(false);
    }
  };

  const clear = () => {
    setQuery('');
    setLoaded(null);
    setError('');
    setResults([]);
  };

  if (!BACKEND) {
    return (
      <div className="px-3 py-2 rounded-xl mono text-[10px]"
        style={{ background:'rgba(244,63,94,0.06)', border:'1px solid rgba(244,63,94,0.18)', color:'rgba(244,63,94,0.7)' }}>
        ⚠ Backend not connected — company search unavailable
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">

      {/* Search box */}
      <div className="relative">
        {/* Icon */}
        <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color:'rgba(34,211,238,0.45)', fontSize:14, lineHeight:1 }}>
          ⌕
        </span>

        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setLoaded(null); setError(''); }}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="TCS, RELIANCE, AAPL…"
          className="w-full py-2 text-xs outline-none"
          style={{
            paddingLeft: 28, paddingRight: 28,
            background: 'rgba(34,211,238,0.04)',
            border: '1px solid rgba(34,211,238,0.15)',
            borderRadius: 10,
            color: '#f1f5f9',
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

        {/* Spinner / clear */}
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

      {/* Results dropdown */}
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
            <button key={r.ticker}
              onClick={() => selectCompany(r)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
              style={{
                borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span className="mono text-[10px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0"
                style={{
                  background: 'rgba(34,211,238,0.08)',
                  color: '#22d3ee',
                  border: '1px solid rgba(34,211,238,0.2)',
                  minWidth: 52,
                  textAlign: 'center',
                }}>
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
        <div className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-xl"
          style={{ background:'rgba(0,232,135,0.07)', border:'1px solid rgba(0,232,135,0.22)' }}>
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 pulse-dot"
            style={{ background:'#00e887', boxShadow:'0 0 5px #00e887' }} />
          <span className="mono text-[11px] font-bold flex-shrink-0" style={{ color:'#00e887' }}>
            {loaded.ticker}
          </span>
          <span className="text-slate-400 text-[11px] truncate">{loaded.name}</span>
          {loaded.currency && loaded.currency !== 'INR' && (
            <span className="mono text-[10px] ml-auto flex-shrink-0 px-1.5 py-0.5 rounded"
              style={{ background:'rgba(251,191,36,0.1)', color:'#fbbf24', border:'1px solid rgba(251,191,36,0.2)' }}>
              {loaded.currency}
            </span>
          )}
          <button onClick={clear} className="text-slate-600 hover:text-slate-400 text-xs flex-shrink-0 ml-1">✕</button>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="mt-1.5 mono text-[10px] px-1" style={{ color:'rgba(244,63,94,0.8)' }}>
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
