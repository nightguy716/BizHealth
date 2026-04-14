import { useState } from 'react';

export default function Contact() {
  const [form, setForm]     = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    setStatus('sending');
    // Placeholder — backend endpoint will be wired in a future task
    await new Promise(r => setTimeout(r, 800));
    setStatus('sent');
    setForm({ name: '', email: '', message: '' });
  };

  return (
    <div className="min-h-screen page-bg flex flex-col items-center justify-center px-6">
      <div className="max-w-lg w-full">
        <div className="text-center mb-10">
          <p className="mono text-xs tracking-widest mb-3" style={{ color: '#4f6ef7' }}>CONTACT</p>
          <h1 className="text-4xl font-bold mb-3" style={{ color: '#f1f5f9' }}>Get in touch</h1>
          <p className="text-sm" style={{ color: '#94a3b8' }}>
            Questions, feedback, or partnership inquiries — we read everything.
          </p>
        </div>

        {status === 'sent' ? (
          <div className="rounded-xl p-8 text-center"
            style={{ background: 'rgba(0,232,135,0.06)', border: '1px solid rgba(0,232,135,0.2)' }}>
            <p className="text-2xl mb-2">✓</p>
            <p className="font-semibold mb-1" style={{ color: '#00e887' }}>Message sent</p>
            <p className="text-sm" style={{ color: '#94a3b8' }}>We'll get back to you within 24 hours.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { id: 'name',    label: 'Name',          type: 'text',  placeholder: 'Your name' },
              { id: 'email',   label: 'Email',         type: 'email', placeholder: 'you@example.com' },
            ].map(({ id, label, type, placeholder }) => (
              <div key={id}>
                <label className="block mono text-[10px] tracking-widest mb-1.5"
                  style={{ color: '#64748b' }}>{label.toUpperCase()}</label>
                <input
                  type={type} required placeholder={placeholder}
                  value={form[id]}
                  onChange={e => setForm(f => ({ ...f, [id]: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#f1f5f9',
                  }}
                />
              </div>
            ))}
            <div>
              <label className="block mono text-[10px] tracking-widest mb-1.5"
                style={{ color: '#64748b' }}>MESSAGE</label>
              <textarea
                required rows={5} placeholder="Your message…"
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none resize-none"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#f1f5f9',
                }}
              />
            </div>
            <button type="submit"
              disabled={status === 'sending'}
              className="w-full py-3 rounded-lg font-semibold text-sm transition-all"
              style={{ background: '#4f6ef7', color: '#fff', opacity: status === 'sending' ? 0.7 : 1 }}>
              {status === 'sending' ? 'Sending…' : 'Send Message'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
