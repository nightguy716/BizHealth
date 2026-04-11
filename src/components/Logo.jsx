/**
 * Logo.jsx — Animated ECG/heartbeat SVG logo.
 * The pulse line animates continuously to suggest "live" financial health monitoring.
 */
export default function Logo({ size = 38 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
        <linearGradient id="pulseGrad" x1="0" y1="0" x2="40" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="50%"  stopColor="#ffffff" stopOpacity="1"   />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.2" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Background rounded square */}
      <rect width="40" height="40" rx="10" fill="url(#logoGrad)" />

      {/* ECG / heartbeat line */}
      <polyline
        points="3,20 9,20 12,11 15,29 18,20 22,20 25,13 28,20 37,20"
        stroke="url(#pulseGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        filter="url(#glow)"
      >
        <animate
          attributeName="stroke-dasharray"
          from="0, 60"
          to="60, 0"
          dur="1.8s"
          repeatCount="indefinite"
          calcMode="ease-in-out"
        />
      </polyline>

      {/* Live indicator dot */}
      <circle cx="35" cy="10" r="3" fill="#4ade80">
        <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
