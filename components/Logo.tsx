'use client';

// The brand mark, rebuilt as pure SVG. Vector means pixel-perfect at any
// size on any screen -- no more raster compression artifacts.
export function LogoMark({ size = 32, color = '#1B3A6B' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size * 1.05} viewBox="0 0 200 210" fill="none" style={{ flexShrink: 0 }}>
      <path d="M60 88 L100 48 L140 88" stroke={color} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M100 58 L136 95 L100 132 L64 95 Z" stroke={color} strokeWidth="9" strokeLinejoin="round" />
      <path d="M38 95 L38 158 L95 208 L95 138 Z" stroke={color} strokeWidth="9" strokeLinejoin="round" />
      <path d="M162 95 L162 158 L105 208 L105 138 Z" stroke={color} strokeWidth="9" strokeLinejoin="round" />
      <line x1="100" y1="132" x2="100" y2="196" stroke={color} strokeWidth="9" strokeLinecap="round" />
      <path d="M100 196 L108 205 L100 214 L92 205 Z" fill={color} />
    </svg>
  );
}

// The faceted gem that replaces the second "O" in the wordmark.
function GemDot({ size = 22, color = '#1B3A6B' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke={color} strokeWidth="1.2" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <circle cx="20" cy="20" r="17.5" />
      <polygon points="20,4 33,12 33,28 20,36 7,28 7,12" />
      <line x1="20" y1="4" x2="20" y2="36" />
      <line x1="7" y1="12" x2="33" y2="28" />
      <line x1="33" y1="12" x2="7" y2="28" />
    </svg>
  );
}

// Horizontal lockup -- icon + "YOYO GEMS" -- for topbars, nav, footer.
export function WordMark({ height = 26, color = '#1B3A6B' }: { height?: number; color?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: height * 0.22, fontFamily: 'Playfair Display, serif', fontWeight: 600, color, fontSize: height * 0.72, lineHeight: 1, letterSpacing: 0.4, whiteSpace: 'nowrap' }}>
      <LogoMark size={height} color={color} />
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        Y<GemDot size={height * 0.52} color={color} />YO GEMS
        <sup style={{ fontSize: height * 0.3, marginLeft: 1 }}>&reg;</sup>
      </span>
    </span>
  );
}

// Stacked vertical lockup -- icon above wordmark above tagline -- for hero/login.
export function FullLogo({ size = 'lg', color = '#1B3A6B', taglineColor }: { size?: 'lg' | 'md'; color?: string; taglineColor?: string }) {
  const h = size === 'lg' ? 58 : 36;
  return (
    <div style={{ textAlign: 'center' }}>
      <LogoMark size={h} color={color} />
      <div style={{ marginTop: h * 0.12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, fontFamily: 'Playfair Display, serif', fontWeight: 600, color, fontSize: h * 0.62, letterSpacing: 0.4 }}>
        Y<GemDot size={h * 0.44} color={color} />YO GEMS
        <sup style={{ fontSize: h * 0.24, marginLeft: 1 }}>&reg;</sup>
      </div>
      {size === 'lg' && (
        <div style={{ marginTop: 8, fontFamily: 'Playfair Display, serif', fontStyle: 'italic', fontWeight: 600, fontSize: 14, color: taglineColor || color, lineHeight: 1.5 }}>
          Synthetic Gemstones. Infinite Choices.<br />One Trusted Name.
        </div>
      )}
    </div>
  );
}
