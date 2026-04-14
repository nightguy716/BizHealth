import { useEffect, useState } from 'react';

const STATUS = {
  green: { card:'card-green', badge:'badge-green', bar:'bar-green', val:'val-green', dot:'#00e887', label:'Healthy'         },
  amber: { card:'card-amber', badge:'badge-amber', bar:'bar-amber', val:'val-amber', dot:'#fbbf24', label:'Borderline'      },
  red:   { card:'card-red',   badge:'badge-red',   bar:'bar-red',   val:'val-red',   dot:'#f43f5e', label:'Needs Attention' },
  na:    { card:'card-na',    badge:'badge-na',    bar:'bar-na',    val:'val-na',    dot:'#3d5070', label:'No Data'         },
};

function useCountUp(target, delay=0) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (target === null || isNaN(target)) return;
    let raf;
    const t = setTimeout(() => {
      let start = null;
      const run = ts => {
        if (!start) start = ts;
        const p = Math.min((ts-start)/850, 1);
        setV(target * (1 - Math.pow(1-p, 3)));
        if (p < 1) raf = requestAnimationFrame(run);
      };
      raf = requestAnimationFrame(run);
    }, delay);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, [target, delay]);
  return v;
}

export default function RatioCard({ name, value, unit, status, interpretation, recommendation, barWidth=0, index=0 }) {
  const cfg   = STATUS[status] || STATUS.na;
  const delay = index * 55;
  const isValid   = value !== null && value !== undefined && !isNaN(value);
  const count     = useCountUp(isValid ? Number(value) : null, delay);
  const isDays    = unit === ' days';
  const isPercent = unit === '%';
  const formatted = isValid ? `${count.toFixed(isDays || isPercent ? 0 : 2)}${unit}` : '—';

  return (
    <div className={`ghost-card rounded-2xl p-5 animate-in ${cfg.card}`}
      style={{ animationDelay: `${delay}ms` }}>

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] leading-snug"
          style={{ color: '#d4ddf5' }}>
          {name}
        </span>
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${cfg.badge}`}>
          <span className="w-1.5 h-1.5 rounded-full pulse-dot flex-shrink-0"
            style={{ background: cfg.dot, boxShadow: `0 0 5px ${cfg.dot}` }} />
          {cfg.label}
        </span>
      </div>

      {/* Value */}
      <div className={`mono text-[2.5rem] font-bold tracking-tight leading-none mb-1.5 ${cfg.val}`}>
        {formatted}
      </div>

      {/* Raw value label */}
      <div className="mono text-[10px] mb-4" style={{ color: '#3d5070' }}>
        {isValid ? `RAW · ${Number(value).toFixed(4)}` : 'AWAITING INPUT'}
      </div>

      {/* Bar */}
      <div className="mb-4">
        <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div className={`bar-fill ${cfg.bar}`}
            style={{ width: `${barWidth}%`, transitionDelay: `${delay+200}ms` }} />
        </div>
        <div className="flex justify-between mt-1.5">
          {['0','THRESHOLD','MAX'].map(t => (
            <span key={t} className="mono text-[9px]" style={{ color: '#3d5070' }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Interpretation */}
      <p className="text-[12px] leading-relaxed" style={{ color: '#9fb3d4' }}>
        {interpretation}
      </p>

      {/* Recommendation */}
      {recommendation && (status === 'amber' || status === 'red') && (
        <div className="mt-3 pt-3 flex gap-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <span className="text-[13px] flex-shrink-0 mt-px" style={{ color: '#7b95fa' }}>→</span>
          <p className="text-[11px] leading-relaxed" style={{ color: '#9fb3f8' }}>
            {recommendation}
          </p>
        </div>
      )}
    </div>
  );
}
