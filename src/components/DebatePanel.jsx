import { useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'https://bizhealth-production.up.railway.app';

const SIDES = [
  {
    key: 'bull',
    label: 'Bull Case',
    icon: '▲',
    accent: 'var(--green)',
    bg: 'rgba(16,185,129,0.06)',
    border: 'rgba(16,185,129,0.2)',
  },
  {
    key: 'bear',
    label: 'Bear Case',
    icon: '▼',
    accent: 'var(--red)',
    bg: 'rgba(239,68,68,0.06)',
    border: 'rgba(239,68,68,0.2)',
  },
  {
    key: 'arbiter',
    label: "Arbiter's Verdict",
    icon: '⚖',
    accent: 'var(--accent)',
    bg: 'rgba(96,165,250,0.06)',
    border: 'rgba(96,165,250,0.2)',
  },
];

function BulletList({ text }) {
  const lines = text
    .split('\n')
    .map(l => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {lines.map((line, i) => (
        <li key={i} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.5 }}>
          <span style={{ flexShrink: 0, opacity: 0.5 }}>›</span>
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

export default function DebatePanel({ ticker, companyName, sector, financials, savedDebate, onSave }) {
  const [thesis, setThesis]   = useState('');
  const [debate, setDebate]   = useState(savedDebate || null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function runDebate() {
    if (!thesis.trim()) return;
    setLoading(true);
    setError('');
    setDebate(null);
    try {
      const res = await fetch(`${API}/debate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker,
          company_name: companyName,
          sector,
          thesis: thesis.trim(),
          financials,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || `Server error ${res.status}`);
      }
      const data = await res.json();
      setDebate(data);
      if (onSave) onSave(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Thesis input */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-3)', textTransform: 'uppercase' }}>
          Your Investment Thesis
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <textarea
            value={thesis}
            onChange={e => setThesis(e.target.value)}
            placeholder={`e.g. "Strong cash generation and undervalued vs peers — good long-term hold"`}
            rows={2}
            style={{
              flex: 1,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              padding: '0.6rem 0.75rem',
              color: 'var(--text-1)',
              fontSize: '0.85rem',
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={runDebate}
            disabled={loading || !thesis.trim()}
            style={{
              padding: '0 1.2rem',
              background: loading ? 'var(--surface)' : 'var(--accent)',
              color: loading ? 'var(--text-3)' : '#fff',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              letterSpacing: '0.04em',
              transition: 'all 0.2s',
              alignSelf: 'flex-start',
              minHeight: '64px',
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                <span style={{ fontSize: '0.7rem' }}>Debating…</span>
              </span>
            ) : 'Debate'}
          </button>
        </div>
        {error && <p style={{ color: 'var(--red)', fontSize: '0.78rem', margin: 0 }}>{error}</p>}
      </div>

      {/* Results */}
      {debate && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          {SIDES.map(({ key, label, icon, accent, bg, border }) => (
            <div
              key={key}
              style={{
                background: bg,
                border: `1px solid ${border}`,
                borderRadius: '0.75rem',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: accent, fontWeight: 700, fontSize: '0.9rem' }}>{icon}</span>
                <span style={{ color: accent, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {label}
                </span>
              </div>
              <BulletList text={debate[key]} />
            </div>
          ))}
        </div>
      )}

      {/* Prompt when no debate yet and no loading */}
      {!debate && !loading && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-4)', margin: 0, fontStyle: 'italic' }}>
          Enter your thesis above and hit Debate — three AI agents will argue both sides and deliver a verdict.
        </p>
      )}
    </div>
  );
}
