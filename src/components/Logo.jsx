export default function Logo({ size = 38 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#4f6ef7" />
          <stop offset="100%" stopColor="#3d5af1" />
        </linearGradient>
        <linearGradient id="ecgGrad" x1="0" y1="0" x2="40" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#22d3ee" stopOpacity="0.3" />
          <stop offset="45%"  stopColor="#22d3ee" stopOpacity="1"   />
          <stop offset="70%"  stopColor="#a5b4fc" stopOpacity="1"   />
          <stop offset="100%" stopColor="#4f6ef7" stopOpacity="0.3" />
        </linearGradient>
        <filter id="ecgGlow">
          <feGaussianBlur stdDeviation="1.2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="dotGlow">
          <feGaussianBlur stdDeviation="1" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      <rect width="40" height="40" rx="10" fill="url(#logoGrad)" opacity="0.95"/>
      <rect width="40" height="40" rx="10" fill="url(#ecgGrad)" opacity="0.1"/>

      <line x1="0" y1="20" x2="40" y2="20" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5"/>
      <line x1="20" y1="0" x2="20" y2="40" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5"/>

      <polyline
        points="2,20 8,20 11,10 14,30 17,20 21,20 24,12 27,20 38,20"
        stroke="url(#ecgGrad)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        filter="url(#ecgGlow)"
      >
        <animate attributeName="stroke-dasharray" values="0 70;70 0;70 0" keyTimes="0;0.6;1" dur="2.2s" repeatCount="indefinite" calcMode="ease-in-out"/>
        <animate attributeName="opacity" values="0.7;1;0.7" dur="2.2s" repeatCount="indefinite"/>
      </polyline>

      <circle cx="35" cy="8" r="2.5" fill="#00e887" filter="url(#dotGlow)">
        <animate attributeName="opacity" values="1;0.25;1" dur="1.6s" repeatCount="indefinite"/>
        <animate attributeName="r" values="2.5;1.8;2.5" dur="1.6s" repeatCount="indefinite"/>
      </circle>
    </svg>
  );
}
