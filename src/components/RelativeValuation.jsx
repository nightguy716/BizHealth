import { useState } from 'react';

/*
  Relative Valuation Comps Table
  ──────────────────────────────
  Shows trading multiples for the company vs sector benchmarks.
  For listed companies (loaded via search), real multiples come from
  Yahoo Finance's defaultKeyStatistics module.
  For manually entered data, we derive implied multiples from inputs + market cap entry.
*/

/* ── Sector benchmark multiples (median comps, 2024–2025 estimates) ── */
const SECTOR_BENCHMARKS = {
  tech:          { pe: 28, fwdPe: 22, evEbitda: 22, ps: 6.0, pb: 6.0,  peg: 1.5 },
  healthcare:    { pe: 22, fwdPe: 18, evEbitda: 16, ps: 3.5, pb: 3.0,  peg: 1.8 },
  finance:       { pe: 13, fwdPe: 11, evEbitda: 10, ps: 2.5, pb: 1.4,  peg: 1.2 },
  retail:        { pe: 20, fwdPe: 17, evEbitda: 12, ps: 0.8, pb: 4.0,  peg: 1.7 },
  manufacturing: { pe: 17, fwdPe: 14, evEbitda: 11, ps: 1.2, pb: 2.5,  peg: 1.4 },
  general:       { pe: 20, fwdPe: 16, evEbitda: 14, ps: 2.0, pb: 3.0,  peg: 1.5 },
};

/* Premium / discount thresholds for color coding */
function multipleStatus(value, benchmark) {
  if (value === null || benchmark === null) return 'na';
  const pct = (value - benchmark) / benchmark;
  if (pct > 0.25)  return 'premium';   // >25% above sector → expensive
  if (pct < -0.25) return 'discount';  // >25% below sector → cheap
  return 'fair';
}

const STATUS_STYLE = {
  premium:  { color: '#f43f5e', bg: 'rgba(244,63,94,0.08)',  border: 'rgba(244,63,94,0.25)',  label: 'PREMIUM'  },
  discount: { color: '#00e887', bg: 'rgba(0,232,135,0.08)',  border: 'rgba(0,232,135,0.25)',  label: 'DISCOUNT' },
  fair:     { color: '#4f6ef7', bg: 'rgba(79,110,247,0.08)', border: 'rgba(79,110,247,0.25)', label: 'FAIR'     },
  na:       { color: '#3d5070', bg: 'rgba(255,255,255,0.04)',border: 'rgba(255,255,255,0.08)',label: 'N/A'      },
};

function fmt(v, decimals = 1) {
  if (v === null || v === undefined || isNaN(v) || !isFinite(v)) return '—';
  return v.toFixed(decimals) + '×';
}
function fmtPct(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%';
}
function fmtBig(v) {
  if (!v || isNaN(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e12) return (v / 1e12).toFixed(2) + 'T';
  if (abs >= 1e9)  return (v / 1e9).toFixed(2)  + 'B';
  if (abs >= 1e6)  return (v / 1e6).toFixed(2)  + 'M';
  if (abs >= 1e3)  return (v / 1e3).toFixed(1)  + 'K';
  return v.toFixed(0);
}

/* ── Gauge bar comparing value to benchmark ── */
function MultipleBar({ value, benchmark }) {
  if (value === null || benchmark === null) return null;
  // Normalise: benchmark = 50% width
  const ratio = Math.min(value / (benchmark * 2), 1);
  const benchmarkPct = 50; // benchmark always at 50%
  const status = multipleStatus(value, benchmark);
  const color = STATUS_STYLE[status].color;
  return (
    <div className="relative mt-1" style={{ height: 3 }}>
      <div className="absolute inset-0 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
      <div className="absolute top-0 left-0 h-full rounded-full"
        style={{ width: `${ratio * 100}%`, background: color, transition: 'width 0.8s ease',
          boxShadow: `0 0 4px ${color}60` }} />
      {/* Benchmark tick */}
      <div className="absolute top-[-2px] bottom-[-2px] w-[1px]"
        style={{ left: `${benchmarkPct}%`, background: 'rgba(255,255,255,0.2)' }} />
    </div>
  );
}

export default function RelativeValuation({ companyContext, inputs, industry = 'general' }) {
  const [manualMktCap, setManualMktCap] = useState('');
  const [showManual, setShowManual]     = useState(false);

  const md      = companyContext?.marketData || {};
  const bench   = SECTOR_BENCHMARKS[industry] || SECTOR_BENCHMARKS.general;
  const isListed = companyContext?.isListed && Object.keys(md).length > 0;

  /* Derive implied multiples if manual market cap is provided */
  const netProfit   = parseFloat(inputs?.netProfit)   || 0;
  const revenue     = parseFloat(inputs?.revenue)     || 0;
  const equity      = parseFloat(inputs?.equity)      || 0;
  const totalDebt   = parseFloat(inputs?.totalDebt)   || 0;
  const cash        = parseFloat(inputs?.cash)        || 0;
  const da          = parseFloat(inputs?.da)          || 0;
  const grossProfit = parseFloat(inputs?.grossProfit) || 0;
  const opEx        = parseFloat(inputs?.operatingExpenses) || 0;
  const ebit        = grossProfit - opEx;
  const ebitda      = ebit + da;

  const mktCapManual = parseFloat(manualMktCap.replace(/[^0-9.]/g, '')) || 0;
  const evManual     = mktCapManual > 0 ? mktCapManual + totalDebt - cash : null;

  /* Multiples — prefer live market data, fall back to manual */
  const multiples = {
    trailingPE:  md.trailingPE  ?? (mktCapManual > 0 && netProfit > 0 ? mktCapManual / netProfit : null),
    forwardPE:   md.forwardPE   ?? null,
    evEbitda:    md.evToEbitda  ?? (evManual && ebitda > 0 ? evManual / ebitda : null),
    ps:          md.priceToSales ?? (mktCapManual > 0 && revenue > 0 ? mktCapManual / revenue : null),
    pb:          md.priceToBook  ?? (mktCapManual > 0 && equity > 0  ? mktCapManual / equity  : null),
    peg:         md.pegRatio    ?? null,
    evRevenue:   md.evToRevenue ?? (evManual && revenue > 0 ? evManual / revenue : null),
  };

  const rows = [
    { key: 'trailingPE', label: 'Trailing P/E',   value: multiples.trailingPE, benchKey: 'pe',       tooltip: 'Price / Trailing 12M EPS. Classic valuation measure. <15 = value, >25 = growth premium.' },
    { key: 'forwardPE',  label: 'Forward P/E',    value: multiples.forwardPE,  benchKey: 'fwdPe',    tooltip: 'Price / Next 12M EPS estimate. Uses analyst consensus. Lower = cheaper on a forward basis.' },
    { key: 'evEbitda',   label: 'EV / EBITDA',    value: multiples.evEbitda,   benchKey: 'evEbitda', tooltip: 'Enterprise Value / EBITDA. Capital structure neutral — the go-to multiple in M&A and LBO analysis.' },
    { key: 'ps',         label: 'Price / Sales',  value: multiples.ps,         benchKey: 'ps',       tooltip: 'Market Cap / Revenue. Common for growth companies with no earnings. Useful for pre-profit SaaS.' },
    { key: 'pb',         label: 'Price / Book',   value: multiples.pb,         benchKey: 'pb',       tooltip: 'Market Cap / Book Equity. <1 may indicate undervaluation; key metric for financial firms.' },
    { key: 'peg',        label: 'PEG Ratio',      value: multiples.peg,        benchKey: 'peg',      tooltip: 'P/E ÷ Earnings Growth Rate. <1 is considered undervalued relative to growth (Peter Lynch rule).' },
    { key: 'evRevenue',  label: 'EV / Revenue',   value: multiples.evRevenue,  benchKey: null,       tooltip: 'Enterprise Value / Revenue. Capital structure neutral alternative to P/S.' },
  ];

  const hasAnyMultiple = rows.some(r => r.value !== null);

  return (
    <section className="ghost-card rounded-2xl p-6 mb-10 animate-in overflow-hidden relative">
      {/* Glow */}
      <div className="absolute top-0 right-0 w-56 h-56 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.07) 0%, transparent 70%)', transform: 'translate(30%,-30%)' }} />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-lg">📐</span>
          <div>
            <span className="mono text-[11px] font-bold uppercase tracking-[0.18em]"
              style={{ color: '#a78bfa' }}>Relative Valuation</span>
            <p className="text-[10px] mt-0.5" style={{ color: '#6b82a8' }}>
              Trading multiples vs sector median · P/E · EV/EBITDA · P/S · P/B · PEG
            </p>
          </div>
        </div>
        {isListed && md.currentPrice && (
          <div className="flex items-center gap-2">
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#6b82a8' }}>
              PRICE
            </span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 700, color: '#22d3ee' }}>
              {companyContext.currency} {fmtBig(md.currentPrice)}
            </span>
            {md.targetMeanPrice && (
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                color: md.targetMeanPrice > md.currentPrice ? '#00e887' : '#f43f5e' }}>
                → {fmtBig(md.targetMeanPrice)} target
              </span>
            )}
          </div>
        )}
      </div>

      {/* Market summary strip (listed companies) */}
      {isListed && (md.marketCap || md.enterpriseValue || md.beta) && (
        <div className="flex flex-wrap gap-3 mb-5 p-3 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {[
            { label: 'Market Cap',   value: fmtBig(md.marketCap),        color: '#7b95fa' },
            { label: 'Enterprise V', value: fmtBig(md.enterpriseValue),   color: '#7b95fa' },
            { label: 'Beta',         value: md.beta ? md.beta.toFixed(2) + '×' : '—', color: md.beta > 1.5 ? '#f43f5e' : md.beta < 0.8 ? '#00e887' : '#fbbf24' },
            { label: 'Fwd EPS',      value: md.forwardEps ? companyContext.currency + ' ' + md.forwardEps.toFixed(2) : '—', color: '#22d3ee' },
            { label: 'Analysts',     value: md.numberOfAnalysts ? md.numberOfAnalysts + ' analysts' : '—', color: '#6b82a8' },
            { label: 'Rev. Growth',  value: fmtPct(md.revenueGrowthYoY), color: md.revenueGrowthYoY > 0 ? '#00e887' : '#f43f5e' },
            { label: 'EPS Growth',   value: fmtPct(md.earningsGrowthYoY), color: md.earningsGrowthYoY > 0 ? '#00e887' : '#f43f5e' },
            ...(md.recommendationKey ? [{ label: 'Consensus', value: md.recommendationKey.toUpperCase(),
              color: md.recommendationKey.includes('buy') ? '#00e887' : md.recommendationKey === 'sell' ? '#f43f5e' : '#fbbf24' }] : []),
          ].filter(item => item.value !== '—').map(({ label, value, color }) => (
            <div key={label} className="flex flex-col">
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: '#3d5070', letterSpacing: '0.1em' }}>
                {label.toUpperCase()}
              </span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color, marginTop: 2 }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Manual market cap input (non-listed) */}
      {!isListed && (
        <div className="mb-5">
          <button onClick={() => setShowManual(p => !p)}
            className="flex items-center gap-2 text-[10px] font-semibold mb-2 transition-colors"
            style={{ color: showManual ? '#a78bfa' : '#6b82a8', fontFamily: 'Inter, sans-serif' }}>
            <span style={{ fontSize: 12 }}>{showManual ? '▲' : '▼'}</span>
            {showManual ? 'Hide manual market cap' : 'Enter market cap to derive multiples'}
          </button>
          {showManual && (
            <div className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)' }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#9fb3d4', flexShrink: 0 }}>
                Market Cap
              </span>
              <input
                type="text"
                value={manualMktCap}
                onChange={e => setManualMktCap(e.target.value)}
                placeholder="e.g. 5000000000 or 5B"
                className="flex-1 outline-none text-xs rounded-lg px-3 py-1.5"
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                  color: '#ffffff', fontFamily: 'JetBrains Mono, monospace',
                }}
              />
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#3d5070', flexShrink: 0 }}>
                raw number
              </span>
            </div>
          )}
        </div>
      )}

      {!hasAnyMultiple ? (
        <p style={{ fontSize: 11, color: '#6b82a8', fontFamily: 'Inter, sans-serif' }}>
          {isListed
            ? 'Multiples not available for this ticker from Yahoo Finance.'
            : 'Search a listed company via the sidebar, or enter a market cap above to derive implied multiples.'}
        </p>
      ) : (
        <>
          {/* Comps table */}
          <div className="rounded-xl overflow-hidden mb-4"
            style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
            {/* Header */}
            <div className="grid px-3 py-2"
              style={{
                display: 'grid', gridTemplateColumns: '1.2fr 80px 80px 80px 80px',
                background: 'rgba(255,255,255,0.04)', gap: 8,
                fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
                fontWeight: 700, letterSpacing: '0.12em', color: '#3d5070',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
              <span>MULTIPLE</span>
              <span style={{ textAlign: 'right' }}>VALUE</span>
              <span style={{ textAlign: 'right' }}>SECTOR</span>
              <span style={{ textAlign: 'right' }}>PREMIUM</span>
              <span style={{ textAlign: 'right' }}>STATUS</span>
            </div>

            {rows.map(({ key, label, value, benchKey, tooltip }, i) => {
              const benchValue   = benchKey ? bench[benchKey] : null;
              const premiumPct   = (value !== null && benchValue) ? ((value - benchValue) / benchValue) * 100 : null;
              const status       = multipleStatus(value, benchValue);
              const sStyle       = STATUS_STYLE[status];
              const [showTip, setShowTip] = useState(false);

              return (
                <div key={key}
                  className="grid px-3 transition-colors duration-150 relative"
                  style={{
                    display: 'grid', gridTemplateColumns: '1.2fr 80px 80px 80px 80px',
                    padding: '8px 12px', alignItems: 'start', gap: 8,
                    borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    cursor: tooltip ? 'help' : 'default',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; setShowTip(true); }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; setShowTip(false); }}>

                  <div>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#d4ddf5' }}>{label}</span>
                    <MultipleBar value={value} benchmark={benchValue} />
                  </div>

                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700,
                    color: sStyle.color, textAlign: 'right', display: 'block' }}>
                    {fmt(value)}
                  </span>

                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                    color: '#6b82a8', textAlign: 'right', display: 'block' }}>
                    {benchKey ? fmt(bench[benchKey]) : '—'}
                  </span>

                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 600,
                    color: premiumPct === null ? '#3d5070'
                         : premiumPct > 0 ? '#f43f5e' : '#00e887',
                    textAlign: 'right', display: 'block' }}>
                    {premiumPct !== null ? (premiumPct >= 0 ? '+' : '') + premiumPct.toFixed(0) + '%' : '—'}
                  </span>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 8, fontWeight: 700,
                      letterSpacing: '0.06em', padding: '2px 6px', borderRadius: 999,
                      background: sStyle.bg, border: `1px solid ${sStyle.border}`, color: sStyle.color,
                    }}>
                      {sStyle.label}
                    </span>
                  </div>

                  {showTip && tooltip && (
                    <div style={{
                      position: 'absolute', bottom: 'calc(100% + 6px)', left: 12, zIndex: 50,
                      background: '#06101e', border: '1px solid rgba(79,110,247,0.3)',
                      borderRadius: 8, padding: '7px 10px', maxWidth: 260, width: 'max-content',
                      fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#9fb3d4', lineHeight: 1.6,
                      boxShadow: '0 4px 20px rgba(0,0,0,0.7)', pointerEvents: 'none',
                    }}>
                      {tooltip}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Valuation summary */}
          {(() => {
            const validRows  = rows.filter(r => r.value !== null && r.benchKey);
            const premiumCnt = validRows.filter(r => multipleStatus(r.value, bench[r.benchKey]) === 'premium').length;
            const discountCnt= validRows.filter(r => multipleStatus(r.value, bench[r.benchKey]) === 'discount').length;
            const fairCnt    = validRows.filter(r => multipleStatus(r.value, bench[r.benchKey]) === 'fair').length;
            if (!validRows.length) return null;
            const verdict = premiumCnt >= Math.ceil(validRows.length / 2) ? 'richly valued vs sector'
                          : discountCnt >= Math.ceil(validRows.length / 2) ? 'attractively priced vs sector'
                          : 'fairly valued vs sector median';
            const vColor  = premiumCnt >= Math.ceil(validRows.length / 2) ? '#f43f5e'
                          : discountCnt >= Math.ceil(validRows.length / 2) ? '#00e887'
                          : '#4f6ef7';
            return (
              <div className="px-4 py-3 rounded-xl"
                style={{ background: `${vColor}08`, border: `1px solid ${vColor}25` }}>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#d4ddf5', lineHeight: 1.6 }}>
                  <span style={{ color: vColor, fontWeight: 700 }}>Verdict: </span>
                  On {validRows.length} available multiples, this company appears{' '}
                  <span style={{ color: vColor, fontWeight: 600 }}>{verdict}</span>.
                  {' '}{premiumCnt} multiples trade at a premium, {discountCnt} at a discount, {fairCnt} within fair range.
                </p>
              </div>
            );
          })()}
        </>
      )}

      {/* CFA note */}
      <p className="mt-5 text-[10px]" style={{ color: '#3d5070', fontFamily: 'Inter, sans-serif' }}>
        <span style={{ color: '#a78bfa' }}>CFA L2 / Equity ·</span> Sector benchmarks represent 2024–25 median
        multiples. EV/EBITDA is preferred in M&A as it is capital-structure neutral. P/E is distorted by leverage
        and non-recurring items. Always triangulate multiple valuation methods.
      </p>
    </section>
  );
}
