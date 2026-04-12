/**
 * SectorComparison.jsx
 *
 * Lets the user pick a well-known Indian company and compare their ratios side by side.
 * Uses pre-loaded FY2024 data from sectorData.js.
 * Shows each ratio as: [Your value] vs [Company value] with a color indicator.
 */

import { useState } from 'react';
import { SECTOR_COMPANIES, COMPARISON_RATIOS } from '../data/sectorData';

function compareIndicator(userVal, compVal, key) {
  if (userVal === null || isNaN(userVal) || compVal === null) return null;
  // For lower-is-better ratios, flip the comparison
  const lowerIsBetter = ['receivablesDays', 'inventoryDays', 'debtToEquity'].includes(key);
  const better = lowerIsBetter ? userVal <= compVal : userVal >= compVal;
  const equal  = Math.abs(userVal - compVal) / (compVal || 1) < 0.05;
  if (equal)  return { label: 'On Par',    color: 'text-amber-400'   };
  if (better) return { label: 'Ahead',     color: 'text-emerald-400' };
  return            { label: 'Behind',     color: 'text-red-400'     };
}

export default function SectorComparison({ ratioValues, industry }) {
  const companies = SECTOR_COMPANIES[industry] || SECTOR_COMPANIES.general;
  const [selected, setSelected] = useState(companies[0]?.name || '');

  const company = companies.find(c => c.name === selected);

  return (
    <section className="mb-10">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-5">
        <span className="text-lg">◈</span>
        <div>
          <span className="mono text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-400">Sector Comparison</span>
          <span className="text-slate-700 text-[10px] ml-3">Benchmarked against listed Indian companies · FY2024</span>
        </div>
        <div className="flex-1 h-px ml-2" style={{ background:'linear-gradient(90deg, rgba(34,211,238,0.5), transparent)' }} />
      </div>

      <div className="ghost-card rounded-2xl p-5" style={{ borderColor:'rgba(34,211,238,0.1)' }}>
        {/* Company picker */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <span className="text-slate-400 text-xs font-medium flex-shrink-0">Compare with:</span>
          <div className="flex flex-wrap gap-2">
            {companies.map(c => (
              <button
                key={c.name}
                onClick={() => setSelected(c.name)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 border
                  ${selected === c.name
                    ? 'border-[rgba(79,110,247,0.45)] text-[#6b84f8]'
                    : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.08]'}`}
                style={selected === c.name ? { background:'rgba(79,110,247,0.12)' } : {}}
              >
                {c.name}
                <span className="ml-1.5 text-[10px] opacity-60">({c.ticker})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Data source note */}
        {company && (
          <div className="mb-4 text-[11px] text-slate-600">
            Showing publicly available FY2024 annual report data for <span className="text-slate-400">{company.name}</span>.
          </div>
        )}

        {/* Comparison table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider pb-3 pr-4">Ratio</th>
                <th className="text-right text-[10px] font-semibold uppercase tracking-wider pb-3 px-4" style={{ color:'#6b84f8' }}>Your Business</th>
                <th className="text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider pb-3 px-4">{company?.ticker || '—'}</th>
                <th className="text-right text-[10px] font-semibold text-slate-600 uppercase tracking-wider pb-3 pl-4">vs</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_RATIOS.map(({ key, label, unit }) => {
                const userVal    = ratioValues[key];
                const compVal    = company?.[key];
                const indicator  = compareIndicator(userVal, compVal, key);

                const userDisplay = (userVal !== null && userVal !== undefined && !isNaN(userVal))
                  ? `${Number(userVal).toFixed(1)}${unit}`
                  : '—';
                const compDisplay = (compVal !== null && compVal !== undefined)
                  ? `${Number(compVal).toFixed(1)}${unit}`
                  : '—';

                return (
                  <tr key={key} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 pr-4 text-slate-400 text-xs">{label}</td>
                    <td className="py-2.5 px-4 text-right font-semibold text-sm" style={{ color:'#6b84f8' }}>{userDisplay}</td>
                    <td className="py-2.5 px-4 text-right text-slate-500 text-sm">{compDisplay}</td>
                    <td className="py-2.5 pl-4 text-right">
                      {indicator
                        ? <span className={`text-[10px] font-bold ${indicator.color}`}>{indicator.label}</span>
                        : <span className="text-slate-700 text-[10px]">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-slate-700 text-[11px] mt-4">
          * Listed company data is from public annual reports (FY2024) and screener.in. Direct comparison has limits — listed companies operate at a different scale. Use this as directional guidance only.
        </p>
      </div>
    </section>
  );
}
