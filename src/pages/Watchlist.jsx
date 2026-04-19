import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'https://bizhealth-production.up.railway.app';

const EMPTY_FORM = { ticker: '', company_name: '', sector: '', currency: 'USD', target_price: '', notes: '' };

function inputStyle(extra = {}) {
  return {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '0.45rem',
    padding: '0.5rem 0.65rem',
    color: 'var(--text-1)',
    fontSize: '0.85rem',
    outline: 'none',
    width: '100%',
    fontFamily: 'inherit',
    ...extra,
  };
}

function FieldRow({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <span style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.07em', color: 'var(--text-3)', textTransform: 'uppercase' }}>{label}</span>
      {children}
    </label>
  );
}

function ScorePill({ score }) {
  if (score == null) return <span style={{ color: 'var(--text-4)', fontSize: '0.78rem' }}>—</span>;
  const color = score >= 70 ? 'var(--green)' : score >= 45 ? '#f59e0b' : 'var(--red)';
  return (
    <span style={{
      background: `${color}18`,
      color,
      border: `1px solid ${color}35`,
      borderRadius: '999px',
      padding: '0.15rem 0.6rem',
      fontSize: '0.75rem',
      fontWeight: 700,
    }}>
      {score}/100
    </span>
  );
}

async function fetchScore(ticker) {
  try {
    const res = await fetch(`${API}/lookup/${encodeURIComponent(ticker)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.health_score ?? null;
  } catch {
    return null;
  }
}

function WatchCard({ item, onRemove, onEdit }) {
  const [score, setScore]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  async function loadScore() {
    if (fetched) return;
    setLoading(true);
    const s = await fetchScore(item.ticker);
    setScore(s);
    setFetched(true);
    setLoading(false);
  }

  const priceDiff = item.target_price && score != null ? null : null; // placeholder for future price data

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '0.85rem',
      padding: '1.1rem 1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: 0, fontWeight: 800, fontSize: '1rem', color: 'var(--text-1)', fontFamily: 'var(--font-mono, monospace)' }}>
            {item.ticker}
          </p>
          {item.company_name && (
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--text-3)' }}>{item.company_name}</p>
          )}
        </div>
        <ScorePill score={score} />
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {item.sector && (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '0.35rem', padding: '0.15rem 0.5rem' }}>
            {item.sector}
          </span>
        )}
        {item.currency && item.currency !== 'USD' && (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{item.currency}</span>
        )}
        {item.target_price && (
          <span style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 600 }}>
            Target: {item.target_price}
          </span>
        )}
      </div>

      {item.notes && (
        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-3)', lineHeight: 1.5 }}>{item.notes}</p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={loadScore}
          disabled={loading || fetched}
          style={{
            padding: '0.35rem 0.85rem',
            background: 'var(--bg)',
            color: fetched ? 'var(--text-3)' : 'var(--accent)',
            border: '1px solid var(--border)',
            borderRadius: '0.4rem',
            fontSize: '0.73rem',
            fontWeight: 600,
            cursor: loading || fetched ? 'default' : 'pointer',
          }}
        >
          {loading ? 'Loading…' : fetched ? 'Score loaded' : 'Load Health Score'}
        </button>

        <Link
          to={`/dashboard?ticker=${item.ticker}`}
          style={{
            padding: '0.35rem 0.85rem',
            background: 'rgba(96,165,250,0.08)',
            color: 'var(--accent)',
            border: '1px solid rgba(96,165,250,0.25)',
            borderRadius: '0.4rem',
            fontSize: '0.73rem',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Analyse →
        </Link>

        <button
          onClick={() => onEdit(item)}
          style={{ padding: '0.35rem 0.75rem', background: 'var(--bg)', color: 'var(--text-2)', border: '1px solid var(--border)', borderRadius: '0.4rem', fontSize: '0.73rem', cursor: 'pointer', fontWeight: 600, marginLeft: 'auto' }}
        >
          Edit
        </button>

        {confirmDel ? (
          <>
            <button onClick={() => onRemove(item.ticker)} style={{ padding: '0.35rem 0.75rem', background: 'rgba(239,68,68,0.12)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.4rem', fontSize: '0.73rem', cursor: 'pointer', fontWeight: 700 }}>Confirm</button>
            <button onClick={() => setConfirmDel(false)} style={{ padding: '0.35rem 0.5rem', background: 'var(--bg)', color: 'var(--text-4)', border: '1px solid var(--border)', borderRadius: '0.4rem', fontSize: '0.73rem', cursor: 'pointer' }}>✕</button>
          </>
        ) : (
          <button onClick={() => setConfirmDel(true)} style={{ padding: '0.35rem 0.75rem', background: 'rgba(239,68,68,0.07)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '0.4rem', fontSize: '0.73rem', cursor: 'pointer', fontWeight: 600 }}>Remove</button>
        )}
      </div>
    </div>
  );
}

export default function Watchlist() {
  const { isAuthenticated, loading, getWatchlist, addToWatchlist, removeFromWatchlist } = useAuth();
  const navigate = useNavigate();

  const [items, setItems]       = useState([]);
  const [fetching, setFetching] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [editTicker, setEditTicker] = useState(null);

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
    setSaving(true);
    try {
      await addToWatchlist({
        ticker:       form.ticker,
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

  if (loading || (!isAuthenticated && !loading)) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingTop: '5rem' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1.25rem 4rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.75rem' }}>
          <div>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Watchlist</p>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>My Companies</h1>
            <p style={{ color: 'var(--text-3)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
              {items.length} {items.length === 1 ? 'company' : 'companies'} tracked
            </p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setForm(EMPTY_FORM); setEditTicker(null); }}
            style={{
              padding: '0.6rem 1.25rem',
              background: showForm ? 'var(--surface)' : 'var(--accent)',
              color: showForm ? 'var(--text-2)' : '#fff',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
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
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '0.85rem',
              padding: '1.5rem',
              marginBottom: '1.5rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '1rem',
            }}
          >
            <FieldRow label="Ticker *">
              <input style={inputStyle()} required value={form.ticker} onChange={field('ticker')} placeholder="AAPL" disabled={!!editTicker} />
            </FieldRow>
            <FieldRow label="Company Name">
              <input style={inputStyle()} value={form.company_name} onChange={field('company_name')} placeholder="Apple Inc." />
            </FieldRow>
            <FieldRow label="Sector">
              <input style={inputStyle()} value={form.sector} onChange={field('sector')} placeholder="Technology" />
            </FieldRow>
            <FieldRow label="Currency">
              <input style={inputStyle()} value={form.currency} onChange={field('currency')} placeholder="USD" />
            </FieldRow>
            <FieldRow label="Target Price">
              <input style={inputStyle()} type="number" step="any" value={form.target_price} onChange={field('target_price')} placeholder="0.00" />
            </FieldRow>
            <div style={{ gridColumn: '1 / -1' }}>
              <FieldRow label="Notes">
                <textarea style={{ ...inputStyle(), resize: 'vertical' }} rows={2} value={form.notes} onChange={field('notes')} placeholder="Why are you watching this?" />
              </FieldRow>
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" onClick={() => { setShowForm(false); setEditTicker(null); }} style={{ ...inputStyle({ width: 'auto', cursor: 'pointer' }) }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ padding: '0.5rem 1.5rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '0.45rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                {saving ? 'Saving…' : editTicker ? 'Update' : 'Add to Watchlist'}
              </button>
            </div>
          </form>
        )}

        {/* Grid */}
        {fetching ? (
          <p style={{ color: 'var(--text-3)', textAlign: 'center', padding: '3rem' }}>Loading…</p>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-4)' }}>
            <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📡</p>
            <p style={{ fontSize: '0.9rem' }}>
              No companies on your watchlist yet. Add one, or use "Add to Watchlist" from the{' '}
              <Link to="/dashboard" style={{ color: 'var(--accent)' }}>Dashboard</Link>.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.85rem' }}>
            {items.map(item => (
              <WatchCard key={item.id} item={item} onRemove={handleRemove} onEdit={handleEdit} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
