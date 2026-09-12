# Admin photo and cover crops

Added to Categories → category → Photos:

- **Crop photo** controls the product image in Explore, its enlarged view and order references.
- **Adjust cover** controls the square category-card image independently.
- Existing **Set cover** still selects any Explore image. A separate cover upload works too.
- Drag to reposition, zoom, use sliders, save/cancel, or restore the original. Product photos also support square, portrait, landscape and original proportions.
- Crops are generated from the original, never from a previously cropped output. Source uploads and Drive IDs are preserved.
- With no cover adjustment, a category card uses the photo crop, then the original. An explicit cover crop takes priority and survives product-crop changes.

Deployment needs `supabase/migrations/20260912090000_photo_crops.sql`. Until applied, existing photos render normally and the editor explains that setup is pending. This migration was tested locally, not applied to production.

Validation: production build; 14 regression tests including crop bounds, image pixels and independent URL selection; repeatable local PGlite migration test; desktop/mobile browser checks with synthetic originals and mocked saves covering separate targets, failure feedback, reset and cancellation. No production photo was altered in testing.

No dependency installation required. Existing Sharp generates WebP derivatives (maximum 2400px); Drive references are read at up to 2400px. Previous derivative files are retained so cached pages do not break; storage cleanup can use a later retention job.

Mobile checks additionally covered 320/390/430px customer views and a touch-based 500-piece order draft through review and back to Explore. Mobile targets were enlarged; crop editor actions remain visible while its body scrolls. These are local browser checks, not real-device or production-save certification.
