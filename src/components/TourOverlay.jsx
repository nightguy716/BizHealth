/**
 * TourOverlay — 6-step flat onboarding tour.
 * No animations, no shadows. Just a dark backdrop + a flat tooltip.
 * Shows only if localStorage.getItem('bh_tour') is not set.
 */
import { useState, useEffect } from 'react';

const TOUR_KEY = 'bh_tour';

const STEPS = [
  {
    target: '[data-tour="sidebar"]',
    title:  'Enter Your Financials',
    body:   'Search for a company by ticker or name, or type in your own numbers — revenue, EBITDA, assets, and more.',
  },
  {
    target: '[data-tour="calculate"]',
    title:  'Run the Analysis',
    body:   'Hit Analyse to compute 14 financial ratios, a health score, and sector comparison in seconds.',
  },
  {
    target: '[data-tour="health-score"]',
    title:  'Read the Health Score',
    body:   'The overall score (0–100) and color-coded ratio cards show you exactly where the business stands.',
  },
  {
    target: '[data-tour="search"]',
    title:  'Search Any Stock',
    body:   'Look up 1,800+ NSE-listed companies. Autocomplete fills in sector and currency automatically.',
  },
  {
    target: '[data-tour="watchlist-link"]',
    title:  'Track Companies',
    body:   'Add companies to your Watchlist. Live prices and news update every 60 seconds.',
  },
  {
    target: '[data-tour="journal-link"]',
    title:  'Log Your Trades',
    body:   'Use the Trading Journal to record entries, document your thesis, and run the AI debate on any position.',
  },
];

const C = {
  surface: '#0f1523',
  border:  '#243354',
  text:    '#e2e8f4',
  text2:   '#7b8eab',
  muted:   '#4a5568',
  blue:    '#2461d4',
};
const mono = "'JetBrains Mono', monospace";
const sans = "'Inter', system-ui, sans-serif";

function getRect(selector) {
  try {
    const el = document.querySelector(selector);
    if (!el) return null;
    return el.getBoundingClientRect();
  } catch {
    return null;
  }
}

export default function TourOverlay({ onDone }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);

  // Recalculate target position whenever step changes
  useEffect(() => {
    const r = getRect(STEPS[step].target);
    setRect(r);
  }, [step]);

  function finish() {
    localStorage.setItem(TOUR_KEY, '1');
    onDone?.();
  }

  function next() {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else finish();
  }

  const current = STEPS[step];
  const TOOLTIP_W = 300;
  const TOOLTIP_H = 140; // approximate
  const PAD = 14;

  // Position tooltip near the target element, staying on screen
  let tooltipStyle = {
    position: 'fixed',
    width: TOOLTIP_W,
    fontFamily: sans,
  };

  if (rect) {
    // Try to place below
    let top  = rect.bottom + PAD;
    let left = Math.max(PAD, Math.min(rect.left, window.innerWidth - TOOLTIP_W - PAD));
    // If it would go off bottom, place above
    if (top + TOOLTIP_H > window.innerHeight - PAD) {
      top = Math.max(PAD, rect.top - TOOLTIP_H - PAD);
    }
    tooltipStyle = { ...tooltipStyle, top, left };
  } else {
    // Center of screen as fallback
    tooltipStyle = {
      ...tooltipStyle,
      top:  '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  return (
    <>
      {/* Dark backdrop — semi-transparent */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: 'rgba(10,13,20,0.7)',
          pointerEvents: 'none',
        }}
      />

      {/* Cutout highlight around target (simulated) */}
      {rect && (
        <div style={{
          position: 'fixed',
          top:    rect.top  - 4,
          left:   rect.left - 4,
          width:  rect.width  + 8,
          height: rect.height + 8,
          border: `2px solid ${C.blue}`,
          borderRadius: 4,
          zIndex: 9001,
          pointerEvents: 'none',
        }} />
      )}

      {/* Tooltip */}
      <div style={{
        ...tooltipStyle,
        zIndex: 9002,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 4,
        padding: '14px 16px',
      }}>
        {/* Step counter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontFamily: mono, fontSize: 10, color: C.muted, letterSpacing: '0.08em' }}>
            {step + 1} / {STEPS.length}
          </span>
          <button
            onClick={finish}
            style={{ background: 'none', border: 'none', color: C.muted, fontSize: 11, fontFamily: sans, cursor: 'pointer' }}
          >Skip</button>
        </div>

        <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6, letterSpacing: '0.03em' }}>
          {current.title}
        </div>
        <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.55, marginBottom: 14 }}>
          {current.body}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Step dots */}
          <div style={{ display: 'flex', gap: 5 }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{
                width: 5, height: 5, borderRadius: '50%',
                background: i === step ? C.blue : C.muted,
              }} />
            ))}
          </div>

          <button
            onClick={next}
            style={{
              fontFamily: sans, fontSize: 12, fontWeight: 500, color: '#fff',
              background: C.blue, border: 'none', borderRadius: 4,
              padding: '6px 16px', cursor: 'pointer',
            }}
          >
            {step < STEPS.length - 1 ? 'Next →' : 'Done'}
          </button>
        </div>
      </div>
    </>
  );
}

/** Convenience hook — returns true if the tour should be shown. */
export function useShouldShowTour() {
  return !localStorage.getItem(TOUR_KEY);
}
