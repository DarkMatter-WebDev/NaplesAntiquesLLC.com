# Compliance Audit

> Audit date: **2026-06-19**. Scope: current Next.js app in `next-app/`,
> public routes, account registration, checkout, contact/evaluation forms,
> newsletter signup, footer, cookies/storage, Supabase-backed data flows, and
> policy pages.

## Summary

The site now has a small-business compliance foundation suitable for the current
Florida-based estate jewelry, antiques, ecommerce, account, auction-guidance, and
future vendor/marketplace direction. The implementation is not a legal opinion
and should be reviewed by the business owner and counsel before relying on it.

## What Exists

- **Privacy-related page:** `/privacy` existed and has been replaced with a
  fuller policy reflecting the current app behavior.
- **Footer links:** shared `SiteFooter` existed and is now updated with Legal
  links on every shared-footer page.
- **Account creation:** `/account/sign-up` uses Supabase Auth and now requires
  one Terms/Privacy acceptance checkbox. Age eligibility is handled through the
  Terms of Service rather than a separate checkbox.
- **Account profiles:** `/account` uses Supabase `profiles` with contact,
  address, and marketing opt-in fields.
- **Checkout:** `/checkout` creates unpaid order requests and inventory holds
  through `/api/checkout/order`; `/payment` remains a disabled placeholder.
- **Contact/evaluation forms:** Netlify Forms power item submission and free
  evaluation flows; product inquiry uses `/api/inquire` and Supabase.
- **Newsletter form:** homepage subscriber CTA posts to `/api/subscribe` and the
  `subscribe_homepage` RPC.
- **Analytics/tracking:** source audit found no Google Analytics, Google Tag
  Manager, Meta Pixel, Microsoft Clarity, Hotjar, or equivalent ad/behavioral
  tracking pixels.
- **Cookies/storage:** Supabase auth cookies, `NEXT_LOCALE`, cart/favorites
  `localStorage`, cookie notice `localStorage`, and normal hosting logs.
- **Auction flow:** `/auctions` is informational/consultative, not a live bidding
  platform.
- **Vendor flow:** no public vendor registration exists.

## What Was Missing and Added

| Item | Prior State | Added | Risk Before |
|------|-------------|-------|-------------|
| Terms of Service | Missing | `/terms` with ecommerce/account/auction/vendor baseline terms | High |
| Cookie Preferences | Missing | `/cookie-preferences` and reset/accept controls | Medium |
| Accessibility Statement | Missing | `/accessibility` with feedback path and improvement commitments | Medium |
| Returns & Refunds | Missing | `/returns-refunds`, linked from footer and checkout | High |
| Shipping Policy | Missing | `/shipping`, linked from footer and checkout | Medium |
| Auction Terms | Missing | `/auction-terms`, linked from footer and `/auctions` | Medium |
| Vendor Terms | Missing | `/vendor-terms` baseline for future vendor flow | Low now, higher before launch |
| Cookie notice | Missing | Essential-cookie/storage notice with Privacy/Preferences links | Medium |
| Account consent | Missing | Single required Terms/Privacy checkbox and Auth metadata | High |
| Durable consent schema | Missing | `supabase/compliance-consent.sql` plus base schema updates for Terms/Privacy timestamps and accepted version | High |
| Form disclosures | Missing/inconsistent | Disclosure + Privacy link under lead, inquiry, checkout, subscriber forms | Medium |
| Marketing unsubscribe | Missing | `/unsubscribe`, `/api/unsubscribe`, SQL RPC and subscriber status fields | High |
| Checkout policy links | Missing | Checkout/payment policy links and disabled-payment warning | High |
| Sitemap coverage | Missing | Added legal/policy routes to sitemap where appropriate | Low |

## Remaining Recommendations

- Owner/counsel should review Privacy, Terms, Returns/Refunds, Shipping, Auction
  Terms, and Vendor Terms before production reliance.
- Run `supabase/compliance-consent.sql` and the updated
  `supabase/homepage-subscribers.sql` changes in the live Supabase project.
- Add unsubscribe links to any future marketing email templates before sending
  campaigns.
- If Google Analytics, Meta Pixel, Clarity, Hotjar, or other non-essential
  tracking is added later, update `/privacy`, `/cookie-preferences`, and the
  cookie UI before enabling it.
- Add a real payment processor before collecting real card data; keep `/payment`
  disabled until then.
- Continue accessibility review on product image alt text, modal focus behavior,
  carousel motion, keyboard navigation, and color contrast as new UI ships.
- Confirm production HTTPS and Supabase Auth redirect URLs in Netlify/Supabase.
