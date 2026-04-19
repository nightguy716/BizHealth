import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

function timeAgo(ts) {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const TYPE_COLOR = {
  watchlist_stale: '#f59e0b',
  journal_open:    'var(--accent)',
  general:         'var(--text-3)',
};

export default function NotificationBell() {
  const { isAuthenticated, getNotifications, markNotificationRead, markAllNotificationsRead } = useAuth();
  const [notifs, setNotifs]   = useState([]);
  const [open, setOpen]       = useState(false);
  const ref                   = useRef(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    const data = await getNotifications();
    setNotifs(data);
  }, [isAuthenticated, getNotifications]);

  useEffect(() => { load(); }, [load]);

  // Poll every 60 s
  useEffect(() => {
    if (!isAuthenticated) return;
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [isAuthenticated, load]);

  // Close on outside click
  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  if (!isAuthenticated) return null;

  const unread = notifs.filter(n => !n.read).length;

  async function handleRead(n) {
    if (n.read) return;
    await markNotificationRead(n.id);
    setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
  }

  async function handleReadAll() {
    await markAllNotificationsRead();
    setNotifs(prev => prev.map(x => ({ ...x, read: true })));
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Notifications"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0.3rem',
          position: 'relative',
          color: 'var(--text-2)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span style={{
            position: 'absolute',
            top: '0',
            right: '0',
            background: 'var(--red)',
            color: '#fff',
            fontSize: '0.6rem',
            fontWeight: 800,
            borderRadius: '999px',
            minWidth: '15px',
            height: '15px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            lineHeight: 1,
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 0.5rem)',
          right: 0,
          width: '320px',
          maxHeight: '400px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '0.75rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-1)' }}>
              Notifications {unread > 0 && <span style={{ color: 'var(--accent)' }}>({unread})</span>}
            </span>
            {unread > 0 && (
              <button onClick={handleReadAll} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}>
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifs.length === 0 ? (
              <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-4)', fontSize: '0.82rem' }}>
                No notifications yet.
              </p>
            ) : (
              notifs.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleRead(n)}
                  style={{
                    padding: '0.7rem 1rem',
                    borderBottom: '1px solid var(--border)',
                    background: n.read ? 'transparent' : 'rgba(96,165,250,0.05)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    {n.ticker && (
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: TYPE_COLOR[n.type] || 'var(--text-3)', fontFamily: 'monospace' }}>
                        {n.ticker}
                      </span>
                    )}
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-4)', marginLeft: 'auto' }}>{timeAgo(n.created_at)}</span>
                    {!n.read && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-2)', lineHeight: 1.45 }}>{n.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
