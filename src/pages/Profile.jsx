import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function StatPill({ label, value, color = '#4f6ef7' }) {
  return (
    <div className="rounded-xl px-4 py-3 text-center"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="mono text-lg font-bold" style={{ color }}>{value}</p>
      <p className="mono text-[10px] uppercase tracking-widest mt-0.5" style={{ color: '#475569' }}>{label}</p>
    </div>
  );
}

export default function Profile() {
  const { user, signOut, getSearchHistory, loading } = useAuth();
  const [history, setHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    getSearchHistory().then(h => { setHistory(h); setHistLoading(false); });
  }, [user]);

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#030711' }}>
        <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const name     = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
  const initials = name.split(' ').map(w => w[0]?.toUpperCase()).join('').slice(0, 2);
  const joined   = new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen px-4 py-10"
      style={{ background: 'linear-gradient(135deg,#030711 0%,#060d1f 60%,#030711 100%)' }}>
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header card */}
        <div className="rounded-2xl p-6"
          style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(79,110,247,0.15)',
            backdropFilter: 'blur(16px)',
          }}>
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 font-bold text-lg"
              style={{ background: 'linear-gradient(135deg,#4f6ef7,#22d3ee)', color: '#fff' }}>
              {initials || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-lg truncate" style={{ color: '#f1f5f9' }}>{name}</h1>
              <p className="text-sm truncate" style={{ color: '#64748b' }}>{user.email}</p>
              <p className="mono text-[10px] mt-0.5" style={{ color: '#334155' }}>
                Member since {joined}
              </p>
            </div>
            <span className="mono text-[10px] px-2.5 py-1 rounded-lg flex-shrink-0"
              style={{ background: 'rgba(0,232,135,0.08)', color: '#00e887', border: '1px solid rgba(0,232,135,0.2)' }}>
              FREE PLAN
            </span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            <StatPill label="Analyses"  value={history.length}      color="#4f6ef7" />
            <StatPill label="Countries" value={[...new Set(history.map(h => h.ticker.includes('.') ? h.ticker.split('.').pop() : 'US'))].length} color="#22d3ee" />
            <StatPill label="AI Credits" value="7/day"               color="#00e887" />
          </div>
        </div>

        {/* Search history */}
        <div className="rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <h2 className="mono text-[11px] font-bold uppercase tracking-widest" style={{ color: '#22d3ee' }}>
                Recent Lookups
              </h2>
              <p className="text-[11px] mt-0.5" style={{ color: '#475569' }}>
                Last 20 companies you analysed
              </p>
            </div>
            <button onClick={() => navigate('/dashboard')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: 'rgba(79,110,247,0.12)', color: '#4f6ef7', border: '1px solid rgba(79,110,247,0.2)' }}>
              + New Analysis
            </button>
          </div>

          {histLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-3xl mb-3">📊</p>
              <p className="text-sm font-medium" style={{ color: '#475569' }}>No lookups yet</p>
              <p className="text-xs mt-1" style={{ color: '#334155' }}>
                Search for a company on the dashboard to see history here.
              </p>
            </div>
          ) : (
            <div>
              {history.map((h, i) => {
                const pct = Math.round((h.filled / h.total) * 100);
                const date = new Date(h.searched_at).toLocaleDateString('en-US', { month:'short', day:'numeric' });
                return (
                  <div key={h.ticker}
                    className="flex items-center gap-3 px-5 py-3 transition-colors cursor-pointer"
                    style={{ borderBottom: i < history.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => navigate('/dashboard')}>
                    {/* Ticker badge */}
                    <span className="mono text-[10px] font-bold px-2 py-1 rounded-lg flex-shrink-0"
                      style={{ background: 'rgba(34,211,238,0.07)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.15)', minWidth: 64, textAlign: 'center' }}>
                      {h.ticker}
                    </span>
                    {/* Name + sector */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate font-medium" style={{ color: '#cbd5e1' }}>{h.name}</p>
                      <p className="mono text-[10px] mt-0.5" style={{ color: '#475569' }}>
                        {h.sector || 'Unknown sector'} · {h.currency}
                      </p>
                    </div>
                    {/* Coverage pill */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        <p className="mono text-xs font-bold" style={{ color: pct >= 80 ? '#00e887' : '#fbbf24' }}>
                          {pct}%
                        </p>
                        <p className="mono text-[9px]" style={{ color: '#334155' }}>{h.filled}/{h.total} fields</p>
                      </div>
                    </div>
                    {/* Date */}
                    <span className="mono text-[10px] flex-shrink-0" style={{ color: '#334155' }}>{date}</span>
                    <span style={{ color: '#334155', fontSize: 11 }}>→</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Account actions */}
        <div className="rounded-2xl p-5"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="mono text-[11px] font-bold uppercase tracking-widest mb-4" style={{ color: '#64748b' }}>
            Account
          </h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2.5 px-3 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div>
                <p className="text-sm font-medium" style={{ color: '#cbd5e1' }}>Email</p>
                <p className="text-xs" style={{ color: '#475569' }}>{user.email}</p>
              </div>
              <span className="mono text-[10px] px-2 py-1 rounded"
                style={{ background: 'rgba(79,110,247,0.08)', color: '#4f6ef7' }}>
                {user.email_confirmed_at ? 'VERIFIED' : 'UNVERIFIED'}
              </span>
            </div>
            <button onClick={handleSignOut}
              className="w-full py-2.5 px-3 rounded-xl text-sm font-medium transition-all text-left"
              style={{ background: 'rgba(244,63,94,0.06)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.12)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(244,63,94,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(244,63,94,0.06)'}>
              Sign out
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
