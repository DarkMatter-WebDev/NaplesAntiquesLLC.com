# Naples Estate Jewelry — Language Guide

**Version:** 1.0 (2026-06-02)  
**Purpose:** Keep English and Spanish site copy aligned in terminology, tone, and placement rules.

---

## Language Consistency Protocol (required for all content work)

1. **Before starting:** Read this file. If a term is missing, add it before closing the task.
2. **After any create/edit that affects user-facing copy:**
   - List every **English file** and its **Spanish counterpart** (`/es/…`) touched or implied by the change.
   - Cross-check glossary, tone, and “do not translate” rules in **both** languages.
   - **Flag inconsistencies** in your handoff (do not silently “fix” without noting what changed).
3. **Task is not complete** until both language versions are reviewed.

### Page pairs (EN root ↔ ES `/es/`)

| English | Spanish |
|---------|---------|
| `index.html` | `es/index.html` |
| `shop.html` | `es/shop.html` |
| `product.html` | `es/product.html` |
| `what-we-buy.html` | `es/what-we-buy.html` |
| `estate-jewelry.html` | `es/estate-jewelry.html` |
| `gold-services.html` | `es/gold-services.html` |
| `silver-services.html` | `es/silver-services.html` |
| `bullion.html` | `es/bullion.html` |
| `free-evaluation.html` | `es/free-evaluation.html` |
| `estate-services.html` | `es/estate-services.html` |
| `about.html` | `es/about.html` |
| `contact.html` | `es/contact.html` |
| `faq.html` | `es/faq.html` |
| `cart.html` | `es/cart.html` |
| `account.html` | `es/account.html` |
| `account-dashboard.html` | `es/account-dashboard.html` |
| `member-access.html` | `es/member-access.html` |
| `privacy.html` | `es/privacy.html` |
| `es/contact.html` | Netlify submit-item form labels and upload copy |

---

## Regional Spanish

- **Variant:** **Latin American Spanish** oriented to **U.S. Southwest Florida** (Naples area), not Castilian (Spain).
- **Address:** Formal **usted** for CTAs and service copy (`Obtenga`, `Envíe`, `Póngase`, `Llame`, `Sepa`).
- **Avoid:** Vosotros, vos, and European-only terms (e.g. *móvil* for phone in nav—prefer *Llame* / *teléfono* in context).
- **Place names:** Keep **Naples**, **Southwest Florida**, **Marco Island**, etc. in English; optional descriptor in Spanish: *Suroeste de Florida*.
- **Industry terms:** Prefer widely understood LATAM/US terms (*lingotes*, *plata de ley*, *patrimonio* for *estate* in “estate jewelry/services”).

---

## Tone and voice

### English
- Confident, calm, expert—not pushy.
- Short sentences; active voice.
- Emphasize: **private**, **appointment-only**, **no pressure**, **live market**, **same-day payment** where true.
- CTAs: clear action (`Send Photos`, `Get an Offer`)—avoid vague “Click here.”

### Spanish
- Match English intent: professional, reassuring, **sin presión**.
- Same level of formality (usted).
- Parallel structure to EN headings and CTAs where possible.
- Do not inflate copy; Spanish may run longer—tighten wording rather than shrinking font.

---

## Do NOT translate

Keep in **English** (or as proper nouns) in both locales unless a listed glossary entry says otherwise:

| Item | Notes |
|------|--------|
| **Naples Estate Jewelry** | Brand name |
| **Naples** (city) | Proper noun |
| Phone **(239) 404-8505** | Digits unchanged |
| **TradingView** | Product name |
| **OANDA:** symbol prefixes | Widget config |
| **MailerLite**, **Calendly**, **Tawk.to** | Integrations |
| **EN** / **ES** | Language toggle labels |
| Social / review URLs | As linked |
| **Dark Matter Web Services** | Footer credit (English acceptable in ES footer) |

**Metal names on TradingView widgets:** Widget API often requires English `description` strings; page **headings** and **body** use Spanish metal names per glossary.

---

## Glossary (English ↔ Spanish)

### Navigation and chrome

| English (EN) | Spanish (ES) | Usage |
|--------------|--------------|--------|
| Home | Inicio | Top nav only |
| Shop | Tienda | Nav |
| Sell To Us | Véndanos | Nav parent |
| Estate Jewelry | Joyería de Patrimonio | Nav child |
| Gold Services | Servicios de Oro | Nav child |
| Silver Services | Servicios de Plata | Nav child |
| Bullion | Lingotes | Nav child |
| About Us | Sobre Nosotros | Nav |
| Services | Servicios | Nav parent (dropdown) |
| Free Evaluation | Evaluación Gratuita | Nav child / footer |
| Estate Services | Servicios de Patrimonio | Nav child / footer |
| **Contact** | **Contacto** | **Top nav only** |
| **Contact Us** | **Contáctenos** | **Page titles, H1 area, footers** |
| My Account | Mi Cuenta | Nav |
| Cart | Carrito | Nav |
| Call Now | Llámenos | Header CTA |
| Menu | Menú | Mobile toggle |
| Subscribe to The List | Suscríbase a La Lista | Mobile nav (if present) |
| Request a Call | Solicitar una Llamada | Mobile nav / CTAs |
| Privacy | Privacidad / Política de Privacidad | Footer |
| FAQ | Preguntas Frecuentes | Footer |
| Reviews | Reseñas | Footer |

### Homepage hero and CTAs

| English (EN) | Spanish (ES) | Notes |
|--------------|--------------|--------|
| Buy | Comprar | Hero pill |
| Sell | Vender | Hero pill |
| Trade | Intercambiar | Hero pill → `contact#submit-item` |
| Get an Offer | Obtenga una Oferta | Hero gold CTA |
| Send Photos | Envíe Fotos | Hero secondary |
| Get a Free Evaluation | Obtenga una Evaluación Gratuita | Homepage mid-page CTA |
| Get My Free Evaluation | Obtenga su Evaluación Gratuita | **Preferred** hero on `free-evaluation` page |
| Our Team · Direct Line · Call or Text | Nuestro Equipo · Línea Directa · Llame o Envíe un Mensaje | Phone block label |

> **Consistency note:** Use one evaluation CTA pair site-wide when possible. See § Known inconsistencies.

### Contact and forms

| English (EN) | Spanish (ES) |
|--------------|--------------|
| Submit your item | Envíe su artículo |
| Submit Your Item | Envíe Su Artículo |
| Send Photos Now | Envíe Fotos Ahora |
| Text a Photo | Envíe una Foto |
| Schedule consultation | Programe una consulta |
| Request a Call | Solicitar una Llamada |

### Bullion and live market

| English (EN) | Spanish (ES) | Notes |
|--------------|--------------|--------|
| View the charts | Ver los gráficos | Homepage floater label |
| Live market · Bullion | Mercado en vivo · Lingotes | Floater hint |
| View live prices | Ver precios en vivo | Inline link copy |
| Live Prices We Reference | Precios en Vivo que Consultamos | Bullion section H2 |
| Current Silver Rates | Precios Actuales de la Plata | Silver services CTA |
| Gold / Silver / Platinum / Palladium | Oro / Plata / Platino / Paladio | Body copy & chart headings |
| Spot | Spot | Keep *spot* in finance context or “precio spot” in prose |
| `#live-prices` (anchor) | `#live-prices` | **Metal ticker bar** (not chart grid) |
| `#live-charts` (anchor) | `#live-charts` | Four-up chart section |

### Free evaluation page

| English (EN) | Spanish (ES) |
|--------------|--------------|
| Free & No Obligation | Gratis y Sin Compromiso |
| How the Free Evaluation Works | Cómo Funciona la Evaluación Gratuita |
| Call or Text Chris | Llame o Escriba a Chris |
| Meet the team | Conozca al equipo |

### Service and trust phrases (recurring)

| English (EN) | Spanish (ES) |
|--------------|--------------|
| Mobile/Appointment Only | Solo con cita / a domicilio y solo con cita |
| live market | mercado en vivo |
| same-day payment | pago el mismo día |
| no pressure | sin presión |
| estate jewelry | joyería de patrimonio |
| sterling silver | plata de ley |

---

## URL and path conventions

- **English:** root-relative (`contact.html`, `bullion.html#live-prices`).
- **Spanish:** prefix `/es/` (`/es/contact.html`, `/es/bullion.html#live-prices`).
- **Language toggle:** EN link = English path; ES link = `/es/…` path for the **same page**.

---

## Known inconsistencies (flagged; fix in a dedicated pass)

| Issue | EN | ES | Recommendation |
|-------|----|----|----------------|
| Free evaluation CTA wording | Homepage: **Get a Free Evaluation**; `free-evaluation.html`: **Get My Free Evaluation** | Homepage: **Obtenga una…**; free-evaluation: **Obtenga su…** | Standardize on **Get My Free Evaluation** / **Obtenga su Evaluación Gratuita** everywhere, or **Get a…** / **Obtenga una…** everywhere |
| Widget label vs destination | Label: “View the charts”; link: `#live-prices` (ticker) | “Ver los gráficos” → ticker | Align copy: e.g. “View live prices” / “Ver precios en vivo”, or keep label and add subtext that mentions ticker |
| TradingView locale on ES bullion | `locale: "en"` in ticker embed | Same | Set to `"es"` if widget supports Spanish labels |
| Ticker symbol descriptions on ES | English “Gold”, “Silver” in JSON | English in JSON | Spanish headings on page are correct; widget labels may stay EN per API |

---

## Changelog (glossary additions)

| Date | Term(s) added |
|------|----------------|
| 2026-06-02 | Initial guide; `#live-prices`, `#live-charts`, floater widget strings, Contact/Contacto split, evaluation CTA variants documented |
