/**
 * calculations.js — All ratio formulas.
 * Returns null when the denominator is zero to avoid divide-by-zero errors.
 */

// ── Liquidity ──────────────────────────────────────────────
export const calcCurrentRatio    = (ca, cl)            => cl   ? ca / cl               : null;
export const calcQuickRatio      = (ca, inv, cl)       => cl   ? (ca - inv) / cl       : null;
export const calcCashRatio       = (cash, cl)          => cl   ? cash / cl             : null;

// ── Profitability ──────────────────────────────────────────
export const calcGrossMargin     = (gp, rev)           => rev  ? (gp / rev) * 100      : null;
export const calcOperatingMargin = (gp, opex, rev)     => rev  ? ((gp - opex) / rev) * 100 : null;
export const calcNetMargin       = (np, rev)           => rev  ? (np / rev) * 100      : null;
export const calcROE             = (np, eq)            => eq   ? (np / eq) * 100       : null;
export const calcROA             = (np, ta)            => ta   ? (np / ta) * 100       : null;

// ── Efficiency ────────────────────────────────────────────
export const calcAssetTurnover      = (rev, ta)        => ta                   ? rev / ta              : null;
export const calcFixedAssetTurnover = (rev, ta, ca)    => (ta - ca) > 0        ? rev / (ta - ca)       : null;
export const calcReceivablesDays    = (rec, rev)       => rev                  ? (rec / rev) * 365     : null;
export const calcInventoryDays      = (inv, cogs)      => cogs                 ? (inv / cogs) * 365    : null;

// ── Leverage ──────────────────────────────────────────────
export const calcDebtToEquity     = (debt, eq)         => eq      ? debt / eq              : null;
export const calcInterestCoverage = (gp, opex, intExp) => intExp  ? (gp - opex) / intExp  : null;

// ─────────────────────────────────────────────────────────────
// ── CFA-Level Advanced Metrics ───────────────────────────────
// ─────────────────────────────────────────────────────────────

// EBITDA Margin — earnings before interest, tax, D&A as % of revenue
// CFA significance: removes financing/tax/accounting distortions; key for M&A, LBO, EV multiples
export const calcEbitdaMargin = (gp, opex, da, rev) => {
  if (!rev) return null;
  const ebit   = gp - opex;
  const ebitda = ebit + (da || 0);
  return (ebitda / rev) * 100;
};

// ROIC — Return on Invested Capital (CFA's gold standard for value creation)
// ROIC = NOPAT / Invested Capital,  where NOPAT ≈ EBIT × (1 − effective tax rate 21%)
// IC = Equity + Net Debt = Equity + (TotalDebt − Cash)
export const calcROIC = (gp, opex, eq, debt, cash) => {
  const ebit = gp - opex;
  if (!ebit) return null;
  const nopat = ebit * (1 - 0.21);
  const netDebt = (debt || 0) - (cash || 0);
  const ic = (eq || 0) + netDebt;
  return ic > 0 ? (nopat / ic) * 100 : null;
};

// Equity Multiplier — financial leverage component of DuPont ROE decomposition
// EM = Total Assets / Equity  →  ROE = Net Margin × Asset Turnover × EM
export const calcEquityMultiplier = (ta, eq) => (ta && eq) ? ta / eq : null;

// Debt-to-Capital — proportion of debt in total financing structure (returned as %)
// CFA: conservative solvency metric used in credit analysis
export const calcDebtToCapital = (debt, eq) => {
  const cap = (debt || 0) + (eq || 0);
  return cap ? (debt / cap) * 100 : null;
};

// Net Debt / EBITDA — the primary leverage metric in leveraged finance & credit ratings
// <2x = investment grade comfort; >4x = leveraged / high-yield territory
export const calcNetDebtToEbitda = (debt, cash, gp, opex, da) => {
  const netDebt = (debt || 0) - (cash || 0);
  const ebit    = gp - opex;
  const ebitda  = ebit + (da || 0);
  return (ebitda > 0) ? netDebt / ebitda : null;
};

// Days Payable Outstanding — how long the company takes to pay suppliers
// DPO = (Accounts Payable / COGS) × 365
export const calcDPO = (ap, cogs) => (ap && cogs) ? (ap / cogs) * 365 : null;

// Cash Conversion Cycle — the core working capital efficiency metric (CFA Level 1 & 2)
// CCC = DSO + DIO − DPO  →  negative CCC = business funded by suppliers (Amazon-style)
export const calcCCC = (rec, rev, inv, cogs, ap) => {
  if (!rev || !cogs) return null;
  const dso = (rec / rev) * 365;
  const dio = (inv / cogs) * 365;
  const dpo = ap ? (ap / cogs) * 365 : 0;
  return dso + dio - dpo;
};

// CFO / Net Income — Earnings Quality ratio (Accruals analysis, CFA Level 2)
// >1.0 = high quality earnings backed by real cash; <0.5 = significant accrual component
export const calcCfoToNetIncome = (cfo, np) => (cfo && np) ? cfo / np : null;

// Altman Z-Score (modified Z'' for private companies — no market cap required)
// Z'' = 6.56×X1 + 3.26×X2 + 6.72×X3 + 1.05×X4
//   X1 = Working Capital / Total Assets
//   X2 = Net Profit / Total Assets  (proxy for Retained Earnings / TA)
//   X3 = EBIT / Total Assets
//   X4 = Book Equity / Total Liabilities
// Z'' > 2.6: Safe | 1.1–2.6: Grey zone | < 1.1: Distress
export const calcAltmanZ = (ca, cl, ta, np, gp, opex, eq) => {
  if (!ta || ta === 0) return null;
  const wc          = ca - cl;
  const totalLiab   = ta - (eq || 0);
  const ebit        = gp - opex;
  const X1 = wc / ta;
  const X2 = np / ta;
  const X3 = ebit / ta;
  const X4 = totalLiab > 0 ? (eq || 0) / totalLiab : 0;
  return (6.56 * X1) + (3.26 * X2) + (6.72 * X3) + (1.05 * X4);
};
