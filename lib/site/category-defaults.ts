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
  }
};

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
