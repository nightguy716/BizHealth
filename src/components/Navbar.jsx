import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const LINKS = [
  { to: '/',          label: 'Home'      },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/pricing',   label: 'Pricing'   },
  { to: '/about',     label: 'About'     },
  { to: '/contact',   label: 'Contact'   },
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
        className="flex items-center gap-2 transition-opacity hover:opacity-80">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#4f6ef7,#22d3ee)', color: '#fff' }}>
          {initials}
        </div>
        <span className="hidden md:block text-xs font-medium max-w-[100px] truncate"
          style={{ color: '#cbd5e1' }}>
          {name}
        </span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ color: '#475569', flexShrink: 0 }}>
          <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 rounded-xl overflow-hidden z-50"
          style={{
            background: 'rgba(4,9,22,0.98)',
            border: '1px solid rgba(79,110,247,0.15)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            top: '100%',
          }}>
          <div className="px-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-xs font-medium truncate" style={{ color: '#cbd5e1' }}>{name}</p>
            <p className="text-[10px] truncate" style={{ color: '#475569' }}>{user.email}</p>
          </div>
          <button onClick={() => { setOpen(false); navigate('/profile'); }}
            className="w-full text-left px-3 py-2.5 text-xs transition-colors"
            style={{ color: '#94a3b8' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            My Profile
          </button>
          <button onClick={() => { setOpen(false); navigate('/dashboard'); }}
            className="w-full text-left px-3 py-2.5 text-xs transition-colors"
            style={{ color: '#94a3b8' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            Dashboard
          </button>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <button onClick={() => { setOpen(false); onSignOut(); }}
              className="w-full text-left px-3 py-2.5 text-xs transition-colors"
              style={{ color: '#f43f5e' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(244,63,94,0.06)'}
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
      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        color: 'var(--text-4)',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(79,110,247,0.4)'; e.currentTarget.style.color = 'var(--royal)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-4)'; }}>
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
        background: isDark ? 'rgba(2,7,20,0.92)' : 'rgba(240,244,255,0.92)',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        transition: 'background 0.25s, border-color 0.25s',
      }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#4f6ef7,#22d3ee)' }}>
            <span className="text-white font-black text-xs">B</span>
          </div>
          <span className="font-bold text-sm tracking-wide" style={{ color: 'var(--text-1)' }}>
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
                  color:      active ? 'var(--text-1)' : 'var(--text-4)',
                  background: active ? 'rgba(79,110,247,0.1)' : 'transparent',
                  borderBottom: active ? '1px solid rgba(79,110,247,0.4)' : '1px solid transparent',
                }}>
                {label}
              </Link>
            );
          })}
        </div>

        {/* Right side: theme toggle + auth */}
        <div className="hidden md:flex items-center gap-2">
          <ThemeToggle />
          {loading ? (
            <div className="w-5 h-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin ml-1" />
          ) : user ? (
            <UserMenu user={user} onSignOut={handleSignOut} />
          ) : (
            <>
              <Link to="/auth"
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ color: 'var(--text-4)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-1)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-4)'}>
                Sign In
              </Link>
              <Link to="/auth"
                className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: '#4f6ef7', color: '#fff' }}>
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile: theme toggle + hamburger */}
        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle />
        </div>
        <button className="md:hidden p-2 rounded-lg" onClick={() => setOpen(o => !o)}
          style={{ color: 'var(--text-4)' }}>
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
          style={{ borderTop: '1px solid var(--border)' }}>
          {LINKS.map(({ to, label }) => (
            <Link key={to} to={to}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm transition-all"
              style={{
                color:      pathname === to ? 'var(--text-1)' : 'var(--text-4)',
                background: pathname === to ? 'rgba(79,110,247,0.1)' : 'transparent',
              }}>
              {label}
            </Link>
          ))}
          {user ? (
            <>
              <Link to="/profile" onClick={() => setOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm transition-all"
                style={{ color: 'var(--text-3)' }}>
                My Profile
              </Link>
              <button onClick={() => { setOpen(false); handleSignOut(); }}
                className="block w-full text-left px-3 py-2 rounded-lg text-sm"
                style={{ color: '#f43f5e' }}>
                Sign out
              </button>
            </>
          ) : (
            <Link to="/auth" onClick={() => setOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-semibold text-center mt-2"
              style={{ background: '#4f6ef7', color: '#fff' }}>
              Sign In / Get Started
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
