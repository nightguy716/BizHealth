/**
 * aiAnalysis.js — Smart Financial Analysis Engine
 *
 * This is a rules-based expert system that analyses all 14 ratios together
 * and generates coherent, GPT-quality insights. It identifies compound risks
 * (e.g. high debt + low coverage + thin margins = imminent distress),
 * opportunities, and specific action plans with timelines.
 *
 * When the FastAPI backend (with OpenAI) is not configured, this runs entirely
 * in the browser — no API key or internet connection needed.
 */

const RATIO_LABELS = {
  currentRatio:       'Current Ratio',
  quickRatio:         'Quick Ratio',
  cashRatio:          'Cash Ratio',
  grossMargin:        'Gross Margin',
  operatingMargin:    'Operating Margin',
  netMargin:          'Net Margin',
  roe:                'Return on Equity',
  roa:                'Return on Assets',
  assetTurnover:      'Asset Turnover',
  fixedAssetTurnover: 'Fixed Asset Turnover',
  receivablesDays:    'Receivables Days',
  inventoryDays:      'Inventory Days',
  debtToEquity:       'Debt to Equity',
  interestCoverage:   'Interest Coverage',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function redRatios(statuses)   { return Object.entries(statuses).filter(([, s]) => s === 'red').map(([k]) => k); }
function greenRatios(statuses) { return Object.entries(statuses).filter(([, s]) => s === 'green').map(([k]) => k); }
function amberRatios(statuses) { return Object.entries(statuses).filter(([, s]) => s === 'amber').map(([k]) => k); }

function label(key) { return RATIO_LABELS[key] || key; }
function fmt(v, unit='') { return v !== null && !isNaN(v) ? `${Number(v).toFixed(2)}${unit}` : 'N/A'; }

// ── Executive Summary ──────────────────────────────────────────────────────

function buildSummary(ratioValues, statuses, score, industry) {
  const reds   = redRatios(statuses);
  const greens = greenRatios(statuses);
  const total  = Object.values(statuses).filter(s => s !== 'na').length;

  const verdictPhrase =
    score >= 80 ? 'demonstrates strong overall financial health' :
    score >= 60 ? 'shows moderate financial health with room for improvement' :
    score >= 40 ? 'shows below-average financial health and requires structured action' :
                  'is in a critical financial position requiring immediate intervention';

  let summaryParts = [`Your business ${verdictPhrase} — ${greens.length} of ${total} measured ratios are in the healthy range.`];

  // Liquidity assessment
  const liqStatus = [statuses.currentRatio, statuses.quickRatio, statuses.cashRatio].filter(Boolean);
  const liqRed = liqStatus.filter(s => s === 'red').length;
  if (liqRed >= 2) {
    summaryParts.push(`Liquidity is a primary concern — multiple short-term solvency indicators are below threshold, suggesting the business could face difficulty meeting near-term obligations without intervention.`);
  } else if (liqRed === 0 && liqStatus.every(s => s === 'green')) {
    summaryParts.push(`Liquidity is a clear strength — the business can comfortably service its short-term obligations.`);
  }

  // Profitability assessment
  const profKeys = ['grossMargin', 'operatingMargin', 'netMargin'];
  const profRed = profKeys.filter(k => statuses[k] === 'red').length;
  if (profRed >= 2) {
    summaryParts.push(`Profitability margins are compressed across multiple levels, which limits the business's ability to self-fund growth or service debt from operations.`);
  } else if (profRed === 0) {
    summaryParts.push(`Profitability metrics are healthy, indicating the business is efficiently converting revenue into profit.`);
  }

  // Leverage compound risk
  if (statuses.debtToEquity === 'red' && statuses.interestCoverage === 'red') {
    summaryParts.push(`The combination of high leverage and inadequate interest coverage represents the most critical risk — this profile may limit access to further credit and could threaten financial stability if revenue dips.`);
  }

  return summaryParts.join(' ');
}

// ── Risk Identification ────────────────────────────────────────────────────

function buildRisks(ratioValues, statuses) {
  const risks = [];

  // Compound liquidity risk
  const liqRedCount = ['currentRatio','quickRatio','cashRatio'].filter(k => statuses[k] === 'red').length;
  if (liqRedCount >= 2) {
    risks.push({
      title:       'Acute Liquidity Shortage',
      description: `${liqRedCount} of 3 liquidity ratios are in the danger zone. The business may be unable to meet short-term obligations from current assets alone. This is the most time-sensitive risk.`,
      urgency:     'High',
    });
  } else if (statuses.currentRatio === 'red') {
    risks.push({
      title:       'Current Ratio Below Safety Threshold',
      description: `Current Ratio of ${fmt(ratioValues.currentRatio,'x')} suggests short-term liabilities outpace liquid assets. A sudden demand from creditors could create a cash crunch.`,
      urgency:     'High',
    });
  }

  // Debt + Coverage compound risk
  if (statuses.debtToEquity === 'red' && statuses.interestCoverage === 'red') {
    risks.push({
      title:       'High Leverage with Weak Debt Servicing',
      description: `Debt-to-Equity of ${fmt(ratioValues.debtToEquity,'x')} combined with Interest Coverage of only ${fmt(ratioValues.interestCoverage,'x')} is a classic distress signal. Any revenue decline could make interest payments unsustainable.`,
      urgency:     'High',
    });
  } else if (statuses.debtToEquity === 'red') {
    risks.push({
      title:       'Over-Leveraged Balance Sheet',
      description: `Debt-to-Equity of ${fmt(ratioValues.debtToEquity,'x')} is above the safe threshold. This limits future borrowing capacity and increases vulnerability to interest rate changes.`,
      urgency:     'Medium',
    });
  }

  // Margin compression
  if (statuses.grossMargin === 'red' && statuses.netMargin === 'red') {
    risks.push({
      title:       'Margin Compression at All Levels',
      description: `Both Gross Margin (${fmt(ratioValues.grossMargin,'%')}) and Net Margin (${fmt(ratioValues.netMargin,'%')}) are below healthy thresholds. The cost structure needs an urgent review — the business is barely retaining value from its revenue.`,
      urgency:     'High',
    });
  } else if (statuses.netMargin === 'red') {
    risks.push({
      title:       'Thin Net Profitability',
      description: `Net Margin of ${fmt(ratioValues.netMargin,'%')} leaves very little buffer. A moderate revenue dip or cost increase could push the business into loss.`,
      urgency:     'Medium',
    });
  }

  // Receivables risk
  if (statuses.receivablesDays === 'red' && ratioValues.receivablesDays !== null) {
    risks.push({
      title:       'Slow Collections Straining Cash Flow',
      description: `Customers are taking ${fmt(ratioValues.receivablesDays,' days')} on average to pay. This long receivables cycle creates a working capital gap that must be funded through borrowing or cash reserves.`,
      urgency:     ratioValues.receivablesDays > 90 ? 'High' : 'Medium',
    });
  }

  // Inventory pile-up
  if (statuses.inventoryDays === 'red' && ratioValues.inventoryDays !== null) {
    risks.push({
      title:       'Excess Inventory Tying Up Capital',
      description: `Inventory Days of ${fmt(ratioValues.inventoryDays,' days')} means stock is sitting for longer than industry norms. This ties up working capital and increases obsolescence risk.`,
      urgency:     'Medium',
    });
  }

  // ROE/ROA both red
  if (statuses.roe === 'red' && statuses.roa === 'red') {
    risks.push({
      title:       'Poor Return on Invested Capital',
      description: `ROE of ${fmt(ratioValues.roe,'%')} and ROA of ${fmt(ratioValues.roa,'%')} suggest the business is not generating adequate returns on either equity or assets. This will deter future investors.`,
      urgency:     'Medium',
    });
  }

  // Return top 3 by urgency
  const urgencyOrder = { High: 0, Medium: 1, Low: 2 };
  return risks.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]).slice(0, 3);
}

// ── Opportunity Identification ─────────────────────────────────────────────

function buildOpportunities(ratioValues, statuses) {
  const opps = [];

  if (statuses.grossMargin === 'green' && (statuses.netMargin === 'amber' || statuses.netMargin === 'red')) {
    opps.push({
      title:       'Strong Gross Margin — Overhead Reduction Opportunity',
      description: `Your Gross Margin of ${fmt(ratioValues.grossMargin,'%')} is healthy, meaning core operations are profitable. The gap to net profitability is in overheads — a 10–15% reduction in operating expenses could significantly improve net margin without touching your core business model.`,
      impact:      'High',
    });
  }

  if (statuses.assetTurnover === 'green') {
    opps.push({
      title:       'High Asset Productivity — Leverage for Growth',
      description: `Asset Turnover of ${fmt(ratioValues.assetTurnover,'x')} shows your assets generate strong revenue. This is a foundation for scaling — adding capacity incrementally could drive revenue growth without proportionally increasing asset base.`,
      impact:      'Medium',
    });
  }

  if (statuses.debtToEquity === 'green' && statuses.currentRatio === 'green') {
    opps.push({
      title:       'Clean Balance Sheet — Ready for Strategic Borrowing',
      description: `Low leverage and strong liquidity give you significant borrowing headroom. This is an opportunity to access growth capital at favourable rates for expansion, equipment, or market entry.`,
      impact:      'High',
    });
  }

  if (statuses.receivablesDays === 'red' || statuses.receivablesDays === 'amber') {
    opps.push({
      title:       'Collections Optimisation — Unlock Hidden Cash Flow',
      description: `Reducing Receivables Days from ${fmt(ratioValues.receivablesDays,' days')} to under 45 days could release significant working capital without any new revenue. Implement early-payment incentives and automated reminders.`,
      impact:      'High',
    });
  }

  if (statuses.inventoryDays === 'red' || statuses.inventoryDays === 'amber') {
    opps.push({
      title:       'Inventory Optimisation — Free Up Working Capital',
      description: `Moving Inventory Days from ${fmt(ratioValues.inventoryDays,' days')} toward the healthy range could free up substantial capital currently locked in stock. Implement demand-led procurement and consider consignment models with key suppliers.`,
      impact:      'Medium',
    });
  }

  if (statuses.roa === 'amber' || statuses.roa === 'red') {
    opps.push({
      title:       'Asset Monetisation Potential',
      description: `With ROA at ${fmt(ratioValues.roa,'%')}, there may be underperforming or idle assets. Leasing out unused space, equipment, or IP could generate additional income from the existing asset base with no new investment.`,
      impact:      'Medium',
    });
  }

  const impactOrder = { High: 0, Medium: 1, Low: 2 };
  return opps.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]).slice(0, 3);
}

// ── Priority Actions ───────────────────────────────────────────────────────

function buildActions(ratioValues, statuses, score) {
  const actions = [];
  const reds  = redRatios(statuses);
  const ambers = amberRatios(statuses);

  // Immediate actions for red ratios
  if (statuses.currentRatio === 'red' || statuses.quickRatio === 'red') {
    actions.push({
      action:          'Convene an emergency cash flow review — map every liability due in the next 90 days against cash inflows.',
      timeline:        'This week',
      expected_impact: 'Prevent a cash crunch and identify the exact funding gap.',
    });
  }

  if (statuses.receivablesDays === 'red' || statuses.receivablesDays === 'amber') {
    actions.push({
      action:          `Contact your top 10 debtors and offer a 2% discount for settlement within 7 days. Implement auto-reminders on Day 30, 45, and 60 going forward.`,
      timeline:        'Next 2 weeks',
      expected_impact: `Could reduce Receivables Days from ${fmt(ratioValues.receivablesDays,' days')} to under 50 days, freeing up cash.`,
    });
  }

  if (statuses.inventoryDays === 'red') {
    actions.push({
      action:          'Run a clearance promotion on your bottom 20% of SKUs by velocity. Negotiate consignment terms with your top 3 suppliers for slow-moving categories.',
      timeline:        'Next 30 days',
      expected_impact: 'Reduces capital locked in inventory and improves cash conversion cycle.',
    });
  }

  if (statuses.grossMargin === 'red' || statuses.grossMargin === 'amber') {
    actions.push({
      action:          'Conduct a full cost-of-goods audit. Identify the top 3 cost drivers and open renegotiation with key suppliers. Benchmark your pricing against 3 competitors.',
      timeline:        'Next 45 days',
      expected_impact: `Every 1% improvement in Gross Margin drops directly to operating profit.`,
    });
  }

  if (statuses.debtToEquity === 'red') {
    actions.push({
      action:          'Freeze all non-essential capital expenditure. Allocate 20% of monthly net profit to debt principal repayment, prioritising highest-interest facilities first.',
      timeline:        'Starting next month',
      expected_impact: `Gradually reduce Debt-to-Equity from ${fmt(ratioValues.debtToEquity,'x')} toward the ${statuses.debtToEquity === 'red' ? '1.5x' : '1.0x'} target.`,
    });
  }

  if (statuses.operatingMargin === 'red' || statuses.operatingMargin === 'amber') {
    actions.push({
      action:          'Map every operating expense line as % of revenue. Identify the top 3 controllable overhead items and set a specific reduction target for each over the next quarter.',
      timeline:        'Next quarter',
      expected_impact: 'Improving Operating Margin by 3–5% materially boosts net profit without any revenue increase.',
    });
  }

  if (statuses.interestCoverage === 'red') {
    actions.push({
      action:          'Meet your bank relationship manager to explore refinancing high-interest short-term debt into longer-tenure term loans. This reduces monthly debt service and improves coverage ratio.',
      timeline:        'Next 30 days',
      expected_impact: `Extend maturities and reduce the interest burden to bring Interest Coverage above 2.5x.`,
    });
  }

  // Generic action if everything is mostly green
  if (reds.length === 0 && ambers.length <= 2) {
    actions.push({
      action:          'Your financials are strong. Begin preparing a detailed Information Memorandum — document your financial health story to leverage it for better credit terms or growth funding.',
      timeline:        'Next 60 days',
      expected_impact: 'Unlocks access to institutional credit or growth capital at significantly better rates.',
    });
  }

  actions.push({
    action:          'Set up a monthly financial health review cadence — track these 14 ratios every month end. Assign ownership of each KPI to a specific team member.',
    timeline:        'Ongoing — start this month',
    expected_impact: 'Early detection of deterioration before it becomes a crisis. Best-in-class SMEs do this quarterly at minimum.',
  });

  return actions.slice(0, 5);
}

// ── Industry Context ───────────────────────────────────────────────────────

function buildIndustryContext(ratioValues, statuses, score, industry) {
  const industryNotes = {
    tech:          'Technology businesses are evaluated on growth durability, operating leverage, and cash conversion. Strong margins with disciplined receivables and sustainable ROIC usually separate resilient performers from narrative-only growth.',
    healthcare:    'Healthcare businesses are benchmarked on margin resilience, compliance-driven cost control, and predictable cash generation. Inventory discipline and receivables quality are especially important in pharma, diagnostics, and provider models.',
    finance:       'Financial businesses are judged on balance-sheet strength, leverage discipline, and earnings stability across cycles. Debt servicing capacity and return consistency are more critical than headline growth alone.',
    retail:        'Retail businesses typically operate on thin margins (5–15% gross) but compensate with high asset turnover. Fast inventory movement and tight receivables management are the key levers.',
    manufacturing: 'Manufacturing SMEs carry higher fixed asset bases and longer working capital cycles. The critical metrics are Gross Margin quality, Inventory Days, and Debt-to-Equity to ensure the business can weather cyclical downturns.',
    services:      'Services businesses should maintain very high gross margins (40%+) since they have low COGS. The key differentiators are revenue quality (receivables management) and return on equity.',
    saas:          'Technology and SaaS businesses are judged primarily on growth quality, gross margin (target 60%+), and cash efficiency. High receivables days are more tolerable given the recurring revenue nature.',
    general:       'Without a specific industry context, your ratios are benchmarked against broad SME averages. For more precise benchmarking, select your industry from the dropdown.',
  };
  const baseNote = industryNotes[industry] || industryNotes.general;
  const redCount = redRatios(statuses).length;
  const contextScore = redCount === 0 ? 'above-average' : redCount <= 2 ? 'around-average' : 'below-average';
  return `${baseNote} Based on this analysis, your business is performing at ${contextScore} levels relative to your sector peers.`;
}

// ── Main Export ────────────────────────────────────────────────────────────

export function analyzeFinancials(ratioValues, statuses, score, industry) {
  const reds = redRatios(statuses);

  return {
    executive_summary:  buildSummary(ratioValues, statuses, score, industry),
    health_verdict:     score >= 80 ? 'Strong' : score >= 60 ? 'Moderate' : score >= 40 ? 'Below Average' : 'Critical',
    top_risks:          buildRisks(ratioValues, statuses),
    top_opportunities:  buildOpportunities(ratioValues, statuses),
    priority_actions:   buildActions(ratioValues, statuses, score),
    industry_context:   buildIndustryContext(ratioValues, statuses, score, industry),
  };
}
