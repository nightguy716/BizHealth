/**
 * RatioGroup.jsx
 *
 * A section wrapper for a category of ratios (e.g. "Liquidity", "Profitability").
 * It renders the group title and maps over the ratios to display RatioCards.
 * The "startIndex" prop ensures animation delays are sequential across the whole page.
 */

import RatioCard from './RatioCard';

const GROUP_ICONS = {
  Liquidity:      '💧',
  Profitability:  '📈',
  Efficiency:     '⚙️',
  Leverage:       '⚖️',
};

export default function RatioGroup({ title, ratios, startIndex = 0 }) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">{GROUP_ICONS[title]}</span>
        <h2 className="text-base font-bold text-slate-700 uppercase tracking-widest">{title}</h2>
        <div className="flex-1 h-px bg-slate-200 ml-2"></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {ratios.map((ratio, i) => (
          <RatioCard key={ratio.key} {...ratio} index={startIndex + i} />
        ))}
      </div>
    </section>
  );
}
