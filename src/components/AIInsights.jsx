/**
 * AIInsights.jsx
 *
 * Displays the full AI-powered financial analysis.
 * Shows: executive summary, health verdict, top risks, opportunities, priority actions,
 * and industry context. Includes a loading/thinking animation.
 *
 * First tries to call the FastAPI backend (if VITE_BACKEND_URL is set).
 * Falls back to the local aiAnalysis.js engine instantly.
 */

import { useState, useEffect } from 'react';
import { analyzeFinancials } from '../utils/aiAnalysis';

const URGENCY_STYLES = {
  High:   { bg: 'bg-red-500/10 border-red-500/20',     dot: 'bg-red-400',     text: 'text-red-400'     },
  Medium: { bg: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400',   text: 'text-amber-400'   },
  Low:    { bg: 'bg-slate-700/50 border-slate-600',    dot: 'bg-slate-500',   text: 'text-slate-400'   },
};
const IMPACT_STYLES = {
  High:   { bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400', text: 'text-emerald-400' },
  Medium: { bg: 'bg-blue-500/10 border-blue-500/20',       dot: 'bg-blue-400',    text: 'text-blue-400'    },
  Low:    { bg: 'bg-slate-700/50 border-slate-600',        dot: 'bg-slate-500',   text: 'text-slate-400'   },
};

const VERDICT_STYLES = {
  'Strong':        'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  'Moderate':      'text-amber-400   bg-amber-500/10   border-amber-500/25',
  'Below Average': 'text-orange-400  bg-orange-500/10  border-orange-500/25',
  'Critical':      'text-red-400     bg-red-500/10     border-red-500/25',
};

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 py-2">
      {[0,1,2].map(i => (
        <span key={i} className="w-2 h-2 rounded-full bg-orange-400"
          style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
      <span className="text-slate-500 text-xs ml-2">Analysing your financials…</span>
    </div>
  );
}

export default function AIInsights({ ratioValues, statuses, score, industry }) {
  const [insights, setInsights] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);

  async function runAnalysis() {
    setLoading(true);
    setDone(false);
    setInsights(null);

    // Try real backend first (if configured via env var)
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    if (backendUrl) {
      try {
        const res = await fetch(`${backendUrl}/analyze`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ ratios: ratioValues, statuses, industry, score }),
        });
        if (res.ok) {
          const data = await res.json();
          setInsights(data);
          setLoading(false);
          setDone(true);
          return;
        }
      } catch (_) { /* fall through to local engine */ }
    }

    // Local AI engine — slight delay to feel "thoughtful"
    await new Promise(r => setTimeout(r, 1400));
    setInsights(analyzeFinancials(ratioValues, statuses, score, industry));
    setLoading(false);
    setDone(true);
  }

  return (
    <section className="mb-10">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-5">
        <span className="text-xl">✨</span>
        <div>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">AI Financial Analysis</h2>
          <p className="text-slate-600 text-[11px] mt-0.5">Expert-level insights generated from your 14 ratios</p>
        </div>
        <div className="flex-1 h-px bg-white/[0.06] ml-2"></div>
      </div>

      {!done && !loading && (
        <div className="glass-card rounded-2xl p-6 border-white/[0.08] flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-4 text-2xl">✨</div>
          <h3 className="text-white font-semibold mb-2">Get Your AI Financial Report</h3>
          <p className="text-slate-500 text-sm max-w-sm leading-relaxed mb-5">
            Our AI analyst will review all 14 ratios together, identify compound risks you might miss, and generate a prioritised action plan.
          </p>
          <button
            onClick={runAnalysis}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-all duration-150 glow-orange"
          >
            <span>✨</span> Generate AI Analysis
          </button>
        </div>
      )}

      {loading && (
        <div className="glass-card rounded-2xl p-8 border-white/[0.08] flex flex-col items-center">
          <ThinkingDots />
          <p className="text-slate-600 text-xs mt-2">Reading all 14 ratios and identifying patterns…</p>
        </div>
      )}

      {done && insights && (
        <div className="space-y-4 animate-fade-slide">
          {/* Executive Summary + Verdict */}
          <div className="glass-card rounded-2xl p-6 border-white/[0.08]">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-base">✨</span>
                <h3 className="text-white font-semibold text-sm">Executive Summary</h3>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full border self-start ${VERDICT_STYLES[insights.health_verdict] || ''}`}>
                {insights.health_verdict}
              </span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">{insights.executive_summary}</p>
          </div>

          {/* Risks + Opportunities */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Risks */}
            <div className="glass-card rounded-2xl p-5 border-white/[0.08]">
              <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span>⚠</span> Key Risks
              </h3>
              <div className="space-y-3">
                {(insights.top_risks || []).map((risk, i) => {
                  const s = URGENCY_STYLES[risk.urgency] || URGENCY_STYLES.Low;
                  return (
                    <div key={i} className={`rounded-xl p-3 border ${s.bg}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`}></span>
                        <span className="text-slate-200 text-xs font-semibold">{risk.title}</span>
                        <span className={`ml-auto text-[10px] font-bold ${s.text}`}>{risk.urgency}</span>
                      </div>
                      <p className="text-slate-500 text-[11px] leading-relaxed pl-3.5">{risk.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Opportunities */}
            <div className="glass-card rounded-2xl p-5 border-white/[0.08]">
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span>→</span> Opportunities
              </h3>
              <div className="space-y-3">
                {(insights.top_opportunities || []).map((opp, i) => {
                  const s = IMPACT_STYLES[opp.impact] || IMPACT_STYLES.Low;
                  return (
                    <div key={i} className={`rounded-xl p-3 border ${s.bg}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`}></span>
                        <span className="text-slate-200 text-xs font-semibold">{opp.title}</span>
                        <span className={`ml-auto text-[10px] font-bold ${s.text}`}>{opp.impact} Impact</span>
                      </div>
                      <p className="text-slate-500 text-[11px] leading-relaxed pl-3.5">{opp.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Priority Actions */}
          <div className="glass-card rounded-2xl p-5 border-white/[0.08]">
            <h3 className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span>⚡</span> Priority Action Plan
            </h3>
            <div className="space-y-3">
              {(insights.priority_actions || []).map((act, i) => (
                <div key={i} className="flex gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
                  <div className="w-6 h-6 rounded-full bg-orange-500/20 border border-orange-500/30 flex-shrink-0 flex items-center justify-center text-orange-400 font-bold text-xs mt-0.5">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-300 text-xs leading-relaxed">{act.action}</p>
                    <div className="flex flex-wrap gap-3 mt-1.5">
                      <span className="text-[10px] text-slate-600">
                        ⏱ <span className="text-slate-500">{act.timeline}</span>
                      </span>
                      <span className="text-[10px] text-slate-600">
                        → <span className="text-slate-500">{act.expected_impact}</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Industry Context */}
          <div className="glass-card rounded-2xl p-5 border-white/[0.08]">
            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span>🌐</span> Industry Context
            </h3>
            <p className="text-slate-500 text-sm leading-relaxed">{insights.industry_context}</p>
          </div>

          {/* Re-run button */}
          <div className="text-center">
            <button
              onClick={runAnalysis}
              className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
            >
              ↺ Re-run analysis
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
