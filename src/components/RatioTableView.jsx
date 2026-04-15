const STATUS = {
  green: { label: 'Healthy',         color: '#00e887', bg: 'rgba(0,232,135,0.1)',  border: 'rgba(0,232,135,0.28)'  },
  amber: { label: 'Borderline',      color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.28)' },
  red:   { label: 'Needs Attention', color: '#f43f5e', bg: 'rgba(244,63,94,0.1)',  border: 'rgba(244,63,94,0.28)'  },
  na:    { label: 'No Data',         color: '#3d5070', bg: 'rgba(255,255,255,0.04)',border: 'rgba(255,255,255,0.08)'},
};

const CATEGORY_COLOR = {
  Liquidity:     '#22d3ee',
  Profitability: '#00e887',
  Efficiency:    '#a78bfa',
  Leverage:      '#fbbf24',
};

function formatVal(value, unit) {
  if (value === null || value === undefined || isNaN(Number(value))) return '—';
  const n = Number(value);
  if (unit === ' days')  return `${Math.round(n)}d`;
  if (unit === '%')      return `${n.toFixed(1)}%`;
  if (unit === 'x')      return `${n.toFixed(2)}×`;
  return n.toFixed(2);
}

export default function RatioTableView({ groups }) {
  // groups: [{ title, ratios: [{ name, value, unit, status, barWidth, key }] }]
  return (
    <div className="ghost-card rounded-2xl overflow-hidden animate-in">
      {/* Sticky header */}
      <div className="grid gap-0" style={{
        display: 'grid',
        gridTemplateColumns: '1fr 120px 90px 90px 100px',
        padding: '8px 16px',
        background: 'rgba(79,110,247,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.12em',
        color: '#3d5070',
      }}>
        <span>METRIC</span>
        <span>CATEGORY</span>
        <span style={{ textAlign: 'right' }}>VALUE</span>
        <span style={{ textAlign: 'center' }}>STATUS</span>
        <span style={{ paddingLeft: 8 }}>HEALTH BAR</span>
      </div>

      {/* Rows */}
      {groups.map(({ title, ratios }) =>
        ratios.map((r, i) => {
          const s = STATUS[r.status] || STATUS.na;
          const catColor = CATEGORY_COLOR[title] || '#6b82a8';
          const isLast = i === ratios.length - 1;
          const formatted = formatVal(r.value, r.unit);

          return (
            <div key={r.key}
              className="grid transition-colors duration-150"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 120px 90px 90px 100px',
                padding: '9px 16px',
                alignItems: 'center',
                borderBottom: isLast
                  ? '2px solid rgba(255,255,255,0.06)'
                  : '1px solid rgba(255,255,255,0.04)',
                cursor: 'default',
              }}
              onMouseEnter={e  => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Metric name */}
              <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12, color: '#d4ddf5' }}>
                {r.name}
              </span>

              {/* Category tag */}
              <span style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 8, fontWeight: 700,
                letterSpacing: '0.1em', color: catColor,
                background: `${catColor}14`, border: `1px solid ${catColor}30`,
                borderRadius: 4, padding: '2px 6px', width: 'fit-content',
              }}>
                {title.toUpperCase()}
              </span>

              {/* Value */}
              <span style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700,
                color: s.color, textAlign: 'right',
                textShadow: r.status !== 'na' ? `0 0 16px ${s.color}60` : 'none',
              }}>
                {formatted}
              </span>

              {/* Status badge */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 8, fontWeight: 700,
                  letterSpacing: '0.06em', padding: '2px 7px', borderRadius: 999,
                  background: s.bg, border: `1px solid ${s.border}`, color: s.color,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%', background: s.color, flexShrink: 0,
                    boxShadow: r.status !== 'na' ? `0 0 4px ${s.color}` : 'none',
                  }} />
                  {s.label === 'Needs Attention' ? 'CRITICAL' : s.label.toUpperCase()}
                </span>
              </div>

              {/* Health bar */}
              <div style={{ paddingLeft: 8 }}>
                <div style={{ height: 3, borderRadius: 9999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 9999,
                    width: `${r.barWidth || 0}%`,
                    background: r.status === 'green' ? 'linear-gradient(90deg,#00c874,#00e887)'
                               : r.status === 'amber' ? 'linear-gradient(90deg,#e5a800,#fbbf24)'
                               : r.status === 'red'   ? 'linear-gradient(90deg,#d9254a,#f43f5e)'
                               : 'rgba(255,255,255,0.12)',
                    boxShadow: r.status !== 'na' ? `0 0 6px ${s.color}80` : 'none',
                    transition: 'width 1.2s cubic-bezier(0.16,1,0.3,1)',
                  }} />
                </div>
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: '#3d5070', marginTop: 2,
                }}>
                  {r.barWidth > 0 ? `${r.barWidth}%` : '—'}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
