import { useState } from 'react';
import { Link } from 'react-router-dom';

const INQUIRY_TYPES = ['General Question', 'Feature Request', 'Bug Report', 'Partnership / Investment', 'Press'];

const CONTACT_ITEMS = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <path d="m22 6-10 7L2 6"/>
      </svg>
    ),
    label: 'Email',
    value: 'hello@bizhealth.app',
    href: 'mailto:hello@bizhealth.app',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
      </svg>
    ),
    label: 'GitHub',
    value: 'github.com/nightguy716/BizHealth',
    href: 'https://github.com/nightguy716/BizHealth',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
        <rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
      </svg>
    ),
    label: 'LinkedIn',
    value: 'Connect with us',
    href: '#',
  },
];

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[10px] font-bold tracking-widest mb-1.5 uppercase"
        style={{ color: 'var(--text-4)', fontFamily: 'JetBrains Mono, monospace' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  background: 'var(--surface)',
  border: '1px solid rgba(79,110,247,0.15)',
  color: 'var(--text-1)',
  transition: 'border-color 0.15s',
};

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', type: INQUIRY_TYPES[0], message: '' });
  const [status, setStatus] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async e => {
    e.preventDefault();
    setStatus('sending');
    await new Promise(r => setTimeout(r, 900));
    setStatus('sent');
  };

  const focusStyle = e => (e.target.style.borderColor = 'rgba(79,110,247,0.5)');
  const blurStyle  = e => (e.target.style.borderColor = 'rgba(79,110,247,0.15)');

  return (
    <div className="min-h-screen page-bg" style={{ color: 'var(--text-2)' }}>

      {/* ── HERO ── */}
      <section className="relative pt-24 pb-16 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(79,110,247,0.09) 0%, transparent 70%)',
        }} />
        <div className="relative">
          <p className="text-xs font-medium tracking-widest uppercase mb-3"
            style={{ color: '#4f6ef7', fontFamily: 'JetBrains Mono, monospace' }}>
            CONTACT US
          </p>
          <h1 className="font-black mb-4"
            style={{ fontSize: 'clamp(2rem,4vw,2.8rem)', color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            Let's talk
          </h1>
          <p className="max-w-md mx-auto text-sm leading-relaxed" style={{ color: 'var(--text-3)' }}>
            Questions, feature requests, partnership inquiries, or just feedback —
            we read everything and reply within 24 hours.
          </p>
        </div>
      </section>

      {/* ── MAIN ── */}
      <section className="pb-24 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-5 gap-10">

          {/* ── Left info panel ── */}
          <div className="md:col-span-2 space-y-6">

            {/* contact items */}
            <div className="p-6 rounded-xl space-y-5"
              style={{ background: 'var(--surface)', border: '1px solid rgba(79,110,247,0.1)' }}>
              <h3 className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--text-4)', fontFamily: 'JetBrains Mono, monospace' }}>
                REACH US
              </h3>
              {CONTACT_ITEMS.map(c => (
                <a key={c.label} href={c.href} target="_blank" rel="noreferrer"
                  className="flex items-start gap-3 group">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors"
                    style={{ background: 'rgba(79,110,247,0.08)', color: '#4f6ef7' }}>
                    {c.icon}
                  </div>
                  <div>
                    <div className="text-[10px] tracking-widest uppercase mb-0.5" style={{ color: 'var(--text-4)', fontFamily: 'JetBrains Mono, monospace' }}>{c.label}</div>
                    <div className="text-sm group-hover:text-blue-400 transition-colors" style={{ color: 'var(--text-2)' }}>{c.value}</div>
                  </div>
                </a>
              ))}
            </div>

            {/* response time */}
            <div className="p-5 rounded-xl"
              style={{ background: 'rgba(0,232,135,0.05)', border: '1px solid rgba(0,232,135,0.15)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#00e887' }} />
                <span className="text-xs font-bold" style={{ color: '#00e887', fontFamily: 'JetBrains Mono, monospace' }}>TYPICALLY RESPONDS</span>
              </div>
              <p className="text-2xl font-black" style={{ color: 'var(--text-1)', fontFamily: 'JetBrains Mono, monospace' }}>
                &lt; 24 hrs
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-4)' }}>Usually much faster</p>
            </div>

            {/* quick links */}
            <div className="p-5 rounded-xl space-y-2"
              style={{ background: 'var(--surface)', border: '1px solid rgba(79,110,247,0.08)' }}>
              <h3 className="text-[10px] font-bold tracking-widest uppercase mb-3"
                style={{ color: 'var(--text-4)', fontFamily: 'JetBrains Mono, monospace' }}>QUICK LINKS</h3>
              {[
                ['Try the dashboard', '/dashboard'],
                ['View pricing', '/pricing'],
                ['About the project', '/about'],
              ].map(([label, to]) => (
                <Link key={label} to={to}
                  className="flex items-center justify-between py-2 text-sm transition-colors hover:opacity-80"
                  style={{ color: 'var(--text-3)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {label}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </Link>
              ))}
            </div>
          </div>

          {/* ── Right form ── */}
          <div className="md:col-span-3">
            {status === 'sent' ? (
              <div className="h-full flex flex-col items-center justify-center py-20 text-center rounded-xl"
                style={{ background: 'rgba(0,232,135,0.05)', border: '1px solid rgba(0,232,135,0.2)' }}>
                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5"
                  style={{ background: 'rgba(0,232,135,0.1)' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00e887" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                </div>
                <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--text-1)' }}>Message received</h3>
                <p className="text-sm mb-8" style={{ color: 'var(--text-3)' }}>
                  We'll get back to you within 24 hours.
                </p>
                <button onClick={() => setStatus('')}
                  className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-80"
                  style={{ background: 'rgba(0,232,135,0.1)', color: '#00e887',
                    border: '1px solid rgba(0,232,135,0.2)' }}>
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-8 rounded-xl space-y-5"
                style={{ background: 'var(--surface)', border: '1px solid rgba(79,110,247,0.12)' }}>
                <h3 className="font-bold text-base mb-2" style={{ color: 'var(--text-1)' }}>Send a message</h3>

                <div className="grid sm:grid-cols-2 gap-5">
                  <Field label="Name">
                    <input type="text" required placeholder="Your name"
                      value={form.name} onChange={e => set('name', e.target.value)}
                      onFocus={focusStyle} onBlur={blurStyle}
                      className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                      style={inputStyle} />
                  </Field>
                  <Field label="Email">
                    <input type="email" required placeholder="you@example.com"
                      value={form.email} onChange={e => set('email', e.target.value)}
                      onFocus={focusStyle} onBlur={blurStyle}
                      className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                      style={inputStyle} />
                  </Field>
                </div>

                <Field label="Inquiry Type">
                  <select value={form.type} onChange={e => set('type', e.target.value)}
                    onFocus={focusStyle} onBlur={blurStyle}
                    className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                    style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
                    {INQUIRY_TYPES.map(t => <option key={t} value={t} style={{ background: '#04091a' }}>{t}</option>)}
                  </select>
                </Field>

                <Field label="Message">
                  <textarea required rows={6}
                    placeholder="Tell us what's on your mind…"
                    value={form.message} onChange={e => set('message', e.target.value)}
                    onFocus={focusStyle} onBlur={blurStyle}
                    className="w-full px-4 py-2.5 rounded-lg text-sm outline-none resize-none"
                    style={inputStyle} />
                </Field>

                <button type="submit" disabled={status === 'sending'}
                  className="w-full py-3 rounded-lg font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.99]"
                  style={{
                    background: status === 'sending' ? 'rgba(79,110,247,0.5)' : 'linear-gradient(135deg,#4f6ef7,#3d5af1)',
                    color: '#fff',
                    cursor: status === 'sending' ? 'not-allowed' : 'pointer',
                  }}>
                  {status === 'sending'
                    ? <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                        Sending…
                      </span>
                    : 'Send Message →'}
                </button>

                <p className="text-xs text-center" style={{ color: '#3d5070' }}>
                  We respect your privacy. Your information is never shared with third parties.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

    </div>
  );
}
