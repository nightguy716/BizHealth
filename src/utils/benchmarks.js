/**
 * benchmarks.js
 *
 * Healthy thresholds per ratio, by industry.
 * direction: 'higher' = higher value is better | 'lower' = lower value is better
 * getStatus() returns 'green', 'amber', 'red', or 'na'
 */

const BASE = {
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
};

export const INDUSTRY_BENCHMARKS = {
  general:       { label: 'General / Other',   ...BASE },
  retail: {
    label: 'Retail',
    currentRatio:        { threshold: 1.2,  direction: 'higher' },
    quickRatio:          { threshold: 0.5,  direction: 'higher' },
    cashRatio:           { threshold: 0.3,  direction: 'higher' },
    grossMargin:         { threshold: 20,   direction: 'higher' },
    operatingMargin:     { threshold: 8,    direction: 'higher' },
    netMargin:           { threshold: 5,    direction: 'higher' },
    roe:                 { threshold: 15,   direction: 'higher' },
    roa:                 { threshold: 5,    direction: 'higher' },
    assetTurnover:       { threshold: 1.5,  direction: 'higher' },
    fixedAssetTurnover:  { threshold: 3.0,  direction: 'higher' },
    receivablesDays:     { threshold: 20,   direction: 'lower'  },
    inventoryDays:       { threshold: 45,   direction: 'lower'  },
    debtToEquity:        { threshold: 1.5,  direction: 'lower'  },
    interestCoverage:    { threshold: 3.0,  direction: 'higher' },
  },
  manufacturing: {
    label: 'Manufacturing',
    currentRatio:        { threshold: 1.5,  direction: 'higher' },
    quickRatio:          { threshold: 0.8,  direction: 'higher' },
    cashRatio:           { threshold: 0.4,  direction: 'higher' },
    grossMargin:         { threshold: 20,   direction: 'higher' },
    operatingMargin:     { threshold: 10,   direction: 'higher' },
    netMargin:           { threshold: 8,    direction: 'higher' },
    roe:                 { threshold: 12,   direction: 'higher' },
    roa:                 { threshold: 4,    direction: 'higher' },
    assetTurnover:       { threshold: 0.8,  direction: 'higher' },
    fixedAssetTurnover:  { threshold: 1.5,  direction: 'higher' },
    receivablesDays:     { threshold: 50,   direction: 'lower'  },
    inventoryDays:       { threshold: 75,   direction: 'lower'  },
    debtToEquity:        { threshold: 2.0,  direction: 'lower'  },
    interestCoverage:    { threshold: 2.5,  direction: 'higher' },
  },
  services: {
    label: 'Services',
    currentRatio:        { threshold: 1.3,  direction: 'higher' },
    quickRatio:          { threshold: 1.2,  direction: 'higher' },
    cashRatio:           { threshold: 0.6,  direction: 'higher' },
    grossMargin:         { threshold: 40,   direction: 'higher' },
    operatingMargin:     { threshold: 20,   direction: 'higher' },
    netMargin:           { threshold: 12,   direction: 'higher' },
    roe:                 { threshold: 18,   direction: 'higher' },
    roa:                 { threshold: 7,    direction: 'higher' },
    assetTurnover:       { threshold: 1.2,  direction: 'higher' },
    fixedAssetTurnover:  { threshold: 5.0,  direction: 'higher' },
    receivablesDays:     { threshold: 60,   direction: 'lower'  },
    inventoryDays:       { threshold: 15,   direction: 'lower'  },
    debtToEquity:        { threshold: 1.0,  direction: 'lower'  },
    interestCoverage:    { threshold: 4.0,  direction: 'higher' },
  },
  saas: {
    label: 'SaaS / Tech',
    currentRatio:        { threshold: 2.0,  direction: 'higher' },
    quickRatio:          { threshold: 1.5,  direction: 'higher' },
    cashRatio:           { threshold: 1.0,  direction: 'higher' },
    grossMargin:         { threshold: 60,   direction: 'higher' },
    operatingMargin:     { threshold: 18,   direction: 'higher' },
    netMargin:           { threshold: 15,   direction: 'higher' },
    roe:                 { threshold: 20,   direction: 'higher' },
    roa:                 { threshold: 8,    direction: 'higher' },
    assetTurnover:       { threshold: 0.8,  direction: 'higher' },
    fixedAssetTurnover:  { threshold: 8.0,  direction: 'higher' },
    receivablesDays:     { threshold: 60,   direction: 'lower'  },
    inventoryDays:       { threshold: 10,   direction: 'lower'  },
    debtToEquity:        { threshold: 0.8,  direction: 'lower'  },
    interestCoverage:    { threshold: 5.0,  direction: 'higher' },
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
