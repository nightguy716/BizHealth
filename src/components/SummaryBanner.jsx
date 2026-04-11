/**
 * SummaryBanner.jsx
 * Top-of-results banner. Shows overall health score, verdict, breakdown pills,
 * and the PDF download button.
 */

function getVerdict(pct) {
  if (pct >= 80) return { label: 'Strong Financial Health',   emoji: '🟢', color: 'text-emerald-400', barColor: 'from-emerald-500 to-emerald-400' };
  if (pct >= 60) return { label: 'Moderate Financial Health', emoji: '🟡', color: 'text-amber-400',   barColor: 'from-amber-500 to-amber-400'   };
  if (pct >= 40) return { label: 'Below-Average Health',      emoji: '🟠', color: 'text-orange-400',  barColor: 'from-orange-500 to-orange-400'  };
  return              { label: 'Critical — Action Required',  emoji: '🔴', color: 'text-red-400',     barColor: 'from-red-500 to-red-400'       };
}

export default function SummaryBanner({ statuses, onExportPDF }) {
  const green = statuses.filter(s => s === 'green').length;
  const amber = statuses.filter(s => s === 'amber').length;
  const red   = statuses.filter(s => s === 'red').length;
  const na    = statuses.filter(s => s === 'na').length;
  const valid = statuses.length - na;

  const points    = green * 2 + amber * 1;
  const maxPoints = valid * 2;
  const pct       = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 0;
  const verdict   = getVerdict(pct);

  return (
    <div className="glass-card rounded-2xl p-6 mb-8 relative overflow-hidden border-white/[0.08]">
      {/* Decorative blobs */}
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-orange-500/5 blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-16 -left-8 w-40 h-40 rounded-full bg-blue-500/5 blur-3xl pointer-events-none"></div>

      <div className="relative">
        {/* Top row */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5 mb-6">
          <div>
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-2">Overall Assessment</p>
            <div className={`text-2xl font-bold ${verdict.color} leading-tight`}>
              {verdict.emoji} Your business is in {verdict.label}
            </div>
            <p className="text-slate-500 text-sm mt-1.5">
              Health Score: <span className={`font-bold ${verdict.color}`}>{pct}%</span>
              <span className="text-slate-600"> · based on {valid} calculated ratios</span>
            </p>
          </div>

          <button
            onClick={onExportPDF}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-150 glow-orange whitespace-nowrap self-start"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download PDF
          </button>
        </div>

        {/* Score bar */}
        <div className="mb-5">
          <div className="w-full bg-white/[0.06] rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full bg-gradient-to-r ${verdict.barColor} transition-all duration-1000 ease-out`}
              style={{ width: `${pct}%` }}
            ></div>
          </div>
        </div>

        {/* Breakdown pills */}
        <div className="flex flex-wrap gap-2">
          {[
            { count: green, label: 'Healthy',         color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400' },
            { count: amber, label: 'Borderline',      color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',     dot: 'bg-amber-400'   },
            { count: red,   label: 'Needs Attention', color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20',         dot: 'bg-red-400'     },
            ...(na > 0 ? [{ count: na, label: 'No Data', color: 'text-slate-500', bg: 'bg-white/5 border-white/10', dot: 'bg-slate-600' }] : []),
          ].map(({ count, label, color, bg, dot }) => (
            <span key={label} className={`inline-flex items-center gap-1.5 border text-[11px] font-semibold px-3 py-1.5 rounded-full ${bg} ${color}`}>
              <span className={`w-2 h-2 rounded-full ${dot}`}></span>
              {count} {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
