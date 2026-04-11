/**
 * RatioCard.jsx — Premium dark glassmorphism card with animated number counter.
 *
 * The number counts up from 0 to its final value when the card first mounts.
 * A thin health bar shows where the ratio sits relative to its threshold.
 */

import { useEffect, useState } from 'react';

const STATUS = {
  green: { badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', bar: 'bg-emerald-400', glow: 'glow-green', dot: 'bg-emerald-400', label: 'Healthy',          value: 'text-emerald-300' },
  amber: { badge: 'bg-amber-500/15  text-amber-400  border-amber-500/25',  bar: 'bg-amber-400',  glow: 'glow-amber', dot: 'bg-amber-400',  label: 'Borderline',       value: 'text-amber-300'  },
  red:   { badge: 'bg-red-500/15    text-red-400    border-red-500/25',    bar: 'bg-red-400',    glow: 'glow-red',   dot: 'bg-red-400',   label: 'Needs Attention',  value: 'text-red-300'    },
  na:    { badge: 'bg-white/5       text-slate-500  border-white/10',       bar: 'bg-slate-700',  glow: '',           dot: 'bg-slate-700', label: 'No Data',          value: 'text-slate-600'  },
};

function useCountUp(target, duration = 900, delay = 0) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (target === null || isNaN(target)) return;
    let frame;
    const timeout = setTimeout(() => {
      let start = null;
      const animate = (ts) => {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3); // cubic ease-out
        setDisplay(target * ease);
        if (progress < 1) frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
    }, delay);
    return () => { clearTimeout(timeout); cancelAnimationFrame(frame); };
  }, [target, duration, delay]);
  return display;
}

export default function RatioCard({ name, value, unit, status, interpretation, recommendation, barWidth = 0, index = 0 }) {
  const cfg   = STATUS[status] || STATUS.na;
  const delay = index * 55;
  const count = useCountUp(
    value !== null && !isNaN(value) ? Number(value) : null,
    800,
    delay,
  );

  const isValid  = value !== null && value !== undefined && !isNaN(value);
  const isPercent = unit === '%';
  const isDays    = unit === ' days';

  const displayVal = isValid
    ? `${count.toFixed(isPercent || isDays ? 0 : 2)}${unit}`
    : '—';

  return (
    <div
      className={`glass-card glass-card-hover rounded-2xl p-5 animate-fade-slide ${cfg.glow}`}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider leading-snug">{name}</h3>
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap flex-shrink-0 ${cfg.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
          {cfg.label}
        </span>
      </div>

      {/* Animated value */}
      <div className={`text-[2.4rem] font-bold tracking-tight leading-none mb-3 ${cfg.value}`}>
        {displayVal}
      </div>

      {/* Health bar */}
      <div className="mb-4">
        <div className="h-[3px] bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className={`bar-fill ${cfg.bar} opacity-70`}
            style={{ width: `${barWidth}%`, transitionDelay: `${delay + 200}ms` }}
          />
        </div>
      </div>

      {/* Interpretation */}
      <p className="text-slate-500 text-[11px] leading-relaxed">{interpretation}</p>

      {/* Recommendation */}
      {recommendation && (status === 'amber' || status === 'red') && (
        <div className="mt-3 pt-3 border-t border-white/[0.05] flex gap-2">
          <span className="text-orange-500 text-xs flex-shrink-0">→</span>
          <p className="text-orange-300/70 text-[11px] leading-relaxed">{recommendation}</p>
        </div>
      )}
    </div>
  );
}
