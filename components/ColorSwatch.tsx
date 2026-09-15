// Round color indicator, used everywhere a color renders: the color picker
// dropdown, cart/order line items, and the admin color list. Shows the real
// stone reference photo when the color has one (colors.ref_photo_url),
// cropped to a circle so it reads as a little gem rather than a flat dot --
// falls back to a solid hex-filled circle for colors that don't have a
// reference photo yet. Plain border-radius rather than an SVG mask since the
// stones themselves aren't a fixed shape (octagon/radiant cuts, mostly) --
// round is the one crop that reads naturally regardless of the source cut.
export default function ColorSwatch({
  hex,
  refPhotoUrl,
  name,
  size = 16
}: {
  hex?: string | null;
  refPhotoUrl?: string | null;
  name?: string;
  size?: number;
}) {
  // Pearl photos and our own generated gem icons are already tightly cropped
  // with a transparent background, so they're shown at their natural size with
  // no clip -- forcing them through the hard circle-crop + 280% zoom below
  // (built for looser admin-uploaded photos) would cut into the facets and can
  // show a thin ring where the CSS circle doesn't line up with the photo's own
  // edge. These tight crops are essentially never exactly square (real gem
  // photos, cropped to the stone's own bounding box, come out wider or
  // taller depending on the cut), so `contain` -- not `100% 100%` -- is
  // required: forcing a non-square photo to fill a square box stretches it,
  // visibly squashing the stone.
  const isCleanCutout = refPhotoUrl?.includes('/pearl-colors/') || refPhotoUrl?.includes('/reference/colors/');
  const displaySize = isCleanCutout ? Math.max(size, 28) : size;
  return (
    <span
      title={name}
      style={{
        display: 'inline-block',
        width: displaySize,
        height: displaySize,
        flexShrink: 0,
        borderRadius: isCleanCutout ? 0 : '50%',
        // Zoomed in hard on the center of the photo -- source stone photos
        // vary in how tightly they're framed (some have a light backing
        // margin, some are looser crops from admin uploads), and 170% still
        // let a sliver of that background show at the circle's edge on
        // looser photos. This samples deep into the stone's own color/facets
        // instead of anywhere near the photo's outer edge, so the round
        // swatch reads as solid stone regardless of how the source was shot.
        // The hex color is only layered in as a fallback for those looser,
        // externally-hosted photos -- layering it under a clean cutout would
        // bleed through as a colored square behind the gem's own transparent
        // background.
        background: refPhotoUrl
          ? (isCleanCutout ? `url(${refPhotoUrl}) center/contain no-repeat` : `url(${refPhotoUrl}) center/280% 280% no-repeat, ${hex || '#ccc'}`)
          : (hex || '#ccc')
      }}
    />
  );
}
