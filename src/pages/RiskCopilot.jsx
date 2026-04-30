import { useEffect, useMemo, useState } from 'react';
import { getBackendBaseUrl } from '../lib/backendUrl';
import { ownerHeaders } from '../lib/ownerHeaders';
import { useAuth } from '../context/AuthContext';
import TickerAutocomplete from '../components/TickerAutocomplete';

const API = getBackendBaseUrl();
const sans = "'Inter', system-ui, sans-serif";
const mono = 'var(--font-sans)';
const SNAP_KEY = 'valoreva_risk_snapshots_v1';

const BASE_POSITIONS = [
  { ticker: 'RELIANCE.NS', weight: 0.22, sector: 'Energy', beta: 1.05 },
  { ticker: 'HDFCBANK.NS', weight: 0.18, sector: 'Financials', beta: 0.92 },
  { ticker: 'INFY.NS', weight: 0.14, sector: 'Technology', beta: 1.1 },
  { ticker: 'ITC.NS', weight: 0.11, sector: 'Consumer Defensive', beta: 0.68 },
];

const SCENARIOS = [
  { id: 'nifty_down_8', label: 'Nifty -8%', shock: -0.08 },
  { id: 'nifty_up_6', label: 'Nifty +6%', shock: 0.06 },
  { id: 'risk_off_12', label: 'Risk-off -12%', shock: -0.12 },
];
const TRADE_OBJECTIVES = {
  conservative: 0.02,
  moderate: 0.05,
  aggressive: 0.08,
};
const STRATEGY_PRESETS = {
  scalp:      { maxRiskPct: 0.005, t1Pct: 0.6, t2Pct: 0.3, t1R: 0.8, t2R: 1.4, trailRunner: true, objective: 'conservative' },
  intraday:   { maxRiskPct: 0.008, t1Pct: 0.5, t2Pct: 0.3, t1R: 1.0, t2R: 1.8, trailRunner: true, objective: 'moderate' },
  swing:      { maxRiskPct: 0.012, t1Pct: 0.4, t2Pct: 0.35, t1R: 1.2, t2R: 2.4, trailRunner: true, objective: 'moderate' },
  positional: { maxRiskPct: 0.015, t1Pct: 0.3, t2Pct: 0.35, t1R: 1.5, t2R: 3.0, trailRunner: true, objective: 'aggressive' },
};

const cardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: 14,
};

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...ownerHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.detail || j?.error?.message || `Request failed (${res.status})`);
  }
  return res.json();
}

async function get(path) {
  const res = await fetch(`${API}${path}`, { headers: ownerHeaders() });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.detail || j?.error?.message || `Request failed (${res.status})`);
  }
  return res.json();
}

function fmtPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`;
}

function cleanPositions(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((p) => ({
      ticker: String(p?.ticker || '').trim().toUpperCase(),
      weight: Number(p?.weight) || 0,
      sector: String(p?.sector || 'Unknown').trim() || 'Unknown',
      beta: Number(p?.beta) || 1.0,
    }))
    .filter((p) => p.ticker);
}

function calcSnapshotMetrics(inputPositions, scenarioShock) {
  const rows = cleanPositions(inputPositions);
  if (!rows.length) {
    return { names: 0, maxWeight: 0, weightedBeta: 0, scenarioImpact: 0 };
  }
  let maxWeight = 0;
  let weightedBeta = 0;
  let scenarioImpact = 0;
  for (const row of rows) {
    const w = Number.isFinite(row.weight) ? row.weight : 0;
    maxWeight = Math.max(maxWeight, w);
    weightedBeta += w * (Number.isFinite(row.beta) ? row.beta : 1.0);
    const sec = row.sector.toLowerCase();
    const mult = sec.includes('technology') ? 1.25 : sec.includes('financial') ? 1.1 : 1.0;
    scenarioImpact += w * scenarioShock * mult;
  }
  return {
    names: rows.length,
    maxWeight,
    weightedBeta,
    scenarioImpact,
  };
}

function normalizeTradeTicker(raw) {
  let t = String(raw || '').trim().toUpperCase();
  if (!t) return '';
  if (t.startsWith('NSE:') || t.startsWith('BSE:')) t = t.slice(4);
  if (t.endsWith('-EQ')) t = t.slice(0, -3);
  return t;
}

function tradeSymbolCandidates(ticker) {
  const base = normalizeTradeTicker(ticker);
  if (!base) return [];
  if (base.endsWith('.NS') || base.endsWith('.BO')) return [base];
  return [`${base}.NS`, `${base}.BO`, base];
}

function formatAuditTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}

export default function RiskCopilot() {
  const { user, isAuthenticated, loading: authLoading, getWatchlist } = useAuth();
  const [positions, setPositions] = useState(BASE_POSITIONS);
  const [trade, setTrade] = useState({ ticker: 'TCS.NS', side: 'buy', mode: 'target_weight_delta', weight_delta: 0.05 });
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [preTrade, setPreTrade] = useState(null);
  const [stress, setStress] = useState(null);
  const [corr, setCorr] = useState(null);
  const [hedges, setHedges] = useState(null);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [watchlistLoaded, setWatchlistLoaded] = useState(false);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [snapshotReady, setSnapshotReady] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState('');
  const [compareBaseId, setCompareBaseId] = useState('');
  const [compareTargetId, setCompareTargetId] = useState('');
  const [tradeMeta, setTradeMeta] = useState(null);
  const [tradePrice, setTradePrice] = useState(null);
  const [loadingTradePrice, setLoadingTradePrice] = useState(false);
  const [tradeObjective, setTradeObjective] = useState('moderate');
  const [portfolioValue, setPortfolioValue] = useState(1000000);
  const [auditTrail, setAuditTrail] = useState([]);
  const [icCopied, setIcCopied] = useState(false);
  const [aiNarrative, setAiNarrative] = useState(null);
  const [tradePlan, setTradePlan] = useState({
    entry: 0,
    stop: 0,
    target: 0,
    maxRiskPct: 0.01,
    t1Pct: 0.5,
    t2Pct: 0.3,
    t1R: 1.0,
    t2R: 2.0,
    trailRunner: true,
  });
  const [strategyPreset, setStrategyPreset] = useState('intraday');

  const scenario = useMemo(() => SCENARIOS.find(s => s.id === scenarioId) || SCENARIOS[0], [scenarioId]);
  const tickerCsv = useMemo(() => positions.map(p => p.ticker).join(','), [positions]);
  const snapshotStorageKey = useMemo(() => `${SNAP_KEY}:${user?.id || 'anon'}`, [user?.id]);
  const selectedSnapshot = useMemo(() => snapshots.find((s) => s.id === selectedSnapshotId) || null, [snapshots, selectedSnapshotId]);
  const baseSnapshot = useMemo(() => snapshots.find((s) => s.id === compareBaseId) || null, [snapshots, compareBaseId]);
  const targetSnapshot = useMemo(() => snapshots.find((s) => s.id === compareTargetId) || null, [snapshots, compareTargetId]);
  const baseMetrics = useMemo(
    () => calcSnapshotMetrics(baseSnapshot?.positions, scenario.shock),
    [baseSnapshot, scenario.shock],
  );
  const targetMetrics = useMemo(
    () => calcSnapshotMetrics(targetSnapshot?.positions, scenario.shock),
    [targetSnapshot, scenario.shock],
  );
  const tradeCurrency = useMemo(() => {
    if (tradeMeta?.currency) return tradeMeta.currency;
    const t = normalizeTradeTicker(trade.ticker);
    return t.endsWith('.NS') || t.endsWith('.BO') ? 'INR' : 'USD';
  }, [trade.ticker, tradeMeta?.currency]);
  const suggestedDelta = useMemo(() => {
    const base = TRADE_OBJECTIVES[tradeObjective] ?? TRADE_OBJECTIVES.moderate;
    const move = Math.abs(Number(tradePrice?.changePct || 0));
    const adjustment = move >= 4 ? -0.01 : move >= 2 ? -0.005 : 0;
    return Math.max(0.01, Number((base + adjustment).toFixed(3)));
  }, [tradeObjective, tradePrice?.changePct]);
  const effectiveTradeDelta = useMemo(
    () => Math.max(0, Number(trade.weight_delta || 0)),
    [trade.weight_delta],
  );
  const estimatedNotional = useMemo(
    () => Number(portfolioValue || 0) * effectiveTradeDelta,
    [portfolioValue, effectiveTradeDelta],
  );
  const targetTickerWeight = useMemo(() => {
    const t = normalizeTradeTicker(trade.ticker);
    if (!t) return 0;
    const hit = positions.find((p) => normalizeTradeTicker(p.ticker) === t);
    return Number(hit?.weight || 0);
  }, [positions, trade.ticker]);
  const projectedTickerWeight = useMemo(() => {
    if (trade.side === 'sell') return Math.max(0, targetTickerWeight - effectiveTradeDelta);
    return targetTickerWeight + effectiveTradeDelta;
  }, [trade.side, targetTickerWeight, effectiveTradeDelta]);
  const tradePlanMetrics = useMemo(() => {
    const entry = Number(tradePlan.entry || 0);
    const stop = Number(tradePlan.stop || 0);
    const target = Number(tradePlan.target || 0);
    const maxRiskPct = Math.max(0.001, Number(tradePlan.maxRiskPct || 0));
    const t1Pct = Math.max(0, Number(tradePlan.t1Pct || 0));
    const t2Pct = Math.max(0, Number(tradePlan.t2Pct || 0));
    const allocUsed = t1Pct + t2Pct;
    const runnerPct = Math.max(0, 1 - allocUsed);
    const t1R = Math.max(0, Number(tradePlan.t1R || 0));
    const t2R = Math.max(0, Number(tradePlan.t2R || 0));
    const runnerR = tradePlan.trailRunner ? 2.5 : 1.5;
    const riskPerUnit = Math.abs(entry - stop);
    const rewardPerUnit = Math.abs(target - entry);
    const rr = riskPerUnit > 0 ? rewardPerUnit / riskPerUnit : 0;
    const riskBudget = Number(portfolioValue || 0) * maxRiskPct;
    const qty = riskPerUnit > 0 ? Math.max(0, Math.floor(riskBudget / riskPerUnit)) : 0;
    const notional = qty * entry;
    const impliedWeight = Number(portfolioValue || 0) > 0 ? notional / Number(portfolioValue || 1) : 0;
    const blendedR = (t1Pct * t1R) + (t2Pct * t2R) + (runnerPct * runnerR);
    const expectedPlanPnl = riskBudget * blendedR;
    const direction = trade.side === 'buy' ? 1 : -1;
    const t1Price = entry + (direction * riskPerUnit * t1R);
    const t2Price = entry + (direction * riskPerUnit * t2R);
    const directionOk =
      trade.side === 'buy'
        ? entry > 0 && stop > 0 && target > entry && stop < entry
        : entry > 0 && stop > 0 && target > 0 && target < entry && stop > entry;
    return {
      entry,
      stop,
      target,
      maxRiskPct,
      riskPerUnit,
      rewardPerUnit,
      rr,
      riskBudget,
      qty,
      notional,
      impliedWeight,
      allocUsed,
      runnerPct,
      t1R,
      t2R,
      blendedR,
      expectedPlanPnl,
      t1Price,
      t2Price,
      directionOk,
    };
  }, [tradePlan, portfolioValue, trade.side]);

  function pushAudit(action, detail) {
    setAuditTrail((prev) => [
      {
        id: `audit_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        at: new Date().toISOString(),
        action,
        detail,
      },
      ...prev,
    ].slice(0, 24));
  }

  function applyTradeDelta(nextDelta, reason = 'Delta updated') {
    const prev = Math.max(0, Number(trade.weight_delta || 0));
    const next = Math.max(0, Number(nextDelta || 0));
    if (Math.abs(prev - next) > 0.0001) {
      pushAudit(reason, `${fmtPct(prev).replace('+', '')} -> ${fmtPct(next).replace('+', '')}`);
    }
    setTrade((t) => ({ ...t, weight_delta: next }));
  }

  function applyTradeObjective(nextObjective, reason = 'Trade objective updated') {
    if (nextObjective !== tradeObjective) {
      pushAudit(reason, `${tradeObjective} -> ${nextObjective}`);
      setTradeObjective(nextObjective);
    }
  }

  function applyScenario(nextScenarioId, reason = 'Scenario updated') {
    if (nextScenarioId !== scenarioId) {
      const prev = SCENARIOS.find((s) => s.id === scenarioId)?.label || scenarioId;
      const next = SCENARIOS.find((s) => s.id === nextScenarioId)?.label || nextScenarioId;
      pushAudit(reason, `${prev} -> ${next}`);
      setScenarioId(nextScenarioId);
    }
  }
  function applyStrategyPreset(nextPreset) {
    const preset = STRATEGY_PRESETS[nextPreset];
    if (!preset) return;
    setStrategyPreset(nextPreset);
    setTradePlan((p) => ({
      ...p,
      maxRiskPct: preset.maxRiskPct,
      t1Pct: preset.t1Pct,
      t2Pct: preset.t2Pct,
      t1R: preset.t1R,
      t2R: preset.t2R,
      trailRunner: preset.trailRunner,
    }));
    applyTradeObjective(preset.objective, 'Strategy preset objective');
    pushAudit('Strategy preset applied', nextPreset.toUpperCase());
  }
  const readiness = useMemo(() => {
    const reasons = [];
    const corrPairs = Array.isArray(corr?.high_corr_pairs) ? corr.high_corr_pairs.length : 0;
    const scenarioImpact = Number(stress?.portfolio_impact_pct || 0);
    const postVar = Number(preTrade?.after?.portfolio_var_1d || 0);

    if (projectedTickerWeight > 0.3) reasons.push('Single-name projected weight above 30%.');
    if (postVar > 0.04) reasons.push('Post-trade 1D VaR indicates high risk (>4%).');
    if (scenarioImpact < -0.1) reasons.push('Scenario stress shows drawdown worse than -10%.');
    if (corrPairs >= 3) reasons.push(`Correlation scan found ${corrPairs} high-correlation pair(s).`);

    let verdict = 'PASS';
    let tone = '#22c55e';
    if (reasons.length >= 3) {
      verdict = 'BLOCK';
      tone = '#ef4444';
    } else if (reasons.length >= 1) {
      verdict = 'WATCH';
      tone = '#f59e0b';
    }

    return {
      verdict,
      tone,
      reasons,
      summary:
        verdict === 'PASS'
          ? 'Risk profile is within current policy guardrails.'
          : verdict === 'WATCH'
            ? 'Proceed with caution; one or more risk flags need review.'
            : 'Execution should be blocked until risk flags are resolved.',
    };
  }, [corr?.high_corr_pairs, stress?.portfolio_impact_pct, preTrade?.after?.portfolio_var_1d, projectedTickerWeight]);
  const fixActions = useMemo(() => {
    const actions = [];
    const corrPairs = Array.isArray(corr?.high_corr_pairs) ? corr.high_corr_pairs.length : 0;
    const scenarioImpact = Number(stress?.portfolio_impact_pct || 0);
    const postVar = Number(preTrade?.after?.portfolio_var_1d || 0);
    const trimDelta = Math.max(0.01, Number((effectiveTradeDelta * 0.7).toFixed(3)));

    if (projectedTickerWeight > 0.3) {
      actions.push({
        id: 'reduce_delta_concentration',
        label: `Reduce trade delta to ${fmtPct(trimDelta).replace('+', '')}`,
        kind: 'primary',
        apply: () => applyTradeDelta(trimDelta, 'Concentration fix: delta reduced'),
      });
    }
    if (postVar > 0.04) {
      actions.push({
        id: 'switch_conservative',
        label: 'Switch to Conservative sizing',
        kind: 'primary',
        apply: () => applyTradeObjective('conservative', 'VaR fix: switched objective'),
      });
    }
    if (scenarioImpact < -0.1) {
      actions.push({
        id: 'lower_shock',
        label: 'Try milder scenario (Nifty -8%)',
        kind: 'secondary',
        apply: () => applyScenario('nifty_down_8', 'Stress fix: scenario adjusted'),
      });
    }
    if (corrPairs >= 3) {
      actions.push({
        id: 'correlation_scan',
        label: 'Review high-correlation pairs',
        kind: 'secondary',
        apply: async () => {
          pushAudit('Correlation review', 'Triggered hotspot rescan');
          await runCorrelation();
        },
      });
    }
    if (actions.length === 0) {
      actions.push({
        id: 'full_check',
        label: 'Run full risk check',
        kind: 'secondary',
        apply: async () => {
          pushAudit('Full risk check', 'Triggered full module refresh');
          await runFullRiskCheck();
        },
      });
    }
    return actions.slice(0, 3);
  }, [
    corr?.high_corr_pairs,
    stress?.portfolio_impact_pct,
    preTrade?.after?.portfolio_var_1d,
    projectedTickerWeight,
    effectiveTradeDelta,
  ]);
  const icNoteText = useMemo(() => {
    const ts = new Date().toLocaleString('en-IN');
    const topPairs = (corr?.high_corr_pairs || []).slice(0, 3).map((p) => `${p.a}-${p.b} (${p.corr})`);
    const topHedges = (hedges?.recommendations || []).slice(0, 3).map((h) => `${h.action.toUpperCase()} ${h.ticker}: ${h.from_weight} -> ${h.to_weight}`);
    const recentAudit = auditTrail.slice(0, 6).map((a) => `${formatAuditTime(a.at)} | ${a.action} | ${a.detail}`);
    const lines = [
      `Valoreva IC Risk Note`,
      `Generated: ${ts}`,
      ``,
      `Trade Candidate`,
      `- Ticker: ${normalizeTradeTicker(trade.ticker) || '-'}`,
      `- Side: ${trade.side.toUpperCase()}`,
      `- Delta: ${fmtPct(effectiveTradeDelta).replace('+', '')}`,
      `- Portfolio Value: ${tradeCurrency === 'INR' ? 'INR' : 'USD'} ${Number(portfolioValue || 0).toLocaleString()}`,
      `- Estimated Notional: ${tradeCurrency === 'INR' ? 'INR' : 'USD'} ${estimatedNotional.toLocaleString()}`,
      ``,
      `Risk Decision`,
      `- Readiness: ${readiness.verdict}`,
      `- Commentary: ${readiness.summary}`,
      ...(readiness.reasons.length ? readiness.reasons.map((r) => `- Flag: ${r}`) : ['- Flags: None']),
      ``,
      `Key Metrics`,
      `- Post-Trade VaR (1D): ${fmtPct(preTrade?.after?.portfolio_var_1d)}`,
      `- Scenario Impact (${scenario.label}): ${fmtPct(stress?.portfolio_impact_pct)}`,
      `- Correlation Hotspots: ${(corr?.high_corr_pairs || []).length}`,
      `- Expected Hedge Effect (VaR bps): ${hedges?.expected_effect?.var_reduction_bps || 0}`,
      ``,
      `Top Correlation Pairs`,
      ...(topPairs.length ? topPairs.map((p) => `- ${p}`) : ['- None']),
      ``,
      `Top Hedge Recommendations`,
      ...(topHedges.length ? topHedges.map((h) => `- ${h}`) : ['- None']),
      ``,
      `Recent Audit Events`,
      ...(recentAudit.length ? recentAudit.map((e) => `- ${e}`) : ['- No logged actions']),
    ];
    return lines.join('\n');
  }, [
    trade.ticker,
    trade.side,
    effectiveTradeDelta,
    tradeCurrency,
    portfolioValue,
    estimatedNotional,
    readiness.verdict,
    readiness.summary,
    readiness.reasons,
    preTrade?.after?.portfolio_var_1d,
    stress?.portfolio_impact_pct,
    scenario.label,
    corr?.high_corr_pairs,
    hedges?.expected_effect?.var_reduction_bps,
    hedges?.recommendations,
    auditTrail,
  ]);

  async function copyIcNote() {
    try {
      await navigator.clipboard.writeText(icNoteText);
      setIcCopied(true);
      setTimeout(() => setIcCopied(false), 1500);
    } catch {
      // ignore clipboard failures
    }
  }

  function downloadIcNote() {
    try {
      const blob = new Blob([icNoteText], { type: 'text/plain;charset=utf-8' });
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `valoreva-ic-note-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch {
      // ignore download failures
    }
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(snapshotStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      const arr = Array.isArray(parsed) ? parsed : [];
      setSnapshots(arr);
      if (arr.length > 0) {
        setSelectedSnapshotId(arr[0].id);
        if (Array.isArray(arr[0].positions) && arr[0].positions.length > 0) {
          setPositions(arr[0].positions);
        }
        setCompareBaseId(arr[0].id);
        setCompareTargetId(arr[1]?.id || arr[0].id);
      } else {
        setSelectedSnapshotId('');
        setCompareBaseId('');
        setCompareTargetId('');
      }
    } catch {
      setSnapshots([]);
      setSelectedSnapshotId('');
      setCompareBaseId('');
      setCompareTargetId('');
    } finally {
      setSnapshotReady(true);
    }
  }, [snapshotStorageKey]);

  function persistSnapshots(next) {
    setSnapshots(next);
    try {
      localStorage.setItem(snapshotStorageKey, JSON.stringify(next));
    } catch {
      // ignore storage write failures
    }
  }

  function saveSnapshot() {
    const name = window.prompt('Snapshot name (e.g. Core Portfolio - Apr):', 'Core Portfolio');
    if (!name) return;
    const rec = {
      id: `snap_${Date.now()}`,
      name: String(name).trim().slice(0, 60) || 'Portfolio Snapshot',
      createdAt: new Date().toISOString(),
      positions,
    };
    const next = [rec, ...snapshots].slice(0, 30);
    persistSnapshots(next);
    setSelectedSnapshotId(rec.id);
    if (!compareBaseId) setCompareBaseId(rec.id);
    if (!compareTargetId) setCompareTargetId(rec.id);
  }

  function loadSnapshot(id) {
    setSelectedSnapshotId(id);
    const hit = snapshots.find(s => s.id === id);
    if (hit?.positions?.length) setPositions(hit.positions);
  }

  function deleteSnapshot(id) {
    const hit = snapshots.find(s => s.id === id);
    if (!hit) return;
    const ok = window.confirm(`Delete snapshot "${hit.name}"?`);
    if (!ok) return;
    const next = snapshots.filter(s => s.id !== id);
    persistSnapshots(next);
    if (compareBaseId === id) setCompareBaseId(next[0]?.id || '');
    if (compareTargetId === id) setCompareTargetId(next[1]?.id || next[0]?.id || '');
    if (selectedSnapshotId === id) {
      if (next[0]?.positions?.length) {
        setSelectedSnapshotId(next[0].id);
        setPositions(next[0].positions);
      } else {
        setSelectedSnapshotId('');
      }
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function hydrateFromWatchlist() {
      if (authLoading || !snapshotReady || !isAuthenticated || !getWatchlist || watchlistLoaded || selectedSnapshotId) return;
      try {
        const items = await getWatchlist();
        if (cancelled) return;
        setWatchlistCount(Array.isArray(items) ? items.length : 0);
        if (!Array.isArray(items) || items.length === 0) {
          setWatchlistLoaded(true);
          return;
        }
        const unique = [];
        const seen = new Set();
        for (const item of items) {
          const t = String(item?.ticker || '').trim().toUpperCase();
          if (!t || seen.has(t)) continue;
          seen.add(t);
          unique.push(item);
          if (unique.length >= 8) break;
        }
        if (!unique.length) {
          setWatchlistLoaded(true);
          return;
        }
        const eqW = 1 / unique.length;
        const fromWatchlist = unique.map((item) => {
          const sec = (item?.sector || '').trim() || 'Unknown';
          return {
            ticker: String(item.ticker || '').trim().toUpperCase(),
            weight: Number(eqW.toFixed(4)),
            sector: sec,
            beta: sec.toLowerCase().includes('technology') ? 1.1 : sec.toLowerCase().includes('financial') ? 0.95 : 1.0,
          };
        });
        setPositions(fromWatchlist);
      } catch {
        // Keep default positions when watchlist lookup fails.
      } finally {
        if (!cancelled) setWatchlistLoaded(true);
      }
    }
    hydrateFromWatchlist();
    return () => { cancelled = true; };
  }, [authLoading, snapshotReady, isAuthenticated, getWatchlist, watchlistLoaded, selectedSnapshotId]);

  useEffect(() => {
    let alive = true;
    const t = normalizeTradeTicker(trade.ticker);
    if (!t) {
      setTradePrice(null);
      return undefined;
    }
    const timer = setTimeout(async () => {
      setLoadingTradePrice(true);
      try {
        let px = null;
        for (const sym of tradeSymbolCandidates(t)) {
          try {
            const res = await fetch(`${API}/stocks/price/${encodeURIComponent(sym)}`, {
              headers: ownerHeaders(),
              signal: AbortSignal.timeout(10_000),
            });
            if (!res.ok) continue;
            const j = await res.json();
            if (Number(j?.price) > 0) {
              px = {
                symbol: sym,
                price: Number(j.price),
                changePct: Number(j.change_pct || 0),
                change: Number(j.change || 0),
              };
              break;
            }
          } catch {
            // try next symbol candidate
          }
        }

        if (!px) {
          for (const sym of tradeSymbolCandidates(t)) {
            try {
              const res = await fetch(`${API}/company/yf/${encodeURIComponent(sym)}`, {
                headers: ownerHeaders(),
                signal: AbortSignal.timeout(10_000),
              });
              if (!res.ok) continue;
              const j = await res.json();
              const current = Number(j?.market_data?.currentPrice);
              if (Number.isFinite(current) && current > 0) {
                px = {
                  symbol: sym,
                  price: current,
                  changePct: Number(j?.market_data?.priceChangePct || 0),
                  change: Number(j?.market_data?.priceChange || 0),
                };
                break;
              }
            } catch {
              // try next symbol candidate
            }
          }
        }
        if (!alive) return;
        setTradePrice(px);
      } finally {
        if (alive) setLoadingTradePrice(false);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [trade.ticker]);

  async function runPreTrade() {
    setError('');
    setLoading('pretrade');
    try {
      const data = await post('/risk/pretrade-impact', {
        positions,
        candidate_trade: {
          ticker: trade.ticker,
          side: trade.side,
          mode: trade.mode,
          weight_delta: Number(trade.weight_delta),
        },
      });
      setPreTrade(data);
      pushAudit('Pre-trade impact', 'Ran pre-trade simulation');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading('');
    }
  }

  async function runStress() {
    setError('');
    setLoading('stress');
    try {
      const data = await post('/risk/scenario-stress', {
        portfolio_value: Number(portfolioValue || 0) || 1000000,
        positions,
        scenario: {
          name: scenario.id,
          market_shock_pct: scenario.shock,
          sector_overrides: {
            Technology: scenario.shock * 1.25,
            Financials: scenario.shock * 1.1,
          },
          rate_shock_bps: scenario.shock < 0 ? 100 : -50,
        },
      });
      setStress(data);
      pushAudit('Scenario stress', `Ran ${scenario.label}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading('');
    }
  }

  async function runCorrelation() {
    setError('');
    setLoading('corr');
    try {
      const data = await get(`/risk/correlation-matrix?tickers=${encodeURIComponent(tickerCsv)}&threshold=0.75`);
      setCorr(data);
      pushAudit('Correlation scan', `Scanned ${positions.length} ticker(s)`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading('');
    }
  }

  async function runHedges() {
    setError('');
    setLoading('hedge');
    try {
      const data = await post('/risk/hedge-suggestions', {
        positions,
        objective: 'minimize_var',
        constraints: { max_single_name: 0.2, max_sector: 0.3, turnover_limit: 0.08 },
      });
      setHedges(data);
      pushAudit('Hedge suggestions', 'Generated hedge recommendations');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading('');
    }
  }

  async function runAllForPositions(nextPositions) {
    setError('');
    setLoading('refresh');
    try {
      const csv = nextPositions.map((p) => p.ticker).join(',');
      const [preData, stressData, corrData, hedgeData] = await Promise.all([
        post('/risk/pretrade-impact', {
          positions: nextPositions,
          candidate_trade: {
            ticker: trade.ticker,
            side: trade.side,
            mode: trade.mode,
            weight_delta: Number(trade.weight_delta),
          },
        }),
        post('/risk/scenario-stress', {
          portfolio_value: Number(portfolioValue || 0) || 1000000,
          positions: nextPositions,
          scenario: {
            name: scenario.id,
            market_shock_pct: scenario.shock,
            sector_overrides: {
              Technology: scenario.shock * 1.25,
              Financials: scenario.shock * 1.1,
            },
            rate_shock_bps: scenario.shock < 0 ? 100 : -50,
          },
        }),
        get(`/risk/correlation-matrix?tickers=${encodeURIComponent(csv)}&threshold=0.75`),
        post('/risk/hedge-suggestions', {
          positions: nextPositions,
          objective: 'minimize_var',
          constraints: { max_single_name: 0.2, max_sector: 0.3, turnover_limit: 0.08 },
        }),
      ]);

      setPreTrade(preData);
      setStress(stressData);
      setCorr(corrData);
      setHedges(hedgeData);
      pushAudit('Full risk refresh', `Refreshed all modules for ${nextPositions.length} position(s)`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading('');
    }
  }

  async function promoteCandidateSnapshot() {
    if (!compareTargetId) return;
    const hit = snapshots.find((s) => s.id === compareTargetId);
    if (!hit?.positions?.length) return;
    setSelectedSnapshotId(hit.id);
    setPositions(hit.positions);
    pushAudit('Snapshot promoted', `Active portfolio set to "${hit.name}"`);
    await runAllForPositions(hit.positions);
  }

  async function runFullRiskCheck() {
    await runAllForPositions(positions);
  }

  async function runAiExplain() {
    setError('');
    setLoading('ai');
    try {
      const data = await post('/risk/ai-explain', {
        portfolio_value: Number(portfolioValue || 0) || 1000000,
        positions,
        candidate_trade: {
          ticker: trade.ticker,
          side: trade.side,
          mode: trade.mode,
          weight_delta: Number(trade.weight_delta),
          target_weight: null,
          sector: tradeMeta?.sector || null,
          beta: null,
        },
        scenario: {
          name: scenario.id,
          market_shock_pct: scenario.shock,
          sector_overrides: {
            Technology: scenario.shock * 1.25,
            Financials: scenario.shock * 1.1,
          },
          rate_shock_bps: scenario.shock < 0 ? 100 : -50,
        },
        pretrade: preTrade || {},
        stress: stress || {},
        correlation: corr || {},
        hedges: hedges || {},
        readiness: {
          verdict: readiness.verdict,
          summary: readiness.summary,
          reasons: readiness.reasons,
        },
        audit_trail: auditTrail.slice(0, 12),
      });
      setAiNarrative(data);
      pushAudit('AI risk explanation', `Generated ${data?.decision || 'WATCH'} narrative`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading('');
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingTop: '5rem', fontFamily: sans }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem 1.25rem 3rem' }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.1em', color: 'var(--text-4)' }}>PORTFOLIO</div>
          <h1 style={{ margin: '4px 0', color: 'var(--text-1)', fontSize: 28 }}>Risk Copilot (MVP)</h1>
          <p style={{ margin: 0, color: 'var(--text-4)', fontSize: 13 }}>
            Simulate pre-trade impact, stress scenarios, correlation concentration, and hedge suggestions before execution.
          </p>
          {isAuthenticated ? (
            <p style={{ marginTop: 8, color: 'var(--text-4)', fontSize: 12 }}>
              {watchlistLoaded
                ? watchlistCount > 0
                  ? `Auto-loaded ${Math.min(watchlistCount, 8)} holdings from your watchlist (equal-weighted).`
                  : 'No watchlist holdings found; using demo positions.'
                : 'Loading your watchlist holdings...'}
            </p>
          ) : (
            <p style={{ marginTop: 8, color: 'var(--text-4)', fontSize: 12 }}>
              Sign in to auto-load watchlist holdings; currently showing demo positions.
            </p>
          )}
        </div>

        {error && (
          <div style={{ ...cardStyle, marginBottom: 12, borderColor: '#dc2626', color: '#ef4444', fontSize: 12 }}>
            {error}
          </div>
        )}

        <div style={{ ...cardStyle, marginBottom: 12, borderColor: readiness.tone }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: mono, color: 'var(--text-3)', fontSize: 11, marginBottom: 4 }}>RISK READINESS</div>
              <div style={{ color: 'var(--text-2)', fontSize: 12 }}>{readiness.summary}</div>
            </div>
            <div style={{ fontFamily: mono, fontWeight: 800, color: readiness.tone, fontSize: 20, letterSpacing: '0.08em' }}>
              {readiness.verdict}
            </div>
          </div>
          {readiness.reasons.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-4)' }}>
              {readiness.reasons.slice(0, 3).join(' ')}
            </div>
          )}
          {readiness.verdict !== 'PASS' && (
            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {fixActions.map((a) => (
                <button
                  key={a.id}
                  onClick={a.apply}
                  style={{
                    background: a.kind === 'primary' ? 'var(--gold)' : 'var(--surface-hi)',
                    color: a.kind === 'primary' ? '#111827' : 'var(--text-2)',
                    border: `1px solid ${a.kind === 'primary' ? 'var(--gold)' : 'var(--border)'}`,
                    borderRadius: 4,
                    padding: '7px 10px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ ...cardStyle, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: mono, color: 'var(--text-3)', fontSize: 11, marginBottom: 4 }}>AI RISK ANALYST (CLAUDE)</div>
              <div style={{ color: 'var(--text-4)', fontSize: 12 }}>
                Converts quant outputs into plain-language interpretation, key risks, and next best actions.
              </div>
            </div>
            <button
              onClick={runAiExplain}
              disabled={loading === 'ai'}
              style={{
                background: 'var(--gold)',
                color: '#111827',
                border: '1px solid rgba(200,157,31,0.3)',
                borderRadius: 4,
                padding: '8px 10px',
                fontWeight: 700,
                fontSize: 12,
                cursor: loading === 'ai' ? 'not-allowed' : 'pointer',
                opacity: loading === 'ai' ? 0.7 : 1,
              }}
            >
              {loading === 'ai' ? 'Analyzing...' : 'Explain Full Risk Check'}
            </button>
          </div>
          {!aiNarrative ? (
            <div style={{ marginTop: 10, color: 'var(--text-4)', fontSize: 12 }}>
              Run AI explanation after your risk checks to get a human-friendly interpretation.
            </div>
          ) : (
            <>
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-2)' }}>
                <b>Summary:</b> {aiNarrative.summary || '-'}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-4)' }}>
                Decision: <b style={{ color: aiNarrative.decision === 'PASS' ? '#22c55e' : aiNarrative.decision === 'BLOCK' ? '#ef4444' : '#f59e0b' }}>{aiNarrative.decision}</b>
                {' · '}
                Confidence: <b style={{ color: 'var(--text-2)' }}>{Number(aiNarrative.confidence || 0)}%</b>
                {aiNarrative?.meta?.model ? (
                  <>
                    {' · '}
                    Model: <b style={{ color: 'var(--text-2)' }}>{aiNarrative.meta.model}</b>
                  </>
                ) : null}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                <div>
                  <div style={{ fontFamily: mono, color: 'var(--text-3)', fontSize: 11, marginBottom: 6 }}>KEY DRIVERS</div>
                  {(aiNarrative.key_drivers || []).length ? (
                    (aiNarrative.key_drivers || []).map((item, idx) => (
                      <div key={`driver-${idx}`} style={{ color: 'var(--text-4)', fontSize: 12, marginBottom: 4 }}>- {item}</div>
                    ))
                  ) : (
                    <div style={{ color: 'var(--text-4)', fontSize: 12 }}>-</div>
                  )}
                </div>
                <div>
                  <div style={{ fontFamily: mono, color: 'var(--text-3)', fontSize: 11, marginBottom: 6 }}>ACTIONS NOW</div>
                  {(aiNarrative.actions_now || []).length ? (
                    (aiNarrative.actions_now || []).map((item, idx) => (
                      <div key={`act-${idx}`} style={{ color: 'var(--text-4)', fontSize: 12, marginBottom: 4 }}>- {item}</div>
                    ))
                  ) : (
                    <div style={{ color: 'var(--text-4)', fontSize: 12 }}>-</div>
                  )}
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{ fontFamily: mono, color: 'var(--text-3)', fontSize: 11, marginBottom: 6 }}>PLAIN ENGLISH</div>
                {(aiNarrative.plain_english || []).length ? (
                  (aiNarrative.plain_english || []).map((item, idx) => (
                    <div key={`plain-${idx}`} style={{ color: 'var(--text-4)', fontSize: 12, marginBottom: 4 }}>- {item}</div>
                  ))
                ) : (
                  <div style={{ color: 'var(--text-4)', fontSize: 12 }}>-</div>
                )}
              </div>
            </>
          )}
        </div>

        <div style={{ ...cardStyle, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: mono, color: 'var(--text-3)', fontSize: 11, marginBottom: 3 }}>PORTFOLIO SNAPSHOTS</div>
              <div style={{ color: 'var(--text-4)', fontSize: 12 }}>Save and reload portfolio sets for quick risk comparison.</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <select
                value={selectedSnapshotId}
                onChange={(e) => loadSnapshot(e.target.value)}
                style={{ minWidth: 220, background: 'var(--surface-hi)', border: '1px solid var(--border)', color: 'var(--text-1)', borderRadius: 4, padding: '7px 8px', fontSize: 12 }}
              >
                <option value="">No snapshot selected</option>
                {snapshots.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {new Date(s.createdAt).toLocaleDateString('en-IN')}
                  </option>
                ))}
              </select>
              <button onClick={saveSnapshot} style={{ background: 'var(--gold)', color: '#111827', border: 'none', borderRadius: 4, padding: '8px 10px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                Save Snapshot
              </button>
              <button
                onClick={() => selectedSnapshotId && deleteSnapshot(selectedSnapshotId)}
                disabled={!selectedSnapshotId}
                style={{ background: selectedSnapshotId ? '#ef4444' : 'var(--text-4)', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 10px', fontWeight: 700, fontSize: 12, cursor: selectedSnapshotId ? 'pointer' : 'not-allowed' }}
              >
                Delete
              </button>
            </div>
          </div>
          {selectedSnapshot && (
            <div style={{ marginTop: 8, color: 'var(--text-4)', fontSize: 12 }}>
              Active snapshot: <b style={{ color: 'var(--text-2)' }}>{selectedSnapshot.name}</b>
            </div>
          )}
        </div>

        <div style={{ ...cardStyle, marginBottom: 12 }}>
          <div style={{ fontFamily: mono, color: 'var(--text-3)', fontSize: 11, marginBottom: 8 }}>SNAPSHOT COMPARE</div>
          {snapshots.length < 2 ? (
            <div style={{ color: 'var(--text-4)', fontSize: 12 }}>
              Save at least 2 snapshots to compare concentration, beta, and scenario impact.
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <select
                  value={compareBaseId}
                  onChange={(e) => setCompareBaseId(e.target.value)}
                  style={{ background: 'var(--surface-hi)', border: '1px solid var(--border)', color: 'var(--text-1)', borderRadius: 4, padding: '7px 8px', fontSize: 12 }}
                >
                  {snapshots.map((s) => (
                    <option key={`base-${s.id}`} value={s.id}>
                      Baseline: {s.name}
                    </option>
                  ))}
                </select>
                <select
                  value={compareTargetId}
                  onChange={(e) => setCompareTargetId(e.target.value)}
                  style={{ background: 'var(--surface-hi)', border: '1px solid var(--border)', color: 'var(--text-1)', borderRadius: 4, padding: '7px 8px', fontSize: 12 }}
                >
                  {snapshots.map((s) => (
                    <option key={`target-${s.id}`} value={s.id}>
                      Candidate: {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
                <div style={{ color: 'var(--text-4)', fontSize: 12 }}>
                  Promote candidate to active portfolio and refresh all risk modules instantly.
                </div>
                <button
                  onClick={promoteCandidateSnapshot}
                  disabled={!compareTargetId || loading === 'refresh'}
                  style={{
                    background: 'var(--gold)',
                    color: '#111827',
                    border: '1px solid rgba(200,157,31,0.3)',
                    borderRadius: 4,
                    padding: '8px 10px',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: !compareTargetId || loading === 'refresh' ? 'not-allowed' : 'pointer',
                    opacity: !compareTargetId || loading === 'refresh' ? 0.6 : 1,
                  }}
                >
                  {loading === 'refresh' ? 'Refreshing...' : 'Promote Candidate & Re-run'}
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr .9fr .9fr .9fr', gap: 8, fontSize: 12 }}>
                <div style={{ color: 'var(--text-4)' }}>Metric</div>
                <div style={{ color: 'var(--text-4)' }}>Baseline</div>
                <div style={{ color: 'var(--text-4)' }}>Candidate</div>
                <div style={{ color: 'var(--text-4)' }}>Delta</div>

                <div style={{ color: 'var(--text-3)' }}>Single-name concentration</div>
                <div style={{ color: 'var(--text-2)' }}>{fmtPct(baseMetrics.maxWeight)}</div>
                <div style={{ color: 'var(--text-2)' }}>{fmtPct(targetMetrics.maxWeight)}</div>
                <div style={{ color: targetMetrics.maxWeight - baseMetrics.maxWeight > 0 ? '#ef4444' : '#22c55e' }}>
                  {fmtPct(targetMetrics.maxWeight - baseMetrics.maxWeight)}
                </div>

                <div style={{ color: 'var(--text-3)' }}>Weighted beta</div>
                <div style={{ color: 'var(--text-2)' }}>{baseMetrics.weightedBeta.toFixed(2)}</div>
                <div style={{ color: 'var(--text-2)' }}>{targetMetrics.weightedBeta.toFixed(2)}</div>
                <div style={{ color: targetMetrics.weightedBeta - baseMetrics.weightedBeta > 0 ? '#ef4444' : '#22c55e' }}>
                  {(targetMetrics.weightedBeta - baseMetrics.weightedBeta).toFixed(2)}
                </div>

                <div style={{ color: 'var(--text-3)' }}>{scenario.label} impact</div>
                <div style={{ color: 'var(--text-2)' }}>{fmtPct(baseMetrics.scenarioImpact)}</div>
                <div style={{ color: 'var(--text-2)' }}>{fmtPct(targetMetrics.scenarioImpact)}</div>
                <div style={{ color: targetMetrics.scenarioImpact - baseMetrics.scenarioImpact > 0 ? '#ef4444' : '#22c55e' }}>
                  {fmtPct(targetMetrics.scenarioImpact - baseMetrics.scenarioImpact)}
                </div>

                <div style={{ color: 'var(--text-3)' }}>Number of names</div>
                <div style={{ color: 'var(--text-2)' }}>{baseMetrics.names}</div>
                <div style={{ color: 'var(--text-2)' }}>{targetMetrics.names}</div>
                <div style={{ color: targetMetrics.names - baseMetrics.names >= 0 ? '#22c55e' : '#f59e0b' }}>
                  {targetMetrics.names - baseMetrics.names >= 0 ? '+' : ''}{targetMetrics.names - baseMetrics.names}
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, alignItems: 'start' }}>
          <div style={cardStyle}>
            <div style={{ fontFamily: mono, color: 'var(--text-3)', fontSize: 11, marginBottom: 8 }}>POSITIONS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .7fr 1fr .6fr', gap: 8, marginBottom: 8, fontSize: 11, color: 'var(--text-4)' }}>
              <div>Ticker</div><div>Weight</div><div>Sector</div><div>Beta</div>
            </div>
            {positions.map((p, i) => (
              <div key={`${p.ticker}-${i}`} style={{ display: 'grid', gridTemplateColumns: '1.2fr .7fr 1fr .6fr', gap: 8, marginBottom: 8 }}>
                <input value={p.ticker} onChange={e => setPositions(prev => prev.map((x, idx) => idx === i ? { ...x, ticker: e.target.value.toUpperCase() } : x))} style={{ background: 'var(--surface-hi)', border: '1px solid var(--border)', color: 'var(--text-1)', borderRadius: 4, padding: '6px 8px', fontSize: 12 }} />
                <input type="number" step="0.01" value={p.weight} onChange={e => setPositions(prev => prev.map((x, idx) => idx === i ? { ...x, weight: Number(e.target.value) } : x))} style={{ background: 'var(--surface-hi)', border: '1px solid var(--border)', color: 'var(--text-1)', borderRadius: 4, padding: '6px 8px', fontSize: 12 }} />
                <input value={p.sector} onChange={e => setPositions(prev => prev.map((x, idx) => idx === i ? { ...x, sector: e.target.value } : x))} style={{ background: 'var(--surface-hi)', border: '1px solid var(--border)', color: 'var(--text-1)', borderRadius: 4, padding: '6px 8px', fontSize: 12 }} />
                <input type="number" step="0.01" value={p.beta} onChange={e => setPositions(prev => prev.map((x, idx) => idx === i ? { ...x, beta: Number(e.target.value) } : x))} style={{ background: 'var(--surface-hi)', border: '1px solid var(--border)', color: 'var(--text-1)', borderRadius: 4, padding: '6px 8px', fontSize: 12 }} />
              </div>
            ))}
          </div>

          <div style={cardStyle}>
            <div style={{ fontFamily: mono, color: 'var(--text-3)', fontSize: 11, marginBottom: 8 }}>CANDIDATE TRADE</div>
            <div style={{ marginBottom: 8 }}>
              <TickerAutocomplete
                value={trade.ticker}
                onChange={(v) => setTrade((prev) => ({ ...prev, ticker: normalizeTradeTicker(v) }))}
                onSelect={(company) => {
                  setTrade((prev) => ({ ...prev, ticker: normalizeTradeTicker(company?.ticker || prev.ticker) }));
                  setTradeMeta(company || null);
                }}
                placeholder="Search ticker/company for candidate trade…"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <select value={trade.side} onChange={e => setTrade(t => ({ ...t, side: e.target.value }))} style={{ background: 'var(--surface-hi)', border: '1px solid var(--border)', color: 'var(--text-1)', borderRadius: 4, padding: '7px 8px', fontSize: 12 }}>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
              <input type="number" step="0.01" value={trade.weight_delta} onChange={e => setTrade(t => ({ ...t, weight_delta: Number(e.target.value) }))} style={{ background: 'var(--surface-hi)', border: '1px solid var(--border)', color: 'var(--text-1)', borderRadius: 4, padding: '7px 8px', fontSize: 12 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <input
                type="number"
                step="1000"
                value={portfolioValue}
                onChange={(e) => setPortfolioValue(Number(e.target.value))}
                style={{ background: 'var(--surface-hi)', border: '1px solid var(--border)', color: 'var(--text-1)', borderRadius: 4, padding: '7px 8px', fontSize: 12 }}
              />
              <button
                onClick={runFullRiskCheck}
                disabled={loading === 'refresh'}
                style={{
                  background: 'var(--surface-hi)',
                  color: 'var(--text-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  padding: '7px 10px',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: loading === 'refresh' ? 'not-allowed' : 'pointer',
                  opacity: loading === 'refresh' ? 0.7 : 1,
                }}
              >
                {loading === 'refresh' ? 'Running full check...' : 'Run Full Risk Check'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <select
                value={tradeObjective}
                onChange={(e) => applyTradeObjective(e.target.value)}
                style={{ background: 'var(--surface-hi)', border: '1px solid var(--border)', color: 'var(--text-1)', borderRadius: 4, padding: '7px 8px', fontSize: 12 }}
              >
                <option value="conservative">Conservative sizing</option>
                <option value="moderate">Moderate sizing</option>
                <option value="aggressive">Aggressive sizing</option>
              </select>
              <button
                onClick={() => applyTradeDelta(suggestedDelta, 'Applied suggested delta')}
                style={{ background: 'var(--gold)', color: '#111827', border: '1px solid rgba(200,157,31,0.3)', borderRadius: 4, padding: '7px 10px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
              >
                Use {fmtPct(suggestedDelta).replace('+', '')}
              </button>
            </div>
            <div style={{ marginBottom: 10, color: 'var(--text-4)', fontSize: 11 }}>
              Suggested {trade.side} delta for {tradeObjective} risk: <b style={{ color: 'var(--text-2)' }}>{fmtPct(suggestedDelta).replace('+', '')}</b>
            </div>
            <div style={{ marginBottom: 10, color: 'var(--text-4)', fontSize: 12 }}>
              {loadingTradePrice ? (
                'Fetching current price...'
              ) : tradePrice?.price ? (
                <>
                  Current price ({tradePrice.symbol}):{' '}
                  <b style={{ color: 'var(--text-1)' }}>
                    {tradeCurrency === 'INR' ? '₹' : '$'}{tradePrice.price.toLocaleString()}
                  </b>
                  {' · '}
                  <span style={{ color: tradePrice.changePct >= 0 ? '#22c55e' : '#ef4444' }}>
                    {tradePrice.changePct >= 0 ? '+' : ''}{tradePrice.changePct.toFixed(2)}%
                  </span>
                </>
              ) : (
                'Current price unavailable for selected ticker.'
              )}
            </div>
            <div style={{ marginBottom: 10, color: 'var(--text-4)', fontSize: 11 }}>
              Estimated order notional: <b style={{ color: 'var(--text-2)' }}>{tradeCurrency === 'INR' ? '₹' : '$'}{estimatedNotional.toLocaleString()}</b>
              {' · '}
              Projected {normalizeTradeTicker(trade.ticker) || 'ticker'} weight: <b style={{ color: projectedTickerWeight > 0.2 ? '#ef4444' : '#22c55e' }}>{fmtPct(projectedTickerWeight).replace('+', '')}</b>
            </div>
            <div style={{ background: 'var(--surface-hi)', border: '1px solid var(--border)', borderRadius: 6, padding: 10, marginBottom: 10 }}>
              <div style={{ fontFamily: mono, color: 'var(--text-2)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 6 }}>TRADER PLAN (ENTRY / STOP / TARGET)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input
                  type="number"
                  step="0.01"
                  value={tradePlan.entry}
                  onChange={(e) => setTradePlan((p) => ({ ...p, entry: Number(e.target.value) }))}
                  placeholder="Entry"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-1)', borderRadius: 4, padding: '6px 8px', fontSize: 12 }}
                />
                <input
                  type="number"
                  step="0.01"
                  value={tradePlan.stop}
                  onChange={(e) => setTradePlan((p) => ({ ...p, stop: Number(e.target.value) }))}
                  placeholder="Stop"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-1)', borderRadius: 4, padding: '6px 8px', fontSize: 12 }}
                />
                <input
                  type="number"
                  step="0.01"
                  value={tradePlan.target}
                  onChange={(e) => setTradePlan((p) => ({ ...p, target: Number(e.target.value) }))}
                  placeholder="Target"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-1)', borderRadius: 4, padding: '6px 8px', fontSize: 12 }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input
                  type="number"
                  step="0.001"
                  value={tradePlan.maxRiskPct}
                  onChange={(e) => setTradePlan((p) => ({ ...p, maxRiskPct: Number(e.target.value) }))}
                  placeholder="Max risk %"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-1)', borderRadius: 4, padding: '6px 8px', fontSize: 12 }}
                />
                <button
                  onClick={() => applyTradeDelta(Math.max(0.005, Math.min(0.25, tradePlanMetrics.impliedWeight || 0.01)), 'Applied delta from trade plan')}
                  style={{ background: 'var(--gold)', color: '#111827', border: '1px solid rgba(200,157,31,0.3)', borderRadius: 4, padding: '6px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Apply implied weight
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8, marginBottom: 8 }}>
                <input
                  type="number"
                  step="0.05"
                  value={tradePlan.t1Pct}
                  onChange={(e) => setTradePlan((p) => ({ ...p, t1Pct: Number(e.target.value) }))}
                  placeholder="T1 %"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-1)', borderRadius: 4, padding: '6px 8px', fontSize: 12 }}
                />
                <input
                  type="number"
                  step="0.05"
                  value={tradePlan.t1R}
                  onChange={(e) => setTradePlan((p) => ({ ...p, t1R: Number(e.target.value) }))}
                  placeholder="T1 R"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-1)', borderRadius: 4, padding: '6px 8px', fontSize: 12 }}
                />
                <input
                  type="number"
                  step="0.05"
                  value={tradePlan.t2Pct}
                  onChange={(e) => setTradePlan((p) => ({ ...p, t2Pct: Number(e.target.value) }))}
                  placeholder="T2 %"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-1)', borderRadius: 4, padding: '6px 8px', fontSize: 12 }}
                />
                <input
                  type="number"
                  step="0.05"
                  value={tradePlan.t2R}
                  onChange={(e) => setTradePlan((p) => ({ ...p, t2R: Number(e.target.value) }))}
                  placeholder="T2 R"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-1)', borderRadius: 4, padding: '6px 8px', fontSize: 12 }}
                />
                <button
                  onClick={() => setTradePlan((p) => ({ ...p, trailRunner: !p.trailRunner }))}
                  style={{ background: tradePlan.trailRunner ? 'var(--gold)' : 'var(--surface)', color: tradePlan.trailRunner ? '#111827' : 'var(--text-2)', border: `1px solid ${tradePlan.trailRunner ? 'rgba(200,157,31,0.35)' : 'var(--border)'}`, borderRadius: 4, padding: '6px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  {tradePlan.trailRunner ? 'Trail ON' : 'Trail OFF'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {Object.keys(STRATEGY_PRESETS).map((k) => (
                  <button
                    key={k}
                    onClick={() => applyStrategyPreset(k)}
                    style={{
                      background: strategyPreset === k ? 'var(--gold)' : 'var(--surface)',
                      color: strategyPreset === k ? '#111827' : 'var(--text-2)',
                      border: `1px solid ${strategyPreset === k ? 'rgba(200,157,31,0.35)' : 'var(--border)'}`,
                      borderRadius: 999,
                      padding: '4px 9px',
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      cursor: 'pointer',
                    }}
                  >
                    {k}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-4)', lineHeight: 1.5 }}>
                Risk budget: <b style={{ color: 'var(--text-2)' }}>{tradeCurrency === 'INR' ? '₹' : '$'}{tradePlanMetrics.riskBudget.toLocaleString()}</b>
                {' · '}
                Qty: <b style={{ color: 'var(--text-2)' }}>{tradePlanMetrics.qty.toLocaleString()}</b>
                {' · '}
                Notional: <b style={{ color: 'var(--text-2)' }}>{tradeCurrency === 'INR' ? '₹' : '$'}{tradePlanMetrics.notional.toLocaleString()}</b>
                {' · '}
                R:R: <b style={{ color: tradePlanMetrics.rr >= 2 ? '#22c55e' : '#f59e0b' }}>{tradePlanMetrics.rr ? tradePlanMetrics.rr.toFixed(2) : '-'}</b>
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-4)', lineHeight: 1.5 }}>
                T1 @{tradePlanMetrics.t1R.toFixed(2)}R: <b style={{ color: 'var(--text-2)' }}>{tradePlanMetrics.t1Price > 0 ? tradePlanMetrics.t1Price.toFixed(2) : '-'}</b>
                {' · '}
                T2 @{tradePlanMetrics.t2R.toFixed(2)}R: <b style={{ color: 'var(--text-2)' }}>{tradePlanMetrics.t2Price > 0 ? tradePlanMetrics.t2Price.toFixed(2) : '-'}</b>
                {' · '}
                Runner: <b style={{ color: 'var(--text-2)' }}>{(tradePlanMetrics.runnerPct * 100).toFixed(0)}%</b>
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-4)', lineHeight: 1.5 }}>
                Blended R estimate: <b style={{ color: tradePlanMetrics.blendedR >= 2 ? '#22c55e' : '#f59e0b' }}>{tradePlanMetrics.blendedR.toFixed(2)}R</b>
                {' · '}
                Expected plan P&L: <b style={{ color: tradePlanMetrics.expectedPlanPnl >= 0 ? '#22c55e' : '#ef4444' }}>{tradeCurrency === 'INR' ? '₹' : '$'}{tradePlanMetrics.expectedPlanPnl.toLocaleString()}</b>
              </div>
              {tradePlanMetrics.allocUsed > 1 && (
                <div style={{ marginTop: 4, fontSize: 11, color: '#ef4444' }}>
                  T1% + T2% exceeds 100%. Reduce allocations.
                </div>
              )}
              <div style={{ marginTop: 4, fontSize: 11, color: tradePlanMetrics.directionOk ? '#22c55e' : '#ef4444' }}>
                {tradePlanMetrics.directionOk
                  ? 'Plan structure looks valid for selected side.'
                  : 'Check plan structure: for BUY use stop < entry < target; for SELL use target < entry < stop.'}
              </div>
            </div>

            <div style={{ fontFamily: mono, color: 'var(--text-3)', fontSize: 11, marginTop: 10, marginBottom: 6 }}>SCENARIO</div>
            <select value={scenarioId} onChange={e => applyScenario(e.target.value)} style={{ width: '100%', marginBottom: 10, background: 'var(--surface-hi)', border: '1px solid var(--border)', color: 'var(--text-1)', borderRadius: 4, padding: '7px 8px', fontSize: 12 }}>
              {SCENARIOS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>

            <div style={{ display: 'grid', gap: 8 }}>
              <button onClick={runPreTrade} style={{ background: 'var(--gold)', color: '#111827', border: 'none', borderRadius: 4, padding: '8px 10px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{loading === 'pretrade' ? 'Running...' : 'Run Pre-Trade Impact'}</button>
              <button onClick={runStress} style={{ background: 'var(--surface-hi)', color: 'var(--text-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '8px 10px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{loading === 'stress' ? 'Running...' : 'Run Scenario Stress'}</button>
              <button onClick={runCorrelation} style={{ background: 'var(--surface-hi)', color: 'var(--text-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '8px 10px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{loading === 'corr' ? 'Running...' : 'Run Correlation Scan'}</button>
              <button onClick={runHedges} style={{ background: 'var(--surface-hi)', color: 'var(--text-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '8px 10px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{loading === 'hedge' ? 'Running...' : 'Get Hedge Suggestions'}</button>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginTop: 12 }}>
          <div style={cardStyle}>
            <div style={{ fontFamily: mono, color: 'var(--text-3)', fontSize: 11, marginBottom: 10 }}>PRE-TRADE IMPACT</div>
            {!preTrade ? <div style={{ color: 'var(--text-4)', fontSize: 12 }}>Run pre-trade simulation to view before/after risk metrics.</div> : (
              <>
                <div style={{ color: 'var(--text-1)', fontSize: 12, marginBottom: 8 }}>Verdict: <b>{preTrade.verdict}</b></div>
                {['portfolio_var_1d', 'expected_vol_annual', 'max_sector_weight', 'beta_proxy'].map(k => (
                  <div key={k} style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr .8fr .8fr', gap: 8, fontSize: 12, marginBottom: 6 }}>
                    <div style={{ color: 'var(--text-4)' }}>{k}</div>
                    <div style={{ color: 'var(--text-3)' }}>{fmtPct(preTrade.before?.[k])}</div>
                    <div style={{ color: 'var(--text-3)' }}>{fmtPct(preTrade.after?.[k])}</div>
                    <div style={{ color: preTrade.delta?.[k] > 0 ? '#ef4444' : '#22c55e' }}>{fmtPct(preTrade.delta?.[k])}</div>
                  </div>
                ))}
              </>
            )}
          </div>

          <div style={cardStyle}>
            <div style={{ fontFamily: mono, color: 'var(--text-3)', fontSize: 11, marginBottom: 10 }}>SCENARIO STRESS</div>
            {!stress ? <div style={{ color: 'var(--text-4)', fontSize: 12 }}>Run scenario stress test to estimate portfolio impact.</div> : (
              <>
                <div style={{ color: 'var(--text-1)', fontSize: 12, marginBottom: 8 }}>
                  Scenario: <b>{stress.scenario}</b> · Impact: <b style={{ color: stress.portfolio_impact_pct < 0 ? '#ef4444' : '#22c55e' }}>{fmtPct(stress.portfolio_impact_pct)}</b>
                </div>
                {(stress.per_position || []).slice(0, 4).map((r) => (
                  <div key={r.ticker} style={{ display: 'grid', gridTemplateColumns: '1fr .7fr .7fr', gap: 8, fontSize: 12, marginBottom: 6 }}>
                    <div style={{ color: 'var(--text-3)' }}>{r.ticker}</div>
                    <div style={{ color: r.impact_pct < 0 ? '#ef4444' : '#22c55e' }}>{fmtPct(r.impact_pct)}</div>
                    <div style={{ color: 'var(--text-4)' }}>{fmtPct(r.contribution_pct)}</div>
                  </div>
                ))}
              </>
            )}
          </div>

          <div style={cardStyle}>
            <div style={{ fontFamily: mono, color: 'var(--text-3)', fontSize: 11, marginBottom: 10 }}>CORRELATION HOTSPOTS</div>
            {!corr ? <div style={{ color: 'var(--text-4)', fontSize: 12 }}>Run correlation scan to detect duplicate bets.</div> : (
              <>
                {(corr.high_corr_pairs || []).length === 0 ? (
                  <div style={{ color: '#22c55e', fontSize: 12 }}>No high-correlation pairs above threshold.</div>
                ) : (
                  (corr.high_corr_pairs || []).slice(0, 6).map((p, i) => (
                    <div key={`${p.a}-${p.b}-${i}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr .6fr', gap: 8, fontSize: 12, marginBottom: 6 }}>
                      <div style={{ color: 'var(--text-3)' }}>{p.a}</div>
                      <div style={{ color: 'var(--text-3)' }}>{p.b}</div>
                      <div style={{ color: '#f59e0b', textAlign: 'right' }}>{p.corr}</div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>

          <div style={cardStyle}>
            <div style={{ fontFamily: mono, color: 'var(--text-3)', fontSize: 11, marginBottom: 10 }}>HEDGE SUGGESTIONS</div>
            {!hedges ? <div style={{ color: 'var(--text-4)', fontSize: 12 }}>Generate trims/adds to reduce concentration and VaR.</div> : (
              <>
                {(hedges.recommendations || []).slice(0, 6).map((r, i) => (
                  <div key={`${r.ticker}-${i}`} style={{ display: 'grid', gridTemplateColumns: '.6fr 1fr .7fr', gap: 8, fontSize: 12, marginBottom: 6 }}>
                    <div style={{ color: r.action === 'add' ? '#22c55e' : '#f59e0b', textTransform: 'uppercase' }}>{r.action}</div>
                    <div style={{ color: 'var(--text-3)' }}>{r.ticker}</div>
                    <div style={{ color: 'var(--text-4)', textAlign: 'right' }}>{r.from_weight} → {r.to_weight}</div>
                  </div>
                ))}
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-4)' }}>
                  Expected VaR reduction: <b style={{ color: '#22c55e' }}>{hedges.expected_effect?.var_reduction_bps || 0} bps</b>
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ ...cardStyle, marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: mono, color: 'var(--text-3)', fontSize: 11 }}>IC NOTE EXPORT</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={copyIcNote}
                style={{ background: 'var(--gold)', color: '#111827', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 700, padding: '5px 8px', cursor: 'pointer' }}
              >
                {icCopied ? 'Copied' : 'Copy IC Note'}
              </button>
              <button
                onClick={downloadIcNote}
                style={{ background: 'var(--surface-hi)', color: 'var(--text-2)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 11, fontWeight: 700, padding: '5px 8px', cursor: 'pointer' }}
              >
                Download .txt
              </button>
            </div>
          </div>
          <div style={{ color: 'var(--text-4)', fontSize: 12, marginBottom: 10 }}>
            One-click investment committee memo generated from current risk outputs and audit events.
          </div>
          <textarea
            value={icNoteText}
            readOnly
            style={{
              width: '100%',
              minHeight: 150,
              background: 'var(--surface-hi)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--text-2)',
              fontSize: 12,
              padding: '8px 10px',
              fontFamily: mono,
              marginBottom: 12,
              resize: 'vertical',
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontFamily: mono, color: 'var(--text-3)', fontSize: 11 }}>RISK AUDIT TRAIL</div>
            {auditTrail.length > 0 && (
              <button
                onClick={() => setAuditTrail([])}
                style={{ background: 'var(--surface-hi)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-4)', fontSize: 11, padding: '4px 8px', cursor: 'pointer' }}
              >
                Clear
              </button>
            )}
          </div>
          {auditTrail.length === 0 ? (
            <div style={{ color: 'var(--text-4)', fontSize: 12 }}>
              No actions logged yet. Your trade adjustments and risk runs will appear here.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {auditTrail.map((row) => (
                <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '.55fr 1.2fr 2.4fr', gap: 8, fontSize: 12, alignItems: 'center' }}>
                  <div style={{ color: 'var(--text-4)', fontFamily: mono }}>{formatAuditTime(row.at)}</div>
                  <div style={{ color: 'var(--text-2)' }}>{row.action}</div>
                  <div style={{ color: 'var(--text-4)' }}>{row.detail}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
