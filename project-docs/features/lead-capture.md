# Feature: Lead Capture

> Current lead and subscriber capture surfaces. Last updated: **2026-08-10**.

## `/free-evaluation` is the sendable lead surface (2026-08-09/10 rework)

The page is built to be **texted to someone who does not know what they own**,
so its structure is deliberate and should not be casually rearranged:

- The **form is not in the hero.** It lives in a second `#request` block under
  a plain lead-in, because the owner's read was that arriving straight into a
  form "feels like it's shoved down their throat". The hero explains the
  service first and ends in two CTAs (`#request` anchor and the phone number).
- **Photos are optional.** `EvalForm` accepts a submission with either photos
  **or** a one-line description — it only blocks when both are empty. Do not
  make photos required; the whole pitch is "you don't need to sort anything
  first".
- Reachable from the header **Sell** menu (added 2026-08-09) and the footer.

Submissions post to `/api/inquire` with `source: 'free-evaluation'`, same as the
other inquiry forms below.

## Summary

Lead capture now happens inside the Next.js app, not the retired root static
HTML site. The major paths are:

- seller/buyer inquiry forms on contact and evaluation surfaces,
- newsletter/homepage subscriber signup,
- checkout/order follow-up,
- click-to-call and appointment CTAs.

## Inquiry Forms

Current form components:

- `next-app/src/components/contact/ContactForm.tsx`
- `next-app/src/components/contact/InquiryForm.tsx`
- `next-app/src/components/free-evaluation/EvalForm.tsx`

Current inquiry APIs:

- `next-app/src/app/api/inquire/route.ts`
- `next-app/src/app/api/inquiries/[id]/route.ts`

Submitted inquiry records live in Supabase `inquiries`. Admin review lives under
`/admin/inquiries`. Inquiry email delivery uses the Next route handler and
configured email provider keys when present.

The older Jotform and root static Netlify Form instructions are historical.
`next-app/public/netlify-forms.html` remains only as a static form-detection
helper if Netlify Forms compatibility is needed; it is not the primary product
inventory or inquiry source of truth.

## Newsletter / Marketing Audience

Newsletter signup writes to `homepage_subscribers` through `/api/subscribe`.
Admin subscriber management lives at `/admin/subscribers`.

Marketing email uses:

- `next-app/src/lib/marketing.ts` as the shared audience builder.
- `/admin/marketing` for campaign composition and history.
- `/api/admin/marketing/*` for admin-gated sends, tests, settings, audience
  counts, and campaign-history actions.
- `/api/unsubscribe` and `/unsubscribe` for opt-out handling.
- `supabase/email-marketing.sql` and `supabase/homepage-subscribers.sql` for
  live database support.

Current consent model:

- Newsletter subscribers are explicit opt-in.
- Account holders are eligible for marketing by default unless
  `profiles.marketing_opt_out = true`.
- Marketing sends require the configured physical mailing address and include an
  unsubscribe link.

## Checkout / Order Leads

The storefront checkout uses `/api/paypal/create-order` followed by
`/api/paypal/capture-order`. It creates an unpaid internal order before PayPal
approval but does not reserve inventory; the first successful capture marks the
order paid and products sold. Paid capture sends buyer/owner email when Resend
is configured.

The older `/api/checkout/order` unpaid/manual follow-up route is retained for
non-storefront workflows. That path may move products to `pending_payment` and
add an admin notification; it is not the public PayPal checkout path.

## Click-To-Call And CTAs

The primary phone/text CTA remains `(239) 404-8505` via `tel:` links throughout
the app. The owner is mobile and appointment-only; there is no public storefront
address to present as a walk-in destination.

## Privacy / Compliance Notes

- Forms include privacy disclosures and link to the Privacy Policy.
- Account signup records Terms/Privacy acceptance in Supabase Auth metadata,
  with profile persistence supported by `supabase/compliance-consent.sql`.
- Cookie notice/preferences cover essential cookies and local storage; no
  behavioral tracking pixels were found in the 2026-06-19 source audit.

## Verification

After form/API/marketing changes:

```bash
cd next-app
npm run lint
npm run build
```

Then verify at least one public form render and the relevant admin surface.
