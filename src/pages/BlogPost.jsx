import { useParams, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  getBlogPostBySlug,
  getRelatedBlogPosts,
  getPostReactions,
  setPostReaction,
} from '../lib/blogPostsStore';

/* ── Category badge ─────────────────────────────────────────── */
const CAT_CLR = {
  'Liquidity':       '#22d3ee',
  'Profitability':   '#00e887',
  'Credit Analysis': '#f43f5e',
  'Efficiency':      '#a78bfa',
  'Valuation':       '#fbbf24',
  'Earnings Quality':'#fbbf24',
  'How-To':          'var(--gold)',
};

function CategoryBadge({ cat }) {
  const c = CAT_CLR[cat] || 'var(--gold)';
  return (
    <span className="inline-flex items-center text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
      style={{
        background: `${c}15`,
        border: `1px solid ${c}35`,
        color: c,
        fontFamily: 'JetBrains Mono, monospace',
      }}>
      {cat}
    </span>
  );
}

/* ── Content block renderer ─────────────────────────────────── */
function Block({ block }) {
  switch (block.type) {
    case 'lead':
      return (
        <p className="text-lg leading-relaxed font-medium mb-8"
          style={{ color: 'var(--text-2)', borderLeft: '3px solid #4f6ef7', paddingLeft: 20 }}>
          {block.text}
        </p>
      );

    case 'h2':
      return (
        <h2 className="font-black mt-10 mb-4"
          style={{ fontSize: 'clamp(1.1rem,2vw,1.35rem)', color: 'var(--text-1)', letterSpacing: '-0.015em' }}>
          {block.text}
        </h2>
      );

    case 'p':
      return (
        <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-2)' }}>
          {block.text}
        </p>
      );

    case 'formula':
      return (
        <div className="my-6 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(79,110,247,0.25)' }}>
          <div className="px-4 py-2 flex items-center justify-between"
            style={{ background: 'rgba(79,110,247,0.07)', borderBottom: '1px solid rgba(79,110,247,0.15)' }}>
            <span className="mono text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--gold)' }}>
              {block.label}
            </span>
          </div>
          <div className="px-5 py-4" style={{ background: 'rgba(79,110,247,0.04)' }}>
            <p className="mono text-sm font-bold mb-1" style={{ color: '#f1f5f9' }}>{block.formula}</p>
            {block.example && (
              <p className="mono text-xs mt-2" style={{ color: 'var(--text-4)' }}>{block.example}</p>
            )}
          </div>
        </div>
      );

    case 'table':
      return (
        <div className="my-6 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'rgba(79,110,247,0.06)', borderBottom: '1px solid var(--border)' }}>
                  {block.headers.map(h => (
                    <th key={h} className="text-left px-4 py-3 font-bold uppercase tracking-wider mono"
                      style={{ color: 'var(--gold)', fontSize: 10, whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(79,110,247,0.02)' }}>
                    {row.map((cell, j) => (
                      <td key={j} className="px-4 py-3 leading-relaxed"
                        style={{ color: j === 0 ? 'var(--text-1)' : 'var(--text-3)', fontWeight: j === 0 ? 600 : 400 }}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

    case 'callout': {
      const variants = {
        info:    { bg: 'rgba(79,110,247,0.08)',  border: 'rgba(79,110,247,0.3)',   icon: 'ℹ', color: 'var(--gold)'  },
        warning: { bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.3)',   icon: '[!]', color: '#fbbf24' },
        danger:  { bg: 'rgba(244,63,94,0.08)',   border: 'rgba(244,63,94,0.3)',    icon: '!', color: '#f43f5e'  },
      };
      const v = variants[block.variant] || variants.info;
      return (
        <div className="my-6 flex gap-4 rounded-xl px-5 py-4"
          style={{ background: v.bg, border: `1px solid ${v.border}` }}>
          <span className="mono font-black text-sm flex-shrink-0 mt-0.5" style={{ color: v.color }}>{v.icon}</span>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{block.text}</p>
        </div>
      );
    }

    case 'list':
      return (
        <ul className="my-4 space-y-2.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2" style={{ background: 'var(--gold)' }} />
              {item}
            </li>
          ))}
        </ul>
      );

    case 'cta':
      return (
        <div className="my-8 rounded-2xl px-6 py-5"
          style={{ background: 'rgba(79,110,247,0.07)', border: '1px solid rgba(79,110,247,0.2)' }}>
          <p className="text-sm mb-3" style={{ color: 'var(--text-2)' }}>{block.text}</p>
          <Link to={block.link}
            className="btn-primary inline-block px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all">
            {block.label}
          </Link>
        </div>
      );

    case 'image':
      return (
        <figure className="my-8">
          <img
            src={block.src}
            alt={block.caption || 'Article illustration'}
            className="w-full rounded-xl"
            style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
          />
          {block.caption && (
            <figcaption className="mt-2 text-xs" style={{ color: 'var(--text-4)' }}>
              {block.caption}
            </figcaption>
          )}
        </figure>
      );

    case 'miniChart':
      return (
        <div className="my-8 rounded-2xl p-4" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <p className="mono text-[11px] mb-3 uppercase tracking-wider" style={{ color: 'var(--gold)' }}>
            {block.title || 'Trend'}
          </p>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={Array.isArray(block.points) ? block.points : []} margin={{ top: 10, right: 12, left: 0, bottom: 2 }}>
                <CartesianGrid stroke="rgba(79,110,247,0.12)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-4)', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface-hi)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    color: 'var(--text-1)',
                  }}
                />
                <Line type="monotone" dataKey="value" stroke="var(--gold)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      );

    case 'companyAnalysis': {
      const ticker = String(block.ticker || '').trim().toUpperCase();
      const url = ticker ? `/dashboard?symbol=${encodeURIComponent(ticker)}${block.companyName ? `&name=${encodeURIComponent(block.companyName)}` : ''}` : '/dashboard';
      return (
        <div className="my-8 rounded-2xl p-5" style={{ border: '1px solid rgba(79,110,247,0.35)', background: 'rgba(79,110,247,0.08)' }}>
          <p className="mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--gold)' }}>
            Direct Valoreva Analysis
          </p>
          <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--text-1)' }}>
            {block.companyName || ticker || 'Company'}
            {ticker ? ` (${ticker})` : ''}
          </h3>
          {block.note && (
            <p className="text-sm mb-3" style={{ color: 'var(--text-2)' }}>{block.note}</p>
          )}
          <Link to={url} className="btn-primary inline-block px-4 py-2 rounded-lg text-xs font-semibold text-white">
            Open Live Dashboard Analysis
          </Link>
        </div>
      );
    }

    default:
      return null;
  }
}

/* ── Related post card ──────────────────────────────────────── */
function RelatedCard({ post }) {
  const c = CAT_CLR[post.category] || 'var(--gold)';
  return (
    <Link to={`/blog/${post.slug}`}
      className="block p-5 rounded-xl transition-all"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(79,110,247,0.35)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
      <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-2 mono uppercase tracking-wider"
        style={{ background: `${c}15`, color: c, border: `1px solid ${c}30` }}>
        {post.category}
      </span>
      <p className="text-xs font-semibold leading-snug mb-1.5 line-clamp-2" style={{ color: 'var(--text-1)' }}>
        {post.title}
      </p>
      <p className="text-[10px]" style={{ color: 'var(--text-4)' }}>{post.readTime} min read</p>
    </Link>
  );
}

/* ── Main component ─────────────────────────────────────────── */
export default function BlogPost() {
  const { slug } = useParams();
  const navigate  = useNavigate();
  const post      = getBlogPostBySlug(slug);
  const related   = getRelatedBlogPosts(slug, 3);
  const [reaction, setReaction] = useState(() => getPostReactions(slug));

  useEffect(() => {
    if (!post) { navigate('/blog', { replace: true }); }
  }, [post, navigate]);

  useEffect(() => {
    setReaction(getPostReactions(slug));
  }, [slug]);

  if (!post) return null;

  /* Structured data (JSON-LD) for SEO */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    author: { '@type': 'Organization', name: 'Valoreva' },
    datePublished: post.date,
    publisher: { '@type': 'Organization', name: 'Valoreva' },
  };

  return (
    <div className="min-h-screen page-bg" style={{ color: 'var(--text-2)' }}>

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── Breadcrumb + back ── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 pb-2">
        <div className="flex items-center gap-2 text-xs mb-8" style={{ color: 'var(--text-4)' }}>
          <Link to="/" className="hover:text-blue-400 transition-colors">Home</Link>
          <span>/</span>
          <Link to="/blog" className="hover:text-blue-400 transition-colors">Blog</Link>
          <span>/</span>
          <span className="truncate max-w-[200px]" style={{ color: 'var(--text-3)' }}>{post.title}</span>
        </div>
      </div>

      {/* ── Article header ── */}
      <header className="max-w-3xl mx-auto px-4 sm:px-6 pb-8">
        <div className="flex items-center gap-3 mb-5">
          <CategoryBadge cat={post.category} />
          <span className="mono text-[10px]" style={{ color: 'var(--text-5)' }}>{post.readTime} min read</span>
          <span className="mono text-[10px]" style={{ color: 'var(--text-5)' }}>
            {new Date(post.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>

        <h1 className="font-black mb-4 leading-tight"
          style={{ fontSize: 'clamp(1.5rem,3.5vw,2.2rem)', color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
          {post.title}
        </h1>

        <p className="text-base leading-relaxed mb-6" style={{ color: 'var(--text-3)' }}>
          {post.description}
        </p>

        {/* Divider */}
        <div className="h-px" style={{ background: 'linear-gradient(90deg, rgba(79,110,247,0.4), transparent)' }} />
      </header>

      {/* ── Article body ── */}
      <article className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        {post.content.map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </article>

      {/* ── Author / share row ── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        <div className="rounded-2xl px-5 py-4 flex items-center justify-between gap-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#4f6ef7,#22d3ee)' }}>
              <span className="text-white font-black text-xs">B</span>
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>{post.author}</p>
              <p className="text-[10px]" style={{ color: 'var(--text-4)' }}>Valoreva · Financial Intelligence</p>
            </div>
          </div>
          <Link to="/blog"
            className="text-xs font-semibold transition-colors hidden sm:block"
            style={{ color: 'var(--gold)' }}>
            ← All articles
          </Link>
        </div>

        <div className="rounded-2xl px-5 py-4 mt-3 flex items-center justify-between gap-3"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>Was this post useful?</p>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{
                border: '1px solid var(--border)',
                background: reaction.userVote === 'approve' ? 'rgba(34,197,94,0.15)' : 'transparent',
                color: reaction.userVote === 'approve' ? '#22c55e' : 'var(--text-3)',
              }}
              onClick={() => setReaction(setPostReaction(slug, reaction.userVote === 'approve' ? null : 'approve'))}
            >
              Approve ({reaction.approvals})
            </button>
            <button
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{
                border: '1px solid var(--border)',
                background: reaction.userVote === 'disapprove' ? 'rgba(239,68,68,0.15)' : 'transparent',
                color: reaction.userVote === 'disapprove' ? '#ef4444' : 'var(--text-3)',
              }}
              onClick={() => setReaction(setPostReaction(slug, reaction.userVote === 'disapprove' ? null : 'disapprove'))}
            >
              Disapprove ({reaction.disapprovals})
            </button>
          </div>
        </div>
      </div>

      {/* ── Related posts ── */}
      {related.length > 0 && (
        <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-20">
          <p className="eyebrow mb-5">Continue Reading</p>
          <div className="grid sm:grid-cols-3 gap-3">
            {related.map(p => <RelatedCard key={p.slug} post={p} />)}
          </div>
        </section>
      )}

    </div>
  );
}
