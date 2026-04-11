/**
 * Sidebar.jsx — Complete redesign with:
 * - Animated logo
 * - Industry selector
 * - Three data entry modes: Manual / Upload CSV / Demo Data
 * - CSV parsing with papaparse (fuzzy column matching)
 * - Fill-progress indicator
 */

import { useRef } from 'react';
import Papa from 'papaparse';
import Logo from './Logo';
import { INDUSTRY_BENCHMARKS } from '../utils/benchmarks';

// Demo data — realistic mid-size Indian manufacturing SME (FY2024)
export const DEMO_DATA = {
  currentAssets:      '4500000',
  currentLiabilities: '2800000',
  inventory:          '1200000',
  cash:               '800000',
  totalAssets:        '12000000',
  equity:             '6500000',
  totalDebt:          '3500000',
  revenue:            '24000000',
  grossProfit:        '5400000',
  operatingExpenses:  '2200000',
  netProfit:          '1800000',
  interestExpense:    '420000',
  receivables:        '2800000',
  cogs:               '18600000',
};

// Fuzzy column → field key matching for CSV import
const CSV_COLUMN_MAP = {
  'current assets':       'currentAssets',
  'current liabilities':  'currentLiabilities',
  'inventory':            'inventory',
  'stock':                'inventory',
  'cash':                 'cash',
  'cash and bank':        'cash',
  'bank balance':         'cash',
  'total assets':         'totalAssets',
  'equity':               'equity',
  'total equity':         'equity',
  'shareholders equity':  'equity',
  'total debt':           'totalDebt',
  'debt':                 'totalDebt',
  'revenue':              'revenue',
  'total revenue':        'revenue',
  'sales':                'revenue',
  'turnover':             'revenue',
  'gross profit':         'grossProfit',
  'operating expenses':   'operatingExpenses',
  'opex':                 'operatingExpenses',
  'net profit':           'netProfit',
  'profit after tax':     'netProfit',
  'pat':                  'netProfit',
  'interest expense':     'interestExpense',
  'interest':             'interestExpense',
  'finance costs':        'interestExpense',
  'receivables':          'receivables',
  'accounts receivable':  'receivables',
  'debtors':              'receivables',
  'cogs':                 'cogs',
  'cost of goods sold':   'cogs',
  'cost of sales':        'cogs',
};

const INPUT_FIELDS = [
  { key: 'currentAssets',      label: 'Current Assets',      group: 'Balance Sheet' },
  { key: 'currentLiabilities', label: 'Current Liabilities', group: 'Balance Sheet' },
  { key: 'inventory',          label: 'Inventory / Stock',   group: 'Balance Sheet' },
  { key: 'cash',               label: 'Cash & Bank Balance', group: 'Balance Sheet' },
  { key: 'totalAssets',        label: 'Total Assets',        group: 'Balance Sheet' },
  { key: 'equity',             label: 'Total Equity',        group: 'Balance Sheet' },
  { key: 'totalDebt',          label: 'Total Debt',          group: 'Balance Sheet' },
  { key: 'revenue',            label: 'Total Revenue',       group: 'P&L' },
  { key: 'grossProfit',        label: 'Gross Profit',        group: 'P&L' },
  { key: 'operatingExpenses',  label: 'Operating Expenses',  group: 'P&L' },
  { key: 'netProfit',          label: 'Net Profit',          group: 'P&L' },
  { key: 'interestExpense',    label: 'Interest Expense',    group: 'P&L' },
  { key: 'receivables',        label: 'Accounts Receivable', group: 'Working Capital' },
  { key: 'cogs',               label: 'Cost of Goods Sold',  group: 'Working Capital' },
];

const GROUPS = ['Balance Sheet', 'P&L', 'Working Capital'];

export default function Sidebar({ inputs, setInputs, industry, setIndustry, onCalculate, onReset }) {
  const fileRef = useRef(null);
  const filledCount = Object.values(inputs).filter(v => v !== '').length;
  const pct = Math.round((filledCount / INPUT_FIELDS.length) * 100);

  function handleChange(key, value) {
    setInputs(prev => ({ ...prev, [key]: value }));
  }

  function loadDemo() {
    setInputs(DEMO_DATA);
  }

  function handleCSV(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const newInputs = { ...inputs };
        const rows = results.data;
        // Try treating first column as label, second as value
        rows.forEach(row => {
          const cols = Object.keys(row);
          if (cols.length >= 2) {
            const rawLabel = String(row[cols[0]] || '').toLowerCase().trim();
            const rawValue = String(row[cols[1]] || '').replace(/[,₹\s]/g, '');
            const fieldKey = CSV_COLUMN_MAP[rawLabel];
            if (fieldKey && !isNaN(parseFloat(rawValue))) {
              newInputs[fieldKey] = rawValue;
            }
          }
        });
        // Also try header-based matching
        const headers = results.meta.fields || [];
        headers.forEach(header => {
          const cleanHeader = header.toLowerCase().replace(/[_-]/g, ' ').trim();
          const fieldKey = CSV_COLUMN_MAP[cleanHeader];
          if (fieldKey) {
            const val = rows[0]?.[header];
            if (val !== undefined) {
              const cleaned = String(val).replace(/[,₹\s]/g, '');
              if (!isNaN(parseFloat(cleaned))) {
                newInputs[fieldKey] = cleaned;
              }
            }
          }
        });
        setInputs(newInputs);
        e.target.value = '';
      },
    });
  }

  return (
    <aside className="w-full lg:w-80 bg-[#0b1527] flex flex-col h-screen lg:fixed lg:left-0 lg:top-0 lg:overflow-y-auto border-r border-white/[0.05]"
      style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e3356 #0b1527' }}>

      {/* ── Branding ── */}
      <div className="px-5 pt-5 pb-4 border-b border-white/[0.05]">
        <div className="flex items-center gap-3">
          <Logo size={38} />
          <div>
            <div className="text-[17px] font-bold text-white tracking-tight leading-none">BizHealth</div>
            <div className="text-[10px] text-slate-500 tracking-widest uppercase mt-0.5">Financial Intelligence</div>
          </div>
        </div>
      </div>

      {/* ── Industry ── */}
      <div className="px-5 pt-4 pb-2">
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Industry</label>
        <select
          value={industry}
          onChange={e => setIndustry(e.target.value)}
          className="w-full bg-white/[0.05] border border-white/[0.1] text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500/40 cursor-pointer"
          style={{ colorScheme: 'dark' }}
        >
          {Object.entries(INDUSTRY_BENCHMARKS).map(([k, v]) => (
            <option key={k} value={k} style={{ background: '#0b1527' }}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* ── Quick data entry options ── */}
      <div className="px-5 py-3 border-b border-white/[0.05]">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5">Quick Fill</p>
        <div className="flex gap-2">
          <button
            onClick={loadDemo}
            className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium text-orange-300 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 rounded-xl py-2 transition-all"
          >
            <span>⚡</span> Demo Data
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl py-2 transition-all"
          >
            <span>↑</span> Upload CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleCSV} className="hidden" />
        </div>
        <p className="text-slate-700 text-[10px] mt-2 text-center">CSV: Label in col A, Value in col B</p>
      </div>

      {/* ── Fill progress ── */}
      <div className="px-5 pt-3 pb-1">
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-slate-600">Fields filled</span>
          <span className={`font-semibold ${pct === 100 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-slate-500'}`}>
            {filledCount}/{INPUT_FIELDS.length}
          </span>
        </div>
        <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-400' : 'bg-gradient-to-r from-orange-500 to-orange-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* ── Input fields ── */}
      <div className="px-5 pb-2 pt-2 flex-1">
        {GROUPS.map(group => (
          <div key={group} className="mb-4">
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">{group}</p>
            <div className="space-y-2">
              {INPUT_FIELDS.filter(f => f.group === group).map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-[11px] text-slate-500 mb-0.5">{label}</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 text-[11px] pointer-events-none select-none">₹</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={inputs[key]}
                      onChange={e => handleChange(key, e.target.value)}
                      className="input-dark"
                    />
                    {inputs[key] && (
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-orange-400 pointer-events-none"></span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Action buttons ── */}
      <div className="px-5 py-4 border-t border-white/[0.05] space-y-2 bg-[#0b1527]">
        <button
          onClick={onCalculate}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 active:scale-[0.98] text-white font-bold text-sm py-3 rounded-xl transition-all duration-150 glow-orange"
        >
          Calculate Health Score →
        </button>
        <button
          onClick={onReset}
          className="w-full bg-white/[0.04] hover:bg-white/[0.08] text-slate-500 hover:text-slate-300 font-medium text-xs py-2 rounded-xl transition-all border border-white/[0.05]"
        >
          Reset
        </button>
      </div>
    </aside>
  );
}
