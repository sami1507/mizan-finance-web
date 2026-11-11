/** Public metadata never guesses a deployment domain or exposes URL credentials. */
export function publicSiteOrigin(value = process.env.BETTER_AUTH_URL): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "[::1]" || hostname.startsWith("127.") || hostname === "0.0.0.0") return null;
    return url.origin;
  } catch { return null; }
}

export const privatePageRobots = { index: false, follow: false, nocache: true } as const;
