# Category ordering release

Rainbow Corundum now offers Default color or Custom colors and a stone-count choice restricted to the selected shape/size. The customer enters strips; orders store total pieces plus strip metadata. Custom colors stay together as one request. Admin configures available counts in the category's Strip counts tab. No counts are automatically assigned to products.

Hole Punched Stones requires Half drill or Full drill. Other categories retain their existing fields. These choices are preserved in customer/admin creation, order detail, new-line editing, reorder seeds, app responses, WhatsApp summaries and order PDFs. Existing orders remain readable; old special-category reorders without specifications must have their options selected again. Prices for the new configurations require team confirmation; admin can enter optional per-piece prices.

This release also includes the previously completed category workspaces, 24 Glass Pearls colors, hot-selling indicators, compact ordering photo references, INR-only PDF pricing, mobile controls and independent product/cover crop controls.

Validation: production build; 16 regression tests; local PostgreSQL migration checks for all four migrations; mobile Rainbow Default/Custom and drill draft tests without live orders; mobile general order review; rendered PDF review. Live account/order mutations and actual WhatsApp delivery were not exercised with customer data.

Current limits: strip-count values need the business's actual shape/size mapping; crop rollback preserves original image files. The wider audit's new catalogue PDFs, color-chart library, website page editor, named team roles and transactional/idempotent order saving are separate work, not included in this release.
