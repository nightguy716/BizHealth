/**
 * benchmarks.js
 *
 * Healthy thresholds per ratio, broken down by industry.
 * When a user selects their industry, we use these numbers to decide
 * whether their ratio is Green (healthy), Amber (borderline), or Red (unhealthy).
 *
 * "direction" tells us whether higher is better ("higher") or lower is better ("lower").
 * "threshold" is the healthy boundary value.
 * "borderline" is 20% inside the threshold — the amber zone.
 */

const BASE = {
  currentRatio:     { threshold: 1.5,  direction: 'higher' },
  quickRatio:       { threshold: 1.0,  direction: 'higher' },
  cashRatio:        { threshold: 0.5,  direction: 'higher' },
  grossMargin:      { threshold: 30,   direction: 'higher' },
  netMargin:        { threshold: 10,   direction: 'higher' },
  roe:              { threshold: 15,   direction: 'higher' },
  roa:              { threshold: 5,    direction: 'higher' },
  assetTurnover:    { threshold: 1.0,  direction: 'higher' },
  receivablesDays:  { threshold: 45,   direction: 'lower'  },
  inventoryDays:    { threshold: 60,   direction: 'lower'  },
  debtToEquity:     { threshold: 1.5,  direction: 'lower'  },
};

export const INDUSTRY_BENCHMARKS = {
  general: {
    label: 'General / Other',
    ...BASE,
  },
  retail: {
    label: 'Retail',
    currentRatio:     { threshold: 1.2,  direction: 'higher' },
    quickRatio:       { threshold: 0.5,  direction: 'higher' },
    cashRatio:        { threshold: 0.3,  direction: 'higher' },
    grossMargin:      { threshold: 25,   direction: 'higher' },
    netMargin:        { threshold: 5,    direction: 'higher' },
    roe:              { threshold: 15,   direction: 'higher' },
    roa:              { threshold: 5,    direction: 'higher' },
    assetTurnover:    { threshold: 1.5,  direction: 'higher' },
    receivablesDays:  { threshold: 30,   direction: 'lower'  },
    inventoryDays:    { threshold: 45,   direction: 'lower'  },
    debtToEquity:     { threshold: 1.5,  direction: 'lower'  },
  },
  manufacturing: {
    label: 'Manufacturing',
    currentRatio:     { threshold: 1.5,  direction: 'higher' },
    quickRatio:       { threshold: 0.8,  direction: 'higher' },
    cashRatio:        { threshold: 0.4,  direction: 'higher' },
    grossMargin:      { threshold: 20,   direction: 'higher' },
    netMargin:        { threshold: 8,    direction: 'higher' },
    roe:              { threshold: 12,   direction: 'higher' },
    roa:              { threshold: 4,    direction: 'higher' },
    assetTurnover:    { threshold: 0.8,  direction: 'higher' },
    receivablesDays:  { threshold: 50,   direction: 'lower'  },
    inventoryDays:    { threshold: 75,   direction: 'lower'  },
    debtToEquity:     { threshold: 2.0,  direction: 'lower'  },
  },
  services: {
    label: 'Services',
    currentRatio:     { threshold: 1.3,  direction: 'higher' },
    quickRatio:       { threshold: 1.2,  direction: 'higher' },
    cashRatio:        { threshold: 0.6,  direction: 'higher' },
    grossMargin:      { threshold: 40,   direction: 'higher' },
    netMargin:        { threshold: 12,   direction: 'higher' },
    roe:              { threshold: 18,   direction: 'higher' },
    roa:              { threshold: 7,    direction: 'higher' },
    assetTurnover:    { threshold: 1.2,  direction: 'higher' },
    receivablesDays:  { threshold: 40,   direction: 'lower'  },
    inventoryDays:    { threshold: 30,   direction: 'lower'  },
    debtToEquity:     { threshold: 1.0,  direction: 'lower'  },
  },
  saas: {
    label: 'SaaS / Tech',
    currentRatio:     { threshold: 2.0,  direction: 'higher' },
    quickRatio:       { threshold: 1.5,  direction: 'higher' },
    cashRatio:        { threshold: 1.0,  direction: 'higher' },
    grossMargin:      { threshold: 60,   direction: 'higher' },
    netMargin:        { threshold: 15,   direction: 'higher' },
    roe:              { threshold: 20,   direction: 'higher' },
    roa:              { threshold: 8,    direction: 'higher' },
    assetTurnover:    { threshold: 0.8,  direction: 'higher' },
    receivablesDays:  { threshold: 35,   direction: 'lower'  },
    inventoryDays:    { threshold: 20,   direction: 'lower'  },
    debtToEquity:     { threshold: 0.8,  direction: 'lower'  },
  },
};

/**
 * Returns 'green', 'amber', or 'red' based on the value vs. threshold.
 * Amber zone = within 20% of the threshold value (the borderline area).
 */
export function getStatus(value, ratioKey, industry = 'general') {
  if (value === null || value === undefined || isNaN(value)) return 'na';
  const bench = INDUSTRY_BENCHMARKS[industry]?.[ratioKey] || INDUSTRY_BENCHMARKS.general[ratioKey];
  const { threshold, direction } = bench;
  const buffer = threshold * 0.2; // 20% buffer = amber zone

  if (direction === 'higher') {
    if (value >= threshold) return 'green';
    if (value >= threshold - buffer) return 'amber';
    return 'red';
  } else {
    if (value <= threshold) return 'green';
    if (value <= threshold + buffer) return 'amber';
    return 'red';
  }
}
