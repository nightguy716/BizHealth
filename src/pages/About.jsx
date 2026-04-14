export default function About() {
  return (
    <div className="min-h-screen page-bg flex flex-col items-center justify-center px-6">
      <div className="max-w-2xl w-full text-center">
        <p className="mono text-xs tracking-widest mb-4" style={{ color: '#4f6ef7' }}>ABOUT</p>
        <h1 className="text-4xl font-bold mb-6" style={{ color: '#f1f5f9' }}>
          Built for finance professionals
        </h1>
        <p className="text-base leading-relaxed mb-4" style={{ color: '#94a3b8' }}>
          This platform was designed to bring institutional-grade financial analysis
          to anyone — from CFA candidates and management consultants to SME owners
          and private equity analysts.
        </p>
        <p className="text-base leading-relaxed" style={{ color: '#94a3b8' }}>
          Full about page coming soon.
        </p>
      </div>
    </div>
  );
}
