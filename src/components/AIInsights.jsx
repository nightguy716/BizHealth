import { useState } from 'react';
import { analyzeFinancials } from '../utils/aiAnalysis';

const U = { High:'rgba(244,63,94,0.12)','Medium':'rgba(251,191,36,0.1)','Low':'rgba(255,255,255,0.04)' };
const UC= { High:'#f43f5e', Medium:'#fbbf24', Low:'#64748b' };
const I = { High:'rgba(0,232,135,0.1)', Medium:'rgba(34,211,238,0.08)', Low:'rgba(255,255,255,0.04)' };
const IC= { High:'#00e887', Medium:'#22d3ee', Low:'#64748b' };
const V = { Strong:'#00e887', Moderate:'#fbbf24', 'Below Average':'#6b84f8', Critical:'#f43f5e' };

function Dots() {
  return (
    <div className="flex items-center gap-1.5">
      {[0,1,2].map(i => (
        <span key={i} className="w-2 h-2 rounded-full" style={{ background:'#4f6ef7', boxShadow:'0 0 6px #4f6ef7', animation:`neon-bounce 1.2s ease-in-out ${i*0.2}s infinite` }} />
      ))}
      <span className="mono text-[11px] text-slate-600 ml-2">ANALYSING FINANCIALS…</span>
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
        const r = await fetch(`${url}/analyze`,{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ ratios:ratioValues, statuses, industry, score, company: companyContext }) });
        if (r.ok) { const ins = await r.json(); setIns(ins); onInsightsReady?.(ins); setLoading(false); setDone(true); return; }
      } catch (_) {}
    }
    await new Promise(r=>setTimeout(r,1500));
    const ins = analyzeFinancials(ratioValues, statuses, score, industry);
    setIns(ins); onInsightsReady?.(ins); setLoading(false); setDone(true);
  }

  return (
    <section className="mb-10">
      <div className="flex items-center gap-3 mb-5">
        <span className="text-lg">✦</span>
        <div>
          <span className="mono text-[11px] font-bold uppercase tracking-[0.18em] text-violet-400">AI ANALYSIS</span>
          <span className="text-slate-700 text-[10px] ml-3">Expert insights from 14 ratio patterns</span>
        </div>
        <div className="flex-1 h-px ml-2" style={{ background:'linear-gradient(90deg, rgba(167,139,250,0.5), transparent)' }} />
      </div>

      {!done && !loading && (
        <div className="ghost-card rounded-2xl p-8 text-center" style={{ borderColor:'rgba(167,139,250,0.15)' }}>
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl" style={{ background:'rgba(167,139,250,0.08)', border:'1px solid rgba(167,139,250,0.2)' }}>✦</div>
          <h3 className="text-white font-semibold mb-2">AI Financial Intelligence</h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto leading-relaxed mb-6">
            Cross-analyses all 14 ratios to identify compound risks, hidden opportunities, and a prioritised action plan — instantly.
          </p>
          <button onClick={run} className="btn-primary inline-flex items-center gap-2 text-white font-bold text-sm px-6 py-3 rounded-xl">
            ✦ Generate Analysis
          </button>
        </div>
      )}

      {loading && (
        <div className="ghost-card rounded-2xl p-8 flex flex-col items-center gap-3" style={{ borderColor:'rgba(167,139,250,0.15)' }}>
          <Dots />
          <p className="text-slate-700 text-xs mono">CROSS-REFERENCING 14 RATIOS · IDENTIFYING RISK PATTERNS</p>
        </div>
      )}

      {done && ins && (
        <div className="space-y-4 animate-in">
          {/* Summary */}
          <div className="ghost-card rounded-2xl p-6" style={{ borderColor:'rgba(167,139,250,0.15)' }}>
            <div className="flex items-center justify-between mb-4">
              <span className="mono text-[10px] font-bold text-violet-400 uppercase tracking-widest">✦ Executive Summary</span>
              <span className="mono text-xs font-bold px-3 py-1 rounded-full border" style={{ color: V[ins.health_verdict]||'#94a3b8', background:`${V[ins.health_verdict]||'#94a3b8'}18`, borderColor:`${V[ins.health_verdict]||'#94a3b8'}40`, textShadow:`0 0 12px ${V[ins.health_verdict]||'#94a3b8'}` }}>
                {ins.health_verdict?.toUpperCase()}
              </span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">{ins.executive_summary}</p>
          </div>

          {/* Risks + Opportunities */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="ghost-card rounded-2xl p-5" style={{ borderColor:'rgba(244,63,94,0.15)' }}>
              <div className="mono text-[10px] font-bold text-red-400 uppercase tracking-widest mb-4">⚠ KEY RISKS</div>
              <div className="space-y-3">
                {(ins.top_risks||[]).map((r,i) => (
                  <div key={i} className="rounded-xl p-3" style={{ background:U[r.urgency], border:`1px solid ${UC[r.urgency]}30` }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background:UC[r.urgency], boxShadow:`0 0 5px ${UC[r.urgency]}` }} />
                      <span className="text-slate-200 text-xs font-semibold flex-1">{r.title}</span>
                      <span className="mono text-[10px] font-bold" style={{ color:UC[r.urgency] }}>{r.urgency?.toUpperCase()}</span>
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed pl-3.5">{r.description}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="ghost-card rounded-2xl p-5" style={{ borderColor:'rgba(0,232,135,0.12)' }}>
              <div className="mono text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-4">→ OPPORTUNITIES</div>
              <div className="space-y-3">
                {(ins.top_opportunities||[]).map((o,i) => (
                  <div key={i} className="rounded-xl p-3" style={{ background:I[o.impact], border:`1px solid ${IC[o.impact]}30` }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background:IC[o.impact], boxShadow:`0 0 5px ${IC[o.impact]}` }} />
                      <span className="text-slate-200 text-xs font-semibold flex-1">{o.title}</span>
                      <span className="mono text-[10px] font-bold" style={{ color:IC[o.impact] }}>{o.impact?.toUpperCase()}</span>
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed pl-3.5">{o.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="ghost-card rounded-2xl p-5" style={{ borderColor:'rgba(79,110,247,0.18)' }}>
            <div className="mono text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color:'#6b84f8' }}>⚡ PRIORITY ACTION PLAN</div>
            <div className="space-y-3">
              {(ins.priority_actions||[]).map((a,i) => (
                <div key={i} className="flex gap-3 py-2.5" style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                  <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mono text-[11px] font-bold mt-0.5" style={{ background:'rgba(79,110,247,0.12)', border:'1px solid rgba(79,110,247,0.3)', color:'#6b84f8' }}>{i+1}</div>
                  <div>
                    <p className="text-slate-300 text-xs leading-relaxed">{a.action}</p>
                    <div className="flex flex-wrap gap-3 mt-1.5">
                      <span className="mono text-[10px] text-slate-600">⏱ <span className="text-slate-500">{a.timeline}</span></span>
                      <span className="mono text-[10px] text-slate-600">→ <span className="text-slate-500">{a.expected_impact}</span></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Industry */}
          <div className="ghost-card rounded-2xl p-5" style={{ borderColor:'rgba(34,211,238,0.1)' }}>
            <div className="mono text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-3">◈ INDUSTRY CONTEXT</div>
            <p className="text-slate-500 text-sm leading-relaxed">{ins.industry_context}</p>
          </div>

          <div className="text-center">
            <button onClick={run} className="mono text-[11px] text-slate-600 hover:text-cyan-400 transition-colors">↺ RE-RUN ANALYSIS</button>
          </div>
        </div>
      )}
    </section>
  );
}
