import { useState, useMemo } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Legend, Tooltip } from 'recharts';

/*
  Scenario Comparison — Base / Bull / Bear
  ─────────────────────────────────────────
  Each scenario applies a multiplier to base inputs, recalculates key ratios,
  and shows them in a side-by-side column comparison + a radar overlay.
*/

const SCENARIOS = {
  bear: {
    label: 'Bear Case',
    icon:  '🐻',
    color: '#f43f5e',
    shadow: 'rgba(244,63,94,0.3)',
    description: 'Pessimistic — revenue decline, margin compression, rising debt costs',
    multipliers: {
      revenue:           0.80,   // −20% revenue
      netMargin:         0.60,   // margins compress by 40%
      operatingCashFlow: 0.55,
      currentAssets:     0.90,
      currentLiabilities:1.15,
      totalDebt:         1.20,
      interestExpense:   1.25,
    },
  },
  base: {
    label: 'Base Case',
    icon:  '⚖️',
    color: '#4f6ef7',
    shadow: 'rgba(79,110,247,0.3)',
    description: 'Current actuals as entered in the sidebar',
    multipliers: {},             // no change
  },
  bull: {
    label: 'Bull Case',
    icon:  '🐂',
    color: '#00e887',
    shadow: 'rgba(0,232,135,0.3)',
    description: 'Optimistic — revenue acceleration, expanding margins, debt reduction',
    multipliers: {
      revenue:           1.25,
      netMargin:         1.40,
      operatingCashFlow: 1.35,
      currentAssets:     1.15,
      currentLiabilities:0.90,
      totalDebt:         0.80,
      interestExpense:   0.85,
    },
  },
};

/* Apply scenario multipliers to raw inputs and derive ratios */
function applyScenario(inputs, multipliers) {
  const s = k => {
    const base = parseFloat(inputs?.[k]) || 0;
    return base * (multipliers[k] ?? 1);
  };
  const revenue     = s('revenue');
  const netProfit   = revenue * (parseFloat(inputs?.netProfit || 0) / (parseFloat(inputs?.revenue) || 1)) * (multipliers.netMargin ?? 1);
  const grossProfit = s('grossProfit');
  const operatingCF = s('operatingCashFlow');
  const currentAssets = s('currentAssets');
  const currentLiab   = s('currentLiabilities');
  const inventory     = s('inventory');
  const cash          = s('cash');
  const totalDebt     = s('totalDebt');
  const equity        = s('equity');
  const totalAssets   = s('totalAssets');
  const interest      = s('interestExpense');
  const receivables   = s('receivables');
  const ebit          = revenue > 0 ? grossProfit - (parseFloat(inputs?.operatingExpenses) || 0) : 0;

  return {
    currentRatio:    currentLiab > 0 ? currentAssets / currentLiab : null,
    quickRatio:      currentLiab > 0 ? (currentAssets - inventory) / currentLiab : null,
    grossMargin:     revenue > 0 ? (grossProfit / revenue) * 100 : null,
    netMargin:       revenue > 0 ? (netProfit   / revenue) * 100 : null,
    roe:             equity  > 0 ? (netProfit   / equity)  * 100 : null,
    debtToEquity:    equity  > 0 ? totalDebt    / equity         : null,
    interestCoverage:interest > 0 ? ebit        / interest       : null,
    assetTurnover:   totalAssets > 0 ? revenue  / totalAssets    : null,
    cfoRatio:        netProfit !== 0 ? operatingCF / netProfit    : null,
    revenue,
    netProfit,
    operatingCF,
  };
}

function fmt(v, unit) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  if (unit === '%')  return v.toFixed(1) + '%';
  if (unit === 'x')  return v.toFixed(2) + '×';
  if (unit === '$')  {
    const abs = Math.abs(v);
    const sign = v < 0 ? '-' : '';
    if (abs >= 1e9)  return sign + (abs / 1e9).toFixed(1)  + 'B';
    if (abs >= 1e6)  return sign + (abs / 1e6).toFixed(1)  + 'M';
    if (abs >= 1e3)  return sign + (abs / 1e3).toFixed(1)  + 'K';
    return sign + abs.toFixed(0);
  }
  return v.toFixed(2);
}

/* Simplified health score from derived ratios */
function scoreFromRatios(r) {
  const checks = [
    { v: r.currentRatio,     ok: 1.0, good: 1.5  },
    { v: r.grossMargin,      ok: 20,  good: 35   },
    { v: r.netMargin,        ok: 5,   good: 10   },
    { v: r.roe,              ok: 8,   good: 15   },
    { v: r.debtToEquity,     ok: 2.0, good: 1.0, inv: true },
    { v: r.interestCoverage, ok: 1.5, good: 3.0  },
    { v: r.assetTurnover,    ok: 0.5, good: 0.9  },
  ];
  let pts = 0, total = 0;
  checks.forEach(({ v, ok, good, inv }) => {
    if (v === null || isNaN(v)) return;
    total += 2;
    const isGood = inv ? v <= good : v >= good;
    const isOk   = inv ? v <= ok  : v >= ok;
    pts += isGood ? 2 : isOk ? 1 : 0;
  });
  return total > 0 ? Math.round((pts / total) * 100) : 0;
}

const METRICS = [
  { key: 'currentRatio',     label: 'Current Ratio',     unit: 'x',  radar: true },
  { key: 'quickRatio',       label: 'Quick Ratio',        unit: 'x',  radar: false },
  { key: 'grossMargin',      label: 'Gross Margin',       unit: '%',  radar: true },
  { key: 'netMargin',        label: 'Net Margin',         unit: '%',  radar: true },
  { key: 'roe',              label: 'Return on Equity',   unit: '%',  radar: true },
  { key: 'debtToEquity',     label: 'Debt / Equity',      unit: 'x',  radar: false },
  { key: 'interestCoverage', label: 'Interest Coverage',  unit: 'x',  radar: true },
  { key: 'assetTurnover',    label: 'Asset Turnover',     unit: 'x',  radar: false },
  { key: 'cfoRatio',         label: 'CFO / Net Income',   unit: 'x',  radar: false },
  { key: 'revenue',          label: 'Revenue',            unit: '$',  radar: false },
  { key: 'netProfit',        label: 'Net Profit',         unit: '$',  radar: false },
];

const TT_STYLE = {
  contentStyle: {
    background: '#06101e', border: '1px solid rgba(79,110,247,0.3)',
    borderRadius: 8, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#d4ddf5',
  },
  labelStyle: { color: '#6b82a8' },
};

export default function ScenarioComparison({ inputs, ratioValues }) {
  const [view, setView] = useState('table'); // 'table' | 'radar'

  const hasData = !!(parseFloat(inputs?.revenue) > 0);

  const computed = useMemo(() => {
    return {
      bear: applyScenario(inputs, SCENARIOS.bear.multipliers),
      base: applyScenario(inputs, SCENARIOS.base.multipliers),
      bull: applyScenario(inputs, SCENARIOS.bull.multipliers),
    };
  }, [inputs]);

  const scores = {
    bear: scoreFromRatios(computed.bear),
    base: scoreFromRatios(computed.base),
    bull: scoreFromRatios(computed.bull),
  };

  /* Radar data — normalise each metric 0–100 for the chart */
  const radarMetrics = METRICS.filter(m => m.radar);
  const radarData = radarMetrics.map(({ key, label }) => {
    const normalise = (v, good, max) => v === null ? 0 : Math.min(100, Math.max(0, (v / (max || good * 2)) * 100));
    const GOOD = { currentRatio:2, grossMargin:40, netMargin:15, roe:20, interestCoverage:5, assetTurnover:1.5 };
    const MAX  = { currentRatio:4, grossMargin:80, netMargin:30, roe:40, interestCoverage:10, assetTurnover:3 };
    return {
      subject: label.split(' ').slice(-1)[0], // short label for radar
      bear: normalise(computed.bear[key], GOOD[key], MAX[key]),
      base: normalise(computed.base[key], GOOD[key], MAX[key]),
      bull: normalise(computed.bull[key], GOOD[key], MAX[key]),
    };
  });

  if (!hasData) {
    return (
      <section className="ghost-card rounded-2xl p-6 mb-10 animate-in">
        <div className="flex items-center gap-3 mb-2">
          <span className="mono text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: '#22d3ee' }}>
            Scenario Comparison
          </span>
        </div>
        <p style={{ fontSize: 12, color: '#6b82a8' }}>
          Enter at least Revenue and Net Profit to run scenario analysis.
        </p>
      </section>
    );
  }

  return (
    <section className="ghost-card rounded-2xl p-6 mb-10 animate-in overflow-hidden relative">
      {/* Glow */}
      <div className="absolute top-0 left-0 w-48 h-48 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,232,135,0.05) 0%, transparent 70%)', transform: 'translate(-30%,-30%)' }} />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-lg">🎯</span>
          <div>
            <span className="mono text-[11px] font-bold uppercase tracking-[0.18em]"
              style={{ color: '#22d3ee' }}>Scenario Comparison</span>
            <p className="text-[10px] mt-0.5" style={{ color: '#6b82a8' }}>
              Bear / Base / Bull — side-by-side financial projection
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {[['table','⊞ Table'],['radar','◎ Radar']].map(([id, label]) => (
            <button key={id} onClick={() => setView(id)}
              className="px-3 py-1 rounded-md text-[10px] font-bold transition-all duration-150 mono"
              style={view === id
                ? { background: 'rgba(34,211,238,0.15)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.3)' }
                : { background: 'transparent', color: '#6b82a8', border: '1px solid transparent' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {['bear','base','bull'].map(k => {
          const sc = SCENARIOS[k];
          const score = scores[k];
          const scoreColor = score >= 70 ? '#00e887' : score >= 40 ? '#fbbf24' : '#f43f5e';
          return (
            <div key={k} className="rounded-xl p-4 text-center"
              style={{ background: `${sc.color}0d`, border: `1px solid ${sc.color}28` }}>
              <div className="text-2xl mb-1">{sc.icon}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 700,
                color: sc.color, letterSpacing: '0.1em' }}>{sc.label.toUpperCase()}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 26, fontWeight: 700,
                color: scoreColor, lineHeight: 1.1, marginTop: 6,
                textShadow: `0 0 18px ${scoreColor}60` }}>
                {score}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: '#3d5070' }}>
                /100 health
              </div>
              <div className="h-1 rounded-full mt-2 overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <div style={{ width: `${score}%`, height: '100%', background: scoreColor,
                  borderRadius: 9999, transition: 'width 1s ease' }} />
              </div>
              <p className="mt-2 text-[9px] leading-relaxed" style={{ color: '#6b82a8', fontFamily: 'Inter, sans-serif' }}>
                {sc.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── TABLE VIEW ── */}
      {view === 'table' && (
        <div className="rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          {/* Header */}
          <div className="grid px-3 py-2"
            style={{
              display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
              background: 'rgba(255,255,255,0.04)', gap: 8,
              fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
              fontWeight: 700, letterSpacing: '0.1em',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
            <span style={{ color: '#3d5070' }}>METRIC</span>
            {['bear','base','bull'].map(k => (
              <span key={k} style={{ color: SCENARIOS[k].color, textAlign: 'right' }}>
                {SCENARIOS[k].icon} {SCENARIOS[k].label.split(' ')[0].toUpperCase()}
              </span>
            ))}
          </div>

          {METRICS.map(({ key, label, unit }, i) => (
            <div key={key}
              className="grid px-3 transition-colors duration-150"
              style={{
                display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
                padding: '8px 12px', alignItems: 'center', gap: 8,
                borderBottom: i < METRICS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}
              onMouseEnter={e  => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#9fb3d4' }}>{label}</span>
              {['bear','base','bull'].map(k => {
                const val  = computed[k][key];
                const base = computed.base[key];
                const diff = (base !== null && val !== null && base !== 0 && k !== 'base')
                             ? ((val - base) / Math.abs(base)) * 100 : null;
                const isUp = diff > 0;
                return (
                  <div key={k} style={{ textAlign: 'right' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700,
                      color: k === 'bear' ? '#f43f5e' : k === 'bull' ? '#00e887' : '#7b95fa' }}>
                      {fmt(val, unit)}
                    </span>
                    {diff !== null && (
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
                        color: isUp ? '#00e887' : '#f43f5e', marginTop: 1 }}>
                        {isUp ? '▲' : '▼'} {Math.abs(diff).toFixed(0)}%
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* ── RADAR VIEW ── */}
      {view === 'radar' && (
        <ResponsiveContainer width="100%" height={320}>
          <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
            <PolarGrid stroke="rgba(255,255,255,0.07)" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: '#6b82a8', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
            />
            <Tooltip {...TT_STYLE} formatter={(v, name) => [v.toFixed(0), SCENARIOS[name]?.label || name]} />
            <Legend
              formatter={name => (
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: SCENARIOS[name]?.color }}>
                  {SCENARIOS[name]?.icon} {SCENARIOS[name]?.label?.toUpperCase()}
                </span>
              )}
            />
            <Radar name="bear" dataKey="bear" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.12} strokeWidth={1.5} />
            <Radar name="base" dataKey="base" stroke="#4f6ef7" fill="#4f6ef7" fillOpacity={0.12} strokeWidth={2} strokeDasharray="4 2" />
            <Radar name="bull" dataKey="bull" stroke="#00e887" fill="#00e887" fillOpacity={0.12} strokeWidth={1.5} />
          </RadarChart>
        </ResponsiveContainer>
      )}

      {/* Methodology note */}
      <p className="mt-5 text-[10px]" style={{ color: '#3d5070', fontFamily: 'Inter, sans-serif' }}>
        <span style={{ color: '#22d3ee' }}>Note ·</span> Bear/Bull multipliers are applied to current actuals.
        Bear assumes −20% revenue, 40% margin compression, +20% debt. Bull assumes +25% revenue, 40% margin expansion, −20% debt.
        Used by equity research analysts to frame valuation ranges in target price scenarios.
      </p>
    </section>
  );
}
