// Heart-shaped color indicator, used everywhere a color renders: the color
// picker dropdown, cart/order line items, and the admin color list. Shows the
// real stone reference photo when the color has one (colors.ref_photo_url),
// clipped to the heart via a CSS mask so it reads as a little cut stone
// rather than a flat dot -- falls back to a solid hex-filled heart for
// colors that don't have a reference photo yet.
const HEART_MASK =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 21.3s-8.4-5.4-11-10.2C-0.8 7.1 2 3 6.2 3c2.5 0 4.6 1.3 5.8 3.4C13.2 4.3 15.3 3 17.8 3 22 3 24.8 7.1 23 11.1 20.4 15.9 12 21.3 12 21.3z'/></svg>\")";

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
  const maskProps = {
    WebkitMaskImage: HEART_MASK,
    maskImage: HEART_MASK,
    WebkitMaskSize: 'contain' as const,
    maskSize: 'contain' as const,
    WebkitMaskRepeat: 'no-repeat' as const,
    maskRepeat: 'no-repeat' as const,
    WebkitMaskPosition: 'center' as const,
    maskPosition: 'center' as const
  };

  return (
    <span
      title={name}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        flexShrink: 0,
        background: refPhotoUrl ? `url(${refPhotoUrl}) center/cover no-repeat, ${hex || '#ccc'}` : hex || '#ccc',
        ...maskProps
      }}
    />
  );
}
