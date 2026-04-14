import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="min-h-screen page-bg flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-2xl">
        <p className="mono text-xs tracking-widest mb-4" style={{ color: '#4f6ef7' }}>
          FINANCIAL INTELLIGENCE PLATFORM
        </p>
        <h1 className="text-5xl font-bold mb-6" style={{ color: '#f1f5f9', lineHeight: 1.15 }}>
          Institutional-grade analysis.<br />
          <span style={{ color: '#4f6ef7' }}>In seconds.</span>
        </h1>
        <p className="text-base mb-10 leading-relaxed" style={{ color: '#94a3b8' }}>
          From ticker to IB-grade financial report in one click.
          23 CFA-level ratios, AI-powered insights, DCF valuation,
          and Excel export — the workflow that used to take hours.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link to="/dashboard"
            className="px-8 py-3 rounded-lg font-semibold text-sm transition-all"
            style={{ background: '#4f6ef7', color: '#fff' }}>
            Launch Dashboard →
          </Link>
          <Link to="/about"
            className="px-8 py-3 rounded-lg font-semibold text-sm transition-all"
            style={{ background: 'rgba(79,110,247,0.08)', color: '#94a3b8', border: '1px solid rgba(79,110,247,0.2)' }}>
            Learn More
          </Link>
        </div>
      </div>

      {/* Coming soon badge */}
      <p className="absolute bottom-8 mono text-xs" style={{ color: 'rgba(148,163,184,0.3)' }}>
        Full landing page coming soon · v2
      </p>
    </div>
  );
}
