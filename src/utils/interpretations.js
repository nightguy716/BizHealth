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
  };

  if (!map[ratioKey]) return '';
  if (status === 'na') return 'Enter valid inputs to see this ratio.';
  return map[ratioKey][status] || '';
}
