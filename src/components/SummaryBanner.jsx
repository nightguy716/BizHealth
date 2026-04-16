import HealthRadar from './HealthRadar';

const VERDICTS = {
  strong:  { label: 'STRONG',        sub: 'Financial Health',   color: '#00e887', ring: '#00e887', shadow: 'rgba(0,232,135,0.38)'   },
  moderate:{ label: 'MODERATE',      sub: 'Financial Health',   color: '#fbbf24', ring: '#fbbf24', shadow: 'rgba(251,191,36,0.38)'  },
  below:   { label: 'BELOW AVERAGE', sub: 'Requires Attention', color: '#6b84f8', ring: '#4f6ef7', shadow: 'rgba(79,110,247,0.42)'  },
  critical:{ label: 'CRITICAL',      sub: 'Immediate Action',   color: '#f43f5e', ring: '#f43f5e', shadow: 'rgba(244,63,94,0.38)'   },
};

function getV(pct) {
  if (pct >= 80) return VERDICTS.strong;
  if (pct >= 60) return VERDICTS.moderate;
  if (pct >= 40) return VERDICTS.below;
  return VERDICTS.critical;
}

const R = 46;
const C = 2 * Math.PI * R;

function ScoreRing({ pct, verdict }) {
  const offset = C - (pct / 100) * C;
  return (
    <div className="relative w-32 h-32 flex-shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
        <circle
          cx="50" cy="50" r={R} fill="none"
          stroke={verdict.ring}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          style={{
            filter: `drop-shadow(0 0 7px ${verdict.shadow})`,
            transition: 'stroke-dashoffset 1.4s cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="mono font-bold leading-none"
          style={{ fontSize: '1.75rem', color: verdict.color, textShadow: `0 0 22px ${verdict.shadow}` }}>
          {pct}
        </span>
        <span className="mono text-[10px] mt-0.5" style={{ color: '#3d5070' }}>/100</span>
      </div>
    </div>
  );
}

export default function SummaryBanner({ statuses, onExportPDF, onExportExcel, exporting, onShare, shareCopied, isSharedView }) {
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
      style={{ borderColor: `${v.ring}30` }}>

      {/* Ambient glow blobs */}
      <div className="absolute top-0 right-0 w-72 h-72 rounded-full blur-3xl pointer-events-none"
        style={{ background: `radial-gradient(circle, ${v.shadow} 0%, transparent 70%)`, opacity: 0.1, transform: 'translate(30%,-30%)' }} />
      <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.12) 0%, transparent 70%)', transform: 'translate(-30%,30%)' }} />

      {/* Top accent bar */}
      <div className="h-[2px]"
        style={{ background: `linear-gradient(90deg, ${v.ring} 0%, ${v.shadow} 45%, transparent 100%)` }} />

      <div className="relative flex flex-col lg:flex-row">
        {/* Left panel */}
        <div className="flex-1 p-6">
          {/* Header meta */}
          <div className="flex items-center gap-2 mb-5">
            <span className="w-1.5 h-1.5 rounded-full pulse-dot flex-shrink-0"
              style={{ background: v.ring, boxShadow: `0 0 6px ${v.ring}` }} />
            <span className="mono text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: '#6b82a8' }}>
              BizHealth Score · {new Date().toLocaleDateString('en-IN')}
            </span>
          </div>

          {/* Score + Verdict */}
          <div className="flex items-center gap-6 mb-6">
            <ScoreRing pct={pct} verdict={v} />
            <div>
              <div className="mono font-bold text-[1.6rem] leading-tight"
                style={{ color: v.color, textShadow: `0 0 28px ${v.shadow}` }}>
                {v.label}
              </div>
              <div className="text-[14px] font-medium mt-1" style={{ color: '#d4ddf5' }}>
                {v.sub}
              </div>
              <div className="mono text-[11px] mt-2" style={{ color: '#6b82a8' }}>
                {valid} ratios computed · {green} in healthy range
              </div>
            </div>
          </div>

          {/* Status pills */}
          <div className="flex flex-wrap gap-2 mb-5">
            {pills.map(({ count, label, cls }) => (
              <span key={label}
                className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full ${cls}`}>
                {count} {label}
              </span>
            ))}
          </div>

          {/* Shared view banner */}
          {isSharedView && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg text-xs"
              style={{ background: 'rgba(79,110,247,0.08)', border: '1px solid rgba(79,110,247,0.22)', color: '#7b95fa' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              <span>Shared analysis — <a href="/dashboard" className="underline" style={{ color: '#7b95fa' }}>run your own</a></span>
            </div>
          )}

          {/* Export buttons */}
          <div className="flex flex-wrap gap-2">
            <button onClick={onExportPDF}
              className="inline-flex items-center gap-2 text-[12px] font-semibold px-4 py-2.5 rounded-xl transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'var(--text-secondary)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(34,211,238,0.08)'; e.currentTarget.style.borderColor='rgba(34,211,238,0.3)'; e.currentTarget.style.color='#22d3ee'; }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.12)'; e.currentTarget.style.color='var(--text-secondary)'; }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              PDF Report
            </button>

            <button onClick={onExportExcel} disabled={exporting}
              className="inline-flex items-center gap-2 text-[12px] font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 disabled:opacity-50"
              style={{
                background: 'rgba(0,176,80,0.1)',
                border: '1px solid rgba(0,176,80,0.28)',
                color: '#00c85a',
              }}
              onMouseEnter={e => { if (!exporting) { e.currentTarget.style.background='rgba(0,176,80,0.18)'; e.currentTarget.style.borderColor='rgba(0,176,80,0.45)'; }}}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(0,176,80,0.1)'; e.currentTarget.style.borderColor='rgba(0,176,80,0.28)'; }}>
              {exporting ? (
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31 11"/>
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 0v10m0-10a2 2 0 012 2h2a2 2 0 012-2v-2" />
                </svg>
              )}
              {exporting ? 'Building Excel…' : 'IB Excel Export'}
            </button>

            {onShare && (
              <button onClick={onShare}
                className="inline-flex items-center gap-2 text-[12px] font-semibold px-4 py-2.5 rounded-xl transition-all duration-200"
                style={{
                  background: shareCopied ? 'rgba(0,232,135,0.1)' : 'rgba(79,110,247,0.08)',
                  border: shareCopied ? '1px solid rgba(0,232,135,0.3)' : '1px solid rgba(79,110,247,0.25)',
                  color: shareCopied ? '#00e887' : '#7b95fa',
                }}
                onMouseEnter={e => { if (!shareCopied) { e.currentTarget.style.background='rgba(79,110,247,0.16)'; e.currentTarget.style.borderColor='rgba(79,110,247,0.45)'; } }}
                onMouseLeave={e => { if (!shareCopied) { e.currentTarget.style.background='rgba(79,110,247,0.08)'; e.currentTarget.style.borderColor='rgba(79,110,247,0.25)'; } }}>
                {shareCopied ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                    Link Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 1 1 0-2.684m0 2.684 6.632 3.316m-6.632-6 6.632-3.316m0 0a3 3 0 1 0 5.367-2.684 3 3 0 0 0-5.367 2.684zm0 9.316a3 3 0 1 0 5.368 2.684 3 3 0 0 0-5.368-2.684z"/>
                    </svg>
                    Share Report
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Right: radar */}
        <div className="lg:w-72 p-5 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-white/[0.06]">
          <p className="mono text-[9px] font-semibold uppercase tracking-[0.16em] mb-3 text-center"
            style={{ color: '#6b82a8' }}>
            HEALTH DIMENSIONS
          </p>
          <HealthRadar statuses={statusMap} />
        </div>
      </div>
    </div>
  );
}
