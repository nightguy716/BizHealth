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
export const calcDebtToEquity    = (debt, eq)          => eq   ? debt / eq             : null;
export const calcInterestCoverage = (gp, opex, intExp) => intExp ? (gp - opex) / intExp : null;
