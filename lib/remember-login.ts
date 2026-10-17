// Logins post with fetch and then reload or navigate straight away, which
// gives Chrome no form submission to notice, so it never offered to save the
// password. Handing the pair to the Credential Management API asks Chrome
// (and Edge, and Chrome on Android) to show its "Save password?" prompt,
// stored in the signed-in Google account. Safari and Firefox don't support
// it and fall back to their own form detection from the autocomplete hints.
export async function rememberLogin(id: string, password: string): Promise<void> {
  if (typeof window === 'undefined' || !id || !password) return;
  const Credential = (window as unknown as { PasswordCredential?: new (data: { id: string; password: string }) => Credential }).PasswordCredential;
  if (!Credential || !navigator.credentials?.store) return;
  try {
    // Never let a slow or dismissed prompt hold up the login itself.
    await Promise.race([
      navigator.credentials.store(new Credential({ id, password })),
      new Promise((resolve) => setTimeout(resolve, 1500))
    ]);
  } catch {
    // Saving is a convenience; the login has already succeeded.
  }
}
