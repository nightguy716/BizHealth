/**
 * RatioCard.jsx — Neon ghost card with animated counter and glowing value.
 * Each status (green/amber/red) has its own neon border color + glow.
 * Numbers display in JetBrains Mono with a colored text-shadow glow.
 */

import { useEffect, useState } from 'react';

const STATUS = {
  green: { card: 'card-green', badge: 'badge-green', bar: 'bar-green', val: 'val-green', dot: 'bg-[#00e887]', label: 'Healthy'         },
  amber: { card: 'card-amber', badge: 'badge-amber', bar: 'bar-amber', val: 'val-amber', dot: 'bg-[#fbbf24]', label: 'Borderline'      },
  red:   { card: 'card-red',   badge: 'badge-red',   bar: 'bar-red',   val: 'val-red',   dot: 'bg-[#f43f5e]', label: 'Needs Attention' },
  na:    { card: 'card-na',    badge: 'badge-na',     bar: 'bar-na',    val: 'val-na',    dot: 'bg-slate-600',  label: 'No Data'         },
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

export default function RatioCard({ name, value, unit, status, interpretation, recommendation, barWidth = 0, index = 0 }) {
  const cfg   = STATUS[status] || STATUS.na;
  const delay = index * 55;
  const isValid = value !== null && value !== undefined && !isNaN(value);
  const count   = useCountUp(isValid ? Number(value) : null, delay);

  const isDays    = unit === ' days';
  const isPercent = unit === '%';
  const formatted = isValid
    ? `${count.toFixed(isDays || isPercent ? 0 : 2)}${unit}`
    : '—';

  return (
    <div
      className={`ghost-card rounded-2xl p-5 animate-in ${cfg.card}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.12em] leading-snug">{name}</span>
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${cfg.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} pulse-dot`}></span>
          {cfg.label}
        </span>
      </div>

      {/* Neon value */}
      <div className={`mono text-[2.6rem] font-bold tracking-tight leading-none mb-1 ${cfg.val}`}>
        {formatted}
      </div>

      {/* Threshold label */}
      <div className="text-[10px] text-slate-700 mono mb-3">
        {isValid ? `RAW · ${Number(value).toFixed(4)}` : 'AWAITING INPUT'}
      </div>

      {/* Neon health bar */}
      <div className="mb-4">
        <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className={`bar-fill ${cfg.bar}`}
            style={{ width: `${barWidth}%`, transitionDelay: `${delay + 200}ms` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-slate-700 mono">0</span>
          <span className="text-[9px] text-slate-700 mono">THRESHOLD</span>
          <span className="text-[9px] text-slate-700 mono">MAX</span>
        </div>
      </div>

      {/* Interpretation */}
      <p className="text-slate-500 text-[11px] leading-relaxed">{interpretation}</p>

      {/* Action item */}
      {recommendation && (status === 'amber' || status === 'red') && (
        <div className="mt-3 pt-3 border-t border-white/[0.05] flex gap-2">
          <span className="text-orange-400 text-xs flex-shrink-0">→</span>
          <p className="text-orange-300/70 text-[11px] leading-relaxed">{recommendation}</p>
        </div>
      )}
    </div>
  );
}
