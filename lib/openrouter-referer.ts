/**
 * HTTP-Referer for OpenRouter (site attribution).
 * Avoids hardcoding a public deployment URL in the repo; uses Vercel’s runtime host when deployed.
 */
export function openRouterReferer(): string {
  const explicit = process.env.OPENROUTER_HTTP_REFERER?.trim();
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
