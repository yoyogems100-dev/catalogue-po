// Trial phase: nobody signs themselves in. "Sign up" sends a request, the
// team sees it on the admin overview, sets a PIN on the customer's page and
// tells them. A request is a customer record carrying this tag; setting the
// PIN (or dismissing the request) removes it.
export const ACCESS_REQUEST_TAG = 'access-requested';

export function withoutAccessRequest(tags: string[] | null | undefined): string[] {
  return (tags || []).filter((t) => t !== ACCESS_REQUEST_TAG);
}
