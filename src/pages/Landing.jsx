import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { FinAxisLockup } from '../components/FinAxisLogo';

/* ── Animated counter ─────────────────────────────────────── */
function CountUp({ end, suffix = '', duration = 1800 }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      observer.disconnect();
      let start = 0;
      const step = end / (duration / 16);
      const tick = () => {
        start = Math.min(start + step, end);
        setVal(Math.floor(start));
        if (start < end) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);
  return <span ref={ref}>{val}{suffix}</span>;
}

/* ── Terminal preview card ────────────────────────────────── */
function TerminalCard() {
  const rows = [
    { label: 'Current Ratio',    val: '2.45×', status: 'green' },
    { label: 'EBITDA Margin',    val: '34.7%', status: 'green' },
    { label: 'Debt / Equity',    val: '0.82×', status: 'amber' },
    { label: 'ROIC',             val: '28.1%', status: 'green' },
    { label: 'Net Debt/EBITDA',  val: '1.14×', status: 'green' },
    { label: 'Altman Z-Score',   val: '4.33',  status: 'green' },
    { label: 'Interest Coverage',val: '9.2×',  status: 'green' },
    { label: 'Cash Conv. Cycle', val: '127d',  status: 'amber' },
  ];
  const clr = { green: '#00e887', amber: '#fbbf24', red: '#f43f5e' };
  return (
    <div className="rounded-2xl overflow-hidden w-full"
      style={{
        background: 'rgba(4,9,26,0.97)',
        border: '1px solid rgba(79,110,247,0.22)',
        boxShadow: '0 0 0 1px rgba(79,110,247,0.08), 0 24px 80px rgba(0,0,0,0.55), 0 0 60px rgba(79,110,247,0.1)',
        fontFamily: "'var(--font-sans)'",
      }}>
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3"
        style={{ background: 'rgba(79,110,247,0.07)', borderBottom: '1px solid rgba(79,110,247,0.12)' }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#f43f5e' }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#fbbf24' }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#00e887' }} />
        <span className="ml-3 text-[11px]" style={{ color: 'var(--gold)' }}>AAPL · Apple Inc · Technology · USD</span>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-md font-semibold"
          style={{ background: 'rgba(0,232,135,0.12)', color: '#00e887', border: '1px solid rgba(0,232,135,0.25)' }}>
          ● HEALTHY
        </span>
      </div>
      {/* Rows */}
      <div className="p-4 space-y-2.5">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between gap-3">
            <span className="text-[11px]" style={{ color: 'var(--text-4)', minWidth: 120 }}>{r.label}</span>
            <div className="flex-1 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="h-full rounded-full transition-all"
                style={{ width: r.status === 'green' ? '72%' : '42%', background: clr[r.status], opacity: 0.7 }} />
            </div>
            <span className="text-[11px] font-bold" style={{ color: '#f1f5f9', minWidth: 44, textAlign: 'right' }}>{r.val}</span>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: clr[r.status], boxShadow: `0 0 6px ${clr[r.status]}` }} />
          </div>
        ))}
      </div>
      {/* Footer score */}
      <div className="px-4 py-3 flex items-center justify-between"
        style={{ borderTop: '1px solid rgba(79,110,247,0.1)', background: 'rgba(79,110,247,0.03)' }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest" style={{ color: '#334155' }}>Overall Score</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-28 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full" style={{ width: '87%', background: 'linear-gradient(90deg,#00c874,#00e887)', boxShadow: '0 0 8px rgba(0,232,135,0.5)' }} />
          </div>
          <span className="text-sm font-black" style={{ color: '#00e887' }}>87 / 100</span>
        </div>
      </div>
    </div>
  );
}

/* ── Feature data ─────────────────────────────────────────── */
const FEATURES = [
  {
    icon: '⌕',
    title: 'One-Click Lookup',
    body: 'Type any ticker — AAPL, RELIANCE.NS, TSLA. Statements load automatically from Yahoo Finance. No CSV uploads.',
    accent: 'var(--gold)',
  },
  {
    icon: '◈',
    title: '23 CFA-Level Ratios',
    body: 'Liquidity, profitability, leverage, efficiency. Plus ROIC, Altman Z-Score, EBITDA margin, DPO, and full cash conversion cycle.',
    accent: '#22d3ee',
  },
  {
    icon: '⬡',
    title: 'DuPont & DCF',
    body: '3/5-factor DuPont decomposition of ROE. 5-year unlevered DCF with sensitivity grid across WACC and terminal growth.',
    accent: '#a78bfa',
  },
  {
    icon: '⚑',
    title: 'Earnings Quality',
    body: 'Beneish M-Score, accruals ratio, CFO/Net Income flags — the same signals that predicted Enron before it collapsed.',
    accent: '#f43f5e',
  },
  {
    icon: '⊞',
    title: 'IB-Style Excel',
    body: 'Multi-sheet workbook: Income Statement, Balance Sheet, Cash Flow, Ratio Summary, DCF. Colour-coded like Wall Street templates.',
    accent: '#00e887',
  },
  {
    icon: '◎',
    title: 'AI Insights',
    body: 'Claude Haiku reads your ratios and writes plain-English commentary — risks, opportunities, and specific actions.',
    accent: '#fbbf24',
  },
];

const STEPS = [
  { n: '01', title: 'Enter a Ticker', body: 'Type any listed company. Data pulls from Yahoo Finance automatically.' },
  { n: '02', title: 'Instant Analysis', body: '23 ratios, health scores, and AI commentary generated in seconds.' },
  { n: '03', title: 'Export & Share',   body: 'Download IB-style Excel or a detailed PDF report in one click.' },
];

const STATS = [
  { value: 23,  suffix: '',   label: 'Financial Ratios'    },
  { value: 12,  suffix: '+',  label: 'Industry Benchmarks' },
  { value: 5,   suffix: 'yr', label: 'Historical Data'     },
  { value: 100, suffix: '%',  label: 'Free to Start'       },
];
const MARKET_TAPE = [
  { label: 'AAPL', val: '+1.3%', up: true },
  { label: 'NVDA', val: '+0.9%', up: true },
  { label: 'SLB', val: '-0.1%', up: false },
  { label: 'RELIANCE', val: '+0.6%', up: true },
  { label: 'TCS', val: '+0.4%', up: true },
];

/* ── Landing ──────────────────────────────────────────────── */
export default function Landing() {
  const [email,     setEmail]     = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [wlError,   setWlError]   = useState('');
  const [wlBusy,    setWlBusy]    = useState(false);
  const [wlCount,   setWlCount]   = useState(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('waitlist_count').select('total').single()
      .then(({ data }) => { if (data?.total) setWlCount(data.total); })
      .catch(() => {});
  }, []);

  const handleWaitlist = async (e) => {
    e.preventDefault();
    if (!email) return;
    setWlError(''); setWlBusy(true);
    try {
      if (supabase) {
        const { error } = await supabase
          .from('waitlist')
          .insert({ email: email.trim().toLowerCase(), source: 'landing' });
        if (error && error.code !== '23505') throw error;
        setWlCount(c => (c ?? 0) + 1);
      }
      setSubmitted(true);
    } catch { setWlError('Something went wrong. Please try again.'); }
    finally  { setWlBusy(false); }
  };

  return (
    <div className="min-h-screen page-bg" style={{ color: 'var(--text-2)' }}>

      {/* ══ HERO ══════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-20 overflow-hidden">

        {/* Glow blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div style={{
            position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)',
            width: 800, height: 600, borderRadius: '50%',
            background: 'radial-gradient(ellipse,rgba(79,110,247,0.13) 0%,transparent 65%)',
          }} />
          <div style={{
            position: 'absolute', bottom: '5%', right: '-5%',
            width: 400, height: 400, borderRadius: '50%',
            background: 'radial-gradient(ellipse,rgba(34,211,238,0.07) 0%,transparent 65%)',
          }} />
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(79,110,247,0.06) 0%, transparent 38%, transparent 65%, rgba(200,157,31,0.05) 100%)',
          }} />
        </div>

        {/* Eyebrow badge */}
        <div className="flex items-center gap-2 mb-7 px-4 py-1.5 rounded-full relative z-10"
          style={{ background: 'rgba(79,110,247,0.08)', border: '1px solid rgba(79,110,247,0.22)' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--gold)' }} />
          <span className="eyebrow">Financial Intelligence Platform · Beta</span>
        </div>

        {/* Headline */}
        <h1 className="heading-xl text-center max-w-3xl mb-5 relative z-10">
          Institutional-grade <span className="gold-shine">analysis</span>.{' '}
          <span className="shimmer-text">In seconds.</span>
        </h1>

        {/* Sub */}
        <p className="text-center max-w-xl mb-10 leading-relaxed relative z-10"
          style={{ color: 'var(--text-3)', fontSize: '1.05rem' }}>
          Search any listed company. Get 23 CFA-level ratios, AI commentary, a 5-year
          DCF model, and an IB-style Excel export — the workflow that used to take a
          full analyst day, now in one click.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap gap-3 justify-center mb-14 relative z-10">
          <Link to="/dashboard"
            className="btn-primary px-7 py-3 rounded-xl font-semibold text-sm text-white transition-all">
            Launch Dashboard →
          </Link>
          <a href="#features"
            className="px-7 py-3 rounded-xl font-semibold text-sm transition-all"
            style={{
              background: 'var(--surface)',
              color: 'var(--text-3)',
              border: '1px solid var(--border)',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(79,110,247,0.4)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
            See Features
          </a>
        </div>

        {/* Market tape */}
        <div
          className="w-full max-w-4xl mb-8 relative z-10"
          style={{
            background: 'rgba(6,11,26,0.78)',
            border: '1px solid rgba(79,110,247,0.24)',
            borderRadius: 12,
            boxShadow: '0 14px 40px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(10px)',
            padding: '8px 10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 10,
                fontWeight: 700,
                color: '#111827',
                background: 'var(--gold)',
                borderRadius: 999,
                padding: '2px 8px',
                letterSpacing: '0.08em',
              }}
            >
              LIVE
            </span>
            {MARKET_TAPE.map((t) => (
              <span key={t.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-3)' }}>{t.label}</span>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 11,
                    fontWeight: 700,
                    color: t.up ? '#00e887' : '#f43f5e',
                  }}
                >
                  {t.val}
                </span>
                <span style={{ color: 'var(--text-5)' }}>·</span>
              </span>
            ))}
          </div>
        </div>

        {/* Terminal preview */}
        <div className="w-full max-w-lg relative z-10">
          <TerminalCard />
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-30">
          <span className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-4)' }}>Scroll</span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--text-4)' }}>
            <path d="M2 4l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </section>

      {/* ══ STATS BAR ════════════════════════════════════════ */}
      <section className="py-14 px-6" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map(s => (
            <div key={s.label}>
              <div className="text-4xl font-black mb-1.5 mono" style={{ color: 'var(--text-1)' }}>
                <CountUp end={s.value} suffix={s.suffix} />
              </div>
              <div className="eyebrow" style={{ color: 'var(--text-4)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ FEATURES ════════════════════════════════════════ */}
      <section id="features" className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="eyebrow mb-3">What You Get</p>
            <h2 className="heading-lg mb-4">Everything a finance professional needs</h2>
            <p className="subheading max-w-lg mx-auto">
              Built for investment bankers, consultants, equity analysts, and CFOs
              who need institutional-grade answers fast.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(f => (
              <div key={f.title} className="feature-card group">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-xl"
                  style={{ background: `${f.accent}14`, border: `1px solid ${f.accent}28` }}>
                  <span style={{ color: f.accent }}>{f.icon}</span>
                </div>
                <h3 className="font-bold mb-2 text-sm" style={{ color: 'var(--text-1)' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-3)' }}>{f.body}</p>
                <div className="mt-4 h-px rounded-full transition-all duration-300"
                  style={{ background: `linear-gradient(90deg,${f.accent}40,transparent)`, opacity: 0.6 }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ════════════════════════════════════ */}
      <section id="how-it-works" className="py-28 px-6" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="eyebrow mb-3">How It Works</p>
            <h2 className="heading-lg">Three steps. Zero friction.</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-7 left-1/3 right-1/3 h-px"
              style={{ background: 'linear-gradient(90deg,transparent,rgba(79,110,247,0.3),transparent)' }} />

            {STEPS.map((s, i) => (
              <div key={s.n} className="relative text-center md:text-left">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-card)',
                  }}>
                  <span className="mono font-black text-lg" style={{ color: 'var(--royal)' }}>{s.n}</span>
                </div>
                <h3 className="font-bold mb-2" style={{ color: 'var(--text-1)', fontSize: '1rem' }}>{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-3)' }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ SOCIAL PROOF ════════════════════════════════════ */}
      <section className="py-20 px-6" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="max-w-4xl mx-auto">
          <p className="eyebrow text-center mb-10">Built for</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { role: 'CFA Candidates',        icon: 'chart',      desc: 'Apply theory to real data'        },
              { role: 'Management Consultants', icon: 'briefcase',  desc: 'Quick due diligence in minutes'   },
              { role: 'Equity Analysts',        icon: 'trend',      desc: 'Ratio screens in seconds'         },
              { role: 'CFOs & Finance Teams',   icon: 'building',   desc: 'Track your own company health'    },
            ].map(p => (
              <div key={p.role} className="p-5 rounded-2xl text-center"
                style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                <div className="mb-3 flex justify-center">
                  {p.icon === 'chart' && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold-hi)" strokeWidth="1.9" aria-hidden="true">
                      <path d="M4 19h16"/><path d="M7 15v-4M12 15V8M17 15V5"/>
                    </svg>
                  )}
                  {p.icon === 'briefcase' && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold-hi)" strokeWidth="1.9" aria-hidden="true">
                      <rect x="3" y="7" width="18" height="12" rx="2"/><path d="M9 7V5h6v2M3 12h18"/>
                    </svg>
                  )}
                  {p.icon === 'trend' && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold-hi)" strokeWidth="1.9" aria-hidden="true">
                      <path d="M4 16l6-6 4 3 6-7"/><path d="M16 6h4v4"/>
                    </svg>
                  )}
                  {p.icon === 'building' && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold-hi)" strokeWidth="1.9" aria-hidden="true">
                      <path d="M4 20h16"/><rect x="6" y="4" width="12" height="16"/><path d="M10 8h4M10 12h4M10 16h4"/>
                    </svg>
                  )}
                </div>
                <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text-1)' }}>{p.role}</p>
                <p className="text-xs" style={{ color: 'var(--text-4)' }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ WAITLIST ════════════════════════════════════════ */}
      <section className="py-28 px-6" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-lg mx-auto text-center">
          <p className="eyebrow mb-3">Early Access</p>
          <h2 className="heading-lg mb-4">Be first when Pro launches</h2>
          <p className="subheading mb-7">
            Pro brings watchlists, shareable reports, unlimited AI analyses, and
            priority data. Charter Members lock in the lowest price forever.
          </p>

          {wlCount !== null && wlCount > 0 && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
              style={{ background: 'rgba(79,110,247,0.08)', border: '1px solid rgba(79,110,247,0.2)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--gold)' }} />
              <span className="mono text-xs font-semibold" style={{ color: 'var(--gold)' }}>
                {wlCount} {wlCount === 1 ? 'person' : 'people'} already on the list
              </span>
            </div>
          )}

          {submitted ? (
            <div className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl"
              style={{ background: 'rgba(0,232,135,0.07)', border: '1px solid rgba(0,232,135,0.22)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00e887" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
              <span className="mono text-sm font-semibold" style={{ color: '#00e887' }}>
                You're on the list — we'll be in touch.
              </span>
            </div>
          ) : (
            <>
              <form onSubmit={handleWaitlist} className="flex gap-2">
                <input type="email" required placeholder="your@email.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setWlError(''); }}
                  className="flex-1 px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: 'var(--surface)',
                    border: `1px solid ${wlError ? 'rgba(244,63,94,0.4)' : 'var(--border)'}`,
                    color: 'var(--text-1)',
                    fontFamily: 'var(--font-mono)',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(79,110,247,0.55)'}
                  onBlur={e  => e.target.style.borderColor = wlError ? 'rgba(244,63,94,0.4)' : 'var(--border)'}
                />
                <button type="submit" disabled={wlBusy}
                  className="btn-primary px-5 py-3 rounded-xl font-semibold text-sm text-white whitespace-nowrap transition-all"
                  style={{ opacity: wlBusy ? 0.6 : 1, cursor: wlBusy ? 'not-allowed' : 'pointer' }}>
                  {wlBusy ? '…' : 'Join Waitlist'}
                </button>
              </form>
              {wlError && <p className="mt-2 text-xs" style={{ color: '#f43f5e' }}>{wlError}</p>}
            </>
          )}

          <p className="mt-4 text-xs" style={{ color: 'var(--text-5)' }}>
            No spam. No nonsense. Unsubscribe any time.
          </p>
        </div>
      </section>

      {/* ══ BOTTOM CTA ══════════════════════════════════════ */}
      <section className="py-28 px-6"
        style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="heading-lg mb-4">
            Start your analysis now —{' '}
            <span style={{ color: 'var(--royal)' }}>free.</span>
          </h2>
          <p className="subheading mb-8">
            No account required. Search a ticker and get a full financial health
            report in under 10 seconds.
          </p>
          <Link to="/dashboard"
            className="btn-primary inline-block px-10 py-4 rounded-xl font-bold text-sm text-white transition-all">
            Launch Dashboard →
          </Link>
        </div>
      </section>

      {/* ══ FOOTER ══════════════════════════════════════════ */}
      <footer className="py-10 px-6" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <FinAxisLockup size={14} gap={6} finColor="var(--text-1)" axisColor="var(--gold)" markColor="var(--text-1)" />
            <span className="text-xs" style={{ color: 'var(--text-5)' }}>· Financial Intelligence</span>
          </div>
          <div className="flex items-center gap-6">
            {[['Dashboard','/dashboard'],['Pricing','/pricing'],['About','/about'],['Contact','/contact']].map(([l,h]) => (
              <Link key={l} to={h} className="text-xs transition-colors"
                style={{ color: 'var(--text-4)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-2)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-4)'}>
                {l}
              </Link>
            ))}
          </div>
          <p className="mono text-xs" style={{ color: 'var(--text-5)' }}>
            © 2026 Valoreva · Beta
          </p>
        </div>
      </footer>

    </div>
  );
}
