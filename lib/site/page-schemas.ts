import type { ContentSchema } from './schema';
import { seoFields } from './schemas';

/** Field schemas for the standalone pages (home, about, ...), keyed by site_pages.key. */
export const pageSchemas: Record<string, ContentSchema> = {
  global: {
    sections: [
      { key: 'brand', title: 'Brand', fields: [
        { type: 'text', key: 'tagline', label: 'Tagline', max: 120 },
        { type: 'image', key: 'logo', label: 'Logo (optional)', help: 'Leave empty to use the standard YOYO GEMS® logo in white.' }
      ] },
      { key: 'contact', title: 'Contact details', help: 'Shown in the header, footer, contact strip and Contact page.', fields: [
        { type: 'text', key: 'phone', label: 'Phone', max: 30, placeholder: '+91 90799 14601' },
        { type: 'text', key: 'whatsapp', label: 'WhatsApp number', max: 20, help: 'With country code, digits only, e.g. 919079914601.' },
        { type: 'text', key: 'whatsapp_message', label: 'WhatsApp opening message', max: 200 },
        { type: 'text', key: 'email', label: 'Email', max: 120 },
        { type: 'textarea', key: 'address', label: 'Address', max: 300 },
        { type: 'text', key: 'city_line', label: 'Short location line', max: 80, placeholder: 'Jaipur, Rajasthan, India' },
        { type: 'text', key: 'gst_note', label: 'GST note', max: 160 },
        { type: 'text', key: 'hours', label: 'Working hours', max: 120 }
      ] },
      { key: 'social', title: 'Social links', fields: [
        { type: 'list', key: 'links', label: 'Links', itemLabel: 'Link', max: 8, fields: [
          { type: 'text', key: 'label', label: 'Name', max: 30, placeholder: 'Instagram' },
          { type: 'link', key: 'url', label: 'Address' }
        ] }
      ] },
      { key: 'header', title: 'Header', fields: [
        { type: 'text', key: 'cta_label', label: 'Button text', max: 30 },
        { type: 'toggle', key: 'show_trade_login', label: 'Show “Trade login” link to the private catalogue' }
      ] },
      { key: 'footer', title: 'Footer', fields: [
        { type: 'textarea', key: 'blurb', label: 'Short description', max: 300 },
        { type: 'list', key: 'links', label: 'Popular searches', help: 'Links to filtered category pages, e.g. /products/nano-spinel/nano?colour=green', itemLabel: 'Link', max: 20, fields: [
          { type: 'text', key: 'label', label: 'Text', max: 60 },
          { type: 'link', key: 'url', label: 'Address' }
        ] },
        { type: 'text', key: 'legal', label: 'Bottom line', max: 160 }
      ] },
      { key: 'filters', title: 'Filtered category pages', help: 'Heading and intro for pages like /products/nano-spinel/nano?colour=green. {filters} becomes the chosen filters (e.g. “Green Oval”), {category} the category name, {count} the number of photos.', fields: [
        { type: 'text', key: 'heading', label: 'Heading pattern', max: 80 },
        { type: 'textarea', key: 'intro', label: 'Intro pattern (two lines)', max: 300 }
      ] },
      { key: 'seo', title: 'Search defaults', fields: [
        { type: 'text', key: 'title_template', label: 'Title pattern', max: 70, help: 'Use %s where the page name goes, e.g. “%s · YOYO GEMS®”.' },
        ...seoFields.filter((f) => f.key !== 'title')
      ] }
    ]
  },
  home: {
    sections: [
      { key: 'hero', title: '1 · Hero', fields: [
        { type: 'text', key: 'heading', label: 'Headline', max: 90 },
        { type: 'textarea', key: 'subline', label: 'Sub-line', max: 220 },
        { type: 'text', key: 'primary_label', label: 'Main button', max: 30 },
        { type: 'text', key: 'secondary_label', label: 'Second button', max: 30 },
        { type: 'image', key: 'image', label: 'Background image', help: 'A stone macro on black. Text sits on the left, so keep the stones to the right.' }
      ] },
      { key: 'numbers', title: '2 · Numbers strip', fields: [
        { type: 'list', key: 'items', label: 'Numbers', itemLabel: 'Number', max: 6, fields: [
          { type: 'text', key: 'value', label: 'Number', max: 12, placeholder: '9,000+' },
          { type: 'text', key: 'label', label: 'Label', max: 40, placeholder: 'combinations' }
        ] }
      ] },
      { key: 'categories', title: '3 · Category grid', help: 'Tiles are filled automatically from Website → Categories.', fields: [
        { type: 'text', key: 'heading', label: 'Heading', max: 80 },
        { type: 'textarea', key: 'intro', label: 'Intro', max: 240 }
      ] },
      { key: 'story', title: '4 · One-stop story', fields: [
        { type: 'text', key: 'heading', label: 'Heading', max: 80 },
        { type: 'list', key: 'columns', label: 'Columns', itemLabel: 'Column', max: 3, fields: [
          { type: 'text', key: 'title', label: 'Title', max: 40 },
          { type: 'textarea', key: 'text', label: 'Text', max: 300 }
        ] }
      ] },
      { key: 'charts', title: '5 · Charts teaser', help: 'The shape strip and colour swatches come from the catalogue.', fields: [
        { type: 'text', key: 'heading', label: 'Heading', max: 80 },
        { type: 'textarea', key: 'text', label: 'Text', max: 240 },
        { type: 'text', key: 'link_label', label: 'Link text', max: 30 }
      ] },
      { key: 'why', title: '6 · Why choose us', fields: [
        { type: 'text', key: 'heading', label: 'Heading', max: 80 },
        { type: 'list', key: 'blocks', label: 'Blocks', itemLabel: 'Block', max: 4, fields: [
          { type: 'text', key: 'title', label: 'Title', max: 40 },
          { type: 'list', key: 'points', label: 'Points', itemLabel: 'Point', max: 5, fields: [
            { type: 'text', key: 'text', label: 'Point', max: 160 }
          ] }
        ] }
      ] },
      { key: 'cta', title: '7 · Catalogue band', fields: [
        { type: 'text', key: 'heading', label: 'Heading', max: 90 },
        { type: 'textarea', key: 'text', label: 'Text', max: 240 },
        { type: 'text', key: 'button', label: 'Button', max: 30 }
      ] },
      { key: 'contact', title: '8 · Contact strip', help: 'Phone, WhatsApp and address come from Site settings.', fields: [
        { type: 'text', key: 'heading', label: 'Heading', max: 80 }
      ] },
      { key: 'seo', title: 'Search & sharing', fields: seoFields }
    ]
  }
};
