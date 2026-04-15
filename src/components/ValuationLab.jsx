import { useState, useMemo } from 'react';

/*
  Valuation Lab — two panels:
  ①  DCF Sensitivity Table  — EV grid across WACC × Terminal Growth Rate
  ②  What-If Sliders        — adjust revenue growth, margin, leverage; see score shift live

  DCF Model (Unlevered, 5-year):
    FCF_t   = Revenue_t × EBITDA Margin × (1 - Tax Rate)
    Revenue_t  grows at industry-informed rates (adjustable)
    Terminal Value = FCF_5 × (1 + g) / (WACC - g)
    Enterprise Value = Σ FCF_t / (1+WACC)^t  +  TV / (1+WACC)^5
*/

/* ── Helpers ── */
function fmtBig(v) {
  if (v === null || v === undefined || !isFinite(v) || isNaN(v)) return '—';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e12) return sign + (abs / 1e12).toFixed(1) + 'T';
  if (abs >= 1e9)  return sign + (abs / 1e9).toFixed(1)  + 'B';
  if (abs >= 1e6)  return sign + (abs / 1e6).toFixed(1)  + 'M';
  if (abs >= 1e3)  return sign + (abs / 1e3).toFixed(1)  + 'K';
  return sign + abs.toFixed(0);
}

/* Simple 5-year DCF → Enterprise Value */
function calcEV(baseRevenue, annualGrowth, ebitdaMargin, taxRate, wacc, termGrowth) {
  if (wacc <= termGrowth) return null; // invalid: WACC must exceed g
  let rev = baseRevenue;
  let ev  = 0;
  let lastFCF = 0;
  for (let t = 1; t <= 5; t++) {
    rev     *= (1 + annualGrowth);
    const fcf = rev * ebitdaMargin * (1 - taxRate);
    ev      += fcf / Math.pow(1 + wacc, t);
    lastFCF  = fcf;
  }
  const tv = (lastFCF * (1 + termGrowth)) / (wacc - termGrowth);
  ev += tv / Math.pow(1 + wacc, 5);
  return ev;
}

/* ── Colour a cell relative to the base-case (center) value ── */
function cellColor(val, base) {
  if (val === null || base === null || base === 0) return { bg: 'rgba(255,255,255,0.04)', color: '#6b82a8' };
  const ratio = val / base;
  if (ratio >= 1.30) return { bg: 'rgba(0,232,135,0.18)',  color: '#00e887' };
  if (ratio >= 1.10) return { bg: 'rgba(0,232,135,0.10)',  color: '#00c874' };
  if (ratio >= 0.90) return { bg: 'rgba(79,110,247,0.12)', color: '#7b95fa' }; // base-case zone
  if (ratio >= 0.70) return { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24' };
  return                    { bg: 'rgba(244,63,94,0.14)',  color: '#f43f5e' };
}

/* ── Tabbed toggle ── */
function TabBar({ tabs, active, setActive }) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-lg"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {tabs.map(({ id, label, icon }) => (
        <button key={id} onClick={() => setActive(id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all duration-150 mono"
          style={active === id
            ? { background: 'rgba(79,110,247,0.2)', color: '#7b95fa', border: '1px solid rgba(79,110,247,0.35)' }
            : { background: 'transparent', color: '#6b82a8', border: '1px solid transparent' }}>
          {icon} {label}
        </button>
      ))}
    </div>
  );
}

/* ── Slider row ── */
function SliderRow({ label, value, min, max, step, onChange, format, color = '#4f6ef7' }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#9fb3d4' }}>{label}</span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color }}>
          {format(value)}
        </span>
      </div>
      <div className="relative h-[3px] rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
        {/* Fill */}
        <div className="absolute top-0 left-0 h-full rounded-full"
          style={{ width: `${pct}%`, background: color, transition: 'width 0.05s' }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          style={{ height: '100%' }} />
        {/* Thumb */}
        <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 pointer-events-none"
          style={{ left: `calc(${pct}% - 6px)`, background: '#06101e', borderColor: color,
            boxShadow: `0 0 8px ${color}`, transition: 'left 0.05s' }} />
      </div>
    </div>
  );
}

/* ── Industry defaults ── */
const INDUSTRY_DCF = {
  tech:          { growth: 0.20, ebitdaMargin: 0.28, wacc: 0.10 },
  healthcare:    { growth: 0.10, ebitdaMargin: 0.22, wacc: 0.09 },
  finance:       { growth: 0.08, ebitdaMargin: 0.35, wacc: 0.10 },
  retail:        { growth: 0.06, ebitdaMargin: 0.08, wacc: 0.09 },
  manufacturing: { growth: 0.06, ebitdaMargin: 0.15, wacc: 0.09 },
  general:       { growth: 0.08, ebitdaMargin: 0.20, wacc: 0.10 },
};

const WACC_COLS   = [0.06, 0.07, 0.08, 0.09, 0.10, 0.11, 0.12, 0.13, 0.14];
const G_ROWS      = [0.01, 0.02, 0.025, 0.03, 0.035, 0.04, 0.05];
const BASE_WACC   = 0.10;
const BASE_G      = 0.03;

export default function ValuationLab({ inputs, industry = 'general', ratioValues }) {
  const [tab, setTab] = useState('sensitivity');

  const baseRevenue = parseFloat(inputs?.revenue) || 0;
  const def         = INDUSTRY_DCF[industry] || INDUSTRY_DCF.general;

  /* ── Sensitivity table state ── */
  const [annualGrowth,   setAnnualGrowth]   = useState(def.growth);
  const [ebitdaMargin,   setEbitdaMargin]   = useState(def.ebitdaMargin);
  const [taxRate,        setTaxRate]        = useState(0.25);
  const [baseWacc,       setBaseWacc]       = useState(def.wacc);

  /* ── What-if sliders state ── */
  // Adjust from current ratio values
  const baseNetMargin  = ratioValues?.netMargin       ?? 10;
  const baseROE        = ratioValues?.roe             ?? 12;
  const baseDE         = ratioValues?.debtToEquity    ?? 1.0;
  const baseAT         = ratioValues?.assetTurnover   ?? 0.8;
  const baseIC         = ratioValues?.interestCoverage ?? 4.0;
  const baseCR         = ratioValues?.currentRatio    ?? 1.5;

  const [wiRevGrowth,   setWiRevGrowth]   = useState(5);    // %
  const [wiNetMargin,   setWiNetMargin]   = useState(Math.max(0, baseNetMargin));
  const [wiDE,          setWiDE]          = useState(Math.min(5, Math.max(0, baseDE)));
  const [wiAT,          setWiAT]          = useState(Math.min(3, Math.max(0.1, baseAT)));

  /* ── Compute sensitivity grid ── */
  const grid = useMemo(() => {
    if (baseRevenue <= 0) return null;
    return G_ROWS.map(g =>
      WACC_COLS.map(w => calcEV(baseRevenue, annualGrowth, ebitdaMargin, taxRate, w, g))
    );
  }, [baseRevenue, annualGrowth, ebitdaMargin, taxRate]);

  const baseEV = baseRevenue > 0
    ? calcEV(baseRevenue, annualGrowth, ebitdaMargin, taxRate, baseWacc, BASE_G)
    : null;

  /* ── What-if derived health indicators ── */
  const wiScore = useMemo(() => {
    // Recalculate a simplified score from the 4 slider-driven ratios
    const checks = [
      { v: wiNetMargin,      ok: 10,  good: 15   },  // Net Margin
      { v: wiDE,             ok: 1.5, good: 0.8, inv: true }, // D/E lower=better
      { v: wiAT,             ok: 0.6, good: 1.0  },  // Asset Turnover
      { v: wiRevGrowth,      ok: 3,   good: 8    },  // Revenue Growth
    ];
    let pts = 0;
    checks.forEach(({ v, ok, good, inv }) => {
      const isGood = inv ? v <= good : v >= good;
      const isOk   = inv ? v <= ok  : v >= ok;
      pts += isGood ? 2 : isOk ? 1 : 0;
    });
    return Math.round((pts / (checks.length * 2)) * 100);
  }, [wiNetMargin, wiDE, wiAT, wiRevGrowth]);

  const wiColor  = wiScore >= 70 ? '#00e887' : wiScore >= 40 ? '#fbbf24' : '#f43f5e';
  const wiRevFCF = baseRevenue > 0
    ? calcEV(baseRevenue * (1 + wiRevGrowth / 100), annualGrowth, wiNetMargin / 100, taxRate, baseWacc, BASE_G)
    : null;

  const hasData = baseRevenue > 0;

  return (
    <section className="ghost-card rounded-2xl p-6 mb-10 animate-in overflow-hidden relative">
      {/* Glow */}
      <div className="absolute bottom-0 right-0 w-64 h-64 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.05) 0%, transparent 70%)', transform: 'translate(30%,30%)' }} />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-lg">🧮</span>
          <div>
            <span className="mono text-[11px] font-bold uppercase tracking-[0.18em]"
              style={{ color: '#22d3ee' }}>Valuation Lab</span>
            <p className="text-[10px] mt-0.5" style={{ color: '#6b82a8' }}>
              DCF sensitivity grid · What-if scenario modelling
            </p>
          </div>
        </div>
        <TabBar
          tabs={[
            { id: 'sensitivity', label: 'Sensitivity', icon: '⊞' },
            { id: 'whatif',      label: 'What-If',     icon: '⊿' },
          ]}
          active={tab} setActive={setTab}
        />
      </div>

      {/* ═══ SENSITIVITY TABLE ═══ */}
      {tab === 'sensitivity' && (
        <>
          {!hasData ? (
            <p style={{ fontSize: 12, color: '#6b82a8' }}>
              Enter Revenue in the sidebar to unlock the DCF sensitivity grid.
            </p>
          ) : (
            <>
              {/* Assumption sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 mb-6 p-4 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <SliderRow label="Revenue Growth (yr 1–5)" value={annualGrowth}
                  min={0.02} max={0.50} step={0.01}
                  format={v => (v * 100).toFixed(0) + '%'} color="#22d3ee"
                  onChange={setAnnualGrowth} />
                <SliderRow label="EBITDA Margin" value={ebitdaMargin}
                  min={0.02} max={0.60} step={0.01}
                  format={v => (v * 100).toFixed(0) + '%'} color="#a78bfa"
                  onChange={setEbitdaMargin} />
                <SliderRow label="Base WACC" value={baseWacc}
                  min={0.05} max={0.18} step={0.005}
                  format={v => (v * 100).toFixed(1) + '%'} color="#4f6ef7"
                  onChange={setBaseWacc} />
                <SliderRow label="Tax Rate" value={taxRate}
                  min={0.10} max={0.40} step={0.01}
                  format={v => (v * 100).toFixed(0) + '%'} color="#fbbf24"
                  onChange={setTaxRate} />
              </div>

              {/* Base EV callout */}
              {baseEV && (
                <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(79,110,247,0.08)', border: '1px solid rgba(79,110,247,0.2)' }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#6b82a8' }}>
                    BASE CASE EV ({(baseWacc * 100).toFixed(1)}% WACC · {(BASE_G * 100).toFixed(1)}% g)
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 700, color: '#7b95fa',
                    textShadow: '0 0 20px rgba(79,110,247,0.5)' }}>
                    {fmtBig(baseEV)}
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#3d5070', marginLeft: 'auto' }}>
                    5-yr DCF · Unlevered
                  </span>
                </div>
              )}

              {/* Grid */}
              <div className="overflow-x-auto">
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 3 }}>
                  <thead>
                    <tr>
                      {/* Corner label */}
                      <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: '#3d5070', lineHeight: 1.3 }}>
                          <div>g ↓ WACC →</div>
                        </div>
                      </td>
                      {WACC_COLS.map(w => (
                        <td key={w} style={{ padding: '4px 6px', textAlign: 'center' }}>
                          <span style={{
                            fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 700,
                            color: Math.abs(w - baseWacc) < 0.001 ? '#7b95fa' : '#6b82a8',
                          }}>
                            {(w * 100).toFixed(0)}%
                            {Math.abs(w - baseWacc) < 0.001 && (
                              <span style={{ color: '#4f6ef7', marginLeft: 2 }}>★</span>
                            )}
                          </span>
                        </td>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {G_ROWS.map((g, ri) => (
                      <tr key={g}>
                        {/* Row header */}
                        <td style={{ padding: '4px 8px' }}>
                          <span style={{
                            fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 700,
                            color: Math.abs(g - BASE_G) < 0.001 ? '#7b95fa' : '#6b82a8',
                          }}>
                            {(g * 100).toFixed(1)}%
                            {Math.abs(g - BASE_G) < 0.001 && (
                              <span style={{ color: '#4f6ef7', marginLeft: 2 }}>★</span>
                            )}
                          </span>
                        </td>
                        {WACC_COLS.map((w, ci) => {
                          const val = grid?.[ri]?.[ci] ?? null;
                          const { bg, color } = cellColor(val, baseEV);
                          const isBase = Math.abs(w - baseWacc) < 0.001 && Math.abs(g - BASE_G) < 0.001;
                          return (
                            <td key={w} style={{ padding: 2 }}>
                              <div style={{
                                background: bg,
                                border: isBase ? '1px solid rgba(79,110,247,0.5)' : '1px solid transparent',
                                borderRadius: 6,
                                padding: '5px 6px',
                                textAlign: 'center',
                                fontFamily: 'JetBrains Mono, monospace',
                                fontSize: 10,
                                fontWeight: isBase ? 700 : 500,
                                color,
                                minWidth: 52,
                              }}>
                                {fmtBig(val)}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 mt-4">
                {[
                  { bg: 'rgba(0,232,135,0.18)',  color: '#00e887', label: '+30% above base' },
                  { bg: 'rgba(79,110,247,0.12)', color: '#7b95fa', label: '±10% base zone ★' },
                  { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24', label: '−10 to −30%' },
                  { bg: 'rgba(244,63,94,0.14)',  color: '#f43f5e', label: '>−30% downside' },
                ].map(({ bg, color, label }) => (
                  <span key={label} className="flex items-center gap-1.5"
                    style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: '#6b82a8' }}>
                    <span style={{ width: 10, height: 10, background: bg, border: `1px solid ${color}50`,
                      borderRadius: 3, display: 'inline-block' }} />
                    {label}
                  </span>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ═══ WHAT-IF SLIDERS ═══ */}
      {tab === 'whatif' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: sliders */}
          <div>
            <p className="mono text-[9px] font-bold uppercase tracking-[0.14em] mb-4" style={{ color: '#3d5070' }}>
              ADJUST ASSUMPTIONS
            </p>
            <SliderRow label="Revenue Growth Rate" value={wiRevGrowth}
              min={-20} max={60} step={1}
              format={v => (v >= 0 ? '+' : '') + v.toFixed(0) + '%'} color="#22d3ee"
              onChange={setWiRevGrowth} />
            <SliderRow label="Net Margin" value={wiNetMargin}
              min={-20} max={50} step={0.5}
              format={v => v.toFixed(1) + '%'} color="#00e887"
              onChange={setWiNetMargin} />
            <SliderRow label="Asset Turnover" value={wiAT}
              min={0.1} max={3.0} step={0.05}
              format={v => v.toFixed(2) + '×'} color="#a78bfa"
              onChange={setWiAT} />
            <SliderRow label="Debt / Equity" value={wiDE}
              min={0} max={5} step={0.1}
              format={v => v.toFixed(1) + '×'} color="#fbbf24"
              onChange={setWiDE} />
          </div>

          {/* Right: live indicators */}
          <div>
            <p className="mono text-[9px] font-bold uppercase tracking-[0.14em] mb-4" style={{ color: '#3d5070' }}>
              PROJECTED IMPACT
            </p>

            {/* Simulated health score */}
            <div className="rounded-xl p-4 mb-4"
              style={{ background: `${wiColor}0d`, border: `1px solid ${wiColor}30` }}>
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#9fb3d4' }}>
                  Projected Health Score
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#6b82a8' }}>
                  (simplified)
                </span>
              </div>
              <div className="flex items-end gap-2">
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 32, fontWeight: 700,
                  color: wiColor, lineHeight: 1, textShadow: `0 0 20px ${wiColor}60` }}>
                  {wiScore}
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, color: `${wiColor}80`, marginBottom: 3 }}>
                  /100
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <div style={{ width: `${wiScore}%`, height: '100%', borderRadius: 9999,
                  background: wiColor, transition: 'width 0.3s ease' }} />
              </div>
            </div>

            {/* KPI delta cards */}
            {[
              {
                label: 'Net Margin',
                base:  baseNetMargin,
                current: wiNetMargin,
                unit: '%',
                color: '#00e887',
              },
              {
                label: 'Asset Turnover',
                base: baseAT,
                current: wiAT,
                unit: '×',
                fmt: v => v.toFixed(2),
                color: '#a78bfa',
              },
              {
                label: 'Debt / Equity',
                base: baseDE,
                current: wiDE,
                unit: '×',
                fmt: v => v.toFixed(1),
                color: '#fbbf24',
              },
              ...(hasData && wiRevFCF ? [{
                label: 'Implied EV (DCF)',
                base: baseEV,
                current: wiRevFCF,
                unit: '',
                fmt: fmtBig,
                fmtBase: fmtBig,
                color: '#22d3ee',
              }] : []),
            ].map(({ label, base, current, unit, fmt: f = v => v.toFixed(1), fmtBase, color }) => {
              const delta  = base !== null ? current - base : null;
              const pctChg = base && base !== 0 ? (delta / Math.abs(base)) * 100 : null;
              const isUp   = delta > 0;
              return (
                <div key={label} className="flex items-center justify-between py-2 px-3 rounded-lg mb-1.5 transition-colors duration-150"
                  style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#9fb3d4' }}>{label}</span>
                  <div className="flex items-center gap-2">
                    {base !== null && (
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#3d5070' }}>
                        {(fmtBase ?? f)(base)}{unit}
                      </span>
                    )}
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color }}>
                      {f(current)}{unit}
                    </span>
                    {pctChg !== null && (
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 700,
                        color: isUp ? '#00e887' : '#f43f5e',
                        background: isUp ? 'rgba(0,232,135,0.1)' : 'rgba(244,63,94,0.1)',
                        borderRadius: 4, padding: '1px 5px',
                      }}>
                        {isUp ? '▲' : '▼'} {Math.abs(pctChg).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Narrative interpretation */}
            <div className="mt-3 px-3 py-2.5 rounded-xl text-[10px] leading-relaxed"
              style={{ background: 'rgba(79,110,247,0.06)', border: '1px solid rgba(79,110,247,0.15)',
                fontFamily: 'Inter, sans-serif', color: '#9fb3d4' }}>
              {wiNetMargin < 0
                ? '⚠ Negative margin scenario — business is loss-making at these assumptions.'
                : wiDE > 3
                ? '⚠ High leverage (D/E >3×) elevates credit risk and interest burden significantly.'
                : wiScore >= 70
                ? '✓ Strong scenario — business generates sustainable returns at these assumptions.'
                : wiScore >= 40
                ? '◆ Moderate scenario — some risk factors present but business is viable.'
                : '▼ Weak scenario — multiple ratios are under stress at these assumptions.'}
            </div>
          </div>
        </div>
      )}

      {/* CFA note */}
      <p className="mt-5 text-[10px]" style={{ color: '#3d5070', fontFamily: 'Inter, sans-serif' }}>
        <span style={{ color: '#22d3ee' }}>CFA L2 / IB Valuation ·</span> Sensitivity tables are a core
        deliverable in equity research and M&A fairness opinions. WACC typically ranges 8–12% for mature
        companies; terminal growth rate should not exceed long-run GDP growth (2.5–3.5% for developed markets).
      </p>
    </section>
  );
}
