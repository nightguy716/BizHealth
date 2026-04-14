import { useState } from 'react';
import { analyzeFinancials } from '../utils/aiAnalysis';

const URGENCY_BG  = { High:'rgba(244,63,94,0.1)',   Medium:'rgba(251,191,36,0.08)',  Low:'rgba(255,255,255,0.04)' };
const URGENCY_CLR = { High:'#f43f5e',               Medium:'#fbbf24',               Low:'#8899bb' };
const IMPACT_BG   = { High:'rgba(0,232,135,0.09)',  Medium:'rgba(34,211,238,0.07)', Low:'rgba(255,255,255,0.04)' };
const IMPACT_CLR  = { High:'#00e887',               Medium:'#22d3ee',              Low:'#8899bb' };
const VERDICT_CLR = { Strong:'#00e887', Moderate:'#fbbf24', 'Below Average':'#6b84f8', Critical:'#f43f5e' };

function Dots() {
  return (
    <div className="flex items-center gap-2">
      {[0,1,2].map(i => (
        <span key={i} className="w-2 h-2 rounded-full"
          style={{ background:'#4f6ef7', boxShadow:'0 0 6px #4f6ef7', animation:`neon-bounce 1.2s ease-in-out ${i*0.2}s infinite` }} />
      ))}
      <span className="mono text-[11px] ml-1" style={{ color: 'var(--text-dim)' }}>
        ANALYSING FINANCIALS…
      </span>
    </div>
  );
}

export default function AIInsights({ ratioValues, statuses, score, industry, companyContext = {}, onInsightsReady }) {
  const [ins,     setIns]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  async function run() {
    setLoading(true); setDone(false); setIns(null);
    const url = import.meta.env.VITE_BACKEND_URL;
    if (url) {
      try {
        const r = await fetch(`${url}/analyze`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ ratios:ratioValues, statuses, industry, score, company: companyContext }),
        });
        if (r.ok) {
          const data = await r.json();
          setIns(data); onInsightsReady?.(data);
          setLoading(false); setDone(true); return;
        }
      } catch (_) {}
    }
    await new Promise(r => setTimeout(r, 1500));
    const data = analyzeFinancials(ratioValues, statuses, score, industry);
    setIns(data); onInsightsReady?.(data);
    setLoading(false); setDone(true);
  }

  return (
    <section className="mb-10">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-violet-400 text-lg">✦</span>
        <div>
          <span className="mono text-[11px] font-bold uppercase tracking-[0.18em] text-violet-400">AI Analysis</span>
          <span className="text-[11px] ml-3" style={{ color: 'var(--text-dim)' }}>
            Expert insights from 14 ratio patterns
          </span>
        </div>
        <div className="flex-1 h-px ml-2" style={{ background:'linear-gradient(90deg, rgba(167,139,250,0.4), transparent)' }} />
      </div>

      {/* Prompt state */}
      {!done && !loading && (
        <div className="ghost-card rounded-2xl p-8 text-center" style={{ borderColor:'rgba(167,139,250,0.14)' }}>
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl"
            style={{ background:'rgba(167,139,250,0.08)', border:'1px solid rgba(167,139,250,0.2)' }}>
            ✦
          </div>
          <h3 className="font-semibold text-[15px] mb-2" style={{ color: 'var(--text)' }}>
            AI Financial Intelligence
          </h3>
          <p className="text-[13px] max-w-sm mx-auto leading-relaxed mb-6" style={{ color: 'var(--text-dim)' }}>
            Cross-analyses all 14 ratios to identify compound risks, hidden opportunities, and a prioritised action plan — instantly.
          </p>
          <button onClick={run}
            className="btn-primary inline-flex items-center gap-2 text-white font-bold text-sm px-6 py-3 rounded-xl">
            ✦ Generate Analysis
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="ghost-card rounded-2xl p-8 flex flex-col items-center gap-4"
          style={{ borderColor:'rgba(167,139,250,0.14)' }}>
          <Dots />
          <p className="mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
            CROSS-REFERENCING 14 RATIOS · IDENTIFYING RISK PATTERNS
          </p>
        </div>
      )}

      {/* Results */}
      {done && ins && (
        <div className="space-y-4 animate-in">

          {/* Executive Summary */}
          <div className="ghost-card rounded-2xl p-6" style={{ borderColor:'rgba(167,139,250,0.15)' }}>
            <div className="flex items-center justify-between mb-4">
              <span className="mono text-[10px] font-bold uppercase tracking-widest text-violet-400">
                ✦ Executive Summary
              </span>
              <span className="mono text-[11px] font-bold px-3 py-1 rounded-full border"
                style={{
                  color: VERDICT_CLR[ins.health_verdict] || 'var(--text-dim)',
                  background: `${VERDICT_CLR[ins.health_verdict] || '#888'}18`,
                  borderColor: `${VERDICT_CLR[ins.health_verdict] || '#888'}40`,
                }}>
                {ins.health_verdict?.toUpperCase()}
              </span>
            </div>
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {ins.executive_summary}
            </p>
          </div>

          {/* Risks + Opportunities */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Risks */}
            <div className="ghost-card rounded-2xl p-5" style={{ borderColor:'rgba(244,63,94,0.15)' }}>
              <div className="mono text-[10px] font-bold text-red-400 uppercase tracking-widest mb-4">
                ⚠ Key Risks
              </div>
              <div className="space-y-3">
                {(ins.top_risks||[]).map((r,i) => (
                  <div key={i} className="rounded-xl p-3"
                    style={{ background:URGENCY_BG[r.urgency], border:`1px solid ${URGENCY_CLR[r.urgency]}28` }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background:URGENCY_CLR[r.urgency], boxShadow:`0 0 5px ${URGENCY_CLR[r.urgency]}` }} />
                      <span className="text-[12px] font-semibold flex-1" style={{ color: 'var(--text)' }}>
                        {r.title}
                      </span>
                      <span className="mono text-[9px] font-bold" style={{ color:URGENCY_CLR[r.urgency] }}>
                        {r.urgency?.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed pl-3.5" style={{ color: 'var(--text-dim)' }}>
                      {r.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Opportunities */}
            <div className="ghost-card rounded-2xl p-5" style={{ borderColor:'rgba(0,232,135,0.12)' }}>
              <div className="mono text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-4">
                → Opportunities
              </div>
              <div className="space-y-3">
                {(ins.top_opportunities||[]).map((o,i) => (
                  <div key={i} className="rounded-xl p-3"
                    style={{ background:IMPACT_BG[o.impact], border:`1px solid ${IMPACT_CLR[o.impact]}28` }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background:IMPACT_CLR[o.impact], boxShadow:`0 0 5px ${IMPACT_CLR[o.impact]}` }} />
                      <span className="text-[12px] font-semibold flex-1" style={{ color: 'var(--text)' }}>
                        {o.title}
                      </span>
                      <span className="mono text-[9px] font-bold" style={{ color:IMPACT_CLR[o.impact] }}>
                        {o.impact?.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed pl-3.5" style={{ color: 'var(--text-dim)' }}>
                      {o.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Priority Actions */}
          <div className="ghost-card rounded-2xl p-5" style={{ borderColor:'rgba(79,110,247,0.18)' }}>
            <div className="mono text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color:'#6b84f8' }}>
              ⚡ Priority Action Plan
            </div>
            <div className="space-y-0">
              {(ins.priority_actions||[]).map((a,i) => (
                <div key={i} className="flex gap-3 py-3"
                  style={{ borderBottom: i < (ins.priority_actions.length-1) ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mono text-[11px] font-bold mt-0.5"
                    style={{ background:'rgba(79,110,247,0.13)', border:'1px solid rgba(79,110,247,0.3)', color:'#6b84f8' }}>
                    {i+1}
                  </div>
                  <div>
                    <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {a.action}
                    </p>
                    <div className="flex flex-wrap gap-4 mt-2">
                      <span className="mono text-[10px]" style={{ color: 'var(--text-dim)' }}>
                        ⏱ <span style={{ color: 'var(--text-secondary)' }}>{a.timeline}</span>
                      </span>
                      <span className="mono text-[10px]" style={{ color: 'var(--text-dim)' }}>
                        → <span style={{ color: 'var(--text-secondary)' }}>{a.expected_impact}</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Industry Context */}
          <div className="ghost-card rounded-2xl p-5" style={{ borderColor:'rgba(34,211,238,0.12)' }}>
            <div className="mono text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-3">
              ◈ Industry Context
            </div>
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {ins.industry_context}
            </p>
          </div>

          <div className="text-center pt-1">
            <button onClick={run}
              className="mono text-[11px] font-medium transition-colors"
              style={{ color: 'var(--text-dim)' }}
              onMouseEnter={e => e.currentTarget.style.color='#22d3ee'}
              onMouseLeave={e => e.currentTarget.style.color='var(--text-dim)'}>
              ↺ Re-run Analysis
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
