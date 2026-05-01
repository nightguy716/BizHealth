/**
 * App.jsx — Root component.
 * Orchestrates state, calculations, PDF export, and the full page layout.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';

/* ── URL share helpers ──────────────────────────────────────── */
function encodeShare(payload) {
  try {
    const json = JSON.stringify(payload);
    // URL-safe base64
    return btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch { return null; }
}
function decodeShare(str) {
  try {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch { return null; }
}

function toChartSymbol(raw) {
  let t = String(raw || '').trim().toUpperCase();
  if (!t) return 'NYSE:SLB';
  if (t.startsWith('NSE:') || t.startsWith('BSE:') || t.startsWith('NYSE:') || t.startsWith('NASDAQ:')) return t;
  if (t.endsWith('.NS')) return `NSE:${t.replace('.NS', '')}`;
  if (t.endsWith('.BO')) return `BSE:${t.replace('.BO', '')}`;
  return `NYSE:${t}`;
}

import Sidebar          from '../components/Sidebar';
import SummaryBanner    from '../components/SummaryBanner';
import RatioGroup       from '../components/RatioGroup';
import RatioTableView   from '../components/RatioTableView';
import HistoricalCharts from '../components/HistoricalCharts';
import DuPontTree       from '../components/DuPontTree';
import EarningsQuality  from '../components/EarningsQuality';
import ValuationLab        from '../components/ValuationLab';
import ScenarioComparison  from '../components/ScenarioComparison';
import RelativeValuation   from '../components/RelativeValuation';
import BankReadiness    from '../components/BankReadiness';
import SectorComparison from '../components/SectorComparison';
import AIInsights       from '../components/AIInsights';
import { FinAxisLockup } from '../components/FinAxisLogo';
import TourOverlay, { useShouldShowTour } from '../components/TourOverlay';
import { ownerHeaders } from '../lib/ownerHeaders';
import { getBackendBaseUrl } from '../lib/backendUrl';

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
  const location  = useLocation();
  const navigate  = useNavigate();

  const [inputs,          setInputs]          = useState(EMPTY_INPUTS);
  const [industry,        setIndustry]        = useState('general');
  const [results,         setResults]         = useState(null);
  const [calculated,      setCalculated]      = useState(false);
  const [companyContext,  setCompanyContext]   = useState({ name: '', ticker: '', currency: 'INR', isListed: false, sector: '', marketData: {} });
  const [historical,      setHistorical]      = useState({ income: [], balance: [] });
  const [aiInsights,      setAiInsights]      = useState(null);
  const [exporting,       setExporting]       = useState(false);
  const [sidebarOpen,     setSidebarOpen]     = useState(() => localStorage.getItem('bh_sidebar') !== 'closed');
  const [mobileOpen,      setMobileOpen]      = useState(false);
  const [showTour,        setShowTour]        = useState(() => useShouldShowTour());
  const [viewMode,        setViewMode]        = useState('cards'); // 'cards' | 'table'
  const [shareCopied,     setShareCopied]     = useState(false);
  const [isSharedView,    setIsSharedView]    = useState(false);
  const resultsRef = useRef(null);

  /* ── Load shared analysis from URL ?s= param ── */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const s = params.get('s');
    if (!s) return;
    const payload = decodeShare(s);
    if (!payload) return;
    if (payload.inputs)         setInputs(p => ({ ...EMPTY_INPUTS, ...payload.inputs }));
    if (payload.industry)       setIndustry(payload.industry);
    if (payload.companyContext) setCompanyContext(p => ({ ...p, ...payload.companyContext }));
    setIsSharedView(true);
    // auto-calculate after state settles (200ms is safe even on slow connections)
    setTimeout(() => { calculateRef.current?.(); }, 200);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Deep-link company load from ?symbol=TICKER ── */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const s = params.get('s');
    const symbol = (params.get('symbol') || '').trim();
    const prefillName = (params.get('name') || '').trim();
    if (s || !symbol) return;
    const backend = getBackendBaseUrl();
    if (!backend) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${backend}/company/yf/${encodeURIComponent(symbol)}`, {
          headers: ownerHeaders(),
        });
        if (!res.ok) return;
        const d = await res.json();
        if (cancelled) return;
        if (d?.data && typeof d.data === 'object') setInputs((p) => ({ ...p, ...d.data }));
        if (d?.industry && INDUSTRY_BENCHMARKS[d.industry]) setIndustry(d.industry);
        setCompanyContext({
          name: d?.name || prefillName || symbol,
          ticker: d?.ticker || symbol.toUpperCase(),
          currency: d?.currency || 'USD',
          isListed: true,
          sector: d?.sector || '',
          marketData: d?.market_data || {},
        });
        if (d?.historical) setHistorical(d.historical);
        setTimeout(() => { calculateRef.current?.(); }, 200);
      } catch {
        // silent fail, dashboard still opens
      }
    })();
    return () => { cancelled = true; };
  }, [location.search]);

  const calculateRef = useRef(null);
  /* Keep calculateRef current after every render so the URL-load effect can call it */
  useEffect(() => { calculateRef.current = handleCalculate; });

  /* ── Share handler ── */
  const handleShare = useCallback(() => {
    const payload = { inputs, industry, companyContext };
    const encoded = encodeShare(payload);
    if (!encoded) return;
    const url = `${window.location.origin}/dashboard?s=${encoded}`;
    navigator.clipboard?.writeText(url).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    }).catch(() => {
      // fallback: prompt
      window.prompt('Copy this link:', url);
    });
  }, [inputs, industry, companyContext]);

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
    setCompanyContext({ name: '', ticker: '', currency: 'INR', isListed: false, sector: '', marketData: {} });
  }

  async function handleExportExcel() {
    if (!results) return;
    const backendUrl = getBackendBaseUrl();
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
      const co   = companyContext.name || 'Valoreva';
      a.href     = url;
      a.download = `Valoreva-${co.replace(/\s+/g,'-')}-Analysis.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Excel export failed: ' + e.message);
    } finally {
      setExporting(false);
    }
  }

  async function handleExportPDF() {
    if (!results) return;
    try {
    async function renderFinAxisMarkPng(sizePx = 72, strokeColor = '#FFFFFF') {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 48 48" fill="none">
          <path d="M24 6c5.5 0 10 4.5 10 10v3h-8v-3a2 2 0 0 0-4 0v8h-8v-8c0-5.5 4.5-10 10-10Z" stroke="${strokeColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M10 24c0-5.5 4.5-10 10-10h2v8h-2a2 2 0 0 0 0 4h8v8h-8c-5.5 0-10-4.5-10-10Z" stroke="${strokeColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M24 42c-5.5 0-10-4.5-10-10v-3h8v3a2 2 0 0 0 4 0v-8h8v8c0 5.5-4.5 10-10 10Z" stroke="${strokeColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M38 24c0 5.5-4.5 10-10 10h-2v-8h2a2 2 0 0 0 0-4h-8v-8h8c5.5 0 10 4.5 10 10Z" stroke="${strokeColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M15 31l5-7 5 4 8-10" stroke="#F2C94C" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="33" cy="18" r="1.8" fill="#F2C94C"/>
        </svg>
      `.trim();
      const encoded = encodeURIComponent(svg);
      const url = `data:image/svg+xml;charset=utf-8,${encoded}`;
      return await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = sizePx;
          c.height = sizePx;
          const ctx = c.getContext('2d');
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0, sizePx, sizePx);
          resolve(c.toDataURL('image/png'));
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });
    }

    const brandMarkPng = await renderFinAxisMarkPng(72, '#FFFFFF');
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
    const prettyKey = k => String(k || '').replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

    // ── Helpers ───────────────────────────────────────────
    const bg  = () => { pdf.setFillColor(...C.bg); pdf.rect(0,0,W,H,'F'); };
    const hdr = () => {
      pdf.setFillColor(...C.accent);
      pdf.rect(0, 0, W, 1.5, 'F');
      pdf.setFillColor(...C.bg);
      pdf.rect(0, 1.5, W, 10, 'F');
      pdf.setFillColor(15,22,48);
      pdf.rect(0, 11, W, 1, 'F');
      if (brandMarkPng) {
        pdf.addImage(brandMarkPng, 'PNG', W - M - 46.5, 3.1, 7.2, 7.2);
      }
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      const wordX = W - M - 38.5;
      pdf.setTextColor(...C.white);
      pdf.text('Valo', wordX, 8.4);
      const finW = pdf.getTextWidth('Valo');
      pdf.setTextColor(...C.amber);
      pdf.text('reva', wordX + finW, 8.4);
    };
    const footer = (page, total) => {
      pdf.setFillColor(...C.dim);
      pdf.rect(0, H - 10, W, 10, 'F');
      pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5);
      pdf.text('Valoreva Financial Intelligence  ·  For informational purposes only  ·  biz-health.vercel.app', M, H - 4);
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
    const peersForPdf = sectorPeers.filter(p =>
      COMPARISON_RATIOS.some(({ key }) => p?.[key] !== null && p?.[key] !== undefined && !isNaN(p?.[key]))
    );
    const hasPeers    = peersForPdf.length > 0;

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
    let pageNo = 1;

    // ══════════════════════════════════════════════════════
    //  PAGE 1 — Executive Dashboard
    // ══════════════════════════════════════════════════════
    bg(); hdr();

    // Header strip text
    pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5);
    pdf.text('VALOREVA  ·  FINANCIAL INTELLIGENCE', M, 8);
    pdf.text(date, W - M, 8, { align:'right' });

    // Company name (width-limited to avoid overlap with score ring)
    const companyMaxW = W - (M + 58) - M;
    const coLine = (pdf.splitTextToSize(co, companyMaxW)[0] || co);
    pdf.setTextColor(...C.white); pdf.setFont('helvetica','bold'); pdf.setFontSize(20);
    pdf.text(coLine, M, 30);
    if (companyContext.ticker) {
      pdf.setTextColor(...C.cyan); pdf.setFontSize(9); pdf.setFont('helvetica','normal');
      pdf.text(companyContext.ticker + (companyContext.sector ? '  ·  ' + companyContext.sector : ''), M, 37);
    }

    // ── Score ring (drawn arcs) ──────────────────────────
    // Position tuned to avoid overlap with company title and top header lockup.
    const cx = W - M - 25; const cy = 33; const rr = 16.5;
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
      || `${co} has a Valoreva score of ${healthScore}/100, with ${counts.green} of ${14 - counts.na} ratios in the healthy range. ` +
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

    footer(pageNo, totalPages);

    // ══════════════════════════════════════════════════════
    //  PAGE 2 — Ratio Analysis (bars for all 14 ratios)
    // ══════════════════════════════════════════════════════
    pdf.addPage(); pageNo += 1; bg(); hdr();
    pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5);
    pdf.text('VALOREVA  ·  RATIO ANALYSIS', M, 8);
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

    footer(pageNo, totalPages);

    // ══════════════════════════════════════════════════════
    //  PAGE 3 — Historical Trend Charts (if available)
    // ══════════════════════════════════════════════════════
    if (hasHist) {
      pdf.addPage(); pageNo += 1; bg(); hdr();
      pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5);
      pdf.text('VALOREVA  ·  HISTORICAL TRENDS', M, 8);
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

      footer(pageNo, totalPages);
    }

    // ══════════════════════════════════════════════════════
    //  PAGE — Sector Peer Comparison
    // ══════════════════════════════════════════════════════
    if (hasPeers) {
      pdf.addPage(); pageNo += 1; bg(); hdr();
      pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5);
      pdf.text('VALOREVA  ·  PEER BENCHMARKING', M, 8);
      pdf.text(date, W - M, 8, { align:'right' });

      pdf.setTextColor(...C.white); pdf.setFont('helvetica','bold'); pdf.setFontSize(16);
      pdf.text(co + ' — Sector Peer Comparison', M, 27);
      pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(7.5);
      pdf.text(`Benchmarked vs ${industry.charAt(0).toUpperCase()+industry.slice(1)} peers  ·  FY2024 public data  ·  Indicative`, M, 33);

      // Table header
      const colW4 = [52, ...peersForPdf.map(() => (col - 52) / peersForPdf.length)];
      const colX4 = [M];
      colW4.slice(0,-1).forEach((w,i) => colX4.push(colX4[i] + w));

      let tr = 40;
      // Header row
      pdf.setFillColor(10, 15, 32); pdf.rect(M, tr, col, 7, 'F');
      pdf.setFillColor(...C.accent); pdf.rect(M, tr, col, 0.8, 'F');
      pdf.setTextColor(...C.muted); pdf.setFont('helvetica','bold'); pdf.setFontSize(6);
      pdf.text('METRIC', colX4[0] + 2, tr + 4.8);
      peersForPdf.forEach((p, i) => {
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
      peersForPdf.forEach((_, i) => {
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

        peersForPdf.forEach((peer, i) => {
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

      footer(pageNo, totalPages);
    }

    // ══════════════════════════════════════════════════════
    //  PAGE — DCF Valuation Snapshot
    // ══════════════════════════════════════════════════════
    if (hasDCF) {
      pdf.addPage(); pageNo += 1; bg(); hdr();
      pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5);
      pdf.text('VALOREVA  ·  DCF VALUATION', M, 8);
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

      footer(pageNo, totalPages);
    }

    // ══════════════════════════════════════════════════════
    //  PAGE 4 (or 3) — AI Insights
    // ══════════════════════════════════════════════════════
    pdf.addPage(); pageNo += 1; bg(); hdr();
    pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5);
    pdf.text('VALOREVA  ·  AI INSIGHTS', M, 8);
    pdf.text(date, W - M, 8, { align:'right' });

    pdf.setTextColor(...C.white); pdf.setFont('helvetica','bold'); pdf.setFontSize(16);
    pdf.text(co + ' — AI-Driven Analysis', M, 27);
    pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(7.5);
    pdf.text('Powered by Claude AI  ·  Benchmarked to ' + industry + ' industry standards', M, 33);

    let aiY = 42;
    const aiSummary =
      aiInsights?.executive_summary
      || `${co} scores ${healthScore}/100 in ${industry} benchmarks with ${counts.green} healthy, ${counts.amber} borderline, and ${counts.red} critical ratio signals.`;
    const aiIndustryContext =
      aiInsights?.industry_context
      || `This profile is benchmarked against ${industry} peers. Focus should remain on ratio trend consistency, cash conversion quality, and leverage resilience.`;

    const fallbackRiskRows = Object.entries(results.statuses)
      .filter(([, s]) => s === 'red' || s === 'amber')
      .slice(0, 4)
      .map(([k, s]) => ({
        title: `${prettyKey(k)} ${s === 'red' ? 'risk' : 'watchpoint'}`,
        description: getInterpretation(k, results.ratioValues[k], s, INDUSTRY_BENCHMARKS[industry]?.[k]?.threshold),
      }));
    const fallbackOppRows = Object.entries(results.statuses)
      .filter(([, s]) => s === 'green')
      .slice(0, 3)
      .map(([k]) => ({
        title: `${prettyKey(k)} strength`,
        description: `${prettyKey(k)} is currently in the healthy range and can support valuation confidence if sustained.`,
      }));
    const fallbackActionRows = Object.entries(results.statuses)
      .filter(([, s]) => s === 'red' || s === 'amber')
      .slice(0, 5)
      .map(([k]) => ({
        action: RECOMMENDATIONS[k] || `Improve ${prettyKey(k)} with a time-bound operating action plan.`,
        timeline: 'Next 30 days',
        expected_impact: `Stabilise ${prettyKey(k)} toward industry-compliant levels.`,
      }));

    // ── Executive Summary (always rendered) ─────────────────
    pdf.setFillColor(...C.surface); pdf.rect(M, aiY, col, 7, 'F');
    pdf.setFillColor(...C.accent); pdf.rect(M, aiY, 2.5, 7, 'F');
    pdf.setTextColor(...C.accent); pdf.setFont('helvetica','bold'); pdf.setFontSize(7);
    pdf.text('EXECUTIVE SUMMARY', M + 5, aiY + 4.8);
    aiY += 9;
    pdf.setTextColor(...C.body); pdf.setFont('helvetica','normal'); pdf.setFontSize(6.8);
    const summaryLines = pdf.splitTextToSize(aiSummary, col - 6);
    pdf.text(summaryLines.slice(0, 6), M + 3, aiY + 4.5);
    aiY += 8 + Math.min(summaryLines.length, 6) * 3.5;

    pdf.setTextColor(...C.muted); pdf.setFont('helvetica','normal'); pdf.setFontSize(6.3);
    const ctxLines = pdf.splitTextToSize(aiIndustryContext, col - 6);
    pdf.text(ctxLines.slice(0, 4), M + 3, aiY + 4);
    aiY += 6 + Math.min(ctxLines.length, 4) * 3.4;

    // ── Risks ──────────────────────────────────────────────
    const risks = (aiInsights?.top_risks || aiInsights?.risks || fallbackRiskRows);
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
    const opps = (aiInsights?.top_opportunities || aiInsights?.opportunities || fallbackOppRows);
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
    const actions = (aiInsights?.priority_actions || fallbackActionRows);
    if (actions.length) {
      pdf.setFillColor(...C.surface); pdf.rect(M, aiY, col, 7, 'F');
      pdf.setFillColor(...C.accent); pdf.rect(M, aiY, 2.5, 7, 'F');
      pdf.setTextColor(...C.accent); pdf.setFont('helvetica','bold'); pdf.setFontSize(7);
      pdf.text('PRIORITY ACTIONS', M + 5, aiY + 4.8);
      aiY += 9;
      actions.slice(0, 5).forEach((act, ai) => {
        const impact   = act.expected_impact || act.impact || '';
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

    footer(pageNo, totalPages);

    pdf.save(`Valoreva-${co.replace(/\s+/g,'-')}-${new Date().toISOString().slice(0,10)}.pdf`);
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
  const chartSymbol = toChartSymbol(companyContext.ticker);
  const today = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }).toUpperCase();

  const sidebarProps = {
    inputs, setInputs, industry, setIndustry, onReset: handleReset,
    onCompanyLoaded: (ctx, hist) => {
      setCompanyContext(ctx);
      if (hist) setHistorical(hist);
    },
  };

  return (
    <div className="min-h-screen page-bg flex flex-col lg:flex-row">

      {/* ══ DESKTOP sidebar ══════════════════════════════════ */}
      <div data-tour="sidebar" className="relative flex-shrink-0 hidden lg:block" style={{ width: sidebarOpen ? undefined : 0 }}>
        <Sidebar
          {...sidebarProps}
          onCalculate={handleCalculate}
          collapsed={!sidebarOpen}
        />
      </div>

      {/* ── Desktop collapse / expand toggle ── */}
      <button
        onClick={() => setSidebarOpen(o => {
          const next = !o;
          localStorage.setItem('bh_sidebar', next ? 'open' : 'closed');
          return next;
        })}
        className="hidden lg:flex fixed top-20 z-40 items-center justify-center w-5 h-8 rounded-r"
        style={{
          left: sidebarOpen ? '318px' : '0px',
          background: 'var(--surface-hi)',
          border: '1px solid #243354',
          borderLeft: 'none',
          transition: 'left 0.25s ease',
        }}
        title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.5"
          style={{ transform: sidebarOpen ? 'none' : 'rotate(180deg)', transition: 'transform 0.25s' }}>
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>

      {/* ══ MOBILE bottom-sheet drawer ═══════════════════════ */}
      <div className={`lg:hidden fixed inset-0 z-50 ${mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        {/* Backdrop */}
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            background: 'rgba(10,13,20,0.85)',
            opacity: mobileOpen ? 1 : 0,
          }}
          onClick={() => setMobileOpen(false)}
        />
        {/* Drawer slides up from bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 rounded-t-2xl overflow-hidden flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{
            height: '88vh',
            transform: mobileOpen ? 'translateY(0)' : 'translateY(100%)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderBottom: 'none',
          }}>
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
          </div>
          <Sidebar
            {...sidebarProps}
            mobile
            onClose={() => setMobileOpen(false)}
            onCalculate={() => { handleCalculate(); setMobileOpen(false); }}
          />
        </div>
      </div>

      {/* ══ MOBILE FAB ═══════════════════════════════════════ */}
      <button
        className="lg:hidden fixed z-40 flex items-center gap-2 font-semibold text-xs text-white transition-all"
        style={{
          bottom: 20,
          right: 20,
          background: 'var(--gold)',
          borderRadius: 4,
          padding: '10px 16px',
        }}
        onClick={() => setMobileOpen(true)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <path d="M8 21h8M12 17v4"/>
        </svg>
        {calculated ? 'Edit Inputs' : 'Enter Financials'}
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
            <div className="flex items-center gap-0 overflow-x-auto scrollbar-none"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, whiteSpace: 'nowrap', scrollbarWidth: 'none' }}>
              {[
                { val: companyContext.ticker || '—',                           color: 'var(--gold)', isTicker: true },
                { val: companyContext.name   || '—',                           color: '#f1f5f9' },
                { val: (industry || 'general').toUpperCase(),                  color: 'var(--text-3)' },
                { val: companyContext.currency || 'USD',                       color: '#22d3ee' },
                { val: today,                                                  color: 'var(--text-4)' },
              ].map((item, i) => (
                <span key={i} className="flex items-center">
                  {i > 0 && <span style={{ color: 'var(--text-5)', margin: '0 8px' }}>·</span>}
                  {item.isTicker && companyContext.ticker ? (
                    <Link
                      to={`/charts?symbol=${encodeURIComponent(chartSymbol)}`}
                      style={{ color: item.color, textDecoration: 'none', borderBottom: '1px dotted rgba(200,157,31,0.45)' }}
                      title="Open advanced chart"
                    >
                      {item.val}
                    </Link>
                  ) : (
                    <span style={{ color: item.color }}>{item.val}</span>
                  )}
                </span>
              ))}
              {companyContext.ticker && (
                <>
                  <span style={{ color: 'var(--text-5)', margin: '0 8px' }}>·</span>
                  <Link
                    to={`/charts?symbol=${encodeURIComponent(chartSymbol)}`}
                    style={{
                      color: 'var(--text-2)',
                      textDecoration: 'none',
                      border: '1px solid rgba(255,255,255,0.18)',
                      padding: '2px 7px',
                      borderRadius: 4,
                      fontSize: 10,
                    }}
                  >
                    OPEN CHART
                  </Link>
                </>
              )}
              {calculated && results && (
                <>
                  <span style={{ color: 'var(--text-5)', margin: '0 8px' }}>·</span>
                  <span style={{ color: healthScore >= 70 ? '#00e887' : healthScore >= 40 ? '#fbbf24' : '#f43f5e' }}>
                    SCORE {healthScore}/100
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 lg:pb-8" ref={resultsRef}>

          {/* ── Welcome state ── */}
          {!calculated && (
            <div className="flex flex-col items-center justify-center min-h-[80vh] text-center select-none">
              {/* Brand lockup */}
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full blur-2xl" style={{ background:'radial-gradient(circle, rgba(79,110,247,0.28) 0%, transparent 72%)', transform:'scale(2.6)' }} />
                <div className="relative">
                  <FinAxisLockup
                    size={34}
                    gap={14}
                    markSize={74}
                    finColor="var(--text-1)"
                    axisColor="var(--gold)"
                    markColor="var(--text-1)"
                  />
                </div>
              </div>
              <p className="mono text-[11px] font-bold uppercase tracking-widest mb-6" style={{ color:'rgba(34,211,238,0.45)' }}>
                Financial Intelligence Platform · v3.0
              </p>

              {/* Mobile: tap to open inputs */}
              <div className="lg:hidden w-full max-w-sm mb-6">
                <button
                  onClick={() => setMobileOpen(true)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all"
                  style={{
                    background: 'rgba(79,110,247,0.08)',
                    border: '1px solid rgba(79,110,247,0.28)',
                  }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f6ef7" strokeWidth="2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <span className="mono text-sm" style={{ color: 'var(--text-4)' }}>Search a company or enter financials…</span>
                </button>
              </div>

              <p className="text-sm max-w-md leading-relaxed mb-2 hidden lg:block" style={{ color: 'var(--text-2)' }}>
                Enter your financials, or use <span style={{ color:'var(--gold-hi)' }}>Demo Data</span> in the sidebar for instant results.
              </p>
              <p className="text-sm max-w-xs leading-relaxed mb-2 lg:hidden" style={{ color: 'var(--text-4)' }}>
                Tap <strong style={{ color: 'var(--gold-hi)' }}>Enter Financials</strong> below to search a company or enter your own numbers.
              </p>
              <p className="mono text-[10px] mb-10" style={{ color: 'var(--text-4)' }}>14 RATIOS · AI ENGINE · BANK READINESS · SECTOR COMPARISON · PDF</p>

              {/* Status legend */}
              <div className="flex items-center gap-6 text-[11px]">
                {[['#00e887','Healthy'],['#fbbf24','Borderline'],['#f43f5e','Critical']].map(([c,l]) => (
                  <div key={l} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background:c, boxShadow:`0 0 6px ${c}` }} />
                    <span className="mono text-[11px]" style={{ color: 'var(--text-3)' }}>{l}</span>
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
                onShare={handleShare}
                shareCopied={shareCopied}
                isSharedView={isSharedView}
                companyContext={companyContext}
              />

              {/* ── View toggle ── */}
              <div className="flex items-center justify-between mb-6">
                <span className="mono text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: 'var(--text-4)' }}>
                  {GROUPS.reduce((a, g) => a + g.ratios.length, 0)} RATIOS COMPUTED
                </span>
                <div className="flex items-center gap-1 p-1 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {[
                    { id: 'cards', icon: (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                      </svg>), label: 'Cards' },
                    { id: 'table', icon: (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 10h18M3 14h18M10 3v18M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z"/>
                      </svg>), label: 'Table' },
                  ].map(({ id, icon, label }) => (
                    <button key={id} onClick={() => setViewMode(id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150"
                      style={viewMode === id
                        ? { background: 'rgba(79,110,247,0.2)', color: 'var(--gold-hi)', border: '1px solid rgba(79,110,247,0.35)' }
                        : { background: 'transparent', color: 'var(--text-4)', border: '1px solid transparent' }}>
                      {icon}{label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Card view ── */}
              {viewMode === 'cards' && (() => {
                let idx = 0;
                return GROUPS.map(g => {
                  const start = idx;
                  idx += g.ratios.length;
                  return <RatioGroup key={g.title} title={g.title} ratios={g.ratios} startIndex={start} />;
                });
              })()}

              {/* ── Table view ── */}
              {viewMode === 'table' && (
                <div className="mb-10">
                  <RatioTableView groups={GROUPS} />
                </div>
              )}

              {/* ── Historical trend charts ── */}
              {(historical.income?.length >= 2 || historical.balance?.length >= 2) && (
                <HistoricalCharts
                  historical={historical}
                  currency={companyContext.currency || 'USD'}
                />
              )}

              {/* ── DuPont decomposition tree ── */}
              <DuPontTree ratioValues={results.ratioValues} inputs={inputs} />

              {/* ── Earnings quality flags ── */}
              <EarningsQuality
                ratioValues={results.ratioValues}
                inputs={inputs}
                historical={historical}
              />

              {/* ── Valuation Lab (Sensitivity + What-If) ── */}
              <ValuationLab
                inputs={inputs}
                industry={industry}
                ratioValues={results.ratioValues}
              />

              {/* ── Scenario comparison (Bear / Base / Bull) ── */}
              <ScenarioComparison
                inputs={inputs}
                ratioValues={results.ratioValues}
              />

              {/* ── Relative valuation comps ── */}
              <RelativeValuation
                companyContext={companyContext}
                inputs={inputs}
                industry={industry}
              />

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

              <div className="text-center text-[11px] mt-8 pb-8" style={{ color: 'var(--text-5)' }}>
                Valoreva · {new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })} · For informational purposes only
              </div>
            </>
          )}
        </div>
      </main>

      {showTour && (
        <TourOverlay onDone={() => setShowTour(false)} />
      )}
    </div>
  );
}
