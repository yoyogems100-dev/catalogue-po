// Where to send someone after they sign in. Middleware puts the page they
// actually asked for in ?next=, and this is the only thing that decides whether
// that value is allowed to be used.
//
// Only a path on this site is accepted. An absolute URL, or a protocol-relative
// "//evil.example" that browsers also treat as absolute, would turn the sign-in
// screen into an open redirect -- a link to yoyogems.co.in that quietly lands
// the buyer somewhere else the moment they log in.
export function safeNext(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  return value;
}
