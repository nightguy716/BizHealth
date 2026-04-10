/**
 * calculations.js
 *
 * All 11 ratio formulas live here. Each function takes the raw input values
 * and returns a number (the calculated ratio). Keeping all math in one place
 * makes it easy to audit, test, or swap in a backend later.
 */

export function calcCurrentRatio(currentAssets, currentLiabilities) {
  if (!currentLiabilities || currentLiabilities === 0) return null;
  return currentAssets / currentLiabilities;
}

export function calcQuickRatio(currentAssets, inventory, currentLiabilities) {
  if (!currentLiabilities || currentLiabilities === 0) return null;
  return (currentAssets - inventory) / currentLiabilities;
}

export function calcCashRatio(cash, currentLiabilities) {
  if (!currentLiabilities || currentLiabilities === 0) return null;
  return cash / currentLiabilities;
}

export function calcGrossMargin(grossProfit, revenue) {
  if (!revenue || revenue === 0) return null;
  return (grossProfit / revenue) * 100;
}

export function calcNetMargin(netProfit, revenue) {
  if (!revenue || revenue === 0) return null;
  return (netProfit / revenue) * 100;
}

export function calcROE(netProfit, equity) {
  if (!equity || equity === 0) return null;
  return (netProfit / equity) * 100;
}

export function calcROA(netProfit, totalAssets) {
  if (!totalAssets || totalAssets === 0) return null;
  return (netProfit / totalAssets) * 100;
}

export function calcAssetTurnover(revenue, totalAssets) {
  if (!totalAssets || totalAssets === 0) return null;
  return revenue / totalAssets;
}

export function calcReceivablesDays(receivables, revenue) {
  if (!revenue || revenue === 0) return null;
  return (receivables / revenue) * 365;
}

export function calcInventoryDays(inventory, cogs) {
  if (!cogs || cogs === 0) return null;
  return (inventory / cogs) * 365;
}

export function calcDebtToEquity(totalDebt, equity) {
  if (!equity || equity === 0) return null;
  return totalDebt / equity;
}
