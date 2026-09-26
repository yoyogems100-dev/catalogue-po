import type { ContentValue } from './schema';

// Starting copy for each page, taken from the owner's brief. It is what the
// public site shows until the owner publishes their own version, and what the
// admin editor opens with when a page has never been edited -- so the site is
// never blank and the owner edits real words instead of empty boxes.
//
// Nothing here may state trade facts the owner has not given us (MOQs, lead
// times, tolerances, prices). Where a page needs those, the text says to ask.

export const pageDefaults: Record<string, ContentValue> = {
  global: {
    brand: { tagline: 'Synthetic Gemstones. Infinite Choices. One Trusted Name.', logo: null },
    contact: {
      phone: '+91 90799 14601',
      whatsapp: '919079914601',
      whatsapp_message: 'Hi YOYO GEMS, I would like your digital catalogue.',
      email: '',
      address: 'YOYO GEMS, A-13 Sethi Colony, Jaipur 302004, Rajasthan, India',
      city_line: 'Jaipur, Rajasthan, India',
      gst_note: 'GSTIN 08BBSPJ2927H1ZB · Transparent, GST-compliant billing',
      hours: ''
    },
    social: { links: [] },
    header: { cta_label: 'Request Catalogue', show_trade_login: true },
    footer: {
      blurb: 'B2B synthetic gemstone wholesaler and importer, Jaipur. Factory-direct from our own setup in China, stocked in India.',
      links: [],
      legal: 'YOYO GEMS® is a registered trademark.'
    },
    filters: {
      heading: '{filters} {category}',
      intro: '{filters} {category} from our ready range, photographed as supplied. Send us the sizes and quantities you need and we’ll confirm stock and price.'
    },
    seo: {
      title_template: '%s · YOYO GEMS®',
      description: 'Wholesale synthetic gemstones for jewellery manufacturers. 40+ categories, 35+ shapes and colours. Factory-direct from China, stocked in Jaipur.',
      image: null
    }
  },
  home: {
    hero: {
      heading: 'Premium Synthetic Gemstones. Infinite Choices. One Trusted Name.',
      subline: '40+ categories. 35+ shapes & colours. Factory-direct from China, stocked in India.',
      primary_label: 'Request Catalogue',
      secondary_label: 'Browse Categories',
      image: null
    },
    numbers: { items: [
      { value: '40+', label: 'categories' },
      { value: '35+', label: 'shapes & colours' },
      { value: '27+', label: 'sites across India' },
      { value: '2,795+', label: 'satisfied customers' }
    ] },
    categories: {
      heading: 'Every stone your production calls for',
      intro: 'From 5A white CZ to moissanite, nano, corundum and polki. Pick a material to see its shapes, sizes and colours.'
    },
    story: {
      heading: 'One supplier for the whole order',
      columns: [
        { title: 'You design.', text: 'Tell us the shape, size, colour and grade the piece needs. Mixed lists across materials are normal for us.' },
        { title: 'We stock.', text: 'Regular shipments from our own setup in China keep ready stock in India, so a size does not run out mid-production.' },
        { title: 'You reorder identically.', text: 'Every lot is checked for cut, colour and calibration before dispatch. The second order matches the first.' }
      ]
    },
    charts: {
      heading: 'Shapes, sizes and colours at a glance',
      text: 'Real stone photographs, not flat colour blocks. Check a shape’s sizes or a colour’s tone before you ask for a quote.',
      link_label: 'See all charts'
    },
    why: {
      heading: 'Why manufacturers buy from us',
      blocks: [
        { title: 'Uncompromised Quality', points: [
          { text: 'No compromise on quality, ever' },
          { text: 'The same consistent quality in every supply' },
          { text: 'High brilliance, precise cuts, perfect calibration' }
        ] },
        { title: 'Extensive Variety', points: [
          { text: '40+ categories and 35+ shapes and colours' },
          { text: 'CZ, Nano, Ruby Corundum, Glass, Beads, Pearls' },
          { text: 'Bulk availability and custom orders' }
        ] },
        { title: 'Strong China Roots', points: [
          { text: 'Direct factories, our own shop and staff in China' },
          { text: 'Latest synthetic gemstone technology' },
          { text: 'Factory-direct pricing, no middlemen' }
        ] },
        { title: 'Reliable Supply & Trust', points: [
          { text: 'Regular shipments and steady stock flow' },
          { text: 'Secure packaging and timely delivery' },
          { text: 'Transparent, GST-compliant billing' },
          { text: 'Trusted by manufacturers and traders' }
        ] }
      ]
    },
    cta: {
      heading: 'Get the full digital catalogue',
      text: 'Every shape, size and colour we stock, in one catalogue. Tell us what you work with and we’ll send it across on WhatsApp.',
      button: 'Request Catalogue'
    },
    contact: { heading: 'Talk to us' },
    seo: { title: '', description: '', image: null }
  },
  about: {
    hero: {
      heading: 'About YOYO GEMS',
      tagline: 'Synthetic Gemstones. Infinite Choices. One Trusted Name.',
      image: null
    },
    story: { blocks: [
      {
        heading: 'We got into this because sourcing stones was harder than it needed to be',
        body: '<p>Anyone who has tried to buy loose stones in bulk knows the routine. You find a colour you like, order it, and the next lot comes back a shade off. A size runs out mid-production. A supplier stops replying for three weeks. You spend more time chasing stones than designing jewellery.</p><p>We started YOYO GEMS to take that problem off your desk.</p>',
        image: null
      },
      {
        heading: 'What we do',
        body: '<p>We supply loose cubic zirconia, moissanite, nano gemstones, synthetic opal, corundum, spinel, lab-created and simulated glass stones, and natural gemstones — hand-cut and machine-cut, in grades from A through to top 5A.</p><p>Across <strong>40+ categories and 35+ shapes and colours</strong>, in a full run of sizes, we supply buyers at 27+ sites across India. Whatever the design calls for, it’s already in our range.</p>',
        image: null
      },
      {
        heading: 'Why our customers stay',
        body: '<p><strong>We are actually in China.</strong> Not a middleman with a contact there. Our own setup, our own staff, direct relationships with the factories cutting the stones. That’s why our prices are what they are, and why we see new cuts before they reach the market.</p><p><strong>The second order matches the first.</strong> Every lot is checked for cut, colour and calibration before it ships. You shouldn’t have to re-examine a reorder — and with us, you don’t.</p><p><strong>One supplier, one conversation.</strong> Instead of five vendors for five stone types, you deal with us. Fewer calls, fewer follow-ups, fewer things that can go wrong.</p><p><strong>We keep stock.</strong> Regular shipments, steady flow, secure packing, on-time dispatch. Transparent, GST-compliant billing, every time.</p>',
        image: null
      },
      {
        heading: 'What we’re really offering',
        body: '<p>A complete purchasing solution — so you spend less time on procurement and more time doing the part that actually grows your business: designing.</p><p>We’re not looking for a one-time order. We’re looking for the kind of relationship where you call us because you already know what you’ll get.</p>',
        image: null
      }
    ] },
    reach: {
      heading: 'From Jaipur to buyers across India',
      intro: 'We pack and dispatch from Jaipur to 27+ sites across India, from Punjab to Tamil Nadu and from Gujarat to the North East.',
      note: ''
    },
    photos: { heading: 'Our setup and QC table', items: [] },
    numbers: { items: [
      { value: '40+', label: 'categories' },
      { value: '35+', label: 'shapes & colours' },
      { value: '27+', label: 'sites across India' },
      { value: '2,795+', label: 'satisfied customers' }
    ] },
    cta: {
      heading: 'That’s the whole idea. One trusted name.',
      primary_label: 'Request the Digital Catalogue',
      secondary_label: 'Talk to us on WhatsApp'
    },
    seo: { title: '', description: 'YOYO GEMS supplies loose synthetic, lab-created and natural gemstones to jewellery manufacturers, direct from our own setup in China, stocked in Jaipur.', image: null }
  },
  quality: {
    hero: {
      heading: 'Quality & QC',
      intro: 'Every lot is checked before it leaves us: cut, colour match, calibration and count.',
      image: null
    },
    body: { text: '<p>Before a lot is packed, it goes across our checking table. We look at the cut first: facets meeting cleanly, a centred table, no chips on the girdle. Stones that fall short of the grade are taken out.</p><p>Colour is matched against the reference for that shade, so a reorder sits next to your earlier stones without a visible difference. Sizes are checked for calibration, because a stone that is slightly off will not sit in a setting made for the right size.</p><p>Last, we count. The quantity on the packet is the quantity inside it. If anything in a lot does not match what you asked for, we tell you before it ships, not after.</p>' },
    checks: {
      heading: 'What we check before dispatch',
      items: [
        { title: 'Cut', text: 'Facets meet cleanly, the table is centred and the girdle is free of chips. Stones below the grade are removed.' },
        { title: 'Colour match', text: 'Each shade is compared against its reference so a reorder matches the first lot.' },
        { title: 'Calibration', text: 'Sizes are checked so stones sit in settings made for that size, without re-sorting at your end.' },
        { title: 'Count', text: 'The quantity on the packet is the quantity inside it.' }
      ]
    },
    photos: { items: [] },
    cta: {
      heading: 'See the full range',
      text: 'Every shape, size and colour we stock, in one digital catalogue.',
      button: 'Request Catalogue'
    },
    seo: { title: '', description: 'How YOYO GEMS checks every lot before dispatch: cut, colour match, calibration and count.', image: null }
  },
  'how-to-order': {
    hero: {
      heading: 'How to order',
      intro: 'Five steps, from first message to dispatch.'
    },
    steps: { items: [
      { title: 'Enquire', text: 'Fill in the catalogue request or message us on WhatsApp. Tell us what you make and which stones you use.' },
      { title: 'Receive the catalogue', text: 'We send the digital catalogue on WhatsApp: every shape, size and colour we stock.' },
      { title: 'Share your list', text: 'Send the shapes, sizes, colours, grades and quantities you need. Mixed lists across materials are fine.' },
      { title: 'We confirm stock & quote', text: 'We check stock against your list and send the price. Tell us the shape and size — we’ll confirm stock the same day.' },
      { title: 'Payment, QC, dispatch', text: 'Once payment is in, the lot is checked for cut, colour, calibration and count, packed securely and dispatched with a GST invoice.' }
    ] },
    note: { text: '<p>Prices depend on the stone, grade, size and quantity, so we quote against your list rather than publish a price list. Already a customer? Use <a href="/po">Trade login</a> to send a requirement directly.</p>' },
    cta: {
      heading: 'Start with the catalogue',
      text: 'Tell us what you work with and we’ll send the catalogue across on WhatsApp.',
      button: 'Request Catalogue'
    },
    seo: { title: '', description: 'How to order loose gemstones from YOYO GEMS: request the catalogue, share your list, get stock and price confirmed, then payment, QC and dispatch.', image: null }
  },
  charts: {
    hub: {
      heading: 'Charts',
      intro: 'Shapes, sizes, colours and grades, taken from our live catalogue. Colour swatches are photographs of the stones, not flat colour blocks.'
    },
    shapes: {
      title: 'Shape chart',
      intro: 'Every shape we stock. Tap a shape to see the sizes it comes in and which materials carry it.'
    },
    sizes: {
      title: 'Size & MM → carat chart',
      intro: 'Sizes by shape, in millimetres. Where we have a carat weight on record, it is shown next to the size.',
      note: 'Carat weights are approximate and vary with the material and the cut. Moissanite figures are diamond-equivalent reference weights — the weight a diamond of that size would have — not the moissanite’s own weight.'
    },
    colours: { charts: [
      { title: 'CZ Colours', slug: 'cz-colours', intro: 'Coloured CZ, crushed ice and speciality CZ shades, photographed on black.', categories: [7] },
      { title: 'Moissanite Colours', slug: 'moissanite-colours', intro: 'Moissanite colours we stock, photographed on black.', categories: [1] },
      { title: 'Corundum & Spinel Colours', slug: 'corundum-spinel-colours', intro: 'Synthetic ruby, corundum, rainbow corundum and opaque shades.', categories: [8, 18] },
      { title: 'Nano Colours', slug: 'nano-colours', intro: 'The full nano crystal colour range, photographed on black.', categories: [17] },
      { title: 'Glass & Opal Colours', slug: 'glass-opal-colours', intro: 'Glass stones, foiled glass, crystal and synthetic opal.', categories: [10, 38] }
    ] },
    grades: {
      title: 'Quality grades explained',
      intro: 'A, 3A, 5A, 7A, High Density Swiss: what the letters mean, and how to pick the right grade for the piece you are making.',
      body_heading: 'What the letters mean',
      body: '<p>In loose CZ and similar stones, the grade describes how well a stone is cut and polished, not what it is made of. The more A’s, the tighter the standard: sharper facets, a cleaner polish and more even stones across a lot.</p><p>A grade is a trade convention, not a laboratory certificate, and different suppliers draw the lines in slightly different places. The descriptions below are the standards we sort to.</p>',
      choosing_heading: 'Choosing a grade',
      choosing: '<p>Match the grade to the piece. A stone that sits in a small pavé setting, seen from arm’s length, does not need the finish of a solitaire that is the centre of the design.</p><ul><li>Fashion and costume jewellery, high volumes: lower grades keep the cost in line with the piece.</li><li>Silver and gold-plated jewellery sold on sparkle: mid and upper grades.</li><li>Solitaires, centre stones and fine jewellery: the top grades.</li></ul><p>Not sure? Send us the design and we will suggest a grade.</p>'
    },
    seo: { title: '', description: 'Shape, size, colour and quality grade charts for loose synthetic gemstones: CZ, moissanite, nano, corundum, glass and opal.', image: null }
  },
  faq: {
    hero: {
      heading: 'Frequently asked questions',
      intro: 'Short answers on catalogue, pricing, ordering and dispatch. Anything else, ask us on WhatsApp.'
    },
    cta: {
      heading: 'Still have a question?',
      text: 'Message us on WhatsApp with your question or your list of stones.'
    },
    seo: { title: '', description: 'Answers to common questions from jewellery manufacturers buying loose gemstones from YOYO GEMS.', image: null }
  },
  'request-catalogue': {
    hero: {
      heading: 'Request the digital catalogue',
      intro: 'Our full range — every shape, size and colour — lives in our digital catalogue. Tell us what you work with and we’ll send it across.',
      promise: 'Catalogue shared within 24 working hours.'
    },
    form: {
      requirement_hint: 'e.g. 5,000 pcs of 2–4mm white CZ, or a rough monthly spend',
      button: 'Request Catalogue',
      privacy: 'We use your number only to send the catalogue and reply to you on WhatsApp.'
    },
    thanks: {
      heading: 'Thank you. Your request is in.',
      text: 'We’ll send the catalogue to your WhatsApp within 24 working hours. If you need something sooner, message us now.',
      whatsapp_label: 'Message us on WhatsApp'
    },
    seo: { title: 'Request the Catalogue', description: 'Request the YOYO GEMS digital catalogue: every shape, size, colour and grade we stock, shared on WhatsApp.', image: null }
  },
  contact: {
    hero: {
      heading: 'Contact',
      intro: 'WhatsApp is the fastest way to reach us. Send your list, a photo of the stone you need, or just ask for the catalogue.'
    },
    visit: {
      heading: 'Visiting us',
      text: 'Our office is in Jaipur. Message us before you come so we can have your stones ready to see.',
      map_url: '',
      image: null
    },
    cta: {
      heading: 'Get the full digital catalogue',
      text: 'Every shape, size and colour we stock, in one catalogue, sent on WhatsApp.',
      button: 'Request Catalogue'
    },
    seo: { title: '', description: 'Contact YOYO GEMS, Jaipur: WhatsApp, phone and address for wholesale gemstone enquiries.', image: null }
  }
};
