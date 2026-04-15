import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

/* ── tiny animated counter ── */
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

/* ── mock terminal card shown in hero ── */
function TerminalCard() {
  const rows = [
    { label: 'Current Ratio',      val: '2.45×',  status: 'green'  },
    { label: 'EBITDA Margin',       val: '34.7%',  status: 'green'  },
    { label: 'Debt / Equity',       val: '0.82×',  status: 'amber'  },
    { label: 'ROIC',                val: '28.1%',  status: 'green'  },
    { label: 'Net Debt / EBITDA',   val: '1.14×',  status: 'green'  },
    { label: 'Altman Z-Score',      val: '4.33',   status: 'green'  },
    { label: 'Interest Coverage',   val: '9.2×',   status: 'green'  },
    { label: 'Cash Conv. Cycle',    val: '127d',   status: 'amber'  },
  ];
  const color = { green: '#00e887', amber: '#fbbf24', red: '#f43f5e' };

  return (
    <div className="rounded-xl overflow-hidden"
      style={{
        background: 'rgba(4,9,26,0.95)',
        border: '1px solid rgba(79,110,247,0.25)',
        boxShadow: '0 0 60px rgba(79,110,247,0.15), 0 24px 80px rgba(0,0,0,0.6)',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12,
      }}>
      {/* title bar */}
      <div className="flex items-center gap-1.5 px-4 py-2.5"
        style={{ background: 'rgba(79,110,247,0.06)', borderBottom: '1px solid rgba(79,110,247,0.12)' }}>
        <span className="w-3 h-3 rounded-full" style={{ background: '#f43f5e' }} />
        <span className="w-3 h-3 rounded-full" style={{ background: '#fbbf24' }} />
        <span className="w-3 h-3 rounded-full" style={{ background: '#00e887' }} />
        <span className="ml-3" style={{ color: '#4f6ef7' }}>AAPL · Apple Inc · Technology · USD</span>
        <span className="ml-auto px-2 py-0.5 rounded text-[10px]"
          style={{ background: 'rgba(0,232,135,0.1)', color: '#00e887', border: '1px solid rgba(0,232,135,0.2)' }}>
          ● HEALTHY
        </span>
      </div>
      {/* rows */}
      <div className="p-4 space-y-2">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between">
            <span style={{ color: '#6b82a8' }}>{r.label}</span>
            <div className="flex items-center gap-3">
              <div className="w-20 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full"
                  style={{ width: r.status === 'green' ? '72%' : r.status === 'amber' ? '45%' : '20%',
                    background: color[r.status] }} />
              </div>
              <span style={{ color: '#f1f5f9', minWidth: 48, textAlign: 'right' }}>{r.val}</span>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color[r.status] }} />
            </div>
          </div>
        ))}
      </div>
      {/* footer */}
      <div className="px-4 py-2.5 flex items-center justify-between"
        style={{ borderTop: '1px solid rgba(79,110,247,0.1)', background: 'rgba(79,110,247,0.03)' }}>
        <span style={{ color: '#3d5070' }}>Overall Score</span>
        <span className="font-bold text-sm" style={{ color: '#00e887' }}>87 / 100</span>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
    ),
    title: 'One-Click Company Lookup',
    body: 'Type any ticker — AAPL, RELIANCE.NS, TSLA. Financial statements load automatically. No manual entry, no CSV uploads.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
      </svg>
    ),
    title: '23 CFA-Level Ratios',
    body: 'Liquidity, profitability, efficiency, leverage — plus ROIC, Altman Z-Score, EBITDA margin, DPO, and full cash conversion cycle.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    title: 'IB-Style Excel Export',
    body: 'Multi-sheet workbook: Income Statement, Balance Sheet, Cash Flow, Ratio Summary, DCF Model — colour-coded exactly like Wall Street templates.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
      </svg>
    ),
    title: 'AI-Powered Insights',
    body: 'Claude Haiku analyses your ratios and generates plain-English commentary — strengths, risks, and specific actionable recommendations.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M2 20h20M6 20V10l6-6 6 6v10M10 20v-5h4v5"/>
      </svg>
    ),
    title: 'Sector Peer Comparison',
    body: 'See how a company stacks up against sector peers across margin, return, and leverage metrics. Built-in benchmark database for 12 industries.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
      </svg>
    ),
    title: 'Detailed PDF Reports',
    body: 'Export a multi-page PDF with ratio charts, AI commentary, DCF summary, and sector comparisons — ready to share with clients or management.',
  },
];

const STEPS = [
  { n: '01', title: 'Enter a Ticker', body: 'Type any listed company ticker. Data pulls automatically from Yahoo Finance.' },
  { n: '02', title: 'Instant Analysis', body: '23 ratios calculated in real time. Health status colour-coded. AI commentary generated.' },
  { n: '03', title: 'Export & Share', body: 'Download an IB-style Excel model or a detailed PDF report in one click.' },
];

const STATS = [
  { value: 23,  suffix: '',   label: 'Financial Ratios'   },
  { value: 12,  suffix: '+',  label: 'Industry Benchmarks'},
  { value: 5,   suffix: 'yr', label: 'DCF Projection'     },
  { value: 100, suffix: '%',  label: 'Free to Start'      },
];

export default function Landing() {
  const [email,     setEmail]     = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [wlError,   setWlError]   = useState('');
  const [wlBusy,    setWlBusy]    = useState(false);
  const [wlCount,   setWlCount]   = useState(null);

  // Fetch live waitlist count on mount
  useEffect(() => {
    if (!supabase) return;
    supabase.from('waitlist_count').select('total').single()
      .then(({ data }) => { if (data?.total) setWlCount(data.total); })
      .catch(() => {});
  }, []);

  const handleWaitlist = async (e) => {
    e.preventDefault();
    if (!email) return;
    setWlError('');
    setWlBusy(true);
    try {
      if (supabase) {
        const { error } = await supabase
          .from('waitlist')
          .insert({ email: email.trim().toLowerCase(), source: 'landing' });
        if (error) {
          if (error.code === '23505') {
            // Already on the list — still show success
          } else {
            throw error;
          }
        }
        setWlCount(c => (c ?? 0) + 1);
      }
      setSubmitted(true);
    } catch (err) {
      setWlError('Something went wrong. Please try again.');
    } finally {
      setWlBusy(false);
    }
  };

  return (
    <div className="min-h-screen page-bg" style={{ color: '#d4ddf5' }}>

      {/* ── HERO ──────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16 overflow-hidden">

        {/* background glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(79,110,247,0.12) 0%, transparent 70%)',
        }} />

        {/* eyebrow */}
        <div className="flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full"
          style={{ background: 'rgba(79,110,247,0.08)', border: '1px solid rgba(79,110,247,0.2)' }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#4f6ef7' }} />
          <span className="text-xs font-medium tracking-widest uppercase" style={{ color: '#4f6ef7', fontFamily: 'JetBrains Mono, monospace' }}>
            Financial Intelligence Platform
          </span>
        </div>

        {/* headline */}
        <h1 className="text-center font-black mb-6 max-w-3xl"
          style={{ fontSize: 'clamp(2.4rem, 5vw, 4rem)', lineHeight: 1.1, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
          Institutional-grade analysis.{' '}
          <span style={{
            background: 'linear-gradient(135deg, #4f6ef7 0%, #22d3ee 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            In seconds.
          </span>
        </h1>

        {/* sub */}
        <p className="text-center max-w-xl mb-10 leading-relaxed"
          style={{ color: '#9fb3d4', fontSize: '1.05rem' }}>
          Search any listed company. Get 23 CFA-level ratios, AI-powered insights,
          a 5-year DCF model, and an IB-style Excel export — the workflow that used
          to take a full analyst day, now in one click.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap gap-3 justify-center mb-16">
          <Link to="/dashboard"
            className="px-7 py-3 rounded-lg font-semibold text-sm transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'linear-gradient(135deg,#4f6ef7,#3d5af1)', color: '#fff',
              boxShadow: '0 0 24px rgba(79,110,247,0.4)' }}>
            Launch Dashboard →
          </Link>
          <a href="#how-it-works"
            className="px-7 py-3 rounded-lg font-semibold text-sm transition-all hover:opacity-80"
            style={{ background: 'rgba(79,110,247,0.08)', color: '#9fb3d4',
              border: '1px solid rgba(79,110,247,0.2)' }}>
            See How It Works
          </a>
        </div>

        {/* terminal preview */}
        <div className="w-full max-w-lg">
          <TerminalCard />
        </div>
      </section>

      {/* ── STATS BAR ─────────────────────────────────────── */}
      <section className="py-12 px-6"
        style={{ borderTop: '1px solid rgba(79,110,247,0.1)', borderBottom: '1px solid rgba(79,110,247,0.1)',
          background: 'rgba(79,110,247,0.03)' }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map(s => (
            <div key={s.label}>
              <div className="text-4xl font-black mb-1"
                style={{ fontFamily: 'JetBrains Mono, monospace', color: '#f1f5f9' }}>
                <CountUp end={s.value} suffix={s.suffix} />
              </div>
              <div className="text-xs font-medium uppercase tracking-widest" style={{ color: '#6b82a8' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-xs font-medium tracking-widest uppercase mb-3"
            style={{ color: '#4f6ef7', fontFamily: 'JetBrains Mono, monospace' }}>
            WHAT YOU GET
          </p>
          <h2 className="text-center font-black mb-4"
            style={{ fontSize: 'clamp(1.8rem,3vw,2.5rem)', color: '#f1f5f9', letterSpacing: '-0.02em' }}>
            Everything a finance professional needs
          </h2>
          <p className="text-center mb-14 max-w-lg mx-auto" style={{ color: '#9fb3d4' }}>
            Built for investment bankers, management consultants, equity analysts,
            and CFOs who need answers fast.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className="p-6 rounded-xl transition-all hover:border-opacity-40"
                style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(79,110,247,0.12)',
                }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ background: 'rgba(79,110,247,0.1)', color: '#4f6ef7' }}>
                  {f.icon}
                </div>
                <h3 className="font-bold mb-2" style={{ color: '#f1f5f9', fontSize: '0.95rem' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#9fb3d4' }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6"
        style={{ borderTop: '1px solid rgba(79,110,247,0.08)' }}>
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-xs font-medium tracking-widest uppercase mb-3"
            style={{ color: '#4f6ef7', fontFamily: 'JetBrains Mono, monospace' }}>
            HOW IT WORKS
          </p>
          <h2 className="text-center font-black mb-14"
            style={{ fontSize: 'clamp(1.8rem,3vw,2.5rem)', color: '#f1f5f9', letterSpacing: '-0.02em' }}>
            Three steps. Zero friction.
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-7 left-full w-full h-px"
                    style={{ background: 'linear-gradient(90deg,rgba(79,110,247,0.3),transparent)', zIndex: 0 }} />
                )}
                <div className="relative z-10">
                  <div className="text-4xl font-black mb-4"
                    style={{ fontFamily: 'JetBrains Mono, monospace',
                      color: 'rgba(79,110,247,0.25)', letterSpacing: '-0.02em' }}>
                    {s.n}
                  </div>
                  <h3 className="font-bold mb-2" style={{ color: '#f1f5f9' }}>{s.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#9fb3d4' }}>{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WAITLIST ─────────────────────────────────────── */}
      <section className="py-24 px-6"
        style={{ borderTop: '1px solid rgba(79,110,247,0.08)' }}>
        <div className="max-w-xl mx-auto text-center">
          <p className="text-xs font-medium tracking-widest uppercase mb-3"
            style={{ color: '#4f6ef7', fontFamily: 'JetBrains Mono, monospace' }}>
            EARLY ACCESS
          </p>
          <h2 className="font-black mb-4"
            style={{ fontSize: 'clamp(1.8rem,3vw,2.4rem)', color: '#f1f5f9', letterSpacing: '-0.02em' }}>
            Be first when Pro launches
          </h2>
          <p className="mb-6" style={{ color: '#9fb3d4', fontSize: '0.95rem' }}>
            Pro brings watchlists, shareable reports, unlimited AI analyses, and
            priority data. Join the waitlist — Charter Members lock in the lowest
            price forever.
          </p>

          {/* Live counter */}
          {wlCount !== null && wlCount > 0 && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
              style={{ background: 'rgba(79,110,247,0.08)', border: '1px solid rgba(79,110,247,0.18)' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#4f6ef7' }} />
              <span className="mono text-xs font-semibold" style={{ color: '#4f6ef7' }}>
                {wlCount} {wlCount === 1 ? 'person' : 'people'} already on the list
              </span>
            </div>
          )}

          {submitted ? (
            <div className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl"
              style={{ background: 'rgba(0,232,135,0.08)', border: '1px solid rgba(0,232,135,0.2)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00e887" strokeWidth="2">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
              <span style={{ color: '#00e887', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
                You're on the list — we'll be in touch.
              </span>
            </div>
          ) : (
            <>
              <form onSubmit={handleWaitlist} className="flex gap-2">
                <input
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setWlError(''); }}
                  className="flex-1 px-4 py-3 rounded-lg text-sm outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${wlError ? 'rgba(244,63,94,0.4)' : 'rgba(79,110,247,0.2)'}`,
                    color: '#f1f5f9',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(79,110,247,0.5)'}
                  onBlur={e  => e.target.style.borderColor = wlError ? 'rgba(244,63,94,0.4)' : 'rgba(79,110,247,0.2)'}
                />
                <button type="submit" disabled={wlBusy}
                  className="px-5 py-3 rounded-lg font-semibold text-sm transition-all hover:opacity-90 whitespace-nowrap"
                  style={{
                    background: wlBusy ? 'rgba(79,110,247,0.5)' : '#4f6ef7',
                    color: '#fff',
                    cursor: wlBusy ? 'not-allowed' : 'pointer',
                  }}>
                  {wlBusy ? '…' : 'Join Waitlist'}
                </button>
              </form>
              {wlError && (
                <p className="mt-2 text-xs" style={{ color: '#f43f5e' }}>{wlError}</p>
              )}
            </>
          )}

          <p className="mt-4 text-xs" style={{ color: '#3d5070' }}>
            No spam. No nonsense. Unsubscribe any time.
          </p>
        </div>
      </section>

      {/* ── BOTTOM CTA ───────────────────────────────────── */}
      <section className="py-24 px-6"
        style={{
          borderTop: '1px solid rgba(79,110,247,0.08)',
          background: 'linear-gradient(180deg, transparent 0%, rgba(79,110,247,0.04) 100%)',
        }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-black mb-4"
            style={{ fontSize: 'clamp(1.8rem,3vw,2.4rem)', color: '#f1f5f9', letterSpacing: '-0.02em' }}>
            Start your analysis now —{' '}
            <span style={{ color: '#4f6ef7' }}>free.</span>
          </h2>
          <p className="mb-8" style={{ color: '#9fb3d4' }}>
            No account required. Search a ticker and get a full financial health
            report in under 10 seconds.
          </p>
          <Link to="/dashboard"
            className="inline-block px-10 py-4 rounded-lg font-bold text-sm transition-all hover:opacity-90 active:scale-95"
            style={{
              background: 'linear-gradient(135deg,#4f6ef7,#3d5af1)',
              color: '#fff',
              boxShadow: '0 0 40px rgba(79,110,247,0.35)',
            }}>
            Launch Dashboard →
          </Link>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer className="py-10 px-6"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#4f6ef7,#22d3ee)' }}>
              <span className="text-white font-black text-[10px]">B</span>
            </div>
            <span className="font-bold text-sm" style={{ color: '#f1f5f9' }}>BizHealth</span>
            <span className="text-xs" style={{ color: '#3d5070' }}>· Financial Intelligence</span>
          </div>
          <div className="flex items-center gap-6">
            {[['Dashboard', '/dashboard'], ['Pricing', '/pricing'], ['About', '/about'], ['Contact', '/contact']].map(([l, h]) => (
              <Link key={l} to={h} className="text-xs transition-colors hover:opacity-80"
                style={{ color: '#6b82a8' }}>{l}</Link>
            ))}
          </div>
          <p className="text-xs" style={{ color: '#3d5070', fontFamily: 'JetBrains Mono, monospace' }}>
            © 2026 BizHealth · Beta
          </p>
        </div>
      </footer>

    </div>
  );
}
