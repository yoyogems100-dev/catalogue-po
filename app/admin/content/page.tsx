import Link from 'next/link';

const sections = [
  {title: 'Categories & product photos', href:'/admin/categories', detail:'Add or rename categories, arrange their order, choose covers and manage product photos.'},
  {title: 'Header logo', href:'/admin/brand-upload', detail:'Upload the logo used in the website header. Other designed wordmarks are managed separately.'},
  {title: 'Shapes & sizes', href:'/admin/shapes', detail:'Manage the shapes and sizes available for your catalogue.'},
  {title: 'Colors', href:'/admin/colors', detail:'Manage color names, swatches and reference photos.'},
  {title: 'Specifications & tags', href:'/admin/tags', detail:'Manage the labels used to describe and filter products.'},
  {title: 'Pricing', href:'/admin/pricing', detail:'Manage catalogue prices and pricing settings.'}
];
export default function WebsiteContentPage() {
  return <>
    <h1>Website content</h1>
    <p>Choose what you want to update on your website.</p>
    <div className="admin-work-queues">{sections.map(section => <Link key={section.href} href={section.href} className="card">
      <h2 style={{fontSize:18}}>{section.title}</h2><p>{section.detail}</p><span>Manage →</span>
    </Link>)}</div>
    <p>These controls manage catalogue content and the header logo. Creating new pages or changing page layouts is not available here yet.</p>
  </>;
}
