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
  // CFA inputs
  da:'480000', accountsPayable:'1400000', operatingCashFlow:'2100000',
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
  'depreciation':'da','d&a':'da','depreciation and amortization':'da',
  'accounts payable':'accountsPayable','creditors':'accountsPayable','trade payables':'accountsPayable',
  'operating cash flow':'operatingCashFlow','cash from operations':'operatingCashFlow','cfo':'operatingCashFlow',
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
  { key:'da',                 label:'D&A (Depreciation)',  g:'CFA Inputs'   },
  { key:'accountsPayable',    label:'Accounts Payable',    g:'CFA Inputs'   },
  { key:'operatingCashFlow',  label:'Operating Cash Flow', g:'CFA Inputs'   },
];

const GROUPS = [
  { id: 'Balance Sheet',  label: 'Balance Sheet',   color: '#4f6ef7', dot: 'rgba(79,110,247,0.8)'  },
  { id: 'P&L',            label: 'P & L',           color: '#00e887', dot: 'rgba(0,232,135,0.8)'   },
  { id: 'Working Capital',label: 'Working Capital', color: '#22d3ee', dot: 'rgba(34,211,238,0.8)'  },
  { id: 'CFA Inputs',     label: 'CFA Inputs',      color: '#f59e0b', dot: 'rgba(245,158,11,0.8)'  },
];

export default function Sidebar({ inputs, setInputs, industry, setIndustry, onCalculate, onReset, onCompanyLoaded, collapsed = false }) {
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

  if (collapsed) {
    return (
      <aside className="hidden lg:flex flex-col items-center w-0 h-screen fixed left-0 top-0 overflow-hidden"
        style={{ transition: 'width 0.25s ease' }} />
    );
  }

  return (
    <aside className="w-full lg:w-80 flex flex-col h-screen lg:fixed lg:left-0 lg:top-0 lg:overflow-y-auto"
      style={{
        background: 'linear-gradient(180deg, #06101e 0%, #050d1a 100%)',
        borderRight: '1px solid rgba(79,110,247,0.18)',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(79,110,247,0.25) transparent',
        transition: 'width 0.25s ease',
      }}>

      {/* Top royal-blue accent bar */}
      <div className="sidebar-top-bar flex-shrink-0" />

      {/* ── Brand ───────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(79,110,247,0.12)' }}>
        <div className="flex items-center gap-3">
          <Logo size={36} />
          <div className="flex-1">
            <div className="font-bold text-[18px] tracking-tight leading-none" style={{ color: '#ffffff' }}>
              Biz<span style={{ color: '#7b95fa' }}>Health</span>
            </div>
            <div className="mono text-[9px] font-semibold uppercase tracking-[0.15em] mt-1"
              style={{ color: 'rgba(79,110,247,0.6)' }}>
              Financial Intelligence
            </div>
          </div>
          <span className="mono text-[9px] font-bold px-2 py-0.5 rounded"
            style={{ background: 'rgba(79,110,247,0.15)', border: '1px solid rgba(79,110,247,0.3)', color: '#7b95fa' }}>
            v3
          </span>
        </div>
      </div>

      {/* ── Company Search ──────────────────────────────── */}
      <div className="px-4 pt-4 pb-4 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-2.5"
          style={{ color: '#9fb3d4' }}>
          Listed Company Lookup
        </p>
        <CompanySearch onSelect={(companyData) => {
          setInputs(p => ({ ...p, ...companyData.data }));
          if (companyData.industry && INDUSTRY_BENCHMARKS[companyData.industry]) {
            setIndustry(companyData.industry);
          }
          onCompanyLoaded?.(
            {
              name: companyData.name, ticker: companyData.ticker,
              currency: companyData.currency, isListed: true,
              sector: companyData.sector || '',
              marketData: companyData.market_data || {},
            },
            companyData.historical || { income: [], balance: [], cashflow: [] }
          );
        }} />
      </div>

      {/* ── Industry + Quick Fill ───────────────────────── */}
      <div className="px-4 pt-4 pb-4 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-2.5"
          style={{ color: '#9fb3d4' }}>
          Industry Sector
        </p>
        <select value={industry} onChange={e => setIndustry(e.target.value)} className="select-neon mb-3">
          {Object.entries(INDUSTRY_BENCHMARKS).map(([k,v]) => (
            <option key={k} value={k} style={{ background: '#06101e', color: '#e2e8f5' }}>{v.label}</option>
          ))}
        </select>

        <div className="flex gap-2 mt-3">
          <button onClick={() => setInputs(DEMO_DATA)}
            className="flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all"
            style={{ background: 'rgba(79,110,247,0.14)', border: '1px solid rgba(79,110,247,0.32)', color: '#9fb3f8' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(79,110,247,0.24)'; }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(79,110,247,0.14)'; }}>
            ⚡ Demo Data
          </button>
          <button onClick={() => fileRef.current?.click()}
            className="flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all"
            style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.22)', color: '#5de0f0' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(34,211,238,0.16)'; }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(34,211,238,0.08)'; }}>
            ↑ Upload CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleCSV} className="hidden" />
        </div>
      </div>

      {/* ── Completeness bar ────────────────────────────── */}
      <div className="px-4 py-3 flex-shrink-0">
        <div className="flex justify-between items-center mb-1.5">
          <span className="mono text-[9px] uppercase tracking-[0.1em]" style={{ color: 'var(--text-muted)' }}>
            Data Completeness
          </span>
          <span className="mono text-[10px] font-bold"
            style={{ color: pct === 100 ? '#00e887' : pct >= 60 ? '#fbbf24' : '#9fb3d4' }}>
            {filled} / {FIELDS.length}
          </span>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: pct === 100 ? 'linear-gradient(90deg,#00e887,#22d3ee)' : 'linear-gradient(90deg,#4f6ef7,#7b95fa)',
              boxShadow: pct === 100 ? '0 0 8px #00e887' : '0 0 8px rgba(79,110,247,0.7)',
            }} />
        </div>
      </div>

      {/* ── Input field groups ──────────────────────────── */}
      <div className="px-4 pb-2 flex-1 overflow-y-auto">
        {GROUPS.map(g => {
          const groupFields = FIELDS.filter(f => f.g === g.id);
          const groupFilled = groupFields.filter(f => inputs[f.key] !== '').length;
          return (
            <div key={g.id} className="mb-4 rounded-xl overflow-hidden"
              style={{ border: `1px solid rgba(255,255,255,0.07)`, background: 'rgba(255,255,255,0.02)' }}>
              {/* Group header */}
              <div className="flex items-center justify-between px-3 py-2.5"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-5 rounded-full flex-shrink-0"
                    style={{ background: g.color, boxShadow: `0 0 8px ${g.color}` }} />
                  <span className="text-[11px] font-semibold" style={{ color: '#ffffff' }}>
                    {g.label}
                  </span>
                </div>
                <span className="mono text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: `${g.color}18`, color: g.color, border: `1px solid ${g.color}35` }}>
                  {groupFilled}/{groupFields.length}
                </span>
              </div>

              {/* Fields */}
              <div className="px-3 py-2.5 space-y-2.5">
                {groupFields.map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-[11px] font-medium mb-1"
                      style={{ color: inputs[key] ? '#c8d8f0' : '#6b82a8' }}>
                      {label}
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 mono text-[11px] pointer-events-none select-none"
                        style={{ color: '#3d5070' }}>
                        ₹
                      </span>
                      <input type="number" min="0" placeholder="0" value={inputs[key]}
                        onChange={e => setInputs(p => ({ ...p, [key]: e.target.value }))}
                        className="input-neon" />
                      {inputs[key] && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full pulse-dot pointer-events-none"
                          style={{ background: g.color, boxShadow: `0 0 5px ${g.color}` }} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Action buttons ──────────────────────────────── */}
      <div className="px-4 py-4 flex-shrink-0"
        style={{ borderTop: '1px solid rgba(79,110,247,0.12)' }}>
        <button onClick={onCalculate}
          className="btn-primary w-full text-white font-bold text-[13px] py-3.5 rounded-xl mb-2 flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Calculate Health Score
        </button>
        <button onClick={onReset}
          className="w-full py-2.5 rounded-xl text-[12px] font-medium transition-all"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#6b82a8' }}
          onMouseEnter={e => { e.currentTarget.style.color='#9fb3d4'; e.currentTarget.style.borderColor='rgba(255,255,255,0.16)'; }}
          onMouseLeave={e => { e.currentTarget.style.color='#6b82a8'; e.currentTarget.style.borderColor='rgba(255,255,255,0.09)'; }}>
          Reset All Fields
        </button>
      </div>
    </aside>
  );
}
