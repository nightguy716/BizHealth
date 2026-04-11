/**
 * SummaryBanner.jsx — Neon summary with animated SVG score ring + radar chart.
 */

import HealthRadar from './HealthRadar';

const VERDICTS = {
  strong:  { label: 'STRONG',        sub: 'Financial Health',   color: '#00e887', ring: '#00e887', shadow: 'rgba(0,232,135,0.4)'   },
  moderate:{ label: 'MODERATE',      sub: 'Financial Health',   color: '#fbbf24', ring: '#fbbf24', shadow: 'rgba(251,191,36,0.4)'  },
  below:   { label: 'BELOW AVERAGE', sub: 'Requires Attention', color: '#f97316', ring: '#f97316', shadow: 'rgba(249,115,22,0.4)'  },
  critical:{ label: 'CRITICAL',      sub: 'Immediate Action',   color: '#f43f5e', ring: '#f43f5e', shadow: 'rgba(244,63,94,0.4)'   },
};

function getV(pct) {
  if (pct >= 80) return VERDICTS.strong;
  if (pct >= 60) return VERDICTS.moderate;
  if (pct >= 40) return VERDICTS.below;
  return VERDICTS.critical;
}

// SVG score ring (circumference = 2π × 46 ≈ 289)
const R   = 46;
const C   = 2 * Math.PI * R; // 289.03

function ScoreRing({ pct, verdict }) {
  const offset = C - (pct / 100) * C;
  return (
    <div className="relative w-32 h-32 flex-shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        {/* Track */}
        <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
        {/* Progress */}
        <circle
          cx="50" cy="50" r={R} fill="none"
          stroke={verdict.ring}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          style={{
            filter: `drop-shadow(0 0 6px ${verdict.shadow})`,
            transition: 'stroke-dashoffset 1.4s cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      </svg>
      {/* Centre text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="mono font-bold leading-none" style={{ fontSize: '1.7rem', color: verdict.color, textShadow: `0 0 20px ${verdict.shadow}` }}>
          {pct}
        </span>
        <span className="text-slate-600 text-[10px] mono mt-0.5">/100</span>
      </div>
    </div>
  );
}

export default function SummaryBanner({ statuses, onExportPDF }) {
  const green = statuses.filter(s => s === 'green').length;
  const amber = statuses.filter(s => s === 'amber').length;
  const red   = statuses.filter(s => s === 'red').length;
  const na    = statuses.filter(s => s === 'na').length;
  const valid = statuses.length - na;
  const pct   = valid > 0 ? Math.round(((green * 2 + amber * 1) / (valid * 2)) * 100) : 0;
  const v     = getV(pct);

  const statusKeys = ['currentRatio','quickRatio','cashRatio','grossMargin','operatingMargin','netMargin','roe','roa','assetTurnover','fixedAssetTurnover','receivablesDays','inventoryDays','debtToEquity','interestCoverage'];
  const statusMap  = {};
  statusKeys.forEach((k, i) => { statusMap[k] = statuses[i] || 'na'; });

  const pills = [
    { count: green, label: 'Healthy',    cls: 'badge-green' },
    { count: amber, label: 'Borderline', cls: 'badge-amber' },
    { count: red,   label: 'Critical',   cls: 'badge-red'   },
    ...(na > 0 ? [{ count: na, label: 'No Data', cls: 'badge-na' }] : []),
  ];

  return (
    <div className="ghost-card rounded-2xl mb-8 overflow-hidden relative animate-in"
      style={{ borderColor: `rgba(${v.ring === '#00e887' ? '0,232,135' : v.ring === '#fbbf24' ? '251,191,36' : v.ring === '#f97316' ? '249,115,22' : '244,63,94'},0.18)` }}>

      {/* Corner decorations */}
      <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ background: `radial-gradient(circle, ${v.shadow} 0%, transparent 70%)`, opacity: 0.12, transform: 'translate(30%,-30%)' }} />
      <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.15) 0%, transparent 70%)', transform: 'translate(-30%,30%)' }} />

      {/* Top accent bar */}
      <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${v.ring} 0%, ${v.shadow} 40%, transparent 100%)` }} />

      <div className="relative flex flex-col lg:flex-row">
        {/* Left panel */}
        <div className="flex-1 p-6">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: v.ring, boxShadow: `0 0 6px ${v.ring}` }} />
            <span className="mono text-[10px] font-bold text-slate-600 uppercase tracking-widest">BizHealth Score · {new Date().toLocaleDateString('en-IN')}</span>
          </div>

          <div className="flex items-center gap-6 mb-6">
            <ScoreRing pct={pct} verdict={v} />
            <div>
              <div className="mono font-bold text-2xl leading-tight" style={{ color: v.color, textShadow: `0 0 28px ${v.shadow}` }}>
                {v.label}
              </div>
              <div className="text-slate-400 text-sm mt-0.5">{v.sub}</div>
              <div className="text-slate-600 text-xs mt-2 mono">{valid} ratios computed · {green} in healthy range</div>
            </div>
          </div>

          {/* Status pills */}
          <div className="flex flex-wrap gap-2 mb-5">
            {pills.map(({ count, label, cls }) => (
              <span key={label} className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full ${cls}`}>
                {count} {label}
              </span>
            ))}
          </div>

          {/* Export */}
          <button
            onClick={onExportPDF}
            className="inline-flex items-center gap-2 border border-white/[0.1] hover:border-cyan-500/40 bg-white/[0.04] hover:bg-cyan-500/5 text-slate-400 hover:text-cyan-300 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all duration-200"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download PDF Report
          </button>
        </div>

        {/* Right: radar */}
        <div className="lg:w-72 p-4 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-white/[0.05]">
          <p className="mono text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-2 text-center">HEALTH DIMENSIONS</p>
          <HealthRadar statuses={statusMap} />
        </div>
      </div>
    </div>
  );
}
