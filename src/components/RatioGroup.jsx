import RatioCard from './RatioCard';

const META = {
  Liquidity:     { icon: 'LIQ', color: 'text-cyan-400',    line: 'from-cyan-500/60',   desc: 'Short-term solvency & cash availability' },
  Profitability: { icon: 'PRF', color: 'text-emerald-400', line: 'from-emerald-500/60', desc: 'Revenue conversion & return metrics'      },
  Efficiency:    { icon: 'EFF', color: 'text-violet-400',  line: 'from-violet-500/60',  desc: 'Asset utilisation & operational cycle'    },
  Leverage:      { icon: 'LEV', color: 'text-amber-400',   line: 'from-amber-500/60',   desc: 'Debt structure & interest servicing'      },
};

export default function RatioGroup({ title, ratios, startIndex = 0 }) {
  const m = META[title] || { icon: 'GEN', color: 'text-slate-400', line: 'from-slate-500/60', desc: '' };

  return (
    <section className="mb-10">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-5">
        <span className="text-[10px] font-bold tracking-wide" style={{ color: 'var(--text-4)' }}>{m.icon}</span>
        <div className="min-w-0">
          <span className={`mono text-[11px] font-bold uppercase tracking-[0.18em] ${m.color}`}>{title}</span>
          <span className="text-[11px] ml-3" style={{ color: 'var(--text-4)' }}>{m.desc}</span>
        </div>
        {/* Neon divider */}
        <div className={`flex-1 h-px bg-gradient-to-r ${m.line} to-transparent ml-2`} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {ratios.map((r, i) => (
          <RatioCard key={r.key} {...r} index={startIndex + i} />
        ))}
      </div>
    </section>
  );
}
