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
        { type: 'list', key: 'links', label: 'Popular searches', help: 'Links to filtered category pages, e.g. /products/nano-spinel/nano?colour=green. Leave empty to show the 12 best-photographed filtered pages automatically.', itemLabel: 'Link', max: 20, fields: [
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
          { type: 'text', key: 'value', label: 'Number', max: 12, placeholder: '2,795+' },
          { type: 'text', key: 'label', label: 'Label', max: 40, placeholder: 'satisfied customers' }
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
  },
  about: {
    sections: [
      { key: 'hero', title: '1 · Top of page', fields: [
        { type: 'text', key: 'heading', label: 'Heading', max: 80 },
        { type: 'text', key: 'tagline', label: 'Tagline', max: 120 },
        { type: 'image', key: 'image', label: 'Top image', help: 'Wide photo. Stones or the office, on a dark background.' }
      ] },
      { key: 'story', title: '2 · Story blocks', help: 'Shown one after another, text and image alternating sides. Drag to reorder.', fields: [
        { type: 'list', key: 'blocks', label: 'Blocks', itemLabel: 'Block', max: 8, fields: [
          { type: 'text', key: 'heading', label: 'Heading', max: 100 },
          { type: 'rich', key: 'body', label: 'Text' },
          { type: 'image', key: 'image', label: 'Image (optional)' }
        ] }
      ] },
      { key: 'reach', title: '3 · Across India map', help: 'Animated routes from Jaipur to the regions we supply. Leave the heading empty to hide the map.', fields: [
        { type: 'text', key: 'heading', label: 'Heading', max: 80 },
        { type: 'textarea', key: 'intro', label: 'Intro', max: 240 },
        { type: 'text', key: 'note', label: 'Small print under the list', max: 120 }
      ] },
      { key: 'photos', title: '4 · Photo strip', help: 'Our setup in China and the QC table. Pages without photos skip this strip.', fields: [
        { type: 'text', key: 'heading', label: 'Heading', max: 80 },
        { type: 'list', key: 'items', label: 'Photos', itemLabel: 'Photo', max: 12, fields: [
          { type: 'image', key: 'image', label: 'Photo' },
          { type: 'text', key: 'caption', label: 'Caption', max: 100 }
        ] }
      ] },
      { key: 'numbers', title: '5 · Numbers band', fields: [
        { type: 'list', key: 'items', label: 'Numbers', itemLabel: 'Number', max: 6, fields: [
          { type: 'text', key: 'value', label: 'Number', max: 12 },
          { type: 'text', key: 'label', label: 'Label', max: 40 }
        ] }
      ] },
      { key: 'cta', title: '6 · Closing', fields: [
        { type: 'text', key: 'heading', label: 'Closing line', max: 90 },
        { type: 'text', key: 'primary_label', label: 'Main button', max: 40 },
        { type: 'text', key: 'secondary_label', label: 'WhatsApp button', max: 40 }
      ] },
      { key: 'seo', title: 'Search & sharing', fields: seoFields }
    ]
  },
  quality: {
    sections: [
      { key: 'hero', title: '1 · Top of page', fields: [
        { type: 'text', key: 'heading', label: 'Heading', max: 80 },
        { type: 'textarea', key: 'intro', label: 'Intro', max: 240 },
        { type: 'image', key: 'image', label: 'Main photo', help: 'The checking table works best.' }
      ] },
      { key: 'body', title: '2 · How we check', fields: [
        { type: 'rich', key: 'text', label: 'Text', help: 'Three short paragraphs.' }
      ] },
      { key: 'checks', title: '3 · Checkpoints', fields: [
        { type: 'text', key: 'heading', label: 'Heading', max: 80 },
        { type: 'list', key: 'items', label: 'Checkpoints', itemLabel: 'Checkpoint', max: 6, fields: [
          { type: 'text', key: 'title', label: 'Checkpoint', max: 40 },
          { type: 'textarea', key: 'text', label: 'Explanation', max: 300 }
        ] }
      ] },
      { key: 'photos', title: '4 · Photos', fields: [
        { type: 'list', key: 'items', label: 'Photos', itemLabel: 'Photo', max: 9, fields: [
          { type: 'image', key: 'image', label: 'Photo' },
          { type: 'text', key: 'caption', label: 'Caption', max: 100 }
        ] }
      ] },
      { key: 'cta', title: '5 · Catalogue band', fields: [
        { type: 'text', key: 'heading', label: 'Heading', max: 90 },
        { type: 'textarea', key: 'text', label: 'Text', max: 240 },
        { type: 'text', key: 'button', label: 'Button', max: 30 }
      ] },
      { key: 'seo', title: 'Search & sharing', fields: seoFields }
    ]
  },
  'how-to-order': {
    sections: [
      { key: 'hero', title: '1 · Top of page', fields: [
        { type: 'text', key: 'heading', label: 'Heading', max: 80 },
        { type: 'textarea', key: 'intro', label: 'Intro', max: 240 }
      ] },
      { key: 'steps', title: '2 · Steps', help: 'Numbered automatically. Drag to reorder.', fields: [
        { type: 'list', key: 'items', label: 'Steps', itemLabel: 'Step', max: 7, fields: [
          { type: 'text', key: 'title', label: 'Step', max: 50 },
          { type: 'textarea', key: 'text', label: 'Explanation', max: 300 }
        ] }
      ] },
      { key: 'note', title: '3 · Note under the steps', fields: [
        { type: 'rich', key: 'text', label: 'Text' }
      ] },
      { key: 'cta', title: '4 · Catalogue band', fields: [
        { type: 'text', key: 'heading', label: 'Heading', max: 90 },
        { type: 'textarea', key: 'text', label: 'Text', max: 240 },
        { type: 'text', key: 'button', label: 'Button', max: 30 }
      ] },
      { key: 'seo', title: 'Search & sharing', fields: seoFields }
    ]
  },
  charts: {
    sections: [
      { key: 'hub', title: '1 · Charts page', fields: [
        { type: 'text', key: 'heading', label: 'Heading', max: 80 },
        { type: 'textarea', key: 'intro', label: 'Intro', max: 300 }
      ] },
      { key: 'shapes', title: '2 · Shape chart', help: 'Shapes and their sizes come from the catalogue.', fields: [
        { type: 'text', key: 'title', label: 'Title', max: 60 },
        { type: 'textarea', key: 'intro', label: 'Intro', max: 400 }
      ] },
      { key: 'sizes', title: '3 · Size & MM → carat chart', help: 'Carat weights come from the weights entered under Shapes, and from the Moissanite chart.', fields: [
        { type: 'text', key: 'title', label: 'Title', max: 60 },
        { type: 'textarea', key: 'intro', label: 'Intro', max: 400 },
        { type: 'textarea', key: 'note', label: 'Note under the table', max: 400 }
      ] },
      { key: 'colours', title: '4 · Colour charts', help: 'One page per chart. Swatches are the real stone photos of every colour in the ticked categories.', fields: [
        { type: 'list', key: 'charts', label: 'Colour charts', itemLabel: 'Chart', max: 12, fields: [
          { type: 'text', key: 'title', label: 'Title', max: 60, placeholder: 'CZ Colours' },
          { type: 'text', key: 'slug', label: 'Web address', max: 60, help: 'Lower-case words with dashes, e.g. cz-colours → /charts/cz-colours' },
          { type: 'textarea', key: 'intro', label: 'Intro', max: 400 },
          { type: 'categories', key: 'categories', label: 'Colours from these categories', help: 'Ticking a main category includes all of its sub-categories.' }
        ] }
      ] },
      { key: 'grades', title: '5 · Quality grades page', help: 'Each grade’s own explanation is edited under Website → Grades.', fields: [
        { type: 'text', key: 'title', label: 'Title', max: 80 },
        { type: 'textarea', key: 'intro', label: 'Intro', max: 400 },
        { type: 'text', key: 'body_heading', label: 'Section heading', max: 80 },
        { type: 'rich', key: 'body', label: 'What the letters mean' },
        { type: 'text', key: 'choosing_heading', label: 'Second section heading', max: 80 },
        { type: 'rich', key: 'choosing', label: 'Choosing a grade' }
      ] },
      { key: 'seo', title: 'Search & sharing', fields: seoFields }
    ]
  },
  'request-catalogue': {
    sections: [
      { key: 'hero', title: '1 · Top of page', fields: [
        { type: 'text', key: 'heading', label: 'Heading', max: 80 },
        { type: 'textarea', key: 'intro', label: 'Intro line above the form', max: 300 },
        { type: 'text', key: 'promise', label: 'Line below the form', help: 'Only promise a reply time you can keep.', max: 120 }
      ] },
      { key: 'form', title: '2 · Form', help: 'The five fields are fixed. Categories are listed from Website → Categories.', fields: [
        { type: 'text', key: 'requirement_hint', label: 'Example under "Approx. monthly requirement"', max: 120 },
        { type: 'text', key: 'button', label: 'Button', max: 40 },
        { type: 'text', key: 'privacy', label: 'Small print under the button', max: 200 }
      ] },
      { key: 'thanks', title: '3 · After sending', fields: [
        { type: 'text', key: 'heading', label: 'Heading', max: 80 },
        { type: 'textarea', key: 'text', label: 'Text', max: 300 },
        { type: 'text', key: 'whatsapp_label', label: 'WhatsApp button', max: 40 }
      ] },
      { key: 'seo', title: 'Search & sharing', fields: seoFields }
    ]
  },
  faq: {
    sections: [
      { key: 'hero', title: '1 · Top of page', help: 'The questions themselves are managed under Website → FAQ.', fields: [
        { type: 'text', key: 'heading', label: 'Heading', max: 80 },
        { type: 'textarea', key: 'intro', label: 'Intro', max: 240 }
      ] },
      { key: 'cta', title: '2 · Below the questions', fields: [
        { type: 'text', key: 'heading', label: 'Heading', max: 90 },
        { type: 'textarea', key: 'text', label: 'Text', max: 240 }
      ] },
      { key: 'seo', title: 'Search & sharing', fields: seoFields }
    ]
  },
  contact: {
    sections: [
      { key: 'hero', title: '1 · Top of page', help: 'Phone, WhatsApp, email and address come from Site settings.', fields: [
        { type: 'text', key: 'heading', label: 'Heading', max: 80 },
        { type: 'textarea', key: 'intro', label: 'Intro', max: 300 }
      ] },
      { key: 'visit', title: '2 · Visiting us', fields: [
        { type: 'text', key: 'heading', label: 'Heading', max: 80 },
        { type: 'textarea', key: 'text', label: 'Text', max: 400 },
        { type: 'link', key: 'map_url', label: 'Map link', help: 'Leave blank to search the address on Google Maps.' },
        { type: 'image', key: 'image', label: 'Photo (optional)' }
      ] },
      { key: 'cta', title: '3 · Catalogue band', fields: [
        { type: 'text', key: 'heading', label: 'Heading', max: 90 },
        { type: 'textarea', key: 'text', label: 'Text', max: 240 },
        { type: 'text', key: 'button', label: 'Button', max: 30 }
      ] },
      { key: 'seo', title: 'Search & sharing', fields: seoFields }
    ]
  }
};
