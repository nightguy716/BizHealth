import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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

export default function Navbar() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: 'rgba(3,7,17,0.92)',
        borderBottom: '1px solid rgba(79,110,247,0.12)',
        backdropFilter: 'blur(16px)',
      }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">

        {/* Logo */}
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

        {/* Right side: auth state */}
        <div className="hidden md:flex items-center gap-3">
          {loading ? (
            <div className="w-5 h-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          ) : user ? (
            <UserMenu user={user} onSignOut={handleSignOut} />
          ) : (
            <>
              <Link to="/auth"
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ color: '#94a3b8' }}
                onMouseEnter={e => e.currentTarget.style.color = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>
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
          {user ? (
            <>
              <Link to="/profile" onClick={() => setOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm transition-all"
                style={{ color: '#94a3b8' }}>
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
