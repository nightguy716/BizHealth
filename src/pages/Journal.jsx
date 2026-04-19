import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import DebatePanel from '../components/DebatePanel';
import TickerAutocomplete from '../components/TickerAutocomplete';

const DIR_OPTS  = ['long', 'short'];
const OUT_OPTS  = ['open', 'win', 'loss'];
const DIR_COLOR = { long: 'var(--green)', short: 'var(--red)' };
const OUT_COLOR = { open: 'var(--accent)', win: 'var(--green)', loss: 'var(--red)' };
const EMPTY     = {
  ticker: '', company_name: '', direction: 'long',
  entry_date: '', entry_price: '', quantity: '',
  exit_date: '', exit_price: '', thesis: '', notes: '', outcome: 'open',
};

function Badge({ label, color }) {
  return (
    <span style={{
      background: `${color}20`,
      color,
      border: `1px solid ${color}40`,
      borderRadius: '999px',
      padding: '0.15rem 0.55rem',
      fontSize: '0.7rem',
      fontWeight: 700,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
    }}>
      {label}
    </span>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '0.75rem',
      padding: '1rem 1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.25rem',
    }}>
      <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: '1.4rem', fontWeight: 700, color: color || 'var(--text-1)', fontFamily: 'var(--font-mono, monospace)' }}>{value}</span>
    </div>
  );
}

function FieldRow({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <span style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.07em', color: 'var(--text-3)', textTransform: 'uppercase' }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '0.45rem',
  padding: '0.5rem 0.65rem',
  color: 'var(--text-1)',
  fontSize: '0.85rem',
  outline: 'none',
  width: '100%',
  fontFamily: 'inherit',
};

const selectStyle = { ...inputStyle, cursor: 'pointer' };

export default function Journal() {
  const { isAuthenticated, loading, getJournalEntries, addJournalEntry, updateJournalEntry, deleteJournalEntry } = useAuth();
  const navigate = useNavigate();

  const [entries, setEntries]           = useState([]);
  const [fetching, setFetching]         = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState(EMPTY);
  const [saving, setSaving]             = useState(false);
  const [expandedId, setExpandedId]     = useState(null);
  const [editId, setEditId]             = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate('/auth');
  }, [loading, isAuthenticated, navigate]);

  const load = useCallback(async () => {
    setFetching(true);
    const data = await getJournalEntries();
    setEntries(data);
    setFetching(false);
  }, [getJournalEntries]);

  useEffect(() => { if (isAuthenticated) load(); }, [isAuthenticated, load]);

  function field(key) {
    return (val) => setForm(f => ({ ...f, [key]: typeof val === 'string' ? val : val.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ticker:       form.ticker.toUpperCase(),
        company_name: form.company_name || form.ticker.toUpperCase(),
        direction:    form.direction,
        entry_date:   form.entry_date,
        entry_price:  form.entry_price ? parseFloat(form.entry_price) : null,
        quantity:     form.quantity    ? parseFloat(form.quantity)    : null,
        exit_date:    form.exit_date   || null,
        exit_price:   form.exit_price  ? parseFloat(form.exit_price)  : null,
        thesis:       form.thesis      || null,
        notes:        form.notes       || null,
        outcome:      form.outcome,
      };
      if (editId) {
        await updateJournalEntry(editId, payload);
      } else {
        await addJournalEntry(payload);
      }
      setForm(EMPTY);
      setShowForm(false);
      setEditId(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    await deleteJournalEntry(id);
    setConfirmDelete(null);
    setExpandedId(null);
    await load();
  }

  async function handleDebateSave(id, debateResult) {
    await updateJournalEntry(id, { debate_result: debateResult });
    setEntries(prev => prev.map(e => e.id === id ? { ...e, debate_result: debateResult } : e));
  }

  function startEdit(entry) {
    setForm({
      ticker:       entry.ticker,
      company_name: entry.company_name || '',
      direction:    entry.direction,
      entry_date:   entry.entry_date,
      entry_price:  entry.entry_price ?? '',
      quantity:     entry.quantity    ?? '',
      exit_date:    entry.exit_date   ?? '',
      exit_price:   entry.exit_price  ?? '',
      thesis:       entry.thesis      ?? '',
      notes:        entry.notes       ?? '',
      outcome:      entry.outcome,
    });
    setEditId(entry.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Stats
  const closed = entries.filter(e => e.outcome !== 'open');
  const wins   = entries.filter(e => e.outcome === 'win').length;
  const losses = entries.filter(e => e.outcome === 'loss').length;
  const winRate = closed.length ? Math.round((wins / closed.length) * 100) : null;
  const totalPL = entries.reduce((acc, e) => {
    if (e.entry_price && e.exit_price && e.quantity) {
      const mult = e.direction === 'short' ? -1 : 1;
      return acc + (e.exit_price - e.entry_price) * e.quantity * mult;
    }
    return acc;
  }, 0);

  if (loading || (!isAuthenticated && !loading)) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingTop: '5rem' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.25rem 4rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
              Trading Journal
            </p>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>My Trades</h1>
            <p style={{ color: 'var(--text-3)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
              Document, review, and debate your investment decisions.
            </p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setForm(EMPTY); setEditId(null); }}
            style={{
              padding: '0.6rem 1.25rem',
              background: showForm ? 'var(--surface)' : 'var(--accent)',
              color: showForm ? 'var(--text-2)' : '#fff',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              letterSpacing: '0.04em',
            }}
          >
            {showForm ? 'Cancel' : '+ New Trade'}
          </button>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.75rem' }}>
          <StatCard label="Total Trades"   value={entries.length} />
          <StatCard label="Open"           value={entries.filter(e => e.outcome === 'open').length} color="var(--accent)" />
          <StatCard label="Win Rate"       value={winRate !== null ? `${winRate}%` : '—'} color={winRate >= 50 ? 'var(--green)' : 'var(--red)'} />
          <StatCard label="Wins / Losses"  value={`${wins} / ${losses}`} />
          <StatCard label="Realised P&L"   value={totalPL !== 0 ? `${totalPL >= 0 ? '+' : ''}${totalPL.toFixed(0)}` : '—'} color={totalPL >= 0 ? 'var(--green)' : 'var(--red)'} />
        </div>

        {/* New / Edit form */}
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
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
            }}
          >
            <div style={{ gridColumn: '1 / -1' }}>
              <FieldRow label="Company / Ticker *">
                <TickerAutocomplete
                  value={form.ticker}
                  onChange={val => setForm(f => ({ ...f, ticker: val.toUpperCase() }))}
                  onSelect={c => setForm(f => ({
                    ...f,
                    ticker:       c.ticker,
                    company_name: c.name,
                  }))}
                  placeholder="Search ticker or company name…"
                />
              </FieldRow>
            </div>
            <FieldRow label="Company Name">
              <input style={inputStyle} value={form.company_name} onChange={field('company_name')} placeholder="Auto-filled on search" />
            </FieldRow>
            <FieldRow label="Direction">
              <select style={selectStyle} value={form.direction} onChange={field('direction')}>
                {DIR_OPTS.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
              </select>
            </FieldRow>
            <FieldRow label="Entry Date *">
              <input style={inputStyle} type="date" required value={form.entry_date} onChange={field('entry_date')} />
            </FieldRow>
            <FieldRow label="Entry Price">
              <input style={inputStyle} type="number" step="any" value={form.entry_price} onChange={field('entry_price')} placeholder="0.00" />
            </FieldRow>
            <FieldRow label="Quantity">
              <input style={inputStyle} type="number" step="any" value={form.quantity} onChange={field('quantity')} placeholder="0" />
            </FieldRow>
            <FieldRow label="Exit Date">
              <input style={inputStyle} type="date" value={form.exit_date} onChange={field('exit_date')} />
            </FieldRow>
            <FieldRow label="Exit Price">
              <input style={inputStyle} type="number" step="any" value={form.exit_price} onChange={field('exit_price')} placeholder="0.00" />
            </FieldRow>
            <FieldRow label="Outcome">
              <select style={selectStyle} value={form.outcome} onChange={field('outcome')}>
                {OUT_OPTS.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
              </select>
            </FieldRow>
            <div style={{ gridColumn: '1 / -1' }}>
              <FieldRow label="Investment Thesis">
                <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={form.thesis} onChange={field('thesis')} placeholder="Why are you entering this trade?" />
              </FieldRow>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <FieldRow label="Notes">
                <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={form.notes} onChange={field('notes')} placeholder="Anything else to remember…" />
              </FieldRow>
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{ padding: '0.5rem 1.5rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '0.45rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
              >
                {saving ? 'Saving…' : editId ? 'Update Trade' : 'Add Trade'}
              </button>
            </div>
          </form>
        )}

        {/* Entry list */}
        {fetching ? (
          <p style={{ color: 'var(--text-3)', textAlign: 'center', padding: '3rem' }}>Loading…</p>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-4)' }}>
            <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📒</p>
            <p style={{ fontSize: '0.9rem' }}>No trades yet. Add your first entry.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {entries.map(entry => {
              const pl =
                entry.entry_price && entry.exit_price && entry.quantity
                  ? (entry.exit_price - entry.entry_price) * entry.quantity * (entry.direction === 'short' ? -1 : 1)
                  : null;
              const isExpanded = expandedId === entry.id;

              return (
                <div
                  key={entry.id}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.75rem',
                    overflow: 'hidden',
                    transition: 'border-color 0.2s',
                  }}
                >
                  {/* Row summary */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.85rem 1.1rem',
                      cursor: 'pointer',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-1)', minWidth: '60px', fontFamily: 'var(--font-mono, monospace)' }}>
                      {entry.ticker}
                    </span>
                    <Badge label={entry.direction} color={DIR_COLOR[entry.direction]} />
                    <Badge label={entry.outcome}   color={OUT_COLOR[entry.outcome]} />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginLeft: '0.25rem' }}>{entry.entry_date}</span>
                    {entry.company_name && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>{entry.company_name}</span>
                    )}
                    {pl !== null && (
                      <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '0.88rem', color: pl >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'monospace' }}>
                        {pl >= 0 ? '+' : ''}{pl.toFixed(2)}
                      </span>
                    )}
                    <span style={{ color: 'var(--text-4)', fontSize: '0.8rem', marginLeft: pl !== null ? '0' : 'auto' }}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>

                  {/* Expanded section */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '1.1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {/* Details grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                        {[
                          ['Entry', entry.entry_price ? `${entry.entry_price}` : '—'],
                          ['Exit',  entry.exit_price  ? `${entry.exit_price}`  : '—'],
                          ['Qty',   entry.quantity    ? `${entry.quantity}`    : '—'],
                          ['Exit Date', entry.exit_date || '—'],
                        ].map(([k, v]) => (
                          <div key={k}>
                            <p style={{ fontSize: '0.68rem', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 0.2rem' }}>{k}</p>
                            <p style={{ fontSize: '0.88rem', color: 'var(--text-1)', fontFamily: 'monospace', margin: 0 }}>{v}</p>
                          </div>
                        ))}
                      </div>

                      {entry.thesis && (
                        <div>
                          <p style={{ fontSize: '0.68rem', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 0.35rem' }}>Thesis</p>
                          <p style={{ fontSize: '0.83rem', color: 'var(--text-2)', margin: 0, lineHeight: 1.55 }}>{entry.thesis}</p>
                        </div>
                      )}

                      {entry.notes && (
                        <div>
                          <p style={{ fontSize: '0.68rem', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 0.35rem' }}>Notes</p>
                          <p style={{ fontSize: '0.83rem', color: 'var(--text-2)', margin: 0, lineHeight: 1.55 }}>{entry.notes}</p>
                        </div>
                      )}

                      {/* 3-AI Debate */}
                      <div style={{ background: 'var(--bg)', borderRadius: '0.65rem', padding: '1rem', border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                          AI Debate
                        </p>
                        <DebatePanel
                          ticker={entry.ticker}
                          companyName={entry.company_name || entry.ticker}
                          thesis={entry.thesis || ''}
                          savedDebate={entry.debate_result}
                          onSave={(result) => handleDebateSave(entry.id, result)}
                        />
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => startEdit(entry)}
                          style={{ padding: '0.4rem 1rem', background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border)', borderRadius: '0.4rem', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}
                        >
                          Edit
                        </button>
                        {confirmDelete === entry.id ? (
                          <>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-3)', alignSelf: 'center' }}>Confirm?</span>
                            <button onClick={() => handleDelete(entry.id)} style={{ padding: '0.4rem 1rem', background: 'rgba(239,68,68,0.15)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.4rem', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 700 }}>Delete</button>
                            <button onClick={() => setConfirmDelete(null)} style={{ padding: '0.4rem 0.75rem', background: 'var(--surface)', color: 'var(--text-3)', border: '1px solid var(--border)', borderRadius: '0.4rem', fontSize: '0.78rem', cursor: 'pointer' }}>Cancel</button>
                          </>
                        ) : (
                          <button onClick={() => setConfirmDelete(entry.id)} style={{ padding: '0.4rem 1rem', background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '0.4rem', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}>Delete</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
