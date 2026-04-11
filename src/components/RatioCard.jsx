/**
 * RatioCard.jsx — Premium dark glassmorphism card for each ratio.
 * Shows: ratio name, value, status badge, health bar, interpretation, recommendation.
 */

const STATUS_CONFIG = {
  green: {
    badge:  'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
    bar:    'bg-emerald-400',
    glow:   'glow-green',
    dot:    'bg-emerald-400',
    label:  'Healthy',
    value:  'text-emerald-300',
  },
  amber: {
    badge:  'bg-amber-500/15 text-amber-400 border border-amber-500/20',
    bar:    'bg-amber-400',
    glow:   'glow-amber',
    dot:    'bg-amber-400',
    label:  'Borderline',
    value:  'text-amber-300',
  },
  red: {
    badge:  'bg-red-500/15 text-red-400 border border-red-500/20',
    bar:    'bg-red-400',
    glow:   'glow-red',
    dot:    'bg-red-400',
    label:  'Needs Attention',
    value:  'text-red-300',
  },
  na: {
    badge:  'bg-white/5 text-slate-500 border border-white/10',
    bar:    'bg-slate-600',
    glow:   '',
    dot:    'bg-slate-600',
    label:  'No Data',
    value:  'text-slate-500',
  },
};

export default function RatioCard({ name, value, unit, status, interpretation, recommendation, barWidth = 0, index = 0 }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.na;
  const delay = `${index * 55}ms`;

  const displayValue = value !== null && value !== undefined && !isNaN(value)
    ? `${Number(value).toFixed(2)}${unit}`
    : '—';

  return (
    <div
      className={`glass-card glass-card-hover rounded-2xl p-5 animate-fade-slide ${cfg.glow}`}
      style={{ animationDelay: delay, animationFillMode: 'both' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <h3 className="text-slate-300 text-xs font-medium leading-snug">{name}</h3>
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${cfg.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
          {cfg.label}
        </span>
      </div>

      {/* Value */}
      <div className={`text-4xl font-bold mb-4 tracking-tight animate-count ${cfg.value}`}
        style={{ animationDelay: delay, animationFillMode: 'both' }}>
        {displayValue}
      </div>

      {/* Health bar */}
      <div className="mb-4">
        <div className="h-1 bg-white/[0.07] rounded-full overflow-hidden">
          <div
            className={`bar-fill ${cfg.bar} opacity-80`}
            style={{ width: `${barWidth}%`, transitionDelay: delay }}
          />
        </div>
      </div>

      {/* Interpretation */}
      <p className="text-slate-500 text-[11px] leading-relaxed">{interpretation}</p>

      {/* Recommendation — amber/red only */}
      {recommendation && (status === 'amber' || status === 'red') && (
        <div className="mt-3 pt-3 border-t border-white/[0.06] flex gap-2">
          <span className="text-orange-400 text-xs mt-0.5 flex-shrink-0">→</span>
          <p className="text-orange-300/80 text-[11px] leading-relaxed">{recommendation}</p>
        </div>
      )}
    </div>
  );
}
