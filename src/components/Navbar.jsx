import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import NotificationBell from './NotificationBell';

const LINKS = [
  { to: '/',          label: 'Home'      },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/journal',   label: 'Journal'   },
  { to: '/watchlist', label: 'Watchlist' },
  { to: '/blog',      label: 'Blog'      },
  { to: '/pricing',   label: 'Pricing'   },
  { to: '/about',     label: 'About'     },
];

function UserMenu({ user, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const h = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const name     = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
  const initials = name.split(' ').map(w => w[0]?.toUpperCase()).join('').slice(0, 2) || '?';

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
        <div className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ background: '#141c2e', border: '1px solid #1d2840', color: '#7b8eab', fontFamily: "'JetBrains Mono', monospace" }}>
          {initials}
        </div>
        <span className="hidden md:block text-xs max-w-[90px] truncate" style={{ color: '#7b8eab' }}>
          {name}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 overflow-hidden z-50"
          style={{ background: '#0f1523', border: '1px solid #1d2840', borderRadius: 4, top: '100%' }}>
          <div className="px-3 py-2.5" style={{ borderBottom: '1px solid #1d2840' }}>
            <p className="text-xs font-medium truncate" style={{ color: '#e2e8f4' }}>{name}</p>
            <p className="text-[10px] truncate" style={{ color: '#4a5568' }}>{user.email}</p>
          </div>
          {[
            { label: 'My Profile', action: () => navigate('/profile') },
            { label: 'Dashboard',  action: () => navigate('/dashboard') },
          ].map(({ label, action }) => (
            <button key={label} onClick={() => { setOpen(false); action(); }}
              className="w-full text-left px-3 py-2.5 text-xs"
              style={{ color: '#7b8eab', background: 'none', border: 'none', cursor: 'pointer', display: 'block' }}
              onMouseEnter={e => e.currentTarget.style.background = '#141c2e'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {label}
            </button>
          ))}
          <div style={{ borderTop: '1px solid #1d2840' }}>
            <button onClick={() => { setOpen(false); onSignOut(); }}
              className="w-full text-left px-3 py-2.5 text-xs"
              style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', display: 'block' }}
              onMouseEnter={e => e.currentTarget.style.background = '#141c2e'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeToggle() {
  const { isDark, toggle } = useTheme();
  return (
    <button onClick={toggle} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex items-center justify-center flex-shrink-0"
      style={{
        width: 28, height: 28, borderRadius: 4,
        background: 'var(--surface)', border: '1px solid var(--border)',
        color: 'var(--text-3)', cursor: 'pointer',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hi)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}>
      {isDark ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  );
}

export default function Navbar() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const { user, loading, signOut } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: isDark ? '#0a0d14' : '#f4f6f9',
        borderBottom: '1px solid var(--border)',
        transition: 'background 0.2s, border-color 0.2s',
      }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#2461d4', flexShrink: 0 }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 14, color: 'var(--text-1)', letterSpacing: '0.02em' }}>
            BizHealth
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, padding: '2px 5px', borderRadius: 3, border: '1px solid #2461d4', color: '#2461d4', letterSpacing: '0.06em' }}>
            BETA
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center">
          {LINKS.map(({ to, label }) => {
            const active = pathname === to || (to !== '/' && pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                data-tour={to === '/watchlist' ? 'watchlist-link' : to === '/journal' ? 'journal-link' : undefined}
                className="px-3 text-xs font-medium transition-colors"
                style={{
                  height: 48,
                  display: 'flex', alignItems: 'center',
                  color: active ? 'var(--text-1)' : 'var(--text-2)',
                  borderBottom: active ? '2px solid #2461d4' : '2px solid transparent',
                }}>
                {label}
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          <NotificationBell />
          {loading ? (
            <div className="w-5 h-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin ml-1" />
          ) : user ? (
            <UserMenu user={user} onSignOut={handleSignOut} />
          ) : (
            <>
              <Link to="/auth"
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={{ color: 'var(--text-2)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-1)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-2)'}>
                Sign In
              </Link>
              <Link to="/auth"
                className="px-4 py-1.5 text-xs font-semibold"
                style={{ background: '#2461d4', color: '#fff', borderRadius: 4 }}>
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile */}
        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle />
          <NotificationBell />
          <button className="p-2" onClick={() => setOpen(o => !o)}
            style={{ color: 'var(--text-2)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              {open
                ? <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                : <path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              }
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden px-4 pb-4"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
          {LINKS.map(({ to, label }) => (
            <Link key={to} to={to}
              onClick={() => setOpen(false)}
              className="block px-3 py-2.5 text-sm transition-colors"
              style={{ color: pathname === to ? 'var(--text-1)' : 'var(--text-2)', borderLeft: pathname === to ? '2px solid #2461d4' : '2px solid transparent' }}>
              {label}
            </Link>
          ))}
          {user ? (
            <>
              <Link to="/profile" onClick={() => setOpen(false)}
                className="block px-3 py-2.5 text-sm" style={{ color: 'var(--text-2)' }}>
                My Profile
              </Link>
              <button onClick={() => { setOpen(false); handleSignOut(); }}
                className="block w-full text-left px-3 py-2.5 text-sm"
                style={{ color: '#dc2626' }}>
                Sign out
              </button>
            </>
          ) : !loading && (
            <Link to="/auth" onClick={() => setOpen(false)}
              className="block px-3 py-2.5 text-sm font-semibold text-center mt-2"
              style={{ background: '#2461d4', color: '#fff', borderRadius: 4 }}>
              Sign In / Get Started
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
