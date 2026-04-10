/**
 * App.jsx — Root Component
 *
 * This is the top of the React component tree. It:
 * 1. Holds all 12 input values in "state" (useState)
 * 2. Runs all ratio calculations when the user clicks "Calculate"
 * 3. Passes results down to child components as props
 * 4. Handles the PDF export using html2canvas + jsPDF
 *
 * Layout: Fixed left sidebar + scrollable right main area (desktop)
 *         Stacked layout on mobile
 */

import { useState, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import Sidebar from './components/Sidebar';
import SummaryBanner from './components/SummaryBanner';
import RatioGroup from './components/RatioGroup';

import {
  calcCurrentRatio, calcQuickRatio, calcCashRatio,
  calcGrossMargin, calcNetMargin, calcROE, calcROA,
  calcAssetTurnover, calcReceivablesDays, calcInventoryDays, calcDebtToEquity
} from './utils/calculations';

import { getStatus, INDUSTRY_BENCHMARKS } from './utils/benchmarks';
import { getInterpretation } from './utils/interpretations';

// Recommendations shown for amber/red ratios — specific, actionable advice
const RECOMMENDATIONS = {
  currentRatio:    'Negotiate longer payment terms with suppliers and accelerate customer collections.',
  quickRatio:      'Build a cash buffer of at least 1 month of liabilities. Review credit terms.',
  cashRatio:       'Set aside a fixed % of monthly revenue into a liquid reserve account.',
  grossMargin:     'Audit your top 3 cost-of-goods categories and renegotiate supplier contracts.',
  netMargin:       'Identify your top 3 overhead expense lines and set a 10% reduction target.',
  roe:             'Re-evaluate capital allocation — are low-return investments tying up equity?',
  roa:             'Identify idle or underperforming assets. Consider selling or leasing them.',
  assetTurnover:   'Review underutilised capacity. Can you increase output without buying new assets?',
  receivablesDays: 'Offer a 2% discount for payments within 10 days. Enforce late payment penalties.',
  inventoryDays:   'Implement just-in-time ordering. Run a clearance on slow-moving SKUs.',
  debtToEquity:    'Pause new borrowing. Use profits to pay down the highest-interest debt first.',
};

const EMPTY_INPUTS = {
  currentAssets: '', currentLiabilities: '', inventory: '',
  cash: '', revenue: '', grossProfit: '', netProfit: '',
  totalAssets: '', equity: '', totalDebt: '', receivables: '', cogs: '',
};

export default function App() {
  const [inputs, setInputs]       = useState(EMPTY_INPUTS);
  const [industry, setIndustry]   = useState('general');
  const [results, setResults]     = useState(null);
  const [calculated, setCalculated] = useState(false);
  const resultsRef = useRef(null);

  // Parse a string input to a float — returns 0 if empty/invalid
  function n(key) { return parseFloat(inputs[key]) || 0; }

  function handleCalculate() {
    const benchmarks = INDUSTRY_BENCHMARKS[industry];

    // Run every formula — returns null if denominator is zero
    const ratioValues = {
      currentRatio:    calcCurrentRatio(n('currentAssets'), n('currentLiabilities')),
      quickRatio:      calcQuickRatio(n('currentAssets'), n('inventory'), n('currentLiabilities')),
      cashRatio:       calcCashRatio(n('cash'), n('currentLiabilities')),
      grossMargin:     calcGrossMargin(n('grossProfit'), n('revenue')),
      netMargin:       calcNetMargin(n('netProfit'), n('revenue')),
      roe:             calcROE(n('netProfit'), n('equity')),
      roa:             calcROA(n('netProfit'), n('totalAssets')),
      assetTurnover:   calcAssetTurnover(n('revenue'), n('totalAssets')),
      receivablesDays: calcReceivablesDays(n('receivables'), n('revenue')),
      inventoryDays:   calcInventoryDays(n('inventory'), n('cogs')),
      debtToEquity:    calcDebtToEquity(n('totalDebt'), n('equity')),
    };

    // For each ratio, determine its status (green/amber/red/na)
    const statuses = {};
    Object.keys(ratioValues).forEach(key => {
      statuses[key] = getStatus(ratioValues[key], key, industry);
    });

    setResults({ ratioValues, statuses });
    setCalculated(true);

    // Smooth scroll to results on mobile
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
    const canvas = await html2canvas(resultsRef.current, {
      scale: 2,
      backgroundColor: '#f8fafc',
      useCORS: true,
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth  = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth   = pageWidth - 20;
    const imgHeight  = (canvas.height * imgWidth) / canvas.width;

    let yPos = 10;
    // If the content is taller than one page, split across pages
    if (imgHeight <= pageHeight - 20) {
      pdf.addImage(imgData, 'PNG', 10, yPos, imgWidth, imgHeight);
    } else {
      let remainingHeight = imgHeight;
      let sourceY = 0;
      while (remainingHeight > 0) {
        const sliceHeight = Math.min(pageHeight - 20, remainingHeight);
        const sliceCanvas = document.createElement('canvas');
        const ratio = canvas.width / imgWidth;
        sliceCanvas.width  = canvas.width;
        sliceCanvas.height = sliceHeight * ratio;
        const ctx = sliceCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, sourceY * ratio, canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height);
        pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 10, yPos, imgWidth, sliceHeight);
        remainingHeight -= sliceHeight;
        sourceY += sliceHeight;
        if (remainingHeight > 0) { pdf.addPage(); yPos = 10; }
      }
    }

    pdf.save(`BizHealth-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  // Build the ratio data objects consumed by RatioGroup > RatioCard
  function buildRatioCard(key, name, unit) {
    if (!results) return { key, name, unit, value: null, status: 'na', interpretation: '', recommendation: null };
    const value  = results.ratioValues[key];
    const status = results.statuses[key];
    const bench  = INDUSTRY_BENCHMARKS[industry][key];
    return {
      key,
      name,
      unit,
      value,
      status,
      interpretation: getInterpretation(key, value, status, bench?.threshold),
      recommendation: RECOMMENDATIONS[key] || null,
    };
  }

  const GROUPS = [
    {
      title: 'Liquidity',
      ratios: [
        buildRatioCard('currentRatio',    'Current Ratio',  'x'),
        buildRatioCard('quickRatio',      'Quick Ratio',    'x'),
        buildRatioCard('cashRatio',       'Cash Ratio',     'x'),
      ],
    },
    {
      title: 'Profitability',
      ratios: [
        buildRatioCard('grossMargin',     'Gross Margin',   '%'),
        buildRatioCard('netMargin',       'Net Margin',     '%'),
        buildRatioCard('roe',             'Return on Equity (ROE)', '%'),
        buildRatioCard('roa',             'Return on Assets (ROA)', '%'),
      ],
    },
    {
      title: 'Efficiency',
      ratios: [
        buildRatioCard('assetTurnover',   'Asset Turnover', 'x'),
        buildRatioCard('receivablesDays', 'Receivables Days', ' days'),
        buildRatioCard('inventoryDays',   'Inventory Days',   ' days'),
      ],
    },
    {
      title: 'Leverage',
      ratios: [
        buildRatioCard('debtToEquity',    'Debt to Equity', 'x'),
      ],
    },
  ];

  const allStatuses = results
    ? Object.values(results.statuses)
    : Array(11).fill('na');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Left Sidebar */}
      <Sidebar
        inputs={inputs}
        setInputs={setInputs}
        industry={industry}
        setIndustry={setIndustry}
        onCalculate={handleCalculate}
        onReset={handleReset}
      />

      {/* Main Content Area — offset on desktop to account for fixed sidebar */}
      <main className="flex-1 lg:ml-80 xl:ml-88 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8" ref={resultsRef}>

          {/* Welcome state — shown before first calculation */}
          {!calculated && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="w-20 h-20 rounded-2xl bg-orange-100 flex items-center justify-center mb-6">
                <span className="text-4xl">📊</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-800 mb-3">Welcome to BizHealth</h1>
              <p className="text-slate-500 text-base max-w-md leading-relaxed mb-2">
                Enter your financial figures in the sidebar and click <strong className="text-orange-500">Calculate Health Score</strong> to instantly see your business's financial position.
              </p>
              <p className="text-slate-400 text-sm">11 ratios across Liquidity, Profitability, Efficiency & Leverage</p>
            </div>
          )}

          {/* Results — shown after calculation */}
          {calculated && results && (
            <>
              <SummaryBanner
                statuses={allStatuses}
                onExportPDF={handleExportPDF}
                industry={industry}
              />

              {(() => {
                let cardIndex = 0;
                return GROUPS.map(group => {
                  const startIndex = cardIndex;
                  cardIndex += group.ratios.length;
                  return (
                    <RatioGroup
                      key={group.title}
                      title={group.title}
                      ratios={group.ratios}
                      startIndex={startIndex}
                    />
                  );
                });
              })()}

              <p className="text-center text-slate-400 text-xs mt-8 pb-4">
                Generated by BizHealth · {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
