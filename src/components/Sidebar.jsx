import { useRef } from 'react';
import Papa from 'papaparse';
import Logo from './Logo';
import CompanySearch from './CompanySearch';
import { INDUSTRY_BENCHMARKS } from '../utils/benchmarks';

export const DEMO_DATA = {
  currentAssets:'4500000', currentLiabilities:'2800000', inventory:'1200000', cash:'800000',
  totalAssets:'12000000', equity:'6500000', totalDebt:'3500000',
  revenue:'24000000', grossProfit:'5400000', operatingExpenses:'2200000',
  netProfit:'1800000', interestExpense:'420000', receivables:'2800000', cogs:'18600000',
};

const CSV_MAP = {
  'current assets':'currentAssets','current liabilities':'currentLiabilities',
  'inventory':'inventory','stock':'inventory','cash':'cash','cash and bank':'cash',
  'bank balance':'cash','total assets':'totalAssets','equity':'equity',
  'total equity':'equity','shareholders equity':'equity','total debt':'totalDebt',
  'debt':'totalDebt','revenue':'revenue','total revenue':'revenue','sales':'revenue',
  'turnover':'revenue','gross profit':'grossProfit','operating expenses':'operatingExpenses',
  'opex':'operatingExpenses','net profit':'netProfit','profit after tax':'netProfit',
  'pat':'netProfit','interest expense':'interestExpense','interest':'interestExpense',
  'finance costs':'interestExpense','receivables':'receivables',
  'accounts receivable':'receivables','debtors':'receivables',
  'cogs':'cogs','cost of goods sold':'cogs','cost of sales':'cogs',
};

const FIELDS = [
  { key:'currentAssets',      label:'Current Assets',      g:'Balance Sheet' },
  { key:'currentLiabilities', label:'Current Liabilities', g:'Balance Sheet' },
  { key:'inventory',          label:'Inventory / Stock',   g:'Balance Sheet' },
  { key:'cash',               label:'Cash & Bank',         g:'Balance Sheet' },
  { key:'totalAssets',        label:'Total Assets',        g:'Balance Sheet' },
  { key:'equity',             label:'Total Equity',        g:'Balance Sheet' },
  { key:'totalDebt',          label:'Total Debt',          g:'Balance Sheet' },
  { key:'revenue',            label:'Total Revenue',       g:'P&L'          },
  { key:'grossProfit',        label:'Gross Profit',        g:'P&L'          },
  { key:'operatingExpenses',  label:'Operating Expenses',  g:'P&L'          },
  { key:'netProfit',          label:'Net Profit',          g:'P&L'          },
  { key:'interestExpense',    label:'Interest Expense',    g:'P&L'          },
  { key:'receivables',        label:'Accounts Receivable', g:'Working Capital'},
  { key:'cogs',               label:'Cost of Goods Sold',  g:'Working Capital'},
];

const GROUPS = ['Balance Sheet','P&L','Working Capital'];

const GROUP_ICONS = {
  'Balance Sheet': '◩',
  'P&L':          '◈',
  'Working Capital':'◎',
};

function SectionLabel({ icon, title }) {
  return (
    <div className="section-label">
      <span className="text-[10px] font-bold tracking-[0.14em] uppercase flex items-center gap-1.5"
        style={{ color: 'rgba(79,110,247,0.75)', fontFamily: 'var(--font-mono)' }}>
        <span style={{ fontSize: 9 }}>{icon}</span>
        {title}
      </span>
    </div>
  );
}

export default function Sidebar({ inputs, setInputs, industry, setIndustry, onCalculate, onReset, onCompanyLoaded }) {
  const fileRef = useRef(null);
  const filled  = Object.values(inputs).filter(v => v !== '').length;
  const pct     = Math.round((filled / FIELDS.length) * 100);

  const handleCSV = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: ({ data, meta }) => {
        const next = { ...inputs };
        data.forEach(row => {
          const cols = Object.keys(row);
          if (cols.length >= 2) {
            const lbl = String(row[cols[0]]||'').toLowerCase().trim();
            const raw = String(row[cols[1]]||'').replace(/[,₹\s]/g,'');
            const fk  = CSV_MAP[lbl];
            if (fk && !isNaN(parseFloat(raw))) next[fk] = raw;
          }
        });
        (meta.fields||[]).forEach(h => {
          const fk = CSV_MAP[h.toLowerCase().replace(/[_-]/g,' ').trim()];
          if (fk && data[0]?.[h]) {
            const raw = String(data[0][h]).replace(/[,₹\s]/g,'');
            if (!isNaN(parseFloat(raw))) next[fk] = raw;
          }
        });
        setInputs(next);
        e.target.value = '';
      },
    });
  };

  return (
    <aside className="w-full lg:w-80 flex flex-col h-screen lg:fixed lg:left-0 lg:top-0 lg:overflow-y-auto"
      style={{
        background: 'linear-gradient(180deg, rgba(5,9,22,0.99) 0%, rgba(4,8,20,0.99) 100%)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(79,110,247,0.2) transparent',
      }}>

      {/* Top neon accent */}
      <div className="sidebar-top-bar flex-shrink-0" />

      {/* Brand */}
      <div className="px-5 pt-5 pb-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <Logo size={38} />
          <div>
            <div className="font-bold text-[18px] tracking-tight leading-none" style={{ color: '#f0f4ff' }}>
              Biz<span style={{ color: '#6b84f8' }}>Health</span>
            </div>
            <div className="mono text-[9px] font-semibold uppercase tracking-[0.16em] mt-1.5"
              style={{ color: 'rgba(79,110,247,0.55)' }}>
              Financial Intelligence
            </div>
          </div>
          <div className="ml-auto">
            <span className="mono text-[9px] font-bold px-2 py-0.5 rounded-md"
              style={{ background: 'rgba(79,110,247,0.12)', border: '1px solid rgba(79,110,247,0.22)', color: '#6b84f8' }}>
              v3
            </span>
          </div>
        </div>
      </div>

      {/* Company Search */}
      <div className="px-5 pt-4 pb-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <SectionLabel icon="⊕" title="Company Lookup" />
        <CompanySearch onSelect={(companyData) => {
          setInputs(p => ({ ...p, ...companyData.data }));
          if (companyData.industry && INDUSTRY_BENCHMARKS[companyData.industry]) {
            setIndustry(companyData.industry);
          }
          onCompanyLoaded?.(
            { name: companyData.name, ticker: companyData.ticker, currency: companyData.currency, isListed: true },
            companyData.historical || { income: [], balance: [], cashflow: [] }
          );
        }} />
      </div>

      {/* Industry */}
      <div className="px-5 pt-4 pb-3 flex-shrink-0">
        <SectionLabel icon="◈" title="Industry Sector" />
        <select value={industry} onChange={e => setIndustry(e.target.value)} className="select-neon">
          {Object.entries(INDUSTRY_BENCHMARKS).map(([k,v]) => (
            <option key={k} value={k} style={{ background:'#060b18', color:'#f0f4ff' }}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Quick fill */}
      <div className="px-5 pb-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <SectionLabel icon="⚡" title="Quick Fill" />
        <div className="flex gap-2">
          <button onClick={() => setInputs(DEMO_DATA)}
            className="flex-1 text-[11px] font-semibold py-2 rounded-xl transition-all duration-200"
            style={{
              background: 'rgba(79,110,247,0.1)',
              border: '1px solid rgba(79,110,247,0.25)',
              color: '#8899ff',
            }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(79,110,247,0.18)'; e.currentTarget.style.borderColor='rgba(79,110,247,0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(79,110,247,0.1)'; e.currentTarget.style.borderColor='rgba(79,110,247,0.25)'; }}>
            ⚡ Demo
          </button>
          <button onClick={() => fileRef.current?.click()}
            className="flex-1 text-[11px] font-semibold py-2 rounded-xl transition-all duration-200"
            style={{
              background: 'rgba(34,211,238,0.07)',
              border: '1px solid rgba(34,211,238,0.2)',
              color: '#22d3ee',
            }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(34,211,238,0.14)'; e.currentTarget.style.borderColor='rgba(34,211,238,0.38)'; }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(34,211,238,0.07)'; e.currentTarget.style.borderColor='rgba(34,211,238,0.2)'; }}>
            ↑ CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleCSV} className="hidden" />
        </div>
      </div>

      {/* Progress */}
      <div className="px-5 pt-3.5 pb-2 flex-shrink-0">
        <div className="flex justify-between items-center mb-2">
          <span className="mono text-[9px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: 'var(--text-muted)' }}>
            Data Completeness
          </span>
          <span className="mono text-[10px] font-bold"
            style={{ color: pct === 100 ? '#00e887' : pct >= 60 ? '#fbbf24' : 'var(--text-dim)' }}>
            {filled}/{FIELDS.length}
          </span>
        </div>
        <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: pct === 100
                ? 'linear-gradient(90deg,#00e887,#22d3ee)'
                : 'linear-gradient(90deg,#4f6ef7,#6b84f8)',
              boxShadow: pct === 100 ? '0 0 8px #00e887' : '0 0 8px rgba(79,110,247,0.6)',
            }} />
        </div>
      </div>

      {/* Input fields */}
      <div className="px-5 pb-3 pt-2 flex-1">
        {GROUPS.map(g => (
          <div key={g} className="mb-5">
            <SectionLabel icon={GROUP_ICONS[g]} title={g} />
            <div className="space-y-2">
              {FIELDS.filter(f => f.g === g).map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-[11px] font-medium mb-1"
                    style={{ color: inputs[key] ? 'var(--text-secondary)' : 'var(--text-dim)' }}>
                    {label}
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] pointer-events-none mono select-none"
                      style={{ color: 'var(--text-muted)' }}>
                      ₹
                    </span>
                    <input type="number" min="0" placeholder="0" value={inputs[key]}
                      onChange={e => setInputs(p => ({ ...p, [key]: e.target.value }))}
                      className="input-neon" />
                    {inputs[key] && (
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full pulse-dot pointer-events-none"
                        style={{ background: '#22d3ee', boxShadow: '0 0 5px #22d3ee' }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={onCalculate}
          className="btn-primary w-full text-white font-bold text-[13px] py-3.5 rounded-xl mb-2.5 flex items-center justify-center gap-2">
          Calculate Health Score
          <span style={{ opacity: 0.7 }}>→</span>
        </button>
        <button onClick={onReset}
          className="w-full text-[12px] font-medium py-2.5 rounded-xl transition-all duration-200"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'var(--text-dim)',
          }}
          onMouseEnter={e => { e.currentTarget.style.color='var(--text-secondary)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.color='var(--text-dim)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'; }}>
          Reset All Fields
        </button>
      </div>
    </aside>
  );
}
