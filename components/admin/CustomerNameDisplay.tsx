// Shared name+company display, used everywhere a customer shows up in the
// admin UI. A customer profile requires only one of name/company, not both
// (see ProfileCompletionForm), so this always has a sensible single-line
// fallback rather than ever printing an empty bracket or "no company" noise.
export default function CustomerNameDisplay({
  name,
  company,
  fallback = 'No contact name'
}: {
  name?: string | null;
  company?: string | null;
  fallback?: string;
}) {
  if (name && company) {
    return (
      <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.25 }}>
        <span>{name}</span>
        <span style={{ fontSize: 11, color: '#756e5c' }}>{company}</span>
      </span>
    );
  }
  if (name || company) return <span>{name || company}</span>;
  return <span>{fallback}</span>;
}
