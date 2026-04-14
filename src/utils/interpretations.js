/**
 * interpretations.js — Plain-English sentences per ratio per status.
 */

export function getInterpretation(ratioKey, value, status, threshold) {
  const v = value !== null && !isNaN(value) ? Number(value).toFixed(2) : 'N/A';

  const map = {
    currentRatio: {
      green: `Current Ratio of ${v} — you have more than enough short-term assets to cover your liabilities. Your liquidity is solid.`,
      amber: `Current Ratio of ${v} is close to the healthy threshold of ${threshold}. Keep an eye on short-term obligations.`,
      red:   `Current Ratio of ${v} is below ${threshold} — your business may face short-term cash pressure. Reduce current liabilities or speed up collections.`,
    },
    quickRatio: {
      green: `Quick Ratio of ${v} — even without selling inventory, you can comfortably cover short-term debts.`,
      amber: `Quick Ratio of ${v} is borderline. Try to reduce dependence on inventory for meeting short-term obligations.`,
      red:   `Quick Ratio of ${v} is low — you may struggle to meet short-term obligations without liquidating inventory.`,
    },
    cashRatio: {
      green: `Cash Ratio of ${v} — excellent immediate liquidity. Your cash reserves are in great shape.`,
      amber: `Cash Ratio of ${v} is acceptable but thin. Consider building a slightly larger cash buffer.`,
      red:   `Cash Ratio of ${v} is below ${threshold} — your immediate cash reserves are insufficient. Review your cash flow urgently.`,
    },
    grossMargin: {
      green: `Gross Margin of ${v}% — strong core profitability before overheads. Your pricing and cost control are working.`,
      amber: `Gross Margin of ${v}% is acceptable but below the ideal ${threshold}%. Look for ways to reduce cost of goods or adjust pricing.`,
      red:   `Gross Margin of ${v}% is too low — production or procurement costs are eating into revenue. Renegotiate supplier contracts immediately.`,
    },
    operatingMargin: {
      green: `Operating Margin of ${v}% — your business efficiently converts revenue into operating profit after running costs.`,
      amber: `Operating Margin of ${v}% is thin. Review your operating expenses for reduction opportunities without impacting output.`,
      red:   `Operating Margin of ${v}% is below ${threshold}% — your operating costs are too high relative to revenue. Cut overhead costs urgently.`,
    },
    netMargin: {
      green: `Net Margin of ${v}% — excellent. Your business retains a healthy portion of every rupee earned after all expenses.`,
      amber: `Net Margin of ${v}% is thin. Review operating expenses and tax planning to improve bottom-line retention.`,
      red:   `Net Margin of ${v}% is below ${threshold}% — barely profitable after all expenses. Prioritise cost reduction and revenue growth.`,
    },
    roe: {
      green: `ROE of ${v}% — shareholders are getting strong returns on their investment.`,
      amber: `ROE of ${v}% is moderate. Look at improving profitability or optimising your equity structure.`,
      red:   `ROE of ${v}% is below ${threshold}% — your equity is not generating sufficient returns. Reassess capital allocation.`,
    },
    roa: {
      green: `ROA of ${v}% — your assets are being used efficiently to generate profit.`,
      amber: `ROA of ${v}% is moderate. There may be underutilised assets worth reviewing.`,
      red:   `ROA of ${v}% is below ${threshold}% — assets are underperforming. Consider disposing of idle assets or boosting revenue from existing ones.`,
    },
    assetTurnover: {
      green: `Asset Turnover of ${v} — strong. Your assets are generating good revenue relative to their value.`,
      amber: `Asset Turnover of ${v} is moderate. Explore ways to generate more revenue from your existing asset base.`,
      red:   `Asset Turnover of ${v} is below ${threshold} — your assets are not generating enough sales. Review capacity utilisation.`,
    },
    fixedAssetTurnover: {
      green: `Fixed Asset Turnover of ${v} — your fixed assets (equipment, property) are generating strong revenue.`,
      amber: `Fixed Asset Turnover of ${v} is moderate. Check if any fixed assets are underutilised or idle.`,
      red:   `Fixed Asset Turnover of ${v} is below ${threshold} — your fixed assets are not pulling their weight. Consider lease vs. own decisions.`,
    },
    receivablesDays: {
      green: `Receivables Days of ${v} — customers are paying quickly. Your cash flow benefits from fast collections.`,
      amber: `Receivables Days of ${v} is slightly long. Consider early-payment incentives to speed up collections.`,
      red:   `Receivables Days of ${v} is too high — slow collections are hurting cash flow. Enforce stricter payment terms and follow up overdue invoices now.`,
    },
    inventoryDays: {
      green: `Inventory Days of ${v} — your stock moves quickly with minimal holding costs. Efficient supply chain.`,
      amber: `Inventory Days of ${v} is acceptable but stock is sitting longer than ideal. Review reorder points and demand forecasting.`,
      red:   `Inventory Days of ${v} is too high — excess inventory is tying up capital. Run promotions to clear stock and tighten purchasing cycles.`,
    },
    debtToEquity: {
      green: `Debt-to-Equity of ${v} — your business is not overly reliant on borrowed funds. Healthy leverage.`,
      amber: `Debt-to-Equity of ${v} is approaching ${threshold}. Be cautious about taking on more debt without growing equity.`,
      red:   `Debt-to-Equity of ${v} is above ${threshold} — heavily leveraged. Focus on repaying debt and improving retained earnings before borrowing more.`,
    },
    interestCoverage: {
      green: `Interest Coverage of ${v} — your operating profit comfortably covers your interest payments. Lenders will be comfortable.`,
      amber: `Interest Coverage of ${v} is borderline. If earnings dip, meeting interest payments could become stressful.`,
      red:   `Interest Coverage of ${v} is below ${threshold} — your business is struggling to service its debt. Reduce borrowing or improve operating profit immediately.`,
    },

    // ── CFA Advanced ───────────────────────────────────────
    ebitdaMargin: {
      green: `EBITDA Margin of ${v}% — strong pre-interest, pre-tax cash generation. This is the metric bankers and PE firms care most about for deal structuring.`,
      amber: `EBITDA Margin of ${v}% is acceptable but below the ${threshold}% benchmark. Operating cost efficiency needs attention before this business is M&A-ready.`,
      red:   `EBITDA Margin of ${v}% is weak — the business generates little cash before financing costs. This severely limits debt capacity and valuation multiples.`,
    },
    roic: {
      green: `ROIC of ${v}% — the business is creating genuine economic value above its cost of capital. This is the hallmark of a high-quality compounder.`,
      amber: `ROIC of ${v}% is near the cost of capital threshold. Value creation is marginal — focus on capital efficiency and margin improvement.`,
      red:   `ROIC of ${v}% — the business is destroying economic value. Every dollar of capital deployed earns below the cost of that capital. Restructuring or divestment may be warranted.`,
    },
    equityMultiplier: {
      green: `Equity Multiplier of ${v} — moderate financial leverage. DuPont: ROE is driven more by operational performance than debt.`,
      amber: `Equity Multiplier of ${v} signals rising leverage. ROE is increasingly amplified by debt — which cuts both ways in downturns.`,
      red:   `Equity Multiplier of ${v} is high — the business is heavily debt-financed. ROE may look attractive, but underlying operational returns are being masked by leverage.`,
    },
    debtToCapital: {
      green: `Debt-to-Capital of ${v}% — well within investment-grade comfort zone. Financing is predominantly equity-backed.`,
      amber: `Debt-to-Capital of ${v}% is approaching the threshold where credit agencies begin to flag leverage concerns.`,
      red:   `Debt-to-Capital of ${v}% — the capital structure is majority debt. This is typical of leveraged buyouts but risky for organic operations.`,
    },
    netDebtToEbitda: {
      green: `Net Debt/EBITDA of ${v}x — below ${threshold}x, the business can comfortably service and repay its debt within 2-3 years of EBITDA. Investment-grade territory.`,
      amber: `Net Debt/EBITDA of ${v}x is in the "watch zone." Lenders will begin applying covenants. Focus on EBITDA growth and debt reduction simultaneously.`,
      red:   `Net Debt/EBITDA of ${v}x is above ${threshold}x — high-yield / distressed territory. Debt repayment horizon exceeds 4 years of EBITDA. Immediate deleveraging required.`,
    },
    daysPayableOutstanding: {
      green: `DPO of ${v} days — the business is efficiently using supplier credit as a low-cost funding source. Contributes positively to the Cash Conversion Cycle.`,
      amber: `DPO of ${v} days is below optimal. There may be room to negotiate better payment terms with suppliers to improve working capital.`,
      red:   `DPO of ${v} days is very short — the business is paying suppliers too quickly. Renegotiate terms to 30-60 days to unlock working capital.`,
    },
    cashConversionCycle: {
      green: `CCC of ${v} days — excellent working capital management. Cash is cycling back quickly (or suppliers are effectively funding operations).`,
      amber: `CCC of ${v} days is moderate. Tighten receivables collection and review inventory turns to reduce the cash-to-cash cycle.`,
      red:   `CCC of ${v} days is long — significant capital is trapped in working capital. Accelerate collections, reduce inventory, and extend payables to free up cash.`,
    },
    cfoToNetIncome: {
      green: `CFO/NI of ${v} — earnings quality is high. Cash from operations exceeds reported profit, indicating low accruals and real economic profit.`,
      amber: `CFO/NI of ${v} is below 1. Reported profits are partly accrual-based and not fully backed by operating cash. Monitor closely.`,
      red:   `CFO/NI of ${v} — reported earnings significantly exceed cash generation. This is a classic earnings quality red flag. Investigate revenue recognition and receivables build-up.`,
    },
    altmanZ: {
      green: `Altman Z-Score of ${v} is above 2.6 — the business is in the safe zone with low probability of financial distress within 2 years.`,
      amber: `Altman Z-Score of ${v} (1.1–2.6) is in the grey zone — some financial stress indicators present. Monitor liquidity and leverage closely.`,
      red:   `Altman Z-Score of ${v} is below 1.1 — distress zone. Altman's model predicts a meaningful probability of financial difficulty. Address solvency and liquidity urgently.`,
    },
  };

  if (!map[ratioKey]) return '';
  if (status === 'na') return 'Enter valid inputs to see this ratio.';
  return map[ratioKey][status] || '';
}
