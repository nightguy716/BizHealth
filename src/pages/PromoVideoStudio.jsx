import { Player } from '@remotion/player';
import { Link } from 'react-router-dom';
import { ValorevaPromoVideo, VALOREVA_PROMO_META } from '../remotion/ValorevaPromoVideo';

export default function PromoVideoStudio() {
  return (
    <div
      className="min-h-screen page-bg"
      style={{
        paddingTop: '5rem',
        paddingInline: '1.25rem',
        paddingBottom: '2rem',
        color: 'var(--text-2)',
      }}
    >
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <div style={{ marginBottom: 18 }}>
          <Link to="/" style={{ color: 'var(--gold)', textDecoration: 'none', fontSize: 12 }}>
            ← Back to home
          </Link>
        </div>

        <h1 style={{ margin: 0, color: 'var(--text-1)', fontSize: 28, letterSpacing: '-0.02em' }}>Valoreva Promo Video</h1>
        <p style={{ marginTop: 8, color: 'var(--text-4)', fontSize: 13 }}>
          Scene-based Remotion composition for product marketing and onboarding teasers.
        </p>

        <div
          style={{
            marginTop: 18,
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
            background: 'var(--surface)',
            boxShadow: '0 18px 60px rgba(0,0,0,0.35)',
          }}
        >
          <Player
            component={ValorevaPromoVideo}
            durationInFrames={VALOREVA_PROMO_META.durationInFrames}
            fps={VALOREVA_PROMO_META.fps}
            compositionWidth={VALOREVA_PROMO_META.compositionWidth}
            compositionHeight={VALOREVA_PROMO_META.compositionHeight}
            controls
            autoPlay={false}
            style={{ width: '100%', aspectRatio: '16 / 9' }}
          />
        </div>

        <div
          style={{
            marginTop: 16,
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: 12,
            background: 'var(--surface-hi)',
            fontSize: 12,
            color: 'var(--text-4)',
          }}
        >
          Tip: Use this route (`/promo-video`) to iterate scenes, copy, and timing before exporting final marketing cuts.
        </div>
      </div>
    </div>
  );
}
