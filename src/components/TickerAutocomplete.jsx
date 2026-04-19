/**
 * TickerAutocomplete — lightweight company search for forms.
 * Uses the local curated company list (no backend call).
 * Calls onSelect({ ticker, name, sector, exchange }) when a company is chosen.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { searchCompanies } from '../data/companies.js';

export default function TickerAutocomplete({ value, onChange, onSelect, placeholder = 'AAPL, NVDA, TCS…' }) {
  const [results,  setResults]  = useState([]);
  const [open,     setOpen]     = useState(false);
  const containerRef            = useRef(null);
  const debounceRef             = useRef(null);

  // Close on outside click
  useEffect(() => {
    const h = e => { if (!containerRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const doSearch = useCallback((q) => {
    if (!q || q.length < 1) { setResults([]); setOpen(false); return; }
    const hits = searchCompanies(q, 8);
    setResults(hits);
    setOpen(hits.length > 0);
  }, []);

  function handleChange(e) {
    const q = e.target.value;
    onChange(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(q), 100);
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
            paddingRight: value ? '1.75rem' : '0.65rem',
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

        {/* Clear button */}
        {value && (
          <button
            type="button"
            onClick={() => { onChange(''); setResults([]); setOpen(false); }}
            style={{
              position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-4)', fontSize: '0.7rem', padding: '0.1rem',
              lineHeight: 1,
            }}
          >✕</button>
        )}
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
        }}>
          {results.map((r, i) => (
            <button
              key={r.ticker}
              type="button"
              onMouseDown={e => e.preventDefault()} // prevent blur before click
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
                minWidth: '52px',
                textAlign: 'center',
                flexShrink: 0,
              }}>
                {r.ticker}
              </span>

              {/* Name + meta */}
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.name}
                </p>
                <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-4)', marginTop: '0.1rem' }}>
                  {r.exchange}{r.sector ? ` · ${r.sector}` : ''}
                </p>
              </div>

              <span style={{ color: 'var(--text-4)', fontSize: '0.7rem', flexShrink: 0 }}>→</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
