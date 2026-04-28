import { useEffect, useMemo, useState } from 'react';
import { getBackendBaseUrl } from '../lib/backendUrl';
import { ownerHeaders } from '../lib/ownerHeaders';
import { useAuth } from '../context/AuthContext';

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
        portfolio_value: 1000000,
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
            <input value={trade.ticker} onChange={e => setTrade(t => ({ ...t, ticker: e.target.value.toUpperCase() }))} style={{ width: '100%', marginBottom: 8, background: 'var(--surface-hi)', border: '1px solid var(--border)', color: 'var(--text-1)', borderRadius: 4, padding: '7px 8px', fontSize: 12 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <select value={trade.side} onChange={e => setTrade(t => ({ ...t, side: e.target.value }))} style={{ background: 'var(--surface-hi)', border: '1px solid var(--border)', color: 'var(--text-1)', borderRadius: 4, padding: '7px 8px', fontSize: 12 }}>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
              <input type="number" step="0.01" value={trade.weight_delta} onChange={e => setTrade(t => ({ ...t, weight_delta: Number(e.target.value) }))} style={{ background: 'var(--surface-hi)', border: '1px solid var(--border)', color: 'var(--text-1)', borderRadius: 4, padding: '7px 8px', fontSize: 12 }} />
            </div>

            <div style={{ fontFamily: mono, color: 'var(--text-3)', fontSize: 11, marginTop: 10, marginBottom: 6 }}>SCENARIO</div>
            <select value={scenarioId} onChange={e => setScenarioId(e.target.value)} style={{ width: '100%', marginBottom: 10, background: 'var(--surface-hi)', border: '1px solid var(--border)', color: 'var(--text-1)', borderRadius: 4, padding: '7px 8px', fontSize: 12 }}>
              {SCENARIOS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>

            <div style={{ display: 'grid', gap: 8 }}>
              <button onClick={runPreTrade} style={{ background: 'var(--gold)', color: '#111827', border: 'none', borderRadius: 4, padding: '8px 10px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{loading === 'pretrade' ? 'Running...' : 'Run Pre-Trade Impact'}</button>
              <button onClick={runStress} style={{ background: '#22d3ee', color: '#082f49', border: 'none', borderRadius: 4, padding: '8px 10px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{loading === 'stress' ? 'Running...' : 'Run Scenario Stress'}</button>
              <button onClick={runCorrelation} style={{ background: '#a78bfa', color: '#2e1065', border: 'none', borderRadius: 4, padding: '8px 10px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{loading === 'corr' ? 'Running...' : 'Run Correlation Scan'}</button>
              <button onClick={runHedges} style={{ background: '#34d399', color: '#052e16', border: 'none', borderRadius: 4, padding: '8px 10px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{loading === 'hedge' ? 'Running...' : 'Get Hedge Suggestions'}</button>
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
      </div>
    </div>
  );
}
