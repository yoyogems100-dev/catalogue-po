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
  return (
    <span
      title={name}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        background: refPhotoUrl ? `url(${refPhotoUrl}) center/cover no-repeat, ${hex || '#ccc'}` : hex || '#ccc'
      }}
    />
  );
}
