import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const C = {
  bg:      'var(--surface)',
  surface: 'var(--surface)',
  border:  'var(--border)',
  text:    'var(--text-1)',
  text2:   'var(--text-3)',
  muted:   'var(--text-4)',
  blue:    'var(--gold)',
  red:     '#dc2626',
  purple:  '#7c3aed',
};
const mono = 'var(--font-sans)';
const sans = "'Inter', system-ui, sans-serif";

/* Left border color per notification type */
const TYPE_BORDER = {
  price_alert:     C.red,
  news:            C.blue,
  debate:          C.purple,
  watchlist_stale: '#b45309',
  journal_open:    C.blue,
  general:         C.muted,
};

function timeAgo(ts) {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationBell() {
  const { isAuthenticated, getNotifications, markNotificationRead, markAllNotificationsRead, deleteReadNotifications, clearAllNotifications } = useAuth();
  const [notifs, setNotifs] = useState([]);
  const [open,   setOpen]   = useState(false);
  const ref = useRef(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    const data = await getNotifications();
    setNotifs(data || []);
  }, [isAuthenticated, getNotifications]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [isAuthenticated, load]);

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

  async function handleDeleteRead() {
    await deleteReadNotifications?.();
    setNotifs(prev => prev.filter(x => !x.read));
  }

  async function handleClearAll() {
    await clearAllNotifications?.();
    setNotifs([]);
  }

  const hasRead = notifs.some(n => n.read);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Notifications"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, position: 'relative', color: C.text2, display: 'flex', alignItems: 'center' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0,
            background: C.red, color: '#fff',
            fontFamily: mono, fontSize: 9, fontWeight: 700,
            borderRadius: '50%', minWidth: 14, height: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 2px', lineHeight: 1,
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 320, maxHeight: 420,
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 4, zIndex: 999,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          fontFamily: sans,
        }}>
          {/* Header */}
          <div style={{
            padding: '10px 14px', borderBottom: `1px solid ${C.border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: C.bg,
          }}>
            <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: C.text2, letterSpacing: '0.07em' }}>
              NOTIFICATIONS{unread > 0 && <span style={{ color: C.red, marginLeft: 6 }}>{unread}</span>}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {unread > 0 && (
                <button onClick={handleReadAll} style={{
                  background: 'none', border: 'none', fontFamily: sans,
                  color: C.blue, fontSize: 11, cursor: 'pointer', fontWeight: 500,
                }}>
                  Mark all read
                </button>
              )}
              {hasRead && (
                <button onClick={handleDeleteRead} style={{
                  background: 'none', border: 'none', fontFamily: sans,
                  color: C.text2, fontSize: 11, cursor: 'pointer', fontWeight: 500,
                }}>
                  Remove read
                </button>
              )}
              {notifs.length > 0 && (
                <button onClick={handleClearAll} style={{
                  background: 'none', border: 'none', fontFamily: sans,
                  color: C.red, fontSize: 11, cursor: 'pointer', fontWeight: 500,
                }}>
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifs.length === 0 ? (
              <p style={{ padding: '2rem', textAlign: 'center', fontFamily: mono, fontSize: 11, color: C.muted }}>
                No notifications
              </p>
            ) : (
              notifs.map(n => {
                const borderColor = TYPE_BORDER[n.type] || C.muted;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleRead(n)}
                    style={{
                      padding: '9px 14px 9px 12px',
                      borderBottom: `1px solid ${C.border}`,
                      borderLeft: `3px solid ${borderColor}`,
                      background: n.read ? 'transparent' : 'var(--surface)',
                      cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', gap: 3,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hi)'}
                    onMouseLeave={e => e.currentTarget.style.background = n.read ? 'transparent' : 'var(--surface)'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: C.text }}>
                        {n.title || n.ticker || 'Alert'}
                      </span>
                      <span style={{ fontFamily: mono, fontSize: 10, color: C.muted, whiteSpace: 'nowrap' }}>
                        {timeAgo(n.created_at)}
                      </span>
                    </div>
                    {n.message && (
                      <p style={{ margin: 0, fontSize: 11, color: C.text2, lineHeight: 1.45 }}>{n.message}</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
