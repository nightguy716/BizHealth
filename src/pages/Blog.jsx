import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAllBlogPosts } from '../lib/blogPostsStore';

const CATEGORY_COLORS = {
  'Liquidity':       'var(--gold)',
  'Profitability':   '#16a34a',
  'Credit Analysis': '#dc2626',
  'Efficiency':      '#7c3aed',
  'Valuation':       '#b45309',
  'Earnings Quality':'#b45309',
  'How-To':          'var(--gold)',
};

function CategoryBadge({ cat }) {
  const color = CATEGORY_COLORS[cat] || 'var(--gold)';
  return (
    <span style={{
      fontFamily: "'var(--font-sans)'", fontSize: 10, fontWeight: 600,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      color, border: `1px solid ${color}`, borderRadius: 3,
      padding: '2px 6px', whiteSpace: 'nowrap',
    }}>
      {cat}
    </span>
  );
}

function PostCard({ post, featured = false }) {
  return (
    <Link to={`/blog/${post.slug}`} className="feature-card group block no-underline">
      <div className="flex items-start justify-between gap-3 mb-3">
        <CategoryBadge cat={post.category} />
        <span className="mono text-[10px]" style={{ color: 'var(--text-5)', flexShrink: 0 }}>
          {post.readTime} min read
        </span>
      </div>

      <h2 className={`font-bold mb-2 leading-snug transition-colors group-hover:text-blue-400 ${featured ? 'text-lg' : 'text-sm'}`}
        style={{ color: 'var(--text-1)' }}>
        {post.title}
      </h2>

      <p className="text-xs leading-relaxed line-clamp-3 mb-4" style={{ color: 'var(--text-3)' }}>
        {post.description}
      </p>

      <div className="flex items-center justify-between">
        <span className="mono text-[10px]" style={{ color: 'var(--text-5)' }}>
          {new Date(post.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <span className="text-xs font-semibold transition-colors" style={{ color: 'var(--gold)' }}>
          Read →
        </span>
      </div>
    </Link>
  );
}

export default function Blog() {
  const { user } = useAuth();
  const posts = useMemo(() => getAllBlogPosts(), []);
  const featured = posts[0];
  const rest = posts.slice(1);
  const categories = [...new Set(posts.map((p) => p.category))];

  return (
    <div className="min-h-screen page-bg" style={{ color: 'var(--text-2)' }}>

      {/* ── HERO ── */}
      <section className="relative pt-24 pb-16 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 55% 35% at 50% 0%, rgba(79,110,247,0.09) 0%, transparent 70%)' }} />

        <div className="max-w-5xl mx-auto relative">
          <p className="eyebrow mb-3">Finance Intelligence</p>
          <h1 className="heading-xl mb-4 max-w-2xl">
            Learn the ratios that drive<br />
            <span style={{ color: 'var(--gold)' }}>real investment decisions.</span>
          </h1>
          <p className="subheading max-w-lg">
            CFA-level concepts explained clearly for analysts, consultants, and finance professionals.
            Each article links directly to live analysis tools.
          </p>

          {user && (
            <div className="mt-5">
              <Link
                to="/blog/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold"
                style={{ background: 'rgba(200,157,31,0.14)', border: '1px solid rgba(200,157,31,0.35)', color: 'var(--gold)' }}
              >
                Write Post
              </Link>
            </div>
          )}

          {/* Category pills */}
          <div className="flex flex-wrap gap-2 mt-8">
            {categories.map(cat => (
              <CategoryBadge key={cat} cat={cat} />
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED POST ── */}
      {featured && (
      <section className="px-6 pb-8">
        <div className="max-w-5xl mx-auto">
          <p className="eyebrow mb-4" style={{ color: 'var(--text-4)' }}>Latest</p>
          <Link to={`/blog/${featured.slug}`}
            className="group block rounded-2xl p-7 transition-all"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-card)',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hi)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
            <div className="flex items-center gap-3 mb-4">
              <CategoryBadge cat={featured.category} />
              <span className="mono text-[10px]" style={{ color: 'var(--text-5)' }}>{featured.readTime} min read</span>
              <span className="mono text-[10px]" style={{ color: 'var(--text-5)' }}>
                {new Date(featured.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <h2 className="font-black mb-3 leading-snug transition-colors group-hover:text-blue-400"
              style={{ fontSize: 'clamp(1.1rem,2.5vw,1.5rem)', color: 'var(--text-1)' }}>
              {featured.title}
            </h2>
            <p className="text-sm leading-relaxed max-w-2xl mb-5" style={{ color: 'var(--text-3)' }}>
              {featured.description}
            </p>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--gold)' }}>
              Read article
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </span>
          </Link>
        </div>
      </section>
      )}

      {/* ── ARTICLE GRID ── */}
      <section className="px-6 pb-24">
        <div className="max-w-5xl mx-auto">
          <p className="eyebrow mb-6" style={{ color: 'var(--text-4)' }}>All Articles</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rest.map(post => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-6 text-center" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <p className="eyebrow mb-3">Put It Into Practice</p>
        <h2 className="heading-lg mb-4">
          Stop reading about ratios.<br />Start calculating them.
        </h2>
        <p className="subheading mb-8 max-w-md mx-auto">
          Search any listed company and get all 23 ratios with AI commentary in under 10 seconds. Free.
        </p>
        <Link to="/dashboard"
          className="btn-primary inline-block px-10 py-4 rounded-xl font-bold text-sm text-white">
          Launch Dashboard →
        </Link>
      </section>

    </div>
  );
}
