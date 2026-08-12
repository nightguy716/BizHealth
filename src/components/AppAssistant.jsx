import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getBackendBaseUrl } from '../lib/backendUrl';
import { ownerHeaders } from '../lib/ownerHeaders';

const API = getBackendBaseUrl();
const STORAGE_KEY = 'valoreva_app_assistant_v1';

const STARTER_PROMPTS = [
  'What can I do on this page?',
  'Explain these numbers in simple words.',
  'How do I use Risk Copilot step by step?',
];

function localAssistantReply(pathname, userInput) {
  const q = String(userInput || '').toLowerCase();
  const page = String(pathname || '/');

  if (q.includes('risk copilot') || page.includes('risk-copilot')) {
    return [
      'Risk Copilot quick flow:',
      '1) Set/verify positions and candidate trade.',
      '2) Run Pre-Trade Impact, Scenario Stress, Correlation, and Hedges.',
      '3) Check Risk Readiness and apply fix actions if not PASS.',
      '4) Export IC Note after final checks.',
      'If a section is blank, run its button once to generate that module output.',
    ].join('\n');
  }

  if (q.includes('watchlist') || page.includes('watchlist')) {
    return [
      'Watchlist quick flow:',
      '- Add ticker/company from the search bar.',
      '- Prices and news refresh automatically.',
      '- Use Ping/Alert controls per stock for movement updates.',
      '- If a price is unavailable, re-open the card or re-add ticker with exchange format like RELIANCE.NS.',
    ].join('\n');
  }

  if (q.includes('dashboard') || q.includes('ratio') || q.includes('health') || page.includes('dashboard')) {
    return [
      'Dashboard quick flow:',
      '1) Load company from lookup OR enter financial inputs in sidebar.',
      '2) Click Calculate to generate ratios and health score.',
      '3) Review cards first: Liquidity, Profitability, Efficiency, Leverage.',
      '4) Use table view + charts for deeper breakdown.',
      'If ratios show N/A, one or more required fields are missing.',
    ].join('\n');
  }

  if (q.includes('journal') || q.includes('debate') || page.includes('journal')) {
    return [
      'Journal AI Debate quick flow:',
      '- Enter thesis and context, then run debate.',
      '- 4-5 rounds are generated, then arbiter verdict is returned.',
      '- Keep prompts concise and specific for better signal.',
    ].join('\n');
  }

  if (q.includes('what can i do') || q.includes('how to use')) {
    return [
      'You can use:',
      '- Dashboard: ratio health analysis',
      '- Watchlist: live price/news tracking',
      '- Risk Copilot: pre-trade risk checks',
      '- Journal: AI debate and verdict',
      'Tell me your page + goal, and I will give exact steps.',
    ].join('\n');
  }

  return 'I can help with Dashboard, Watchlist, Risk Copilot, and Journal workflows. Tell me your current page and exact goal, and I will give you step-by-step actions.';
}

export default function AppAssistant() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState(() => ([
    {
      role: 'assistant',
      content: 'Hi, I am your Valoreva Assistant. Ask me how to use any feature, or what your metrics mean.',
    },
  ]));

  const payloadHistory = useMemo(
    () => messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content })),
    [messages],
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      setMessages(parsed.slice(-30));
    } catch {
      // ignore storage parse failures
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {
      // ignore storage write failures
    }
  }, [messages]);

  async function sendMessage(text) {
    const value = String(text || '').trim();
    if (!value || loading) return;

    const nextUser = { role: 'user', content: value };
    setMessages((prev) => [...prev, nextUser]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/assistant/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...ownerHeaders(),
        },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          path: location.pathname,
          user_input: value,
          messages: [...payloadHistory, nextUser],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || `Assistant request failed (${res.status})`);
      }
      const reply = String(data?.reply || '').trim() || 'I could not generate a useful answer yet.';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      const fallback = localAssistantReply(location.pathname, value);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `${fallback}\n\n(Assistant cloud response is temporarily unavailable: ${e.message})`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 1500, fontFamily: 'var(--font-sans)' }}>
      {open && (
        <div
          style={{
            width: 360,
            maxWidth: 'calc(100vw - 24px)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-4)', letterSpacing: '0.08em' }}>AI ASSISTANT</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 700 }}>Valoreva Guide</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ border: 'none', background: 'transparent', color: 'var(--text-4)', cursor: 'pointer', fontSize: 16 }}
            >
              ×
            </button>
          </div>

          <div style={{ maxHeight: 320, overflowY: 'auto', padding: 10, display: 'grid', gap: 8 }}>
            {messages.slice(-16).map((m, idx) => (
              <div
                key={`${m.role}-${idx}`}
                style={{
                  background: m.role === 'assistant' ? 'var(--surface-hi)' : 'rgba(37,99,235,0.16)',
                  border: `1px solid ${m.role === 'assistant' ? 'var(--border)' : 'rgba(37,99,235,0.35)'}`,
                  color: 'var(--text-2)',
                  borderRadius: 8,
                  padding: '8px 10px',
                  fontSize: 12,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.5,
                }}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div style={{ color: 'var(--text-4)', fontSize: 12 }}>Thinking...</div>
            )}
          </div>

          <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STARTER_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  style={{
                    border: '1px solid var(--border)',
                    background: 'var(--surface-hi)',
                    color: 'var(--text-4)',
                    borderRadius: 999,
                    fontSize: 11,
                    padding: '4px 8px',
                    cursor: 'pointer',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendMessage(input);
                }}
                placeholder="Ask about this page..."
                style={{
                  flex: 1,
                  background: 'var(--surface-hi)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-2)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={loading}
                style={{
                  border: 'none',
                  background: 'var(--gold)',
                  color: '#111827',
                  borderRadius: 6,
                  padding: '8px 10px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          border: '1px solid rgba(200,157,31,0.35)',
          background: 'linear-gradient(135deg, rgba(200,157,31,0.95), rgba(242,201,76,0.95))',
          color: '#111827',
          borderRadius: 999,
          padding: '10px 14px',
          fontWeight: 800,
          fontSize: 12,
          cursor: 'pointer',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {open ? 'Close Assistant' : 'AI Assistant'}
      </button>
    </div>
  );
}
