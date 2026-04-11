import { INDUSTRY_BENCHMARKS } from '../utils/benchmarks';

const INPUT_FIELDS = [
  { key: 'currentAssets',      label: 'Current Assets',       group: 'Balance Sheet' },
  { key: 'currentLiabilities', label: 'Current Liabilities',  group: 'Balance Sheet' },
  { key: 'inventory',          label: 'Inventory',            group: 'Balance Sheet' },
  { key: 'cash',               label: 'Cash & Bank Balance',  group: 'Balance Sheet' },
  { key: 'totalAssets',        label: 'Total Assets',         group: 'Balance Sheet' },
  { key: 'equity',             label: 'Total Equity',         group: 'Balance Sheet' },
  { key: 'totalDebt',          label: 'Total Debt',           group: 'Balance Sheet' },
  { key: 'revenue',            label: 'Total Revenue',        group: 'P&L' },
  { key: 'grossProfit',        label: 'Gross Profit',         group: 'P&L' },
  { key: 'operatingExpenses',  label: 'Operating Expenses',   group: 'P&L' },
  { key: 'netProfit',          label: 'Net Profit',           group: 'P&L' },
  { key: 'interestExpense',    label: 'Interest Expense',     group: 'P&L' },
  { key: 'receivables',        label: 'Accounts Receivable',  group: 'Working Capital' },
  { key: 'cogs',               label: 'Cost of Goods Sold',   group: 'Working Capital' },
];

const GROUPS = ['Balance Sheet', 'P&L', 'Working Capital'];

export default function Sidebar({ inputs, setInputs, industry, setIndustry, onCalculate, onReset }) {
  function handleChange(key, value) {
    setInputs(prev => ({ ...prev, [key]: value }));
  }

  const filledCount = Object.values(inputs).filter(v => v !== '').length;

  return (
    <aside className="w-full lg:w-80 bg-[#0b1527] text-white flex flex-col h-screen lg:fixed lg:left-0 lg:top-0 lg:overflow-y-auto border-r border-white/[0.06]"
      style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e3356 #0b1527' }}>

      {/* Branding */}
      <div className="px-5 pt-6 pb-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5 mb-1.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center font-bold text-white text-base shadow-lg shadow-orange-500/30">B</div>
          <div>
            <div className="text-lg font-bold tracking-tight leading-none">BizHealth</div>
            <div className="text-[10px] text-slate-500 tracking-widest uppercase mt-0.5">Financial Dashboard</div>
          </div>
        </div>
      </div>

      {/* Industry */}
      <div className="px-5 pt-4 pb-3">
        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Industry</label>
        <select
          value={industry}
          onChange={e => setIndustry(e.target.value)}
          className="w-full bg-white/[0.05] border border-white/[0.1] text-slate-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 cursor-pointer"
          style={{ colorScheme: 'dark' }}
        >
          {Object.entries(INDUSTRY_BENCHMARKS).map(([key, val]) => (
            <option key={key} value={key} style={{ background: '#0b1527' }}>{val.label}</option>
          ))}
        </select>
        <p className="text-slate-600 text-[11px] mt-1.5">Benchmarks adjust per industry</p>
      </div>

      {/* Progress indicator */}
      <div className="px-5 pb-3">
        <div className="flex justify-between text-[10px] text-slate-600 mb-1">
          <span>Fields filled</span>
          <span className="text-orange-400 font-medium">{filledCount}/{INPUT_FIELDS.length}</span>
        </div>
        <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all duration-300"
            style={{ width: `${(filledCount / INPUT_FIELDS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Input Fields — grouped */}
      <div className="px-5 pb-3 flex-1">
        {GROUPS.map(group => (
          <div key={group} className="mb-4">
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-2.5">{group}</p>
            <div className="space-y-2">
              {INPUT_FIELDS.filter(f => f.group === group).map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-[11px] text-slate-500 mb-1 leading-none">{label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-xs font-medium pointer-events-none">₹</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={inputs[key]}
                      onChange={e => handleChange(key, e.target.value)}
                      className="input-dark"
                    />
                    {inputs[key] && (
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="px-5 py-4 border-t border-white/[0.06] space-y-2">
        <button
          onClick={onCalculate}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-semibold text-sm py-3 rounded-xl transition-all duration-150 glow-orange"
        >
          Calculate Health Score →
        </button>
        <button
          onClick={onReset}
          className="w-full bg-white/[0.05] hover:bg-white/[0.09] text-slate-400 hover:text-slate-200 font-medium text-sm py-2.5 rounded-xl transition-all duration-150 border border-white/[0.06]"
        >
          Reset All Fields
        </button>
      </div>
    </aside>
  );
}
