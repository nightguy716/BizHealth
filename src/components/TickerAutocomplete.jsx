/**
 * TickerAutocomplete — company search for forms.
 *
 * Strategy:
 *  1. Instant results from the local curated list (popular stocks, no latency).
 *  2. If local results < 3, also query the backend /stocks/search endpoint
 *     which covers all ~1800+ NSE-listed equities via NSE's public CSV.
 *  3. Merged & de-duped results shown in dropdown.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { searchCompanies } from '../data/companies.js';

const API = import.meta.env.VITE_API_URL
         || import.meta.env.VITE_BACKEND_URL
         || 'https://bizhealth-production.up.railway.app';

export default function TickerAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Search by ticker or company name…',
}) {
  const [results,  setResults]  = useState([]);
  const [open,     setOpen]     = useState(false);
  const [fetching, setFetching] = useState(false);
  const containerRef = useRef(null);
  const debounceRef  = useRef(null);
  const abortRef     = useRef(null);

  // Close on outside click
  useEffect(() => {
    const h = e => { if (!containerRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 1) { setResults([]); setOpen(false); return; }

    // 1 — instant local results
    const local = searchCompanies(q, 8);
    if (local.length > 0) {
      setResults(local);
      setOpen(true);
    }

    // 2 — if fewer than 3 local hits, supplement with backend full NSE list
    if (local.length < 3) {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      setFetching(true);
      try {
        const res = await fetch(
          `${API}/stocks/search?q=${encodeURIComponent(q)}&limit=10`,
          { signal: abortRef.current.signal }
        );
        if (res.ok) {
          const remote = await res.json();
          // Merge: prefer local, append remote results not already present
          const seen = new Set(local.map(c => c.ticker));
          const merged = [
            ...local,
            ...remote.filter(r => !seen.has(r.ticker)),
          ];
          setResults(merged);
          setOpen(merged.length > 0);
        }
      } catch (e) {
        if (e.name !== 'AbortError') console.warn('Stock search error:', e.message);
      } finally {
        setFetching(false);
      }
    }
  }, []);

  function handleChange(e) {
    const q = e.target.value;
    onChange(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(q), 150);
  }

  function handleSelect(company) {
    setOpen(false);
    setResults([]);
    onChange(company.ticker);
    onSelect(company);
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') setOpen(false);
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        {/* Search icon */}
        <span style={{
          position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)',
          color: 'var(--accent)', opacity: 0.55, fontSize: '0.95rem', pointerEvents: 'none',
          fontFamily: 'monospace',
        }}>⌕</span>

        <input
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          style={{
            width: '100%',
            paddingLeft: '1.75rem',
            paddingRight: (value || fetching) ? '1.75rem' : '0.65rem',
            paddingTop: '0.5rem',
            paddingBottom: '0.5rem',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '0.45rem',
            color: 'var(--text-1)',
            fontSize: '0.85rem',
            outline: 'none',
            fontFamily: 'var(--font-mono, monospace)',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
          onFocus={e => {
            e.target.style.borderColor = 'rgba(96,165,250,0.5)';
            e.target.style.boxShadow   = '0 0 0 2px rgba(96,165,250,0.1)';
          }}
          onBlur={e => {
            e.target.style.borderColor = 'var(--border)';
            e.target.style.boxShadow   = 'none';
          }}
        />

        {/* Spinner or clear */}
        <span style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)' }}>
          {fetching ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--accent)', animation: 'spin 0.8s linear infinite' }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31 11"/>
            </svg>
          ) : value ? (
            <button
              type="button"
              onClick={() => { onChange(''); setResults([]); setOpen(false); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-4)', fontSize: '0.7rem', padding: '0.1rem', lineHeight: 1,
              }}
            >✕</button>
          ) : null}
        </span>
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: '0.6rem',
          boxShadow: '0 8px 28px rgba(0,0,0,0.4)',
          zIndex: 200,
          overflow: 'hidden',
          maxHeight: '280px',
          overflowY: 'auto',
        }}>
          {results.map((r, i) => (
            <button
              key={r.ticker}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => handleSelect(r)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                width: '100%',
                padding: '0.55rem 0.75rem',
                background: 'transparent',
                border: 'none',
                borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {/* Ticker badge */}
              <span style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.7rem',
                fontWeight: 700,
                color: 'var(--accent)',
                background: 'rgba(96,165,250,0.1)',
                border: '1px solid rgba(96,165,250,0.2)',
                borderRadius: '0.35rem',
                padding: '0.15rem 0.45rem',
                minWidth: '60px',
                textAlign: 'center',
                flexShrink: 0,
              }}>
                {r.ticker.replace('.NS', '')}
              </span>

              {/* Name + meta */}
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.name}
                </p>
                <p style={{ margin: 0, fontSize: '0.67rem', color: 'var(--text-4)', marginTop: '0.1rem' }}>
                  {r.exchange}{r.sector ? ` · ${r.sector}` : ''}
                </p>
              </div>

              <span style={{ color: 'var(--text-4)', fontSize: '0.7rem', flexShrink: 0 }}>→</span>
            </button>
          ))}

          {/* "Powered by NSE" attribution footer */}
          <div style={{ padding: '0.3rem 0.75rem', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
            <span style={{ fontSize: '0.6rem', color: 'var(--text-4)' }}>NSE equity data</span>
          </div>
        </div>
      )}
    </div>
  );
}
