/**
 * Serialize a JSON-LD object for embedding in a <script type="application/ld+json">
 * tag. JSON.stringify does NOT escape '<', so any value containing the sequence
 * "</script>" (e.g. an admin/AI-entered product title or description) would close
 * the script element early and allow arbitrary markup/script to follow. Escaping
 * '<' as the JSON unicode escape < is inert inside JSON-LD but prevents the
 * breakout. This is Next.js's own recommended pattern for inline JSON.
 */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
