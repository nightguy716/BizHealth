/**
 * Sidebar.jsx
 *
 * The left panel of the app. Contains:
 * - App branding
 * - Industry selector dropdown
 * - All 12 financial input fields
 * - Calculate and Reset buttons
 *
 * "inputs" and "setInputs" are passed down from App.jsx as props,
 * so the parent always has access to the latest values.
 */

import { INDUSTRY_BENCHMARKS } from '../utils/benchmarks';

const INPUT_FIELDS = [
  { key: 'currentAssets',      label: 'Current Assets',       placeholder: 'e.g. 500000' },
  { key: 'currentLiabilities', label: 'Current Liabilities',  placeholder: 'e.g. 300000' },
  { key: 'inventory',          label: 'Inventory',            placeholder: 'e.g. 120000' },
  { key: 'cash',               label: 'Cash & Bank Balance',  placeholder: 'e.g. 80000'  },
  { key: 'revenue',            label: 'Total Revenue',        placeholder: 'e.g. 1000000'},
  { key: 'grossProfit',        label: 'Gross Profit',         placeholder: 'e.g. 350000' },
  { key: 'netProfit',          label: 'Net Profit',           placeholder: 'e.g. 110000' },
  { key: 'totalAssets',        label: 'Total Assets',         placeholder: 'e.g. 800000' },
  { key: 'equity',             label: 'Total Equity',         placeholder: 'e.g. 400000' },
  { key: 'totalDebt',          label: 'Total Debt',           placeholder: 'e.g. 200000' },
  { key: 'receivables',        label: 'Accounts Receivable',  placeholder: 'e.g. 90000'  },
  { key: 'cogs',               label: 'Cost of Goods Sold',   placeholder: 'e.g. 650000' },
];

export default function Sidebar({ inputs, setInputs, industry, setIndustry, onCalculate, onReset }) {
  function handleChange(key, value) {
    // Update only the field that changed, keep all others the same
    setInputs(prev => ({ ...prev, [key]: value }));
  }

  return (
    <aside className="w-full lg:w-80 xl:w-88 bg-slate-900 text-white flex flex-col h-screen lg:fixed lg:left-0 lg:top-0 lg:overflow-y-auto scrollbar-thin">
      {/* Branding */}
      <div className="px-6 pt-7 pb-5 border-b border-slate-700">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center font-bold text-white text-sm">B</div>
          <span className="text-xl font-bold tracking-tight">BizHealth</span>
        </div>
        <p className="text-slate-400 text-xs leading-relaxed">Business Financial Health Dashboard for SMEs</p>
      </div>

      {/* Industry Selector */}
      <div className="px-6 pt-5 pb-3">
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
          Industry
        </label>
        <select
          value={industry}
          onChange={e => setIndustry(e.target.value)}
          className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent cursor-pointer"
        >
          {Object.entries(INDUSTRY_BENCHMARKS).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
        <p className="text-slate-500 text-xs mt-1.5">Thresholds adjust based on your industry</p>
      </div>

      {/* Input Fields */}
      <div className="px-6 py-3 flex-1">
        <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Financial Inputs (₹)</p>
        <div className="space-y-3">
          {INPUT_FIELDS.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs text-slate-400 mb-1">{label}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">₹</span>
                <input
                  type="number"
                  min="0"
                  placeholder={placeholder}
                  value={inputs[key]}
                  onChange={e => handleChange(key, e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent placeholder-slate-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-6 py-5 border-t border-slate-700 space-y-2.5">
        <button
          onClick={onCalculate}
          className="w-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-semibold text-sm py-3 rounded-xl transition-all duration-150 shadow-lg shadow-orange-500/20 animate-pulse-glow"
        >
          Calculate Health Score
        </button>
        <button
          onClick={onReset}
          className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white font-medium text-sm py-2.5 rounded-xl transition-all duration-150"
        >
          Reset All Fields
        </button>
      </div>
    </aside>
  );
}
