import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const C = {
  bg: '#030712',
  surface: 'rgba(15,23,42,0.7)',
  surface2: 'rgba(30,41,59,0.42)',
  border: 'rgba(148,163,184,0.28)',
  text: '#f8fafc',
  muted: '#94a3b8',
  gold: '#f59e0b',
  blue: '#60a5fa',
  green: '#22c55e',
  red: '#f43f5e',
  purple: '#a78bfa',
};

const mono = "'Inter', system-ui, sans-serif";

const FEATURE_ROWS = [
  ['Health Score', '87 / 100', C.green],
  ['ROIC', '23.4%', C.blue],
  ['Debt/Equity', '0.82x', C.gold],
  ['Altman Z', '4.31', C.green],
];

const STATS = [
  ['23+', 'CFA-Level Ratios'],
  ['<10s', 'Ticker to Report'],
  ['4-5', 'AI Debate Rounds'],
];

function GridGlow() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const pan = interpolate(frame, [0, 1200], [0, -120], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          inset: -200,
          background:
            'radial-gradient(circle at 20% 20%, rgba(37,99,235,0.26), transparent 42%), radial-gradient(circle at 80% 75%, rgba(245,158,11,0.20), transparent 42%)',
          transform: `translateY(${pan}px)`,
        }}
      />
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0, opacity: 0.12 }}>
        {Array.from({ length: 18 }).map((_, i) => (
          <line
            key={`h-${i}`}
            x1="0"
            y1={i * 60}
            x2={width}
            y2={i * 60}
            stroke="rgba(148,163,184,0.25)"
            strokeWidth="1"
          />
        ))}
        {Array.from({ length: 32 }).map((_, i) => (
          <line
            key={`v-${i}`}
            x1={i * 60}
            y1="0"
            x2={i * 60}
            y2={height}
            stroke="rgba(148,163,184,0.20)"
            strokeWidth="1"
          />
        ))}
      </svg>
    </AbsoluteFill>
  );
}

function TitleBlock({ title, subtitle, from = 0, duration = 40 }) {
  const frame = useCurrentFrame() - from;
  const y = interpolate(frame, [0, duration], [28, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const opacity = interpolate(frame, [0, duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{ textAlign: 'center', transform: `translateY(${y}px)`, opacity }}>
      <h1
        style={{
          margin: 0,
          color: C.text,
          fontFamily: mono,
          fontSize: 76,
          letterSpacing: '-0.03em',
          fontWeight: 800,
        }}
      >
        {title}
      </h1>
      <p style={{ marginTop: 14, color: C.muted, fontFamily: mono, fontSize: 30, fontWeight: 500 }}>{subtitle}</p>
    </div>
  );
}

function UiCard({ from = 0 }) {
  const frame = useCurrentFrame() - from;
  const enter = spring({ frame, fps: 30, config: { damping: 18, stiffness: 110 } });
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const x = interpolate(enter, [0, 1], [160, 0]);

  return (
    <div
      style={{
        width: 620,
        borderRadius: 18,
        padding: 20,
        background: C.surface,
        border: `1px solid ${C.border}`,
        boxShadow: '0 20px 80px rgba(0,0,0,0.45)',
        transform: `translateX(${x}px)`,
        opacity,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ color: C.text, fontFamily: mono, fontSize: 27, fontWeight: 800 }}>RELIANCE.NS</div>
          <div style={{ color: C.muted, fontFamily: mono, fontSize: 16 }}>Reliance Industries · Energy</div>
        </div>
        <div
          style={{
            color: C.green,
            fontFamily: mono,
            fontWeight: 700,
            fontSize: 15,
            border: `1px solid ${C.green}`,
            borderRadius: 999,
            height: 34,
            padding: '8px 14px',
          }}
        >
          HEALTHY
        </div>
      </div>
      {FEATURE_ROWS.map(([k, v, color]) => (
        <div key={k} style={{ display: 'grid', gridTemplateColumns: '1fr 130px', marginBottom: 10, alignItems: 'center' }}>
          <div style={{ color: C.muted, fontFamily: mono, fontSize: 16 }}>{k}</div>
          <div style={{ color, fontFamily: mono, textAlign: 'right', fontSize: 18, fontWeight: 700 }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

function StatRail({ from = 0 }) {
  const frame = useCurrentFrame() - from;
  const opacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <div style={{ display: 'flex', gap: 16, opacity }}>
      {STATS.map(([num, label]) => (
        <div
          key={label}
          style={{
            width: 220,
            borderRadius: 14,
            background: C.surface2,
            border: `1px solid ${C.border}`,
            padding: 16,
          }}
        >
          <div style={{ color: C.gold, fontFamily: mono, fontSize: 34, fontWeight: 800 }}>{num}</div>
          <div style={{ color: C.text, fontFamily: mono, fontSize: 16 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

export function ValorevaPromoVideo() {
  return (
    <AbsoluteFill style={{ background: C.bg, justifyContent: 'center', alignItems: 'center', fontFamily: mono }}>
      <GridGlow />

      <Sequence from={0} durationInFrames={150}>
        <TitleBlock title="Valoreva" subtitle="From noise to conviction." from={0} duration={34} />
      </Sequence>

      <Sequence from={150} durationInFrames={300}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 24 }}>
          <TitleBlock title="Search. Score. Decide." subtitle="Institutional-grade analysis in seconds." from={150} duration={26} />
          <UiCard from={165} />
        </AbsoluteFill>
      </Sequence>

      <Sequence from={450} durationInFrames={270}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 26 }}>
          <TitleBlock title="AI Debate + Journal Verdict" subtitle="Bull vs Bear. Then act with clarity." from={450} duration={26} />
          <StatRail from={470} />
        </AbsoluteFill>
      </Sequence>

      <Sequence from={720} durationInFrames={390}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              borderRadius: 20,
              padding: '26px 34px',
              width: 900,
              background: C.surface,
              border: `1px solid ${C.border}`,
              boxShadow: '0 20px 70px rgba(0,0,0,0.45)',
            }}
          >
            <div style={{ color: C.text, fontFamily: mono, fontSize: 46, fontWeight: 800, marginBottom: 10 }}>
              Watchlist. Alerts. Exports.
            </div>
            <div style={{ color: C.muted, fontFamily: mono, fontSize: 24 }}>
              Keep your flow tight with live tracking, PDF/Excel output, and portfolio-ready insights.
            </div>
          </div>
        </AbsoluteFill>
      </Sequence>

      <Sequence from={1110} durationInFrames={540}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <TitleBlock title="Think Institutional." subtitle="Decide faster with Valoreva." from={1110} duration={40} />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
}

export const VALOREVA_PROMO_META = {
  fps: 30,
  durationInFrames: 1650, // 55 seconds
  compositionWidth: 1920,
  compositionHeight: 1080,
};
