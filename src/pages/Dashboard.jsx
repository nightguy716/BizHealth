/**
 * App.jsx — Root component.
 * Orchestrates state, calculations, PDF export, and the full page layout.
 */

import { useState, useRef, useEffect } from 'react';
import jsPDF from 'jspdf';

import Sidebar          from '../components/Sidebar';
import SummaryBanner    from '../components/SummaryBanner';
import RatioGroup       from '../components/RatioGroup';
import BankReadiness    from '../components/BankReadiness';
import SectorComparison from '../components/SectorComparison';
import AIInsights       from '../components/AIInsights';
import Logo             from '../components/Logo';

import { SECTOR_COMPANIES, COMPARISON_RATIOS } from '../data/sectorData';

import {
  calcCurrentRatio, calcQuickRatio, calcCashRatio,
  calcGrossMargin, calcOperatingMargin, calcNetMargin, calcROE, calcROA,
  calcAssetTurnover, calcFixedAssetTurnover, calcReceivablesDays,
  calcInventoryDays, calcDebtToEquity, calcInterestCoverage,
  calcEbitdaMargin, calcROIC, calcEquityMultiplier, calcDebtToCapital,
  calcNetDebtToEbitda, calcDPO, calcCCC, calcCfoToNetIncome, calcAltmanZ,
} from '../utils/calculations';

import { getStatus, getBarWidth, INDUSTRY_BENCHMARKS } from '../utils/benchmarks';
import { getInterpretation }                           from '../utils/interpretations';

const RECOMMENDATIONS = {
  currentRatio:           'Negotiate longer payment terms with suppliers and accelerate customer collections.',
  quickRatio:             'Build a cash buffer equal to at least 1 month of current liabilities.',
  cashRatio:              'Set aside a fixed % of monthly revenue into a liquid reserve account.',
  grossMargin:            'Audit top 3 cost-of-goods categories. Renegotiate supplier contracts or review pricing.',
  operatingMargin:        'Identify top 3 controllable overhead lines and target a 10% cut each quarter.',
  netMargin:              'Review tax planning and discretionary expenses. Consider a pricing review.',
  roe:                    'Re-evaluate capital allocation — are low-return investments tying up equity?',
  roa:                    'Identify idle or underperforming assets. Consider selling or leasing them.',
  assetTurnover:          'Grow revenue from the existing asset base before purchasing new capacity.',
  fixedAssetTurnover:     'Check whether fixed assets are at full utilisation. Lease idle equipment.',
  receivablesDays:        'Offer 2% discount for payments within 10 days. Enforce late-payment penalties.',
  inventoryDays:          'Implement demand-led procurement. Clear slow-moving SKUs with a promotion.',
  debtToEquity:           'Pause new borrowing. Allocate monthly profit to highest-interest debt first.',
  interestCoverage:       'Refinance high-interest short-term debt to longer tenure. Improve EBIT urgently.',
  ebitdaMargin:           'Reduce operating cost base or exit low-margin product lines to improve EBITDA quality.',
  roic:                   'Divest non-core assets, improve operating margins, or reduce invested capital to lift ROIC above WACC.',
  equityMultiplier:       'Deleverage by retiring debt and retaining earnings to reduce reliance on financial leverage.',
  debtToCapital:          'Shift financing mix toward equity through retained earnings or fresh equity issuance.',
  netDebtToEbitda:        'Target 0.5x deleveraging per year by directing FCF toward debt repayment. Avoid new M&A until below 2.5x.',
  daysPayableOutstanding: 'Negotiate 30-60 day payment terms with key suppliers to improve working capital position.',
  cashConversionCycle:    'Tighten DSO via early-payment incentives, reduce DIO via demand forecasting, extend DPO via supplier negotiations.',
  cfoToNetIncome:         'Investigate the gap between reported profits and cash. Analyse receivables build-up and revenue recognition policies.',
  altmanZ:                'Prioritise liquidity improvement, profitability recovery, and debt reduction. Consider restructuring options.',
};

const EMPTY_INPUTS = {
  currentAssets:'', currentLiabilities:'', inventory:'', cash:'',
  totalAssets:'', equity:'', totalDebt:'',
  revenue:'', grossProfit:'', operatingExpenses:'', netProfit:'', interestExpense:'',
  receivables:'', cogs:'',
  da:'', accountsPayable:'', operatingCashFlow:'',
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
  const [sidebarOpen,     setSidebarOpen]     = useState(true);
  const resultsRef = useRef(null);

  const n = key => parseFloat(inputs[key]) || 0;

  function handleCalculate() {
    const rv = {
      // ── Core 14 ──────────────────────────────────────────
      currentRatio:           calcCurrentRatio(n('currentAssets'), n('currentLiabilities')),
      quickRatio:             calcQuickRatio(n('currentAssets'), n('inventory'), n('currentLiabilities')),
      cashRatio:              calcCashRatio(n('cash'), n('currentLiabilities')),
      grossMargin:            calcGrossMargin(n('grossProfit'), n('revenue')),
      operatingMargin:        calcOperatingMargin(n('grossProfit'), n('operatingExpenses'), n('revenue')),
      netMargin:              calcNetMargin(n('netProfit'), n('revenue')),
      roe:                    calcROE(n('netProfit'), n('equity')),
      roa:                    calcROA(n('netProfit'), n('totalAssets')),
      assetTurnover:          calcAssetTurnover(n('revenue'), n('totalAssets')),
      fixedAssetTurnover:     calcFixedAssetTurnover(n('revenue'), n('totalAssets'), n('currentAssets')),
      receivablesDays:        calcReceivablesDays(n('receivables'), n('revenue')),
      inventoryDays:          calcInventoryDays(n('inventory'), n('cogs')),
      debtToEquity:           calcDebtToEquity(n('totalDebt'), n('equity')),
      interestCoverage:       calcInterestCoverage(n('grossProfit'), n('operatingExpenses'), n('interestExpense')),
      // ── CFA Advanced ──────────────────────────────────────
      ebitdaMargin:           calcEbitdaMargin(n('grossProfit'), n('operatingExpenses'), n('da'), n('revenue')),
      roic:                   calcROIC(n('grossProfit'), n('operatingExpenses'), n('equity'), n('totalDebt'), n('cash')),
      equityMultiplier:       calcEquityMultiplier(n('totalAssets'), n('equity')),
      debtToCapital:          calcDebtToCapital(n('totalDebt'), n('equity')),
      netDebtToEbitda:        calcNetDebtToEbitda(n('totalDebt'), n('cash'), n('grossProfit'), n('operatingExpenses'), n('da')),
      daysPayableOutstanding: calcDPO(n('accountsPayable'), n('cogs')),
      cashConversionCycle:    calcCCC(n('receivables'), n('revenue'), n('inventory'), n('cogs'), n('accountsPayable')),
      cfoToNetIncome:         calcCfoToNetIncome(n('operatingCashFlow'), n('netProfit')),
      altmanZ:                calcAltmanZ(n('currentAssets'), n('currentLiabilities'), n('totalAssets'), n('netProfit'), n('grossProfit'), n('operatingExpenses'), n('equity')),
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
    try {
    const pdf  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W    = 210; const H = 297; const M = 14;
    const col  = W - M * 2;
    const date = new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
    const co   = companyContext.name || 'Business';
    const cur  = companyContext.currency || 'USD';
    const tick = companyContext.ticker || '';

    // ── Palette ───────────────────────────────────────────
    const C = {
      bg:     [3, 7, 17],
      surface:[10,15,32],
      border: [20,28,55],
      accent: [79,110,247],
      cyan:   [34,211,238],
      green:  [0, 200, 115],
      amber:  [251,191,36],
      red:    [239,68,88],
      muted:  [107,130,168],
      dim:    [50,65,100],
      white:  [255,255,255],
      body:   [196,216,240],
    };
    const STATUS_COLOR = { green:C.green, amber:C.amber, red:C.red, na:C.muted };
    const STATUS_LABEL = { green:'Healthy', amber:'Borderline', red:'Critical', na:'N/A' };

    // ── Helpers ───────────────────────────────────────────
    const bg  = () => { pdf.setFillColor(...C.bg); pdf.rect(0,0,W,H,'F'); };
    const hdr = () => {
      pdf.setFillColor(...C.accent);
      pdf.rect(0, 0, W, 1.5, 'F');
      pdf.setFillColor(...C.bg);
      pdf.rect(0, 1.5, W, 10, 'F');
      pdf.setFillColor(15,22,48);
      pdf.rect(0, 11, W, 1, 'F');
    };
    const footer = (page, total) => {
      pdf.setFillColor(...C.dim);
      pdf.rect(0, H - 10, W, 10, 'F');
      pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5);
      pdf.text('BizHealth Financial Intelligence  ·  For informational purposes only  ·  biz-health.vercel.app', M, H - 4);
      pdf.text(`Page ${page} / ${total}`, W - M, H - 4, { align:'right' });
    };
    const fmt = (v, unit) => {
      if (v === null || v === undefined || isNaN(parseFloat(v))) return 'N/A';
      const n = parseFloat(v);
      if (unit === '%') return n.toFixed(1) + '%';
      if (unit === ' days') return n.toFixed(0) + ' d';
      return n.toFixed(2) + 'x';
    };
    const fmtBig = v => {
      if (!v || isNaN(v)) return 'N/A';
      const abs = Math.abs(v);
      if (abs >= 1e12) return (v/1e12).toFixed(1) + 'T';
      if (abs >= 1e9)  return (v/1e9).toFixed(1) + 'B';
      if (abs >= 1e6)  return (v/1e6).toFixed(1) + 'M';
      if (abs >= 1e3)  return (v/1e3).toFixed(1) + 'K';
      return v.toFixed(0);
    };

    // Draw an arc using line segments (for score ring)
    const drawArc = (cx, cy, r, startDeg, endDeg, color, lw = 3.5) => {
      pdf.setDrawColor(...color); pdf.setLineWidth(lw);
      const steps = 60;
      const s = (startDeg - 90) * Math.PI / 180;
      const e = (endDeg   - 90) * Math.PI / 180;
      for (let i = 0; i < steps; i++) {
        const a1 = s + (i/steps)*(e-s);
        const a2 = s + ((i+1)/steps)*(e-s);
        pdf.line(cx+r*Math.cos(a1), cy+r*Math.sin(a1), cx+r*Math.cos(a2), cy+r*Math.sin(a2));
      }
    };

    // Draw a horizontal ratio bar
    const drawBar = (x, y, barW, pct, color) => {
      pdf.setFillColor(...C.border); pdf.roundedRect(x, y, barW, 3.5, 1.5, 1.5, 'F');
      if (pct > 0) {
        pdf.setFillColor(...color); pdf.roundedRect(x, y, Math.min(pct, 1) * barW, 3.5, 1.5, 1.5, 'F');
      }
    };

    // Counts
    const counts = { green:0, amber:0, red:0, na:0 };
    Object.values(results.statuses).forEach(s => counts[s]++);
    const scoreColor = healthScore >= 80 ? C.green : healthScore >= 60 ? C.amber : healthScore >= 40 ? C.accent : C.red;

    // ── Has historical income data? ───────────────────────
    const incHist  = (historical.income  || []).filter(y => y?.revenue);
    const hasHist  = incHist.length >= 2;

    // ── Sector peers for comparison page ──────────────────
    const sectorPeers = (SECTOR_COMPANIES[industry] || SECTOR_COMPANIES.general).slice(0, 4);
    const hasPeers    = sectorPeers.length > 0;

    // ── DCF assumptions ───────────────────────────────────
    const DCF_GROWTH = { tech:[0.30,0.22,0.18,0.14,0.12], healthcare:[0.12,0.10,0.09,0.08,0.07],
      finance:[0.09,0.08,0.07,0.06,0.05], retail:[0.07,0.06,0.06,0.05,0.04],
      manufacturing:[0.07,0.06,0.06,0.05,0.04], general:[0.10,0.08,0.07,0.06,0.05] };
    const DCF_EM = { tech:[0.28,0.30,0.31,0.31,0.32], healthcare:[0.25,0.26,0.27,0.27,0.27],
      finance:[0.35,0.36,0.37,0.37,0.37], retail:[0.08,0.08,0.09,0.09,0.09],
      manufacturing:[0.16,0.17,0.17,0.18,0.18], general:[0.22,0.23,0.24,0.24,0.25] };
    const gr = DCF_GROWTH[industry] || DCF_GROWTH.general;
    const em = DCF_EM[industry]     || DCF_EM.general;
    const baseRevRaw  = parseFloat(inputs.revenue) || 0;
    const hasDCF = baseRevRaw > 0;

    const totalPages = 3 + (hasHist ? 1 : 0) + (hasPeers ? 1 : 0) + (hasDCF ? 1 : 0);

    // ══════════════════════════════════════════════════════
    //  PAGE 1 — Executive Dashboard
    // ══════════════════════════════════════════════════════
    bg(); hdr();

    // Header strip text
    pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5);
    pdf.text('BIZHEALTH  ·  FINANCIAL INTELLIGENCE', M, 8);
    pdf.text(date, W - M, 8, { align:'right' });

    // Company name
    pdf.setTextColor(...C.white); pdf.setFont('helvetica','bold'); pdf.setFontSize(20);
    pdf.text(co, M, 30);
    if (companyContext.ticker) {
      pdf.setTextColor(...C.cyan); pdf.setFontSize(9); pdf.setFont('helvetica','normal');
      pdf.text(companyContext.ticker + (companyContext.sector ? '  ·  ' + companyContext.sector : ''), M, 37);
    }

    // ── Score ring (drawn arcs) ──────────────────────────
    const cx = W - M - 26; const cy = 31; const rr = 19;
    // Background ring
    drawArc(cx, cy, rr, 0, 360, C.border, 2.5);
    // Score arc (0 = top, clockwise)
    const sweepEnd = (healthScore / 100) * 360;
    if (sweepEnd > 0) drawArc(cx, cy, rr, 0, sweepEnd, scoreColor, 3.5);
    // Score number
    pdf.setTextColor(...scoreColor); pdf.setFont('helvetica','bold'); pdf.setFontSize(16);
    pdf.text(String(healthScore), cx, cy + 3.5, { align:'center' });
    pdf.setFontSize(5.5); pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal');
    pdf.text('/ 100', cx, cy + 8.5, { align:'center' });
    pdf.setFontSize(5); pdf.setTextColor(...scoreColor); pdf.setFont('helvetica','bold');
    const vLabel = healthScore >= 80 ? 'STRONG' : healthScore >= 60 ? 'MODERATE' : healthScore >= 40 ? 'BORDERLINE' : 'WEAK';
    pdf.text(vLabel, cx, cy + 13.5, { align:'center' });

    // ── Status pill row ──────────────────────────────────
    const pillY = 45; let px = M;
    [['green','Healthy'],['amber','Borderline'],['red','Critical'],['na','N/A']].forEach(([k,l]) => {
      pdf.setFillColor(...STATUS_COLOR[k].map(c => Math.min(255, c * 0.18)));
      pdf.roundedRect(px, pillY, 40, 14, 2, 2, 'F');
      pdf.setDrawColor(...STATUS_COLOR[k]); pdf.setLineWidth(0.4);
      pdf.roundedRect(px, pillY, 40, 14, 2, 2, 'S');
      pdf.setTextColor(...STATUS_COLOR[k]); pdf.setFont('helvetica','bold'); pdf.setFontSize(13);
      pdf.text(String(counts[k]), px + 20, pillY + 8.5, { align:'center' });
      pdf.setFontSize(5.5); pdf.setFont('helvetica','normal');
      pdf.text(l.toUpperCase(), px + 20, pillY + 12.5, { align:'center' });
      px += 44;
    });

    // ── Section divider ──────────────────────────────────
    const div1Y = 65;
    pdf.setFillColor(...C.border); pdf.rect(M, div1Y, col, 0.5, 'F');
    pdf.setTextColor(...C.accent); pdf.setFont('helvetica','bold'); pdf.setFontSize(7);
    pdf.text('KEY RATIOS AT A GLANCE', M, div1Y + 7);

    // Top 8 ratios as horizontal bars (2-column layout)
    const KEY_RATIOS = [
      ['currentRatio','Current Ratio','x'], ['grossMargin','Gross Margin','%'],
      ['quickRatio','Quick Ratio','x'],     ['netMargin','Net Margin','%'],
      ['roe','Return on Equity','%'],       ['debtToEquity','Debt / Equity','x'],
      ['roa','Return on Assets','%'],       ['interestCoverage','Int. Coverage','x'],
    ];
    const barStartY = div1Y + 13;
    const colW = col / 2;
    KEY_RATIOS.forEach(([key, label, unit], i) => {
      const col_  = i % 2;
      const row_  = Math.floor(i / 2);
      const rx = M + col_ * (colW + 4);
      const ry = barStartY + row_ * 18;
      const val    = results.ratioValues[key];
      const status = results.statuses[key];
      const sc     = STATUS_COLOR[status] || C.muted;
      const pct    = getBarWidth(val, key, industry) / 100;

      // Label
      pdf.setTextColor(...C.body); pdf.setFont('helvetica','normal'); pdf.setFontSize(7);
      pdf.text(label, rx, ry);
      // Value right-aligned
      pdf.setTextColor(...sc); pdf.setFont('helvetica','bold'); pdf.setFontSize(7);
      pdf.text(fmt(val, unit), rx + colW - 6, ry, { align:'right' });
      // Status dot
      pdf.setFillColor(...sc); pdf.circle(rx + colW - 3.5, ry - 1.2, 1.2, 'F');
      // Bar
      drawBar(rx, ry + 2.5, colW - 8, pct, sc);
    });

    // ── AI Executive Summary ─────────────────────────────
    const sumY = barStartY + 4 * 18 + 5;
    pdf.setFillColor(...C.border); pdf.rect(M, sumY, col, 0.5, 'F');
    pdf.setTextColor(...C.accent); pdf.setFont('helvetica','bold'); pdf.setFontSize(7);
    pdf.text('EXECUTIVE SUMMARY', M, sumY + 7);

    const summaryText = aiInsights?.executive_summary
      || `${co} has a BizHealth score of ${healthScore}/100, with ${counts.green} of ${14 - counts.na} ratios in the healthy range. ` +
         `${counts.red > 0 ? counts.red + ' ratio(s) require immediate attention.' : 'No critical ratios detected at this time.'} ` +
         `Industry benchmarked against ${industry} sector standards.`;

    pdf.setTextColor(...C.body); pdf.setFont('helvetica','normal'); pdf.setFontSize(7.5);
    const lines = pdf.splitTextToSize(summaryText, col);
    pdf.text(lines.slice(0, 5), M, sumY + 14);

    // Key metrics mini-table
    if (inputs.revenue || inputs.netProfit || inputs.totalAssets || inputs.equity) {
      const metricsY = sumY + 14 + (lines.slice(0,5).length * 4) + 5;
      const metrics = [
        ['Revenue',     inputs.revenue     ? fmtBig(parseFloat(inputs.revenue))     + ' ' + cur : 'N/A'],
        ['Net Profit',  inputs.netProfit   ? fmtBig(parseFloat(inputs.netProfit))   + ' ' + cur : 'N/A'],
        ['Total Assets',inputs.totalAssets ? fmtBig(parseFloat(inputs.totalAssets)) + ' ' + cur : 'N/A'],
        ['Equity',      inputs.equity      ? fmtBig(parseFloat(inputs.equity))      + ' ' + cur : 'N/A'],
      ].filter(([,v]) => v !== 'N/A');
      const mw = metrics.length ? col / metrics.length : col;
      metrics.forEach(([label, val], mi) => {
        const mx = M + mi * mw;
        pdf.setFillColor(...C.surface); pdf.roundedRect(mx, metricsY, mw - 3, 16, 2, 2, 'F');
        pdf.setDrawColor(...C.border); pdf.setLineWidth(0.3); pdf.roundedRect(mx, metricsY, mw - 3, 16, 2, 2, 'S');
        pdf.setTextColor(...C.white); pdf.setFont('helvetica','bold'); pdf.setFontSize(9);
        pdf.text(val, mx + (mw-3)/2, metricsY + 8.5, { align:'center' });
        pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(5.5);
        pdf.text(label.toUpperCase(), mx + (mw-3)/2, metricsY + 13.5, { align:'center' });
      });
    }

    footer(1, totalPages);

    // ══════════════════════════════════════════════════════
    //  PAGE 2 — Ratio Analysis (bars for all 14 ratios)
    // ══════════════════════════════════════════════════════
    pdf.addPage(); bg(); hdr();
    pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5);
    pdf.text('BIZHEALTH  ·  RATIO ANALYSIS', M, 8);
    pdf.text(date, W - M, 8, { align:'right' });

    pdf.setTextColor(...C.white); pdf.setFont('helvetica','bold'); pdf.setFontSize(16);
    pdf.text(co + ' — Financial Ratio Dashboard', M, 27);
    pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(7.5);
    pdf.text(`Industry: ${industry.charAt(0).toUpperCase()+industry.slice(1)}  ·  Benchmarks applied  ·  ${date}`, M, 33);

    const RATIO_GROUPS = [
      { title:'LIQUIDITY', color: C.cyan, ratios: [
        ['Current Ratio','currentRatio','x'], ['Quick Ratio','quickRatio','x'], ['Cash Ratio','cashRatio','x'] ]},
      { title:'PROFITABILITY', color: C.green, ratios: [
        ['Gross Margin','grossMargin','%'], ['Operating Margin','operatingMargin','%'],
        ['Net Margin','netMargin','%'], ['Return on Equity','roe','%'], ['Return on Assets','roa','%'] ]},
      { title:'EFFICIENCY', color: C.amber, ratios: [
        ['Asset Turnover','assetTurnover','x'], ['Fixed Asset Turnover','fixedAssetTurnover','x'],
        ['Receivables Days','receivablesDays',' days'], ['Inventory Days','inventoryDays',' days'] ]},
      { title:'LEVERAGE', color: C.red, ratios: [
        ['Debt to Equity','debtToEquity','x'], ['Interest Coverage','interestCoverage','x'] ]},
    ];

    let ry2 = 40;
    RATIO_GROUPS.forEach(({ title, color, ratios }) => {
      // Group header
      pdf.setFillColor(...C.surface); pdf.rect(M, ry2, col, 7, 'F');
      pdf.setFillColor(...color); pdf.rect(M, ry2, 2.5, 7, 'F');
      pdf.setTextColor(...color); pdf.setFont('helvetica','bold'); pdf.setFontSize(7);
      pdf.text(title, M + 5, ry2 + 4.8);
      pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(6);
      pdf.text('RATIO', M + 62, ry2 + 4.8);
      pdf.text('BAND', M + 110, ry2 + 4.8);
      pdf.text('VALUE', W - M - 24, ry2 + 4.8, { align:'right' });
      pdf.text('STATUS', W - M, ry2 + 4.8, { align:'right' });
      ry2 += 9;

      ratios.forEach(([label, key, unit]) => {
        const val    = results.ratioValues[key];
        const status = results.statuses[key];
        const sc     = STATUS_COLOR[status] || C.muted;
        const pct    = getBarWidth(val, key, industry) / 100;

        // Alternating row bg
        pdf.setFillColor(8, 13, 28); pdf.rect(M, ry2 - 1, col, 9, 'F');

        // Status left strip
        pdf.setFillColor(...sc); pdf.rect(M, ry2 - 1, 1.5, 9, 'F');

        // Name
        pdf.setTextColor(...C.body); pdf.setFont('helvetica','normal'); pdf.setFontSize(7.5);
        pdf.text(label, M + 4, ry2 + 4.5);

        // Interpretation (short)
        const interp = getInterpretation(key, val, status, INDUSTRY_BENCHMARKS[industry]?.[key]?.threshold);
        pdf.setTextColor(...C.muted); pdf.setFontSize(5.5);
        const shortInterp = pdf.splitTextToSize(interp, 60)[0];
        pdf.text(shortInterp || '', M + 4, ry2 + 7.5);

        // Bar
        drawBar(M + 62, ry2 + 1.5, 68, pct, sc);

        // Value
        pdf.setTextColor(...sc); pdf.setFont('helvetica','bold'); pdf.setFontSize(8);
        pdf.text(fmt(val, unit), W - M - 14, ry2 + 4.5, { align:'right' });

        // Status badge
        const badgeBg = STATUS_COLOR[status].map(c => Math.min(255, c * 0.15));
        pdf.setFillColor(...badgeBg); pdf.roundedRect(W - M - 13, ry2 + 0.5, 13, 6, 1, 1, 'F');
        pdf.setTextColor(...sc); pdf.setFontSize(5.5);
        pdf.text(STATUS_LABEL[status], W - M - 6.5, ry2 + 4.5, { align:'center' });

        ry2 += 10;
      });
      ry2 += 3;
    });

    footer(2, totalPages);

    // ══════════════════════════════════════════════════════
    //  PAGE 3 — Historical Trend Charts (if available)
    // ══════════════════════════════════════════════════════
    if (hasHist) {
      pdf.addPage(); bg(); hdr();
      pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5);
      pdf.text('BIZHEALTH  ·  HISTORICAL TRENDS', M, 8);
      pdf.text(date, W - M, 8, { align:'right' });

      pdf.setTextColor(...C.white); pdf.setFont('helvetica','bold'); pdf.setFontSize(16);
      pdf.text(co + ' — Historical Financial Trends', M, 27);

      // Use oldest-first for display (historical may be newest-first)
      const sorted = [...incHist].reverse();
      const years  = sorted.map(y => y.year || '');

      // ── Chart 1: Revenue vs Net Income bar chart ────────
      const ch1X = M; const ch1Y = 40; const ch1W = col; const ch1H = 55;
      const revenues   = sorted.map(y => y.revenue   || 0);
      const netProfits = sorted.map(y => y.netProfit || 0);
      const allVals    = [...revenues, ...netProfits].filter(v => v !== 0);
      const maxVal     = allVals.length ? Math.max(...allVals.map(Math.abs)) : 1;

      // Chart bg + grid
      pdf.setFillColor(...C.surface); pdf.rect(ch1X, ch1Y, ch1W, ch1H, 'F');
      pdf.setDrawColor(...C.border); pdf.setLineWidth(0.3);
      // Horizontal grid lines
      for (let gi = 0; gi <= 4; gi++) {
        const gy = ch1Y + ch1H - (gi / 4) * ch1H;
        pdf.setDrawColor(...C.dim); pdf.line(ch1X + 22, gy, ch1X + ch1W, gy);
        pdf.setTextColor(...C.dim); pdf.setFont('helvetica','normal'); pdf.setFontSize(5);
        pdf.text(fmtBig(maxVal * gi / 4) + ' ' + cur, ch1X + 20, gy + 0.8, { align:'right' });
      }

      // Bars
      const n = sorted.length;
      const groupW = (ch1W - 22) / n;
      const barW2  = groupW * 0.3;
      sorted.forEach((yr, i) => {
        const gx = ch1X + 22 + i * groupW + groupW * 0.08;
        // Revenue bar
        const revH = Math.abs(yr.revenue || 0) / maxVal * ch1H;
        pdf.setFillColor(...C.accent);
        pdf.rect(gx, ch1Y + ch1H - revH, barW2, revH, 'F');
        // Net profit bar
        const npH = Math.abs(yr.netProfit || 0) / maxVal * ch1H;
        const npColor = (yr.netProfit || 0) >= 0 ? C.green : C.red;
        pdf.setFillColor(...npColor);
        pdf.rect(gx + barW2 + 1, ch1Y + ch1H - npH, barW2, npH, 'F');
        // Year label
        pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(5.5);
        pdf.text(yr.year || '', gx + barW2, ch1Y + ch1H + 3.5, { align:'center' });
      });

      // Chart 1 title + legend
      pdf.setTextColor(...C.body); pdf.setFont('helvetica','bold'); pdf.setFontSize(7.5);
      pdf.text('Revenue & Net Profit', ch1X, ch1Y - 2);
      pdf.setFillColor(...C.accent); pdf.rect(ch1X + 75, ch1Y - 4, 4, 2, 'F');
      pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(6);
      pdf.text('Revenue', ch1X + 80, ch1Y - 2.5);
      pdf.setFillColor(...C.green); pdf.rect(ch1X + 100, ch1Y - 4, 4, 2, 'F');
      pdf.text('Net Profit', ch1X + 105, ch1Y - 2.5);

      // ── Chart 2: Margin trends (Gross, Net) line-ish ────
      const ch2Y = ch1Y + ch1H + 18;
      const ch2H = 45;

      // Has gross profit data?
      const grossPs = sorted.map(y => y.grossProfit || 0);
      const hasGP   = sorted.some(y => y.grossProfit);

      pdf.setFillColor(...C.surface); pdf.rect(ch1X, ch2Y, ch1W, ch2H, 'F');

      // Compute margin %
      const grossPcts = sorted.map(y => (y.revenue && y.grossProfit) ? (y.grossProfit/y.revenue)*100 : null);
      const netPcts   = sorted.map(y => (y.revenue && y.netProfit  ) ? (y.netProfit  /y.revenue)*100 : null);
      const opPcts    = sorted.map(y => (y.revenue && y.operatingIncome) ? (y.operatingIncome/y.revenue)*100 : null);

      const ch2X      = ch1X;
      const allPcts   = [...grossPcts, ...netPcts, ...opPcts].filter(v => v !== null);
      const minPct    = allPcts.length ? Math.min(0, ...allPcts) : 0;
      const maxPct    = allPcts.length ? Math.max(30, ...allPcts) : 30;
      const pctRange  = maxPct - minPct || 1;
      const baseY     = ch2Y + ch2H - ((0 - minPct)/pctRange)*ch2H;

      // Grid
      for (let gi = 0; gi <= 4; gi++) {
        const gy = ch2Y + ch2H - (gi / 4) * ch2H;
        const gv = minPct + (gi/4)*pctRange;
        pdf.setDrawColor(...C.dim); pdf.line(ch2X + 22, gy, ch2X + ch1W, gy);
        pdf.setTextColor(...C.dim); pdf.setFont('helvetica','normal'); pdf.setFontSize(5);
        pdf.text(gv.toFixed(0) + '%', ch2X + 20, gy + 0.8, { align:'right' });
      }

      // Zero line
      pdf.setDrawColor(...C.muted); pdf.setLineWidth(0.4);
      pdf.line(ch1X + 22, baseY, ch1X + ch1W, baseY);

      // Draw margin lines using connected dots
      const drawMetricLine = (pcts, color) => {
        const pts = pcts.map((p, i) => {
          if (p === null) return null;
          const gx = ch1X + 22 + (i + 0.5) * groupW;
          const gy = ch2Y + ch2H - ((p - minPct)/pctRange)*ch2H;
          return [gx, gy];
        }).filter(Boolean);
        if (pts.length < 1) return;
        pdf.setDrawColor(...color); pdf.setLineWidth(0.8);
        for (let pi = 1; pi < pts.length; pi++) {
          pdf.line(pts[pi-1][0], pts[pi-1][1], pts[pi][0], pts[pi][1]);
        }
        pts.forEach(([px, py]) => {
          pdf.setFillColor(...color); pdf.circle(px, py, 1.2, 'F');
        });
      };
      drawMetricLine(grossPcts, C.cyan);
      drawMetricLine(opPcts,    C.accent);
      drawMetricLine(netPcts,   C.green);

      // Year labels
      sorted.forEach((yr, i) => {
        const gx = ch1X + 22 + (i + 0.5) * groupW;
        pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(5.5);
        pdf.text(yr.year || '', gx, ch2Y + ch2H + 3.5, { align:'center' });
      });

      // Chart 2 title + legend
      pdf.setTextColor(...C.body); pdf.setFont('helvetica','bold'); pdf.setFontSize(7.5);
      pdf.text('Margin Trends', ch2X, ch2Y - 2);
      [[C.cyan,'Gross %'],[C.accent,'Operating %'],[C.green,'Net %']].forEach(([clr, lbl], li) => {
        const lx = ch2X + 60 + li * 38;
        pdf.setFillColor(...clr); pdf.rect(lx, ch2Y - 4, 5, 2, 'F');
        pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(6);
        pdf.text(lbl, lx + 6, ch2Y - 2.5);
      });

      // ── Chart 3: Cash Flow mini bars ────────────────────
      const cfHist = (historical.cashflow || []).filter(y => y?.cfOps);
      if (cfHist.length >= 2) {
        const cfSorted = [...cfHist].reverse();
        const ch3Y = ch2Y + ch2H + 18;
        const ch3H = 35;
        const cfMax = Math.max(...cfSorted.map(y => Math.abs(y.cfOps || 0) + Math.abs(y.capex || 0) + 1));
        pdf.setFillColor(...C.surface); pdf.rect(ch1X, ch3Y, ch1W, ch3H, 'F');
        const cGroupW = (ch1W - 22) / cfSorted.length;
        const cBarW   = cGroupW * 0.22;

        cfSorted.forEach((yr, i) => {
          const gx    = ch1X + 22 + i * cGroupW + cGroupW * 0.05;
          const cfOH  = (Math.abs(yr.cfOps  || 0) / cfMax) * ch3H;
          const capH  = (Math.abs(yr.capex  || 0) / cfMax) * ch3H;
          const fcfH  = (Math.abs((yr.cfOps||0)+(yr.capex||0)) / cfMax) * ch3H;
          const fcfNeg= (yr.cfOps||0)+(yr.capex||0) < 0;

          pdf.setFillColor(...C.accent);  pdf.rect(gx,         ch3Y + ch3H - cfOH, cBarW, cfOH, 'F');
          pdf.setFillColor(...C.red);     pdf.rect(gx+cBarW+1, ch3Y + ch3H - capH, cBarW, capH, 'F');
          pdf.setFillColor(...(fcfNeg ? C.amber : C.green));
          pdf.rect(gx+2*(cBarW+1), ch3Y + ch3H - fcfH, cBarW, fcfH, 'F');
          pdf.setTextColor(...C.muted); pdf.setFontSize(5.5);
          pdf.text(yr.year || '', gx + cBarW, ch3Y + ch3H + 3.5, { align:'center' });
        });

        pdf.setTextColor(...C.body); pdf.setFont('helvetica','bold'); pdf.setFontSize(7.5);
        pdf.text('Cash Flow Analysis', ch1X, ch3Y - 2);
        [[C.accent,'Op. CF'],[C.red,'CapEx'],[C.green,'FCF']].forEach(([clr, lbl], li) => {
          const lx = ch1X + 75 + li * 30;
          pdf.setFillColor(...clr); pdf.rect(lx, ch3Y - 4, 4, 2, 'F');
          pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(6);
          pdf.text(lbl, lx + 5, ch3Y - 2.5);
        });
      }

      footer(3, totalPages);
    }

    // ══════════════════════════════════════════════════════
    //  PAGE — Sector Peer Comparison
    // ══════════════════════════════════════════════════════
    let currentPage = hasHist ? 4 : 3;

    if (hasPeers) {
      currentPage++;
      pdf.addPage(); bg(); hdr();
      pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5);
      pdf.text('BIZHEALTH  ·  PEER BENCHMARKING', M, 8);
      pdf.text(date, W - M, 8, { align:'right' });

      pdf.setTextColor(...C.white); pdf.setFont('helvetica','bold'); pdf.setFontSize(16);
      pdf.text(co + ' — Sector Peer Comparison', M, 27);
      pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(7.5);
      pdf.text(`Benchmarked vs ${industry.charAt(0).toUpperCase()+industry.slice(1)} peers  ·  FY2024 public data  ·  Indicative`, M, 33);

      // Table header
      const colW4 = [52, ...sectorPeers.map(() => (col - 52) / sectorPeers.length)];
      const colX4 = [M];
      colW4.slice(0,-1).forEach((w,i) => colX4.push(colX4[i] + w));

      let tr = 40;
      // Header row
      pdf.setFillColor(10, 15, 32); pdf.rect(M, tr, col, 7, 'F');
      pdf.setFillColor(...C.accent); pdf.rect(M, tr, col, 0.8, 'F');
      pdf.setTextColor(...C.muted); pdf.setFont('helvetica','bold'); pdf.setFontSize(6);
      pdf.text('METRIC', colX4[0] + 2, tr + 4.8);
      sectorPeers.forEach((p, i) => {
        const cx = colX4[i+1] + colW4[i+1]/2;
        pdf.setTextColor(...C.body);
        pdf.text(p.ticker, cx, tr + 3.2, { align:'center' });
        pdf.setTextColor(...C.muted); pdf.setFontSize(5);
        pdf.text(p.name.length > 14 ? p.name.slice(0,13)+'…' : p.name, cx, tr + 6.4, { align:'center' });
        pdf.setFontSize(6);
      });
      tr += 9;

      // Add the analysed company as first column reference
      const userLabel = tick || co.slice(0,8);
      pdf.setFillColor(...C.surface); pdf.rect(M, tr-1, col, 6, 'F');
      pdf.setTextColor(...C.cyan); pdf.setFont('helvetica','bold'); pdf.setFontSize(5.5);
      pdf.text('YOUR COMPANY →', colX4[0]+2, tr+3);
      sectorPeers.forEach((_, i) => {
        pdf.setTextColor(40,60,100); pdf.text('─', colX4[i+1]+colW4[i+1]/2, tr+3, {align:'center'});
      });
      tr += 7;

      COMPARISON_RATIOS.forEach(({ key, label, unit }, ri) => {
        const userVal = results.ratioValues[key];
        const rowBg   = ri % 2 === 0 ? [6,10,22] : [9,14,30];
        pdf.setFillColor(...rowBg); pdf.rect(M, tr-1, col, 8, 'F');

        // Label
        pdf.setTextColor(...C.body); pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5);
        pdf.text(label, colX4[0]+2, tr+4);

        // User value (highlighted)
        const sc = STATUS_COLOR[results.statuses[key]] || C.muted;
        if (userVal !== null && userVal !== undefined && !isNaN(userVal)) {
          pdf.setFillColor(...sc.map(c=>Math.min(255,c*0.18)));
          pdf.roundedRect(colX4[0]+36, tr+0.5, colX4[1]-colX4[0]-38, 6, 1, 1, 'F');
          pdf.setTextColor(...sc); pdf.setFont('helvetica','bold'); pdf.setFontSize(6.5);
          pdf.text(fmt(userVal, unit), colX4[0]+36+(colX4[1]-colX4[0]-38)/2, tr+4.5, {align:'center'});
        } else {
          pdf.setTextColor(...C.dim); pdf.text('—', colX4[0]+36+(colX4[1]-colX4[0]-38)/2, tr+4.5, {align:'center'});
        }

        sectorPeers.forEach((peer, i) => {
          const pv = peer[key];
          const cx = colX4[i+1] + colW4[i+1]/2;
          if (pv === null || pv === undefined) {
            pdf.setTextColor(...C.dim); pdf.setFont('helvetica','normal'); pdf.setFontSize(6);
            pdf.text('N/A', cx, tr+4.5, { align:'center' });
          } else {
            // Compare to user: better/worse
            const lowerBetter = ['receivablesDays','inventoryDays','debtToEquity'].includes(key);
            let indicator = null;
            if (userVal !== null && !isNaN(userVal)) {
              const diff = Math.abs(userVal - pv) / (pv || 1);
              if (diff < 0.05) indicator = C.amber;
              else if (lowerBetter ? userVal <= pv : userVal >= pv) indicator = C.green;
              else indicator = C.dim;
            }
            pdf.setTextColor(...(indicator || C.muted));
            pdf.setFont('helvetica', indicator === C.green ? 'bold' : 'normal');
            pdf.setFontSize(6.5);
            pdf.text(fmt(pv, unit), cx, tr+4.5, { align:'center' });
          }
        });
        tr += 9;
      });

      // Legend
      tr += 4;
      pdf.setTextColor(...C.green);  pdf.setFont('helvetica','bold'); pdf.setFontSize(5.5);
      pdf.text('Bold green = you are ahead of this peer', M, tr);
      pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal');
      pdf.text('  ·  N/A = not applicable for this business type  ·  Data: public annual reports FY2024', M+70, tr);

      footer(currentPage, totalPages);
    }

    // ══════════════════════════════════════════════════════
    //  PAGE — DCF Valuation Snapshot
    // ══════════════════════════════════════════════════════
    if (hasDCF) {
      currentPage++;
      pdf.addPage(); bg(); hdr();
      pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5);
      pdf.text('BIZHEALTH  ·  DCF VALUATION', M, 8);
      pdf.text(date, W - M, 8, { align:'right' });

      pdf.setTextColor(...C.white); pdf.setFont('helvetica','bold'); pdf.setFontSize(16);
      pdf.text(co + ' — DCF Valuation Snapshot', M, 27);
      pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(7.5);
      pdf.text('5-Year Unlevered DCF  ·  WACC 10%  ·  Terminal Growth 4%  ·  Blue = assumptions', M, 33);

      const wacc = 0.10; const tgr = 0.04;
      const projYrs = [1,2,3,4,5].map(i => (new Date().getFullYear() + i) + 'E');

      // Build projections
      let baseR = baseRevRaw / 1e6; // in millions
      const revP = gr.map(g => { baseR = +(baseR * (1+g)).toFixed(1); return baseR; });
      const ebitdaP = revP.map((r,i) => +(r * em[i]).toFixed(1));
      const daP     = revP.map(r => +(r * 0.02).toFixed(1));
      const capexP  = revP.map(r => +(r * 0.04).toFixed(1));
      const nwcP    = revP.map(r => +(r * 0.02).toFixed(1));
      const ebitP   = ebitdaP.map((e,i) => +(e - daP[i]).toFixed(1));
      const taxP    = ebitP.map(e => +(e * 0.21).toFixed(1));
      const nopatP  = ebitP.map((e,i) => +(e - taxP[i]).toFixed(1));
      const ufcfP   = nopatP.map((n,i) => +(n + daP[i] - capexP[i] - nwcP[i]).toFixed(1));
      const disc    = [1,2,3,4,5].map(i => +(1/(1+wacc)**i).toFixed(4));
      const pvP     = ufcfP.map((u,i) => +(u * disc[i]).toFixed(1));
      const tv      = +((ufcfP[4]*(1+tgr))/(wacc-tgr)).toFixed(1);
      const pvTv    = +(tv * disc[4]).toFixed(1);
      const sumPv   = +(pvP.reduce((a,b)=>a+b,0)).toFixed(1);
      const ev      = +(sumPv + pvTv).toFixed(1);

      const YCW = (col - 46) / 5;  // year column width
      const YX  = [M+46, M+46+YCW, M+46+2*YCW, M+46+3*YCW, M+46+4*YCW];

      let dr = 40;
      // Year header
      pdf.setFillColor(...C.border); pdf.rect(M, dr, col, 7, 'F');
      pdf.setFillColor(...C.accent); pdf.rect(M, dr, 2, 7, 'F');
      pdf.setTextColor(...C.muted); pdf.setFont('helvetica','bold'); pdf.setFontSize(6);
      pdf.text('($mm)', M+4, dr+4.8);
      projYrs.forEach((yr,i) => {
        pdf.setTextColor(...C.body); pdf.text(yr, YX[i]+YCW/2, dr+4.8, {align:'center'});
      });
      dr += 9;

      const drow = (label, vals, bold, color, isBlue) => {
        const rBg = bold ? [12,18,40] : [6,10,22];
        pdf.setFillColor(...rBg); pdf.rect(M, dr-1, col, 7, 'F');
        if (bold) { pdf.setFillColor(...C.accent); pdf.rect(M, dr-1, 1.5, 7, 'F'); }
        pdf.setTextColor(...(color || (bold ? C.white : C.body)));
        pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(bold ? 7 : 6.5);
        pdf.text(label, M+4, dr+3.8);
        vals.forEach((v,i) => {
          const tc = isBlue ? [100,140,220] : (color || (bold ? C.white : C.body));
          pdf.setTextColor(...tc);
          pdf.setFont('helvetica', (bold || isBlue) ? 'bold' : 'normal');
          pdf.text(v !== null && v !== undefined ? String(v) : '—', YX[i]+YCW/2, dr+3.8, {align:'center'});
        });
        dr += 8;
      };

      pdf.setTextColor(...C.cyan); pdf.setFont('helvetica','bold'); pdf.setFontSize(6);
      pdf.text('ASSUMPTIONS', M, dr+3); dr += 7;
      drow('  Revenue Growth Rate', gr.map(g=>(g*100).toFixed(0)+'%'), false, C.muted, true);
      drow('  EBITDA Margin',       em.map(e=>(e*100).toFixed(0)+'%'), false, C.muted, true);
      drow('  WACC / TGR',         projYrs.map(()=>'10% / 4%'), false, C.muted, true);
      dr += 3;

      pdf.setTextColor(...C.cyan); pdf.setFont('helvetica','bold'); pdf.setFontSize(6);
      pdf.text('PROJECTED FINANCIALS', M, dr+3); dr += 7;
      drow('  Revenue ($mm)',        revP,    true);
      drow('  EBITDA ($mm)',         ebitdaP, false);
      drow('  EBIT ($mm)',           ebitP,   false);
      drow('  NOPAT ($mm)',          nopatP,  false);
      drow('  Unlevered FCF ($mm)',  ufcfP,   true, C.accent);
      drow('  Discount Factor',      disc,    false, C.muted);
      drow('  PV of FCF ($mm)',      pvP,     false, C.green);
      dr += 3;

      // Valuation summary box
      pdf.setFillColor(...C.surface); pdf.roundedRect(M, dr, col, 38, 2, 2, 'F');
      pdf.setDrawColor(...C.accent); pdf.setLineWidth(0.5); pdf.roundedRect(M, dr, col, 38, 2, 2, 'S');
      pdf.setTextColor(...C.accent); pdf.setFont('helvetica','bold'); pdf.setFontSize(7);
      pdf.text('VALUATION SUMMARY', M+5, dr+7);

      const summRows = [
        ['Sum of PV (FCFs)',          '$' + sumPv.toLocaleString() + 'mm', C.body],
        ['Terminal Value (Gordon)',    '$' + tv.toLocaleString() + 'mm',   C.muted],
        ['PV of Terminal Value',       '$' + pvTv.toLocaleString() + 'mm', C.muted],
        ['Enterprise Value (DCF)',     '$' + ev.toLocaleString() + 'mm',   C.cyan],
      ];
      summRows.forEach(([lbl, val, clr], i) => {
        const sy = dr + 13 + i * 7;
        pdf.setFillColor(12, 18, 40); pdf.rect(M+3, sy-2, col-6, 6, 'F');
        pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(7);
        pdf.text(lbl, M+6, sy+2);
        pdf.setTextColor(...clr); pdf.setFont('helvetica','bold');
        pdf.text(val, M+col-4, sy+2, {align:'right'});
      });

      dr += 44;
      pdf.setTextColor(...C.dim); pdf.setFont('helvetica','normal'); pdf.setFontSize(5.5);
      const dcfNote = 'DCF based on user-provided revenue; projections use industry-standard growth and margin assumptions. This is a directional estimate, not investment advice.';
      pdf.text(pdf.splitTextToSize(dcfNote, col), M, dr);

      footer(currentPage, totalPages);
    }

    // ══════════════════════════════════════════════════════
    //  PAGE 4 (or 3) — AI Insights
    // ══════════════════════════════════════════════════════
    pdf.addPage(); bg(); hdr();
    const pgNum = currentPage + 1;
    pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5);
    pdf.text('BIZHEALTH  ·  AI INSIGHTS', M, 8);
    pdf.text(date, W - M, 8, { align:'right' });

    pdf.setTextColor(...C.white); pdf.setFont('helvetica','bold'); pdf.setFontSize(16);
    pdf.text(co + ' — AI-Driven Analysis', M, 27);
    pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(7.5);
    pdf.text('Powered by Claude AI  ·  Benchmarked to ' + industry + ' industry standards', M, 33);

    let aiY = 42;

    // ── Risks ──────────────────────────────────────────────
    const risks = aiInsights?.risks || [];
    if (risks.length) {
      pdf.setFillColor(...C.surface); pdf.rect(M, aiY, col, 7, 'F');
      pdf.setFillColor(...C.red); pdf.rect(M, aiY, 2.5, 7, 'F');
      pdf.setTextColor(...C.red); pdf.setFont('helvetica','bold'); pdf.setFontSize(7);
      pdf.text('KEY RISKS', M + 5, aiY + 4.8);
      aiY += 9;
      risks.slice(0, 4).forEach((risk, ri) => {
        pdf.setFillColor(8,13,28); pdf.rect(M, aiY, col, 0.5, 'F');
        pdf.setTextColor(...C.white); pdf.setFont('helvetica','bold'); pdf.setFontSize(7.5);
        pdf.text(`${ri+1}.  ${risk.title || ''}`, M + 3, aiY + 6);
        pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5);
        const descLines = pdf.splitTextToSize(risk.description || '', col - 6);
        pdf.text(descLines.slice(0, 2), M + 6, aiY + 10.5);
        aiY += 11 + (Math.min(descLines.length,2) - 1) * 3.5;
      });
      aiY += 4;
    }

    // ── Opportunities ──────────────────────────────────────
    const opps = aiInsights?.opportunities || [];
    if (opps.length) {
      pdf.setFillColor(...C.surface); pdf.rect(M, aiY, col, 7, 'F');
      pdf.setFillColor(...C.green); pdf.rect(M, aiY, 2.5, 7, 'F');
      pdf.setTextColor(...C.green); pdf.setFont('helvetica','bold'); pdf.setFontSize(7);
      pdf.text('OPPORTUNITIES', M + 5, aiY + 4.8);
      aiY += 9;
      opps.slice(0, 3).forEach((opp, oi) => {
        pdf.setTextColor(...C.white); pdf.setFont('helvetica','bold'); pdf.setFontSize(7.5);
        pdf.text(`${oi+1}.  ${opp.title || ''}`, M + 3, aiY + 6);
        pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5);
        const descLines = pdf.splitTextToSize(opp.description || '', col - 6);
        pdf.text(descLines.slice(0, 2), M + 6, aiY + 10.5);
        aiY += 11 + (Math.min(descLines.length,2) - 1) * 3.5;
      });
      aiY += 4;
    }

    // ── Priority Actions ───────────────────────────────────
    const actions = aiInsights?.priority_actions || [];
    if (actions.length) {
      pdf.setFillColor(...C.surface); pdf.rect(M, aiY, col, 7, 'F');
      pdf.setFillColor(...C.accent); pdf.rect(M, aiY, 2.5, 7, 'F');
      pdf.setTextColor(...C.accent); pdf.setFont('helvetica','bold'); pdf.setFontSize(7);
      pdf.text('PRIORITY ACTIONS', M + 5, aiY + 4.8);
      aiY += 9;
      actions.slice(0, 5).forEach((act, ai) => {
        const impact   = act.impact    || '';
        const timeline = act.timeline  || '';
          const abg = act.priority === 'high' ? C.red.map(c=>Math.round(c*0.15)) : C.accent.map(c=>Math.round(c*0.12));
          pdf.setFillColor(...abg);
        pdf.roundedRect(M, aiY, 5, 5, 1, 1, 'F');
        pdf.setTextColor(...(act.priority === 'high' ? C.red : C.accent)); pdf.setFont('helvetica','bold'); pdf.setFontSize(6.5);
        pdf.text(String(ai+1), M + 2.5, aiY + 3.7, { align:'center' });

        pdf.setTextColor(...C.body); pdf.setFont('helvetica','bold'); pdf.setFontSize(7.5);
        pdf.text(act.action || '', M + 7, aiY + 3.5);
        if (timeline || impact) {
          pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(6);
          pdf.text([timeline, impact].filter(Boolean).join('  ·  '), M + 7, aiY + 7);
        }
        aiY += 12;
      });
    }

    // Disclaimer
    if (aiY < H - 30) {
      aiY = Math.max(aiY, H - 38);
      pdf.setFillColor(...C.surface); pdf.rect(M, aiY, col, 18, 'F');
      pdf.setDrawColor(...C.border); pdf.setLineWidth(0.3); pdf.rect(M, aiY, col, 18, 'S');
      pdf.setTextColor(...C.amber); pdf.setFont('helvetica','bold'); pdf.setFontSize(6.5);
      pdf.text('DISCLAIMER', M + 4, aiY + 5);
      pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(6);
      const disc = 'This report is generated for informational purposes only and does not constitute financial advice. ' +
                   'Calculations are based on user-provided or publicly available data and may not reflect audited figures. ' +
                   'Always consult a qualified financial professional before making investment or business decisions.';
      pdf.text(pdf.splitTextToSize(disc, col - 8), M + 4, aiY + 10);
    }

    footer(pgNum, totalPages);

    pdf.save(`BizHealth-${co.replace(/\s+/g,'-')}-${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('PDF generation failed: ' + (err.message || err));
    }
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
    { title: 'CFA — Advanced Profitability & Capital', ratios: [
      card('ebitdaMargin',    'EBITDA Margin',       '%'),
      card('roic',            'ROIC',                '%'),
      card('equityMultiplier','Equity Multiplier',   'x'),
    ]},
    { title: 'CFA — Credit & Solvency', ratios: [
      card('debtToCapital',          'Debt / Capital',            '%'),
      card('netDebtToEbitda',        'Net Debt / EBITDA',         'x'),
      card('altmanZ',                'Altman Z-Score',            ''),
    ]},
    { title: 'CFA — Working Capital & Earnings Quality', ratios: [
      card('daysPayableOutstanding', 'Days Payable Outstanding',  ' days'),
      card('cashConversionCycle',    'Cash Conversion Cycle',     ' days'),
      card('cfoToNetIncome',         'CFO / Net Income',          'x'),
    ]},
  ];

  const allStatuses = results ? Object.values(results.statuses) : Array(14).fill('na');
  const healthScore = (() => {
    const valid = allStatuses.filter(s => s !== 'na').length;
    if (!valid) return 0;
    const pts = allStatuses.reduce((acc, s) => acc + (s === 'green' ? 2 : s === 'amber' ? 1 : 0), 0);
    return Math.round((pts / (valid * 2)) * 100);
  })();

  const hasCompany = !!(companyContext.ticker || companyContext.name);
  const today = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }).toUpperCase();

  return (
    <div className="min-h-screen page-bg flex flex-col lg:flex-row">

      {/* ── Sidebar with collapse toggle ── */}
      <div className="relative flex-shrink-0" style={{ width: sidebarOpen ? undefined : 0 }}>
        <Sidebar
          inputs={inputs} setInputs={setInputs}
          industry={industry} setIndustry={setIndustry}
          onCalculate={handleCalculate} onReset={handleReset}
          collapsed={!sidebarOpen}
          onCompanyLoaded={(ctx, hist) => {
            setCompanyContext(ctx);
            if (hist) setHistorical(hist);
          }}
        />
      </div>

      {/* ── Collapse / Expand toggle button ── */}
      <button
        onClick={() => setSidebarOpen(o => !o)}
        className="hidden lg:flex fixed top-20 z-40 items-center justify-center w-5 h-10 rounded-r-lg transition-all hover:opacity-90"
        style={{
          left: sidebarOpen ? '318px' : '0px',
          background: 'rgba(79,110,247,0.9)',
          border: '1px solid rgba(79,110,247,0.5)',
          borderLeft: 'none',
          transition: 'left 0.25s ease',
        }}
        title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"
          style={{ transform: sidebarOpen ? 'none' : 'rotate(180deg)', transition: 'transform 0.25s' }}>
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>

      <main className="flex-1 min-h-screen" style={{ marginLeft: 0 }}>

        {/* ── Terminal context bar ── */}
        {hasCompany && (
          <div className="sticky top-14 z-30 px-4 sm:px-6 lg:px-8 py-2"
            style={{
              background: 'rgba(3,7,17,0.95)',
              borderBottom: '1px solid rgba(79,110,247,0.12)',
              backdropFilter: 'blur(12px)',
            }}>
            <div className="flex items-center gap-0 overflow-x-auto"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, whiteSpace: 'nowrap' }}>
              {[
                { val: companyContext.ticker || '—',                           color: '#4f6ef7' },
                { val: companyContext.name   || '—',                           color: '#f1f5f9' },
                { val: (industry || 'general').toUpperCase(),                  color: '#9fb3d4' },
                { val: companyContext.currency || 'USD',                       color: '#22d3ee' },
                { val: today,                                                  color: '#6b82a8' },
              ].map((item, i) => (
                <span key={i} className="flex items-center">
                  {i > 0 && <span style={{ color: '#3d5070', margin: '0 8px' }}>·</span>}
                  <span style={{ color: item.color }}>{item.val}</span>
                </span>
              ))}
              {calculated && results && (
                <>
                  <span style={{ color: '#3d5070', margin: '0 8px' }}>·</span>
                  <span style={{ color: healthScore >= 70 ? '#00e887' : healthScore >= 40 ? '#fbbf24' : '#f43f5e' }}>
                    SCORE {healthScore}/100
                  </span>
                </>
              )}
            </div>
          </div>
        )}

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
