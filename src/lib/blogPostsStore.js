import { POSTS } from '../data/blogPosts';

const USER_POSTS_KEY = 'finaxis_user_blog_posts_v1';
const REACTIONS_KEY = 'finaxis_blog_reactions_v1';

function safeDateIso(value) {
  const d = value ? new Date(value) : new Date();
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function slugify(title) {
  return String(title || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

function readUserPosts() {
  try {
    const raw = localStorage.getItem(USER_POSTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUserPosts(posts) {
  try {
    localStorage.setItem(USER_POSTS_KEY, JSON.stringify(posts));
  } catch {
    // ignore storage errors
  }
}

export function getAllBlogPosts() {
  const userPosts = readUserPosts();
  const all = [...POSTS, ...userPosts].map((p) => ({
    ...p,
    date: safeDateIso(p.date),
  }));
  return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getBlogPostBySlug(slug) {
  return getAllBlogPosts().find((p) => p.slug === slug) || null;
}

export function getRelatedBlogPosts(slug, count = 3) {
  const all = getAllBlogPosts().filter((p) => p.slug !== slug);
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function createUserBlogPost({ title, description, category, readTime, body, author }) {
  const all = getAllBlogPosts();
  const base = slugify(title) || `post-${Date.now()}`;
  let slug = base;
  let i = 1;
  while (all.some((p) => p.slug === slug)) {
    slug = `${base}-${i++}`;
  }

  const paragraphs = String(body || '')
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);

  const content = [];
  if (paragraphs.length > 0) {
    content.push({ type: 'lead', text: paragraphs[0] });
    paragraphs.slice(1).forEach((p) => content.push({ type: 'p', text: p }));
  }

  const post = {
    slug,
    title: String(title || '').trim(),
    description: String(description || '').trim(),
    category: String(category || 'How-To').trim(),
    readTime: Number(readTime) > 0 ? Number(readTime) : Math.max(2, Math.ceil(String(body || '').split(/\s+/).filter(Boolean).length / 180)),
    date: new Date().toISOString(),
    author: String(author || 'Valoreva User').trim(),
    content: content.length ? content : [{ type: 'p', text: '' }],
  };

  const userPosts = readUserPosts();
  userPosts.push(post);
  writeUserPosts(userPosts);
  return post;
}

function sanitizeBlocks(blocks) {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .map((b) => {
      const type = String(b?.type || '').trim();
      if (!type) return null;
      if (type === 'h2' || type === 'p' || type === 'lead') {
        const text = String(b?.text || '').trim();
        if (!text) return null;
        return { type, text };
      }
      if (type === 'image') {
        const src = String(b?.src || '').trim();
        if (!src) return null;
        return { type, src, caption: String(b?.caption || '').trim() };
      }
      if (type === 'miniChart') {
        const title = String(b?.title || '').trim() || 'Trend';
        const points = Array.isArray(b?.points)
          ? b.points
              .map((p) => ({ label: String(p?.label || '').trim(), value: Number(p?.value) }))
              .filter((p) => p.label && Number.isFinite(p.value))
          : [];
        if (!points.length) return null;
        return { type, title, points };
      }
      if (type === 'companyAnalysis') {
        const ticker = String(b?.ticker || '').trim().toUpperCase();
        if (!ticker) return null;
        return {
          type,
          ticker,
          companyName: String(b?.companyName || '').trim(),
          note: String(b?.note || '').trim(),
        };
      }
      return null;
    })
    .filter(Boolean);
}

export function createRichUserBlogPost({
  title,
  description,
  category,
  readTime,
  blocks,
  author,
}) {
  const all = getAllBlogPosts();
  const base = slugify(title) || `post-${Date.now()}`;
  let slug = base;
  let i = 1;
  while (all.some((p) => p.slug === slug)) {
    slug = `${base}-${i++}`;
  }

  const content = sanitizeBlocks(blocks);
  const wordCount = content
    .map((b) => {
      if (b.type === 'miniChart' || b.type === 'companyAnalysis') return 18;
      if (b.type === 'image') return 8;
      return String(b.text || '').split(/\s+/).filter(Boolean).length;
    })
    .reduce((a, b) => a + b, 0);

  const post = {
    slug,
    title: String(title || '').trim(),
    description: String(description || '').trim(),
    category: String(category || 'How-To').trim(),
    readTime: Number(readTime) > 0 ? Number(readTime) : Math.max(2, Math.ceil(wordCount / 180)),
    date: new Date().toISOString(),
    author: String(author || 'Valoreva User').trim(),
    content: content.length ? content : [{ type: 'p', text: '' }],
  };

  const userPosts = readUserPosts();
  userPosts.push(post);
  writeUserPosts(userPosts);
  return post;
}

function readReactions() {
  try {
    const raw = localStorage.getItem(REACTIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeReactions(v) {
  try {
    localStorage.setItem(REACTIONS_KEY, JSON.stringify(v));
  } catch {
    // ignore
  }
}

export function getPostReactions(slug) {
  const all = readReactions();
  const rec = all[slug] || { approvals: 0, disapprovals: 0, userVote: null };
  return {
    approvals: Number(rec.approvals) || 0,
    disapprovals: Number(rec.disapprovals) || 0,
    userVote: rec.userVote === 'approve' || rec.userVote === 'disapprove' ? rec.userVote : null,
  };
}

export function setPostReaction(slug, nextVote) {
  const all = readReactions();
  const rec = getPostReactions(slug);
  let { approvals, disapprovals, userVote } = rec;

  if (userVote === 'approve') approvals = Math.max(0, approvals - 1);
  if (userVote === 'disapprove') disapprovals = Math.max(0, disapprovals - 1);

  if (nextVote === 'approve') approvals += 1;
  if (nextVote === 'disapprove') disapprovals += 1;
  userVote = nextVote === 'approve' || nextVote === 'disapprove' ? nextVote : null;

  const updated = { approvals, disapprovals, userVote };
  all[slug] = updated;
  writeReactions(all);
  return updated;
}
