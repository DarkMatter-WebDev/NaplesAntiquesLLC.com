# Current Status

> Present-state snapshot for session startup. Historical implementation detail
> lives in `CHANGELOG.md`; open work lives in `TASKS.md`; durable rationale lives
> in `DECISIONS.md`. Last reconciled: **2026-08-23**.

## Start Here (handoff, end of the 2026-08-23 PageSpeed session)

**Read this, then `TASKS.md`.**

### The shape, in one glance

🔴 **ONE UNDEPLOYED BATCH: the PageSpeed/a11y sweep (2026-08-23, later
session). No SQL.** Locally verified end-to-end (1086/1086, lint, tsc, build
456/456, Lighthouse a11y+BP = 100 on the prod build) but NOT yet on production.
What it is, in one line each — full detail in `CHANGELOG.md` 2026-08-23:

- **Cookie banner is now SSR + pre-paint gate** — it was literally the mobile
  LCP element on PSI (render delay 2.4s, mobile perf 80). `CookieNotice.tsx`,
  `[locale]/layout.tsx` (new inline head script), `globals.css`,
  `CookiePreferencesClient.tsx`.
- **Carousel**: preloader spans card-sized (kills the fake 215 KiB
  image-delivery flag + the Best-Practices aspect failure); back/edge-on cards
  get `tabindex=-1`/`aria-hidden` (target-size).
- **Footer links** `py-1.5` on mobile (24px tap targets); **ShowroomHours**
  muted opacity 0.55/0.7 → 0.8 (4.5:1 contrast); announcement/testimonial
  aria-labels reworked (label-content-name-mismatch).
- **`next.config.ts`**: `images.minimumCacheTTL` 1h → 31 days.

**After the owner deploys: re-run PSI on production** (mobile) and confirm the
LCP element is no longer the cookie banner. Expected: a11y 100, BP 100, perf
well up from 80 (exact number depends on their lab calibration).

Everything below this line is the state from the EARLIER 2026-08-23 session
and still holds — the email-validation batch is live, no outstanding SQL from
it:

✅ **The earlier batch: nothing undeployed, no outstanding SQL.** The 2026-08-22 batch shipped and
was verified on production: the inquiry-form bot filter, checkout name+phone
validation with the field reorder, phone validation on the three remaining
contact/lead forms, the transactional email bounce handler, and the
`ContactForm.tsx` dead-code deletion.

✅ **The bounce handler is CONFIRMED LIVE**, not merely deployed — proven by
replaying a real bounce and watching the response body change from
`{"success":true,"ignored":true}` to `{"success":true}`, which is exactly the
old-code/new-code difference.

✅ **Resend endpoint moved `.co` → `.com`** (2026-08-23, owner-requested) and
re-verified after the move.

🟡 **Staging is 3 files behind, deliberately.** `C:\Users\rcman\NEJ-repo-staging`
is otherwise current (868 files / 19.84 MB). The drift is
`CHANGELOG.md`, `CURRENT_STATUS.md` and `TASKS.md` — **docs only, zero runtime
files**, so production is correct as-is. Owner's call to leave it until there is
real code to ship; re-sync then and these ride along.

### ◻ What is actually open

Nothing is blocking, and nothing is waiting on a deploy.

1. ◻ **Two junk rows await a delete decision** — created by a bad verification
   probe (see the trap below). Ids and SQL in `TASKS.md`.
2. ◻ **The hard-bounce path has never run for real.** Every live exercise so far
   was the *soft* path, chosen deliberately because it writes nothing. Its first
   real test will be a genuine permanent bounce; expect an `[email-bounce]` log
   line and a red **Bounced** chip in the admin message center.
3. **Watch the Netlify function log for `[inquiry-spam]`.** Lines = the filter
   working. No lines and no new junk rows = the bot moved on. 🔴 No lines but NEW
   junk rows = it is being evaded, and `TASKS.md` has the playbook.
4. 🟡 **Marketplace clients have no request timeout** (`lib/{ebay,etsy}/client.ts`
   call `fetch()` with no `AbortSignal`, and both retry with 1s/2s/4s backoff).
   Latent, not urgent — it only strands background work today. It is also the
   specific reason awaiting a marketplace call in a buyer-facing route is unsafe.
   ⚠️ Not a drive-by fix: it touches every call site, including legitimately slow
   ones like Etsy image upload.
5. 🟡 **`ebay_sync_log` is ~97% eBay `account_deletion` webhook noise**
   (75k+ rows, ~3,000/day, pruned only at 90 days). Makes the real sync history
   hard to read. Not causing failures.
6. **A real website sale still has not exercised the auto-delist hook** since the
   fix. Nothing to do but wait; the reconcile sweep bounds it to ~30 min.
7. Older, unchanged: Google address verification, re-measure first paint on
   production (baseline 533KB / 30 requests), confirm the first real refund
   records itself, Search Console re-submit, and the phone-only checks never done
   on real hardware.

### 🔴 Staging: the documented robocopy command CHANGED — do not use an older copy

It now excludes `"$src\.claude\worktrees"`. Background agent sessions create git
worktrees there, and **a worktree's `.git` is a FILE**, so `/XD .git` does not
exclude it. The 2026-08-22 dry run wanted **1,122 files** under `.claude` against
**20** real ones — including that `.git`, which would have landed in the repo.
`.gitignore` now covers it too, but **robocopy does not read `.gitignore`** — the
`/XD` entry is what actually protects the copy.

⛔ **"0 Extras" is NOT a sufficient safety check.** Extras only catches junk in the
DESTINATION; it was 0 while 1,122 stray files were queued to flow IN. Read the
file COUNT and sanity-check it against what the session actually changed.

### ✅ Everything from 2026-08-21/22 is live AND verified in production

Not merely shipped: the marketplace price-push timeout fix, the Inventory #82
reattachment, the auto-delist `after()` fix, and the reconcile sweep. Each was
confirmed by an unattended run or a fetched result, never by assumption.

⚠️ The one thing with no production observation is the **auto-delist hook on a
real website sale** — the PayPal capture path has not run since the fix. The
reconcile sweep bounds that exposure to ~30 minutes regardless.

### ⚠️ Traps this session hit, worth not re-learning

- **`after()` is best-effort on Netlify, not a guarantee.** Next lists it as
  requiring graceful-shutdown support, which the Lambda freeze-on-response model
  does not provide. Work still in flight when the response flushes is frozen and
  finishes only if the container is reused. Measured: a log insert landed
  **127.6s late** on a thaw.
- **A "missing" row may just be late.** That 127.6s insert was first reported as
  lost. Check again before diagnosing.
- **Deleting `.next` under a running dev server 500s every route** with
  `ENOENT … build-manifest.json`. That is the deleted build dir, not the code —
  restart rather than debug.
- **A wrapped phrase makes `Select-String` return 0.** Searching staged
  `CURRENT_STATUS.md` for "reconcile sweep" found nothing because the phrase
  breaks across a line. Always pair a zero with a positive control.
- **The GitHub mobile app mislabels run triggers** — it showed a scheduled run as
  "Triggered via pull request". The web UI is authoritative.
- 🔴 **Probing `/api/inquire` or `/api/contact-message` with a PASSING payload
  writes production data.** A verification probe with a valid phone ran the whole
  success path: an inquiry row, an admin notification, an owner email, and a
  confirmation to a non-existent address that then bounced. **Test the REJECTION
  paths** — they return before any insert or email. Same rule for the Resend
  webhook: replay a `Transient` bounce, never a `Permanent` one.
- **`type="tel"` and `type="email"` validate NOTHING.** They hint at a mobile
  keypad. Presence-only checks behind them look adequate for years.
- **`ymail.com` is a REAL Yahoo domain** (`mta5.am0.yahoodns.net`), one character
  from `gmail.com`. Any edit-distance "did you mean?" check would flag a real
  customer's correct address. Verified by MX lookup, not memory.
- **DNS is blocked in the agent sandbox.** `dns.resolveMx` returns `ECONNREFUSED`
  for *everything*, `gmail.com` included — which is the tell. Use
  `new Resolver()` + `setServers(['8.8.8.8','1.1.1.1'])`. The only reason this
  was caught is that a known-good domain was in the same batch: **always include
  a positive control.**
- 🔴 **A single agent worktree adds ~860 files to a wholesale copy**, and its
  `.git` is a **FILE**, so `/XD .git` misses it. See the staging section above.
- ⛔ **Editing the Resend webhook: use "Edit endpoint" ONLY.** "Duplicate
  webhook", "Delete", and "Rotate signing secret" all mint a NEW secret, which
  401s every event until Netlify's `PROVIDER_WEBHOOK_SECRET` is updated to match.
  Confirm the edit was in-place by checking the webhook id and CREATED date are
  unchanged.
- **Python heredocs choke on Windows paths.** A non-raw triple-quoted string
  containing `C:\Users\...` raises `SyntaxError: truncated \UXXXXXXXX escape`.
  Use raw strings. It fails at parse time, so nothing is written — and a literal
  triple-quote inside the string ends it early, which bites when documenting
  this very trap.

### ✅ DEPLOYED — inquiry-form bot filter (the form was an EMAIL RELAY)

(Heading said 🔴 UNDEPLOYED until 2026-08-23; the filter shipped in the
2026-08-22 batch and is confirmed live — the narrative below is the design
record.)

A bot used the product-inquiry form to make Resend send confirmation mail **to
strangers** from `noreply@naplesestatejewelry.com` — 10 submissions in 18 hours
on 2026-08-22, one victim address hit twice. `.com` is the only verified Resend
sender, so this put order receipts and marketing at risk too.

**Root cause:** the `bot-field` honeypot was checked server-side but
`InquiryForm.tsx` never rendered it. It is the only one of the three inquiry
forms that was spammed — a perfect correlation.

**Fixed (undeployed):** honeypot added to that form; new `lib/spam-heuristics.ts`
catches generated names even when a bot POSTs JSON directly; drops are logged as
`[inquiry-spam]` rather than vanishing silently.

⚠️ **The threshold is measured, not guessed** — human max 5, spam min 7, so 6.
A first attempt at 4 would have silently discarded a real customer named
`VanDerBeek`. A false positive here is a lost customer; the constant is pinned
by tests from both directions.

✅ **Both owner decisions are settled (2026-08-22): leave the 10 spam rows, and
leave the confirmation email as-is — react if abuse recurs.** The rows are also
the labelled sample the heuristic was derived from and are referenced by name in
`spam-heuristics.test.ts`, so do not tidy them away.

⚠️ **Accepted residual risk, recorded so nobody re-discovers it in a panic:**
`sendEmails` still sends to whatever address is submitted. A next bot using
plausible two-word names walks past the name heuristic. `TASKS.md` carries the
if-it-recurs playbook — and its first rule is **re-measure before changing any
constant**.

### ✅ DEPLOYED AND CONFIRMED — the auto-delist hook was dropping ~1 sale in 20

Root-caused 2026-08-21. The marketplace auto-delist hook was launched as a bare
floating promise at six call sites, and Netlify freezes the container once the
response flushes — killing the eBay/Etsy call mid-flight. **39 of 41** sold
products delisted correctly; 2 did not, and stayed live and buyable.

⛔ **The hook did not fail, it was killed.** It logs an error row for any throw
(proven — it did so on 2026-07-29). The misses left **no row of any kind** and no
partial write. Silence meant termination.

Fixed with `after()` via new `lib/product-status-hooks.ts` (+ `allSettled`, +
real logging), plus a second hole where `adminRevalidateProduct` sat after the
video-commit early return in `AdminShell.tsx`. `queueDeepFieldSync` deleted.

⚠️ **The dangerous path was PayPal checkout, not admin.** Both misses were items
that had sold on eBay, so the marketplace zeroed its own quantity and covered for
us. A website sale has no such safety net.

✅ **Confirmed on production** (`main@e81f9f9`). Both previously-stale products
were run through the hook and are now `hidden_oos` qty 0 on eBay and
`delisted`/`inactive` on Etsy, with the log rows to match. `after()` proven live:
the Netlify function log shows `[deepfield] synced 1 product(s)` emitted from
inside the callback, where that work used to be killed.

⛔ **Never re-fire hooks via the "mark sold" quick action on an already-sold
item** — it recomputes and overwrites `sold_price` from current spot. Use a
no-change save in the edit modal.

🔴 **`after()` is an improvement, NOT a guarantee here — read this before
trusting the fix.** The `hide_oos` row first reported missing was not missing: it
landed **127.6s late**, when the frozen Lambda thawed on the next request. Two
sequential awaits cannot be 128s apart unless the process stops between them, and
clock skew is ruled out (the Monaco's identical pair is 0.469s).

Next's docs list `after()` as requiring **graceful shutdown support**; Netlify
freezes on response instead of draining. Work that finishes inside the response
window now lands reliably (Etsy, Deep Field); slower work (eBay, which adds a
token round-trip) still freezes and completes only if the container is reused.

⛔ This also sharpens the original diagnosis: the work was never *killed*, it was
*frozen* — lost only when the container was reclaimed before reuse. That is why
it was 39/41, not 0/41.

✅ **DEPLOYED AND CONFIRMED 2026-08-22 — the status-drift reconcile sweep is
live.** Run #153 ran both jobs green in 6s with all five other jobs skipped, and
wrote `124 scanned, 0 drifted` (eBay) / `128 scanned, 0 drifted` (Etsy).
✅ **Firing unattended** — 18 runs per channel overnight, all `ok` / `0 drifted`,
gaps 18–56 min (GitHub's best-effort spread, not a fault). **Every 30 minutes** it asks "is anything sold still live right now?"
and repairs what it finds — catching a missed delist regardless of cause (freeze, API error,
or an unhooked status path). `reconcile{Ebay,Etsy}StatusDrift()` +
`/api/admin/{ebay,etsy}/reconcile-status`, on the existing GitHub Actions
workflow, using each channel's existing cron secret.

Verified against production: read-only dry run found **0 drift on 124 eBay + 128
Etsy listings** (the negative result that proves it will not delist healthy
stock), then a real run completed in **1131ms / 781ms** and wrote its audit rows.

⛔ **Deliberately NOT awaiting the hook in the PayPal capture path.** The
payment is already captured before that line runs, so a hang there would turn a
successful payment into an error page. Neither marketplace client has a request
timeout and both retry with 1s/2s/4s backoff, against a ~26–30s gateway ceiling.
The sweep bounds the exposure from outside instead, with no buyer-facing risk.
Full reasoning: `CHANGELOG.md` 2026-08-21 (5); the standing decision is in
`TASKS.md`.

⚠️ **Static page count is now 456, not 454** — the two new API routes. That
number is a structural invariant in STRUCTURE.md; this is the new baseline.

Do not read a missing log row as a failed delist, or a present one as proof it
was timely; `sync_state` and `last_pushed_qty` are the operative state.

📱 **A real website sale still has not exercised this path** — the confirmation
ran through the admin route, not PayPal checkout.

### ✅ Inventory #82 is repaired ON PRODUCTION — the write-block list is now EMPTY

Done and verified 2026-08-21, owner-approved. The mug's live listing was an
external relist attached to **no** Inventory-API offer, so the daily push could
not reach it — it sat 17 days at **$928.69** when it should have been
**$1,068.35** (15% under), with a buyer holding it in their cart.

Repaired by end-and-republish: relist `800354878200` ended, offer
`204558136011` published as **`800547117368`** at $1,068.35 through the app's own
`runSyncStep`. `isEbayWriteBlocked` → false, planner reports **0 blocked**
(was 1), and the eBay-side price matches `last_pushed_price` exactly.

⛔ **The rule that came out of it:** never lift a write-block to fix an
unreachable listing — the push then writes to the orphaned offer, *succeeds*,
and the dashboard reads clean while the live price keeps drifting. DECISIONS,
*"A listing the Inventory API cannot reach must be republished, not unblocked"*.

⚠️ Shipping moved $15 → $59 on republish. Correct: that is the current tier for
its price band, and the old fee was a pre-tier leftover.

### ✅ Full eBay reconciliation: 84 of 87 healthy, 0 price drift

Every live listing was compared against eBay (one `getOffer` each). **84 exact
matches** — published offer, ACTIVE listing, eBay price equal to
`last_pushed_price`. Zero price drift, zero listing-id drift, zero API errors.
The other three were the mug (now fixed) and two sold items.

🟡 **Two sold products carry stale local state on BOTH channels** — verified not
purchasable on either, so no double-sale exposure, but **the auto-delist hook
logged nothing after either sale**. It has worked before. Worth understanding
before a future sale leaves something genuinely buyable. See `TASKS.md`.

### ✅ VERIFIED IN PRODUCTION — the price-push timeout fix

**Shipped in `main@e81f9f9`** alongside the auto-delist fix and the write-block
removal — one deploy carried all three. **No outstanding SQL.** Staging is stale
as of this session and must be rebuilt before the next batch.

✅ **Verified 2026-08-22 on the first unattended run.** eBay **success in 2s**
(`0 pushed, 85 unchanged, 0 blocked, 0 failed, 0 deferred`) where run #142 was
**38s and a 504**. Etsy **success in 14s** (`32 pushed, 0 deferred`) with its 32
item writes in **2.14s** against 20.9s for 41 items before — **per item 522ms →
67ms**. `0 deferred` on both channels, `0 blocked` on eBay, and **0 failed
workflow runs since #143**.

`ebay-price-push` failed on 2026-08-21 (run #142, 504 `Inactivity Timeout` after
32s) **having already pushed all 50 prices successfully** — the gateway hung up
a fraction of a second before the handler returned. Etsy carried the identical
defect and had been silently deferring **15–18 listings a day** since 2026-08-20
without ever going red.

Two causes, both fixed in `lib/{ebay,etsy}/{sync,store}.ts`:

1. **Bookkeeping was per-listing** — two awaited Supabase round-trips each.
   Measured: 100 round-trips at ~157ms = **15.7s of a 22.2s run**. The
   marketplace APIs were never the cost. Now batched.
2. **The budget could not bound the request** — it was measured from inside the
   push loop, so ~10s of setup fell outside it. Now an absolute `deadlineAt`
   stamped on entry, at 20s.

**Gate, from a deleted `.next`:** `tsc` clean · `lint` clean · **1033/1033
across 101 files** · build **454/454 pages**. The four new tests were
**mutation-tested** — reintroducing either bug fails them.

⛔ **A red scheduled job does not mean the work failed.** Read the
`scheduled_price_push` summary row in the sync log first. That row is what
proved the prices had landed.

🔴 **Still unexplained: ~5–7s of the ≥9.7s of setup.** Cold start, spot fetch
and the three Supabase reads only account for ~3s. Recorded rather than guessed
at; the fix does not depend on it.

✅ **Cold start is NOT the explanation, for these routes or the drip.** The
unauthenticated 401 path on production returns in **0.23–0.67s** across 5
attempts. This kills the unproven `sharp`/`next/og` cold-start theory carried
over from the 2026-08-20 `facebook-drip` investigation — **do not re-raise it.**

🟡 **`facebook-drip` (run #124) remains a WATCH, not a fix.** Still unexplained,
still one failure in 125 runs. **Do not do more surgery on it.**

### ✅ THE REST IS DEPLOYED AND VERIFIED.

Both 2026-08-19 — the checkout sign-in/guest gate and the review reconciliation — shipped
and were confirmed on production by fetching it. Staging mirrors the source.

### ✅ Google reviews reconciled — DEPLOYED 2026-08-19, `TESTIMONIALS` 13 → 16

Five reviews were missing (not the four the old note claimed — its arithmetic
never worked: 16 − 13 = 3). The earlier count came from a Maps feed that stopped
paginating after ten cards, so the tail was never seen. Five were added and
three stale entries reconciled away, landing on 16 — a 1:1 match with the live
profile.

⚠️ **The deploy looked like it "didn't land"; it had. Browser cache.** Before
re-deploying or re-syncing staging on that symptom, spend ten seconds proving it
from outside the browser — neither of those fixes a client-side cache:

```bash
curl -s "https://naplesestatejewelry.com/" | grep -c "Nolan Olivier"
```

⚠️ **Mayelin Pérez wrote in Spanish, and her entry inverts the verbatim pair** —
`quoteEs` is her original, `quote` is our translation. Google's card shows a
machine translation by default; the original sits behind *"See original
(Spanish)"*. Publishing the visible text would have attributed Google
Translate's words to a named customer.

✅ **The list is now RECONCILED against the profile — 16, matching 1:1.** Three
entries did not reconcile, and the owner explained why: **he accidentally
deleted his original Business Profile and rebuilt it.** Those reviews were real
and his, and did not survive. **Nolan Olivier** and **Onur** are removed;
**Yisel Perez** re-reviewed on the new profile, so her quote was replaced with
her current words rather than dropping her.

⛔ **Standing rule, now in the file header: every entry must still exist on the
live profile**, because each card renders a "Read on Google" link. Genuine but
unverifiable is, on a page that invites verification, the same problem as
invented. Reconcile the list against the profile — drop what has vanished,
refresh what has changed — rather than only appending.

⚠️ *Naples Jewelry Buyers* (the 5.0/33 Google profile) is **not the owner's** —
the name is coincidence. An earlier guess in this session said otherwise; it was
wrong.

### ✅ The checkout sign-in/guest gate — DEPLOYED 2026-08-19, owner-confirmed

**Owner report, from a phone:** proceeding to checkout signed out asked
"log in or continue as guest" **twice**, and the second prompt sat out of the
viewport so he had to scroll to it. Two separate defects, both confirmed:

1. **The double prompt was never mobile-only** — reproduced at **899px**. The
   cart drawer routed to `/checkout` without recording the buyer's answer, so
   checkout raised its own gate again. Desktop only *looked* clean because the
   suppressing sessionStorage key survives for the life of a tab.
2. **The second prompt was anchored to the wrong box.** It was
   `position: fixed; inset: 0` but rendered **inside** `.checkout-page`, which
   carries `data-customer-reveal="visible"` — whose transform/filter/will-change
   make it a containing block for fixed descendants. On a 375×812 phone the card
   landed at **top 1114px** inside a **2409px** overlay: below the fold,
   854px of scrolling away.

**Owner picked the four-option screen** (Log In / Create Account / Continue as
Guest / Cancel). The two-option one is **deleted**. New
`components/checkout/CheckoutGate.tsx` is now the single source for that screen
and for the choice; the drawer calls `rememberGuestCheckout()` before routing,
and checkout renders the same gate **outside `.checkout-page`** for buyers who
arrive without passing the drawer.

**Also in this batch:** the `<html>` **hydration warning is fixed** — it had
fired on every page in dev since the 2026-08-18 `--app-vh` work, because the
pre-first-paint script writes the token onto `document.documentElement.style`
while the element carried no `suppressHydrationWarning`. Correct resolution, not
a silencer: React already left the DOM alone, so the token always survived.

**Gate passed from a deleted `.next`:** `tsc` clean · `lint` clean ·
**1024/1024 across 100 files** · build **454/454 static pages** — re-run after
the root-layout change, since the prerender count is a structural invariant.
Browser-verified in both locales — measurements in `CHANGELOG.md` 2026-08-19 (4).

**Confirmed on production after the deploy**, by scanning all 15 JS chunks behind
`/checkout`: **0** `checkout-auth-overlay`, **0** `checkout-auth-card`, **0** of
the old two-option heading — against controls of **1** `checkout-page`, **1**
`How would you like to continue`, and **3** chunks carrying `--app-vh`. All four
of `/`, `/es`, `/checkout`, `/es/checkout` are 200.

⚠️ **Reusable trap worth carrying forward:** any `position: fixed` element placed
inside a `[data-customer-reveal]` subtree is anchored to that subtree, not the
viewport. It fails silently — the element renders, just in the wrong place.

⚠️ **A second trap, hit twice while verifying the above:** a grep that returns 0
proves nothing without a positive control in the same scan. The chunk files
saved with a **double** leading underscore so the glob matched nothing, and the
static `.css` files can never contain styled-jsx rules (those compile into the
JS). Both looked like clean passes.

**What else closed on 2026-08-19:**

| | |
| --- | --- |
| 🔴 **The in-app-browser viewport jump** | root cause found, fixed, owner-confirmed gone, diagnostic removed |
| **Google Business Profile hours** | `Mon–Sat 10–5` → **Sun+Mon closed, Tue–Sat 11:00 AM–3:00 PM**. Applied and live |
| **Google profile Description** | stopped claiming "private, mobile, and appointment-only"; now leads on the showroom. Applied and live |
| **Linda Cusumano's review** | published, minus its stray "Hi baby" line, by explicit owner decision. `TESTIMONIALS` 12 → 13 |
| **Hero text still drifting** | ✅ the first viewport fix stopped at the hero's frame; the offsets INSIDE it were still `svh`. Fixed, plus `.responsive-hero` (71.9px). Deployed and **owner-verified gone** |
| **Every remaining `svh` surface** | ✅ checkout shell (124px), `error`, `not-found`, both account washes, `.site-loading-screen`. Deployed and verified on production. **Nothing is left on `svh`** except transient-overlay max-heights and the token's own fallback, both guard-encoded |

**Verified on production, not assumed:** homepage 200, `<body class="min-h-[var(--app-vh)] flex flex-col">`,
`Linda Cusumano` present, **zero** `Hi baby`, and zero `vpdebug` across all 15 JS
bundles against a positive control of 8 `--app-vh` hits. The Google hours and
description were re-opened in the owner's own profile editor and are **applied,
not pending**.

**Gate at session end, from a deleted `.next`:** `tsc` clean · `lint` clean ·
**1024/1024 across 100 files** · build **454/454 static pages**.

✅ **The viewport work is finished and owner-verified.** Three rounds: the page
shell, then the hero's frame, then everything positioned inside it plus the last
six surfaces. Production carries the token on every one of them, and the guard
rejects a regression.

### 🔴 The one thing that matters most for the next session

**`svh` is not stable in an in-app browser, and that is now a governing rule.**
Measured on the live site inside Instagram: `vh`, `svh` and `dvh` all resolve to
the SAME value there and all three track the chrome (`innerHeight` 729 ↔ 853).
Instagram resizes the WKWebView natively, so WebKit sees a plain window resize
with no small-vs-large viewport to distinguish.

Anything customer-facing that is **positioned or sized to the viewport** must
read **`var(--app-vh)`**, never a viewport unit. ⚠️ It looks like a pointless
indirection around `100svh`, and "simplifying" it back is exactly how this
regresses. `lib/__tests__/viewport-units.test.ts` guards it. Full rationale:
DECISIONS, *"`svh` is NOT stable in an in-app browser"*.

⚠️ **`tsc` and `lint` both PASS on a broken styled-jsx template literal.** A
stray backtick in a comment inside a `<style jsx>` literal ends the string and
500s every route; the type-checker does not see it. The compile check for those
files is a **real build**. This bit twice on 2026-08-19.

⚠️ **That rule said "contributes to document height" for one day and it was too
narrow** — a second bug shipped because the hero's frame was converted but the
text positioned inside it was not, so the text moved alone against a stable
background (owner-reported 2026-08-19, fixed same day). Transient overlay
max-heights — modals, drawers, the boot splash — are the one deliberate
exception and stay on `svh`, because they *should* fit what is visible now.

### 🟡 Two undeployed defensive changes; one unexplained failure

`facebook-drip` failed once (run #124, 2026-08-19) with `curl (56)` after 25s —
Netlify's 26s ceiling. **123 of the 124 runs before it passed.**

✅ The 25s was startup or platform, not handler work: the queue was empty
(owner-confirmed), so the handler does three Supabase calls, and warm the
endpoint answers in **0.2s** — from the route itself, since `/api/*` is outside
the middleware matcher.

🔴 **What consumed the 25s is NOT established.** Two theories were formed and
both overstated: "published more than fit" (impossible — empty queue) and "the
`sharp` + `next/og` import graph makes cold starts expensive" (chain real,
causation unproven). A transient platform stall is not excluded. Detail and the
three failed measurement attempts: `CHANGELOG.md` 2026-08-20.

✅ **Deployed 2026-08-20:** a 20s wall-clock budget on both drip loops, and a
lazy `./images` import. Both correct on their own terms; **neither is a fix for
that failure** and the code comments say so. Gate: `tsc`/`lint` clean,
**1029/1029**, **454/454**.

✅ **Run #125 passed and proves the new code is live** — its `facebook-drip` log
returned `HTTP 200 {"published":0,"skipped":0,"deferred":0,...}`, and `deferred`
exists only in the new code. Step time **1s** against #124's 25s. It also
confirms the empty queue independently.

⚠️ Not proof the budget fixed anything: with zero rows the loop never iterates,
so 1s is the trivial handler on a healthy platform — which supports the
transient reading. The lazy `./images` import shipped later and has not yet had
a scheduled run. **Watch the next few; do not do more surgery on one failure in
125.**

### ◻ What is actually open

Nothing is blocking. In rough priority:

1. 🔴 **Google address verification** — owner going **2026-08-20**. The hours
   and description are already correct, so the profile is in good shape for it.
2. **Re-measure first paint on production** (snippet in `TASKS.md`). Baseline to
   beat: 533KB across 30 requests before FCP. Never done.
3. **Confirm the first real refund records itself** — the fix is proven locally
   against real PayPal refunds but its automatic path has never run in
   production.
4. ✅ **DONE 2026-08-19 — every Google review is on the site and the list is
   reconciled.** `TESTIMONIALS` is **13 → 16**, a 1:1 match with the live
   profile: five added, two removed (lost with the owner's deleted original
   profile), one refreshed.
5. **Search Console**: resubmit the sitemap and Request Indexing on the four
   pages whose titles changed. A nudge, not a repair.
6. 📱 **Phone-only checks** that have never been done on real hardware — listed
   in `TASKS.md`. The in-app-browser one is now moot; the rest are not.

### ⚠️ Three traps this session hit, worth not re-learning

- **A guard test that scans source must strip comments AND normalise newlines.**
  This repo mixes CRLF and LF; in JavaScript `
` is a line terminator, so
  `/(^|[^:])\/\/.*$/` silently fails to match on CRLF files and every `//`
  comment survives. A guard then reports its own rationale as a violation.
- **Tailwind's scanner reads comments.** `.min-h-screen{min-height:100vh}` is
  still emitted into the built CSS because the comments explaining the ban name
  the class. Its presence there is NOT evidence of use — check the served
  `<body class>`.
- **A hidden Browser pane freezes `requestAnimationFrame` AND suppresses
  `scroll` events** while still moving `scrollY` — measured: a 1200px
  programmatic scroll produced 0 scroll events and 0 frames, only `setTimeout`
  ran. Anything verified through that pane must not depend on either.

### ✅ DEPLOYED 2026-08-18 — THREE times, and the last one is what is live

The 2026-08-18 session shipped in three deploys, all confirmed on production and
all owner-confirmed. Read them in order or the middle one reads as a failure:

1. **The showroom-map / reviews / footer batch** — items (1)–(9) below.
2. **The `*-screen` → `svh` fix plus a temporary diagnostic overlay.** A real
   defect, and it did **not** fix the reported jump. That is not a wasted deploy:
   the overlay it carried is what produced the measurement that found the actual
   cause.
3. **The real fix, then its cleanup.** `svh` turned out not to be stable in an
   in-app browser at all; `--app-vh` replaced it, the owner confirmed **the jump
   is gone**, and the diagnostic was removed. Verified on production: 0
   occurrences of `vpdebug` / `nej-vpdebug` / `TURN OFF` across all 15 JS
   bundles, against a positive control of 8 `--app-vh` hits.

No SQL was outstanding at any point and none is now.

**The gate it passed, run from a deleted `.next`:** `npx tsc --noEmit` clean ·
`npm run lint` clean · **1016/1016 tests across 99 files** · `npm run build`
**454/454 static pages** (the prerender-count invariant holds).

**What is in it, newest first — full detail in `CHANGELOG.md` 2026-08-18 (1)–(9):**

| | Change |
| --- | --- |
| (9) | Map frame is **square**; footer address gains the copy button |
| (8) | **Copy-address button** on the homepage CTA, contact panel and About |
| (7) | Hero **Trade → Visit Us**, jumping to the CTA block; footer address stacks above hours |
| (6) | Footer address+hours move out of the brand column into a **centred band** |
| (5) | **Reviews 4 → 12** from the live Google profile; homepage band is a **scrolling marquee** |
| (4) | Homepage CTA **typographic ladder** (pulled back from bold after owner review) |
| (3) | Hours become a **day-by-day list** like Google Maps |
| (2) | Map **zoom buttons** + closer default; address stops splitting the landmark name |
| (1) | **"Visit us today"** copy, the **Google map**, and the About showroom section |

✅ **The CSP hazard cleared — checked on production, not assumed.** The risk was
that `frame-src`'s new `https://www.google.com https://maps.google.com` lived in
**two** files (`next-app/next.config.ts` and **root `netlify.toml`**, the latter
being what actually serves production) and that a copy missing the root file
would blank every map with only a console error. It travelled. The live header
reads:

```text
frame-src https://*.tradingview.com https://*.tradingview-widget.com
          https://*.paypal.com https://*.cloudflarestream.com
          https://*.videodelivery.net https://www.google.com https://maps.google.com
```

Re-run any time with:

```bash
curl -s -D - -o /dev/null https://naplesestatejewelry.com/ | grep -i "content-security-policy"
```

**Confirmed live on production the same day** — the homepage is 200 with the
correct title, and the batch's own markers are all serving: `Call or Visit Us
Today`, the `#visit-us` hero anchor, the `6240 Shirley` / `Sharon Lynch` address
block, the copy-address control, and the review marquee. **Both maps render** —
homepage and `/contact` each carry the lazy `maps.google.com/maps?q=26.222053,
-81.781429&z=17&output=embed` frame, pinned to the verified GEO pair.

👀 **Three things still have not been LOOKED at by a human**, each for a
*measured* reason recorded when they shipped, not an assumed one. All three are
now exercisable on the live site and are worth ten seconds each:

- **The smooth scroll** on the Visit Us button — a hidden Browser pane freezes
  `requestAnimationFrame` (no callback in 1500ms; a smooth scroll sat at scrollY
  0 for six seconds). The instant path was proven correct instead.
- **The clipboard** on the copy buttons — a hidden pane leaves
  `document.hasFocus()` false, which the browser blocks both copy paths on
  (`NotAllowedError`, and `execCommand` returned false). The graceful *failure*
  path was proven.
- **The scrolling review band** — measured moving at ~49px/s with an exact seam,
  but nobody has watched it loop.

✅ **Both of those owner actions are now CLOSED (2026-08-19).** The Google
Business Profile hours were corrected to **Tue–Sat 11:00 AM–3:00 PM, Sun + Mon
closed**, byte-identical to `HOURS`; its Description was also rewritten, since it
still claimed "private, mobile, and appointment-only" — the last place
contradicting the store-first rewrite. ✅ **Both Google edits cleared review and
are APPLIED**, re-checked in the owner's profile editor. Linda Cusumano's review is published
**without** its stray "Hi baby" line — an explicit, recorded owner override of
the verbatim rule (⛔ one exception, not a policy; see DECISIONS).
🔴 **Google address verification is next** — owner going 2026-08-20.

### ✅ DEPLOYED 2026-08-17 — the batch is LIVE

The long-pending batch (2026-08-09 through 2026-08-17) shipped.

🟢 **The showroom opened and the site has been rewritten for it (2026-08-17,
DEPLOYED 2026-08-18).** Address **6240 Shirley St, Ste 104, Naples, FL 34109**, inside
**Sharon Lynch Collections**, **Tue–Sat 11:00–15:00 or by appointment**. The
site had asserted "mobile, appointment-only, no physical storefront" in 61
strings across 15 files; all are rewritten in both locales to **store-first
with home visits by request**, and the address now appears on 8 surfaces.
Two strings were outright FALSE and are fixed: the schema claimed Mon–Sat
10:00–17:00, and the homepage strip said Mon–Sat. New single source of truth
`src/lib/business-location.ts` — never retype the address. `geo` is **26.222053,
-81.781429** (owner-supplied 2026-08-17, verified live); the previous downtown
pin measured 5.59 miles from the real door. The CAN-SPAM marketing address is
now handled in code (falls back to the showroom address, so it cannot send
empty). ❌ Owner has explicitly declined three NAP items — the eBay
item-location ZIP (anywhere in SWFL is fine), the Etsy shop location, and
`naplesjewelrybuyers.com`. **Do not re-raise them.** 🔴 The only external
item still open is the **Google Business Profile**. Detail in `CHANGELOG.md` 2026-08-17 (8), `DECISIONS.md`
*Business Model*, and `TASKS.md` *PHYSICAL LOCATION*.

🟢 **Product attribute colors (2026-08-17, deployed 2026-08-18):** the product page's
status/metal/karat/length row prints one color per fact (emerald / metal-true /
sapphire / amethyst) instead of one gold blob. ✅ **Owner-approved 2026-08-17,
including the amethyst — the palette is settled, do not re-open it.**
`CHANGELOG.md` 2026-08-17 (7).

🟢 **The site now invites people IN (2026-08-18, deployed 2026-08-18).** The showroom
rollout put the address on the site but never asked anyone to come. Fixed on
three surfaces: the homepage CTA is **"Call or Visit Us Today"** with a
walk-in sentence and a **small Google map**; the contact page's Visit Us panel
gained a **taller map** directly above *Get directions*; and the About page
gained a **"We Now Have a Naples Showroom"** section (text + directions, no map
by design). New shared `components/ShowroomMap.tsx` + `mapsEmbedUrl()` in
`business-location.ts` — keyless embed, pinned to the verified `GEO` pair, and
**always `loading="lazy"`** so a heavy third party stays off the critical path.
🔴 **CSP `frame-src` gained `www.google.com` + `maps.google.com` in BOTH
`next.config.ts` and root `netlify.toml`** — the embed 301s between those two
origins, and a CSP-blocked iframe blanks silently. `/privacy` gained a Google
Maps bullet. Full gate passed (`tsc`/`lint` clean, **1016/1016**, **454/454
pages**). ⚠️ Verified by DOM/network measurement only — the Browser pane was
hidden, so **nobody has looked at the rendered tiles**. Detail in
`CHANGELOG.md` 2026-08-18 (1) and `DECISIONS.md` *Business Model*.

**Then refined the same day (2026-08-18 (2)):** the map got its own **`+`/`–`
buttons** (top-right, z12–z20, default zoom **16 -> 17**) because a cross-origin
iframe cannot be scripted — each press *reloads* the frame at a new `z`, kept
sane by a 300ms debounce and by **remounting** the iframe rather than changing
its `src` (a live `src` change pushes history and would make Back rewind the
zoom). `ShowroomMap` is now a client component; **build still 454/454**. And the
footer's address stopped splitting the landmark — it read
"… inside Sharon / **Lynch Collections**" because the middot join offers no
break point. New `<ShowroomAddress>` puts the landmark on its own line with only
the **name** marked `nowrap`; `addressWithLandmark()` stays for prose and email.
Verified at **320px in Spanish**, the worst case for both. **And 2026-08-18 (3):** opening hours are now a
Google-Maps-style day-by-day list (`<ShowroomHours>`) instead of
"Tue–Sat 11am–3pm, or by appointment" — seven rows in the footer, contact and
About, a 2-row grouped form on the homepage CTA only. Closed days are shown,
dimmed, and **derived from `HOURS.days`** so display and schema move together;
"or by appointment" sits under the list because it qualifies every row. **And 2026-08-18 (4):** the homepage CTA gained a real
typographic ladder — the deck went full-strength colour (weight
deliberately NOT raised), street 600 with the landmark reset to 400, day 600 /
time 700 with **tabular figures**, closed rows at 0.55, and address+hours
grouped under a single top hairline. Emphasis is weight
and opacity only, never colour, because the two shared components render on four
surfaces with four inherited palettes. **And 2026-08-18 (5):** the homepage review band
is now a **continuous CSS-only marquee** (product pages keep the grid), and
`TESTIMONIALS` went **4 -> 12**, read from the live Google profile (16 reviews,
5.0) with every "More" expander opened. Quotes ship verbatim including posted
spelling/grammar. 🔴 **Two owner decisions are open** — Linda Cusumano's review
is held out because its text genuinely ends "Hi baby", and Google's profile
shows `Closed · Opens 10 AM`, which matches neither the site nor the schema
(Tue–Sat 11:00–15:00). See `TASKS.md`. **And 2026-08-18 (6):** the footer's address+hours moved out
of the brand column into a **centred band under all four columns** — the
seven-row list had made that column twice the height of the others. Column
heights are now 222/222/222/222, spread zero. **And 2026-08-18 (7):** that band now stacks
**address above hours** (side by side read as two unrelated columns), and the
hero's third button changed **Trade -> Visit Us**, jumping to the
"Call or Visit Us Today" block via `VISIT_ANCHOR_ID` + `scroll-margin-top`.
⚠️ `/trade-in` has lost its only prominent entry point. 🔴 The smooth-scroll
animation is unverified — the hidden Browser pane freezes rAF; the instant path
was proven correct instead. **And 2026-08-18 (8):** a 24px **copy-address
button** now sits beside the address on the homepage CTA, the contact panel and
the About showroom section (not the footer). It copies street+city only — no
landmark, no business name — because the paste target is a maps app. 🔴 The copy
itself is unverified: the hidden pane leaves `document.hasFocus()` false, which
the browser blocks both clipboard paths on; the graceful failure path WAS
proven. **And 2026-08-18 (9):** the map frame is now **square**
(`aspect-ratio: 1/1`, sized by `maxWidth`) — 448px on the homepage, 512px on
contact, 288px at a 320px viewport — because the old letterbox showed a corridor
of Shirley St with no context north or south of the door. The **footer address
gained the copy button** too, so all four address surfaces have it.

🟢 **Four owner-requested changes shipped in the same 2026-08-18 deploy:**
the octopus mark now shows at every viewport width (it was hidden below 768px);
the ES/EN chip moved out of the header into the mobile menu below `md` to pay
for the space; the route progress bar is now immediate on every navigation,
including shop filters and button-initiated navigations; and the photo swipe is
one shared gesture that triggers on a slight sideways move. Full gate passed
(`tsc`/`lint` clean, **1016/1016**, 454/454 pages). ✅ Staging was rebuilt after
this batch and is an exact mirror — **854 files / 19.59 MB**, 0-copy dry run. Detail in `CHANGELOG.md` 2026-08-17 (3)
through (6), and under *Storefront And Accounts* below.

**Confirmed on production, not assumed** — fetched from
`https://naplesestatejewelry.com` right after the deploy:

- Homepage: 200, title `Naples Estate Jewelry - Sell Jewelry, Gold & Silver in
  Naples, FL`, h1 `Naples Premier Gold, Sterling & Jewelry Buyers`, the eyebrow
  present, **exactly one `<h1>`** (the streaming-skeleton duplicate is gone in
  production, not just locally), `og:title` == `<title>`.
- Six pages spot-checked across both locales — `/es`, `/sell`, `/sell/naples`,
  `/services`, `/silver-services`, `/es/estate-jewelry`: all 200, all one `<h1>`,
  **all carrying `og:image`** (the blank-card fix is live), `og:locale` correct
  per locale, `og:title` == `<title>` on every one. Spanish serves Spanish.
- `/sitemap.xml`: **107 URLs**, **20 carrying `2026-08-17`**, zero left on
  `2026-07-11`, **zero `noindex` legal URLs leaked**.
- Brand assets all 200 — `favicon.ico` 11,486 B and `nav-logo.webp` 16,174 B,
  byte-identical to source.

**Staging** (`C:\Users\rcman\NEJ-repo-staging`, **843 files / ~19.3 MB**) was
re-synced after this doc update and re-verified as an exact mirror. It now
represents what is live, so the next batch starts from a clean baseline.

**No SQL is outstanding.** All three migrations this batch touched were applied
in Supabase and verified live. The 2026-08-15/16/17 work adds none.

**What went live in it:**

| | |
| --- | --- |
| Refund ledger rework | `paypal_refunds.amount` = this refund's own amount; order total SET from PayPal's cumulative |
| Checkout price-drift guard | `/api/checkout/quote` + `price_changed` 409 — a buyer can never be charged an unshown total |
| Cart drawer quoting | drawer and checkout now show the same live figure |
| First-paint fixes | 533KB was queue-jumping the 21KB stylesheet that gates the first pixel |
| Black header wordmark | owner request |
| **Whole-dollar item prices** (2026-08-15) | rounding moved onto the VALUE, so a card and its charge are one number; closes a live $5,533-vs-$5,533.47 gap |
| **Button font cascade fix** (2026-08-15) | a duplicated un-layered `font: inherit` was discarding every Tailwind font utility on every form control |
| **Touch tap feedback** (2026-08-15) | press states were gated by WIDTH, so phones had none; now `(hover: none)`, CSS-only so it cannot disturb the swipe gestures |
| **Route progress bar** (2026-08-15) | 2px gold bar at the header's base; renders only after 120ms and is removed the instant the route commits |
| **Nav closes on outside tap** (2026-08-16) | mobile menu + accordions dismiss on `pointerdown` outside the `<header>` and on Escape; previously the toggle was the only way out. Anchored to the header so the toggle cannot close-then-reopen |
| **Homepage hero + H2s** (2026-08-16) | eyebrow **"One Piece or an Entire Estate"** over h1 **"Naples Premier Gold, Sterling & Jewelry Buyers"**; homepage H2s gained the location (**"We Buy Gold in Naples"**, **"We Sell Estate Jewelry in Naples"**). Headings mentioning Naples went **0 → 3** per locale. ⚠️ The h1 is 46 chars, so the hero headline block was widened to `72rem` — **2 lines on desktop, 3 on phone/tablet** (`92vw` binds below ~1250px, so mobile is untouched; `.home-hero-bottom` stays `52rem` deliberately). ⚠️ Headline `line-height` is **1.15 and must not go below ~1.1** — at 0.95 the lines overlapped by 12.6px and the "p" of Naples collided with the "i" of Sterling. ⚠️ "Premier" not "Premiere". Says nothing about the service model, because a storefront is opening |
| **SEO audit + 4 fixes** (2026-08-16) | 8 ES pages served ENGLISH titles/descriptions — now localized; 6 `noindex` legal pages removed from the sitemap (113→107); the streaming skeleton's `<h1>` (the domain name) removed so `/`, `/es`, `/shop` have ONE h1; `/sell` 81→72 chars and `/services` given a real title |
| **`pageMetadata()` sitewide** (2026-08-16) | every public page now emits its OWN social card. Fixed **blank cards on `/sell` and every `/sell/[city]`** (hand-rolled `openGraph` with no `images`) and interior pages sharing as the homepage. `noindex` pages deliberately excluded |
| **Spanish social card** (2026-08-16) | `/es` served English `og:`/`twitter:` title AND description, plus an `og:url` pointing at the English homepage. Now localized, with `og:locale`. ⚠️ page-level `openGraph` REPLACES the layout's — restate `images` or the card goes blank |
| **New octopus mark** (2026-08-16) | owner's floating artwork replaces the old framed emblem in **both** places — header `nav-logo.webp` (157×120 transparent, 16KB, FULL artwork) and the favicon pair (square **crop**, so the creature fills 100% of a 16px tab rather than 77%). Icons keep transparency; header `width/height` corrected to 52/40 for the landscape ratio |
| **Favicon = octopus brand mark** (2026-08-16) | `icon.png` 96×96 + a multi-size `favicon.ico`, both cropped from the existing `nav-logo.webp`. Replaces the gold palm tree Google was showing |
| **Homepage title + WebSite entity** (2026-08-15) | title leads with the brand (Google strips a trailing one), trimmed to 65 chars; `WebSite` JSON-LD drives the site-name line; brand is "Naples Estate Jewelry", **no "Co"**. `/silver-services` title now carries "Sterling Silver". Other interior titles unchanged by design |

### Now open, in this order (post-deploy)

1. ✅ **The build published.** Owner-confirmed, and the live fetches above prove
   the new code is actually being served — not a `Canceled` build leaving the
   previous release up, which is how a past deploy failed.
2. 🔴 **Re-measure first paint on production.** The console snippet is in
   `TASKS.md`. Baseline to beat: **533KB across 30 requests before FCP.**
   Localhost reports `transferSize: 0` and cannot measure this — production is
   the only place it is real. Then check it **on a phone on cellular**, which is
   the condition the reported white screen actually lives in.
3. **Confirm the first real refund records itself** — order flips to
   `refunded`/`partially_refunded` and a ledger row appears carrying that
   refund's own amount and PayPal's real refund id.
4. **Watch for the price-change banner** the first time metal moves mid-checkout.
   Its payload contract and copy are test-pinned, but nobody has seen it render.
5. **Nudge the recrawl in Search Console** — resubmit the sitemap and Request
   Indexing on `/`, `/sell`, `/services`, `/silver-services` (the four whose
   titles changed). Optional, not required: nothing about this deploy can hurt
   search, since no URL, route, or robots directive changed. The sitemap needs
   no manual edit — it is generated by `sitemap.ts` at build time — and its
   `lastmod` was bumped to 2026-08-17 so the change is actually signalled.
   Expect titles to swap in over days-to-weeks and the favicon to lag longer.

### What this session produced

- **Discount codes** — admin tab + checkout field, percent or fixed-dollar, with
  optional minimum order, expiry and redemption cap. Live and verified in
  production.
- 🔴 **A PayPal refund bug** — every refund silently failed to record. Found by
  accident while testing discounts; verified fixed against one full and two
  partial live refunds.
- 🔴 **A checkout price-drift bug** — the buyer's screen could show a different
  total than the one charged. Reported from a sibling site; confirmed here by
  measurement ($6,462.72 → $6,393.39 on one bracelet within a day).
- **A first-paint investigation** — the reported "site appears to not exist" is
  load ORDER, not server speed. TTFB is a healthy ~0.19s.
- Two smaller items: the button-font fix and the black wordmark.

### Five things a future session should NOT re-derive

- ✅ **The "~205 buttons carry Tailwind font classes that do nothing" hazard is
  CLOSED (2026-08-15)** — and the fix was a *deletion*, not the re-layering the
  old note predicted. Tailwind's preflight already provided `font: inherit` in
  `@layer base`; `globals.css` carried an un-layered duplicate that outranked
  it. Measured blast radius was small: only the shop-card photo arrows, the
  drawer close, and the header Menu button moved. Do not re-add that
  declaration. See DECISIONS and CHANGELOG 2026-08-15.
- **Sandbox rows live permanently in the live `orders` table** (early July,
  before the 2026-07-09 go-live). Tell them apart by the host in
  `payment_response`, not by a 404 from PayPal.
- **`paypal_refunds.amount` means this refund's OWN amount** since 2026-08-13,
  and reconciling against a SUM of the ledger is valid again.
- **The homepage boot splash cannot fix slow first paint** — it is
  server-rendered, so the earliest it can appear is FCP, the very thing being
  waited for. It arrives *after* the white screen. Do not reach for it as a
  remedy.
- **Every surface showing a cart price must quote**, not read the stored label.
  A half-applied fix here manufactures a visible contradiction between two
  surfaces one click apart.

### ✅ Earlier in this batch: deployed and verified in production (2026-08-13)

The batch is live and was exercised end to end through an authenticated admin
session in the owner's own browser.

**One bug was caught in production and fixed without a redeploy:** the admin
Discount Codes page could READ but not WRITE —
`permission denied for table discount_codes`. The migration granted only
`SELECT` to `authenticated`, and Postgres checks GRANTS before RLS. Fixed by
`supabase/discount-codes-grant-fix-2026-08-13.sql` (already run). See DECISIONS,
*"An RLS policy without a table GRANT is a page that reads but cannot write"*.

Verified working live: create / edit / deactivate / delete, the percent↔dollar
type toggle, required-field validation, the codes table, the checkout chip and
discount line, and the checkout validation API. Button typography confirmed —
the font fix shipped correctly. **The pre-discount shipping-tier rule holds in
production**: a $5,518.10 order discounted to $4,414.48 still drew the $99.00
Registered Mail tier and still blocked Overnight. All test data removed.

**One thing remains unexercised in production:** the refund fix. Every refund
before this deploy failed to record; the corrected path has been proven locally
against real PayPal refunds but has not yet run automatically end to end.
**Confirm the first real refund records itself.**

### What this session produced

- **Discount codes** — new admin tab, checkout field, percent or fixed-dollar,
  optional minimum order / expiry / redemption cap. SQL applied, proven by a
  real purchase.
- 🔴 **A PayPal refund bug found and fixed** — the most consequential item here.
  Every refund silently failed to record. Verified against one full and two
  partial live refunds.
- **A button font bug** — Tailwind font utilities are inert on `<button>`
  sitewide; fixed in the discount components only.
- **A pre-deploy PayPal audit** — the four mysterious `refunded` orders are all
  pre-go-live test artifacts, two of them sandbox. No customer money involved.

### Three things a future session should NOT re-derive

- **~205 buttons across the codebase carry Tailwind font classes that do
  nothing.** Pre-existing, understood, deliberately not fixed sitewide.
- **Sandbox rows live permanently in the live `orders` table** (early July,
  before the 2026-07-09 go-live). Filter by the host in `payment_response`.
- **`paypal_refunds.amount` was reworked 2026-08-13** and now means *this
  refund's own amount*; `orders.refund_amount` is SET from PayPal's cumulative.
  Reconciling against a SUM of the ledger is valid again. ✅ **Both halves are
  now live** — the SQL was already applied, and the code shipped 2026-08-17.

### ✅ Discount-codes SQL applied and proven by a real purchase (2026-08-12)

`supabase/discount-codes-2026-08.sql` has been run in Supabase. A real $42.39
PayPal purchase with a 20% code passed **18 of 18 checks** — including the
atomic redemption inside `capture_paypal_order` and PayPal accepting the
discount breakdown, the two things that could not be verified any other way.
No manual SQL is outstanding again. Detail: CHANGELOG 2026-08-12.

✅ **Test data fully torn down 2026-08-12**, after the payment was refunded in
PayPal (full $42.39, zero fee). Verified clean: 0 test products, 0
`discount_codes`, 0 redemptions, 0 orders with a discount code, no orphaned
`paypal_refunds` row, and `DEEPFIELD_SYNC_DRY_RUN` restored to `false`.

🔴 **That refund exposed a real production bug, now FIXED (deployed 2026-08-17):
every PayPal refund silently failed to record.** The money moved correctly but
the order stayed `paid` with a null `refund_amount`, because a
`PAYMENT.CAPTURE.REFUNDED` resource is a REFUND, not a capture — so the refund
id was passed where the capture id belonged and `apply_paypal_refund` refused
the write. See CHANGELOG 2026-08-12 and DECISIONS.

✅ **Nothing needs repairing from it.** Audited 2026-08-13: **no refund-type
webhook has ever been received on a real order**, so no customer refund was
lost. The four orders sitting at `refunded` with a null `refund_amount` are all
pre-go-live test artifacts — two SANDBOX ($5,646.90 and $37.10, fictional money)
and two live $1.06 owner tests the database wrongly calls refunded. Owner is
deleting all four; see `TASKS.md`.

✅ **Refunds are verified both ways, both LIVE.** Full: end to end on a real
$42.39 capture. Partial: two real partial refunds ($0.50 then $0.56 on a $1.06
purchase, 2026-08-13) taking the order `paid` → `partially_refunded` →
`refunded`, plus 18 synthetic checks covering `PENDING`-ledger attachment,
idempotent replay and the over-refund clamp. **`total_refunded_amount` is
confirmed CUMULATIVE** — the assumption the incremental branch rests on. The
long-open "PayPal refund matrix" item is closed for refunds; capture races,
disputes and invoices remain untested.

⚠️ **Reconcile refunds against `orders.refund_amount`, never a SUM of
`paypal_refunds.amount`** — the ledger amount can drift on a repeat call for an
already-applied refund id. Unreachable from the real webhook path; see DECISIONS.

### ✅ That deploy happened — 2026-08-17

This section described the batch as finished and waiting. It shipped on
2026-08-17, together with everything added to it through 2026-08-16. See the top
of this file for the production verification. The staging figures once quoted
here (835 files, rebuilt 2026-08-13) are superseded by the current **843 files**.

**Nothing further is needed before deploying.** Copy the staging folder into the
repo folder, keeping that folder's `.git`, then push.

**What is in it:**

1. **eBay per-item exclusion** — the two Rolexes are held out of eBay by id
   (`EBAY_EXCLUDED_PRODUCT_IDS`). WARNING: **deploy before running any bulk eBay
   sync** — until it lands they sort FIRST in the enqueue order and would fail
   back to `error`.
2. **Bulk-enqueue ordering** — `orderEnqueueCandidates` (stale -> error ->
   published) so a repeated bulk run advances instead of redoing its first page.
3. **Marketplace flag split** — "Content stale" plus a separate price chip.
4. **In-app-browser stutter fix** — `svh` sitewide, guarded `resize` listeners.
5. **Announcement banner** — pinned inside the hero frame, now the
   free-evaluation promo, linked to `/free-evaluation`.
6. **Discount codes** (2026-08-11) — a new admin tab plus a checkout field.
   Percent or fixed-dollar, with optional minimum order, expiry, and a hard
   redemption cap. Its SQL is **already applied** in Supabase, and the feature is
   proven by a real purchase.
7. **PayPal refund fix** (2026-08-12) — 🔴 the highest-value item in this batch.
   Before it, **every refund silently failed to record**. Verified live on a
   full refund and two partial refunds.
8. **Button font fix** (2026-08-12) — Tailwind font utilities are inert on
   `<button>` in this app; the discount components now set font properties
   inline. Scoped to those components deliberately, not fixed sitewide.
9. **Refund ledger rework** (2026-08-13) — `paypal_refunds.amount` now has one
   meaning. **Its SQL is already applied**; the code is not.
10. **Checkout price-drift guard** (2026-08-13) — a live quote endpoint plus a
   `price_changed` rejection, so a buyer can never be charged a total their
   screen did not show. No SQL.

### How this folder ships

There is **no git workflow here**. Copy `C:\Users\rcman\NEJ-repo-staging`
wholesale into the repo folder (`OneDrive\Documents\GitHub\NaplesAntiquesLLC.com`),
keeping that folder's `.git`, then push. Rebuild staging after any edit — the
exact command is in `TASKS.md` under *Copying to the repo folder*.

WARNING: **never copy the project root directly** — it contains `.git` AND a
stray `next-app/.git`, and the latter would silently drop the whole app from
commits. **Check the deploy reaches `Published`**; one showed `Canceled` earlier
in this session (superseded, not lost, but do not assume).

### What changed structurally this session

- **GitHub Actions owns every cron now**, not Netlify. All five Netlify
  scheduled functions had NEVER executed — a platform fault, not our code.
  `.github/workflows/scheduled-jobs.yml` replaced them and is **confirmed firing
  on its own**. The `.mts` files remain only so the change is reversible.
- **The eBay shipping-tier campaign is COMPLETE** (85 of 86; #82 is
  write-blocked by design).

### Before writing code, read these DECISIONS entries

- *An absent record is a fault, not a clean slate* — why a never-run schedule
  must render red.
- *Content freshness and price-push health are two separate signals* — do not
  merge them; a successful price push cannot clear `out_of_date`.
- *A bounded bulk run must ORDER its queue, not just cap it*.
- *Watches are not listed on eBay* — do NOT implement the `Department`
  `TODO(ebay-verify)` in `mapping.ts`; it is answered.
- *Viewport height is `svh`, and `resize` is never listened to bare*.
- Hero/shop-card rules: *One solid background per slideshow*, *On touch, the hero
  snaps exactly one slideshow per gesture*, *Shop-card photos: swipe + windowed
  dots on touch*. Older entries describing the removed background sweep carry
  inline supersession notes — the newer entry is the rule.

### Verification at session end

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean |
| `npm test` | **1016 passed / 1016**, 99 files |
| `npm run build` | compiled successfully, **454/454** static pages, no warnings |

Run **2026-08-17** from a deleted `.next` with the dev server stopped. Test
progression this session: 998 (as deployed) → 1004 (route bar: query-only
arming, `locationKey` normalisation) → **1016** (the shared photo-swipe
arbitration). Pages unchanged at 454 throughout — worth noting, because this
session introduced `useSearchParams` into the root layout, which deopts every
prerendered page if its `<Suspense>` boundary is ever removed. The page count is
the check that catches that.

⚠️ `npx tsc` resolves a stub in this repo — run the local binary:
`next-app\node_modules\.bin\tsc.cmd --noEmit -p next-app/tsconfig.json`.

Run from `next-app/`, with the dev server stopped and `.next` deleted first.

### Owner-owned, not blocking

eBay **#82** reattachment, the `/free-evaluation` hero photo, and the phone-only
checks (in-app-browser scroll, shop cards, hero flick) in `TASKS.md`.

## Marketplace Automation — current state

**GitHub Actions owns every scheduled job.** All five Netlify scheduled functions
had never once executed (a platform fault; the `.mts` files are kept only so the
change is reversible). `.github/workflows/scheduled-jobs.yml` replaced them and is
**confirmed firing on its own** — Etsy 11:54 UTC and eBay 12:27 UTC on
2026-08-11, ~40 min after their slots, which is normal GitHub best-effort
scheduling. Zero failures. Full history: CHANGELOG 2026-08-10 and 2026-08-11.

**The eBay shipping-tier campaign is COMPLETE.** 85 of 86 available listings
carry the correct tier, verified on the live listings across two bands ($35.00 at
$600–1,000; $99.00 "Signed" at $5,000–15,000). Zero listings sit in `error`.

Two items are deliberately not synced and are **not** open work:

- **#82** — write-blocked in code pending an owner-approved reattachment on eBay.
  It is the one remaining `out_of_date` row and can only be fixed on eBay.
- **#83 / #84 (the Rolexes)** — owner decided 2026-08-11 that watches are not
  listed on eBay. Held out per item by `EBAY_EXCLUDED_PRODUCT_IDS`. ⛔ Do NOT
  implement the `Department` `TODO(ebay-verify)` in `mapping.ts`; see DECISIONS,
  *"Watches are not listed on eBay"*.

⚠️ **`.env.local` is not authoritative.** It was out of sync with Netlify for the
eBay cron secret, which is exactly how that value broke. Netlify wins; check
rather than assume. A rotated cron secret must change in three places: Netlify
(plus a redeploy), the GitHub Actions secret, and `.env.local`.


## Deployment State

- 🟢 **The email/security/integration batch SHIPPED 2026-08-08.** Outbound email,
  the `?returnTo=` product-disclosure fix, the Deep Field integration, the
  eBay/Etsy price-push fixes, and the hero carousel work are all deployed. The
  `returnTo` fix was verified against production (28/28 anonymous probes 404).
- ✅ **The email surface is fully verified. `info@naplesestatejewelry.com`
  receives mail — owner-confirmed 2026-08-09**, closing the last outstanding
  check. That mailbox is the single point of failure for every inbound path
  (footer and account inquiries, order notifications, marketing From/Reply-To,
  bounce handling, both JSON-LD blocks), so it stays worth naming even though it
  is no longer an open task. The standing hazard for any FUTURE email change is
  unchanged: DMARC is at `p=quarantine`, so a DKIM or alignment fault delivers to
  **spam without erroring** — a green "sent" in Resend's log is never the check
  that matters, only an opened inbox is. Checkout is unaffected either way (send
  failures are caught and never throw) and missed receipts re-send from
  Admin → Orders.
- 🟡 **The batch grew substantially on 2026-08-09 and is now a real
  UX release** (still no security or delivery impact): the shop-card touch pass
  (mobile Add to Cart restored, cart icon sitewide, dot indicators + swipe,
  single-card-off-cover model), the hero touch snap + slowdown, the hero
  performance batch (double-fetch fix, q82, spinner), and **one solid
  background per slideshow** (the per-photo sweep is removed). Plus the
  earlier small items: Deep Field image budget 18 → 30 and test hardening.
  The one manual SQL for the batch (`add-slideshow-bg-colors.sql`) is ALREADY
  RUN and owner-verified, so deploying is copy-and-go. See CHANGELOG
  2026-08-09 and the smoke list in TASKS.
- **Production:** `https://naplesestatejewelry.com` is live on Netlify. The
  `.com` domain is primary; `naplesestatejewelry.co` and
  `naplesantiquesllc.com` redirect path-preservingly to it. The `.co/api/*`
  carve-out remains for registered external endpoints.

  **Email is fully `.com` as of 2026-08-08** — the earlier mailbox-vs-sender
  split is reversed. Verified 2026-08-09: **zero `@naplesestatejewelry.co`
  addresses remain in `next-app/src`** (18 `info@…com`, 8 `noreply@…com`).
  Contact addresses, Reply-To, schema.org `email`, and marketing campaign
  senders are all `.com`. Do not restore a `.co` address. Still true regardless:
  **never alter `.co` MX records as part of website work.**
- **External domain migration:** complete. GoDaddy DNS, Netlify primary/cert,
  environment URLs, Supabase Auth, PayPal/eBay/Etsy registrations, Search
  Console, sitemap, and Google Change of Address were completed and verified.
- **Local source-of-truth batch — FULL GATE PASSED 2026-08-09 (re-run at the
  end of the later session, covering the complete batch).** Dev server stopped
  and `.next` deleted first, so this is a clean from-scratch build, not
  incremental:
  - `npm test` → **846/846 across 87 files** (unchanged; the later session's
    changes are CSS and markup, and no suite covers them)
  - `npx tsc --noEmit` → clean
  - `npm run lint` → clean
  - `npm run build` → **exit 0**, compiled successfully in 10.9s,
    **449/449 static pages**; `BUILD_ID`, `server/`, `static/`,
    `prerender-manifest.json` all present, 56 prerendered `.html`,
    911 js files across the tree
  - **Compiled-output spot check** (1022 js/css/html files): removed markers
    `Hide date label on mobile` = **0** and `testimonial-card-link` = **0**;
    new markers all shipped — `testimonial-google-link` 5 files,
    `home-hero-actions` 4, `-webkit-line-clamp` 4, the `share.google` URL 4,
    `/trade-in` 80, `modern-card-date` still present in 2.
  - **Email invariant re-confirmed:** bare `@naplesestatejewelry.co` = **0**
    files and `aol.com` = **0**, against a control of `naplesestatejewelry`
    matching 138 files (`info@…com` 76, `noreply@…com` 19). ⚠️ Method note
    worth keeping: the first attempt reported 0 for *everything* because
    PowerShell 5.1's `Select-String` does not populate `.Matches` when
    `-SimpleMatch` and `-AllMatches` are combined. **Always run a positive
    control through the same scan** — a broken absence check looks exactly
    like a clean result.

  The earlier session-end run of this same gate is superseded by this one. Its
  figures were 449 pages / 846 tests / 58 prerendered `.html` / 961 js, and its
  spot check confirmed the hero sweep's removal (`shop-card-image-progress` = 0,
  the new dot classes present, `shopping_cart` × 23, `pan-y pinch-zoom` × 4,
  `quality:82` × 3). The small `.html` and js deltas between the two runs are
  ordinary build variation.
  - ⚠️ Node here is **v24**; Netlify pins **NODE_VERSION 20** and
    `package.json` declares no `engines`, so a green local build is strong but
    not identical to theirs. Watch the Netlify build log.
  The 2026-08-06 sign-off run additionally smoke-tested 38 route/locale
  combos under `next start` (all 200 bar the correct `/es/` 308); that smoke has
  not been re-run since, as the changes after it were test-and-docs only.
- **Deploy workflow:** this folder has no git workflow. The owner copies it to a
  separate repository folder and handles version control/deployment manually.

## Runtime And Data

- The only active application is the Next.js App Router app in `next-app/`.
  Root `netlify.toml` builds that directory and publishes `.next`.
- Supabase project `evzluixourmsefwdsieu` is the system of record for catalog,
  auth, customer state, orders, inquiries, admin data, marketplace state, and
  social state. Product rows store media references, never image/video bytes.
- New product images use Supabase Storage with WebP/downscale/cache defaults.
  Product-video bytes use Cloudflare Stream; marketplace video publishing is
  not enabled.
- EN/ES routing uses `next-intl`. Public routes, metadata, validation, and legal
  behavior are paired across locales.

## Storefront And Accounts

- The product purchase panel is its own query container: the scrap-value and
  live-spot tiles always sit side by side and compact their type/padding rather
  than stacking, and the buy actions are a flush grid (one row of four on a
  column ≥470px, otherwise Add to Cart full width above Save/Inquire/Call).
- Products whose first photo is shot on black render a dark page variant. The
  dark palette applies only to content on the dark page; any card that paints
  its own light background (related products, reviews) carries
  `product-light-surface` and restores the light text tokens. Both variants
  audit clean for WCAG AA text contrast in both locales.
- **The photo swipe is ONE gesture, shared by the product gallery and the shop
  cards (`src/lib/photo-swipe.ts`, 2026-08-17, deployed 2026-08-18).** It was duplicated,
  and the gallery's copy was never given the 2026-08-09 fix — it still used
  React `pointermove`, which by spec cannot cancel a scroll, so that surface was
  structurally unable to swipe. Arbitration is now asymmetric: horizontal locks
  at **4px** sideways within a **~58°** cone, vertical only at **12px**, and in
  between the gesture is **undecided** — never claimed, so the page still
  scrolls, but not yet discarded either. That undecided window is what rescues
  the arcing thumb whose first pixels read as downward. ⚠️ Keep the vertical
  trigger well above the horizontal one and the cone at ~1.6 or below; a
  greedier cone steals genuine page scrolls, and photos are most of the
  scrollable surface on both surfaces. See DECISIONS, *"An undecided swipe is
  not a scroll"*.
- The product gallery has no hover/touch magnifier (removed 2026-08-04);
  clicking the main photo opens the full-size lightbox, and the prev/next
  controls only navigate. Swiping the main photo changes it on touch devices at
  every size; below 768px that swipe is the only on-image control, since the
  edge bars are hidden there. From 768px up the bars return alongside it. Those
  bars are narrow full-height strips hugging
  each side of the photo — the bar is exactly the
  clickable area — each fading in as the cursor approaches that side and solid
  once it is over the bar, permanently visible on touch. Their translucent scrim
  reads on any backdrop (it darkens light content and lifts dark content), so it
  no longer depends on the frame's padding colour matching the photo, and they
  sit above every layer in the frame,
  with a flat scrim whose tone follows the frame's own backdrop. The middle
  15%–85% of the photo stays the lightbox's.
- `/shop` is the canonical catalog. Public visibility is Available and Sold;
  Draft, Pending Payment, and Archived remain private. Sold prices are masked
  unless a captured sale snapshot supplies the historical amount.
- Shop gallery cards (2026-08-09 batch, deployed 2026-08-17): the photo carries windowed
  DOT indicators (max 7, tapered edges when truncated; on the scrim pill +
  hover-revealed on pointer devices, permanent and floating with per-dot
  ring/halo contrast on touch), seated on the photo's bottom edge with the
  brand/link flag lifted above and the prev/next arrows bottom-aligned to the
  flag's baseline. On touch the arrows are hidden and SWIPE changes the photo
  (native non-passive touchmove, 5px slop, ~51° horizontal cone; vertical
  drags still scroll the page); a swiped card keeps its photo until a
  DIFFERENT card is swiped (`shop-card-photo-focus`), so at most one card is
  ever off its cover. Hover auto-cycling and the 1s mouse-leave reset are
  mouse-only. Every card shows the bottom Add to Cart button at all widths
  again (mobile also keeps the corner cart icon), and the cart icon is
  Lucide's ShoppingCart sitewide (header, drawer, checkout empty state, tiles);
  the admin's `shopping_bag` uses are Etsy marketplace icons and stay. The
  **"Ca. YYYY" date shows at every width** (the mobile hide was removed
  2026-08-09); "Your price" stays hidden at every width.
- Product cards, gallery/lightbox, shop filters/pagination, account/favorites,
  cart return state, live spot pricing, and checkout are active. Product
  detail pages end with three policy accordions (Shipping & Returns /
  Condition & Wear / Payment Options, linking to the full policy pages), a
  full-width Sustainably Sourced / Fully Insured / Local Pickup trust strip
  beneath both columns, and a
  compact band of the four curated Google reviews (single source:
  `src/lib/testimonials.ts`, shared with the homepage section; the grid is
  **2 columns minimum**, 4 from 1160px, the card compacts its padding and type
  on a narrow phone rather than dropping to one column, quotes clamp to 8 lines
  in CSS with the verbatim text intact in the DOM, and the whole card links out
  to the Google Business Profile), preceded by a
  "You Might Also Like" strip of four same-category available pieces ranked
  same-type-first, each card carrying the shop cards' purity/weight/length/width
  chips from the shared `lib/product-spec-chips.ts`.
  From md up the product page is a two-column layout that fills the space under
  the photo: column 1 is the gallery then notes + the policy accordions, and
  column 2 is the purchase panel, description, and Specifications (which
  include a chain/band Width in mm for necklaces and bracelets), so both
  columns end together (~947px at 1280-1920 for a typical piece, down from
  1337px). **At 2000px+ the page uses the `ultrawide-page-medium` tier (1600px),
  not wide (2200px), since 2026-08-14** — the gallery is square, so column width
  is also photo height, and the wide tier produced a 1120px-tall photo the owner
  reported as too big. The gallery is now capped at **736px** and is flat at
  every width from 2000px up. **Ultrawide also rearranges the band** (owner,
  2026-08-14): row 1 is gallery | purchase panel + description + specs, and row 2
  is the compacted trust strip | notes + policy accordions — so the accordions
  sit under the specs they describe and the trust strip sits under the photo
  instead of forming a full-width band below everything. That strip is now a
  CHILD of the layout grid; below 2000px it spans both columns from a third row
  and is visually unchanged. Below md everything collapses to the original
  single-column order. The trade-in
  service has a named page at `/trade-in` (Gold & Silver Trade-In Program),
  linked from the Sell menu, footer, each product page's trade-in line, and the
  homepage hero's **Trade** CTA (which pointed at `/contact` until 2026-08-09).
  Below 640px the hero's three CTAs are a two-column grid — always two up and
  one centred below, never three stacked rows — reverting to a single flex row
  of three from 641px.
  The homepage carries an announcement bar that never wraps — its type shrinks
  fluidly to hold one line. It is **not** part of the fixed header; since
  2026-08-11 it rides INSIDE the pinned hero frame (passed to `HomeHeroStack` as
  `banner`), so it stays put until the hero text releases and then travels away
  with it. The frame's height is unchanged, so the hero choreography and touch
  snap are unaffected. 🟡 **It now advertises the free-evaluation promotion
  ("Summer special · Schedule a free evaluation", owner reword 2026-08-14;
  "Oferta de verano · Programe una evaluación gratuita" in Spanish) and links to
  `/free-evaluation`** — time-limited copy that needs replacing when the promo
  ends; nothing expires it automatically. ⚠️ **This wording names a SEASON, so it
  reads wrong from roughly 22 September** — a real expiry date, not an open-ended
  one. Spanish also sits at only ~10% width headroom now (30.4px of 304px at
  320px), so lengthening it requires refitting the type clamp. The old 780px third-item reveal was
  removed with that change. It also carries
  a Meet the Owner story block, a Why Buy Estate Gold? education
  section, and four FAQ accordions linking to `/faq`, ordered hero →
  services → owner → education → FAQs → testimonials → call CTA. Checkout is a
  single-page two-column layout: one Shipping card on the left (delivery
  method → contact → address) and a sticky Order summary on the right holding
  items, totals, and the PayPal buttons, with a **Back to cart** link that
  reopens the cart drawer.
- **Touch controls confirm a tap immediately (2026-08-15, deployed 2026-08-17).** Press
  states live in an `@media (hover: none)` block in `globals.css` and are
  **CSS-only on purpose** — the shop cards and hero run their own touch gesture
  handlers, and JS press listeners risked disturbing them. ⚠️ Scope any future
  press state by POINTER, not width: the rules this replaced were behind
  `min-width: 641px`, which left every phone with no feedback. Product cards are
  deliberately excluded (they are swipeable; `:active` would fire mid-swipe).
  A 2px gold **route progress bar** (`components/layout/RouteProgressBar.tsx`)
  covers the wait after the tap. **Since 2026-08-17 (deployed 2026-08-18) it is
  IMMEDIATE and fires on every navigation** — the 120ms delay is gone. That
  delay is what made it look page- and viewport-dependent: a navigation faster
  than 120ms showed nothing, and prefetch coverage varies with how many links
  are on screen, so the same tap behaved differently on a phone and a desktop.
  It now also arms on **query-only** navigations (shop filter/sort/view/
  pagination) and on navigations started from a `<button>`, via the exported
  `startRouteProgress(href)`. It is still removed the instant the route commits,
  with no minimum display or fade tail — that half was re-offered to the owner
  and deliberately declined, so **a fast navigation flashes by design**. It sits
  at the **base of the header**, offset from the `--site-header-height` token and
  made conditional on `body:has([data-site-header])` so admin (which renders no
  site header) keeps a `top: 0` fallback rather than a bar floating mid-page.
  ⚠️ **Completion is keyed on path + query and therefore reads
  `useSearchParams`, so the `<Suspense>` wrapper in `[locale]/layout.tsx` is
  load-bearing** — without it all 454 prerendered pages deopt. ⚠️ The shop's
  centred spinner was removed as a duplicate (its screen-reader live region
  stays). See DECISIONS, *"The route bar is immediate, and that is the whole
  point"* and *"Tap feedback is CSS-only…"*, including the `popstate` trap.
- ✅ **In-app-browser viewport jump — ROOT CAUSE FOUND, FIXED AND DEPLOYED
  (2026-08-18, owner-confirmed).** Measured on the live site from inside Instagram's iOS browser,
  not inferred:

  | reading | value |
  | --- | --- |
  | `vh` / `svh` / `dvh` probes | **all three identical**, and all three moved |
  | `innerHeight` | **729 ↔ 853** — 124px of chrome |
  | homepage document height | **423px** swing |

  🔴 **`svh` is not stable in an in-app browser.** Instagram resizes the
  WKWebView natively rather than retracting browser chrome, so WebKit sees a
  plain window resize: there is no small-vs-large viewport to distinguish, the
  three unit families collapse into one number, and that number tracks the
  toolbar. The 2026-08-11 batch adopted `svh` *because* it is "stable across
  exactly this event" — true per spec, false here. That is why two rounds of
  fixes changed nothing.

  **The homepage hero is the amplifier and the arithmetic closes:** its runway is
  `(100svh - header) + 240svh` = **3.4 × the unit**, so 124px of chrome becomes
  3.4 × 124 = **421.6px** against **423px** measured. A page whose height moves
  under a scroll is the jump.

  **Fix:** `--app-vh`, written before first paint by an inline script in
  `[locale]/layout.tsx` and refreshed **only** through `onLayoutAffectingResize`
  (160px tolerance, above the 124px measured). `globals.css` keeps
  `--app-vh: 100svh` as the no-JS fallback. The hero runway/frame, `HomeHero`
  and the `<body>` shell read the token. Verified both ways: a 124px height
  change leaves the token, the document height (7820px) and the runway (2844px)
  unmoved — the `svh` rule would have taken the runway to 2423px — while a
  rotation updates them. See DECISIONS, *"`svh` is NOT stable in an in-app
  browser"*, which supersedes the premise of the older `svh` entry.

  ℹ️ Modal/panel max-heights stay on `svh` deliberately — they do not contribute
  to document height, so they cannot cause this.

  ℹ️ **The `*-screen` → `min-h-svh` change was a real defect and NOT the cause.**
  On the failing device `vh` and `svh` are the same moving number, so it could
  not have helped. Kept, because it is correct everywhere `svh` behaves per spec,
  and guarded by `lib/__tests__/viewport-units.test.ts`.

  ℹ️ **The hero touch snap is cleared** by this data: homepage `auto-scroll`
  maxed at 134px ≈ the 124px toolbar travel, i.e. the browser clamping scroll as
  the document resized — not the 1-second animated snap.

  ✅ **Deployed and owner-confirmed 2026-08-18: the jump is gone.** The
  temporary `?vpdebug=1` overlay and its DEBUG button have been removed; 0
  occurrences of `vpdebug` remain in the built JS.
- The fixed site header is fully opaque (`#f9f9f7`, no backdrop blur; the mobile
  menu panel likewise), and its height comes from one token,
  `--site-header-height` — 3.5rem on phones, 4.5rem from md up. The header is
  sized BY the token, so page offsets (`.site-header-offset`), sticky tops, and
  full-height panes derive from it and cannot drift. A source guard test rejects
  a reintroduced `pt-16` main, `top: 4rem`, or `calc(100svh - 4rem)`.
- **The octopus mark shows at EVERY width, and the ES/EN chip is md-and-up only
  (2026-08-17, deployed 2026-08-18).** The mark was `hidden md:block`, so phones and
  sub-768px tablets carried the wordmark alone; the language chip was a
  duplicate of a control the mobile menu already had, so it moved out of the
  header row below `md` to pay for the mark.
  ⚠️ **The brand row is genuinely full on a narrow phone**, and the brand link is
  `shrink` + `overflow-hidden` — so a mark that does not fit does not break
  visibly, it silently clips the tail off "Naples Estate Jewelry". Three numbers
  share one budget below `md` and must move together: the mark height
  (`clamp(1.75rem, 7vw, 2rem)`, bounded at 767px so it never fights `md:h-10`),
  the wordmark size (one fluid `clamp(8.75px, 2.9vw, 11px)`, replacing a pair
  of rules that STEPPED 10px → 11px at exactly 400px — the worst width in the
  band), and the brand gap (8px → 5px). Both mark heights are the header's own
  content budget (32px of the 56px mobile token, 40px of the 72px desktop one),
  so the token is unmoved. **Net effect: the mark was added and nothing else got
  smaller** — the `2.9vw` clamp is at or above the pre-mark wordmark size at
  every width.
  **Re-measure the 320–430px band in Spanish with the menu OPEN before changing
  any of the three** — that is the widest state (`Cerrar` is the longest toggle
  label) and English carries roughly twice the slack, so an English-only check
  will pass a layout that clips. Verified 0px clipping and 0 page overflow at
  320/350/400/430/639/640/767/768/1280, with 11.7–25.9px of slack across the
  phone band.
  ℹ️ Hiding the chip is safe for mobile-first indexing: hreflang lives in the
  HEAD via `pageMetadata()`, not in that link.
  ⚠️ `HEADER_STYLES` is a template literal — **never put a backtick in a comment
  inside it**; it ends the string and the error surfaces as a bogus
  "Expected a semicolon".
- The homepage hero is a scroll-pinned parallax stack (`HomeHeroStack`) of
  THREE slideshows handing over in overlapping crossings, everything traveling
  upward (the next slideshow rises from below); the headline/sign-up/CTA
  overlay stays pinned until the frame releases. Full choreography rules live
  in DECISIONS. Each slideshow shows **one solid admin-chosen background
  color** for its whole time on screen (2026-08-09, deployed 2026-08-17 — the per-photo
  sweep is removed; `add-slideshow-bg-colors.sql` already run and verified),
  and the overlay's light/dark text theme derives from the dominant pane's
  color by luminance. On TOUCH the hero SNAPS: one gesture advances exactly
  one slideshow however hard the fling (step measured from where the gesture
  began; B's snap point solved from the crossing constants), with a smooth
  ~1s scroll to the next slideshow (`SNAP_STEP_MS`) and free exit at both
  ends; wheel/desktop scrolling is untouched by the snap. **The runway is split
  by pointer type since 2026-08-14: 240svh on touch, 210svh on everything else**
  (owner asked for a slightly faster desktop scroll — ~12.5% less scrolling,
  measured 2280px → 1995px of travel at 1500×950). Pointer type is therefore
  geometry, not just the easing curve, so a pointer change re-measures.
  The scroll handler also bails on unchanged progress, so it no longer rewrites
  pane transforms while the visitor is anywhere below the hero. All three lineups are admin-curated (Slideshow 1/2/3 tabs;
  all migrations run; later lineups mirror A while empty), each with its own
  background color control; random draws FILL the editable lineup and saved
  lineups are always explicit manual lists. Lineups may include sold pieces
  (no price caption, product page shows Sold). B arms on first scroll intent
  or idle, C one idle beat later, so initial load carries one carousel.
- The local batch fixes thumbnail-rail clipping/wrap stutter, normalizes all
  seven password fields through one shared eye-toggle component, and expands
  large application canvases at ultra-wide breakpoints while preserving narrow
  prose/dialog surfaces.
- Admin Products fills surplus width at 2100px+, expanding Brand first and then
  distributing remaining space across flexible columns.

## Checkout, Orders, And Compliance

- PayPal Orders API v2 owns payment. Totals, product availability, U.S. address,
  shipping method/fee, and tax are recomputed server-side. There is no inventory
  hold; the first successful capture wins one-of-one inventory.
- **Item prices are whole dollars (2026-08-15, deployed 2026-08-17).** Every offered
  price — spot-computed or manual — is rounded in `getProductPriceValue()`, the
  single funnel feeding checkout, PayPal, eBay, Etsy, the social card, Deep
  Field, and sold-price capture. The rounding is on the VALUE, not in a
  formatter: before this, a card advertised $5,533 while checkout collected
  $5,533.47. `formatUsdPrice` is now the only price formatter. **Tax and order
  totals still carry cents** — 6% of a whole dollar is not a whole dollar — as
  do melt/scrap, the live spot ticker, and any already-captured `sold_price`.
  ⚠️ A price under $0.50 rounds to $0 and is refused everywhere, deliberately.
  See DECISIONS, *"Item prices are whole dollars"*.
- **The buyer is never charged a total they were not shown (2026-08-13,
  deployed 2026-08-17).** 64% of the catalog is spot-linked, so a cart's stored price
  label drifts from the chargeable price as metal moves — measured at $69.33 on
  one bracelet within a single day. Two halves: `POST /api/checkout/quote`
  (read-only, keeps the summary showing live figures) and a `price_changed`
  guard in `paypal/create-order` that returns **409 before creating anything**
  when the displayed total and the authoritative total disagree by a cent or
  more. The server always charges its own price; the client's `quotedTotal`
  only decides whether to stop and ask. See DECISIONS, *"Never charge a total
  the buyer was not shown"*.
  - **Both cart surfaces quote** — the checkout summary and the cart drawer.
    The drawer was missed in the first pass, which briefly made the two
    contradict each other one click apart; it now quotes on open. Any NEW
    surface that shows a cart price must quote rather than read the stored
    label, or it will reintroduce that contradiction.
  - ✅ The guard's rejection paths are **verified live in production**; the
    matching-quote path was deliberately not run there (it creates an order).
- **Discount codes (2026-08-11, deployed; its SQL is applied).** Admin →
  **Discount Codes** creates a code that is either a percentage or a fixed
  dollar amount off, each optionally carrying a minimum order subtotal, an
  expiry, and a total-redemption cap. Shoppers enter it at checkout.
  - The discount comes off **merchandise only**. Shipping tier and the $5,000
    Express cutoff key off the **pre-discount** subtotal; Florida tax is charged
    on the **discounted** merchandise plus shipping. A fixed discount is clamped
    to the subtotal, so merchandise can reach $0 but never negative.
  - **The cap is the real reuse control**, enforced by a conditional UPDATE
    inside `capture_paypal_order`'s existing row-locked transaction. "Once per
    email" also exists but is a **speed bump only** — guest checkout means a
    second email defeats it, and that is a deliberate accepted limit, not a bug.
    See DECISIONS, *"the cap is the control"*.
  - The checkout validation route is a **preview**; the charged discount is
    recomputed server-side in `buildOrderDraft` from the code string alone.
- Shipping is U.S.-only. Local Pickup is free. Insured shipping uses value-based
  tiers; $5,000+ Standard uses USPS Registered Mail, and Express is unavailable
  above that coverage threshold.
- Current tax policy is 6% on merchandise plus charged shipping for Florida
  destinations and no collected tax outside Florida. County surtax and any
  additional nexus rules remain blocked on accountant/legal review.
- Orders support invoices, receipts, fulfillment email/history, refunds,
  recycle-bin restore/permanent delete, and sold-price locking. The controlled
  live PayPal recovery/refund/race matrix remains open.
- **All outbound mail sends from `@naplesestatejewelry.com`** (Resend's only
  verified domain since 2026-08-05). Customer receipts and fulfillment updates
  carry `Reply-To: info@naplesestatejewelry.com`; marketing keeps
  `Reply-To: chris@naplesestatejewelry.co`, a live mailbox. Never "fix" a sender
  back to `.co` — it will not send at all. See DECISIONS.md for the
  mailbox-vs-sender split.
- The checkout form's fields are properly labelled (`id`/`htmlFor`) and carry
  full `autocomplete`; keep both when editing `CheckoutClient.tsx`, since the
  visible `.form-label` markup does not associate on its own.
- Privacy, Terms, Returns/Refunds, Shipping, Accessibility, and cookie controls
  are present. Auction and vendor pages are retired and redirect to current
  destinations. Counsel review remains recommended.

## Marketplace Integrations

- **The product table carries TWO chips per marketplace (2026-08-11, deployed 2026-08-17):**
  the state chip, relabelled **"Content stale"** (was "Out of date"), and a
  separate **price chip** ("Price failed" / "Price stalled") that appears only
  when `error_count > 0`. They measure different things and must not be
  conflated — a successful price push cannot clear content drift, because the
  push never writes `content_hash`. See DECISIONS, *"Content freshness and
  price-push health are two separate signals"*. The price chip is invisible today
  because no listing has a failure, which is correct.
- Etsy and eBay are independent, review-first one-way sales channels. Both have
  connection/settings, previews, per-item and bulk sync, status reconciliation,
  delist/relist behavior, price freshness, shipping policy/profile selection,
  and bounded observable daily price-push infrastructure.
- Seven insured-shipping tiers are provisioned on **both** marketplaces. One
  controlled listing update per marketplace still needs owner verification.
- **Daily price pushes: schedules were always correct but had never run** (zero
  `scheduled_price_push` rows ever, in a log that records even skips) — and as of
  2026-08-10 they **still** never have, because Netlify is not invoking any
  scheduled function on this site. See the red section at the top. eBay's
  `price_push_enabled` was also `false`; the owner enabled it 2026-08-08. Three
  code defects fixed the same day — sold products were permanent eBay
  price-push candidates and produced ~33 guaranteed HTTP 400s per run
  (pool 124 → 88), `error_count` never incremented so nothing could back off
  (33 failures became 139 error rows in one run), and `err.detail` was
  discarded so every failure logged an unusable generic message. Etsy carried
  the same defects but is clean in practice because its auto-delist moves sold
  listings outside the selection; fixed there too. ✅ **Deployed 2026-08-17** —
  production runs the fixed code, so the 7:45 a.m. EDT eBay cron should stop
  repeating those failures. Worth confirming on its next run.
- ✅ **A disclosure bug, fixed and now live (was: fixed but undeployed):**
  any hidden product (archived / draft / pending_payment) was readable on
  production by appending `?returnTo=/admin` to its URL, with no session. The
  gate used a back-link validator as an authorization check. Found by the Deep
  Field team in a port of this code. It was the highest-priority item in the
  queue and is no longer outstanding — see TASKS and the DECISIONS rule *"A
  query parameter is never an authorization signal"*.
- **Deep Field Gallery is LIVE.** One-way outbound product push to a separate
  site, server-side only, sharing nothing but a bearer token — no Supabase
  credential crosses either way and NEJ never touches their database. The
  128-product / 974-image import into **production** is complete and reconciled
  exactly, the Netlify vars are set, and the hook is proven end to end (a save
  logs `[deepfield] synced 1 product(s)`). All environments write for real,
  including local dev, deliberately — so there is no sandbox unless
  `DEEPFIELD_SYNC_DRY_RUN=true` is set locally. The archived-product push and
  `image_count` went live 2026-08-17. Their hourly reconciliation cron — on
  *their* side, not ours — is built but not yet
  running, so hard deletes and dropped pushes currently depend on a manual poll.
  The hooks fire from admin save/status-change and both checkout sold-flip
  paths. See `features/deepfield-sync.md`.
- All scheduled-function badges were production-confirmed — **but the badge only
  proves registration, not execution.** As of 2026-08-10 none of them has ever
  actually run; see the red section at the top of this file. Do not read a
  Scheduled badge or a "Next execution" time as evidence that a cron works.
- eBay inventory #82 remains write-blocked pending deliberate reattachment to
  its external relist — now enforced in code by a pinned id
  (`EBAY_WRITE_BLOCKED_PRODUCT_IDS`) rather than inferred from a `last_error`
  string that any later write could clear. ✅ **The sold-hidden freshness bug is
  CLOSED — the repair ran 2026-08-11**, moving 36 mis-flagged rows
  `out_of_date` → `hidden_oos` with no eBay writes; 2 remain by design (no
  `last_pushed_qty = 0` marker). Remaining controlled marketplace checks are
  tracked in `TASKS.md`.
- **eBay listings are flagged `out_of_date` because the new tier fulfillment
  policies are part of the content hash.** The count read 123, which was wrong:
  the freshness scan was also hashing `hidden_oos` rows, so 36 sold-and-hidden
  listings were mis-flagged. That is fixed and self-repairing on the next scan;
  the true figure is **87 available listings, 86 writable (#82 is blocked) ≈ 4
  capped runs**. The daily price push cannot clear the flag (price/quantity
  only), so applying the new shipping requires deliberate batched syncs. Every
  bulk enqueue is now bounded to 25 items and drops write-blocked and
  non-available products first. No live eBay write has been made — this is an
  owner-run campaign from the deployed admin, starting with one drawer-level
  sync verified on eBay. See `features/ebay-sync.md`.

## Instagram And Facebook

- Both channels use one guided owner flow: curate caption/photos/card → **Save
  & prepare** → review → schedule or publish. Downstream actions stay hidden
  until the prepared review is current. The generated card is always slide 1.
- Captions share the reviewed wording while retaining channel-specific link and
  hashtag blocks. Instagram uses `Store link in bio` plus an `Item:` short link
  and a larger hashtag set; Facebook uses a clickable `Shop:` URL and three
  hashtags. Tiffany references normalize to `Tiffany & Co.` and
  `#tiffanyandco`; em/en dashes receive one space on both sides.
- AI openers are manual and steerable. Skipping generation keeps deterministic
  copy. Generated/editable text must be conversational, use “this” naturally,
  never say “our,” and must be saved into a new prepared review before publish.
- Photo/card curation previews the exact contain-to-square prepared framing,
  sampled canvas, and source crop. Prepared slides have a full-size keyboard
  viewer with arrows. Caption, wording, photos, or both can be synchronized
  between channels without publishing.
- Published status reconciles conservatively. Confirmed remote deletion clears
  published state; ambiguous token/permission/network failures do not. Facebook
  publish recovery is receipt/checkpoint-safe and avoids duplicate posts.
- Facebook uses a validated Page token for **Naples Estate Jewelry**; candidate
  tokens must pass app/Page/read-access checks and have at least 30 days of
  finite life. The locally connected token reported data access through
  2026-10-31 at last verification. Instagram uses its refreshable Business token.
- `/admin/social-queues` shows independent Instagram/Facebook queues, readiness,
  exact scheduled and approval times, worker health, and actions to edit,
  publish now, reschedule, or remove without discarding prepared copy.
- Allowed Eastern posting times are **noon, 2 PM, 4 PM, 6 PM, 8 PM, 10 PM, and
  midnight**. UI, API validation, defaults, dashboard copy, and both Netlify
  workers share that allowlist. Due-row queries prevent early publishing across
  EDT/EST coverage hours.
- The queues have no owner-configured or application-enforced daily post cap.
  Each worker invocation processes at most 25 due rows as a runtime safety
  bound and later invocations continue any remainder. Instagram can still defer
  a post when Meta reports its provider-enforced rolling publishing quota.
- Queue **Post now** runs in a route-persistent lower-right background widget.
  Each channel also supports selecting any ready queued rows and posting the
  selection now with one confirmation. Bulk posts run sequentially in visible
  queue order. Only one social publish or batch runs per tab; success auto-
  closes, while a failed batch stops and can resume at its failed item without
  reposting completed entries.
- Social Queues also exposes **Latest Posts**, a modal backed by the 12 newest
  locally published receipts per channel. It supports live-post links, manager
  links, conservative status refresh, public owner-written comments, permanent
  Facebook removal with confirmation, and Instagram's honest manual-removal
  handoff. The Instagram and Facebook headers independently collapse their full
  sections so long histories can be managed one channel at a time. No comment
  text is persisted locally; only an audit outcome is logged.
- Signed-in 2026-08-03 QA observed item 39 queued on both channels at 6 PM EDT.
  The seven-choice Instagram picker was opened and cancelled; no reservation,
  queue state, or public post changed. At 600px and 900px, all four row-action
  labels stayed inside their responsive two-column button grid.

## Security And Operations

- Secrets stay in gitignored local environment files, Netlify environment
  contexts, or encrypted provider rows. Only public Supabase values reach the
  browser. Project docs record locations and variable names, never values.
- Public mutation routes use validation plus edge/distributed rate limiting;
  scanner probes are blocked. Security headers are defense in depth.
- Netlify environment values are the operating configuration; local
  `.env.local` is for development only. ⚠️ "`.env.local` is stale" is a
  tie-breaker rule, **not a blanket fact** — on 2026-08-11 the owner confirmed
  its four `*_CRON_SECRET` values matched Netlify's production values exactly.
  Check before assuming a local value is wrong.
- Generated build output, caches, logs, temp files, and dependencies remain
  ignored. No scratch artifact was left by the 2026-08-03 session.
- Project memory has one current source per feature. The retired Etsy/eBay plan
  folders, kickoff notes, legacy-removal report, and obsolete carousel handoff
  were removed after their live guidance was consolidated into feature docs.

## Immediate Priorities

1. ✅ **The in-app-browser viewport jump is FIXED and owner-confirmed
   (2026-08-18).** Root cause was that **`svh` is not stable in an in-app
   browser** — `vh`/`svh`/`dvh` all resolve to one moving number in Instagram's
   iOS webview. Replaced by the `--app-vh` token. The temporary diagnostic has
   been removed. See `TASKS.md` and DECISIONS.
2. **Deploy the viewport-jump batch.** ✅ Staging is CURRENT — rebuilt after this
   session, **854 files / 19.59 MB**, 0 Extras / 0 FAILED, follow-up dry run
   0-copy. Then run the rest of the focused production smoke list in `TASKS.md`,
   plus the three never-looked-at items (Visit Us smooth scroll, copy-address
   clipboard, review-marquee loop).
3. Complete accountant review before changing Florida surtax or other-state tax.
4. Run the controlled PayPal recovery/refund/concurrency matrix.
5. ✅ Marketplace price-push and shipping-tier work is **DONE** (2026-08-11).
   What remains is owner-side only: eBay **#82** reattachment on eBay itself.
6. Finish the owner/content/credential-record items in `TASKS.md`.
7. ✅ Deep Field env vars + production import are DONE (2026-08-08). Remaining
   Deep Field items are the budget-pin test and the 30→50 retune in `TASKS.md`.
