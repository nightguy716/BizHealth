/**
 * SummaryBanner.jsx — Premium summary with radar chart, score, and PDF export.
 */

import HealthRadar from './HealthRadar';

function getVerdict(pct) {
  if (pct >= 80) return { label: 'Strong Financial Health',   color: 'text-emerald-400', bar: 'from-emerald-500 to-emerald-400', ring: 'border-emerald-500/30' };
  if (pct >= 60) return { label: 'Moderate Financial Health', color: 'text-amber-400',   bar: 'from-amber-500 to-amber-400',     ring: 'border-amber-500/30'   };
  if (pct >= 40) return { label: 'Below-Average Health',      color: 'text-orange-400',  bar: 'from-orange-500 to-orange-400',   ring: 'border-orange-500/30'  };
  return              { label: 'Critical — Action Required',  color: 'text-red-400',     bar: 'from-red-500 to-red-400',         ring: 'border-red-500/30'     };
}

export default function SummaryBanner({ statuses, onExportPDF }) {
  const green = statuses.filter(s => s === 'green').length;
  const amber = statuses.filter(s => s === 'amber').length;
  const red   = statuses.filter(s => s === 'red').length;
  const na    = statuses.filter(s => s === 'na').length;
  const valid = statuses.length - na;

  const pct     = valid > 0 ? Math.round(((green * 2 + amber * 1) / (valid * 2)) * 100) : 0;
  const verdict = getVerdict(pct);

  // Build status map for radar from array — use index order
  const statusKeys = ['currentRatio','quickRatio','cashRatio','grossMargin','operatingMargin','netMargin','roe','roa','assetTurnover','fixedAssetTurnover','receivablesDays','inventoryDays','debtToEquity','interestCoverage'];
  const statusMap  = {};
  statusKeys.forEach((k, i) => { statusMap[k] = statuses[i] || 'na'; });

  const pills = [
    { count: green, label: 'Healthy',         color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400' },
    { count: amber, label: 'Borderline',      color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',     dot: 'bg-amber-400'   },
    { count: red,   label: 'Needs Attention', color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20',         dot: 'bg-red-400'     },
    ...(na > 0 ? [{ count: na, label: 'No Data', color: 'text-slate-500', bg: 'bg-white/5 border-white/10', dot: 'bg-slate-600' }] : []),
  ];

  return (
    <div className="glass-card rounded-2xl mb-8 overflow-hidden border-white/[0.08] relative">
      {/* Decorative blobs */}
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-orange-500/5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-10 w-48 h-48 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col lg:flex-row">
        {/* Left: Score + info */}
        <div className="flex-1 p-6 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">Overall Financial Health</p>

            {/* Circular score */}
            <div className="flex items-center gap-5 mb-5">
              <div className={`relative w-24 h-24 flex-shrink-0 rounded-full border-4 ${verdict.ring} flex flex-col items-center justify-center`}
                style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 100%)' }}>
                <span className={`text-3xl font-bold leading-none ${verdict.color}`}>{pct}</span>
                <span className="text-slate-600 text-[10px] font-medium">/ 100</span>
              </div>
              <div>
                <div className={`text-xl font-bold leading-tight mb-1 ${verdict.color}`}>{verdict.label}</div>
                <div className="text-slate-500 text-xs">{valid} ratios calculated · {green} healthy</div>
              </div>
            </div>

            {/* Score bar */}
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden mb-5">
              <div className={`h-full rounded-full bg-gradient-to-r ${verdict.bar} transition-all duration-1000 ease-out`}
                style={{ width: `${pct}%` }} />
            </div>

            {/* Pills */}
            <div className="flex flex-wrap gap-2 mb-5">
              {pills.map(({ count, label, color, bg, dot }) => (
                <span key={label} className={`inline-flex items-center gap-1.5 border text-[11px] font-semibold px-2.5 py-1.5 rounded-full ${bg} ${color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                  {count} {label}
                </span>
              ))}
            </div>
          </div>

          {/* Export button */}
          <button
            onClick={onExportPDF}
            className="self-start inline-flex items-center gap-2 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.1] hover:border-white/[0.18] text-slate-300 hover:text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all duration-150"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download PDF Report
          </button>
        </div>

        {/* Right: Radar chart */}
        <div className="lg:w-80 p-4 flex flex-col items-center justify-center border-t lg:border-t-0 lg:border-l border-white/[0.05]">
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1 self-start pl-2">Health Dimensions</p>
          <HealthRadar statuses={statusMap} />
        </div>
      </div>
    </div>
  );
}
