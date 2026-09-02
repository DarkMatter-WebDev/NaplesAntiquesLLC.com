import { jsonLdHtml } from '@/lib/json-ld';
import { breadcrumbLd, type Crumb } from '@/lib/breadcrumb-ld';

/**
 * Emits a BreadcrumbList JSON-LD script for the page. Server component; place
 * it once, near the top of the page's returned tree (beside any other JSON-LD
 * script). See `lib/breadcrumb-ld.ts` for the shape and the rules.
 */
export default function BreadcrumbJsonLd({ locale, crumbs }: { locale: string; crumbs: readonly Crumb[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbLd(locale, crumbs)) }} />;
}
