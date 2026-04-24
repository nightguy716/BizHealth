import { useState } from 'react';

/*
  DuPont 3-Factor Decomposition
  ─────────────────────────────
  ROE = Net Margin × Asset Turnover × Equity Multiplier
        (Profitability) (Efficiency)   (Leverage)

  5-Factor (Extended) DuPont:
  ROE = (Net Income/EBT) × (EBT/EBIT) × (EBIT/Revenue) × (Revenue/Assets) × (Assets/Equity)
       Tax Burden         Interest Burden  EBIT Margin     Asset Turnover   Equity Multiplier
*/

function pct(a, b)  { return (b && b !== 0) ? (a / b) * 100 : null; }
function ratio(a, b) { return (b && b !== 0) ? a / b : null; }
function fmt(v, unit) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  if (unit === '%') return v.toFixed(1) + '%';
  if (unit === 'x') return v.toFixed(2) + '×';
  return v.toFixed(2);
}

function getColor(v, low, high, inverse = false) {
  if (v === null || isNaN(v)) return 'var(--text-5)';
  const good = inverse ? v <= low : v >= high;
  const ok   = inverse ? v <= high : v >= low;
  if (good) return '#00e887';
  if (ok)   return '#fbbf24';
  return '#f43f5e';
}

/* ── A single box in the tree ── */
function Node({ label, value, unit, sub, color, tooltip, dim = false }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className="relative flex flex-col items-center justify-center rounded-xl p-3 text-center transition-all duration-200"
      style={{
        background: hover ? `${color}18` : `${color}0d`,
        border: `1px solid ${color}${hover ? '55' : '30'}`,
        minWidth: 110, minHeight: 72,
        cursor: tooltip ? 'help' : 'default',
        opacity: dim ? 0.55 : 1,
        boxShadow: hover && !dim ? `0 0 18px -4px ${color}60` : 'none',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 700,
        color, lineHeight: 1,
        textShadow: hover ? `0 0 16px ${color}80` : 'none',
      }}>
        {fmt(value, unit)}
      </span>
      <span style={{
        fontFamily: 'Inter, system-ui, sans-serif', fontSize: 10, fontWeight: 600,
        color: 'var(--text-3)', marginTop: 4, lineHeight: 1.2,
      }}>
        {label}
      </span>
      {sub && (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: 'var(--text-5)', marginTop: 2 }}>
          {sub}
        </span>
      )}
      {/* Tooltip */}
      {tooltip && hover && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '6px 10px', width: 180, zIndex: 50,
          fontFamily: 'Inter, system-ui, sans-serif', fontSize: 10, color: 'var(--text-3)',
          boxShadow: 'var(--shadow-lg)', lineHeight: 1.5, textAlign: 'left',
          whiteSpace: 'normal', pointerEvents: 'none',
        }}>
          {tooltip}
        </div>
      )}
    </div>
  );
}

/* ── Operator badge between nodes ── */
function Op({ symbol }) {
  return (
    <div style={{
      fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 700,
      color: 'var(--text-5)', padding: '0 6px', flexShrink: 0, alignSelf: 'center',
    }}>
      {symbol}
    </div>
  );
}

/* ── Connector line downward ── */
function Connector() {
  return (
    <div style={{ width: 1, height: 20, background: 'rgba(79,110,247,0.25)', margin: '0 auto' }} />
  );
}

/* ── Driver analysis below the tree ── */
function DriverRow({ label, value, unit, weight, color, tooltip }) {
  const [hover, setHover] = useState(false);
  const barPct = Math.min(Math.abs(weight || 0) * 100, 100);
  return (
    <div
      className="flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors duration-150"
      style={{ cursor: tooltip ? 'help' : 'default', background: hover ? 'rgba(255,255,255,0.025)' : 'transparent' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--text-3)', width: 160, flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color, width: 64, textAlign: 'right', flexShrink: 0 }}>
        {fmt(value, unit)}
      </span>
      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${barPct}%`, borderRadius: 999,
          background: color, boxShadow: `0 0 6px ${color}80`,
          transition: 'width 1s cubic-bezier(0.16,1,0.3,1)',
        }} />
      </div>
      {tooltip && hover && (
        <div style={{
          position: 'absolute', right: 0, background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px',
          width: 200, zIndex: 50, fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'var(--text-3)',
          boxShadow: 'var(--shadow-lg)', lineHeight: 1.5, pointerEvents: 'none',
        }}>
          {tooltip}
        </div>
      )}
    </div>
  );
}

export default function DuPontTree({ ratioValues, inputs }) {
  const [mode, setMode] = useState('3'); // '3' | '5'

  /* Raw inputs */
  const netProfit    = parseFloat(inputs?.netProfit)    || 0;
  const revenue      = parseFloat(inputs?.revenue)      || 0;
  const totalAssets  = parseFloat(inputs?.totalAssets)  || 0;
  const equity       = parseFloat(inputs?.equity)       || 0;
  const interestExp  = parseFloat(inputs?.interestExpense) || 0;
  const operatingExp = parseFloat(inputs?.operatingExpenses) || 0;
  const grossProfit  = parseFloat(inputs?.grossProfit)   || 0;

  /* EBIT approximation = grossProfit - operatingExpenses */
  const ebit = grossProfit - operatingExp;
  /* EBT  approximation = netProfit + taxEstimate ≈ ebit - interestExpense
     (we approximate; users can see the formula) */
  const ebt  = ebit - interestExp;

  /* 3-Factor */
  const netMargin       = pct(netProfit, revenue);       // Net Income / Revenue × 100
  const assetTurnover   = ratio(revenue, totalAssets);   // Revenue / Total Assets
  const equityMultiplier= ratio(totalAssets, equity);    // Total Assets / Equity
  const roe3            = netMargin !== null && assetTurnover !== null && equityMultiplier !== null
                          ? (netMargin / 100) * assetTurnover * equityMultiplier * 100
                          : null;

  /* 5-Factor */
  const taxBurden      = ratio(netProfit, ebt);          // Net Income / EBT
  const interestBurden = ratio(ebt, ebit);               // EBT / EBIT
  const ebitMargin     = pct(ebit, revenue);             // EBIT / Revenue
  const roe5           = (taxBurden !== null && interestBurden !== null &&
                          ebitMargin !== null && assetTurnover !== null && equityMultiplier !== null)
                          ? taxBurden * interestBurden * (ebitMargin / 100) * assetTurnover * equityMultiplier * 100
                          : null;

  const roeActual  = pct(netProfit, equity);
  const hasData    = revenue > 0 && totalAssets > 0 && equity > 0 && netProfit !== 0;

  /* Color thresholds */
  const nmColor  = getColor(netMargin,   5,  15);
  const atColor  = getColor(assetTurnover, 0.5, 1.0);
  const emColor  = getColor(equityMultiplier, 1, 3, true); // lower is safer
  const roeColor = getColor(roe3 ?? roeActual, 8, 15);

  const tbColor  = getColor(taxBurden,     0.65, 0.80);
  const ibColor  = getColor(interestBurden, 0.75, 0.90);
  const emColor5 = getColor(ebitMargin,   5, 12);

  /* Contribution weights (normalised absolute) */
  const factors3 = [
    { label: 'Net Margin',        value: netMargin,       unit: '%', color: nmColor,
      tooltip: 'Profitability driver. Higher means the company keeps more of each revenue dollar as profit.' },
    { label: 'Asset Turnover',    value: assetTurnover,   unit: 'x', color: atColor,
      tooltip: 'Efficiency driver. Higher means assets generate more revenue per dollar invested.' },
    { label: 'Equity Multiplier', value: equityMultiplier, unit: 'x', color: emColor,
      tooltip: 'Leverage driver. Higher means more debt is used to finance assets — amplifies returns but adds risk.' },
  ];

  if (!hasData) {
    return (
      <section className="ghost-card rounded-2xl p-6 mb-10 animate-in">
        <div className="flex items-center gap-3 mb-3">
          <span className="mono text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: '#a78bfa' }}>DuPont Decomposition</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-4)' }}>
          Enter Revenue, Total Assets, Equity, and Net Profit in the sidebar to see the DuPont tree.
        </p>
      </section>
    );
  }

  return (
    <section className="ghost-card rounded-2xl p-6 mb-10 animate-in overflow-hidden relative">
      {/* Ambient glow */}
      <div className="absolute top-0 right-0 w-64 h-64 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.06) 0%, transparent 70%)', transform: 'translate(30%,-30%)' }} />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-lg">🌳</span>
          <div>
            <span className="mono text-[11px] font-bold uppercase tracking-[0.18em]"
              style={{ color: '#a78bfa' }}>DuPont Decomposition</span>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-4)' }}>
              ROE = Net Margin × Asset Turnover × Equity Multiplier
            </p>
          </div>
        </div>
        {/* 3 / 5 factor toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {[['3','3-Factor'],['5','5-Factor']].map(([id, label]) => (
            <button key={id} onClick={() => setMode(id)}
              className="px-3 py-1 rounded-md text-[10px] font-bold transition-all duration-150 mono"
              style={mode === id
                ? { background: 'rgba(167,139,250,0.2)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.35)' }
                : { background: 'transparent', color: 'var(--text-4)', border: '1px solid transparent' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── 3-FACTOR TREE ─── */}
      {mode === '3' && (
        <>
          {/* ROE result — top of tree */}
          <div className="flex justify-center mb-1">
            <Node label="Return on Equity" value={roe3 ?? roeActual} unit="%" color={roeColor}
              sub="Net Margin × Asset T/O × Equity Mult."
              tooltip="ROE measures how efficiently the company generates profit from shareholders' equity. CFA benchmark: >15% is strong." />
          </div>
          <Connector />
          {/* Equals row */}
          <div className="flex items-stretch justify-center gap-1 flex-wrap">
            <Node label="Net Margin" value={netMargin} unit="%" color={nmColor}
              sub="Net Profit / Revenue"
              tooltip="Profitability component. Improve via pricing power, cost discipline, or tax efficiency." />
            <Op symbol="×" />
            <Node label="Asset Turnover" value={assetTurnover} unit="x" color={atColor}
              sub="Revenue / Total Assets"
              tooltip="Efficiency component. Capital-light businesses (tech) score higher; asset-heavy (utilities) score lower." />
            <Op symbol="×" />
            <Node label="Equity Multiplier" value={equityMultiplier} unit="x" color={emColor}
              sub="Total Assets / Equity"
              tooltip="Leverage component. A multiplier >3× adds meaningful financial risk. Banks often run at 8–12×." />
          </div>

          {/* Driver bars */}
          <div className="mt-6 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="mono text-[9px] font-bold uppercase tracking-[0.14em] mb-3" style={{ color: 'var(--text-5)' }}>
              DRIVER CONTRIBUTION
            </p>
            <div className="relative">
              {factors3.map(f => {
                /* Normalise contribution as share of log-product */
                const total = (Math.abs(netMargin || 0.01) + Math.abs((assetTurnover || 0.01) * 100) + Math.abs(equityMultiplier || 0.01));
                const myAbs = f.label === 'Net Margin' ? Math.abs(netMargin || 0)
                            : f.label === 'Asset Turnover' ? Math.abs((assetTurnover || 0) * 100)
                            : Math.abs(equityMultiplier || 0);
                const weight = total > 0 ? myAbs / total : 0;
                return (
                  <DriverRow key={f.label} label={f.label} value={f.value} unit={f.unit}
                    color={f.color} weight={weight} tooltip={f.tooltip} />
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ─── 5-FACTOR TREE ─── */}
      {mode === '5' && (
        <>
          {/* ROE */}
          <div className="flex justify-center mb-1">
            <Node label="Return on Equity" value={roe5 ?? roeActual} unit="%" color={roeColor}
              sub="5-Factor Extended DuPont"
              tooltip="Extended DuPont isolates the tax, interest, and operating efficiency contributions separately." />
          </div>
          <Connector />
          {/* 5 factors */}
          <div className="flex items-stretch justify-center gap-1 flex-wrap">
            <Node label="Tax Burden" value={taxBurden} unit="x" color={tbColor}
              sub="Net Income / EBT"
              tooltip="Fraction of pre-tax income retained after taxes. A value of 0.75 means 25% tax rate. Closer to 1 is better." />
            <Op symbol="×" />
            <Node label="Interest Burden" value={interestBurden} unit="x" color={ibColor}
              sub="EBT / EBIT"
              tooltip="Fraction of operating income remaining after interest. Closer to 1 means low debt burden." />
            <Op symbol="×" />
            <Node label="EBIT Margin" value={ebitMargin} unit="%" color={emColor5}
              sub="EBIT / Revenue"
              tooltip="Operating profitability before interest and taxes. Isolates core business efficiency." />
            <Op symbol="×" />
            <Node label="Asset Turnover" value={assetTurnover} unit="x" color={atColor}
              sub="Revenue / Total Assets"
              tooltip="Efficiency: how much revenue each dollar of assets generates." />
            <Op symbol="×" />
            <Node label="Equity Multiplier" value={equityMultiplier} unit="x" color={emColor}
              sub="Total Assets / Equity"
              tooltip="Financial leverage. Amplifies both returns and risk." />
          </div>

          {/* Insight summary */}
          <div className="mt-6 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            {[
              {
                label: 'Profitability Path',
                icon: 'PR',
                color: '#00e887',
                value: ebitMargin !== null ? ebitMargin.toFixed(1) + '% EBIT Margin' : '—',
                sub: netMargin !== null ? `${netMargin.toFixed(1)}% reaches bottom line` : '',
              },
              {
                label: 'Efficiency Path',
                icon: 'EF',
                color: '#22d3ee',
                value: assetTurnover !== null ? assetTurnover.toFixed(2) + '× Asset T/O' : '—',
                sub: 'Revenue generated per asset dollar',
              },
              {
                label: 'Leverage Path',
                icon: 'LV',
                color: '#fbbf24',
                value: equityMultiplier !== null ? equityMultiplier.toFixed(2) + '× EM' : '—',
                sub: equityMultiplier > 3 ? 'High leverage — monitor coverage' : 'Leverage within acceptable range',
              },
            ].map(item => (
              <div key={item.label} className="rounded-xl p-3"
                style={{ background: `${item.color}0d`, border: `1px solid ${item.color}25` }}>
                <div className="flex items-center gap-2 mb-1">
                  <span>{item.icon}</span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, color: item.color }}>
                    {item.label}
                  </span>
                </div>
                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: item.color }}>
                  {item.value}
                </p>
                {item.sub && (
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'var(--text-4)', marginTop: 2 }}>
                    {item.sub}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* CFA note */}
      <p className="mt-5 text-[10px]" style={{ color: 'var(--text-5)', fontFamily: 'Inter, sans-serif' }}>
        <span style={{ color: '#a78bfa' }}>CFA L1 ·</span> DuPont analysis identifies whether ROE is driven by
        profitability, efficiency, or leverage — critical for equity valuation and peer benchmarking.
        High leverage-driven ROE carries higher credit risk.
      </p>
    </section>
  );
}
