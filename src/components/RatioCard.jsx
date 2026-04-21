import { useEffect, useState } from 'react';

const STATUS = {
  green: { card:'card-green', bar:'bar-green', val:'val-green', dot:'#16a34a', label:'PASS',   signalClass:'signal-pass'   },
  amber: { card:'card-amber', bar:'bar-amber', val:'val-amber', dot:'#b45309', label:'WATCH',  signalClass:'signal-watch'  },
  red:   { card:'card-red',   bar:'bar-red',   val:'val-red',   dot:'#dc2626', label:'BREACH', signalClass:'signal-breach' },
  na:    { card:'card-na',    bar:'bar-na',    val:'val-na',    dot:'#4a5568', label:'N/A',    signalClass:'signal-na'     },
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

      {/* Header — name left, signal tag right */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="label-upper leading-snug">{name}</span>
        <span className={cfg.signalClass}>{cfg.label}</span>
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
        <div className="mt-3 pt-3 flex gap-2" style={{ borderTop: '1px solid #1d2840' }}>
          <span style={{ color: '#2461d4', fontSize: 13, flexShrink: 0, marginTop: 1 }}>→</span>
          <p style={{ fontSize: 11, lineHeight: 1.5, color: '#7b8eab' }}>{recommendation}</p>
        </div>
      )}
    </div>
  );
}
