import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TickerAutocomplete from '../components/TickerAutocomplete';
import { fromCompanyToTradingViewSymbol, getTradingViewSymbolCandidates, toTradingViewSymbol } from '../lib/chartSymbols';

const QUICK_SYMBOLS = ['NASDAQ:AAPL', 'NASDAQ:NVDA', 'NYSE:SLB', 'NSE:RELIANCE', 'NSE:TCS'];

function normalizeSymbol(raw) {
  return toTradingViewSymbol(raw, 'NYSE');
}

function symbolToSearchValue(raw) {
  const value = String(raw || '').trim().toUpperCase();
  if (!value) return '';
  if (value.includes(':')) return value.split(':')[1] || value;
  return value.replace('.NS', '').replace('.BO', '');
}

export default function StockChart() {
  const location = useLocation();
  const navigate = useNavigate();
  const chartHostRef = useRef(null);

  const querySymbol = useMemo(
    () => new URLSearchParams(location.search).get('symbol') || 'NYSE:SLB',
    [location.search],
  );

  const [inputValue, setInputValue] = useState(querySymbol);
  const [symbol, setSymbol] = useState(querySymbol);
  const [fallbackSymbols, setFallbackSymbols] = useState([]);
  const [isDark, setIsDark] = useState(document?.documentElement?.dataset?.theme !== 'light');

  useEffect(() => {
    setInputValue(symbolToSearchValue(querySymbol));
    setSymbol(querySymbol);
  }, [querySymbol]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document?.documentElement?.dataset?.theme !== 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!chartHostRef.current) return;
    chartHostRef.current.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'tradingview-widget-container';
    container.style.height = '100%';
    container.style.width = '100%';

    const chart = document.createElement('div');
    chart.className = 'tradingview-widget-container__widget';
    chart.style.height = 'calc(100% - 28px)';
    chart.style.width = '100%';

    const copyright = document.createElement('div');
    copyright.className = 'tradingview-widget-copyright';
    copyright.innerHTML = '<a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank"><span style="color: var(--text-4); font-size: 11px;">Charts by TradingView</span></a>';

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: 'D',
      timezone: 'Asia/Kolkata',
      theme: isDark ? 'dark' : 'light',
      style: '1',
      locale: 'en',
      enable_publishing: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: true,
      calendar: false,
      withdateranges: true,
      allow_symbol_change: true,
      support_host: 'https://www.tradingview.com',
    });

    container.appendChild(chart);
    container.appendChild(copyright);
    container.appendChild(script);
    chartHostRef.current.appendChild(container);
  }, [symbol, isDark]);

  function applySymbol(raw) {
    const next = normalizeSymbol(raw);
    const candidates = getTradingViewSymbolCandidates(raw, next.split(':')[0] || 'NYSE');
    setSymbol(next);
    setInputValue(next);
    setFallbackSymbols(candidates.filter((s) => s !== next).slice(0, 3));
    navigate(`/charts?symbol=${encodeURIComponent(next)}`, { replace: true });
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-1)', fontFamily: 'var(--font-sans)', paddingTop: '5rem' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '1rem 1rem 2rem' }}>
        <div style={{ marginBottom: 10 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>Stock Charts</h1>
          <div style={{ marginTop: 6, color: 'var(--text-3)', fontSize: 13 }}>
            Advanced charting with timeframe controls, chart types, indicators, and symbol search.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
          <div style={{ flex: '1 1 360px', minWidth: 280 }}>
            <TickerAutocomplete
              value={inputValue}
              onChange={setInputValue}
              onSelect={(company) => applySymbol(fromCompanyToTradingViewSymbol(company))}
              placeholder="Search ticker/company (e.g., SLB, AAPL, RELIANCE)"
            />
          </div>
          <button
            onClick={() => applySymbol(inputValue)}
            style={{
              background: 'var(--gold)',
              color: '#111827',
              border: '1px solid rgba(200,157,31,0.35)',
              borderRadius: 6,
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Load Chart
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {QUICK_SYMBOLS.map((s) => (
            <button
              key={s}
              onClick={() => applySymbol(s)}
              style={{
                background: symbol === s ? 'var(--gold)' : 'var(--surface)',
                color: symbol === s ? '#111827' : 'var(--text-2)',
                border: `1px solid ${symbol === s ? 'rgba(200,157,31,0.35)' : 'var(--border)'}`,
                borderRadius: 999,
                padding: '5px 10px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {fallbackSymbols.length > 0 && (
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--text-4)' }}>Symbol fallback:</span>
            {fallbackSymbols.map((s) => (
              <button
                key={s}
                onClick={() => applySymbol(s)}
                style={{
                  background: 'var(--surface)',
                  color: 'var(--text-3)',
                  border: '1px solid var(--border)',
                  borderRadius: 999,
                  padding: '4px 9px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div
          style={{
            height: '74vh',
            minHeight: 560,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <div ref={chartHostRef} style={{ height: '100%', width: '100%' }} />
        </div>
      </div>
    </div>
  );
}
