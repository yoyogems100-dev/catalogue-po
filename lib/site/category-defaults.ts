import type { ContentValue } from './schema';

// Starting copy for category pages, in the brief's voice. Used by the public
// page until the owner publishes that category, and by the admin editor when
// a category has never been edited. Facts the owner has not supplied (MOQ,
// lead time, exact tolerances) are left for them rather than invented.

const COPY: Record<string, ContentValue> = {
  // The brief's reference page -- the voice benchmark for every other page.
  moissanite: {
    hero: { promise: 'Diamond-level fire. Production-level pricing.', image: null },
    what: {
      heading: 'What it is',
      body: '<p>Moissanite is silicon carbide — a lab-grown stone with more fire than a diamond and a hardness of 9.25, second only to diamond itself. For a manufacturer, that means a stone that survives setting, polishing and daily wear, at a fraction of diamond cost.</p>'
    },
    why: {
      heading: 'Why buyers move to Moissanite',
      points: [
        { text: 'Higher brilliance and fire than diamond at a fraction of the cost' },
        { text: 'Hard enough for rings and daily-wear pieces, not just occasion jewellery' },
        { text: 'Consistent colour grades, so a repeat order matches the first one' }
      ]
    },
    judge: {
      heading: 'How to judge a good Moissanite',
      checkpoints: [
        { title: 'Colour', body: 'D–E–F is colourless and the safest for bridal. G–H–I shows a warm tint. Ask for the grade, never just “white.”' },
        { title: 'Clarity', body: 'VVS is the trade standard. Anything lower shows under a loupe at retail counters.' },
        { title: 'Cut', body: 'Facet alignment decides the fire. A poorly cut D-colour stone looks worse than a well-cut G.' },
        { title: 'Calibration', body: 'For production, mm consistency matters more than carat. Ours is held to tight tolerance so stones drop into settings without rework.' }
      ]
    },
    range: {
      heading: 'Our range',
      body: '<p>D / E / F and fancy colours, VVS clarity, round and fancy shapes from 1mm melee to 15mm+ centres. Certificates available on request.</p>',
      show_shapes: true
    },
    charts: { heading: 'Charts', show_colours: true, show_sizes: true, note: '' },
    stock: { heading: 'Ready stock & custom orders', moq: '', lead_time: '', calibration: '', custom: '' },
    cta: { heading: 'Request the full Moissanite catalogue', text: 'Every shape and size we hold, with photographs. Tell us what you work with and we’ll send it across on WhatsApp.' },
    seo: { title: 'Moissanite — wholesale loose stones', description: 'Wholesale loose moissanite for jewellery manufacturers: D–E–F and fancy colours, VVS clarity, round and fancy shapes from 1mm to 15mm+.', image: null }
  },

  // Starting copy for the other categories (2026-09-26). General material
  // facts only. Left for the owner to fill in admin (the sections stay hidden
  // until then): minimum order, lead time, calibration tolerance, stock.
  cz: page({
    promise: 'The stone most jewellery is built on. Graded, so you pick the finish you pay for.',
    what: 'Cubic zirconia is lab-made zirconium dioxide: a hard, colourless stone with strong sparkle, cut in almost every shape and size a setter needs. It is the everyday workhorse of fashion and silver jewellery.',
    why: [
      'Cut grades from 3A to 7A, so a price-led line and a premium line can come from one supplier',
      'White, colours, crushed ice cut and Swiss high density under one roof',
      'Same grade on a repeat order, so a reorder matches the first batch'
    ],
    range: 'White CZ in 3A, 4A, 5A and 7A grades, coloured CZ, crushed ice cut, Swiss high density (round) and specialty CZ such as hole-punched stones, preforms and fancy solitaires. Use the filters above to see what each type comes in.',
    cta: 'Request the full CZ catalogue',
    seoTitle: 'CZ stones — wholesale cubic zirconia',
    seo: 'Wholesale CZ for jewellery manufacturers: white CZ in 3A to 7A grades, coloured CZ, crushed ice cut and Swiss high density.'
  }),
  'cz/white-cz': page({
    promise: 'Colourless CZ in four cut grades.',
    what: 'White CZ is the colourless cubic zirconia used as the main stone and as melee in most fashion and silver jewellery. The A grade tells you how well it is cut and polished: more A, sharper facets and more sparkle.',
    why: [
      '3A for price-led pieces, 4A and 5A for everyday retail, 7A where the stone has to hold up next to real diamond',
      'Pick the grade per design instead of paying top grade across the whole range'
    ],
    range: 'White CZ in 3A, 4A, 5A and 7A. Shapes and sizes differ by grade; use the filters above.',
    cta: 'Request the White CZ catalogue',
    seoTitle: 'White CZ — 3A, 4A, 5A and 7A wholesale',
    seo: 'Wholesale white cubic zirconia in 3A, 4A, 5A and 7A cut grades, in round and fancy shapes.'
  }),
  'cz/coloured-cz': page({
    promise: 'CZ in the colours your designs call for.',
    what: 'Coloured CZ is cubic zirconia with the colour grown into the stone, so it does not wear off with polishing or daily use. It is how most fashion pieces get their ruby, emerald, sapphire and pastel tones.',
    why: [
      'Colour runs through the stone, not a coating on top',
      'Many colours in the same shapes and sizes as white CZ, so one design can run in several colours'
    ],
    range: 'See every colour we carry in the colour chart below, with real stone photos.',
    cta: 'Request the Coloured CZ catalogue',
    seoTitle: 'Coloured CZ — wholesale cubic zirconia colours',
    seo: 'Wholesale coloured cubic zirconia with real stone photos of every colour, in round and fancy shapes.'
  }),
  'cz/crushed-ice': page({
    promise: 'Crushed ice cut: sparkle from edge to edge.',
    what: 'Crushed ice is a cutting style, not a material: the pavilion carries many small, irregular facets that break light into a scattered sparkle, like crushed ice. It is popular in elongated and fancy shapes.',
    why: [
      'Hides small inclusions and colour variation better than a classic brilliant cut',
      'Gives large fancy shapes a busy, modern sparkle'
    ],
    range: 'Crushed ice cut CZ in the shapes and sizes shown below.',
    cta: 'Request the Crushed Ice catalogue',
    seoTitle: 'Crushed ice cut CZ — wholesale',
    seo: 'Wholesale crushed ice cut cubic zirconia in fancy and elongated shapes, with real photos.'
  }),
  'cz/high-density-swiss': page({
    promise: 'Our brightest round CZ.',
    what: 'Swiss high density is a premium grade of round cubic zirconia with a denser, cleaner crystal and a sharper cut. Buyers use it where the stone sits next to diamond or moissanite and has to hold its own.',
    why: [
      'Brighter and cleaner than standard white CZ',
      'Round only, so sizes stay consistent for production settings'
    ],
    range: 'Round only. See the sizes we hold in the chart below.',
    cta: 'Request the Swiss High Density catalogue',
    seoTitle: 'Swiss high density CZ — round, wholesale',
    seo: 'Wholesale Swiss high density round cubic zirconia for premium silver and gold jewellery.'
  }),
  'nano-spinel': page({
    promise: 'Coloured stones with even colour, lot after lot.',
    what: 'Nano crystal is a lab-made glass-ceramic built for colour. The colour is part of the material, so every stone in a lot matches, and it takes a crisp cut like a gemstone. It is the usual choice for coloured stones where corundum or spinel would cost more.',
    why: [
      'Even colour across a lot, so a set of earrings and a necklace match',
      'Wide colour range in calibrated shapes and sizes',
      'Costs less than coloured corundum or spinel for the same look'
    ],
    range: 'Nano crystal in the colours, shapes and sizes shown below.',
    cta: 'Request the Nano catalogue',
    seoTitle: 'Nano crystal stones — wholesale',
    seo: 'Wholesale nano crystal gemstones in calibrated shapes and sizes, with a colour chart of real stone photos.'
  }),
  'ruby-corundum': page({
    promise: 'Real corundum, grown in the lab.',
    what: 'Synthetic corundum is aluminium oxide, the same mineral as natural ruby and sapphire, grown in a lab instead of mined. It has the hardness of the natural stone (9 on the Mohs scale), so it takes daily wear in rings and bangles.',
    why: [
      'Same material as natural ruby and sapphire at a fraction of the price',
      'Hard enough for rings and bangles that knock against things every day',
      'Ruby, sapphire colours, rainbow strips, opaque chatam and cabochons from one supplier'
    ],
    range: 'Synthetic ruby, synthetic corundum in colours, rainbow corundum sold in complete strips, opaque chatam, cabochons and glass-filled ruby.',
    cta: 'Request the Ruby & Corundum catalogue',
    seoTitle: 'Synthetic ruby & corundum — wholesale',
    seo: 'Wholesale synthetic ruby and corundum: faceted, rainbow strips, opaque chatam and cabochons for jewellery manufacturers.'
  }),
  'ruby-corundum/rainbow-corundum': page({
    promise: 'A graded run of colours, ready to set.',
    what: 'Rainbow corundum comes as strips: a row of synthetic corundum stones laid out in a colour sequence, so a line bracelet or eternity band can be set in order without sorting.',
    why: [
      'Colours arrive in sequence, which saves sorting time at the bench',
      'Corundum hardness, so the colours hold up in rings and bracelets'
    ],
    range: 'Sold in complete strips. The number of stones per strip depends on shape and size.',
    cta: 'Request the Rainbow Corundum catalogue',
    seoTitle: 'Rainbow corundum strips — wholesale',
    seo: 'Wholesale rainbow corundum sold in complete strips, for line bracelets and eternity bands.'
  }),
  'lab-grown': page({
    promise: 'Lab-grown stones for fine jewellery.',
    what: 'Lab-grown stones have the same chemistry and crystal as their mined twins, grown under controlled conditions instead of dug out of the ground. That covers lab-grown diamonds and cultivated coloured gems such as emerald, ruby and sapphire.',
    why: [
      'The real material, so it tests and wears like the mined stone',
      'Cleaner and more consistent than most mined material at the same price'
    ],
    range: 'Lab diamonds, cultivated gems and precision-cut stones. Ask us for what you need; we confirm availability per order.',
    cta: 'Request the Lab Grown catalogue',
    seoTitle: 'Lab-grown gemstones — wholesale',
    seo: 'Wholesale lab-grown stones for jewellery manufacturers: lab diamonds and cultivated emerald, ruby and sapphire.'
  }),
  polki: page({
    promise: 'The look of Polki, made for production.',
    what: 'Polki stones are flat, lightly faceted stones with a flat back, used in Kundan and Polki jewellery where the stone sits under a gold or foil frame. Foil polki carries a foil backing that throws light back through the stone.',
    why: [
      'The traditional look at a price that works for bridal and festive lines',
      'Flat and foil versions, so the same design can run at two price points'
    ],
    range: 'Flat polki and foil polki in the shapes and sizes shown below.',
    cta: 'Request the Polki catalogue',
    seoTitle: 'Polki stones — flat and foil, wholesale',
    seo: 'Wholesale flat polki and foil polki stones for Kundan and bridal jewellery.'
  }),
  'glass-crystal': page({
    promise: 'Colour and shine for fashion jewellery.',
    what: 'Glass stones and crystal give strong colour and sparkle at the lowest cost per piece. Foiled glass carries a mirror backing that makes the stone look brighter once set.',
    why: [
      'Lowest cost per stone for fashion and bridal sets',
      'Foiled versions stay bright in closed settings'
    ],
    range: 'Glass stones, foiled glass and crystal.',
    cta: 'Request the Glass & Crystal catalogue',
    seoTitle: 'Glass stones & crystal — wholesale',
    seo: 'Wholesale glass stones, foiled glass and crystal for fashion jewellery.'
  }),
  'beads-pearls': page({
    promise: 'Pearls and beads in matched colours.',
    what: 'Glass pearls are glass beads with a pearl coating, made in exact colours and sizes so a strand matches from end to end. Glass beads and ceramic beads round out the range for stringing and fashion work.',
    why: [
      'Every pearl in a lot matches, which natural pearls cannot promise',
      'Many colours, with real photos of each in the chart'
    ],
    range: 'Glass pearls, glass beads and ceramic.',
    cta: 'Request the Beads & Pearls catalogue',
    seoTitle: 'Glass pearls & beads — wholesale',
    seo: 'Wholesale glass pearls, glass beads and ceramic beads in matched colours.'
  }),
  'special-categories': page({
    promise: 'The stones that make a design stand out.',
    what: 'Opal, fusion stones, evil eye, malachite, mother of pearl, onyx, queen conch, star light and turkey ring stones: materials with their own pattern or play of colour, for pieces that need something other than a clear faceted stone.',
    why: [
      'Distinctive materials from the same supplier as your everyday stones',
      'Photos of each material, so you know what you are ordering'
    ],
    range: 'Choose a material below to see its shapes, sizes and photos.',
    cta: 'Request the Special Categories catalogue',
    seoTitle: 'Opal, malachite, MOP, onyx & more — wholesale',
    seo: 'Wholesale synthetic opal, fusion stones, evil eye, malachite, mother of pearl, onyx, queen conch and more.'
  }),
  natural: page({
    promise: 'Natural stones, photographed lot by lot.',
    what: 'Natural emeralds, pearls and semi-precious stones are mined or grown in nature, so no two lots are identical. We photograph what we hold and confirm the lot with you before it ships.',
    why: [
      'See real photos before you order',
      'Lots confirmed with you, so what arrives matches what you agreed'
    ],
    range: 'Natural emeralds, natural pearls and semi-precious stones.',
    cta: 'Request the Natural catalogue',
    seoTitle: 'Natural emeralds, pearls & semi-precious — wholesale',
    seo: 'Wholesale natural emeralds, natural pearls and semi-precious stones, photographed lot by lot.'
  })
};

type Brief = { promise: string; what: string; why: string[]; range: string; cta: string; seoTitle: string; seo: string };

/** Build a category's starting copy from a short brief. */
function page(b: Brief): ContentValue {
  return {
    hero: { promise: b.promise, image: null },
    what: { heading: 'What it is', body: `<p>${b.what}</p>` },
    why: { heading: 'Why it matters for your production', points: b.why.map((text) => ({ text })) },
    range: { heading: 'Our range', body: `<p>${b.range}</p>`, show_shapes: true },
    charts: { heading: 'Charts', show_colours: true, show_sizes: true, note: '' },
    cta: { heading: b.cta, text: 'Every shape, size and colour we hold, with photographs. Tell us what you work with and we’ll send it across on WhatsApp.' },
    seo: { title: b.seoTitle, description: b.seo, image: null }
  };
}

/** Generic fallback so no page is ever empty. */
function generic(): ContentValue {
  return {
    hero: { promise: '', image: null },
    range: { heading: 'Our range', body: '', show_shapes: true },
    charts: { heading: 'Charts', show_colours: true, show_sizes: true, note: '' },
    cta: { heading: 'Request the full catalogue', text: 'Every shape, size and colour we hold, with photographs. Tell us what you work with and we’ll send it across on WhatsApp.' }
  };
}

export function categoryDefaults(parentSlug: string | null, slug: string): ContentValue {
  return COPY[parentSlug ? `${parentSlug}/${slug}` : slug] ?? generic();
}
