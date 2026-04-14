import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const LINKS = [
  { to: '/',          label: 'Home'      },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/pricing',   label: 'Pricing'   },
  { to: '/about',     label: 'About'     },
  { to: '/contact',   label: 'Contact'   },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: 'rgba(3,7,17,0.92)',
        borderBottom: '1px solid rgba(79,110,247,0.12)',
        backdropFilter: 'blur(16px)',
      }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">

        {/* Logo / wordmark */}
        <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#4f6ef7,#22d3ee)' }}>
            <span className="text-white font-black text-xs">B</span>
          </div>
          <span className="font-bold text-sm tracking-wide" style={{ color: '#f1f5f9' }}>
            BizHealth
          </span>
          <span className="mono text-[9px] px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(79,110,247,0.15)', color: '#4f6ef7', border: '1px solid rgba(79,110,247,0.25)' }}>
            BETA
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {LINKS.map(({ to, label }) => {
            const active = pathname === to;
            return (
              <Link key={to} to={to}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  color:      active ? '#f1f5f9' : '#64748b',
                  background: active ? 'rgba(79,110,247,0.12)' : 'transparent',
                  borderBottom: active ? '1px solid rgba(79,110,247,0.4)' : '1px solid transparent',
                }}>
                {label}
              </Link>
            );
          })}
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link to="/dashboard"
            className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: '#4f6ef7', color: '#fff' }}>
            Launch App
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden p-2 rounded-lg" onClick={() => setOpen(o => !o)}
          style={{ color: '#64748b' }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            {open
              ? <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              : <path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            }
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden px-4 pb-4 space-y-1"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {LINKS.map(({ to, label }) => (
            <Link key={to} to={to}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm transition-all"
              style={{
                color:      pathname === to ? '#f1f5f9' : '#64748b',
                background: pathname === to ? 'rgba(79,110,247,0.1)' : 'transparent',
              }}>
              {label}
            </Link>
          ))}
          <Link to="/dashboard" onClick={() => setOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm font-semibold text-center mt-2"
            style={{ background: '#4f6ef7', color: '#fff' }}>
            Launch App
          </Link>
        </div>
      )}
    </nav>
  );
}
