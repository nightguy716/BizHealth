import { useEffect, useState } from 'react';

const STATUS = {
  green: { card:'card-green', bar:'bar-green', val:'val-green', dot:'#00e887', label:'Healthy',         bg:'rgba(0,232,135,0.08)',  border:'rgba(0,232,135,0.25)'  },
  amber: { card:'card-amber', bar:'bar-amber', val:'val-amber', dot:'#fbbf24', label:'Borderline',      bg:'rgba(251,191,36,0.08)', border:'rgba(251,191,36,0.25)' },
  red:   { card:'card-red',   bar:'bar-red',   val:'val-red',   dot:'#f43f5e', label:'Needs Attention', bg:'rgba(244,63,94,0.08)',  border:'rgba(244,63,94,0.25)'  },
  na:    { card:'card-na',    bar:'bar-na',     val:'val-na',   dot:'#3d5070', label:'No Data',         bg:'rgba(255,255,255,0.04)',border:'rgba(255,255,255,0.08)' },
};

function useCountUp(target, delay = 0) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (target === null || isNaN(target)) return;
    let raf;
    const t = setTimeout(() => {
      let start = null;
      const run = ts => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / 850, 1);
        setV(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(run);
      };
      raf = requestAnimationFrame(run);
    }, delay);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, [target, delay]);
  return v;
}

/* Format the numeric part cleanly */
function formatValue(count, unit, isValid) {
  if (!isValid) return { num: '—', suffix: '' };
  const isDays    = unit === ' days';
  const isPercent = unit === '%';
  const isX       = unit === 'x';

  if (isDays)    return { num: Math.round(count).toString(),    suffix: 'd'  };
  if (isPercent) return { num: count.toFixed(1),                suffix: '%'  };
  if (isX)       return { num: count.toFixed(2),                suffix: '×'  };
  return         { num: count.toFixed(2),                       suffix: unit || '' };
}

export default function RatioCard({ name, value, unit, status, interpretation, recommendation, barWidth = 0, index = 0 }) {
  const cfg   = STATUS[status] || STATUS.na;
  const delay = index * 55;
  const isValid = value !== null && value !== undefined && !isNaN(value);
  const count   = useCountUp(isValid ? Number(value) : null, delay);
  const { num, suffix } = formatValue(count, unit, isValid);

  return (
    <div className={`ghost-card rounded-2xl p-5 animate-in ${cfg.card}`}
      style={{ animationDelay: `${delay}ms` }}>

      {/* Header — name left, status badge right */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] leading-snug"
          style={{ color: '#9fb3d4', fontFamily: 'Inter, system-ui, sans-serif' }}>
          {name}
        </span>
        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
          style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.dot,
            fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em' }}>
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: cfg.dot, boxShadow: `0 0 4px ${cfg.dot}` }} />
          {cfg.label.toUpperCase()}
        </span>
      </div>

      {/* Value — large number + small suffix */}
      <div className="flex items-end gap-1 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        <span className={`font-bold leading-none ${cfg.val}`}
          style={{ fontSize: num.length > 5 ? '1.9rem' : '2.4rem' }}>
          {num}
        </span>
        {suffix && isValid && (
          <span className="font-semibold mb-1" style={{ fontSize: '1rem', color: cfg.dot, opacity: 0.7 }}>
            {suffix}
          </span>
        )}
      </div>

      {/* Raw value */}
      <div className="mb-4" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#3d5070' }}>
        {isValid ? `RAW · ${Number(value).toFixed(4)}` : 'AWAITING INPUT'}
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div className={`bar-fill ${cfg.bar}`}
            style={{ width: `${barWidth}%`, transitionDelay: `${delay + 200}ms` }} />
        </div>
        <div className="flex justify-between mt-1">
          {['MIN', 'THRESHOLD', 'MAX'].map(t => (
            <span key={t} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: '#3d5070' }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Interpretation */}
      <p className="leading-relaxed" style={{ fontSize: 11, color: '#9fb3d4' }}>
        {interpretation}
      </p>

      {/* Recommendation — amber/red only */}
      {recommendation && (status === 'amber' || status === 'red') && (
        <div className="mt-3 pt-3 flex gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ color: '#4f6ef7', fontSize: 13, flexShrink: 0, marginTop: 1 }}>→</span>
          <p style={{ fontSize: 11, lineHeight: 1.5, color: '#9fb3f8' }}>{recommendation}</p>
        </div>
      )}
    </div>
  );
}
