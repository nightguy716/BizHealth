/**
 * App.jsx — Root component.
 * Orchestrates state, calculations, PDF export, and the full page layout.
 */

import { useState, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
  const [inputs,     setInputs]     = useState(EMPTY_INPUTS);
  const [industry,   setIndustry]   = useState('general');
  const [results,    setResults]    = useState(null);
  const [calculated, setCalculated] = useState(false);
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
  }

  async function handleExportPDF() {
    if (!resultsRef.current) return;
    try {
      const canvas  = await html2canvas(resultsRef.current, { scale: 2, backgroundColor: '#060d1a', useCORS: true });
      const pdf     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW   = pdf.internal.pageSize.getWidth();
      const pageH   = pdf.internal.pageSize.getHeight();
      const imgW    = pageW - 20;
      const imgH    = (canvas.height * imgW) / canvas.width;
      const margin  = 10;

      const addPage = (sourceCanvas, srcY, sliceH) => {
        const sc  = document.createElement('canvas');
        const r   = canvas.width / imgW;
        sc.width  = canvas.width;
        sc.height = sliceH * r;
        sc.getContext('2d').drawImage(canvas, 0, srcY * r, canvas.width, sc.height, 0, 0, canvas.width, sc.height);
        return sc.toDataURL('image/png');
      };

      if (imgH <= pageH - 20) {
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, imgW, imgH);
      } else {
        let rem  = imgH, srcY = 0, first = true;
        while (rem > 0) {
          if (!first) pdf.addPage();
          const slice = Math.min(pageH - 20, rem);
          pdf.addImage(addPage(canvas, srcY, slice), 'PNG', margin, margin, imgW, slice);
          rem -= slice; srcY += slice; first = false;
        }
      }
      pdf.save(`BizHealth-${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (e) { console.error('PDF failed', e); }
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
      />

      <main className="flex-1 lg:ml-80 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8" ref={resultsRef}>

          {/* ── Welcome state ── */}
          {!calculated && (
            <div className="flex flex-col items-center justify-center min-h-[80vh] text-center select-none">
              <div className="mb-6">
                <Logo size={72} />
              </div>
              <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
                Biz<span className="text-orange-400">Health</span>
              </h1>
              <p className="text-slate-500 text-base max-w-md leading-relaxed mb-2">
                Enter your financial figures — or click <span className="text-orange-400 font-semibold">Demo Data</span> — then hit{' '}
                <span className="text-orange-400 font-semibold">Calculate</span> to see a full analysis.
              </p>
              <p className="text-slate-600 text-sm mb-8">14 ratios · AI analysis · Bank readiness · Sector comparison · PDF export</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-lg">
                {[
                  { icon: '💧', label: 'Liquidity',     count: '3 ratios' },
                  { icon: '📈', label: 'Profitability', count: '5 ratios' },
                  { icon: '⚙️', label: 'Efficiency',    count: '4 ratios' },
                  { icon: '⚖️', label: 'Leverage',      count: '2 ratios' },
                ].map(({ icon, label, count }) => (
                  <div key={label} className="glass-card rounded-2xl p-4 text-center border-white/[0.07]">
                    <div className="text-2xl mb-1">{icon}</div>
                    <div className="text-slate-300 text-xs font-semibold">{label}</div>
                    <div className="text-slate-600 text-[10px]">{count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Results ── */}
          {calculated && results && (
            <>
              <SummaryBanner statuses={allStatuses} onExportPDF={handleExportPDF} />

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
              />

              <BankReadiness ratioValues={results.ratioValues} />

              <SectorComparison ratioValues={results.ratioValues} industry={industry} />

              <div className="text-center text-slate-700 text-[11px] mt-8 pb-8">
                BizHealth · {new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })} · For informational purposes only
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
