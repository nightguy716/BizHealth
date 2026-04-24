import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!supabase) { setUser(null); return; }

    // Hydrate from existing session
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      if (data.session?.user) fetchProfile(data.session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(uid) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single();
    setProfile(data ?? null);
  }

  async function signUp(email, password, fullName) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    return data;
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function saveSearch(ticker, name, sector, currency, filled, total) {
    if (!user || !supabase) return;
    await supabase.from('search_history').upsert({
      user_id:    user.id,
      ticker:     ticker.toUpperCase(),
      name,
      sector:     sector || '',
      currency:   currency || 'USD',
      filled,
      total,
      searched_at: new Date().toISOString(),
    }, { onConflict: 'user_id,ticker' });
  }

  async function getSearchHistory() {
    if (!user || !supabase) return [];
    const { data } = await supabase
      .from('search_history')
      .select('*')
      .eq('user_id', user.id)
      .order('searched_at', { ascending: false })
      .limit(20);
    return data ?? [];
  }

  // ── Watchlist ──────────────────────────────────────────────────────────────

  async function getWatchlist() {
    if (!user || !supabase) return [];
    const { data } = await supabase
      .from('user_watchlist')
      .select('*')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false });
    return data ?? [];
  }

  async function addToWatchlist({ ticker, company_name, sector, currency, target_price, notes }) {
    if (!user || !supabase) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('user_watchlist')
      .upsert({
        user_id: user.id,
        ticker: ticker.toUpperCase(),
        company_name,
        sector,
        currency,
        target_price,
        notes,
      }, { onConflict: 'user_id,ticker' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function removeFromWatchlist(ticker) {
    if (!user || !supabase) return;
    await supabase
      .from('user_watchlist')
      .delete()
      .eq('user_id', user.id)
      .eq('ticker', ticker.toUpperCase());
  }

  async function isOnWatchlist(ticker) {
    if (!user || !supabase) return false;
    const { data } = await supabase
      .from('user_watchlist')
      .select('id')
      .eq('user_id', user.id)
      .eq('ticker', ticker.toUpperCase())
      .single();
    return !!data;
  }

  // ── Journal ────────────────────────────────────────────────────────────────

  async function getJournalEntries() {
    if (!user || !supabase) return [];
    const { data } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('entry_date', { ascending: false });
    return data ?? [];
  }

  async function addJournalEntry(entry) {
    if (!user || !supabase) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('journal_entries')
      .insert({ ...entry, user_id: user.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function updateJournalEntry(id, updates) {
    if (!user || !supabase) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('journal_entries')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function deleteJournalEntry(id) {
    if (!user || !supabase) return;
    await supabase
      .from('journal_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
  }

  // ── Notifications ──────────────────────────────────────────────────────────

  async function getNotifications() {
    if (!user || !supabase) return [];
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    return data ?? [];
  }

  async function markNotificationRead(id) {
    if (!user || !supabase) return;
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', user.id);
  }

  async function markAllNotificationsRead() {
    if (!user || !supabase) return;
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);
  }

  async function deleteReadNotifications() {
    if (!user || !supabase) return;
    await supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.id)
      .eq('read', true);
  }

  async function clearAllNotifications() {
    if (!user || !supabase) return;
    await supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.id);
  }

  async function createNotification({ type, ticker, title, message }) {
    if (!user || !supabase) return;
    await supabase.from('notifications').insert({
      user_id: user.id,
      type,
      ticker: ticker || null,
      title: title || null,
      message,
    });
  }

  const loading = user === undefined;

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signUp, signIn, signOut,
      saveSearch, getSearchHistory,
      getWatchlist, addToWatchlist, removeFromWatchlist, isOnWatchlist,
      getJournalEntries, addJournalEntry, updateJournalEntry, deleteJournalEntry,
      getNotifications, markNotificationRead, markAllNotificationsRead, deleteReadNotifications, clearAllNotifications, createNotification,
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
