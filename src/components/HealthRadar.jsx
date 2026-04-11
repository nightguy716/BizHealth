/**
 * HealthRadar.jsx
 *
 * A radar/spider chart showing the 4 financial health dimensions:
 * Liquidity, Profitability, Efficiency, Leverage.
 *
 * Each dimension's score (0–100) is computed from the green/amber/red
 * status of ratios in that category:
 *   green = 100pts, amber = 55pts, red = 15pts, na = 0pts
 *
 * The chart uses recharts RadarChart with custom dark styling.
 */

import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Tooltip, ResponsiveContainer
} from 'recharts';

const SCORE_MAP = { green: 100, amber: 55, red: 15, na: 0 };

function avg(keys, statuses) {
  const vals = keys.map(k => SCORE_MAP[statuses[k] ?? 'na']);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

const DIMENSION_KEYS = {
  Liquidity:     ['currentRatio', 'quickRatio', 'cashRatio'],
  Profitability: ['grossMargin', 'operatingMargin', 'netMargin', 'roe', 'roa'],
  Efficiency:    ['assetTurnover', 'fixedAssetTurnover', 'receivablesDays', 'inventoryDays'],
  Leverage:      ['debtToEquity', 'interestCoverage'],
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const { subject, value } = payload[0].payload;
    return (
      <div className="glass-card rounded-xl px-3 py-2 text-xs border-white/[0.1]">
        <div className="text-slate-300 font-semibold">{subject}</div>
        <div className="text-orange-400 font-bold text-sm">{value}/100</div>
      </div>
    );
  }
  return null;
};

export default function HealthRadar({ statuses }) {
  const data = Object.entries(DIMENSION_KEYS).map(([dim, keys]) => ({
    subject: dim,
    score:   avg(keys, statuses),
    fullMark: 100,
  }));

  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <RadarChart cx="50%" cy="50%" outerRadius="72%" data={data}>
          <PolarGrid
            gridType="polygon"
            stroke="rgba(255,255,255,0.07)"
          />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={false}
            axisLine={false}
          />
          <Radar
            name="Health"
            dataKey="score"
            stroke="#f97316"
            strokeWidth={2}
            fill="#f97316"
            fillOpacity={0.15}
            dot={{ r: 4, fill: '#f97316', strokeWidth: 0 }}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
