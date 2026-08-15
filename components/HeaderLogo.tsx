// The real YOYO GEMS horizontal lockup, served from Supabase Storage (same
// bucket product photos use -- reliable for binary assets, unlike bundling
// images into the text-based deploy payload). Fixed to a compact height so
// the sticky topbar never grows tall on any screen size -- width is
// intrinsic/auto so the aspect ratio never distorts.
export default function HeaderLogo({ height = 32 }: { height?: number }) {
  const src = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/brand/yoyo-logo-horizontal-white.png`;
  return (
    <img
      src={src}
      alt="YOYO GEMS — Synthetic Gemstones. Infinite Choices. One Trusted Name."
      style={{ height, width: 'auto', display: 'block' }}
    />
  );
}
