import { useState } from 'react';
import { Link } from 'react-router-dom';

/* ── Feature check / cross icons ── */
const Check = ({ color = '#00e887' }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
    <path d="M20 6L9 17l-5-5"/>
  </svg>
);
const Cross = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3d5070" strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
);
const Soon = () => (
  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
    style={{ background: 'rgba(200,157,31,0.1)', color: 'var(--gold)',
      border: '1px solid rgba(200,157,31,0.2)', fontFamily: 'var(--font-sans)' }}>
    SOON
  </span>
);

const TIERS = [
  {
    id:       'free',
    name:     'Free',
    badge:    null,
    monthly:  0,
    annual:   0,
    desc:     'Everything you need to evaluate any company — no card required.',
    cta:      'Launch Dashboard',
    ctaTo:    '/dashboard',
    ctaStyle: 'ghost',
    features: [
      { label: '7 AI analyses per day',              state: 'check'  },
      { label: '20 company lookups per day',         state: 'check'  },
      { label: '23 CFA-level financial ratios',      state: 'check'  },
      { label: '5-year DCF valuation model',         state: 'check'  },
      { label: 'Sector peer comparison',             state: 'check'  },
      { label: 'IB-style Excel export',              state: 'check'  },
      { label: 'Multi-page PDF report',              state: 'check'  },
      { label: 'Saved analysis history',             state: 'cross'  },
      { label: 'Watchlist & portfolio view',         state: 'cross'  },
      { label: 'DuPont decomposition',               state: 'soon'   },
      { label: 'Sensitivity & scenario analysis',    state: 'soon'   },
      { label: 'Earnings quality flags',             state: 'soon'   },
      { label: 'Priority support',                   state: 'cross'  },
    ],
  },
  {
    id:       'pro',
    name:     'Pro',
    badge:    'MOST POPULAR',
    monthly:  19,
    annual:   15,
    desc:     'For analysts, consultants and CFOs who run analyses daily.',
    cta:      'Join Waitlist',
    ctaTo:    null,
    ctaStyle: 'primary',
    features: [
      { label: 'Unlimited AI analyses',              state: 'check'  },
      { label: 'Unlimited company lookups',          state: 'check'  },
      { label: '23 CFA-level financial ratios',      state: 'check'  },
      { label: '5-year DCF valuation model',         state: 'check'  },
      { label: 'Sector peer comparison',             state: 'check'  },
      { label: 'IB-style Excel export',              state: 'check'  },
      { label: 'Multi-page PDF report',              state: 'check'  },
      { label: 'Saved analysis history',             state: 'soon'   },
      { label: 'Watchlist & portfolio view',         state: 'soon'   },
      { label: 'DuPont decomposition',               state: 'soon'   },
      { label: 'Sensitivity & scenario analysis',    state: 'soon'   },
      { label: 'Earnings quality flags',             state: 'soon'   },
      { label: 'Email support',                      state: 'check'  },
    ],
  },
  {
    id:       'premium',
    name:     'Premium',
    badge:    null,
    monthly:  49,
    annual:   39,
    desc:     'CFA/FRM-grade depth for power users, boutique firms, and teams.',
    cta:      'Join Waitlist',
    ctaTo:    null,
    ctaStyle: 'ghost-blue',
    features: [
      { label: 'Everything in Pro',                  state: 'check'  },
      { label: 'DuPont 3-step decomposition',        state: 'soon'   },
      { label: 'Sensitivity analysis (WACC × g)',    state: 'soon'   },
      { label: 'Scenario comparison (Bull/Bear)',     state: 'soon'   },
      { label: 'Beneish M-Score & earnings flags',   state: 'soon'   },
      { label: 'Custom peer group builder',          state: 'soon'   },
      { label: 'News & sentiment layer',             state: 'soon'   },
      { label: 'Shareable report links',             state: 'soon'   },
      { label: 'Company health score alerts',        state: 'soon'   },
      { label: 'DDM valuation model',                state: 'soon'   },
      { label: 'EV/EBITDA relative comps',           state: 'soon'   },
      { label: 'API access',                         state: 'soon'   },
      { label: 'Priority support + onboarding call', state: 'soon'   },
    ],
  },
];

const FAQS = [
  {
    q: 'Is the free tier actually free — no credit card?',
    a: 'Yes, completely. No card, no trial period, no hidden limits beyond the daily usage caps. You get 7 AI analyses and 20 company lookups every day, reset at midnight UTC.',
  },
  {
    q: 'When will Pro and Premium launch?',
    a: 'We\'re currently in beta. Pro and Premium are in active development — join the waitlist now to be notified first and claim Charter Member pricing ($9/mo for Pro, locked in forever).',
  },
  {
    q: 'What counts as one "AI analysis"?',
    a: 'Clicking "Generate AI Insights" on the dashboard uses one AI analysis credit. Company data lookups (searching a ticker) are counted separately.',
  },
  {
    q: 'What data sources do you use?',
    a: 'Financial statements are pulled from Yahoo Finance via the yfinance library. AI insights are powered by Anthropic\'s Claude Haiku model. All ratio calculations follow CFA Institute methodology.',
  },
  {
    q: 'Can I use Valoreva for client work?',
    a: 'Yes. The Pro tier is designed exactly for this — consultants and analysts regularly export the IB-style Excel model or PDF report for client presentations.',
  },
  {
    q: 'Do you offer team or enterprise plans?',
    a: 'Not yet, but it\'s on the roadmap. Get in touch via the contact page and we\'ll work something out for teams.',
  },
];

const CHARTER_LIMIT = 50; // total Charter Member spots
const CHARTER_CLAIMED = 0; // TODO: wire to backend when auth ships

export default function Pricing() {
  const [annual,   setAnnual]   = useState(false);
  const [openFaq,  setOpenFaq]  = useState(null);
  const [waitlist, setWaitlist] = useState({ pro: false, premium: false });

  const handleWaitlist = (tier) => {
    /* TODO: wire to backend / Supabase when auth ships */
    setWaitlist(w => ({ ...w, [tier]: true }));
  };

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
            VALUE METER
          </span>
          {['23 Ratios', 'DCF + Exports', 'AI Insights', 'Risk Copilot'].map((item) => (
            <span key={item} style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-3)' }}>
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* ── HERO ── */}
      <section className="relative pt-24 pb-16 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(79,110,247,0.09) 0%, transparent 70%)',
        }} />
        <div className="relative">
          <p className="text-xs font-medium tracking-widest uppercase mb-3"
            style={{ color: 'var(--gold)', fontFamily: 'var(--font-sans)' }}>
            PRICING
          </p>
          <h1 className="font-black mb-4"
            style={{ fontSize: 'clamp(2rem,4vw,2.8rem)', color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            Start free. Scale when ready.
          </h1>
          <p className="max-w-md mx-auto text-sm leading-relaxed mb-8" style={{ color: 'var(--text-3)' }}>
            No Bloomberg subscription. No $24,000/year terminal.
            Institutional-grade analysis from $0.
          </p>

          {/* Monthly / Annual toggle */}
          <div className="inline-flex items-center gap-3 px-1 py-1 rounded-xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <button onClick={() => setAnnual(false)}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: !annual ? 'rgba(200,157,31,0.16)' : 'transparent',
                color: !annual ? 'var(--text-1)' : 'var(--text-4)',
              }}>
              Monthly
            </button>
            <button onClick={() => setAnnual(true)}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2"
              style={{
                background: annual ? 'rgba(200,157,31,0.16)' : 'transparent',
                color: annual ? 'var(--text-1)' : 'var(--text-4)',
              }}>
              Annual
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                style={{ background: 'rgba(0,232,135,0.15)', color: '#00e887',
                  border: '1px solid rgba(0,232,135,0.2)' }}>
                2 MONTHS FREE
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ── CHARTER MEMBER BANNER ── */}
      <section className="px-6 pb-10">
        <div className="max-w-3xl mx-auto">
          <div className="relative rounded-2xl px-6 py-5 overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(200,157,31,0.12) 0%, rgba(242,201,76,0.06) 100%)',
              border: '1px solid rgba(200,157,31,0.3)',
            }}>
            {/* subtle animated glow */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse 60% 80% at 0% 50%, rgba(200,157,31,0.08) 0%, transparent 70%)' }} />

            <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                {/* icon */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(200,157,31,0.15)', border: '1px solid rgba(200,157,31,0.3)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.8">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-black" style={{ color: 'var(--text-1)' }}>Charter Member Offer</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24',
                        border: '1px solid rgba(251,191,36,0.25)',
                        fontFamily: 'var(--font-sans)' }}>
                      LIMITED
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-3)' }}>
                    First <span style={{ color: 'var(--text-1)', fontWeight: 700 }}>{CHARTER_LIMIT} members</span> lock in{' '}
                    <span style={{ color: 'var(--gold)', fontWeight: 700 }}>Pro at $9/mo forever</span>{' '}
                    — even when the price rises to $19. Charter pricing never expires.
                  </p>
                </div>
              </div>

              {/* progress + spots */}
              <div className="flex-shrink-0 text-right">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-32 h-1.5 rounded-full overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${(CHARTER_CLAIMED / CHARTER_LIMIT) * 100}%`,
                        background: 'linear-gradient(90deg, #4f6ef7, #22d3ee)',
                      }} />
                  </div>
                  <span className="text-xs font-bold whitespace-nowrap"
                    style={{ color: 'var(--text-1)', fontFamily: 'var(--font-sans)' }}>
                    {CHARTER_CLAIMED}/{CHARTER_LIMIT}
                  </span>
                </div>
                <p className="text-[10px]" style={{ color: 'var(--text-4)' }}>
                  {CHARTER_LIMIT - CHARTER_CLAIMED} spots remaining
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TIER CARDS ── */}
      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          {TIERS.map(tier => {
            const price = annual ? tier.annual : tier.monthly;
            const isPro = tier.id === 'pro';
            const waitlisted = waitlist[tier.id];

            return (
              <div key={tier.id} className="relative rounded-2xl p-6 flex flex-col"
                style={{
                  background: isPro ? 'linear-gradient(165deg, rgba(79,110,247,0.14) 0%, rgba(200,157,31,0.09) 100%)' : 'rgba(6,12,28,0.74)',
                  border: isPro ? '1px solid rgba(200,157,31,0.38)' : '1px solid rgba(79,110,247,0.2)',
                  boxShadow: isPro ? '0 0 40px rgba(200,157,31,0.18)' : '0 10px 26px rgba(0,0,0,0.25)',
                }}>

                {/* Badge */}
                {tier.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold tracking-widest"
                      style={{ background: 'var(--gold)', color: '#111827',
                        fontFamily: 'var(--font-sans)' }}>
                      {tier.badge}
                    </span>
                  </div>
                )}

                {/* Name + price */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-black text-lg" style={{ color: 'var(--text-1)' }}>{tier.name}</h2>
                    {tier.id !== 'free' && (
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold"
                      style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24',
                        border: '1px solid rgba(251,191,36,0.2)',
                        fontFamily: 'var(--font-sans)' }}>
                        COMING SOON
                      </span>
                    )}
                  </div>
                  <div className="flex items-end gap-1.5 mb-3">
                    <span className="font-black"
                      style={{ fontSize: '2.4rem', color: isPro ? 'var(--gold)' : 'var(--text-1)',
                        fontFamily: 'var(--font-sans)', lineHeight: 1 }}>
                      {price === 0 ? '$0' : `$${price}`}
                    </span>
                    {price > 0 && (
                      <span className="text-xs mb-1" style={{ color: 'var(--text-4)' }}>
                        / mo{annual ? ' · billed annually' : ''}
                      </span>
                    )}
                    {price === 0 && (
                      <span className="text-xs mb-1" style={{ color: 'var(--text-4)' }}>/ forever</span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-3)' }}>{tier.desc}</p>
                </div>

                {/* Features */}
                <ul className="space-y-2.5 flex-1 mb-6">
                  {tier.features.map(f => (
                    <li key={f.label} className="flex items-center gap-2.5 text-xs"
                      style={{ color: f.state === 'cross' ? 'var(--text-5)' : 'var(--text-2)' }}>
                      <span className="flex-shrink-0">
                        {f.state === 'check' && <Check />}
                        {f.state === 'cross' && <Cross />}
                        {f.state === 'soon'  && <Soon />}
                      </span>
                      {f.label}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {tier.ctaTo ? (
                  <Link to={tier.ctaTo}
                    className="w-full py-3 rounded-xl text-sm font-semibold text-center transition-all hover:opacity-90 block"
                    style={{
                      background: 'var(--surface-hi)',
                      color: 'var(--text-3)',
                      border: '1px solid var(--border)',
                    }}>
                    {tier.cta} →
                  </Link>
                ) : waitlisted ? (
                  <div className="w-full py-3 rounded-xl text-sm font-semibold text-center"
                    style={{ background: 'rgba(0,232,135,0.08)', color: '#00e887',
                      border: '1px solid rgba(0,232,135,0.2)' }}>
                    ✓ You're on the list
                  </div>
                ) : (
                  <>
                    <button onClick={() => handleWaitlist(tier.id)}
                      className="w-full py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                      style={{
                        background: isPro
                          ? 'linear-gradient(135deg,var(--gold),var(--gold-hi))'
                          : 'var(--surface-hi)',
                        color: isPro ? '#111827' : 'var(--text-3)',
                        border: isPro ? '1px solid rgba(200,157,31,0.3)' : '1px solid var(--border)',
                        boxShadow: isPro ? '0 0 20px rgba(200,157,31,0.22)' : 'none',
                      }}>
                      {tier.cta} →
                    </button>
                    {isPro && (
                      <p className="text-center text-[10px] mt-2"
                        style={{ color: 'var(--gold)', fontFamily: 'var(--font-sans)' }}>
                        ★ Charter Members lock in $9/mo forever
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── COMPARISON TABLE ── */}
      <section className="px-6 pb-20"
        style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-4xl mx-auto pt-16">
          <p className="text-center text-xs font-medium tracking-widest uppercase mb-3"
            style={{ color: 'var(--gold)', fontFamily: 'var(--font-sans)' }}>
            COMPARE PLANS
          </p>
          <h2 className="text-center font-black mb-10"
            style={{ fontSize: 'clamp(1.4rem,2.5vw,1.8rem)', color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            Everything side by side
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left py-3 pr-6 font-medium text-xs uppercase tracking-widest w-1/2"
                    style={{ color: 'var(--text-4)', fontFamily: 'var(--font-sans)' }}>Feature</th>
                  {['Free', 'Pro', 'Premium'].map(t => (
                    <th key={t} className="py-3 px-4 text-center font-bold text-sm"
                      style={{ color: t === 'Pro' ? 'var(--gold)' : 'var(--text-1)' }}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'AI analyses',           free: '7 / day',     pro: 'Unlimited', premium: 'Unlimited' },
                  { label: 'Company lookups',        free: '20 / day',    pro: 'Unlimited', premium: 'Unlimited' },
                  { label: 'Financial ratios',       free: '23',          pro: '23',        premium: '23+' },
                  { label: 'DCF valuation model',    free: true,          pro: true,        premium: true },
                  { label: 'IB-style Excel export',  free: true,          pro: true,        premium: true },
                  { label: 'PDF report',             free: true,          pro: true,        premium: true },
                  { label: 'Sector peer comparison', free: true,          pro: true,        premium: true },
                  { label: 'Saved history',          free: false,         pro: 'Soon',      premium: 'Soon' },
                  { label: 'Watchlist',              free: false,         pro: 'Soon',      premium: 'Soon' },
                  { label: 'DuPont decomposition',   free: false,         pro: false,       premium: 'Soon' },
                  { label: 'Sensitivity analysis',   free: false,         pro: false,       premium: 'Soon' },
                  { label: 'Scenario comparison',    free: false,         pro: false,       premium: 'Soon' },
                  { label: 'Earnings quality flags', free: false,         pro: false,       premium: 'Soon' },
                  { label: 'News & sentiment',       free: false,         pro: false,       premium: 'Soon' },
                  { label: 'API access',             free: false,         pro: false,       premium: 'Soon' },
                  { label: 'Support',                free: 'Community',   pro: 'Email',     premium: 'Priority' },
                ].map((row, i) => (
                  <tr key={row.label}
                    style={{ borderBottom: '1px solid var(--border)',
                      background: i % 2 === 0 ? 'transparent' : 'var(--surface)' }}>
                    <td className="py-3 pr-6 text-xs" style={{ color: 'var(--text-3)' }}>{row.label}</td>
                    {[row.free, row.pro, row.premium].map((val, ci) => (
                      <td key={ci} className="py-3 px-4 text-center">
                        {val === true  && <span className="flex justify-center"><Check /></span>}
                        {val === false && <span className="flex justify-center"><Cross /></span>}
                        {val === 'Soon' && <span className="flex justify-center"><Soon /></span>}
                        {typeof val === 'string' && val !== 'Soon' && (
                          <span className="text-xs font-medium"
                            style={{ color: ci === 1 ? 'var(--gold)' : 'var(--text-2)',
                              fontFamily: 'var(--font-sans)' }}>
                            {val}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="px-6 pb-20"
        style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-2xl mx-auto pt-16">
          <p className="text-center text-xs font-medium tracking-widest uppercase mb-3"
            style={{ color: 'var(--gold)', fontFamily: 'var(--font-sans)' }}>FAQ</p>
          <h2 className="text-center font-black mb-10"
            style={{ fontSize: 'clamp(1.4rem,2.5vw,1.8rem)', color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            Common questions
          </h2>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="rounded-xl overflow-hidden"
                style={{ border: '1px solid var(--border)',
                  background: openFaq === i ? 'rgba(200,157,31,0.05)' : 'var(--surface)' }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left transition-all">
                  <span className="text-sm font-semibold pr-4" style={{ color: 'var(--text-1)' }}>{faq.q}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="var(--gold)" strokeWidth="2"
                    style={{ flexShrink: 0, transform: openFaq === i ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s' }}>
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm leading-relaxed" style={{ color: 'var(--text-3)' }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="py-20 px-6 text-center"
        style={{ borderTop: '1px solid var(--border)',
          background: 'linear-gradient(180deg, transparent 0%, rgba(200,157,31,0.06) 100%)' }}>
        <h2 className="font-black mb-4"
          style={{ fontSize: 'clamp(1.6rem,2.5vw,2rem)', color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
          Start with Free. No commitment.
        </h2>
        <p className="mb-8 max-w-sm mx-auto text-sm" style={{ color: 'var(--text-3)' }}>
          Full institutional-grade analysis, zero cost. Upgrade when your workflow demands it.
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
            Enterprise enquiry
          </Link>
        </div>
      </section>

    </div>
  );
}
