import RatioCard from './RatioCard';

const GROUP_META = {
  Liquidity:     { icon: '💧', desc: 'Can your business meet short-term obligations?' },
  Profitability: { icon: '📈', desc: 'How efficiently is your business generating profit?' },
  Efficiency:    { icon: '⚙️', desc: 'How well are your assets and operations performing?' },
  Leverage:      { icon: '⚖️', desc: 'How much debt is your business carrying?' },
};

export default function RatioGroup({ title, ratios, startIndex = 0 }) {
  const meta = GROUP_META[title] || {};

  return (
    <section className="mb-10">
      <div className="flex items-center gap-3 mb-5">
        <span className="text-xl">{meta.icon}</span>
        <div>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">{title}</h2>
          <p className="text-slate-600 text-[11px] mt-0.5">{meta.desc}</p>
        </div>
        <div className="flex-1 h-px bg-white/[0.06] ml-2"></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {ratios.map((ratio, i) => (
          <RatioCard key={ratio.key} {...ratio} index={startIndex + i} />
        ))}
      </div>
    </section>
  );
}
