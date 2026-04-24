const GOLD = '#D4AF37';
const GOLD_LIGHT = '#F2C94C';
const INK = '#111827';

// Interlocking rounded segments inspired by modern AI logos,
// with an upward candlestick line to keep a finance identity.
export function FinAxisMark({ size = 28, color = INK, strokeWidth = 2.2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M24 6c5.5 0 10 4.5 10 10v3h-8v-3a2 2 0 0 0-4 0v8h-8v-8c0-5.5 4.5-10 10-10Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 24c0-5.5 4.5-10 10-10h2v8h-2a2 2 0 0 0 0 4h8v8h-8c-5.5 0-10-4.5-10-10Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M24 42c-5.5 0-10-4.5-10-10v-3h8v3a2 2 0 0 0 4 0v-8h8v8c0 5.5-4.5 10-10 10Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M38 24c0 5.5-4.5 10-10 10h-2v-8h2a2 2 0 0 0 0-4h-8v-8h8c5.5 0 10 4.5 10 10Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M15 31l5-7 5 4 8-10" stroke={GOLD_LIGHT} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="33" cy="18" r="1.8" fill={GOLD_LIGHT}/>
    </svg>
  );
}

export function FinAxisWordmark({
  size = 18,
  weight = 700,
  letterSpacing = '-0.025em',
  finColor = INK,
  axisColor = GOLD,
}) {
  return (
    <span
      style={{
        fontFamily: "var(--font-sans)",
        fontWeight: weight,
        fontSize: size,
        letterSpacing,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'baseline',
      }}
    >
      <span style={{ color: finColor }}>Valo</span>
      <span style={{ color: axisColor }}>reva</span>
    </span>
  );
}

export function FinAxisLockup({
  size = 18,
  gap = 8,
  markSize,
  finColor,
  axisColor,
  markColor,
}) {
  const resolvedMarkSize = markSize ?? Math.round(size * 1.5);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap }}>
      <FinAxisMark size={resolvedMarkSize} color={markColor ?? axisColor ?? GOLD_LIGHT} />
      <FinAxisWordmark size={size} finColor={finColor} axisColor={axisColor} />
    </span>
  );
}

export default FinAxisLockup;
