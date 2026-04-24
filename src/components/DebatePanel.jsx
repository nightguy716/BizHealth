import { useState, useEffect, useRef } from 'react';
import { getBackendBaseUrl } from '../lib/backendUrl';

const API = getBackendBaseUrl();

const C = {
  bg:      'var(--surface-hi)',
  surface: 'var(--surface)',
  surfHi:  'var(--surface-hi)',
  border:  'var(--border)',
  text:    'var(--text-1)',
  text2:   'var(--text-3)',
  muted:   'var(--text-4)',
  blue:    'var(--gold)',
  red:     '#dc2626',
  purple:  '#7c3aed',
};

const mono = 'var(--font-sans)';
const sans = "'Inter', system-ui, sans-serif";

/* Reveal one message every 4 seconds */
const REVEAL_INTERVAL_MS = 4000;

export default function DebatePanel({
  ticker,
  companyName,
  sector,
  financials,
  savedDebate,
  onSave,
  initialThesis = '',
}) {
  const [thesis,    setThesis]    = useState(initialThesis);
  const [debate,    setDebate]    = useState(savedDebate || null);
  const [shown,     setShown]     = useState(0);      // how many rounds revealed
  const [typing,    setTyping]    = useState(false);  // show "..." between messages
  const [arbiter,   setArbiter]   = useState(false);  // arbiter revealed
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const intervalRef = useRef(null);
  const bottomRef   = useRef(null);
  const rounds = Array.isArray(debate?.rounds) ? debate.rounds : [];

  /* If a saved debate is passed, reveal all immediately */
  useEffect(() => {
    if (savedDebate) {
      setDebate(savedDebate);
      setShown(Array.isArray(savedDebate.rounds) ? savedDebate.rounds.length : 0);
      setArbiter(true);
    }
  }, [savedDebate]);

  /* Auto-scroll to bottom as messages appear */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [shown, arbiter, typing]);

  /* Sequential reveal after fetch */
  function startReveal(data) {
    const dataRounds = Array.isArray(data?.rounds) ? data.rounds : [];
    setDebate(data);
    setShown(0);
    setArbiter(false);
    setTyping(false);
    let idx = 0;

    intervalRef.current = setInterval(() => {
      if (idx < dataRounds.length) {
        setTyping(false);
        setShown(idx + 1);
        idx++;
        if (idx < dataRounds.length) {
          setTimeout(() => setTyping(true), 600);
        } else {
          // after last round, show typing then arbiter
          setTimeout(() => setTyping(true), 600);
        }
      } else {
        // reveal arbiter
        clearInterval(intervalRef.current);
        setTyping(false);
        setArbiter(true);
        if (onSave) onSave(data);
      }
    }, REVEAL_INTERVAL_MS);
  }

  async function runDebate() {
    if (!thesis.trim()) { setError('Enter your investment thesis first.'); return; }
    setError('');
    setLoading(true);
    setDebate(null);
    setShown(0);
    setArbiter(false);
    setTyping(false);
    clearInterval(intervalRef.current);

    try {
      const res = await fetch(`${API}/debate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker,
          company_name: companyName,
          sector: sector || '',
          thesis: thesis.trim(),
          financials: financials || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || `Error ${res.status}`);
      }
      const data = await res.json();
      startReveal(data);
    } catch (e) {
      setError(e.message || 'Debate failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  const isRunning = !!debate && shown < rounds.length;

  return (
    <div style={{ fontFamily: sans, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4 }}>

      {/* Header */}
      <div style={{
        padding: '10px 16px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 10, background: C.bg,
        borderRadius: '4px 4px 0 0',
      }}>
        <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: C.text2, letterSpacing: '0.08em' }}>
          AI DEBATE
        </span>
        <span style={{ color: C.muted, fontSize: 11 }}>·</span>
        <span style={{ fontFamily: mono, fontSize: 11, color: C.text }}>{ticker}</span>
        {(loading || isRunning) && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.red }} />
            <span style={{ fontFamily: mono, fontSize: 10, color: C.red, letterSpacing: '0.06em' }}>LIVE</span>
          </div>
        )}
        {debate && !isRunning && arbiter && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.muted }} />
            <span style={{ fontFamily: mono, fontSize: 10, color: C.muted, letterSpacing: '0.06em' }}>COMPLETE</span>
          </div>
        )}
      </div>

      {/* Thesis input */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontFamily: mono, fontSize: 10, color: C.muted, letterSpacing: '0.08em', marginBottom: 5 }}>
          YOUR THESIS
        </div>
        <textarea
          value={thesis}
          onChange={e => setThesis(e.target.value)}
          placeholder="e.g. HDFC Bank's CASA franchise and NIMs will drive re-rating above 3x P/B over 18 months..."
          rows={2}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4,
            color: C.text, fontFamily: sans, fontSize: 12, lineHeight: 1.5,
            padding: '7px 10px', outline: 'none', resize: 'vertical',
          }}
        />
        {error && (
          <div style={{ fontFamily: sans, fontSize: 11, color: C.red, marginTop: 5 }}>{error}</div>
        )}
        <button
          onClick={runDebate}
          disabled={loading || isRunning}
          style={{
            marginTop: 8, fontFamily: sans, fontSize: 12, fontWeight: 500,
            color: '#fff', background: loading || isRunning ? C.muted : C.blue,
            border: 'none', borderRadius: 4, padding: '7px 16px',
            cursor: loading || isRunning ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Running debate...' : isRunning ? 'Debate in progress...' : debate ? 'Re-run Debate' : 'Run Debate'}
        </button>
      </div>

      {/* Chat area */}
      {debate && (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 480, overflowY: 'auto' }}>

          {rounds.slice(0, shown).map((r, i) => (
            <div key={i} style={{
              borderLeft: `2px solid ${r.agent === 'bull' ? C.blue : C.red}`,
              paddingLeft: 10,
              maxWidth: '82%',
              alignSelf: r.agent === 'bull' ? 'flex-start' : 'flex-end',
            }}>
              <div style={{
                fontFamily: mono, fontSize: 10, fontWeight: 600,
                color: r.agent === 'bull' ? C.blue : C.red,
                letterSpacing: '0.06em', marginBottom: 3,
              }}>
                {r.agent === 'bull' ? 'BULL CASE' : 'BEAR CASE'}
              </div>
              <div style={{ fontFamily: sans, fontSize: 12, color: C.text, lineHeight: 1.55 }}>
                {r.text}
              </div>
            </div>
          ))}

          {typing && (
            <div style={{ fontFamily: mono, fontSize: 12, color: C.muted, paddingLeft: 12 }}>...</div>
          )}

          {arbiter && debate.arbiter && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
                <div style={{ flex: 1, height: 1, background: C.border }} />
                <span style={{ fontFamily: mono, fontSize: 10, color: C.muted, whiteSpace: 'nowrap', letterSpacing: '0.07em' }}>
                  ARBITER VERDICT
                </span>
                <div style={{ flex: 1, height: 1, background: C.border }} />
              </div>
              <div style={{ borderLeft: `2px solid ${C.purple}`, paddingLeft: 10 }}>
                <div style={{
                  fontFamily: mono, fontSize: 10, fontWeight: 600,
                  color: C.purple, letterSpacing: '0.06em', marginBottom: 3,
                }}>ARBITER</div>
                <div style={{ fontFamily: sans, fontSize: 12, color: C.text, lineHeight: 1.55 }}>
                  {debate.arbiter}
                </div>
              </div>
            </>
          )}

          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
