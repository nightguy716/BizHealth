import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

function Field({ label, type, value, onChange, placeholder, autoComplete }) {
  return (
    <div>
      <label className="block mono text-[10px] font-semibold uppercase tracking-widest mb-1.5"
        style={{ color: 'var(--text-4)' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all"
        style={{
          background: 'var(--surface)',
          border: '1px solid rgba(79,110,247,0.2)',
          color: 'var(--text-1)',
          fontFamily: 'Inter, sans-serif',
        }}
        onFocus={e  => { e.target.style.borderColor = 'rgba(79,110,247,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(79,110,247,0.08)'; }}
        onBlur={e   => { e.target.style.borderColor = 'rgba(79,110,247,0.2)'; e.target.style.boxShadow = 'none'; }}
      />
    </div>
  );
}

export default function Auth() {
  const [mode,     setMode]     = useState('login'); // 'login' | 'signup' | 'forgot'
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [name,     setName]     = useState('');
  const [err,      setErr]      = useState('');
  const [info,     setInfo]     = useState('');
  const [busy,     setBusy]     = useState(false);

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const reset = () => { setErr(''); setInfo(''); };

  async function handleSubmit(e) {
    e.preventDefault();
    reset();
    setBusy(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
        navigate('/dashboard');
      } else if (mode === 'signup') {
        if (password !== confirm) throw new Error('Passwords do not match.');
        if (password.length < 6)  throw new Error('Password must be at least 6 characters.');
        await signUp(email, password, name);
        setInfo('Account created! Check your email to confirm, then sign in.');
        setMode('login');
      } else if (mode === 'forgot') {
        if (!supabase) throw new Error('Auth not configured.');
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        setInfo('Password reset email sent — check your inbox.');
      }
    } catch (e) {
      setErr(e.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const titles = {
    login:  { h: 'Welcome back',    sub: 'Sign in to your account' },
    signup: { h: 'Create account',  sub: 'Start your free analysis' },
    forgot: { h: 'Reset password',  sub: 'We\'ll email you a link' },
  };
  const { h, sub } = titles[mode];

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg,#030711 0%,#060d1f 50%,#030711 100%)' }}>

      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div style={{ position:'absolute', top:'20%', left:'50%', transform:'translateX(-50%)',
          width:600, height:600, borderRadius:'50%',
          background:'radial-gradient(circle,rgba(79,110,247,0.06) 0%,transparent 70%)' }} />
      </div>

      <div className="w-full max-w-md relative">

        {/* Card */}
        <div className="rounded-2xl p-8"
          style={{
            background: 'var(--surface)',
            border: '1px solid rgba(79,110,247,0.15)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          }}>

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#4f6ef7,#22d3ee)' }}>
              <span className="text-white font-black text-sm">B</span>
            </div>
            <span className="font-bold text-sm" style={{ color: 'var(--text-1)' }}>Valoreva</span>
          </Link>

          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-1)' }}>{h}</h1>
            <p className="text-sm" style={{ color: 'var(--text-4)' }}>{sub}</p>
          </div>

          {/* Feedback messages */}
          {err && (
            <div className="mb-4 px-3.5 py-2.5 rounded-xl text-xs"
              style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', color: '#f43f5e' }}>
              {err}
            </div>
          )}
          {info && (
            <div className="mb-4 px-3.5 py-2.5 rounded-xl text-xs"
              style={{ background: 'rgba(0,232,135,0.07)', border: '1px solid rgba(0,232,135,0.2)', color: '#00e887' }}>
              {info}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <Field label="Full Name" type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Jane Smith" autoComplete="name" />
            )}
            <Field label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" autoComplete="email" />
            {mode !== 'forgot' && (
              <Field label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
            )}
            {mode === 'signup' && (
              <Field label="Confirm Password" type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••" autoComplete="new-password" />
            )}

            <button type="submit" disabled={busy}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all mt-2"
              style={{
                background: busy ? 'rgba(79,110,247,0.5)' : 'linear-gradient(135deg,#4f6ef7,#3b5ce4)',
                color: '#fff',
                boxShadow: busy ? 'none' : '0 4px 16px rgba(79,110,247,0.3)',
                cursor: busy ? 'not-allowed' : 'pointer',
              }}>
              {busy
                ? 'Please wait…'
                : mode === 'login'  ? 'Sign In'
                : mode === 'signup' ? 'Create Account'
                : 'Send Reset Email'}
            </button>
          </form>

          {/* Mode switchers */}
          <div className="mt-5 space-y-2 text-center">
            {mode === 'login' && (
              <>
                <p className="text-xs" style={{ color: 'var(--text-4)' }}>
                  <button onClick={() => { setMode('forgot'); reset(); }}
                    className="transition-colors hover:text-blue-400" style={{ color: 'var(--gold)' }}>
                    Forgot password?
                  </button>
                </p>
                <p className="text-xs" style={{ color: 'var(--text-4)' }}>
                  No account?{' '}
                  <button onClick={() => { setMode('signup'); reset(); }}
                    className="font-semibold transition-colors" style={{ color: 'var(--gold)' }}>
                    Create one free
                  </button>
                </p>
              </>
            )}
            {mode === 'signup' && (
              <p className="text-xs" style={{ color: 'var(--text-4)' }}>
                Already have an account?{' '}
                <button onClick={() => { setMode('login'); reset(); }}
                  className="font-semibold transition-colors" style={{ color: 'var(--gold)' }}>
                  Sign in
                </button>
              </p>
            )}
            {mode === 'forgot' && (
              <p className="text-xs" style={{ color: 'var(--text-4)' }}>
                <button onClick={() => { setMode('login'); reset(); }}
                  className="transition-colors" style={{ color: 'var(--gold)' }}>
                  ← Back to sign in
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center mt-4 text-[11px]" style={{ color: '#334155' }}>
          Free tier · No credit card required
        </p>
      </div>
    </div>
  );
}
