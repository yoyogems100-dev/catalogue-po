import { redirect } from 'next/navigation';

// "Most ordered" is now one of the shelves on the Home page sections page.
export default function MostOrderedPage() {
  redirect('/admin/content/home-sections');
}
