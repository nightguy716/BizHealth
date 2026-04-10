/**
 * RatioCard.jsx
 *
 * Displays a single financial ratio result. This component is reused 11 times —
 * once per ratio. It receives everything it needs via props:
 *
 * - name: display name of the ratio
 * - value: the calculated number (or null if inputs are missing)
 * - unit: '%', 'x', or 'days' — shown after the number
 * - status: 'green' | 'amber' | 'red' | 'na'
 * - interpretation: the plain-English sentence
 * - recommendation: actionable tip shown for amber/red
 * - index: used to stagger the animation delay
 */

const STATUS_STYLES = {
  green: {
    badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    dot:   'bg-emerald-400',
    label: 'Healthy',
    glow:  'shadow-emerald-500/10',
  },
  amber: {
    badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    dot:   'bg-amber-400',
    label: 'Borderline',
    glow:  'shadow-amber-500/10',
  },
  red: {
    badge: 'bg-red-500/15 text-red-400 border border-red-500/30',
    dot:   'bg-red-400',
    label: 'Needs Attention',
    glow:  'shadow-red-500/10',
  },
  na: {
    badge: 'bg-slate-700/50 text-slate-400 border border-slate-600',
    dot:   'bg-slate-500',
    label: 'No Data',
    glow:  '',
  },
};

export default function RatioCard({ name, value, unit, status, interpretation, recommendation, index = 0 }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.na;
  const delay = `${index * 60}ms`;

  const displayValue = value !== null && value !== undefined && !isNaN(value)
    ? `${Number(value).toFixed(2)}${unit}`
    : '—';

  return (
    <div
      className={`bg-white rounded-2xl p-5 shadow-md ${style.glow} animate-fade-slide border border-slate-100 hover:shadow-lg transition-shadow duration-200`}
      style={{ animationDelay: delay, animationFillMode: 'both' }}
    >
      {/* Header row: ratio name + status badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-semibold text-slate-800 text-sm leading-tight">{name}</h3>
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${style.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`}></span>
          {style.label}
        </span>
      </div>

      {/* The big number */}
      <div className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">{displayValue}</div>

      {/* Plain-English interpretation */}
      <p className="text-slate-500 text-xs leading-relaxed mb-2">{interpretation}</p>

      {/* Actionable recommendation — only shown for amber and red */}
      {recommendation && (status === 'amber' || status === 'red') && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex gap-2">
            <span className="text-orange-400 mt-0.5 flex-shrink-0">→</span>
            <p className="text-orange-600 text-xs leading-relaxed font-medium">{recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
