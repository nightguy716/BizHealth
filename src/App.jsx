/**
 * App.jsx — Root component.
 * Orchestrates state, calculations, PDF export, and the full page layout.
 */

import { useState, useRef } from 'react';
import jsPDF from 'jspdf';

import Sidebar          from './components/Sidebar';
import SummaryBanner    from './components/SummaryBanner';
import RatioGroup       from './components/RatioGroup';
import BankReadiness    from './components/BankReadiness';
import SectorComparison from './components/SectorComparison';
import AIInsights       from './components/AIInsights';
import Logo             from './components/Logo';

import {
  calcCurrentRatio, calcQuickRatio, calcCashRatio,
  calcGrossMargin, calcOperatingMargin, calcNetMargin, calcROE, calcROA,
  calcAssetTurnover, calcFixedAssetTurnover, calcReceivablesDays,
  calcInventoryDays, calcDebtToEquity, calcInterestCoverage,
} from './utils/calculations';

import { getStatus, getBarWidth, INDUSTRY_BENCHMARKS } from './utils/benchmarks';
import { getInterpretation }                           from './utils/interpretations';

const RECOMMENDATIONS = {
  currentRatio:        'Negotiate longer payment terms with suppliers and accelerate customer collections.',
  quickRatio:          'Build a cash buffer equal to at least 1 month of current liabilities.',
  cashRatio:           'Set aside a fixed % of monthly revenue into a liquid reserve account.',
  grossMargin:         'Audit top 3 cost-of-goods categories. Renegotiate supplier contracts or review pricing.',
  operatingMargin:     'Identify top 3 controllable overhead lines and target a 10% cut each quarter.',
  netMargin:           'Review tax planning and discretionary expenses. Consider a pricing review.',
  roe:                 'Re-evaluate capital allocation — are low-return investments tying up equity?',
  roa:                 'Identify idle or underperforming assets. Consider selling or leasing them.',
  assetTurnover:       'Grow revenue from the existing asset base before purchasing new capacity.',
  fixedAssetTurnover:  'Check whether fixed assets are at full utilisation. Lease idle equipment.',
  receivablesDays:     'Offer 2% discount for payments within 10 days. Enforce late-payment penalties.',
  inventoryDays:       'Implement demand-led procurement. Clear slow-moving SKUs with a promotion.',
  debtToEquity:        'Pause new borrowing. Allocate monthly profit to highest-interest debt first.',
  interestCoverage:    'Refinance high-interest short-term debt to longer tenure. Improve EBIT urgently.',
};

const EMPTY_INPUTS = {
  currentAssets:'', currentLiabilities:'', inventory:'', cash:'',
  totalAssets:'', equity:'', totalDebt:'',
  revenue:'', grossProfit:'', operatingExpenses:'', netProfit:'', interestExpense:'',
  receivables:'', cogs:'',
};

export default function App() {
  const [inputs,          setInputs]          = useState(EMPTY_INPUTS);
  const [industry,        setIndustry]        = useState('general');
  const [results,         setResults]         = useState(null);
  const [calculated,      setCalculated]      = useState(false);
  const [companyContext,  setCompanyContext]   = useState({ name: '', ticker: '', currency: 'INR', isListed: false });
  const [historical,      setHistorical]      = useState({ income: [], balance: [] });
  const [aiInsights,      setAiInsights]      = useState(null);
  const [exporting,       setExporting]       = useState(false);
  const resultsRef = useRef(null);

  const n = key => parseFloat(inputs[key]) || 0;

  function handleCalculate() {
    const rv = {
      currentRatio:        calcCurrentRatio(n('currentAssets'), n('currentLiabilities')),
      quickRatio:          calcQuickRatio(n('currentAssets'), n('inventory'), n('currentLiabilities')),
      cashRatio:           calcCashRatio(n('cash'), n('currentLiabilities')),
      grossMargin:         calcGrossMargin(n('grossProfit'), n('revenue')),
      operatingMargin:     calcOperatingMargin(n('grossProfit'), n('operatingExpenses'), n('revenue')),
      netMargin:           calcNetMargin(n('netProfit'), n('revenue')),
      roe:                 calcROE(n('netProfit'), n('equity')),
      roa:                 calcROA(n('netProfit'), n('totalAssets')),
      assetTurnover:       calcAssetTurnover(n('revenue'), n('totalAssets')),
      fixedAssetTurnover:  calcFixedAssetTurnover(n('revenue'), n('totalAssets'), n('currentAssets')),
      receivablesDays:     calcReceivablesDays(n('receivables'), n('revenue')),
      inventoryDays:       calcInventoryDays(n('inventory'), n('cogs')),
      debtToEquity:        calcDebtToEquity(n('totalDebt'), n('equity')),
      interestCoverage:    calcInterestCoverage(n('grossProfit'), n('operatingExpenses'), n('interestExpense')),
    };
    const statuses = {};
    Object.keys(rv).forEach(k => { statuses[k] = getStatus(rv[k], k, industry); });
    setResults({ ratioValues: rv, statuses });
    setCalculated(true);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }

  function handleReset() {
    setInputs(EMPTY_INPUTS);
    setResults(null);
    setCalculated(false);
    setHistorical({ income: [], balance: [] });
    setAiInsights(null);
    setCompanyContext({ name: '', ticker: '', currency: 'INR', isListed: false });
  }

  async function handleExportExcel() {
    if (!results) return;
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    if (!backendUrl) { alert('Backend not connected'); return; }
    setExporting(true);
    try {
      const body = {
        company:    companyContext,
        industry,
        score:      healthScore,
        ratios:     results.ratioValues,
        statuses:   results.statuses,
        inputs,
        historical,
        ai_insights: aiInsights || {},
      };
      const res = await fetch(`${backendUrl}/export/excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const co   = companyContext.name || 'BizHealth';
      a.href     = url;
      a.download = `BizHealth-${co.replace(/\s+/g,'-')}-Analysis.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Excel export failed: ' + e.message);
    } finally {
      setExporting(false);
    }
  }

  function handleExportPDF() {
    if (!results) return;
    const pdf  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W    = 210; const H = 297; const M = 16;
    const col  = W - M * 2;
    const date = new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
    const co   = companyContext.name || 'Business';

    const STATUS_COLOR = { green:[0,200,120], amber:[251,191,36], red:[220,50,80], na:[100,116,139] };
    const STATUS_LABEL = { green:'Healthy', amber:'Borderline', red:'Critical', na:'N/A' };

    const fmt = (v, unit) => {
      if (v === null || v === undefined) return 'N/A';
      const n = parseFloat(v);
      if (isNaN(n)) return 'N/A';
      if (unit === '%') return n.toFixed(1) + '%';
      if (unit === ' days') return n.toFixed(0) + ' days';
      return n.toFixed(2) + 'x';
    };

    // ── Cover page ────────────────────────────────────────
    pdf.setFillColor(3, 7, 17);
    pdf.rect(0, 0, W, H, 'F');
    pdf.setFillColor(79, 110, 247);
    pdf.rect(0, 0, W, 2, 'F');

    pdf.setTextColor(79, 110, 247);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('BIZHEALTH · FINANCIAL INTELLIGENCE', M, 22);

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(28);
    pdf.text('Financial Health', M, 50);
    pdf.text('Report', M, 62);

    pdf.setTextColor(100, 116, 139);
    pdf.setFontSize(11);
    pdf.text(co, M, 74);
    pdf.text(date, M, 81);

    // Score circle
    const cx = W - M - 28; const cy = 62; const r = 22;
    const sc = STATUS_COLOR[healthScore >= 80 ? 'green' : healthScore >= 60 ? 'amber' : healthScore >= 40 ? 'na' : 'red'];
    pdf.setDrawColor(...sc); pdf.setLineWidth(3);
    pdf.circle(cx, cy, r, 'S');
    pdf.setTextColor(...sc); pdf.setFontSize(20); pdf.setFont('helvetica','bold');
    pdf.text(String(healthScore), cx, cy + 4, { align:'center' });
    pdf.setFontSize(7); pdf.setTextColor(100,116,139);
    pdf.text('HEALTH SCORE', cx, cy + 10, { align:'center' });

    // Status summary bar
    const counts = { green:0, amber:0, red:0, na:0 };
    Object.values(results.statuses).forEach(s => counts[s]++);
    let bx = M; const by = 100;
    [['green','Healthy'],['amber','Borderline'],['red','Critical'],['na','N/A']].forEach(([k,l]) => {
      pdf.setFillColor(...STATUS_COLOR[k]);
      pdf.roundedRect(bx, by, 36, 18, 2, 2, 'F');
      pdf.setTextColor(3,7,17); pdf.setFontSize(14); pdf.setFont('helvetica','bold');
      pdf.text(String(counts[k]), bx + 18, by + 10, { align:'center' });
      pdf.setFontSize(6); pdf.setFont('helvetica','normal');
      pdf.text(l, bx + 18, by + 15, { align:'center' });
      bx += 40;
    });

    // ── Page 2 — ratio table ──────────────────────────────
    pdf.addPage();
    pdf.setFillColor(3, 7, 17); pdf.rect(0, 0, W, H, 'F');
    pdf.setFillColor(79, 110, 247); pdf.rect(0, 0, W, 2, 'F');

    pdf.setTextColor(79, 110, 247); pdf.setFont('helvetica','bold'); pdf.setFontSize(8);
    pdf.text('BIZHEALTH · RATIO ANALYSIS', M, 14);
    pdf.setTextColor(255,255,255); pdf.setFontSize(16);
    pdf.text(co + ' — Key Financial Ratios', M, 24);

    let y = 34;
    const RATIO_ROWS = [
      ['LIQUIDITY', null, null, null],
      ['Current Ratio','currentRatio','x',null],
      ['Quick Ratio','quickRatio','x',null],
      ['Cash Ratio','cashRatio','x',null],
      ['PROFITABILITY', null, null, null],
      ['Gross Margin','grossMargin','%',null],
      ['Operating Margin','operatingMargin','%',null],
      ['Net Margin','netMargin','%',null],
      ['Return on Equity','roe','%',null],
      ['Return on Assets','roa','%',null],
      ['EFFICIENCY', null, null, null],
      ['Asset Turnover','assetTurnover','x',null],
      ['Fixed Asset Turnover','fixedAssetTurnover','x',null],
      ['Receivables Days','receivablesDays',' days',null],
      ['Inventory Days','inventoryDays',' days',null],
      ['LEVERAGE', null, null, null],
      ['Debt to Equity','debtToEquity','x',null],
      ['Interest Coverage','interestCoverage','x',null],
    ];

    RATIO_ROWS.forEach(([label, key, unit]) => {
      if (!key) {
        // Section header
        pdf.setFillColor(15, 20, 40);
        pdf.rect(M, y - 3, col, 8, 'F');
        pdf.setTextColor(79, 110, 247); pdf.setFont('helvetica','bold'); pdf.setFontSize(7);
        pdf.text(label, M + 2, y + 2);
        y += 9;
        return;
      }
      const val    = results.ratioValues[key];
      const status = results.statuses[key];
      const sc2    = STATUS_COLOR[status] || STATUS_COLOR.na;

      pdf.setFillColor(status === 'green' ? 0 : status === 'amber' ? 40 : status === 'red' ? 40 : 20,
                       status === 'green' ? 30 : 20, status === 'red' ? 10 : 30, 0.1);

      // Row bg
      pdf.setFillColor(10, 15, 30);
      pdf.rect(M, y - 3, col, 7.5, 'F');

      // Status dot
      pdf.setFillColor(...sc2);
      pdf.circle(M + 3, y + 0.5, 1.5, 'F');

      // Label
      pdf.setTextColor(200, 210, 220); pdf.setFont('helvetica','normal'); pdf.setFontSize(8);
      pdf.text(label, M + 8, y + 2);

      // Value
      pdf.setTextColor(...sc2); pdf.setFont('helvetica','bold'); pdf.setFontSize(9);
      pdf.text(fmt(val, unit), W - M - 30, y + 2, { align:'right' });

      // Status badge
      pdf.setFillColor(...sc2.map(c => Math.min(255, c * 0.2)));
      pdf.setTextColor(...sc2); pdf.setFontSize(6);
      pdf.text(STATUS_LABEL[status], W - M - 2, y + 2, { align:'right' });

      y += 8;
    });

    // Footer
    pdf.setTextColor(50,60,80); pdf.setFontSize(7); pdf.setFont('helvetica','normal');
    pdf.text('Generated by BizHealth · For informational purposes only · biz-health.vercel.app', W/2, H - 8, { align:'center' });

    pdf.save(`BizHealth-${co.replace(/\s+/g,'-')}-${new Date().toISOString().slice(0,10)}.pdf`);
  }

  function card(key, name, unit) {
    if (!results) return { key, name, unit, value: null, status: 'na', interpretation: '', recommendation: null, barWidth: 0 };
    const v = results.ratioValues[key];
    const s = results.statuses[key];
    const b = INDUSTRY_BENCHMARKS[industry]?.[key];
    return {
      key, name, unit, value: v, status: s,
      interpretation: getInterpretation(key, v, s, b?.threshold),
      recommendation:  RECOMMENDATIONS[key] || null,
      barWidth:        getBarWidth(v, key, industry),
    };
  }

  const GROUPS = [
    { title: 'Liquidity',     ratios: [card('currentRatio','Current Ratio','x'), card('quickRatio','Quick Ratio','x'), card('cashRatio','Cash Ratio','x')] },
    { title: 'Profitability', ratios: [card('grossMargin','Gross Margin','%'), card('operatingMargin','Operating Margin','%'), card('netMargin','Net Margin','%'), card('roe','Return on Equity','%'), card('roa','Return on Assets','%')] },
    { title: 'Efficiency',    ratios: [card('assetTurnover','Asset Turnover','x'), card('fixedAssetTurnover','Fixed Asset Turnover','x'), card('receivablesDays','Receivables Days',' days'), card('inventoryDays','Inventory Days',' days')] },
    { title: 'Leverage',      ratios: [card('debtToEquity','Debt to Equity','x'), card('interestCoverage','Interest Coverage','x')] },
  ];

  const allStatuses = results ? Object.values(results.statuses) : Array(14).fill('na');
  const healthScore = (() => {
    const valid = allStatuses.filter(s => s !== 'na').length;
    if (!valid) return 0;
    const pts = allStatuses.reduce((acc, s) => acc + (s === 'green' ? 2 : s === 'amber' ? 1 : 0), 0);
    return Math.round((pts / (valid * 2)) * 100);
  })();

  return (
    <div className="min-h-screen page-bg flex flex-col lg:flex-row">

      <Sidebar
        inputs={inputs} setInputs={setInputs}
        industry={industry} setIndustry={setIndustry}
        onCalculate={handleCalculate} onReset={handleReset}
        onCompanyLoaded={(ctx, hist) => {
          setCompanyContext(ctx);
          if (hist) setHistorical(hist);
        }}
      />

      <main className="flex-1 lg:ml-80 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8" ref={resultsRef}>

          {/* ── Welcome state ── */}
          {!calculated && (
            <div className="flex flex-col items-center justify-center min-h-[80vh] text-center select-none">
              {/* Glow halo behind logo */}
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full blur-2xl" style={{ background:'radial-gradient(circle, rgba(79,110,247,0.35) 0%, transparent 70%)', transform:'scale(2.5)' }} />
                <Logo size={80} />
              </div>

              <h1 className="font-bold tracking-tight mb-1" style={{ fontSize:'2.8rem', lineHeight:1.1 }}>
                <span className="text-white">Biz</span><span style={{ color:'#22d3ee', textShadow:'0 0 30px rgba(34,211,238,0.6)' }}>Health</span>
              </h1>
              <p className="mono text-[11px] font-bold uppercase tracking-widest mb-6" style={{ color:'rgba(34,211,238,0.45)' }}>
                Financial Intelligence Platform · v3.0
              </p>

              <p className="text-sm max-w-md leading-relaxed mb-2" style={{ color: '#d4ddf5' }}>
                Enter your financials, or hit <span style={{ color:'#7b95fa' }}>⚡ Demo</span> in the sidebar for instant results.
              </p>
              <p className="mono text-[10px] mb-10" style={{ color: '#6b82a8' }}>14 RATIOS · AI ENGINE · BANK READINESS · SECTOR COMPARISON · PDF</p>

              {/* Feature grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-lg mb-8">
                {[
                  { icon:'💧', label:'Liquidity',     count:'3 ratios', color:'#22d3ee' },
                  { icon:'📈', label:'Profitability', count:'5 ratios', color:'#00e887' },
                  { icon:'⚙️', label:'Efficiency',    count:'4 ratios', color:'#a78bfa' },
                  { icon:'⚖️', label:'Leverage',      count:'2 ratios', color:'#fbbf24' },
                ].map(({ icon, label, count, color }) => (
                  <div key={label} className="ghost-card rounded-2xl p-4 text-center" style={{ borderColor:`${color}25` }}>
                    <div className="text-2xl mb-1">{icon}</div>
                    <div className="text-slate-300 text-xs font-semibold">{label}</div>
                    <div className="mono text-[10px]" style={{ color:`${color}80` }}>{count}</div>
                  </div>
                ))}
              </div>

              {/* Status legend */}
              <div className="flex items-center gap-6 text-[11px]">
                {[['#00e887','Healthy'],['#fbbf24','Borderline'],['#f43f5e','Critical']].map(([c,l]) => (
                  <div key={l} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background:c, boxShadow:`0 0 6px ${c}` }} />
                    <span className="mono text-[11px]" style={{ color: '#9fb3d4' }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Results ── */}
          {calculated && results && (
            <>
              <SummaryBanner
                statuses={allStatuses}
                onExportPDF={handleExportPDF}
                onExportExcel={handleExportExcel}
                exporting={exporting}
              />

              {(() => {
                let idx = 0;
                return GROUPS.map(g => {
                  const start = idx;
                  idx += g.ratios.length;
                  return <RatioGroup key={g.title} title={g.title} ratios={g.ratios} startIndex={start} />;
                });
              })()}

              <AIInsights
                ratioValues={results.ratioValues}
                statuses={results.statuses}
                score={healthScore}
                industry={industry}
                companyContext={companyContext}
                onInsightsReady={setAiInsights}
              />

              <BankReadiness ratioValues={results.ratioValues} />

              <SectorComparison ratioValues={results.ratioValues} industry={industry} />

              <div className="text-center text-[11px] mt-8 pb-8" style={{ color: '#3d5070' }}>
                BizHealth · {new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })} · For informational purposes only
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
