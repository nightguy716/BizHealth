/**
 * DesignSystem.jsx — Bloomberg-style design reference page
 * View at /design — remove route after approval
 */

import { useState } from 'react';

/* ── Design tokens ──────────────────────────────────────── */
const T = {
  bg:          '#0a0d14',
  surface:     'var(--surface)',
  surfaceHi:   'var(--surface-hi)',
  border:      'var(--border)',
  borderActive:'var(--border-hi)',
  text:        'var(--text-1)',
  text2:       'var(--text-3)',
  muted:       'var(--text-4)',
  blue:        'var(--gold)',
  green:       '#16a34a',
  red:         '#dc2626',
  amber:       '#b45309',
  purple:      '#7c3aed',
};

const mono = "'JetBrains Mono', 'Courier New', monospace";
const sans = "'Inter', system-ui, sans-serif";

/* ── Signal Tag ─────────────────────────────────────────── */
function SignalTag({ type }) {
  const map = {
    pass:   { label: 'PASS',   color: T.green  },
    watch:  { label: 'WATCH',  color: T.amber  },
    breach: { label: 'BREACH', color: T.red    },
    na:     { label: 'N/A',    color: T.muted  },
    pro:    { label: 'PRO',    color: T.blue   },
  };
  const { label, color } = map[type] || map.na;
  return (
    <span style={{
      fontFamily: mono, fontSize: 10, fontWeight: 600,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      color, border: `1px solid ${color}`, borderRadius: 3,
      padding: '2px 6px', whiteSpace: 'nowrap',
    }}>{label}</span>
  );
}

/* ── Section header ─────────────────────────────────────── */
function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: T.muted, marginBottom: 4 }}>
        {title}
      </div>
      {sub && <div style={{ fontFamily: sans, fontSize: 12, color: T.text2 }}>{sub}</div>}
      <div style={{ height: 1, background: T.border, marginTop: 10 }} />
    </div>
  );
}

/* ── 1. NAVBAR ──────────────────────────────────────────── */
function NavbarDemo() {
  const links = ['Dashboard', 'Watchlist', 'Journal', 'Blog'];
  const [active, setActive] = useState('Dashboard');
  return (
    <div style={{
      height: 48, background: T.bg, borderBottom: `1px solid ${T.border}`,
      display: 'flex', alignItems: 'center', padding: '0 20px',
      justifyContent: 'space-between', fontFamily: sans,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.blue }} />
        <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 600, color: T.text, letterSpacing: '0.02em' }}>
          Valoreva
        </span>
      </div>
      {/* Nav links */}
      <div style={{ display: 'flex', gap: 4 }}>
        {links.map(l => (
          <button key={l} onClick={() => setActive(l)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: sans, fontSize: 13, fontWeight: 500,
            color: active === l ? T.text : T.text2,
            padding: '0 12px', height: 48,
            borderBottom: active === l ? `2px solid ${T.blue}` : '2px solid transparent',
            transition: 'color 0.15s, border-color 0.15s',
          }}>{l}</button>
        ))}
      </div>
      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Bell */}
        <div style={{ position: 'relative', cursor: 'pointer' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.text2} strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <div style={{
            position: 'absolute', top: -5, right: -5,
            background: T.red, color: '#fff', borderRadius: '50%',
            width: 14, height: 14, fontSize: 9, fontFamily: mono,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>3</div>
        </div>
        {/* Avatar */}
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: T.surfaceHi, border: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: mono, fontSize: 11, fontWeight: 600, color: T.text2,
          cursor: 'pointer',
        }}>AK</div>
        {/* Theme toggle */}
        <div style={{
          fontFamily: mono, fontSize: 10, color: T.muted,
          border: `1px solid ${T.border}`, borderRadius: 3,
          padding: '3px 7px', cursor: 'pointer', letterSpacing: '0.05em',
        }}>DARK</div>
      </div>
    </div>
  );
}

/* ── 2. WATCHLIST CARDS ─────────────────────────────────── */
const watchData = [
  {
    ticker: 'RELIANCE.NS', exchange: 'NSE', name: 'Reliance Industries Ltd',
    price: '2,847.50', change: '+34.20', changePct: '+1.22', up: true,
    sector: 'Energy', target: '₹3,200', score: 74,
    news: [
      { title: 'Reliance Jio 5G expansion reaches 500 cities', pub: 'Economic Times', time: '2h' },
      { title: 'RIL Q3 results: Net profit up 11% YoY', pub: 'Mint', time: '5h' },
      { title: 'Mukesh Ambani unveils new green energy strategy', pub: 'Business Standard', time: '1d' },
    ],
  },
  {
    ticker: 'HDFCBANK.NS', exchange: 'NSE', name: 'HDFC Bank Limited',
    price: '1,642.30', change: '-13.80', changePct: '-0.83', up: false,
    sector: 'Banking', target: '₹1,900', score: 81,
    news: [
      { title: 'HDFC Bank credit card market share hits 28%', pub: 'Livemint', time: '3h' },
      { title: 'RBI approves HDFC Bank new branch expansion', pub: 'Reuters', time: '8h' },
      { title: 'HDFC Bank eyes SME lending push in FY27', pub: 'Financial Express', time: '2d' },
    ],
  },
  {
    ticker: 'INFY.NS', exchange: 'NSE', name: 'Infosys Limited',
    price: '1,423.65', change: '+18.45', changePct: '+1.31', up: true,
    sector: 'IT Services', target: null, score: 68,
    news: [
      { title: 'Infosys wins $2.1B deal with European bank', pub: 'TechCrunch', time: '1h' },
      { title: 'Infosys raises FY26 revenue guidance to 5-7%', pub: 'CNBC TV18', time: '6h' },
      { title: 'AI services now 12% of Infosys total revenue', pub: 'Business Today', time: '1d' },
    ],
  },
];

function WatchCard({ d }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`, borderRadius: 4,
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
      fontFamily: sans,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 600, color: T.text }}>{d.ticker}</span>
            <span style={{
              fontFamily: mono, fontSize: 10, color: T.blue,
              border: `1px solid ${T.blue}`, borderRadius: 3, padding: '1px 5px',
            }}>{d.exchange}</span>
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{d.name}</div>
        </div>
        <button style={{
          background: 'none', border: 'none', color: T.muted,
          cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2,
        }}>×</button>
      </div>

      {/* Price row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: mono, fontSize: 22, fontWeight: 600, color: T.text }}>₹{d.price}</span>
        <span style={{
          fontFamily: mono, fontSize: 11, fontWeight: 500,
          color: d.up ? T.green : T.red,
          border: `1px solid ${d.up ? T.green : T.red}`,
          borderRadius: 3, padding: '2px 7px',
        }}>{d.up ? '▲' : '▼'} {d.changePct}%</span>
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontFamily: mono, fontSize: 10, color: T.text2,
          border: `1px solid ${T.border}`, borderRadius: 3, padding: '1px 6px',
        }}>{d.sector}</span>
        {d.target && (
          <span style={{ fontSize: 11, color: T.muted }}>
            Target <span style={{ fontFamily: mono, color: T.text2 }}>{d.target}</span>
          </span>
        )}
      </div>

      {/* News */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
        {d.news.map((n, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <a href="#" style={{
              fontSize: 11, color: T.text2, textDecoration: 'none',
              lineHeight: 1.4, flex: 1,
            }}
            onMouseEnter={e => e.target.style.color = T.text}
            onMouseLeave={e => e.target.style.color = T.text2}
            >{n.title}</a>
            <span style={{ fontFamily: mono, fontSize: 10, color: T.muted, whiteSpace: 'nowrap' }}>
              {n.pub} · {n.time}
            </span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button style={{
          fontFamily: sans, fontSize: 12, fontWeight: 500, color: T.blue,
          border: `1px solid ${T.blue}`, borderRadius: 4, padding: '5px 12px',
          background: 'none', cursor: 'pointer',
        }}>Analyse →</button>
        <div style={{
          fontFamily: mono, fontSize: 11, fontWeight: 600,
          color: d.score >= 75 ? T.green : d.score >= 50 ? T.amber : T.red,
          border: `1px solid ${d.score >= 75 ? T.green : d.score >= 50 ? T.amber : T.red}`,
          borderRadius: 3, padding: '3px 8px',
        }}>{d.score}/100</div>
      </div>
    </div>
  );
}

/* ── 3. AI DEBATE PANEL ─────────────────────────────────── */
const debateRounds = [
  { agent: 'bull', text: "HDFC Bank's CASA ratio of 47% and NIM expansion to 3.8% signal a structurally sound lending engine. Retail loan growth at 21% YoY is not risk — it's execution." },
  { agent: 'bear', text: "NIM expansion is partly accounting — repricing lag will bite in H2 as deposit costs catch up. And 21% retail growth in a tightening cycle is precisely the risk profile that precedes an NPA cycle." },
  { agent: 'bull', text: "Provisioning coverage at 71% and gross NPA below 1.3% suggest the bank has been building buffers, not hiding stress. Management has navigated three rate cycles without a blowup." },
  { agent: 'bear', text: "Three cycles, yes — but this is the first post-merger cycle with HDFC Ltd's book fully absorbed. Mortgage mix is now 35% of loans. If property prices correct 15%, that math changes entirely." },
  { agent: 'bull', text: "Mortgage underwriting is conservative — average LTV at 67%, salaried borrowers at 84%. The stress scenario requires a correlation of defaults that history doesn't support for prime Indian mortgage." },
  { agent: 'bear', text: "History also didn't support the HDFC merger dilution hitting 18-month ROE recovery. Yet here we are at 16.2% ROE, still below pre-merger levels. Execution risk is real and unresolved." },
];
const arbiterText = "The bull case is structurally stronger. HDFC Bank's asset quality metrics and provisioning discipline provide meaningful downside protection. However, the bear's mortgage concentration concern is legitimate and warrants monitoring over the next two quarters. The stock offers an asymmetric risk-reward at current levels — with a margin of safety, not without one.";

function DebatePanelDemo() {
  const [shown, setShown] = useState(debateRounds.length + 1);

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 4, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px', borderBottom: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', gap: 10, background: T.bg,
      }}>
        <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, color: T.text, letterSpacing: '0.05em' }}>
          AI DEBATE
        </span>
        <span style={{ fontFamily: mono, fontSize: 12, color: T.muted }}>·</span>
        <span style={{ fontFamily: mono, fontSize: 12, color: T.text2 }}>HDFCBANK.NS</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.red }} />
          <span style={{ fontFamily: mono, fontSize: 10, color: T.red, letterSpacing: '0.05em' }}>LIVE</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {debateRounds.slice(0, shown).map((r, i) => (
          <div key={i} style={{
            borderLeft: `2px solid ${r.agent === 'bull' ? T.blue : T.red}`,
            paddingLeft: 10,
            alignSelf: r.agent === 'bull' ? 'flex-start' : 'flex-end',
            maxWidth: '80%',
          }}>
            <div style={{
              fontFamily: mono, fontSize: 10, fontWeight: 600,
              color: r.agent === 'bull' ? T.blue : T.red,
              letterSpacing: '0.06em', marginBottom: 3,
            }}>{r.agent === 'bull' ? '▲ BULL' : '▼ BEAR'}</div>
            <div style={{ fontFamily: sans, fontSize: 12, color: T.text, lineHeight: 1.5 }}>{r.text}</div>
          </div>
        ))}

        {shown <= debateRounds.length && (
          <div style={{ fontFamily: mono, fontSize: 12, color: T.muted, padding: '2px 10px' }}>...</div>
        )}

        {shown > debateRounds.length && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0',
            }}>
              <div style={{ flex: 1, height: 1, background: T.border }} />
              <span style={{ fontFamily: mono, fontSize: 10, color: T.muted, whiteSpace: 'nowrap', letterSpacing: '0.06em' }}>
                ARBITER VERDICT
              </span>
              <div style={{ flex: 1, height: 1, background: T.border }} />
            </div>
            <div style={{
              borderLeft: `2px solid ${T.purple}`, paddingLeft: 10,
            }}>
              <div style={{
                fontFamily: mono, fontSize: 10, fontWeight: 600,
                color: T.purple, letterSpacing: '0.06em', marginBottom: 3,
              }}>◆ ARBITER</div>
              <div style={{ fontFamily: sans, fontSize: 12, color: T.text, lineHeight: 1.5 }}>{arbiterText}</div>
            </div>
          </>
        )}
      </div>

      <div style={{ padding: '8px 16px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 8 }}>
        <button onClick={() => setShown(1)} style={{
          fontFamily: sans, fontSize: 11, color: T.muted, background: 'none',
          border: `1px solid ${T.border}`, borderRadius: 3, padding: '4px 10px', cursor: 'pointer',
        }}>Reset</button>
        <button onClick={() => setShown(s => Math.min(s + 1, debateRounds.length + 1))} style={{
          fontFamily: sans, fontSize: 11, color: T.blue, background: 'none',
          border: `1px solid ${T.blue}`, borderRadius: 3, padding: '4px 10px', cursor: 'pointer',
        }}>Next →</button>
      </div>
    </div>
  );
}

/* ── 4. RATIO CARDS ─────────────────────────────────────── */
const ratios = [
  { label: 'CURRENT RATIO', value: '2.34x', signal: 'pass',   bar: 72, interp: 'Adequate short-term liquidity. Above the 2.0x industry benchmark.' },
  { label: 'DEBT / EQUITY', value: '0.87x', signal: 'watch',  bar: 45, interp: 'Moderate leverage. Approaching the 1.0x threshold for this sector.' },
  { label: 'RETURN ON EQUITY', value: '18.4%', signal: 'pass', bar: 68, interp: 'Strong shareholder returns. Above median for Indian manufacturing.' },
  { label: 'NET MARGIN',    value: '6.2%',  signal: 'breach', bar: 28, interp: 'Below sector median of 9.1%. Margin compression warrants review.' },
];

function RatioCard({ r }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`, borderRadius: 4,
      padding: '12px 14px', flex: 1, minWidth: 0, fontFamily: sans,
    }}>
      <div style={{ fontFamily: mono, fontSize: 10, color: T.muted, letterSpacing: '0.08em', marginBottom: 6 }}>
        {r.label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: mono, fontSize: 22, fontWeight: 600, color: T.text }}>{r.value}</span>
        <SignalTag type={r.signal} />
      </div>
      {/* Benchmark bar */}
      <div style={{ height: 2, background: T.border, borderRadius: 1, marginBottom: 8, position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, height: '100%',
          width: `${r.bar}%`, borderRadius: 1,
          background: r.signal === 'pass' ? T.green : r.signal === 'watch' ? T.amber : T.red,
        }} />
      </div>
      <div style={{ fontSize: 11, color: T.text2, lineHeight: 1.4 }}>{r.interp}</div>
    </div>
  );
}

/* ── 5. SEARCH BAR ──────────────────────────────────────── */
const searchResults = [
  { ticker: 'RELIANCE', name: 'Reliance Industries Ltd', exchange: 'NSE', sector: 'Energy' },
  { ticker: 'RELCAP',   name: 'Reliance Capital Ltd',    exchange: 'BSE', sector: 'NBFC'   },
  { ticker: 'RELI',     name: 'Reliance Infrastructure', exchange: 'NSE', sector: 'Power'  },
];

function SearchBarDemo() {
  const [query, setQuery] = useState('reli');
  const [focused, setFocused] = useState(true);
  return (
    <div style={{ position: 'relative', fontFamily: sans }}>
      <div style={{
        height: 48, background: T.surface,
        border: `1px solid ${focused ? T.borderActive : T.border}`,
        borderRadius: 4, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10,
        transition: 'border-color 0.15s',
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search ticker · AAPL · RELIANCE.NS · TSLA · MSFT ..."
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            fontFamily: sans, fontSize: 13, color: T.text,
          }}
        />
        <span style={{
          fontFamily: mono, fontSize: 10, color: T.muted,
          border: `1px solid ${T.border}`, borderRadius: 3, padding: '2px 6px', letterSpacing: '0.03em',
        }}>⌘K</span>
      </div>

      {focused && query && (
        <div style={{
          position: 'absolute', top: 52, left: 0, right: 0,
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 4,
          overflow: 'hidden', zIndex: 10,
        }}>
          {searchResults.map((r, i) => (
            <div key={i} style={{
              padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10,
              borderBottom: i < searchResults.length - 1 ? `1px solid ${T.border}` : 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={e => e.currentTarget.style.background = T.surfaceHi}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: T.text, minWidth: 80 }}>{r.ticker}</span>
              <span style={{ fontSize: 12, color: T.text2, flex: 1 }}>{r.name}</span>
              <span style={{
                fontFamily: mono, fontSize: 10, color: T.blue,
                border: `1px solid ${T.blue}`, borderRadius: 3, padding: '1px 5px',
              }}>{r.exchange}</span>
              <span style={{
                fontFamily: mono, fontSize: 10, color: T.muted,
                border: `1px solid ${T.border}`, borderRadius: 3, padding: '1px 5px',
              }}>{r.sector}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── 6. SIGNAL TAGS + BUTTONS REF ───────────────────────── */
function TagsRef() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontFamily: mono, fontSize: 10, color: T.muted, letterSpacing: '0.08em', marginBottom: 8 }}>
          SIGNAL TAGS
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['pass','watch','breach','na','pro'].map(t => <SignalTag key={t} type={t} />)}
        </div>
      </div>
      <div>
        <div style={{ fontFamily: mono, fontSize: 10, color: T.muted, letterSpacing: '0.08em', marginBottom: 8 }}>
          BUTTONS
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button style={{
            fontFamily: sans, fontSize: 13, fontWeight: 500, color: '#fff',
            background: T.blue, border: 'none', borderRadius: 4,
            padding: '8px 18px', cursor: 'pointer',
          }}>Run Analysis</button>
          <button style={{
            fontFamily: sans, fontSize: 13, fontWeight: 500, color: T.text,
            background: 'none', border: `1px solid ${T.border}`, borderRadius: 4,
            padding: '8px 18px', cursor: 'pointer',
          }}>Export XLSX</button>
          <button style={{
            fontFamily: sans, fontSize: 13, fontWeight: 500, color: T.text,
            background: 'none', border: `1px solid ${T.border}`, borderRadius: 4,
            padding: '8px 18px', cursor: 'pointer',
          }}>Export PDF</button>
        </div>
      </div>
      <div>
        <div style={{ fontFamily: mono, fontSize: 10, color: T.muted, letterSpacing: '0.08em', marginBottom: 8 }}>
          INPUT FIELDS
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['AAPL:NASDAQ', 'TTM · Q4\'25A', 'Sector median'].map((v, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontFamily: mono, fontSize: 9, color: T.muted, letterSpacing: '0.08em' }}>
                {['TICKER','PERIOD','COMPARE VS'][i]}
              </span>
              <div style={{
                fontFamily: mono, fontSize: 13, color: T.text,
                background: T.surface, border: `1px solid ${T.border}`,
                borderRadius: 4, padding: '7px 12px', minWidth: 140,
              }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── MAIN PAGE ──────────────────────────────────────────── */
export default function DesignSystem() {
  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '0 0 60px 0', fontFamily: sans }}>
      {/* Page header */}
      <div style={{
        padding: '16px 32px', borderBottom: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 11, color: T.muted, letterSpacing: '0.1em', marginBottom: 2 }}>
            DESIGN SYSTEM PREVIEW
          </div>
          <div style={{ fontFamily: sans, fontSize: 18, fontWeight: 600, color: T.text }}>
            Valoreva · Bloomberg Style
          </div>
        </div>
        <div style={{ fontFamily: mono, fontSize: 10, color: T.muted }}>
          Remove /design route after approval
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 32px 0' }}>

        {/* 1. Navbar */}
        <div style={{ marginBottom: 48 }}>
          <SectionHeader title="01 · Navigation Bar" sub="48px height · 1px bottom border · JetBrains Mono logo · active link = blue underline only" />
          <NavbarDemo />
        </div>

        {/* 2. Watchlist Cards */}
        <div style={{ marginBottom: 48 }}>
          <SectionHeader title="02 · Watchlist Cards" sub="Live price pill · news headlines · signal tag · NSE/BSE chip" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {watchData.map((d, i) => <WatchCard key={i} d={d} />)}
          </div>
        </div>

        {/* 3. Debate Panel */}
        <div style={{ marginBottom: 48 }}>
          <SectionHeader title="03 · AI Debate Panel" sub="Bull left (blue border) · Bear right (red border) · sequential reveal · Arbiter after all rounds" />
          <DebatePanelDemo />
        </div>

        {/* 4. Ratio Cards */}
        <div style={{ marginBottom: 48 }}>
          <SectionHeader title="04 · Ratio Cards" sub="Mono value · signal tag (border+text only) · 2px benchmark bar · 11px interpretation" />
          <div style={{ display: 'flex', gap: 12 }}>
            {ratios.map((r, i) => <RatioCard key={i} r={r} />)}
          </div>
        </div>

        {/* 5. Search Bar */}
        <div style={{ marginBottom: 48 }}>
          <SectionHeader title="05 · Bloomberg Search Bar" sub="Dot-separated placeholder · ⌘K pill · dropdown with mono ticker + exchange chip" />
          <SearchBarDemo />
        </div>

        {/* 6. Tags + Buttons */}
        <div style={{ marginBottom: 48 }}>
          <SectionHeader title="06 · Signal Tags · Buttons · Inputs" sub="No filled signal tags · solid blue primary · monospace field labels" />
          <TagsRef />
        </div>

      </div>
    </div>
  );
}
