/**
 * benchmarks.js
 *
 * Healthy thresholds per ratio, by industry.
 * direction: 'higher' = higher value is better | 'lower' = lower value is better
 * getStatus() returns 'green', 'amber', 'red', or 'na'
 */

const BASE = {
  // ── Core 14 ──────────────────────────────────────────────
  currentRatio:        { threshold: 1.5,  direction: 'higher' },
  quickRatio:          { threshold: 1.0,  direction: 'higher' },
  cashRatio:           { threshold: 0.5,  direction: 'higher' },
  grossMargin:         { threshold: 30,   direction: 'higher' },
  operatingMargin:     { threshold: 15,   direction: 'higher' },
  netMargin:           { threshold: 10,   direction: 'higher' },
  roe:                 { threshold: 15,   direction: 'higher' },
  roa:                 { threshold: 5,    direction: 'higher' },
  assetTurnover:       { threshold: 1.0,  direction: 'higher' },
  fixedAssetTurnover:  { threshold: 2.0,  direction: 'higher' },
  receivablesDays:     { threshold: 45,   direction: 'lower'  },
  inventoryDays:       { threshold: 60,   direction: 'lower'  },
  debtToEquity:        { threshold: 1.5,  direction: 'lower'  },
  interestCoverage:    { threshold: 3.0,  direction: 'higher' },
  // ── CFA Advanced ─────────────────────────────────────────
  ebitdaMargin:        { threshold: 15,   direction: 'higher' }, // EBITDA / Revenue %
  roic:                { threshold: 10,   direction: 'higher' }, // NOPAT / Invested Capital %
  equityMultiplier:    { threshold: 3.0,  direction: 'lower'  }, // TA / Equity (leverage)
  debtToCapital:       { threshold: 0.5,  direction: 'lower'  }, // Debt / (Debt + Equity)
  netDebtToEbitda:     { threshold: 2.5,  direction: 'lower'  }, // Net Debt / EBITDA (key LevFin metric)
  daysPayableOutstanding:{ threshold: 45, direction: 'higher' }, // Higher = better working capital mgmt
  cashConversionCycle: { threshold: 45,   direction: 'lower'  }, // DSO + DIO − DPO (days)
  cfoToNetIncome:      { threshold: 1.0,  direction: 'higher' }, // Cash quality ratio
  altmanZ:             { threshold: 2.6,  direction: 'higher' }, // Z'' > 2.6 = safe zone
};

const CFA_BASE = {
  ebitdaMargin:          { threshold: 15,   direction: 'higher' },
  roic:                  { threshold: 10,   direction: 'higher' },
  equityMultiplier:      { threshold: 3.0,  direction: 'lower'  },
  debtToCapital:         { threshold: 0.5,  direction: 'lower'  },
  netDebtToEbitda:       { threshold: 2.5,  direction: 'lower'  },
  daysPayableOutstanding:{ threshold: 45,   direction: 'higher' },
  cashConversionCycle:   { threshold: 45,   direction: 'lower'  },
  cfoToNetIncome:        { threshold: 1.0,  direction: 'higher' },
  altmanZ:               { threshold: 2.6,  direction: 'higher' },
};

export const INDUSTRY_BENCHMARKS = {
  general: { label: 'General / Other', ...BASE },
  tech: {
    label: 'Technology',
    currentRatio:          { threshold: 2.0,  direction: 'higher' },
    quickRatio:            { threshold: 1.8,  direction: 'higher' },
    cashRatio:             { threshold: 1.0,  direction: 'higher' },
    grossMargin:           { threshold: 55,   direction: 'higher' },
    operatingMargin:       { threshold: 20,   direction: 'higher' },
    netMargin:             { threshold: 18,   direction: 'higher' },
    roe:                   { threshold: 25,   direction: 'higher' },
    roa:                   { threshold: 10,   direction: 'higher' },
    assetTurnover:         { threshold: 0.7,  direction: 'higher' },
    fixedAssetTurnover:    { threshold: 6.0,  direction: 'higher' },
    receivablesDays:       { threshold: 55,   direction: 'lower'  },
    inventoryDays:         { threshold: 20,   direction: 'lower'  },
    debtToEquity:          { threshold: 0.8,  direction: 'lower'  },
    interestCoverage:      { threshold: 8.0,  direction: 'higher' },
    ebitdaMargin:          { threshold: 30,   direction: 'higher' },
    roic:                  { threshold: 20,   direction: 'higher' },
    equityMultiplier:      { threshold: 2.5,  direction: 'lower'  },
    debtToCapital:         { threshold: 0.4,  direction: 'lower'  },
    netDebtToEbitda:       { threshold: 1.5,  direction: 'lower'  },
    daysPayableOutstanding:{ threshold: 40,   direction: 'higher' },
    cashConversionCycle:   { threshold: 30,   direction: 'lower'  },
    cfoToNetIncome:        { threshold: 1.1,  direction: 'higher' },
    altmanZ:               { threshold: 2.6,  direction: 'higher' },
  },
  healthcare: {
    label: 'Healthcare',
    currentRatio:          { threshold: 1.8,  direction: 'higher' },
    quickRatio:            { threshold: 1.2,  direction: 'higher' },
    cashRatio:             { threshold: 0.7,  direction: 'higher' },
    grossMargin:           { threshold: 55,   direction: 'higher' },
    operatingMargin:       { threshold: 18,   direction: 'higher' },
    netMargin:             { threshold: 14,   direction: 'higher' },
    roe:                   { threshold: 18,   direction: 'higher' },
    roa:                   { threshold: 7,    direction: 'higher' },
    assetTurnover:         { threshold: 0.6,  direction: 'higher' },
    fixedAssetTurnover:    { threshold: 2.5,  direction: 'higher' },
    receivablesDays:       { threshold: 50,   direction: 'lower'  },
    inventoryDays:         { threshold: 40,   direction: 'lower'  },
    debtToEquity:          { threshold: 1.0,  direction: 'lower'  },
    interestCoverage:      { threshold: 6.0,  direction: 'higher' },
    ebitdaMargin:          { threshold: 22,   direction: 'higher' },
    roic:                  { threshold: 12,   direction: 'higher' },
    equityMultiplier:      { threshold: 3.0,  direction: 'lower'  },
    debtToCapital:         { threshold: 0.45, direction: 'lower'  },
    netDebtToEbitda:       { threshold: 2.0,  direction: 'lower'  },
    daysPayableOutstanding:{ threshold: 50,   direction: 'higher' },
    cashConversionCycle:   { threshold: 60,   direction: 'lower'  },
    cfoToNetIncome:        { threshold: 1.0,  direction: 'higher' },
    altmanZ:               { threshold: 2.6,  direction: 'higher' },
  },
  finance: {
    label: 'Financial Services',
    currentRatio:          { threshold: 1.2,  direction: 'higher' },
    quickRatio:            { threshold: 1.0,  direction: 'higher' },
    cashRatio:             { threshold: 0.5,  direction: 'higher' },
    grossMargin:           { threshold: 60,   direction: 'higher' },
    operatingMargin:       { threshold: 25,   direction: 'higher' },
    netMargin:             { threshold: 20,   direction: 'higher' },
    roe:                   { threshold: 12,   direction: 'higher' },
    roa:                   { threshold: 1.5,  direction: 'higher' },
    assetTurnover:         { threshold: 0.1,  direction: 'higher' },
    fixedAssetTurnover:    { threshold: 2.0,  direction: 'higher' },
    receivablesDays:       { threshold: 30,   direction: 'lower'  },
    inventoryDays:         { threshold: 5,    direction: 'lower'  },
    debtToEquity:          { threshold: 5.0,  direction: 'lower'  },
    interestCoverage:      { threshold: 2.0,  direction: 'higher' },
    ebitdaMargin:          { threshold: 30,   direction: 'higher' },
    roic:                  { threshold: 8,    direction: 'higher' },
    equityMultiplier:      { threshold: 8.0,  direction: 'lower'  },
    debtToCapital:         { threshold: 0.7,  direction: 'lower'  },
    netDebtToEbitda:       { threshold: 4.0,  direction: 'lower'  },
    daysPayableOutstanding:{ threshold: 30,   direction: 'higher' },
    cashConversionCycle:   { threshold: 20,   direction: 'lower'  },
    cfoToNetIncome:        { threshold: 1.0,  direction: 'higher' },
    altmanZ:               { threshold: 2.6,  direction: 'higher' },
  },
  retail: {
    label: 'Retail',
    currentRatio:          { threshold: 1.2,  direction: 'higher' },
    quickRatio:            { threshold: 0.5,  direction: 'higher' },
    cashRatio:             { threshold: 0.3,  direction: 'higher' },
    grossMargin:           { threshold: 20,   direction: 'higher' },
    operatingMargin:       { threshold: 8,    direction: 'higher' },
    netMargin:             { threshold: 5,    direction: 'higher' },
    roe:                   { threshold: 15,   direction: 'higher' },
    roa:                   { threshold: 5,    direction: 'higher' },
    assetTurnover:         { threshold: 1.5,  direction: 'higher' },
    fixedAssetTurnover:    { threshold: 3.0,  direction: 'higher' },
    receivablesDays:       { threshold: 20,   direction: 'lower'  },
    inventoryDays:         { threshold: 45,   direction: 'lower'  },
    debtToEquity:          { threshold: 1.5,  direction: 'lower'  },
    interestCoverage:      { threshold: 3.0,  direction: 'higher' },
    ebitdaMargin:          { threshold: 8,    direction: 'higher' },
    roic:                  { threshold: 10,   direction: 'higher' },
    equityMultiplier:      { threshold: 3.5,  direction: 'lower'  },
    debtToCapital:         { threshold: 0.5,  direction: 'lower'  },
    netDebtToEbitda:       { threshold: 2.5,  direction: 'lower'  },
    daysPayableOutstanding:{ threshold: 40,   direction: 'higher' },
    cashConversionCycle:   { threshold: 25,   direction: 'lower'  },
    cfoToNetIncome:        { threshold: 1.0,  direction: 'higher' },
    altmanZ:               { threshold: 2.6,  direction: 'higher' },
  },
  manufacturing: {
    label: 'Manufacturing',
    currentRatio:          { threshold: 1.5,  direction: 'higher' },
    quickRatio:            { threshold: 0.8,  direction: 'higher' },
    cashRatio:             { threshold: 0.4,  direction: 'higher' },
    grossMargin:           { threshold: 20,   direction: 'higher' },
    operatingMargin:       { threshold: 10,   direction: 'higher' },
    netMargin:             { threshold: 8,    direction: 'higher' },
    roe:                   { threshold: 12,   direction: 'higher' },
    roa:                   { threshold: 4,    direction: 'higher' },
    assetTurnover:         { threshold: 0.8,  direction: 'higher' },
    fixedAssetTurnover:    { threshold: 1.5,  direction: 'higher' },
    receivablesDays:       { threshold: 50,   direction: 'lower'  },
    inventoryDays:         { threshold: 75,   direction: 'lower'  },
    debtToEquity:          { threshold: 2.0,  direction: 'lower'  },
    interestCoverage:      { threshold: 2.5,  direction: 'higher' },
    ebitdaMargin:          { threshold: 12,   direction: 'higher' },
    roic:                  { threshold: 8,    direction: 'higher' },
    equityMultiplier:      { threshold: 3.5,  direction: 'lower'  },
    debtToCapital:         { threshold: 0.55, direction: 'lower'  },
    netDebtToEbitda:       { threshold: 3.0,  direction: 'lower'  },
    daysPayableOutstanding:{ threshold: 55,   direction: 'higher' },
    cashConversionCycle:   { threshold: 70,   direction: 'lower'  },
    cfoToNetIncome:        { threshold: 1.0,  direction: 'higher' },
    altmanZ:               { threshold: 2.6,  direction: 'higher' },
  },
  services: {
    label: 'Services',
    currentRatio:          { threshold: 1.3,  direction: 'higher' },
    quickRatio:            { threshold: 1.2,  direction: 'higher' },
    cashRatio:             { threshold: 0.6,  direction: 'higher' },
    grossMargin:           { threshold: 40,   direction: 'higher' },
    operatingMargin:       { threshold: 20,   direction: 'higher' },
    netMargin:             { threshold: 12,   direction: 'higher' },
    roe:                   { threshold: 18,   direction: 'higher' },
    roa:                   { threshold: 7,    direction: 'higher' },
    assetTurnover:         { threshold: 1.2,  direction: 'higher' },
    fixedAssetTurnover:    { threshold: 5.0,  direction: 'higher' },
    receivablesDays:       { threshold: 60,   direction: 'lower'  },
    inventoryDays:         { threshold: 15,   direction: 'lower'  },
    debtToEquity:          { threshold: 1.0,  direction: 'lower'  },
    interestCoverage:      { threshold: 4.0,  direction: 'higher' },
    ...CFA_BASE,
  },
  saas: {
    label: 'SaaS / Tech',
    currentRatio:          { threshold: 2.0,  direction: 'higher' },
    quickRatio:            { threshold: 1.5,  direction: 'higher' },
    cashRatio:             { threshold: 1.0,  direction: 'higher' },
    grossMargin:           { threshold: 60,   direction: 'higher' },
    operatingMargin:       { threshold: 18,   direction: 'higher' },
    netMargin:             { threshold: 15,   direction: 'higher' },
    roe:                   { threshold: 20,   direction: 'higher' },
    roa:                   { threshold: 8,    direction: 'higher' },
    assetTurnover:         { threshold: 0.8,  direction: 'higher' },
    fixedAssetTurnover:    { threshold: 8.0,  direction: 'higher' },
    receivablesDays:       { threshold: 60,   direction: 'lower'  },
    inventoryDays:         { threshold: 10,   direction: 'lower'  },
    debtToEquity:          { threshold: 0.8,  direction: 'lower'  },
    interestCoverage:      { threshold: 5.0,  direction: 'higher' },
    ebitdaMargin:          { threshold: 25,   direction: 'higher' },
    roic:                  { threshold: 18,   direction: 'higher' },
    equityMultiplier:      { threshold: 2.5,  direction: 'lower'  },
    debtToCapital:         { threshold: 0.35, direction: 'lower'  },
    netDebtToEbitda:       { threshold: 1.0,  direction: 'lower'  },
    daysPayableOutstanding:{ threshold: 40,   direction: 'higher' },
    cashConversionCycle:   { threshold: 25,   direction: 'lower'  },
    cfoToNetIncome:        { threshold: 1.2,  direction: 'higher' },
    altmanZ:               { threshold: 2.6,  direction: 'higher' },
  },
};

export function getStatus(value, ratioKey, industry = 'general') {
  if (value === null || value === undefined || isNaN(value)) return 'na';
  const bench = INDUSTRY_BENCHMARKS[industry]?.[ratioKey] || INDUSTRY_BENCHMARKS.general[ratioKey];
  if (!bench) return 'na';
  const { threshold, direction } = bench;
  const buffer = threshold * 0.2;

  if (direction === 'higher') {
    if (value >= threshold)          return 'green';
    if (value >= threshold - buffer) return 'amber';
    return 'red';
  } else {
    if (value <= threshold)          return 'green';
    if (value <= threshold + buffer) return 'amber';
    return 'red';
  }
}

/**
 * Returns a 0–100 "health percentage" for the progress bar inside each card.
 * For higher-is-better: 100% = 2× threshold. For lower-is-better: 100% = at or below threshold.
 */
export function getBarWidth(value, ratioKey, industry = 'general') {
  if (value === null || isNaN(value)) return 0;
  const bench = INDUSTRY_BENCHMARKS[industry]?.[ratioKey] || INDUSTRY_BENCHMARKS.general[ratioKey];
  if (!bench) return 0;
  const { threshold, direction } = bench;

  if (direction === 'higher') {
    return Math.min(100, (value / (threshold * 2)) * 100);
  } else {
    return Math.max(0, 100 - ((value / (threshold * 2)) * 100));
  }
}
