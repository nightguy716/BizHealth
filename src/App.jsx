/**
 * App.jsx — Root component.
 *
 * Holds all state, runs calculations, handles PDF export, and composes the layout.
 * Think of this as the "director" — it owns the data and passes it to child components.
 */

import { useState, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import Sidebar          from './components/Sidebar';
import SummaryBanner    from './components/SummaryBanner';
import RatioGroup       from './components/RatioGroup';
import BankReadiness    from './components/BankReadiness';
import SectorComparison from './components/SectorComparison';

import {
  calcCurrentRatio, calcQuickRatio, calcCashRatio,
  calcGrossMargin, calcOperatingMargin, calcNetMargin, calcROE, calcROA,
  calcAssetTurnover, calcFixedAssetTurnover, calcReceivablesDays, calcInventoryDays,
  calcDebtToEquity, calcInterestCoverage,
} from './utils/calculations';

import { getStatus, getBarWidth, INDUSTRY_BENCHMARKS } from './utils/benchmarks';
import { getInterpretation }                           from './utils/interpretations';

const RECOMMENDATIONS = {
  currentRatio:        'Negotiate longer payment terms with suppliers and accelerate customer collections.',
  quickRatio:          'Build a cash buffer of at least 1 month of liabilities. Review credit terms with buyers.',
  cashRatio:           'Set aside a fixed % of monthly revenue into a liquid reserve account.',
  grossMargin:         'Audit your top 3 cost-of-goods categories and renegotiate supplier contracts.',
  operatingMargin:     'Identify the top 3 overhead expense lines and set a 10% reduction target each quarter.',
  netMargin:           'Review tax planning and cut discretionary expenses. Consider a pricing review.',
  roe:                 'Re-evaluate capital allocation — are low-return investments tying up equity?',
  roa:                 'Identify idle or underperforming assets. Consider selling or leasing them out.',
  assetTurnover:       'Review underutilised capacity. Can you grow output without buying new assets?',
  fixedAssetTurnover:  'Assess whether fixed assets are being used at full capacity. Consider leasing idle equipment.',
  receivablesDays:     'Offer a 2% discount for payments within 10 days. Enforce late payment penalties strictly.',
  inventoryDays:       'Implement just-in-time ordering. Run a clearance promotion on slow-moving SKUs.',
  debtToEquity:        'Pause new borrowing. Use profits to pay down the highest-interest debt first.',
  interestCoverage:    'Refinance high-interest debt to longer tenure. Improve EBIT before taking on new loans.',
};

const EMPTY_INPUTS = {
  currentAssets: '', currentLiabilities: '', inventory: '',
  cash: '', totalAssets: '', equity: '', totalDebt: '',
  revenue: '', grossProfit: '', operatingExpenses: '', netProfit: '',
  interestExpense: '', receivables: '', cogs: '',
};

export default function App() {
  const [inputs, setInputs]         = useState(EMPTY_INPUTS);
  const [industry, setIndustry]     = useState('general');
  const [results, setResults]       = useState(null);
  const [calculated, setCalculated] = useState(false);
  const resultsRef = useRef(null);

  function n(key) { return parseFloat(inputs[key]) || 0; }

  function handleCalculate() {
    const ratioValues = {
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
    Object.keys(ratioValues).forEach(key => {
      statuses[key] = getStatus(ratioValues[key], key, industry);
    });

    setResults({ ratioValues, statuses });
    setCalculated(true);

    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  function handleReset() {
    setInputs(EMPTY_INPUTS);
    setResults(null);
    setCalculated(false);
  }

  async function handleExportPDF() {
    if (!resultsRef.current) return;
    try {
      const canvas = await html2canvas(resultsRef.current, {
        scale: 2, backgroundColor: '#070f1f', useCORS: true,
      });
      const imgData   = canvas.toDataURL('image/png');
      const pdf       = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW     = pdf.internal.pageSize.getWidth();
      const pageH     = pdf.internal.pageSize.getHeight();
      const imgW      = pageW - 20;
      const imgH      = (canvas.height * imgW) / canvas.width;
      const margin    = 10;

      if (imgH <= pageH - 20) {
        pdf.addImage(imgData, 'PNG', margin, margin, imgW, imgH);
      } else {
        let remaining = imgH;
        let srcY = 0;
        while (remaining > 0) {
          const slice    = Math.min(pageH - 20, remaining);
          const sc       = document.createElement('canvas');
          const ratio    = canvas.width / imgW;
          sc.width       = canvas.width;
          sc.height      = slice * ratio;
          sc.getContext('2d').drawImage(canvas, 0, srcY * ratio, canvas.width, sc.height, 0, 0, canvas.width, sc.height);
          pdf.addImage(sc.toDataURL('image/png'), 'PNG', margin, margin, imgW, slice);
          remaining -= slice;
          srcY += slice;
          if (remaining > 0) { pdf.addPage(); }
        }
      }
      pdf.save(`BizHealth-Report-${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (e) {
      console.error('PDF export failed', e);
    }
  }

  function buildCard(key, name, unit) {
    if (!results) return { key, name, unit, value: null, status: 'na', interpretation: '', recommendation: null, barWidth: 0 };
    const value  = results.ratioValues[key];
    const status = results.statuses[key];
    const bench  = INDUSTRY_BENCHMARKS[industry]?.[key];
    return {
      key, name, unit, value, status,
      interpretation: getInterpretation(key, value, status, bench?.threshold),
      recommendation:  RECOMMENDATIONS[key] || null,
      barWidth:        getBarWidth(value, key, industry),
    };
  }

  const GROUPS = [
    {
      title: 'Liquidity',
      ratios: [
        buildCard('currentRatio',   'Current Ratio',   'x'),
        buildCard('quickRatio',     'Quick Ratio',     'x'),
        buildCard('cashRatio',      'Cash Ratio',      'x'),
      ],
    },
    {
      title: 'Profitability',
      ratios: [
        buildCard('grossMargin',     'Gross Margin',          '%'),
        buildCard('operatingMargin', 'Operating Margin',      '%'),
        buildCard('netMargin',       'Net Margin',            '%'),
        buildCard('roe',             'Return on Equity (ROE)','%'),
        buildCard('roa',             'Return on Assets (ROA)','%'),
      ],
    },
    {
      title: 'Efficiency',
      ratios: [
        buildCard('assetTurnover',      'Asset Turnover',       'x'),
        buildCard('fixedAssetTurnover', 'Fixed Asset Turnover', 'x'),
        buildCard('receivablesDays',    'Receivables Days',     ' days'),
        buildCard('inventoryDays',      'Inventory Days',       ' days'),
      ],
    },
    {
      title: 'Leverage',
      ratios: [
        buildCard('debtToEquity',    'Debt to Equity',    'x'),
        buildCard('interestCoverage','Interest Coverage', 'x'),
      ],
    },
  ];

  const allStatuses = results
    ? Object.values(results.statuses)
    : Array(14).fill('na');

  return (
    <div className="min-h-screen bg-animated flex flex-col lg:flex-row">
      <Sidebar
        inputs={inputs}
        setInputs={setInputs}
        industry={industry}
        setIndustry={setIndustry}
        onCalculate={handleCalculate}
        onReset={handleReset}
      />

      <main className="flex-1 lg:ml-80 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8" ref={resultsRef}>

          {/* Welcome state */}
          {!calculated && (
            <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
              <div className="w-20 h-20 rounded-2xl glass-card flex items-center justify-center mb-6 border-white/[0.1]">
                <span className="text-4xl">📊</span>
              </div>
              <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">Welcome to BizHealth</h1>
              <p className="text-slate-500 text-base max-w-md leading-relaxed mb-4">
                Enter your financial figures in the sidebar and click{' '}
                <span className="text-orange-400 font-semibold">Calculate Health Score</span>{' '}
                to instantly see your business's financial position.
              </p>
              <div className="flex flex-wrap justify-center gap-2 text-[11px]">
                {['14 Ratios','Industry Benchmarks','Bank Readiness','Sector Comparison','PDF Export'].map(f => (
                  <span key={f} className="glass-card px-3 py-1.5 rounded-full text-slate-400 border-white/[0.08]">{f}</span>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {calculated && results && (
            <>
              <SummaryBanner statuses={allStatuses} onExportPDF={handleExportPDF} />

              {(() => {
                let idx = 0;
                return GROUPS.map(group => {
                  const start = idx;
                  idx += group.ratios.length;
                  return <RatioGroup key={group.title} title={group.title} ratios={group.ratios} startIndex={start} />;
                });
              })()}

              <BankReadiness ratioValues={results.ratioValues} />

              <SectorComparison ratioValues={results.ratioValues} industry={industry} />

              <p className="text-center text-slate-700 text-xs mt-8 pb-6">
                BizHealth · {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} · For informational use only
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
