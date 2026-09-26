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
      description: 'Wholesale synthetic gemstones for jewellery manufacturers. 40+ categories, 30+ shapes, 50+ colours. Factory-direct from China, stocked in Jaipur.',
      image: null
    }
  },
  home: {
    hero: {
      heading: 'Synthetic Gemstones. Infinite Choices. One Trusted Name.',
      subline: '40+ categories. 30+ shapes. 50+ colours. Factory-direct from China, stocked in India.',
      primary_label: 'Request Catalogue',
      secondary_label: 'Browse Categories',
      image: null
    },
    numbers: { items: [
      { value: '40+', label: 'categories' },
      { value: '30+', label: 'shapes & sizes' },
      { value: '50+', label: 'colours' },
      { value: '9,000+', label: 'combinations' }
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
          { text: '9,000+ combinations of shape, size and colour' },
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
  }
};
