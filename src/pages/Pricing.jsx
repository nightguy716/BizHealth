export default function Pricing() {
  const tiers = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      features: [
        '3 company lookups / day',
        '14 core financial ratios',
        'AI health summary',
        'Basic PDF export',
      ],
      cta: 'Get Started',
      highlight: false,
    },
    {
      name: 'Pro',
      price: '$15',
      period: 'per month',
      features: [
        'Unlimited company lookups',
        'All 23 CFA-level ratios',
        'Full IB-style Excel export',
        'Multi-page PDF with DCF',
        'Sector peer comparison',
        'Saved search history',
      ],
      cta: 'Coming Soon',
      highlight: true,
    },
    {
      name: 'Premium',
      price: '$49',
      period: 'per month',
      features: [
        'Everything in Pro',
        'DuPont decomposition',
        'Sensitivity analysis',
        'Scenario comparison',
        'Earnings quality flags',
        'Priority support',
      ],
      cta: 'Coming Soon',
      highlight: false,
    },
  ];

  return (
    <div className="min-h-screen page-bg px-6 py-20">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className="mono text-xs tracking-widest mb-3" style={{ color: '#4f6ef7' }}>PRICING</p>
          <h1 className="text-4xl font-bold mb-4" style={{ color: '#f1f5f9' }}>
            Simple, transparent pricing
          </h1>
          <p className="text-base" style={{ color: '#94a3b8' }}>
            Start free. Upgrade when you need more depth.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map(tier => (
            <div key={tier.name}
              className="rounded-2xl p-6 flex flex-col"
              style={{
                background: tier.highlight ? 'rgba(79,110,247,0.08)' : 'rgba(255,255,255,0.03)',
                border: tier.highlight ? '1px solid rgba(79,110,247,0.4)' : '1px solid rgba(255,255,255,0.07)',
              }}>
              {tier.highlight && (
                <span className="mono text-[10px] font-bold px-2 py-0.5 rounded mb-4 self-start"
                  style={{ background: 'rgba(79,110,247,0.2)', color: '#4f6ef7', border: '1px solid rgba(79,110,247,0.3)' }}>
                  MOST POPULAR
                </span>
              )}
              <h2 className="text-xl font-bold mb-1" style={{ color: '#f1f5f9' }}>{tier.name}</h2>
              <div className="flex items-end gap-1 mb-6">
                <span className="text-4xl font-bold" style={{ color: tier.highlight ? '#4f6ef7' : '#f1f5f9' }}>
                  {tier.price}
                </span>
                <span className="text-sm mb-1" style={{ color: '#64748b' }}>/{tier.period}</span>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                {tier.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: '#94a3b8' }}>
                    <span style={{ color: '#00e887', marginTop: 2, flexShrink: 0 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: tier.highlight ? '#4f6ef7' : 'rgba(255,255,255,0.05)',
                  color: tier.highlight ? '#fff' : '#94a3b8',
                  border: tier.highlight ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  cursor: tier.cta === 'Coming Soon' ? 'default' : 'pointer',
                }}>
                {tier.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
