import type { ContentSchema, Field } from './schema';

const seoFields: Field[] = [
  { type: 'text', key: 'title', label: 'Search title', max: 70, help: 'Shown in Google and browser tabs. Leave blank to use the page name.' },
  { type: 'textarea', key: 'description', label: 'Search description', max: 170, help: 'One or two sentences shown under the title in Google.' },
  { type: 'image', key: 'image', label: 'Share image', help: 'Shown when the link is shared on WhatsApp or social media.' }
];

/** The 8-block template every category and sub-category page uses. */
export const categorySchema: ContentSchema = {
  sections: [
    { key: 'hero', title: '1 · Hero', fields: [
      { type: 'text', key: 'promise', label: 'One-line promise', max: 120, placeholder: 'Diamond-level fire. Production-level pricing.' },
      { type: 'image', key: 'image', label: 'Hero image', help: 'A stone macro on black works best.' }
    ] },
    { key: 'what', title: '2 · What it is', fields: [
      { type: 'text', key: 'heading', label: 'Heading', placeholder: 'What it is' },
      { type: 'rich', key: 'body', label: 'Text', help: '3–4 plain sentences.' }
    ] },
    { key: 'why', title: '3 · Why it matters for your production', fields: [
      { type: 'text', key: 'heading', label: 'Heading', placeholder: 'Why it matters for your production' },
      { type: 'list', key: 'points', label: 'Buyer benefits', itemLabel: 'Benefit', max: 5, fields: [
        { type: 'text', key: 'text', label: 'Benefit', max: 220 }
      ] }
    ] },
    { key: 'judge', title: '4 · How to judge quality', fields: [
      { type: 'text', key: 'heading', label: 'Heading', placeholder: 'How to judge quality' },
      { type: 'list', key: 'checkpoints', label: 'Checkpoints', itemLabel: 'Checkpoint', max: 6, fields: [
        { type: 'text', key: 'title', label: 'Checkpoint', max: 60, placeholder: 'Colour' },
        { type: 'textarea', key: 'body', label: 'Explanation', max: 500 }
      ] }
    ] },
    { key: 'range', title: '5 · Our range', fields: [
      { type: 'text', key: 'heading', label: 'Heading', placeholder: 'Our range' },
      { type: 'rich', key: 'body', label: 'Text', help: 'Sub-types, grades, sizes. The shape grid below is filled automatically from the catalogue.' },
      { type: 'toggle', key: 'show_shapes', label: 'Show the shape grid' }
    ] },
    { key: 'charts', title: '6 · Charts', fields: [
      { type: 'text', key: 'heading', label: 'Heading', placeholder: 'Charts' },
      { type: 'toggle', key: 'show_colours', label: 'Show the colour chart' },
      { type: 'toggle', key: 'show_sizes', label: 'Show the shape & size chart' },
      { type: 'textarea', key: 'note', label: 'Note under the charts', max: 400 }
    ] },
    { key: 'stock', title: '7 · Ready stock & custom', fields: [
      { type: 'text', key: 'heading', label: 'Heading', placeholder: 'Ready stock & custom orders' },
      { type: 'text', key: 'moq', label: 'Minimum order', max: 160 },
      { type: 'text', key: 'lead_time', label: 'Lead time', max: 160 },
      { type: 'text', key: 'calibration', label: 'Calibration', max: 200 },
      { type: 'textarea', key: 'custom', label: 'Custom & bulk orders', max: 500 }
    ] },
    { key: 'cta', title: '8 · Request catalogue', fields: [
      { type: 'text', key: 'heading', label: 'Heading', placeholder: 'Request the full catalogue' },
      { type: 'textarea', key: 'text', label: 'Text', max: 300 }
    ] },
    { key: 'seo', title: 'Search & sharing', fields: seoFields }
  ]
};

export const gradeSchema: ContentSchema = {
  sections: [
    { key: 'main', title: 'Grade', fields: [
      { type: 'text', key: 'summary', label: 'One-line summary', max: 160 },
      { type: 'rich', key: 'description', label: 'Full explanation' }
    ] }
  ]
};

export { seoFields };
