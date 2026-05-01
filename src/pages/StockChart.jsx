import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TickerAutocomplete from '../components/TickerAutocomplete';

const QUICK_SYMBOLS = ['NASDAQ:AAPL', 'NASDAQ:NVDA', 'NYSE:SLB', 'NSE:RELIANCE', 'NSE:TCS'];

function normalizeSymbol(raw) {
  const value = String(raw || '').trim().toUpperCase();
  if (!value) return 'NYSE:SLB';
  if (value.includes(':')) return value;
  if (value.endsWith('.NS')) return `NSE:${value.replace('.NS', '')}`;
  if (value.endsWith('.BO')) return `BSE:${value.replace('.BO', '')}`;
  return `NYSE:${value}`;
}

function fromCompanyToSymbol(company) {
  const ticker = String(company?.ticker || '').trim().toUpperCase();
  const exchange = String(company?.exchange || '').trim().toUpperCase();
  if (!ticker) return 'NYSE:SLB';
  if (ticker.includes(':')) return ticker;
  if (ticker.endsWith('.NS')) return `NSE:${ticker.replace('.NS', '')}`;
  if (ticker.endsWith('.BO')) return `BSE:${ticker.replace('.BO', '')}`;
  if (exchange === 'NSE') return `NSE:${ticker}`;
  if (exchange === 'BSE') return `BSE:${ticker}`;
  if (exchange === 'NASDAQ') return `NASDAQ:${ticker}`;
  return `NYSE:${ticker}`;
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
    setSymbol(next);
    setInputValue(next);
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
              onSelect={(company) => applySymbol(fromCompanyToSymbol(company))}
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
