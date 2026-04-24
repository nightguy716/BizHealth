import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createRichUserBlogPost } from '../lib/blogPostsStore';

const CATEGORIES = [
  'How-To',
  'Liquidity',
  'Profitability',
  'Credit Analysis',
  'Efficiency',
  'Valuation',
  'Earnings Quality',
];

export default function NewBlogPost() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('How-To');
  const [readTime, setReadTime] = useState('');
  const [blocks, setBlocks] = useState([
    { type: 'lead', text: '' },
    { type: 'p', text: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function updateBlock(i, patch) {
    setBlocks((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }

  function removeBlock(i) {
    setBlocks((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addBlock(type) {
    const next =
      type === 'image'
        ? { type: 'image', src: '', caption: '' }
        : type === 'miniChart'
          ? { type: 'miniChart', title: 'Trend', points: [{ label: 'Year 1', value: 0 }, { label: 'Year 2', value: 0 }] }
          : type === 'companyAnalysis'
            ? { type: 'companyAnalysis', ticker: '', companyName: '', note: '' }
            : { type, text: '' };
    setBlocks((prev) => [...prev, next]);
  }

  if (loading) {
    return (
      <div className="min-h-screen page-bg flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-[var(--gold)] border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const hasBody = blocks.some((b) => (b.text && String(b.text).trim()) || (b.src && String(b.src).trim()) || (b.ticker && String(b.ticker).trim()));
    if (!title.trim() || !description.trim() || !hasBody) {
      setError('Title, description, and at least one content block are required.');
      return;
    }
    setSaving(true);
    try {
      const post = createRichUserBlogPost({
        title,
        description,
        category,
        readTime,
        blocks,
        author: user?.user_metadata?.full_name || user?.email || 'Valoreva User',
      });
      navigate(`/blog/${post.slug}`);
    } catch {
      setError('Could not save post. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen page-bg px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="ghost-card rounded-2xl p-6 mb-5">
          <p className="eyebrow mb-2">Blog</p>
          <h1 className="heading-lg mb-2">Write a New Post</h1>
          <p className="text-sm" style={{ color: 'var(--text-4)' }}>
            Medium-style writing with rich sections: text, images, mini graphs, and live company analysis links.
          </p>
        </div>

        <form className="ghost-card rounded-2xl p-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="label-upper">Title</label>
            <input className="input-neon mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Post title" />
          </div>

          <div>
            <label className="label-upper">Description</label>
            <input className="input-neon mt-1" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short summary for listing and SEO" />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label-upper">Category</label>
              <select className="select-neon mt-1" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label-upper">Read Time (minutes)</label>
              <input className="input-neon mt-1" value={readTime} onChange={(e) => setReadTime(e.target.value)} placeholder="Auto if blank" type="number" min="1" />
            </div>
          </div>

          <div className="rounded-xl p-4" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <button type="button" className="px-3 py-1.5 rounded-md text-xs" style={{ border: '1px solid var(--border)', color: 'var(--text-3)' }} onClick={() => addBlock('p')}>+ Paragraph</button>
              <button type="button" className="px-3 py-1.5 rounded-md text-xs" style={{ border: '1px solid var(--border)', color: 'var(--text-3)' }} onClick={() => addBlock('h2')}>+ Heading</button>
              <button type="button" className="px-3 py-1.5 rounded-md text-xs" style={{ border: '1px solid var(--border)', color: 'var(--text-3)' }} onClick={() => addBlock('image')}>+ Image</button>
              <button type="button" className="px-3 py-1.5 rounded-md text-xs" style={{ border: '1px solid var(--border)', color: 'var(--text-3)' }} onClick={() => addBlock('miniChart')}>+ Graph</button>
              <button type="button" className="px-3 py-1.5 rounded-md text-xs" style={{ border: '1px solid var(--border)', color: 'var(--text-3)' }} onClick={() => addBlock('companyAnalysis')}>+ Company Analysis Link</button>
            </div>

            <div className="space-y-3">
              {blocks.map((b, i) => (
                <div key={i} className="rounded-lg p-3" style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-4)' }}>{b.type}</span>
                    <button type="button" className="text-xs" style={{ color: '#f87171' }} onClick={() => removeBlock(i)}>Remove</button>
                  </div>

                  {(b.type === 'lead' || b.type === 'p' || b.type === 'h2') && (
                    <textarea
                      className="input-neon"
                      style={{ minHeight: b.type === 'h2' ? 70 : 120, resize: 'vertical' }}
                      value={b.text || ''}
                      onChange={(e) => updateBlock(i, { text: e.target.value })}
                      placeholder={b.type === 'h2' ? 'Section heading' : 'Write your text...'}
                    />
                  )}

                  {b.type === 'image' && (
                    <div className="grid gap-2">
                      <input className="input-neon" value={b.src || ''} onChange={(e) => updateBlock(i, { src: e.target.value })} placeholder="Image URL (https://...)" />
                      <input className="input-neon" value={b.caption || ''} onChange={(e) => updateBlock(i, { caption: e.target.value })} placeholder="Caption (optional)" />
                    </div>
                  )}

                  {b.type === 'miniChart' && (
                    <div className="grid gap-2">
                      <input className="input-neon" value={b.title || ''} onChange={(e) => updateBlock(i, { title: e.target.value })} placeholder="Graph title" />
                      <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>Add up to 6 points</p>
                      {(b.points || []).slice(0, 6).map((pt, pi) => (
                        <div key={pi} className="grid grid-cols-2 gap-2">
                          <input
                            className="input-neon"
                            value={pt.label || ''}
                            onChange={(e) => {
                              const next = [...(b.points || [])];
                              next[pi] = { ...next[pi], label: e.target.value };
                              updateBlock(i, { points: next });
                            }}
                            placeholder="Label"
                          />
                          <input
                            className="input-neon"
                            type="number"
                            value={pt.value ?? ''}
                            onChange={(e) => {
                              const next = [...(b.points || [])];
                              next[pi] = { ...next[pi], value: Number(e.target.value || 0) };
                              updateBlock(i, { points: next });
                            }}
                            placeholder="Value"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {b.type === 'companyAnalysis' && (
                    <div className="grid gap-2">
                      <input className="input-neon" value={b.ticker || ''} onChange={(e) => updateBlock(i, { ticker: e.target.value.toUpperCase() })} placeholder="Ticker (e.g., TCS.NS)" />
                      <input className="input-neon" value={b.companyName || ''} onChange={(e) => updateBlock(i, { companyName: e.target.value })} placeholder="Company name (optional)" />
                      <textarea className="input-neon" style={{ minHeight: 90, resize: 'vertical' }} value={b.note || ''} onChange={(e) => updateBlock(i, { note: e.target.value })} placeholder="What should readers look at in analysis?" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--border)', color: 'var(--text-3)' }} onClick={() => navigate('/blog')}>
              Cancel
            </button>
            <button type="submit" className="btn-primary px-5 py-2 rounded-lg text-sm font-semibold text-white" disabled={saving}>
              {saving ? 'Publishing...' : 'Publish Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
