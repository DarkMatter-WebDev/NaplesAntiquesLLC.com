import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { jsonLdHtml } from '@/lib/json-ld';
import { cityLine, mapsUrl, streetLine } from '@/lib/business-location';
import { VISIT_ANCHOR_ID } from '@/lib/home-anchors';
import Image from 'next/image';
import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import { CardGrid, PageContainer, Section } from '@/components/layout/ResponsiveLayout';
import HomeHeroStack from '@/components/home/HomeHeroStack';
import HomeBootSplash from '@/components/home/HomeBootSplash';
import ClayMark from '@/components/ClayMark';
import { AppIcon } from '@/components/AppIcon';
import ShowroomMap from '@/components/ShowroomMap';
import ShowroomHours from '@/components/ShowroomHours';
import CopyAddressButton from '@/components/CopyAddressButton';
import TestimonialsSection from '@/components/home/TestimonialsSection';
import { getHomeCarouselPayload } from '@/lib/home-carousel-server';
import { getHomeBanner } from '@/lib/home-banner-server';
import { resolveHomeBanner } from '@/lib/home-banner';
import type { CarouselItem } from '../../../../carousel/lib/carouselData';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isEs = locale === 'es';
  // Brand first, then the descriptor — see the note on SITE_TITLE in
  // app/layout.tsx for why the trailing-brand form was abandoned here and
  // deliberately kept for interior pages.
  const title = isEs
    ? 'Naples Estate Jewelry - Compramos Joyería, Oro y Plata en Naples, FL'
    : 'Naples Estate Jewelry - Sell Jewelry, Gold & Silver in Naples, FL';

  const description = isEs
    ? 'Compramos oro, joyería, plata, diamantes, monedas y relojes en Naples, FL. Visite nuestro salón o agende una cita — o vamos a usted. Llame al (239) 404-8505.'
    : 'We buy gold, estate jewelry, silver, diamonds, coins, and watches in Naples, FL. Visit our showroom or book an appointment — or we come to you. Call (239) 404-8505.';

  // `brandedTitle` because this title LEADS with the brand rather than trailing
  // it, so the suffix pageMetadata() adds to every other page's og:title would
  // duplicate it here.
  return pageMetadata({ title, description, path: '/', locale, brandedTitle: true });
}

interface Props {
  params: Promise<{ locale: string }>;
}

const HOME_CAROUSEL_FALLBACK: CarouselItem[] = [
  { id: 'h1', imageUrl: '/assets/images/shop/shop-14k-curb-link-bracelet-01.webp',        name: 'Estate bracelet',       priceLabel: null, href: '/shop', status: 'available', bgColor: null },
  { id: 'h2', imageUrl: '/assets/images/shop/shop-14k-byzantine-link-chain-01.webp',       name: 'Byzantine chain',       priceLabel: null, href: '/shop', status: 'available', bgColor: null },
  { id: 'h3', imageUrl: '/assets/images/shop/shop-10k-cuban-chain-01.webp',                name: 'Cuban chain',           priceLabel: null, href: '/shop', status: 'available', bgColor: null },
  { id: 'h4', imageUrl: '/assets/images/shop/shop-10k-hollow-cuban-chain-necklace-01.webp', name: 'Hollow Cuban necklace', priceLabel: null, href: '/shop', status: 'available', bgColor: null },
  { id: 'h5', imageUrl: '/assets/images/shop/shop-10k-monaco-edge-cuban-chain-01.webp',    name: 'Monaco Cuban chain',    priceLabel: null, href: '/shop', status: 'available', bgColor: null },
  { id: 'h6', imageUrl: '/assets/images/shop/shop-14k-curb-link-bracelet-01.webp',         name: 'Gold bracelet',         priceLabel: null, href: '/shop', status: 'available', bgColor: null },
];

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';
  const storeHref = isEs ? '/es/shop' : '/shop';
  const evalHref = isEs ? '/es/free-evaluation' : '/free-evaluation';
  const contactHref = isEs ? '/es/contact' : '/contact';

  const carousel = await getHomeCarouselPayload(HOME_CAROUSEL_FALLBACK);
  // Admin-editable announcement strip; null when switched off or empty.
  const banner = resolveHomeBanner(await getHomeBanner(), isEs);

  // Google prints a site name on its own line above the search result. Without a
  // WebSite entity it falls back to the bare domain — which is why results read
  // "naplesestatejewelry.com" rather than the brand. This is the documented
  // mechanism for that line, and it is separate from the <title>.
  //
  // HOMEPAGE ONLY, per Google's spec: the WebSite entity belongs on the site
  // root, not on every page. The sitewide JewelryStore entity in
  // [locale]/layout.tsx is a different thing and stays where it is.
  //
  // ⚠️ Google re-crawls and re-evaluates this on its own schedule, so expect
  // days-to-weeks before the displayed site name changes. It is not broken if
  // the result looks identical the day after deploying.
  // ⚠️ The brand is "Naples Estate Jewelry" — no "Co" (owner, 2026-08-15). An
  // `alternateName: 'Naples Estate Jewelry Co'` was briefly set here and was
  // removed: nobody uses that form, and Google cross-checks this against the
  // JewelryStore schema, the header wordmark, and the Google Business Profile
  // when choosing a site name. Disagreement among them is a reason it falls back
  // to showing the bare domain, which is the problem this entity exists to fix.
  // Do not reintroduce an alternateName unless the business genuinely trades
  // under a second name. ("Naples Antiques LLC" is the legal entity, not a
  // trading name, and must not go here.)
  const webSiteLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Naples Estate Jewelry',
    url: 'https://naplesestatejewelry.com',
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(webSiteLd) }} />
      <HomeBootSplash />
      <SiteHeader />

      <main className="site-header-offset flex flex-col">

        {/* Hero — scroll-pinned parallax stack: three slideshows hand over in
            sequence, each with its own admin-curated lineup (falling back to
            the first), then the frame breaks free.

            The announcement bar is passed IN as the hero's banner rather than
            sitting above it in page flow (owner, 2026-08-11: it should not
            scroll away until the hero text does). Inside the pinned frame it
            unpins on exactly the same frame as the overlay text, with no second
            release point to keep in sync. It is still deliberately NOT part of
            the fixed header, which is sized by --site-header-height and consumed
            by every page offset and sticky top. */}
        <HomeHeroStack
          locale={locale}
          initialItems={carousel.items}
          initialAltItems={carousel.altItems}
          initialThirdItems={carousel.thirdItems}
          initialSettings={carousel.settings}
          banner={banner && (
            (() => {
              // Admin-editable since 2026-08-25 (copy, link on/off, destination,
              // and a master switch). `banner` is null when it is switched off
              // or has no copy — HomeHeroStack simply renders no strip.
              //
              // Element depends on the LINK toggle: an <a> when it points
              // somewhere, a plain <div> when it does not. A non-link must not
              // be focusable, must not carry an href, and must not show the
              // trailing arrow — the arrow is the affordance that says
              // "tappable", so leaving it on a static strip would lie. The
              // hover/focus styling is scoped to `a.home-announcement` in
              // globals.css for the same reason.
              const inner = (
                <>
                  {banner.fragments.map((item, index) => (
                    <span
                      key={item}
                      // Both items show at EVERY width. The old strip hid its third
                      // item below 780px because three service claims could not fit;
                      // this promo is two fragments, so nothing needs hiding.
                      //
                      // The strip is `nowrap`, so copy length is a real constraint:
                      // ALWAYS re-measure at 320px in BOTH locales when it changes.
                      // Spanish is the binding one, and 320px is the tightest width
                      // (the type clamp caps at 502px, so slack only grows above it).
                      // Measured 2026-08-14: EN 75.7px slack, ES 30.4px of 304px.
                      // ES is down to ~10% headroom — the tightest this strip has
                      // ever run. That measurement is now ENFORCED rather than
                      // remembered: BANNER_SAFE_CHARS / BANNER_MAX_CHARS in
                      // lib/home-banner.ts derive from it, and the admin panel
                      // blocks copy that would overflow.
                      className="home-announcement-item"
                      style={{ color: '#e9c349', fontFamily: 'var(--font-label)' }}
                    >
                      {index > 0 && <span aria-hidden="true" className="home-announcement-separator">·</span>}
                      {index > 0 && <span className="sr-only">. </span>}
                      {item}
                    </span>
                  ))}
                  {/* Outside the mapped list on purpose, so it shows at every width
                      no matter how many fragments the copy has. It is the only cue
                      the strip is tappable — so it renders ONLY when it is. */}
                  {banner.href && <span aria-hidden="true" className="home-announcement-arrow">→</span>}
                </>
              );

              return banner.href ? (
                <Link
                  data-customer-reveal-skip
                  className="home-announcement"
                  href={banner.href}
                  // No aria-label. The old one ("Summer special: schedule a free
                  // evaluation.") read as one clean sentence but did not CONTAIN
                  // the visible text, so axe flagged it under
                  // label-content-name-mismatch — the colon breaks the substring
                  // match, and any punctuation between the fragments would. The
                  // sentence pause now comes from an sr-only ". " emitted with the
                  // visual "·" separator below, which keeps the accessible name
                  // equal to the content and the rule satisfied by construction.
                  style={{ background: '#1a1c1c' }}
                >
                  {inner}
                </Link>
              ) : (
                <div
                  data-customer-reveal-skip
                  className="home-announcement"
                  style={{ background: '#1a1c1c' }}
                >
                  {inner}
                </div>
              );
            })()
          )}
        />

        {/* Pre-hydration hero reveal. Pane A's carousel used to stay at
            opacity 0 until React hydrated and its heroReady gate flipped
            .is-ready — on throttled mobile that hydration wait was ~2.5s of
            pure LCP render delay (the LCP element IS the front card image;
            measured on production 2026-08-23). This script replicates the
            gate's exact semantics — wait for pane A's rendered card images
            (preloader excluded via its aria-hidden wrapper), capped at the
            same 1800ms — but runs at parse time, then stamps `nej-hero-go`
            on <html>, which HomeHero's CSS maps to the SAME fade animation
            as .is-ready. React never manages <html> classes, so hydration
            cannot strip it. Placed AFTER the stack so pane A's <img>s exist
            when it runs (panes B/C mount only post-hydration, so they are
            structurally excluded here and keep their own gates).
            Fonts are deliberately NOT awaited (the React gate still waits on
            them for its own purposes): they only affect the card price
            captions, and font-display handles the swap — waiting on ~87KB of
            fonts would hand back most of the LCP win on slow connections.
            ⚠️ Reverted then RESTORED 2026-08-23 — without it PSI mobile has an
            intermittent ~71 mode (9s hero-image LCP); see HomeHero.tsx. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var d=false;var go=function(){if(d)return;d=true;document.documentElement.classList.add('nej-hero-go')};var t=setTimeout(go,1800);var s=document.querySelector('.home-hero-stack-pane--a .home-carousel-hero');var im=s?[].filter.call(s.querySelectorAll('img'),function(i){return !i.closest('[aria-hidden="true"]')}):[];Promise.all(im.map(function(i){return i.complete?0:new Promise(function(r){i.addEventListener('load',r,{once:true});i.addEventListener('error',r,{once:true})})})).then(function(){clearTimeout(t);go()})})();`,
          }}
        />

        {/* Services strip */}
        <Section
          className="border-t"
          style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)' }}
        >
          <PageContainer max="content">
          <CardGrid className="md:grid-cols-3">
            {[
              {
                // These three card titles are real <h2> elements, so they carry
                // heading weight. "in Naples" was added 2026-08-16: the homepage
                // body mentions Naples 73 times but not ONE heading did, which
                // under-declared the page's own topic. Cheap signal, no cost to
                // the copy. (Card titles wrap freely — unlike the announcement
                // strip above, which is nowrap and length-critical.)
                title: isEs ? 'Compramos Oro en Naples' : 'We Buy Gold in Naples',
                body: isEs
                  ? 'Evaluaciones gratuitas en el acto para todas las piezas de oro.'
                  : 'Free appraisals on all gold jewelry, coins, and bullion — visit us or we come to you.',
                href: evalHref,
                cta: isEs ? 'Evaluación gratuita →' : 'Free evaluation →',
              },
              {
                title: isEs ? 'Vendemos Joyería en Naples' : 'We Sell Estate Jewelry in Naples',
                body: isEs
                  ? 'Cadenas, pulseras, anillos y piezas de diseñador con precios transparentes.'
                  : 'Chains, bracelets, rings, and designer pieces priced at live gold rates.',
                href: storeHref,
                cta: isEs ? 'Ver tienda →' : 'Browse shop →',
              },
              {
                title: isEs ? 'Contacto Directo' : 'Direct Contact',
                body: isEs
                  ? 'Hable con nosotros directamente — sin intermediarios.'
                  : 'Talk directly to us — no middlemen, no automated runaround.',
                href: contactHref,
                cta: isEs ? 'Contáctenos →' : 'Contact us →',
              },
            ].map((item, index) => (
              <div
                key={item.title}
                className="group flex flex-col gap-3 border-b pb-6 md:border-b-0 md:border-l md:pb-0 md:pl-7"
                style={{ borderColor: 'rgba(115, 92, 0, 0.16)' }}
              >
                <div className="transition duration-300 group-hover:-translate-y-0.5">
                  <ClayMark name={index === 0 ? 'goldbar' : index === 1 ? 'ring' : 'phone'} size={88} />
                </div>
                {/* h2, not h3: these three cards are top-level page sections
                    with no parent h2 above them, so h3 skipped a level and left
                    the outline implying a section that does not exist. Size is
                    carried by text-xl, so the change is semantic only. */}
                <h2
                  className="text-xl font-bold leading-tight"
                  style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
                >
                  {item.title}
                </h2>
                <p className="text-sm leading-relaxed flex-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {item.body}
                </p>
                <Link
                  href={item.href}
                  className="hover-underline-grow w-fit text-xs font-bold uppercase tracking-[0.16em]"
                  style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
                >
                  {item.cta}
                </Link>
              </div>
            ))}
          </CardGrid>
          </PageContainer>
        </Section>

        {/* Meet the owner — the founder story block (2026-08-04, from the
            mels-treasures.com review). Facts only: 15+ years, Naples-born,
            mobile appointment model. */}
        <Section className="border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
          <PageContainer max="content">
            <div className="grid items-center gap-10 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--color-outline-variant)' }}>
                <Image
                  src="/assets/images/pages/chris.webp"
                  alt={isEs ? 'Chris, propietario de Naples Estate Jewelry' : 'Chris, owner of Naples Estate Jewelry'}
                  fill
                  sizes="(max-width: 768px) 90vw, 40vw"
                  className="object-cover"
                />
              </div>
              <div>
                <p
                  className="text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3"
                  style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
                >
                  {isEs ? 'Conozca al Propietario' : 'Meet the Owner'}
                </p>
                <h2
                  className="responsive-title-lg font-bold mb-5 tracking-tight"
                  style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
                >
                  Chris
                </h2>
                <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {isEs
                    ? 'Nacido y criado en Naples, Chris lleva más de 15 años comprando y vendiendo joyería fina de patrimonio en el suroeste de Florida. Sin intermediarios: véalo en nuestro salón de Naples o pida una cita privada en su casa, y cada pieza de la tienda fue seleccionada y verificada personalmente.'
                    : 'Born and raised in Naples, Chris has spent 15+ years buying and selling fine estate jewelry across Southwest Florida. No middlemen — see him at our Naples showroom, or book a private appointment at your home, and every piece in the shop was personally selected and verified.'}
                </p>
                <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {isEs
                    ? 'Ya sea que venda el patrimonio de una familia o busque una cadena de oro macizo a precio justo, trata directamente con la persona que responde el teléfono.'
                    : "Whether you're selling a family estate or hunting for a solid-gold chain at an honest price, you deal directly with the person who answers the phone."}
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link
                    href={isEs ? '/es/about' : '/about'}
                    className="hover-underline-grow text-xs font-bold uppercase tracking-[0.16em]"
                    style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
                  >
                    {isEs ? 'Conozca más →' : 'Learn more →'}
                  </Link>
                  <a
                    href="tel:2394048505"
                    className="hover-underline-grow text-xs font-bold uppercase tracking-[0.16em]"
                    style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
                  >
                    {isEs ? 'Llame o envíe un mensaje →' : 'Call or text Chris →'}
                  </a>
                </div>
              </div>
            </div>
          </PageContainer>
        </Section>

        {/* Why buy estate gold — education block */}
        <Section
          className="border-t text-center"
          style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)' }}
        >
          <PageContainer max="narrow">
            <p
              className="text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
            >
              {isEs ? '¿Por Qué Patrimonio?' : 'Why Estate?'}
            </p>
            <h2
              className="responsive-title-lg font-bold mb-6 tracking-tight"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
            >
              {isEs ? '¿Por Qué Comprar Oro de Patrimonio?' : 'Why Buy Estate Gold?'}
            </h2>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>
              {isEs
                ? 'El oro antiguo tiene algo especial: décadas de uso crean una calidez y un carácter que no se pueden fabricar. Cada pieza de nuestra tienda es única — rescatada de la fundición, verificada a mano y con una historia propia.'
                : "There's something special about old gold: decades of wear create a warmth and character that simply can't be manufactured. Every piece in our shop is one of a kind — rescued from the melting pot, verified by hand, and carrying a story of its own."}
            </p>
            <p className="text-sm leading-relaxed mb-8" style={{ color: 'var(--color-on-surface-variant)' }}>
              {isEs
                ? 'Y como nuestros precios están ligados al mercado spot en vivo, paga un precio transparente cercano al valor del metal — no un margen de boutique.'
                : "And because our prices are linked to the live spot market, you pay a transparent price close to the metal's value — not a boutique markup."}
            </p>
            <Link
              href={storeHref}
              className="hover-underline-grow text-xs font-bold uppercase tracking-[0.16em]"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
            >
              {isEs ? 'Ver la colección →' : 'Browse the collection →'}
            </Link>
          </PageContainer>
        </Section>

        {/* Top FAQs — native details accordions; every answer restates live
            policy only, and the full list lives at /faq */}
        <Section className="border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
          <PageContainer max="narrow">
            <p
              className="text-center text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
            >
              {isEs ? 'Preguntas Frecuentes' : 'Frequently Asked'}
            </p>
            <h2
              className="text-center responsive-title-lg font-bold mb-10 tracking-tight"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
            >
              {isEs ? 'Antes de Comprar o Vender' : 'Before You Buy or Sell'}
            </h2>
            <div className="flex flex-col">
              {(isEs
                ? [
                    { q: '¿Compran joyería además de venderla?', a: 'Sí — comprar es la mitad del negocio. Evaluaciones gratuitas y privadas para oro, plata, diamantes, relojes y patrimonios completos, en nuestro salón de Naples o en su casa en todo el suroeste de Florida.' },
                    { q: '¿Cómo funciona el envío?', a: 'Cada pedido enviado viaja totalmente asegurado con confirmación de firma, y los pedidos de $5,000+ se envían por USPS Registered Mail. Las tarifas según el valor se muestran al pagar.' },
                    { q: '¿Puedo ver una pieza en persona?', a: 'Sí — visite nuestro salón en 6240 Shirley St, Ste 104, dentro de Sharon Lynch Collections, durante el horario del salón o con cita (el horario actual aparece arriba y en nuestra página de contacto). La recogida local es gratuita: elija Recogida local al pagar o llame para coordinar.' },
                    { q: '¿Cómo fijan sus precios?', a: 'La mayoría de las piezas se calculan directamente contra el mercado de metales en vivo, con el valor de rescate junto al precio; algunas tienen un precio fijo. En ambos casos, lo que ve es transparente — no un margen arbitrario.' },
                  ]
                : [
                    { q: 'Do you buy jewelry as well as sell it?', a: 'Yes — buying is half the business. Free, private appraisals for gold, silver, diamonds, watches, and full estates, at our Naples showroom or at your home across Southwest Florida.' },
                    { q: 'How does shipping work?', a: 'Every shipped order travels fully insured with signature confirmation, and orders of $5,000+ ship USPS Registered Mail. Value-based rates are shown at checkout.' },
                    { q: 'Can I see a piece in person?', a: 'Yes — visit our Naples showroom at 6240 Shirley St, Ste 104, inside Sharon Lynch Collections, during showroom hours or by appointment (current hours are listed just above and on our contact page). Local pickup is free: choose Local Pickup at checkout, or call to arrange a viewing.' },
                    { q: 'How are your prices set?', a: 'Most pieces are priced directly against the live metals market, with the scrap value shown right beside the price; some carry a set price instead. Either way, what you see is transparent — not an arbitrary markup.' },
                  ]
              ).map((faq) => (
                <details key={faq.q} className="home-faq-accordion">
                  <summary>
                    <span className="text-sm font-bold" style={{ color: 'var(--color-on-surface)', fontFamily: 'var(--font-headline)' }}>
                      {faq.q}
                    </span>
                    <span aria-hidden="true" className="home-faq-chevron" style={{ color: 'var(--color-primary)' }}>▾</span>
                  </summary>
                  <p className="pb-4 pr-6 text-sm leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
            <p className="mt-8 text-center">
              <Link
                href={isEs ? '/es/faq' : '/faq'}
                className="hover-underline-grow text-xs font-bold uppercase tracking-[0.16em]"
                style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
              >
                {isEs ? 'Ver todas las preguntas →' : 'View all FAQs →'}
              </Link>
            </p>
          </PageContainer>
          <style>{`
            .home-faq-accordion {
              border-bottom: 1px solid var(--color-outline-variant);
            }
            .home-faq-accordion:first-of-type {
              border-top: 1px solid var(--color-outline-variant);
            }
            .home-faq-accordion > summary {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 1rem;
              padding: 1rem 0.15rem;
              cursor: pointer;
              list-style: none;
            }
            .home-faq-accordion > summary::-webkit-details-marker {
              display: none;
            }
            .home-faq-chevron {
              flex-shrink: 0;
              transition: transform 200ms ease;
            }
            .home-faq-accordion[open] .home-faq-chevron {
              transform: rotate(180deg);
            }
            @media (prefers-reduced-motion: reduce) {
              .home-faq-chevron {
                transition: none;
              }
            }
          `}</style>
        </Section>

        {/* Testimonials — real Google reviews (verbatim), shared with product
            pages via src/lib/testimonials.ts */}
        <TestimonialsSection locale={locale} variant="marquee" />

        {/* CTA — also the hero's "Visit Us" destination.
            ⚠️ `scroll-margin-top` is not optional: the header is fixed, so
            without it the anchor lands with the eyebrow and part of the phone
            number underneath the header. It reads the header-height TOKEN, never
            a hardcoded 56/72px, because that token changes at the md breakpoint. */}
        <Section
          id={VISIT_ANCHOR_ID}
          className="border-t"
          style={{
            borderColor: 'var(--color-outline-variant)',
            scrollMarginTop: 'var(--site-header-height)',
          }}
        >
          <PageContainer max="content">
          {/* Two columns: the details you act on, beside the map that
              orients you. It was a single narrow centred stack until
              2026-08-23 — phone number, sentence, address, two hours rows and
              a square map, all down one axis, which is why the hours were
              grouped into two lossy rows: seven would have pushed the map off
              the fold. The second column is what pays for the full week.

              ⚠️ This section is `max="content"` where the block before it runs
              narrower. That is deliberate — the width IS the feature here. */}
          <div className="grid gap-12 lg:grid-cols-2 lg:items-start lg:gap-16">

            {/* LEFT — what a visitor acts on, in the order they need it:
                where, when, what to expect, then how to start. */}
            <div>
              <p
                className="flex items-center gap-3 text-[0.65rem] font-bold uppercase tracking-[0.32em]"
                style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
              >
                {/* Rule then label. Decorative, so it is hidden from the
                    accessibility tree rather than read as stray punctuation. */}
                <span aria-hidden="true" className="inline-block h-px w-8 flex-shrink-0" style={{ background: 'var(--color-primary)' }} />
                {isEs ? 'Visítenos' : 'Visit Us'}
              </p>

              {/* ⚠️ A real <h2>. The old block opened on a styled <p> and a
                  phone-number <a>, so this section contributed no heading to the
                  page outline at all. */}
              <h2
                className="responsive-title-lg mt-4 font-bold tracking-tight"
                style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)', lineHeight: 1.06 }}
              >
                {isEs ? 'Venga a Vernos' : 'Come See Us'}
                <span className="block" style={{ color: 'var(--color-primary)' }}>
                  {isEs ? 'Hoy.' : 'Today.'}
                </span>
              </h2>

              {/* The address leads now, where the phone number used to.
                  ⚠️ This REVERSES the rule that stood here until 2026-08-23
                  (the details "must not out-weigh the phone number this section
                  exists to show"), on the owner's call: there is a storefront to
                  walk into, and the phone keeps a full-size button below. Do not
                  restore the old hierarchy without asking — it is a decision,
                  not drift.

                  ⚠️ The copy button is a SIBLING of the maps link, never
                  inside it: a <button> nested in an <a> is invalid HTML, and
                  browsers resolve it by breaking one of the two. */}
              <div className="mt-8 flex items-start gap-2">
                <a
                  href={mapsUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover-underline-grow text-[1.35rem] font-bold leading-tight sm:text-2xl"
                  style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
                >
                  {streetLine()}
                </a>
                <CopyAddressButton locale={locale} />
              </div>
              {/* City only. The shared-suite landmark was removed here on
                  2026-08-23 at the owner's request — it is not part of the
                  postal address, and he does not want it on this block. */}
              <p className="mt-2 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                {cityLine()}
              </p>

              {/* All seven days now — see the note above on why the grouped
                  pair existed. `highlightToday` marks the current day AFTER
                  mount, in the showroom's timezone; it stays off everywhere
                  else so the footer's copy remains a server component. */}
              <ShowroomHours
                locale={locale}
                layout="rows"
                highlightToday
                className="mt-8"
              />

              {/* ⚠️ Every one of these must be TRUE and traceable to something
                  the site already says. "Free parking" is deliberately absent:
                  it is true, but the owner's call is that it is assumed in this
                  area and not worth a slot. Do not pad this row to fill it. */}
              <ul
                className="mt-8 flex flex-wrap gap-x-6 gap-y-2.5 border-t pt-6"
                style={{ borderColor: 'var(--color-outline-variant)' }}
              >
                {(isEs
                  ? ['Sin cita previa', 'Citas privadas', 'Recogida local gratis', 'Visitas a domicilio a pedido']
                  : ['Walk-Ins Welcome', 'Private Appointments', 'Free Local Pickup', 'Home Visits on Request']
                ).map((feature) => (
                  <li
                    key={feature}
                    className="text-[0.62rem] font-bold uppercase tracking-[0.16em]"
                    style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
                  >
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-wrap gap-3">
                <a href={mapsUrl()} target="_blank" rel="noopener noreferrer" className="gold-button">
                  {isEs ? 'Cómo Llegar' : 'Get Directions'}
                </a>
                {/* The phone keeps its own tap target rather than becoming body
                    text — it is still the action most visitors take. */}
                <a href="tel:2394048505" className="dark-button">
                  <AppIcon name="call" />
                  (239) 404-8505
                </a>
              </div>

              <p className="mt-5 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                {isEs ? 'O escríbanos a ' : 'Or email us at '}
                <a
                  href="mailto:info@naplesestatejewelry.com"
                  className="hover-underline-grow"
                  style={{ color: 'var(--color-primary)' }}
                >
                  info@naplesestatejewelry.com
                </a>
              </p>
            </div>

            {/* RIGHT — orientation, then the map. */}
            <div>
              <p className="responsive-copy" style={{ color: 'var(--color-on-surface-variant)' }}>
                {isEs
                  ? 'Estamos en Shirley St, justo al norte de Pine Ridge Rd, con estacionamiento en la puerta. Pase durante el horario de atención, o llámenos antes y concertamos una cita privada.'
                  : 'We’re on Shirley St just north of Pine Ridge Rd, with parking right at the door. Walk in during showroom hours, or call ahead and we’ll set a private appointment.'}
              </p>
              {/* Still SQUARE and still lazy — both are recorded decisions. The
                  square replaced a letterbox that showed a corridor of Shirley
                  St with no context north or south of the door, and lazy keeps a
                  heavy third-party frame off the critical path. It only grows to
                  fill the wider column. */}
              <ShowroomMap locale={locale} maxWidth="34rem" className="mt-7" />
            </div>
          </div>
          </PageContainer>
        </Section>

      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
