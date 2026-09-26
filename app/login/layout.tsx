// The admin sign-in page is public but should never appear in search results.
export const metadata = { title: 'Sign in · YOYO GEMS', robots: { index: false, follow: false } };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
