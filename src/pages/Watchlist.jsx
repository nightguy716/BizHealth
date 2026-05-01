import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import TickerAutocomplete from '../components/TickerAutocomplete';
import { ownerHeaders } from '../lib/ownerHeaders';
import { getBackendBaseUrl } from '../lib/backendUrl';

const API = getBackendBaseUrl();
const API_FALLBACK = 'https://bizhealth-production.up.railway.app';
const POLL_MS  = 60_000;   // base 60 seconds
const PRICE_REQUESTS_BUDGET_PER_HOUR = 220;
const NEWS_REQUESTS_BUDGET_PER_HOUR = 60;
const ALERT_PCT = 5;       // notify if |change_pct| > 5%
const ALERT_COOLDOWN_MS = 30 * 60_000; // 30 minutes per ticker unless direction flips

const EMPTY_FORM = { ticker: '', company_name: '', sector: '', currency: 'USD', target_price: '', notes: '' };

/* ── Styles ──────────────────────────────────────────────────── */
const C = {
  bg:      'var(--bg)',
  surface: 'var(--surface)',
  surfHi:  'var(--surface-hi)',
  border:  'var(--border)',
  bActive: 'var(--border-hi)',
  text:    'var(--text-1)',
  text2:   'var(--text-3)',
  muted:   'var(--text-4)',
  blue:    'var(--gold)',
  green:   '#16a34a',
  red:     '#dc2626',
  amber:   '#b45309',
};
const mono = 'var(--font-sans)';
const sans = "'Inter', system-ui, sans-serif";

function toChartSymbol(raw) {
  let t = String(raw || '').trim().toUpperCase();
  if (!t) return 'NYSE:SLB';
  if (t.startsWith('NSE:') || t.startsWith('BSE:') || t.startsWith('NYSE:') || t.startsWith('NASDAQ:')) return t;
  if (t.endsWith('.NS')) return `NSE:${t.replace('.NS', '')}`;
  if (t.endsWith('.BO')) return `BSE:${t.replace('.BO', '')}`;
  return `NYSE:${t}`;
}

async function fetchJsonWithFallback(path) {
  const urls = API === API_FALLBACK ? [API] : [API, API_FALLBACK];
  for (const base of urls) {
    try {
      const res = await fetch(`${base}${path}`, {
        headers: ownerHeaders(),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;
      return await res.json();
    } catch {
      // try next backend candidate
    }
  }
  return null;
}

function ifield(extra = {}) {
  return {
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4,
    padding: '7px 10px', color: C.text, fontSize: 12,
    outline: 'none', width: '100%', fontFamily: sans, ...extra,
  };
}

function FieldRow({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', color: C.muted, textTransform: 'uppercase' }}>
        {label}
      </span>
      {children}
    </label>
  );
}

/* ── WatchCard with live price + news polling ────────────────── */
function WatchCard({ item, onRemove, onEdit, onAlert, pricePollMs, newsPollMs }) {
  const [price,      setPrice]      = useState(null);
  const [news,       setNews]       = useState([]);
  const [loadingPx,  setLoadingPx]  = useState(true);
  const [priceState, setPriceState] = useState('loading'); // loading | ok | rate_limited | unavailable
  const [confirmDel, setConfirmDel] = useState(false);
  const alertStateRef = useRef({ lastDirection: null, lastAt: 0 });
  const latestPriceRef = useRef(null);
  const resolvedSymbolRef = useRef(null);

  function normalizeTicker(raw) {
    let t = String(raw || '').trim().toUpperCase();
    if (!t) return '';
    // Handle common watchlist formats like NSE:SBIN / BSE:TCS / SBIN-EQ.
    if (t.startsWith('NSE:') || t.startsWith('BSE:')) t = t.slice(4);
    if (t.endsWith('-EQ')) t = t.slice(0, -3);
    return t;
  }

  function symbolCandidates() {
    if (resolvedSymbolRef.current) return [resolvedSymbolRef.current];
    const base = normalizeTicker(item.ticker);
    if (!base) return [];
    const hasExchange = base.endsWith('.NS') || base.endsWith('.BO');
    if (hasExchange) return [base];
    // Prefer NSE/BSE first when watchlist currency is INR.
    if (String(item.currency || '').toUpperCase() === 'INR') {
      return [`${base}.NS`, `${base}.BO`, base];
    }
    return [base, `${base}.NS`, `${base}.BO`];
  }

  useEffect(() => {
    latestPriceRef.current = price;
  }, [price]);

  async function fetchJsonWithMeta(path) {
    const urls = API === API_FALLBACK ? [API] : [API, API_FALLBACK];
    let saw429 = false;
    let lastStatus = 0;
    for (const base of urls) {
      try {
        const res = await fetch(`${base}${path}`, {
          headers: ownerHeaders(),
          signal: AbortSignal.timeout(12_000),
        });
        lastStatus = res.status;
        if (res.status === 429) {
          saw429 = true;
          continue;
        }
        if (!res.ok) continue;
        return { data: await res.json(), status: res.status };
      } catch {
        // try next backend candidate
      }
    }
    return { data: null, status: saw429 ? 429 : lastStatus };
  }

  async function fetchPrice() {
    try {
      const symbols = symbolCandidates();
      if (!symbols.length) return false;

      let px = null;
      let pxSymbol = null;
      let saw429 = false;
      for (const sym of symbols) {
        const { data: candidate, status } = await fetchJsonWithMeta(`/stocks/price/${encodeURIComponent(sym)}`);
        if (status === 429) saw429 = true;
        if (Number(candidate?.price) > 0) {
          px = candidate;
          pxSymbol = sym;
          break;
        }
      }
      // Hard fallback: pull latest price from company snapshot endpoint.
      if (!px) {
        for (const sym of symbols) {
          const { data: company, status } = await fetchJsonWithMeta(`/company/yf/${encodeURIComponent(sym)}`);
          if (status === 429) saw429 = true;
          const current = Number(company?.market_data?.currentPrice);
          if (Number.isFinite(current) && current > 0) {
            px = {
              price: current,
              change: Number(company?.market_data?.priceChange || 0),
              change_pct: Number(company?.market_data?.priceChangePct || 0),
              prev_close: Number(company?.market_data?.previousClose || 0),
              volume: Number(company?.market_data?.volume || 0),
              source: 'YF-META',
            };
            pxSymbol = sym;
            break;
          }
        }
      }
      if (!px) {
        setPriceState(saw429 ? 'rate_limited' : 'unavailable');
        return false;
      }
      if (pxSymbol) resolvedSymbolRef.current = pxSymbol;
      setPrice(px);
      setPriceState('ok');
      // fire alert when movement is material, with cooldown to avoid spam
      const changePct = Number(px.change_pct || 0);
      const absMove = Math.abs(changePct);
      const direction = changePct >= 0 ? 'up' : 'down';
      const now = Date.now();
      const { lastDirection, lastAt } = alertStateRef.current;
      const cooldownElapsed = now - lastAt >= ALERT_COOLDOWN_MS;
      const directionFlipped = lastDirection && lastDirection !== direction;

      if (absMove > ALERT_PCT && (cooldownElapsed || directionFlipped || !lastDirection)) {
        alertStateRef.current = { lastDirection: direction, lastAt: now };
        onAlert?.({
          ticker: item.ticker,
          company_name: item.company_name,
          change_pct: changePct,
        });
      }
      return true;
    } catch {
      return false;
    } finally {
      setLoadingPx(false);
    }
  }

  async function fetchNews() {
    try {
      const sym = resolvedSymbolRef.current || normalizeTicker(item.ticker);
      if (!sym) return;
      const payload = await fetchJsonWithFallback(`/stocks/news/${encodeURIComponent(sym)}`);
      if (Array.isArray(payload)) setNews(payload);
    } catch { /* silent */ }
  }

  useEffect(() => {
    let alive = true;
    let priceIntervalId = null;
    let retryTimerId = null;
    setLoadingPx(true);
    setPriceState('loading');

    // Spread requests across cards to reduce rate-limit bursts.
    const jitter = [...item.ticker].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 12000;
    const priceTimer = setTimeout(async () => {
      if (!alive) return;
      const ok = await fetchPrice();
      // One delayed retry to recover from transient 429/network failures.
      if (!ok && alive) {
        retryTimerId = setTimeout(() => {
          if (!alive) return;
          fetchPrice();
        }, 20_000);
      }
      fetchNews();
      priceIntervalId = setInterval(fetchPrice, pricePollMs);
    }, jitter);

    // News can refresh less frequently than prices.
    const newsTimer = setInterval(fetchNews, newsPollMs);

    return () => {
      alive = false;
      clearTimeout(priceTimer);
      if (retryTimerId) clearTimeout(retryTimerId);
      if (priceIntervalId) clearInterval(priceIntervalId);
      clearInterval(newsTimer);
    };
  }, [item.ticker, pricePollMs, newsPollMs]);

  const up  = (price?.change_pct || 0) >= 0;
  const pct = price?.change_pct != null ? `${up ? '+' : ''}${price.change_pct.toFixed(2)}%` : null;
  const chartSymbol = toChartSymbol(resolvedSymbolRef.current || item.ticker);

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4,
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, fontFamily: sans,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Link
              to={`/charts?symbol=${encodeURIComponent(chartSymbol)}`}
              title={`Open ${item.ticker} chart`}
              style={{ fontFamily: mono, fontSize: 14, fontWeight: 600, color: C.text, textDecoration: 'none' }}
            >
              {item.ticker}
            </Link>
            {item.sector && (
              <span style={{
                fontFamily: mono, fontSize: 10, color: C.blue,
                border: `1px solid ${C.blue}`, borderRadius: 3, padding: '1px 5px',
              }}>{item.sector}</span>
            )}
          </div>
          {item.company_name && (
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{item.company_name}</div>
          )}
        </div>
        <button
          onClick={() => setConfirmDel(true)}
          style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2 }}
        >×</button>
      </div>

      {/* Price row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {loadingPx ? (
          <span style={{ fontFamily: mono, fontSize: 12, color: C.muted }}>Fetching price…</span>
        ) : price?.price ? (
          <>
            <span style={{ fontFamily: mono, fontSize: 20, fontWeight: 600, color: C.text }}>
              {item.currency === 'INR' ? '₹' : '$'}{price.price.toLocaleString()}
            </span>
            {pct && (
              <span style={{
                fontFamily: mono, fontSize: 11, fontWeight: 500,
                color: up ? C.green : C.red, border: `1px solid ${up ? C.green : C.red}`,
                borderRadius: 3, padding: '2px 7px',
              }}>
                {up ? 'UP' : 'DOWN'} {pct}
              </span>
            )}
          </>
        ) : priceState === 'rate_limited' ? (
          <span style={{ fontFamily: mono, fontSize: 12, color: C.amber }}>Live quote throttled. Retrying…</span>
        ) : (
          <span style={{ fontFamily: mono, fontSize: 12, color: C.muted }}>Price unavailable</span>
        )}
        {item.target_price && (
          <span style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>
            Target <span style={{ fontFamily: mono, color: C.text2 }}>
              {item.currency === 'INR' ? '₹' : '$'}{Number(item.target_price).toLocaleString()}
            </span>
          </span>
        )}
      </div>

      {/* News */}
      {news.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
          {news.slice(0, 3).map((n, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <a href={n.url} target="_blank" rel="noopener noreferrer" style={{
                fontSize: 11, color: C.text2, textDecoration: 'none', lineHeight: 1.35, flex: 1,
              }}
              onMouseEnter={e => e.target.style.color = C.text}
              onMouseLeave={e => e.target.style.color = C.text2}
              >{n.title}</a>
              <span style={{ fontFamily: mono, fontSize: 9, color: C.muted, whiteSpace: 'nowrap', alignSelf: 'flex-start' }}>
                {n.publisher}
              </span>
            </div>
          ))}
        </div>
      )}

      {item.notes && (
        <p style={{ margin: 0, fontSize: 11, color: C.text2, lineHeight: 1.45 }}>{item.notes}</p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <Link to={`/dashboard?symbol=${encodeURIComponent(item.ticker)}${item.company_name ? `&name=${encodeURIComponent(item.company_name)}` : ''}`} style={{
          fontFamily: sans, fontSize: 12, fontWeight: 500, color: C.blue,
          border: `1px solid ${C.blue}`, borderRadius: 4, padding: '4px 12px',
          textDecoration: 'none',
        }}>
          Analyse →
        </Link>
        <Link
          to={`/charts?symbol=${encodeURIComponent(chartSymbol)}`}
          style={{
            fontFamily: sans, fontSize: 12, color: C.text2,
            background: 'none', border: `1px solid ${C.border}`, borderRadius: 4,
            padding: '4px 10px', textDecoration: 'none',
          }}
        >
          Chart
        </Link>
        <button onClick={() => onEdit(item)} style={{
          fontFamily: sans, fontSize: 12, color: C.text2,
          background: 'none', border: `1px solid ${C.border}`, borderRadius: 4,
          padding: '4px 10px', cursor: 'pointer',
        }}>Edit</button>

        {confirmDel ? (
          <>
            <button onClick={() => onRemove(item.ticker)} style={{
              fontFamily: sans, fontSize: 12, color: C.red, background: 'none',
              border: `1px solid ${C.red}`, borderRadius: 4, padding: '4px 10px', cursor: 'pointer',
            }}>Confirm</button>
            <button onClick={() => setConfirmDel(false)} style={{
              fontFamily: sans, fontSize: 12, color: C.muted, background: 'none',
              border: `1px solid ${C.border}`, borderRadius: 4, padding: '4px 8px', cursor: 'pointer',
            }}>Cancel</button>
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────── */
export default function Watchlist() {
  const { isAuthenticated, loading, getWatchlist, addToWatchlist, removeFromWatchlist, createNotification } = useAuth();
  const navigate = useNavigate();

  const [items,     setItems]     = useState([]);
  const [fetching,  setFetching]  = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [editTicker, setEditTicker] = useState(null);

  // Keep polling under backend rate limits as list size grows.
  const itemCount = Math.max(items.length || 0, 1);
  const pricePollMs = Math.max(POLL_MS, Math.ceil((3600_000 * itemCount) / PRICE_REQUESTS_BUDGET_PER_HOUR));
  const newsPollMs = Math.max(5 * 60_000, Math.ceil((3600_000 * itemCount) / NEWS_REQUESTS_BUDGET_PER_HOUR));

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate('/auth');
  }, [loading, isAuthenticated, navigate]);

  const load = useCallback(async () => {
    setFetching(true);
    const data = await getWatchlist();
    setItems(data);
    setFetching(false);
  }, [getWatchlist]);

  useEffect(() => { if (isAuthenticated) load(); }, [isAuthenticated, load]);

  function field(key) {
    return (e) => setForm(f => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.ticker.trim()) return;
    setSaving(true);
    try {
      await addToWatchlist({
        ticker:       form.ticker.toUpperCase(),
        company_name: form.company_name || null,
        sector:       form.sector       || null,
        currency:     form.currency     || 'USD',
        target_price: form.target_price ? parseFloat(form.target_price) : null,
        notes:        form.notes        || null,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      setEditTicker(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(ticker) {
    await removeFromWatchlist(ticker);
    await load();
  }

  function handleEdit(item) {
    setForm({
      ticker:       item.ticker,
      company_name: item.company_name || '',
      sector:       item.sector       || '',
      currency:     item.currency     || 'USD',
      target_price: item.target_price ?? '',
      notes:        item.notes        || '',
    });
    setEditTicker(item.ticker);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleAlert({ ticker, company_name, change_pct }) {
    if (!createNotification) return;
    const dir = change_pct > 0 ? 'up' : 'down';
    await createNotification({
      type:    'price_alert',
      ticker,
      title:   `${ticker} moved ${Math.abs(change_pct).toFixed(1)}% ${dir}`,
      message: `${company_name || ticker} has moved ${change_pct > 0 ? '+' : ''}${change_pct.toFixed(2)}% today.`,
    });
  }

  if (loading || (!isAuthenticated && !loading)) return null;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingTop: '5rem', fontFamily: sans }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.1em', color: C.muted, marginBottom: 4 }}>WATCHLIST</div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text }}>My Companies</h1>
            <p style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>
              {items.length} {items.length === 1 ? 'company' : 'companies'} tracked · prices auto-update every 60s
            </p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setForm(EMPTY_FORM); setEditTicker(null); }}
            style={{
              fontFamily: sans, fontSize: 12, fontWeight: 500,
              color: showForm ? C.text2 : '#fff',
              background: showForm ? 'none' : C.blue,
              border: `1px solid ${showForm ? C.border : C.blue}`,
              borderRadius: 4, padding: '8px 16px', cursor: 'pointer',
            }}
          >
            {showForm ? 'Cancel' : '+ Add Company'}
          </button>
        </div>

        {/* Add / edit form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4,
              padding: '1.25rem', marginBottom: 20,
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12,
            }}
          >
            <div style={{ gridColumn: '1 / -1' }}>
              <FieldRow label="Company / Ticker *">
                {editTicker ? (
                  <input style={ifield()} value={form.ticker} disabled />
                ) : (
                  <TickerAutocomplete
                    value={form.ticker}
                    onChange={val => setForm(f => ({ ...f, ticker: val.toUpperCase() }))}
                    onSelect={c => setForm(f => ({
                      ...f,
                      ticker:       c.ticker,
                      company_name: c.name     || f.company_name,
                      sector:       c.sector   || f.sector,
                      currency:     c.currency || f.currency,
                    }))}
                    placeholder="Search ticker or company name…"
                  />
                )}
              </FieldRow>
            </div>
            <FieldRow label="Company Name">
              <input style={ifield()} value={form.company_name} onChange={field('company_name')} placeholder="Auto-filled" />
            </FieldRow>
            <FieldRow label="Sector">
              <input style={ifield()} value={form.sector} onChange={field('sector')} placeholder="Auto-filled" />
            </FieldRow>
            <FieldRow label="Currency">
              <input style={ifield()} value={form.currency} onChange={field('currency')} placeholder="USD / INR" />
            </FieldRow>
            <FieldRow label="Target Price">
              <input style={ifield()} type="number" step="any" value={form.target_price} onChange={field('target_price')} placeholder="0.00" />
            </FieldRow>
            <div style={{ gridColumn: '1 / -1' }}>
              <FieldRow label="Notes">
                <textarea style={{ ...ifield(), resize: 'vertical' }} rows={2} value={form.notes} onChange={field('notes')} placeholder="Why are you watching this?" />
              </FieldRow>
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => { setShowForm(false); setEditTicker(null); }} style={{
                ...ifield({ width: 'auto', cursor: 'pointer', padding: '6px 14px', fontFamily: sans }),
              }}>Cancel</button>
              <button type="submit" disabled={saving} style={{
                padding: '6px 18px', background: C.blue, color: '#fff', border: 'none',
                borderRadius: 4, fontWeight: 500, fontSize: 12, fontFamily: sans, cursor: 'pointer',
              }}>
                {saving ? 'Saving…' : editTicker ? 'Update' : 'Add to Watchlist'}
              </button>
            </div>
          </form>
        )}

        {/* Grid */}
        {fetching ? (
          <p style={{ color: C.muted, textAlign: 'center', padding: '3rem', fontFamily: mono, fontSize: 12 }}>Loading…</p>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: C.muted }}>
            <p style={{ fontFamily: mono, fontSize: 12, marginBottom: 8 }}>No companies tracked.</p>
            <p style={{ fontSize: 12 }}>
              Add one above, or use "Add to Watchlist" from the{' '}
              <Link to="/dashboard" style={{ color: C.blue }}>Dashboard</Link>.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
            {items.map(item => (
              <WatchCard
                key={item.id}
                item={item}
                onRemove={handleRemove}
                onEdit={handleEdit}
                onAlert={handleAlert}
                pricePollMs={pricePollMs}
                newsPollMs={newsPollMs}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
