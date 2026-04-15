import { useState } from 'react';

/*
  Earnings Quality Analysis
  ─────────────────────────
  Covers three frameworks used by CFA charterholders and forensic accountants:

  1. CFO / Net Income ratio  — "Cash Backing"
     > 1.0 = earnings are cash-backed (safe)
     < 0.5 = most profit is paper, not cash (warning)

  2. Accruals Ratio (Balance Sheet method)
     = (Net Operating Assets_t - Net Operating Assets_t-1) / Avg NOA
     NOA = Total Assets - Cash - Total Liabilities + Short-term Debt + Long-term Debt
     High positive accruals → earnings may be inflated by accruals

  3. Beneish M-Score (8-variable model, simplified 5-variable when full data absent)
     M-Score > -1.78 → possible manipulator (flag)
     Uses ratios of current-year vs prior-year financials.
     Full 8-variable requires two years of data; simplified 3-variable uses single year.
*/

function safe(v) { return isNaN(v) || !isFinite(v) ? null : v; }
function ratio(a, b) { return b && b !== 0 ? safe(a / b) : null; }
function fmt(v, unit = '') {
  if (v === null || v === undefined || isNaN(v)) return '—';
  if (unit === '%') return v.toFixed(1) + '%';
  if (unit === 'x') return v.toFixed(2) + '×';
  return v.toFixed(2);
}

/* ── Flag badge ── */
function FlagBadge({ level, label }) {
  const cfg = {
    safe:    { bg: 'rgba(0,232,135,0.1)',  border: 'rgba(0,232,135,0.3)',  color: '#00e887', dot: '#00e887' },
    warn:    { bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)', color: '#fbbf24', dot: '#fbbf24' },
    risk:    { bg: 'rgba(244,63,94,0.1)',  border: 'rgba(244,63,94,0.3)',  color: '#f43f5e', dot: '#f43f5e' },
    neutral: { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)', color: '#6b82a8', dot: '#3d5070' },
  };
  const c = cfg[level] || cfg.neutral;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: c.bg, border: `1px solid ${c.border}`, color: c.color,
      borderRadius: 999, padding: '3px 10px',
      fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot,
        boxShadow: level !== 'neutral' ? `0 0 5px ${c.dot}` : 'none' }} />
      {label}
    </span>
  );
}

/* ── Metric row in the details table ── */
function MetricRow({ label, value, unit, flagLevel, flagLabel, interpretation }) {
  const [expand, setExpand] = useState(false);
  const hasNote = !!interpretation;
  return (
    <>
      <div
        className="grid items-center py-2.5 px-3 rounded-lg transition-colors duration-150"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 80px 1fr',
          gap: 12,
          cursor: hasNote ? 'pointer' : 'default',
          background: expand ? 'rgba(255,255,255,0.025)' : 'transparent',
        }}
        onClick={() => hasNote && setExpand(e => !e)}
      >
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#9fb3d4' }}>
          {label}
          {hasNote && (
            <span style={{ marginLeft: 4, fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: '#3d5070' }}>
              {expand ? '▲' : '▼'}
            </span>
          )}
        </span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700,
          color: flagLevel === 'risk' ? '#f43f5e' : flagLevel === 'warn' ? '#fbbf24'
               : flagLevel === 'safe' ? '#00e887' : '#6b82a8',
          textAlign: 'right' }}>
          {fmt(value, unit)}
        </span>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {flagLabel && <FlagBadge level={flagLevel} label={flagLabel} />}
        </div>
      </div>
      {expand && interpretation && (
        <div className="mx-3 mb-2 px-3 py-2 rounded-lg"
          style={{ background: 'rgba(79,110,247,0.06)', border: '1px solid rgba(79,110,247,0.15)' }}>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#9fb3d4', lineHeight: 1.6 }}>
            {interpretation}
          </p>
        </div>
      )}
    </>
  );
}

export default function EarningsQuality({ ratioValues, inputs, historical }) {
  const n = k => parseFloat(inputs?.[k]) || 0;

  /* Current year inputs */
  const netProfit     = n('netProfit');
  const operatingCF   = n('operatingCashFlow');
  const totalAssets   = n('totalAssets');
  const cash          = n('cash');
  const totalDebt     = n('totalDebt');
  const revenue       = n('revenue');
  const receivables   = n('receivables');
  const grossProfit   = n('grossProfit');
  const cogs          = n('cogs');
  const da            = n('da');
  const acctPayable   = n('accountsPayable');

  /* ── 1. CFO / Net Income ── */
  const cfoRatio = ratio(operatingCF, netProfit);
  const cfoLevel = cfoRatio === null ? 'neutral'
                 : cfoRatio >= 1.0  ? 'safe'
                 : cfoRatio >= 0.5  ? 'warn'
                 : 'risk';
  const cfoFlag  = cfoLevel === 'safe' ? 'CASH BACKED'
                 : cfoLevel === 'warn' ? 'PARTIAL ACCRUAL'
                 : cfoLevel === 'risk' ? 'LOW CASH QUALITY'
                 : 'NO DATA';

  /* ── 2. Accruals Ratio (single-year approximation) ──
     Accruals = Net Income - Operating Cash Flow
     Accruals Ratio = Accruals / Average Total Assets (approx with current assets) */
  const accruals       = operatingCF !== 0 ? netProfit - operatingCF : null;
  const accrualsRatio  = (accruals !== null && totalAssets > 0) ? accruals / totalAssets : null;
  const accrualsLevel  = accrualsRatio === null    ? 'neutral'
                       : Math.abs(accrualsRatio) < 0.05 ? 'safe'
                       : Math.abs(accrualsRatio) < 0.10 ? 'warn'
                       : 'risk';
  const accrualsFlag   = accrualsLevel === 'safe' ? 'LOW ACCRUALS'
                       : accrualsLevel === 'warn' ? 'MODERATE ACCRUALS'
                       : accrualsLevel === 'risk' ? 'HIGH ACCRUALS'
                       : 'NO DATA';

  /* ── 3. Beneish M-Score (simplified 5-variable) ──
     Requires comparison between two periods. Use historical if available,
     otherwise display what we can with a single year.

     Full 8-variable M-Score:
     M = -4.84 + 0.920*DSRI + 0.528*GMI + 0.404*AQI + 0.892*SGI
           + 0.115*DEPI − 0.172*SGAI + 4.679*TATA − 0.327*LVGI

     5-variable (no prior year needed for these):
     We use a simplified approach with available data.
  */
  const incArr = (historical?.income  || []).filter(y => y?.revenue);
  const balArr = (historical?.balance || []).filter(y => y?.totalAssets);
  const hasPrior = incArr.length >= 2 && balArr.length >= 2;

  let mScore = null;
  let mVars  = {};

  if (hasPrior) {
    const curr = { ...incArr[0], ...(balArr[0] || {}) };
    const prev = { ...incArr[1], ...(balArr[1] || {}) };

    const pRev  = prev.revenue    || 1;
    const cRev  = curr.revenue    || 0;
    const pGP   = prev.grossProfit|| 0;
    const cGP   = curr.grossProfit|| 0;
    const pTA   = prev.totalAssets|| 1;
    const cTA   = curr.totalAssets|| 0;
    const pRec  = prev.receivables|| 0;
    const cRec  = curr.receivables|| 0;
    const pDA   = prev.da         || prev.depreciation || 1;
    const cDA   = curr.da         || curr.depreciation || 1;
    const pNI   = prev.netProfit  || 0;
    const cNI   = curr.netProfit  || 0;
    const pCF   = prev.operatingCashFlow || 0;
    const cCF   = curr.operatingCashFlow || 0;

    /* Days Sales Receivables Index (DSRI) */
    const dsri  = (pRev > 0 && cRec >= 0 && pRec >= 0)
                  ? (cRec / cRev) / ((pRec || 0.001) / pRev)
                  : null;

    /* Gross Margin Index (GMI) — prior / current; >1 means deteriorating margin */
    const gmi   = (pRev > 0 && cRev > 0 && pGP >= 0 && cGP >= 0)
                  ? (pGP / pRev) / (cGP / cRev || 0.001)
                  : null;

    /* Asset Quality Index (AQI) */
    const aqiCurr  = cTA > 0 ? 1 - (cGP / cTA) : null;
    const aqiPrev  = pTA > 0 ? 1 - (pGP / pTA) : null;
    const aqi      = aqiCurr !== null && aqiPrev !== null && aqiPrev !== 0
                     ? aqiCurr / aqiPrev : null;

    /* Sales Growth Index (SGI) */
    const sgi   = pRev > 0 ? cRev / pRev : null;

    /* Depreciation Index (DEPI) */
    const depiCurr = (cDA + (cRev - cGP)) > 0 ? cDA / (cDA + (cRev - cGP)) : null;
    const depiPrev = (pDA + (pRev - pGP)) > 0 ? pDA / (pDA + (pRev - pGP)) : null;
    const depi     = depiCurr && depiPrev && depiCurr !== 0 ? depiPrev / depiCurr : null;

    /* Total Accruals to Total Assets (TATA) */
    const tata  = cTA > 0 ? (cNI - cCF) / cTA : null;

    mVars = { dsri, gmi, aqi, sgi, depi, tata };

    /* M-Score calculation (simplified with available vars) */
    const available = [dsri, gmi, aqi, sgi, depi, tata].filter(v => v !== null);
    if (available.length >= 3) {
      mScore = -4.84
        + 0.920  * (dsri  ?? 1)
        + 0.528  * (gmi   ?? 1)
        + 0.404  * (aqi   ?? 1)
        + 0.892  * (sgi   ?? 1)
        + 0.115  * (depi  ?? 1)
        + 4.679  * (tata  ?? 0);
    }
  }

  const mLevel = mScore === null ? 'neutral'
               : mScore <= -2.22 ? 'safe'   // Very unlikely to be manipulated
               : mScore <= -1.78 ? 'warn'   // Grey zone
               : 'risk';                     // Likely manipulated
  const mFlag  = mLevel === 'safe' ? 'UNLIKELY MANIPULATOR'
               : mLevel === 'warn' ? 'GREY ZONE'
               : mLevel === 'risk' ? 'POSSIBLE MANIPULATOR'
               : 'INSUFFICIENT DATA';

  /* ── Overall earnings quality verdict ── */
  const riskCount = [cfoLevel, accrualsLevel, mScore !== null ? mLevel : null]
    .filter(l => l === 'risk').length;
  const warnCount = [cfoLevel, accrualsLevel, mScore !== null ? mLevel : null]
    .filter(l => l === 'warn').length;

  const overallLevel = riskCount >= 2 ? 'risk'
                     : riskCount >= 1 || warnCount >= 2 ? 'warn'
                     : 'safe';

  const overallLabel = overallLevel === 'risk' ? 'LOW EARNINGS QUALITY'
                     : overallLevel === 'warn' ? 'MODERATE CONCERNS'
                     : 'HIGH EARNINGS QUALITY';

  const hasAnyData = netProfit !== 0 || operatingCF !== 0;

  if (!hasAnyData) {
    return (
      <section className="ghost-card rounded-2xl p-6 mb-10 animate-in">
        <div className="flex items-center gap-3 mb-2">
          <span className="mono text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: '#f59e0b' }}>
            Earnings Quality
          </span>
        </div>
        <p style={{ fontSize: 12, color: '#6b82a8' }}>
          Enter Net Profit and Operating Cash Flow to run earnings quality analysis.
        </p>
      </section>
    );
  }

  return (
    <section className="ghost-card rounded-2xl p-6 mb-10 animate-in overflow-hidden relative">
      {/* Ambient glow */}
      <div className="absolute top-0 left-0 w-48 h-48 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)', transform: 'translate(-30%,-30%)' }} />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-lg">🔬</span>
          <div>
            <span className="mono text-[11px] font-bold uppercase tracking-[0.18em]"
              style={{ color: '#f59e0b' }}>Earnings Quality Analysis</span>
            <p className="text-[10px] mt-0.5" style={{ color: '#6b82a8' }}>
              Beneish M-Score · Accruals · CFO/NI · Forensic flags
            </p>
          </div>
        </div>
        <FlagBadge level={overallLevel} label={overallLabel} />
      </div>

      {/* Metrics table */}
      <div className="mb-5 rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        {/* Table header */}
        <div className="grid px-3 py-2"
          style={{
            display: 'grid', gridTemplateColumns: '1fr 80px 1fr',
            background: 'rgba(255,255,255,0.04)', gap: 12,
            fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
            fontWeight: 700, letterSpacing: '0.12em', color: '#3d5070',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
          <span>METRIC</span>
          <span style={{ textAlign: 'right' }}>VALUE</span>
          <span style={{ textAlign: 'right' }}>FLAG</span>
        </div>

        <MetricRow
          label="CFO / Net Income"
          value={cfoRatio} unit="x"
          flagLevel={cfoLevel} flagLabel={cfoFlag}
          interpretation="Compares Operating Cash Flow to Net Income. A ratio ≥ 1.0 means the company's reported profits are fully backed by actual cash received — a strong sign of earnings quality. Ratios below 0.5 suggest most income is on paper only (accrual-heavy), which is a common warning in pre-distress companies."
        />
        <MetricRow
          label="Accruals Ratio"
          value={accrualsRatio} unit="x"
          flagLevel={accrualsLevel} flagLabel={accrualsFlag}
          interpretation="Measures the portion of earnings from non-cash accruals relative to total assets. High positive accruals (>10% of assets) indicate earnings may include significant estimates or deferrals. Pioneered by Sloan (1996), this ratio predicts future earnings reversals."
        />
        <MetricRow
          label="Beneish M-Score"
          value={mScore}
          flagLevel={mLevel} flagLabel={mFlag}
          interpretation={hasPrior
            ? "Beneish (1999) model uses 8 financial variables to detect earnings manipulation. M-Score > -1.78 is a red flag. Famous for identifying Enron and WorldCom before their collapse. Requires two years of data for full accuracy."
            : "Requires at least 2 years of financial history for the M-Score. Load a listed company via the search bar to auto-populate historical data."}
        />
        {!hasPrior && (
          <div className="px-3 py-2 mx-3 mb-2 rounded-lg"
            style={{ background: 'rgba(79,110,247,0.06)', border: '1px solid rgba(79,110,247,0.15)' }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#6b82a8' }}>
              💡 Search a listed company to load multi-year data and unlock the full Beneish M-Score calculation.
            </p>
          </div>
        )}
      </div>

      {/* M-Score variable breakdown (if available) */}
      {hasPrior && mScore !== null && (
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="mono text-[9px] font-bold uppercase tracking-[0.14em] mb-3" style={{ color: '#3d5070' }}>
            M-SCORE VARIABLE BREAKDOWN
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { key: 'dsri',  label: 'DSRI',  unit: 'x', note: 'Days Sales Receivables Index — rising means AR growing faster than revenue', threshold: 1.465, inverse: true },
              { key: 'gmi',   label: 'GMI',   unit: 'x', note: 'Gross Margin Index — >1 means margins are deteriorating (negative sign)', threshold: 1.193, inverse: true },
              { key: 'aqi',   label: 'AQI',   unit: 'x', note: 'Asset Quality Index — rising non-productive assets is a warning', threshold: 1.254, inverse: true },
              { key: 'sgi',   label: 'SGI',   unit: 'x', note: 'Sales Growth Index — very high growth sometimes linked to channel stuffing', threshold: 1.607, inverse: false },
              { key: 'depi',  label: 'DEPI',  unit: 'x', note: 'Depreciation Index — declining depreciation rates may mask asset deterioration', threshold: 1.083, inverse: true },
              { key: 'tata',  label: 'TATA',  unit: 'x', note: 'Total Accruals to Total Assets — higher means more accrual-based earnings', threshold: 0.018, inverse: true },
            ].map(({ key, label, unit, note, threshold, inverse }) => {
              const val = mVars[key];
              const isRisk = val !== null && (inverse ? val > threshold : val > threshold);
              return (
                <div key={key} className="rounded-xl p-3"
                  style={{
                    background: isRisk ? 'rgba(244,63,94,0.06)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isRisk ? 'rgba(244,63,94,0.2)' : 'rgba(255,255,255,0.07)'}`,
                  }}>
                  <div className="flex items-center justify-between mb-1">
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 700,
                      color: isRisk ? '#f43f5e' : '#6b82a8', letterSpacing: '0.1em' }}>{label}</span>
                    {isRisk && <span style={{ fontSize: 9 }}>⚠</span>}
                  </div>
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700,
                    color: isRisk ? '#f43f5e' : '#d4ddf5' }}>
                    {fmt(val, unit)}
                  </p>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, color: '#6b82a8', marginTop: 2, lineHeight: 1.4 }}>
                    {note}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CFA note */}
      <p className="mt-5 text-[10px]" style={{ color: '#3d5070', fontFamily: 'Inter, sans-serif' }}>
        <span style={{ color: '#f59e0b' }}>CFA L2 / Forensic Accounting ·</span> Earnings quality analysis
        distinguishes sustainable earnings (cash-backed, low accruals) from engineered earnings
        (accrual-heavy, aggressive recognition). Used by credit analysts and equity short-sellers.
      </p>
    </section>
  );
}
