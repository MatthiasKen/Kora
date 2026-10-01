export function usesSitesIdentity(appUrl?: string) {
  try {
    const url = new URL(appUrl || "");
    return url.protocol === "https:" && url.hostname.endsWith(".chatgpt.site");
  } catch { return false; }
}
export function emailTestAllowed(input: {
  appUrl?: string; ownerEmail?: string; platformId?: string | null; platformEmail?: string | null; accountEmail?: string | null;
}) {
  const expected = input.ownerEmail?.trim().toLowerCase();
  if (!expected) return false;
  // On Sites, these identity headers are set by the authenticated dispatcher.
  // On another host, ignore them and require a verified Google session instead.
  if (usesSitesIdentity(input.appUrl)) return !!input.platformId && input.platformEmail?.trim().toLowerCase() === expected;
  return input.accountEmail?.trim().toLowerCase() === expected;
}
