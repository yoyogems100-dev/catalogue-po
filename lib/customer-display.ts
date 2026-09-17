// The header/account UI needs one label for a customer -- their name when
// they gave one, their company when they only gave that (a solo buyer might
// skip a company name; a buyer signing up as a business might skip a personal
// one). Never both at once: there's no room in the header for it, and the
// existing truncation (see .account-menu-trigger span) already shortens
// whichever one is shown.
export function customerDisplayName(customer: { name?: string | null; company?: string | null } | null | undefined): string | null {
  const name = customer?.name?.trim();
  if (name) return name;
  const company = customer?.company?.trim();
  return company || null;
}
