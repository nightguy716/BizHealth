/**
 * SummaryBanner.jsx
 *
 * The banner at the top of the results area.
 * It counts how many ratios are Green, Amber, and Red,
 * then shows an overall health verdict and a score bar.
 *
 * Score logic:
 *   Green = 2 points, Amber = 1 point, Red = 0 points
 *   Max score = total ratios × 2
 *   Health % = (total points / max points) × 100
 */

import { useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

function getVerdict(pct) {
  if (pct >= 80) return { label: 'Strong Financial Health',    color: 'text-emerald-400', bar: 'bg-emerald-400' };
  if (pct >= 60) return { label: 'Moderate Financial Health',  color: 'text-amber-400',   bar: 'bg-amber-400'   };
  if (pct >= 40) return { label: 'Below-Average Health',       color: 'text-orange-400',  bar: 'bg-orange-400'  };
  return              { label: 'Critical — Action Required',   color: 'text-red-400',     bar: 'bg-red-400'     };
}

export default function SummaryBanner({ statuses, onExportPDF, industry }) {
  const green = statuses.filter(s => s === 'green').length;
  const amber = statuses.filter(s => s === 'amber').length;
  const red   = statuses.filter(s => s === 'red').length;
  const na    = statuses.filter(s => s === 'na').length;
  const valid = statuses.length - na;

  const points    = green * 2 + amber * 1;
  const maxPoints = valid * 2;
  const pct       = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 0;
  const verdict   = getVerdict(pct);

  return (
    <div className="bg-slate-900 rounded-2xl p-6 mb-8 text-white relative overflow-hidden">
      {/* Subtle background decoration */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-orange-400"></div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-blue-400"></div>
      </div>

      <div className="relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">Overall Assessment</p>
            <h1 className={`text-2xl font-bold ${verdict.color}`}>
              Your business is in {verdict.label}
            </h1>
            <p className="text-slate-400 text-sm mt-1">Health Score: {pct}% based on {valid} calculated ratios</p>
          </div>

          <button
            onClick={onExportPDF}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-150 shadow-lg shadow-orange-500/20 whitespace-nowrap self-start sm:self-center"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download PDF Report
          </button>
        </div>

        {/* Score bar */}
        <div className="mb-5">
          <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-1000 ease-out ${verdict.bar}`}
              style={{ width: `${pct}%` }}
            ></div>
          </div>
        </div>

        {/* Green / Amber / Red breakdown pills */}
        <div className="flex flex-wrap gap-3">
          <span className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            {green} Healthy
          </span>
          <span className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            {amber} Borderline
          </span>
          <span className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-red-400"></span>
            {red} Needs Attention
          </span>
          {na > 0 && (
            <span className="flex items-center gap-2 bg-slate-700/50 border border-slate-600 text-slate-400 text-xs font-medium px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-slate-500"></span>
              {na} No Data
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
