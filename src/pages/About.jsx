import { Link } from 'react-router-dom';

const DIFFERENTIATORS = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
    ),
    title: 'Speed over complexity',
    body: 'Bloomberg Terminal charges $24,000/year and takes weeks to learn. We surface the same analytical depth in one search, in seconds.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
      </svg>
    ),
    title: 'Built around workflows',
    body: 'Not a data dump. Every output — ratio cards, Excel model, PDF report — is structured the way a CFA or IB analyst would actually present it.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    title: 'CFA-grade rigour',
    body: 'Altman Z-Score, ROIC, Cash Conversion Cycle, Net Debt/EBITDA, DuPont decomposition — ratios that matter in real investment decisions.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    title: 'For every level',
    body: 'An SME owner checking if their business is healthy. A consultant preparing a board deck. An analyst running sector comps. One tool, all use cases.',
  },
];

const ROADMAP = [
  { status: 'live',    label: '23 CFA-level financial ratios'               },
  { status: 'live',    label: 'AI-powered plain-English insights'            },
  { status: 'live',    label: 'IB-style Excel export (multi-sheet model)'    },
  { status: 'live',    label: 'Sector peer comparison'                       },
  { status: 'live',    label: 'Detailed multi-page PDF reports'              },
  { status: 'live',    label: '5-year unlevered DCF model'                   },
  { status: 'soon',    label: 'DuPont 3-step decomposition tree'             },
  { status: 'soon',    label: 'Sensitivity analysis (WACC × growth rate)'   },
  { status: 'soon',    label: 'Scenario modelling — Base / Bull / Bear'      },
  { status: 'soon',    label: 'Beneish M-Score earnings quality flags'       },
  { status: 'planned', label: 'User accounts & saved analysis history'       },
  { status: 'planned', label: 'Watchlist & portfolio health grid'            },
  { status: 'planned', label: 'Shareable report links'                       },
  { status: 'planned', label: 'Premium CFA/FRM-grade deep analysis tier'     },
];

const statusStyle = {
  live:    { bg: 'rgba(0,232,135,0.1)',    border: 'rgba(0,232,135,0.25)',   color: '#00e887',  dot: '#00e887',  label: 'LIVE'    },
  soon:    { bg: 'rgba(200,157,31,0.1)',   border: 'rgba(200,157,31,0.25)',  color: 'var(--gold)',  dot: 'var(--gold)',  label: 'SOON'    },
  planned: { bg: 'rgba(107,130,168,0.08)', border: 'rgba(107,130,168,0.15)', color: 'var(--text-4)',  dot: 'var(--text-5)',  label: 'PLANNED' },
};

export default function About() {
  return (
    <div className="min-h-screen page-bg" style={{ color: 'var(--text-2)' }}>
      <section
        className="px-6 pt-24 pb-5"
        style={{ borderBottom: '1px solid var(--border)', background: 'rgba(6,11,26,0.38)', backdropFilter: 'blur(8px)' }}
      >
        <div className="max-w-5xl mx-auto" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 10,
              fontWeight: 700,
              color: '#111827',
              background: 'var(--gold)',
              borderRadius: 999,
              padding: '2px 8px',
              letterSpacing: '0.08em',
            }}
          >
            MARKET CONTEXT
          </span>
          {['S&P500 +0.4%', 'NIFTY +0.6%', 'US10Y 4.32%', 'VIX 14.8'].map((row) => (
            <span key={row} style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-3)' }}>
              {row}
            </span>
          ))}
        </div>
      </section>

      {/* ── HERO ── */}
      <section className="relative py-28 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(200,157,31,0.12) 0%, transparent 70%)',
        }} />
        <div className="relative max-w-2xl mx-auto">
          <p className="text-xs font-medium tracking-widest uppercase mb-4"
            style={{ color: 'var(--gold)', fontFamily: 'var(--font-sans)' }}>
            OUR MISSION
          </p>
          <h1 className="font-black mb-6"
            style={{ fontSize: 'clamp(2rem,4vw,3rem)', color: 'var(--text-1)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            Democratising institutional-grade<br />financial analysis
          </h1>
          <p className="text-base leading-relaxed" style={{ color: 'var(--text-3)', maxWidth: 520, margin: '0 auto' }}>
            The tools that investment banks and hedge funds use to evaluate companies
            should not cost $24,000 a year and a six-week onboarding course.
            We're changing that.
          </p>
        </div>
      </section>

      {/* ── THE PROBLEM ── */}
      <section className="py-20 px-6" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs font-medium tracking-widest uppercase mb-3"
              style={{ color: 'var(--gold)', fontFamily: 'var(--font-sans)' }}>
              THE PROBLEM
            </p>
            <h2 className="font-black mb-5"
              style={{ fontSize: 'clamp(1.6rem,2.5vw,2rem)', color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
              Good financial analysis is locked behind paywalls and complexity
            </h2>
            <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--text-3)' }}>
              <p>
                A management consultant preparing a pitch needs current ratio, ROIC,
                debt/equity, interest coverage, and an Altman Z-Score. Getting that
                today means: export from Bloomberg, paste into Excel, build the model,
                format it. Forty-five minutes, minimum.
              </p>
              <p>
                An SME owner trying to understand if their business is healthy doesn't
                even know what ratios to look at, let alone how to compute them.
              </p>
              <p>
                Generic screeners give raw numbers with no context. No interpretation.
                No benchmarks. No colour-coded health signal. Just a table of data and
                a user left to figure out what it means.
              </p>
            </div>
          </div>
          {/* problem metrics */}
          <div className="space-y-4">
            {[
              { label: 'Bloomberg Terminal annual cost',    val: '$24,000',  sub: 'per user per year'           },
              { label: 'Time to build a manual IB model',  val: '4–8 hrs',  sub: 'for a single company'        },
              { label: 'Ratios needed for a full picture',  val: '20+',      sub: 'most tools show 5–6'         },
              { label: 'With Valoreva',                  val: '< 10 sec', sub: 'ticker to full report', hi: true },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between px-5 py-4 rounded-xl"
                style={{
                  background: r.hi ? 'linear-gradient(135deg, rgba(200,157,31,0.14) 0%, rgba(200,157,31,0.05) 100%)' : 'rgba(6,12,28,0.72)',
                  border: `1px solid ${r.hi ? 'rgba(200,157,31,0.3)' : 'rgba(79,110,247,0.18)'}`,
                  boxShadow: r.hi ? '0 0 26px rgba(200,157,31,0.15)' : '0 8px 20px rgba(0,0,0,0.24)',
                }}>
                <div>
                  <div className="text-xs font-medium mb-0.5" style={{ color: r.hi ? 'var(--text-1)' : 'var(--text-3)' }}>{r.label}</div>
                  <div className="text-[11px]" style={{ color: 'var(--text-4)' }}>{r.sub}</div>
                </div>
                <div className="font-black text-lg"
                  style={{ fontFamily: 'var(--font-sans)', color: r.hi ? 'var(--gold)' : 'var(--text-1)' }}>
                  {r.val}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHAT MAKES US DIFFERENT ── */}
      <section className="py-20 px-6" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-xs font-medium tracking-widest uppercase mb-3"
            style={{ color: 'var(--gold)', fontFamily: 'var(--font-sans)' }}>
            WHY VALOREVA
          </p>
          <h2 className="text-center font-black mb-14"
            style={{ fontSize: 'clamp(1.6rem,2.5vw,2rem)', color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            We don't just show data — we show what it means
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {DIFFERENTIATORS.map(d => (
              <div key={d.title} className="flex gap-5 p-6 rounded-xl"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(200,157,31,0.1)', color: 'var(--gold)' }}>
                  {d.icon}
                </div>
                <div>
                  <h3 className="font-bold mb-2 text-sm" style={{ color: 'var(--text-1)' }}>{d.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-3)' }}>{d.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHO IT'S FOR ── */}
      <section className="py-20 px-6" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-xs font-medium tracking-widest uppercase mb-3"
            style={{ color: 'var(--gold)', fontFamily: 'var(--font-sans)' }}>
            WHO IT'S FOR
          </p>
          <h2 className="text-center font-black mb-10"
            style={{ fontSize: 'clamp(1.6rem,2.5vw,2rem)', color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            One platform. Multiple personas.
          </h2>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                role: 'Investment Bankers',
                tag: '& Equity Analysts',
                points: ['IB-style Excel model in one click', 'DCF with 5-year projections', 'Sector peer comp built-in', 'Exportable for client decks'],
              },
              {
                role: 'Management Consultants',
                tag: '& Strategy Teams',
                points: ['Instant company health snapshot', '23 ratios with plain-English context', 'PDF reports ready to share', 'Scenario: Base / Bull / Bear (coming)'],
              },
              {
                role: 'SME Owners',
                tag: '& CFOs',
                points: ['No finance degree required', 'Colour-coded health indicators', 'Benchmark against your industry', 'AI recommendations, not jargon'],
              },
            ].map(c => (
              <div key={c.role} className="p-6 rounded-xl"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <h3 className="font-bold mb-0.5" style={{ color: 'var(--text-1)', fontSize: '0.9rem' }}>{c.role}</h3>
                <p className="text-xs mb-4" style={{ color: 'var(--gold)' }}>{c.tag}</p>
                <ul className="space-y-2">
                  {c.points.map(p => (
                    <li key={p} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-3)' }}>
                      <svg className="flex-shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24"
                        fill="none" stroke="var(--gold)" strokeWidth="2.5">
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROADMAP ── */}
      <section className="py-20 px-6" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-2xl mx-auto">
          <p className="text-center text-xs font-medium tracking-widest uppercase mb-3"
            style={{ color: 'var(--gold)', fontFamily: 'var(--font-sans)' }}>
            ROADMAP
          </p>
          <h2 className="text-center font-black mb-10"
            style={{ fontSize: 'clamp(1.6rem,2.5vw,2rem)', color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            Where we're going
          </h2>
          <div className="space-y-2.5">
            {ROADMAP.map(item => {
              const s = statusStyle[item.status];
              return (
                <div key={item.label} className="flex items-center justify-between px-4 py-3 rounded-lg"
                  style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                  <div className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
                    <span className="text-sm" style={{ color: item.status === 'live' ? 'var(--text-2)' : 'var(--text-3)' }}>
                      {item.label}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded"
                    style={{ color: s.color, background: `${s.bg}`, fontFamily: 'var(--font-sans)',
                      border: `1px solid ${s.border}` }}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="py-20 px-6 text-center"
        style={{ borderTop: '1px solid var(--border)',
          background: 'linear-gradient(180deg, transparent 0%, rgba(200,157,31,0.06) 100%)' }}>
        <h2 className="font-black mb-4"
          style={{ fontSize: 'clamp(1.6rem,2.5vw,2rem)', color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
          Try it — no account needed.
        </h2>
        <p className="mb-8 max-w-sm mx-auto text-sm" style={{ color: 'var(--text-3)' }}>
          Search any ticker and get a full institutional-grade report in seconds.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link to="/dashboard"
            className="px-8 py-3 rounded-lg font-semibold text-sm transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,var(--gold),var(--gold-hi))', color: '#111827',
              boxShadow: '0 0 24px rgba(200,157,31,0.25)' }}>
            Launch Dashboard →
          </Link>
          <Link to="/contact"
            className="px-8 py-3 rounded-lg font-semibold text-sm transition-all hover:opacity-80"
            style={{ background: 'var(--surface-hi)', color: 'var(--text-3)',
              border: '1px solid var(--border)' }}>
            Get in Touch
          </Link>
        </div>
      </section>

    </div>
  );
}
