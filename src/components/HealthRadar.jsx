import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, ResponsiveContainer } from 'recharts';

const SCORE_MAP = { green: 100, amber: 55, red: 15, na: 0 };
const avg = (keys, s) => Math.round(keys.map(k => SCORE_MAP[s[k] ?? 'na']).reduce((a,b)=>a+b,0) / keys.length);

const DIMS = {
  Liquidity:     ['currentRatio','quickRatio','cashRatio'],
  Profitability: ['grossMargin','operatingMargin','netMargin','roe','roa'],
  Efficiency:    ['assetTurnover','fixedAssetTurnover','receivablesDays','inventoryDays'],
  Leverage:      ['debtToEquity','interestCoverage'],
};

const Tip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { subject, score } = payload[0].payload;
  return (
    <div style={{ background: 'rgba(3,7,17,0.95)', border: '1px solid rgba(34,211,238,0.25)', borderRadius: 10, padding: '8px 12px' }}>
      <div style={{ color: '#94a3b8', fontSize: 10, fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{subject}</div>
      <div style={{ color: '#22d3ee', fontSize: 18, fontFamily: 'var(--font-sans)', fontWeight: 700 }}>{score}<span style={{ fontSize: 11, color: '#475569' }}>/100</span></div>
    </div>
  );
};

export default function HealthRadar({ statuses }) {
  const data = Object.entries(DIMS).map(([dim, keys]) => ({ subject: dim, score: avg(keys, statuses), fullMark: 100 }));
  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid gridType="polygon" stroke="rgba(34,211,238,0.08)" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 10, fontFamily: 'var(--font-sans)', fontWeight: 600 }} />
          <PolarRadiusAxis angle={90} domain={[0,100]} tick={false} axisLine={false} />
          <Radar dataKey="score" stroke="#22d3ee" strokeWidth={1.5} fill="#22d3ee" fillOpacity={0.1}
            dot={{ r: 3, fill: '#22d3ee', strokeWidth: 0, style: { filter: 'drop-shadow(0 0 4px #22d3ee)' } }} />
          <Tooltip content={<Tip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
