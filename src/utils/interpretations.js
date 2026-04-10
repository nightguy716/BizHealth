/**
 * interpretations.js
 *
 * Returns a plain-English sentence for each ratio based on its status.
 * Green = reassurance. Amber = gentle warning. Red = specific action to take.
 * The "value" and "threshold" are passed in so the message can include real numbers.
 */

export function getInterpretation(ratioKey, value, status, threshold) {
  const v = value !== null ? Number(value).toFixed(2) : 'N/A';
  const t = threshold;

  const map = {
    currentRatio: {
      green: `Your Current Ratio of ${v} is healthy — you have more than enough short-term assets to cover your liabilities.`,
      amber: `Your Current Ratio of ${v} is close to the threshold of ${t}. Monitor your short-term obligations closely.`,
      red:   `Your Current Ratio of ${v} is below ${t} — consider reducing current liabilities or speeding up collections to avoid a cash crunch.`,
    },
    quickRatio: {
      green: `Quick Ratio of ${v} is solid — even without selling inventory, you can cover short-term debts comfortably.`,
      amber: `Quick Ratio of ${v} is borderline. Try to reduce reliance on inventory for meeting short-term obligations.`,
      red:   `Quick Ratio of ${v} is low — your business may struggle to meet short-term obligations without liquidating inventory. Improve cash collections urgently.`,
    },
    cashRatio: {
      green: `Cash Ratio of ${v} is strong — you have excellent immediate liquidity.`,
      amber: `Cash Ratio of ${v} is acceptable but thin. Consider maintaining a larger cash buffer.`,
      red:   `Cash Ratio of ${v} is below ${t} — your immediate cash reserves are insufficient. Review your cash flow and cut unnecessary short-term spending.`,
    },
    grossMargin: {
      green: `Gross Margin of ${v}% is healthy — your core business is generating strong profit before overheads.`,
      amber: `Gross Margin of ${v}% is acceptable but could be higher. Look for opportunities to reduce cost of goods or increase pricing.`,
      red:   `Gross Margin of ${v}% is below ${t}% — your production or procurement costs are eating into revenue. Renegotiate supplier contracts or review your pricing strategy.`,
    },
    netMargin: {
      green: `Net Margin of ${v}% is excellent — your business retains a healthy portion of every rupee earned.`,
      amber: `Net Margin of ${v}% is thin. Review operating expenses for areas to cut without affecting revenue.`,
      red:   `Net Margin of ${v}% is below ${t}% — your business is barely profitable after all expenses. Prioritise cost reduction and revenue growth immediately.`,
    },
    roe: {
      green: `ROE of ${v}% is strong — shareholders are getting a great return on their investment.`,
      amber: `ROE of ${v}% is moderate. Look at ways to improve profitability or optimise your equity structure.`,
      red:   `ROE of ${v}% is below ${t}% — your equity is not generating sufficient returns. Reassess capital allocation and profitability drivers.`,
    },
    roa: {
      green: `ROA of ${v}% is healthy — your assets are being used efficiently to generate profit.`,
      amber: `ROA of ${v}% is moderate. There may be underutilised assets — review asset productivity.`,
      red:   `ROA of ${v}% is below ${t}% — your assets are underperforming. Consider disposing of idle assets or boosting revenue from existing ones.`,
    },
    assetTurnover: {
      green: `Asset Turnover of ${v} is strong — your assets are generating good revenue relative to their value.`,
      amber: `Asset Turnover of ${v} is moderate. Look for ways to generate more revenue from your existing asset base.`,
      red:   `Asset Turnover of ${v} is below ${t} — your business is not using its assets efficiently to generate sales. Review capacity utilisation.`,
    },
    receivablesDays: {
      green: `Receivables Days of ${v} is excellent — customers are paying you quickly, keeping cash flow healthy.`,
      amber: `Receivables Days of ${v} is slightly high. Consider offering small early-payment discounts to speed up collections.`,
      red:   `Receivables Days of ${v} is too high — slow collections are straining your cash flow. Enforce stricter payment terms and follow up overdue invoices immediately.`,
    },
    inventoryDays: {
      green: `Inventory Days of ${v} is efficient — your stock is moving quickly with minimal holding costs.`,
      amber: `Inventory Days of ${v} is acceptable but stock is sitting longer than ideal. Review reorder points and demand forecasting.`,
      red:   `Inventory Days of ${v} is too high — excess inventory is tying up capital. Run promotions to clear stock and tighten purchasing cycles.`,
    },
    debtToEquity: {
      green: `Debt-to-Equity of ${v} is healthy — your business is not overly reliant on borrowed funds.`,
      amber: `Debt-to-Equity of ${v} is approaching the limit of ${t}. Be cautious about taking on more debt without growing equity.`,
      red:   `Debt-to-Equity of ${v} is above ${t} — your business is heavily leveraged. Focus on repaying debt and improving retained earnings before borrowing more.`,
    },
  };

  if (!map[ratioKey]) return '';
  if (status === 'na') return 'Enter valid inputs to see this ratio.';
  return map[ratioKey][status] || '';
}
