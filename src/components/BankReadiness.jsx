/**
 * BankReadiness.jsx
 *
 * Evaluates the 5 ratios that Indian banks (SBI, HDFC, ICICI) most commonly
 * check before approving a business loan. Gives an overall readiness score out of 100.
 *
 * This is unique to BizHealth — no other SME tool does this for private businesses.
 */

const BANK_CHECKS = [
  {
    key:       'currentRatio',
    label:     'Current Ratio',
    minGood:   1.5,
    unit:      'x',
    direction: 'higher',
    weight:    20,
    why:       'Banks verify you can repay short-term obligations without stress.',
  },
  {
    key:       'debtToEquity',
    label:     'Debt to Equity',
    minGood:   2.0,
    unit:      'x',
    direction: 'lower',
    weight:    25,
    why:       'Banks want to see you are not already over-leveraged.',
  },
  {
    key:       'interestCoverage',
    label:     'Interest Coverage',
    minGood:   2.5,
    unit:      'x',
    direction: 'higher',
    weight:    25,
    why:       'Lenders need confidence that your operating profit can service new debt interest.',
  },
  {
    key:       'netMargin',
    label:     'Net Profit Margin',
    minGood:   5,
    unit:      '%',
    direction: 'higher',
    weight:    15,
    why:       'Profitability signals the business can sustain repayments over time.',
  },
  {
    key:       'grossMargin',
    label:     'Gross Margin',
    minGood:   20,
    unit:      '%',
    direction: 'higher',
    weight:    15,
    why:       'Shows core business viability before overheads and interest.',
  },
];

function getCheckScore(value, check) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  const { minGood, direction, weight } = check;
  if (direction === 'higher') {
    if (value >= minGood)          return weight;
    if (value >= minGood * 0.75)   return weight * 0.5;
    return 0;
  } else {
    if (value <= minGood)          return weight;
    if (value <= minGood * 1.25)   return weight * 0.5;
    return 0;
  }
}

function getVerdict(score) {
  if (score >= 80) return { label: 'Strong — Likely Eligible',     color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
  if (score >= 60) return { label: 'Good — Eligible with Caveats', color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20'   };
  if (score >= 40) return { label: 'Fair — Borderline Case',       color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/20'  };
  return               { label: 'Weak — Strengthen Before Applying', color: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/20'       };
}

export default function BankReadiness({ ratioValues }) {
  const totalScore = BANK_CHECKS.reduce((sum, check) => {
    return sum + getCheckScore(ratioValues[check.key], check);
  }, 0);

  const verdict = getVerdict(totalScore);

  return (
    <section className="mb-10">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-5">
        <span className="text-xl">🏦</span>
        <div>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">Bank Loan Readiness</h2>
          <p className="text-slate-600 text-[11px] mt-0.5">How your financials look to Indian bank loan officers</p>
        </div>
        <div className="flex-1 h-px bg-white/[0.06] ml-2"></div>
      </div>

      <div className="glass-card rounded-2xl p-6 border-white/[0.08]">
        {/* Score */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-slate-500 text-[11px] uppercase tracking-wider mb-1">Readiness Score</p>
            <div className="flex items-end gap-2">
              <span className={`text-5xl font-bold ${verdict.color}`}>{Math.round(totalScore)}</span>
              <span className="text-slate-600 text-lg mb-1">/100</span>
            </div>
          </div>
          <div className={`inline-flex items-center gap-2 border px-4 py-2 rounded-xl text-sm font-semibold ${verdict.bg} ${verdict.color}`}>
            {verdict.label}
          </div>
        </div>

        {/* Score bar */}
        <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden mb-6">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-1000"
            style={{ width: `${totalScore}%` }}
          />
        </div>

        {/* Individual checks */}
        <div className="space-y-3">
          {BANK_CHECKS.map(check => {
            const value  = ratioValues[check.key];
            const score  = getCheckScore(value, check);
            const passed = score === check.weight;
            const half   = score === check.weight * 0.5;
            const na     = value === null || value === undefined || isNaN(value);

            const displayVal = na
              ? '—'
              : `${Number(value).toFixed(2)}${check.unit}`;

            return (
              <div key={check.key} className="flex items-start gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
                {/* Status icon */}
                <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs mt-0.5
                  ${na     ? 'bg-slate-700 text-slate-500'   :
                    passed  ? 'bg-emerald-500/20 text-emerald-400' :
                    half    ? 'bg-amber-500/20 text-amber-400'     :
                              'bg-red-500/20 text-red-400'}`}>
                  {na ? '?' : passed ? '✓' : half ? '~' : '✗'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-300 text-xs font-medium">{check.label}</span>
                    <span className={`text-sm font-bold flex-shrink-0
                      ${na ? 'text-slate-600' : passed ? 'text-emerald-400' : half ? 'text-amber-400' : 'text-red-400'}`}>
                      {displayVal}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">{check.why}</p>
                </div>

                <div className={`text-[10px] font-bold flex-shrink-0 mt-0.5
                  ${passed ? 'text-emerald-500' : half ? 'text-amber-500' : 'text-slate-600'}`}>
                  +{score}/{check.weight}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-slate-600 text-[11px] mt-4 leading-relaxed">
          * Based on standard lending criteria of major Indian banks (SBI, HDFC Bank, ICICI Bank). Actual eligibility depends on additional factors including business vintage, credit score, and sector.
        </p>
      </div>
    </section>
  );
}
