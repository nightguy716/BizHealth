import {
  ResponsiveContainer, AreaChart, Area,
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

/* ── Helpers ── */
function fmtBig(v) {
  if (!v && v !== 0) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e12) return (v / 1e12).toFixed(1) + 'T';
  if (abs >= 1e9)  return (v / 1e9).toFixed(1) + 'B';
  if (abs >= 1e6)  return (v / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3)  return (v / 1e3).toFixed(1) + 'K';
  return v.toFixed(0);
}
function pct(a, b) { return b ? ((a / b) * 100) : null; }

/* ── Shared tooltip style ── */
const TT_STYLE = {
  contentStyle: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 8, fontSize: 11,
    fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-2)',
    boxShadow: 'var(--shadow-lg)',
  },
  labelStyle: { color: 'var(--text-4)', marginBottom: 4 },
  cursor: { stroke: 'rgba(79,110,247,0.25)', strokeWidth: 1 },
};

/* ── Mini section header ── */
function ChartHeader({ title, sub }) {
  return (
    <div className="mb-3">
      <span className="mono text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{ color: 'var(--text-3)' }}>{title}</span>
      {sub && <span className="ml-2 text-[10px]" style={{ color: 'var(--text-5)' }}>{sub}</span>}
    </div>
  );
}

/* ── Individual mini chart cards ── */
function ChartCard({ children, title, sub }) {
  return (
    <div className="ghost-card rounded-2xl p-5">
      <ChartHeader title={title} sub={sub} />
      {children}
    </div>
  );
}

/* ── AXIS STYLES ── */
const AXIS_PROPS = {
  tick:  { fill: 'var(--text-5)', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' },
  axisLine: false,
  tickLine: false,
};

export default function HistoricalCharts({ historical, currency = 'USD' }) {
  const incRaw  = (historical?.income  || []).filter(y => y?.revenue);
  const balRaw  = (historical?.balance || []).filter(y => y?.totalAssets || y?.totalEquity);

  if (incRaw.length < 2) return null;  // Need at least 2 years

  /* Oldest → newest */
  const inc = [...incRaw].reverse();
  const bal = [...balRaw].reverse();

  /* Build merged dataset per year */
  const years = inc.map(y => String(y.year || '').slice(-4));

  const revData = inc.map((y, i) => ({
    year:       years[i],
    revenue:    y.revenue    || 0,
    netProfit:  y.netProfit  || 0,
    grossProfit:y.grossProfit|| 0,
  }));

  const marginData = inc.map((y, i) => ({
    year:          years[i],
    grossMargin:   pct(y.grossProfit,    y.revenue),
    operatingMargin: pct(y.operatingIncome || (y.grossProfit - (y.operatingExpenses || 0)), y.revenue),
    netMargin:     pct(y.netProfit,      y.revenue),
  }));

  const balData = bal.map(b => {
    const incMatch = inc.find(y => String(y.year).slice(-4) === String(b.year).slice(-4));
    const de = b.totalEquity > 0 ? (b.totalDebt || 0) / b.totalEquity : null;
    return {
      year:          String(b.year || '').slice(-4),
      roe:           (incMatch && b.totalEquity > 0)
                       ? pct(incMatch.netProfit, b.totalEquity)
                       : null,
      debtToEquity:  de,
      totalAssets:   b.totalAssets   || 0,
      totalEquity:   b.totalEquity   || 0,
    };
  }).filter(d => d.year);

  const hasBalance = balData.length >= 2;

  return (
    <section className="mb-10">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-5">
        <span className="text-lg">⊞</span>
        <div>
          <span className="mono text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-400">
            Historical Trends
          </span>
          <span className="text-[11px] ml-3" style={{ color: 'var(--text-4)' }}>
            {inc.length}-year financial performance
          </span>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-cyan-500/60 to-transparent ml-2" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* 1 — Revenue vs Net Profit */}
        <ChartCard title="Revenue & Net Profit" sub={`${currency}`}>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={revData} barGap={4} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="year" {...AXIS_PROPS} />
              <YAxis tickFormatter={fmtBig} {...AXIS_PROPS} width={36} />
              <Tooltip
                {...TT_STYLE}
                formatter={(v, name) => [fmtBig(v) + ' ' + currency, name === 'revenue' ? 'Revenue' : 'Net Profit']}
              />
              <Bar dataKey="revenue"   fill="#4f6ef7" radius={[3,3,0,0]} opacity={0.85} />
              <Bar dataKey="netProfit" fill="#00e887" radius={[3,3,0,0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2">
            {[['var(--gold)','Revenue'],['#00e887','Net Profit']].map(([c,l]) => (
              <span key={l} className="flex items-center gap-1.5"
                style={{ fontFamily:'var(--font-sans)', fontSize:9, color:'var(--text-4)' }}>
                <span style={{ width:8, height:8, borderRadius:2, background:c, display:'inline-block' }} />
                {l}
              </span>
            ))}
          </div>
        </ChartCard>

        {/* 2 — Margin trends */}
        <ChartCard title="Margin Trends" sub="%">
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={marginData}>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="year" {...AXIS_PROPS} />
              <YAxis tickFormatter={v => v != null ? v.toFixed(0)+'%' : ''} {...AXIS_PROPS} width={32} />
              <Tooltip
                {...TT_STYLE}
                formatter={(v, name) => [
                  v != null ? v.toFixed(1) + '%' : '—',
                  name === 'grossMargin' ? 'Gross' : name === 'operatingMargin' ? 'Operating' : 'Net',
                ]}
              />
              <Line type="monotone" dataKey="grossMargin"     stroke="#22d3ee" strokeWidth={2} dot={{ r:3, fill:'#22d3ee' }} connectNulls />
              <Line type="monotone" dataKey="operatingMargin" stroke="#a78bfa" strokeWidth={2} dot={{ r:3, fill:'#a78bfa' }} connectNulls />
              <Line type="monotone" dataKey="netMargin"       stroke="#00e887" strokeWidth={2} dot={{ r:3, fill:'#00e887' }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2">
            {[['#22d3ee','Gross'],['#a78bfa','Operating'],['#00e887','Net']].map(([c,l]) => (
              <span key={l} className="flex items-center gap-1.5"
                style={{ fontFamily:'var(--font-sans)', fontSize:9, color:'var(--text-4)' }}>
                <span style={{ width:16, height:2, background:c, display:'inline-block', borderRadius:1 }} />
                {l}
              </span>
            ))}
          </div>
        </ChartCard>

        {/* 3 — ROE trend (only if balance data available) */}
        {hasBalance && (
          <ChartCard title="Return on Equity" sub="%">
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={balData}>
                <defs>
                  <linearGradient id="roeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#00e887" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#00e887" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="year" {...AXIS_PROPS} />
                <YAxis tickFormatter={v => v != null ? v.toFixed(0)+'%' : ''} {...AXIS_PROPS} width={32} />
                <Tooltip
                  {...TT_STYLE}
                  formatter={v => [v != null ? v.toFixed(1) + '%' : '—', 'ROE']}
                />
                <Area type="monotone" dataKey="roe" stroke="#00e887" strokeWidth={2}
                  fill="url(#roeGrad)" dot={{ r:3, fill:'#00e887' }} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* 4 — Debt/Equity trend */}
        {hasBalance && (
          <ChartCard title="Debt / Equity" sub="ratio">
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={balData}>
                <defs>
                  <linearGradient id="deGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#fbbf24" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#fbbf24" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="year" {...AXIS_PROPS} />
                <YAxis tickFormatter={v => v != null ? v.toFixed(1)+'×' : ''} {...AXIS_PROPS} width={32} />
                <Tooltip
                  {...TT_STYLE}
                  formatter={v => [v != null ? v.toFixed(2) + '×' : '—', 'D/E']}
                />
                <Area type="monotone" dataKey="debtToEquity" stroke="#fbbf24" strokeWidth={2}
                  fill="url(#deGrad)" dot={{ r:3, fill:'#fbbf24' }} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

      </div>
    </section>
  );
}
