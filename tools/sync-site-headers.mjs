/**
 * Replace site headers with the canonical homepage nav (EN index.html / ES es/index.html).
 * Keeps per-page active states; includes Home/Inicio on every page (highlighted on index).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const DESKTOP_INACTIVE =
  "text-[#5e5e5d] hover:text-[#735c00] font-label-md text-label-md transition-colors px-1 py-2";
const DESKTOP_ACTIVE =
  "text-[#735c00] border-b border-[#735c00]/40 font-label-md text-label-md transition-colors px-1 py-2";
const MOBILE_INACTIVE =
  "text-[#1a1c1c] hover:text-[#735c00] font-label-md py-3 border-b border-[#d8d0c2]";
const MOBILE_ACTIVE = "text-[#735c00] font-label-md py-3 border-b border-[#d8d0c2]";
function resolveActivePage(filename) {
  const f = filename.toLowerCase();
  if (f === "product.html") return "shop.html";
  if (f === "account-dashboard.html") return "account.html";
  if (
    f === "estate-jewelry.html" ||
    f === "gold-services.html" ||
    f === "silver-services.html" ||
    f === "bullion.html"
  ) {
    return "what-we-buy.html";
  }
  return f;
}

function dClass(active) {
  return active ? DESKTOP_ACTIVE : DESKTOP_INACTIVE;
}

function mClass(active) {
  return active ? MOBILE_ACTIVE : MOBILE_INACTIVE;
}

function langUrls(filename) {
  return {
    enUrl: filename === "index.html" ? "/index.html" : `/${filename}`,
    esUrl: filename === "index.html" ? "/es/index.html" : `/es/${filename}`,
  };
}

function langTwin(isEs, filename) {
  const { enUrl, esUrl } = langUrls(filename);
  return isEs ? enUrl : esUrl;
}

function langToggleDesktop(isEs, filename) {
  const { enUrl, esUrl } = langUrls(filename);
  const aria = isEs ? "Cambiar idioma" : "Switch language";
  const enCurrent = isEs ? "" : " is-current";
  const esCurrent = isEs ? " is-current" : "";
  const enAria = isEs ? "" : ' aria-current="true"';
  const esAria = isEs ? ' aria-current="true"' : "";
  return `<span data-lang-toggle="" class="lang-toggle inline-flex items-center gap-1 font-label-md text-label-md uppercase tracking-widest px-2 py-2" aria-label="${aria}"><span class="material-symbols-outlined" style="font-size:18px;line-height:1;" aria-hidden="true">language</span><a class="lang-opt${enCurrent}" href="${enUrl}" title="View this page in English"${enAria}>EN</a><span class="lang-sep" aria-hidden="true">/</span><a class="lang-opt${esCurrent}" href="${esUrl}" title="Ver esta página en español"${esAria}>ES</a></span>`;
}

function langToggleMobile(isEs, filename) {
  const twin = langTwin(isEs, filename);
  const label = isEs ? "English" : "Español";
  return `<a data-lang-toggle-mobile="" href="${twin}" class="text-[#735c00] font-label-md py-3 border-b border-[#d8d0c2]">${label}</a>`;
}

function buildHeader(isEs, activePage, filename) {
  const isHome = activePage === "index.html";
  const p = (href) => (isEs ? `/es/${href}` : href);
  const img = isEs
    ? "/assets/images/branding/logo.webp"
    : "assets/images/branding/logo.webp";
  const brandHref = p("index.html");
  const alt = isEs
    ? "Logotipo de Naples Estate Jewelry"
    : "Naples Estate Jewelry Logo";

  const L = isEs
    ? {
        home: "Inicio",
        shop: "Tienda",
        sell: "Véndanos",
        ej: "Joyería de Patrimonio",
        gold: "Servicios de Oro",
        silver: "Servicios de Plata",
        bullion: "Lingotes",
        about: "Sobre Nosotros",
        services: "Servicios",
        fe: "Evaluación Gratuita",
        estateSvc: "Servicios de Patrimonio",
        contact: "Contacto",
        account: "Mi Cuenta",
        cart: "Carrito",
        call: "Llámenos",
        menu: "Menú",
        menuAria: "Abrir menú",
        news: "Suscríbase a La Lista",
        appt: "Solicite una Llamada",
      }
    : {
        home: "Home",
        shop: "Shop",
        sell: "Sell To Us",
        ej: "Estate Jewelry",
        gold: "Gold Services",
        silver: "Silver Services",
        bullion: "Bullion",
        about: "About Us",
        services: "Services",
        fe: "Free Evaluation",
        estateSvc: "Estate Services",
        contact: "Contact",
        account: "My Account",
        cart: "Cart",
        call: "Call Now",
        menu: "Menu",
        menuAria: "Open menu",
        news: "Subscribe to The List",
        appt: "Request a Call",
      };

  const homeActive = isHome;
  const shopActive = activePage === "shop.html";
  const sellActive = activePage === "what-we-buy.html";
  const aboutActive = activePage === "about.html";
  const servicesActive =
    activePage === "free-evaluation.html" || activePage === "estate-services.html";
  const contactActive = activePage === "contact.html";
  const accountActive = activePage === "account.html";
  const cartActive = activePage === "cart.html";

  const desktopNav = `    <nav class="site-header-nav hidden 2xl:flex items-center gap-5">
      <a class="${dClass(homeActive)}" href="${brandHref}">${L.home}</a>
      <a class="${dClass(shopActive)}" href="${p("shop.html")}">${L.shop}</a>
      <div class="nav-buy-group"><a class="${dClass(sellActive)}" href="${p("what-we-buy.html")}">${L.sell}</a><div class="nav-buy-panel"><a href="${p("estate-jewelry.html")}">${L.ej}</a><a href="${p("gold-services.html")}">${L.gold}</a><a href="${p("silver-services.html")}">${L.silver}</a><a href="${p("bullion.html")}">${L.bullion}</a></div></div>
      <a class="${dClass(aboutActive)}" href="${p("about.html")}">${L.about}</a>
      <div class="nav-buy-group"><a class="${dClass(servicesActive)}" href="${p("free-evaluation.html")}">${L.services}</a><div class="nav-buy-panel"><a href="${p("free-evaluation.html")}">${L.fe}</a><a href="${p("estate-services.html")}">${L.estateSvc}</a></div></div>
      <a class="${dClass(contactActive)}" href="${p("contact.html")}">${L.contact}</a>
      <a class="${dClass(accountActive)}" href="${p("account.html")}">${L.account}</a>
      <a class="${dClass(cartActive)}" href="${p("cart.html")}">${L.cart} (<span data-header-cart-count>0</span>)</a>
    </nav>`;

  const langDesktop = langToggleDesktop(isEs, filename);
  const langMobile = langToggleMobile(isEs, filename);

  const mobileNav = `<div id="mobile-menu" class="hidden 2xl:hidden border-t border-[#d8d0c2] bg-[#f9f9f7]/98"><div class="flex flex-col px-5 py-4"><a class="${mClass(homeActive)}" href="${brandHref}">${L.home}</a><a class="${mClass(shopActive)}" href="${p("shop.html")}">${L.shop}</a><a class="${mClass(sellActive)}" href="${p("what-we-buy.html")}">${L.sell}</a><a class="mobile-subitem" href="${p("estate-jewelry.html")}">${L.ej}</a><a class="mobile-subitem" href="${p("gold-services.html")}">${L.gold}</a><a class="mobile-subitem" href="${p("silver-services.html")}">${L.silver}</a><a class="mobile-subitem" href="${p("bullion.html")}">${L.bullion}</a><a class="${mClass(aboutActive)}" href="${p("about.html")}">${L.about}</a><a class="${mClass(servicesActive)}" href="${p("free-evaluation.html")}">${L.services}</a><a class="mobile-subitem" href="${p("free-evaluation.html")}">${L.fe}</a><a class="mobile-subitem" href="${p("estate-services.html")}">${L.estateSvc}</a><a class="${mClass(contactActive)}" href="${p("contact.html")}">${L.contact}</a><a class="${mClass(false)}" href="${brandHref}#newsletter">${L.news}</a><a class="${mClass(false)}" href="${brandHref}#appointment">${L.appt}</a><a class="${mClass(cartActive)}" href="${p("cart.html")}">${L.cart} (<span data-header-cart-count>0</span>)</a><a class="${mClass(accountActive)}" href="${p("account.html")}">${L.account}</a>${langMobile}</div></div>`;

  return `  <header class="site-header site-header--light fixed top-0 w-full z-50 bg-[#f9f9f7]/95 border-b border-[#d8d0c2]">
  <div class="site-header-bar flex items-center justify-between gap-3 px-4 md:px-8 py-4 md:py-5 w-full max-w-[1440px] mx-auto">
    <a href="${brandHref}" class="site-brand-link flex items-center gap-3 min-w-0">
      <img src="${img}" alt="${alt}" class="site-brand-logo h-10 w-auto object-contain flex-shrink-0" />
      <span class="site-brand-text font-display-lg-mobile text-[18px] md:text-[23px] tracking-normal text-[#735c00] uppercase">
        <span class="site-brand-short">Naples Estate Jewelry</span>
        <span class="site-brand-full">Naples Estate Jewelry</span>
      </span>
    </a>
${desktopNav}
    <div class="site-header-actions flex items-center gap-3">${langDesktop}<a href="tel:2394048505" class="header-cta-call editorial-call-button hidden 2xl:inline-flex px-5 py-2 font-label-md text-label-md uppercase tracking-widest transition-colors">${L.call}</a><button id="mobile-menu-toggle" type="button" aria-expanded="false" aria-label="${L.menuAria}" class="site-menu-toggle 2xl:hidden border border-[#735c00]/50 text-[#735c00] px-3 py-2 font-label-md text-label-md uppercase tracking-widest"><span class="menu-toggle-label" id="mobile-menu-icon">${L.menu}</span></button></div>
  </div>
  ${mobileNav}
</header>`;
}

function patchFile(filePath, isEs) {
  let html = fs.readFileSync(filePath, "utf8");
  if (!html.includes("site-header-nav")) return false;

  const filename = path.basename(filePath);
  const activePage = resolveActivePage(filename);
  const newHeader = buildHeader(isEs, activePage, filename);

  const re = /<header class="site-header[\s\S]*?<\/header>/;
  if (!re.test(html)) return false;

  const updated = html.replace(re, newHeader);
  if (updated === html) return false;

  fs.writeFileSync(filePath, updated, "utf8");
  return true;
}

const targets = [];
for (const name of fs.readdirSync(root)) {
  if (name.endsWith(".html")) targets.push({ file: path.join(root, name), isEs: false });
}
const esDir = path.join(root, "es");
for (const name of fs.readdirSync(esDir)) {
  if (name.endsWith(".html")) targets.push({ file: path.join(esDir, name), isEs: true });
}

const EN_HEAD_ASSETS = `  <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
  <link href="https://fonts.googleapis.com/css2?family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&family=Hanken+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
  <script src="scripts/shared/editorial-tailwind-config.js"></script>
  <link href="editorial-base.css" rel="stylesheet" />
  <link href="editorial-theme.css?v=header-sync-20260602" rel="stylesheet" />
  <script src="scripts/shared/site-header.js?v=header-sync-20260603" defer></script>`;

const ES_HEAD_ASSETS = `  <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
  <link href="https://fonts.googleapis.com/css2?family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&family=Hanken+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
  <script src="/scripts/shared/editorial-tailwind-config.js"></script>
  <link href="/editorial-base.css" rel="stylesheet" />
  <link href="/editorial-theme.css?v=header-sync-20260602" rel="stylesheet" />
  <script src="/scripts/shared/site-header.js?v=header-sync-20260603" defer></script>`;

function injectMemberAccessHeader(filePath, isEs) {
  let html = fs.readFileSync(filePath, "utf8");
  if (html.includes("site-header-nav")) return false;

  const filename = path.basename(filePath);
  const header = buildHeader(isEs, resolveActivePage(filename), filename);
  const assets = isEs ? ES_HEAD_ASSETS : EN_HEAD_ASSETS;

  html = html.replace(
    /<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>[\s\S]*?<\/head>/,
    `${assets}\n</head>`
  );
  html = html.replace(
    /(<body[^>]*>)\s*<main class="min-h-screen py-16">/,
    `$1\n${header}\n  <main class="pt-28 md:pt-32 pb-16 min-h-screen">`
  );
  fs.writeFileSync(filePath, html);
  return true;
}

let count = 0;
for (const { file, isEs } of targets) {
  if (patchFile(file, isEs)) {
    console.log("synced", path.relative(root, file));
    count++;
  }
}

for (const [rel, isEs] of [
  ["member-access.html", false],
  ["es/member-access.html", true],
]) {
  const file = path.join(root, rel);
  if (fs.existsSync(file) && injectMemberAccessHeader(file, isEs)) {
    console.log("injected header", rel);
    count++;
  }
}

console.log("done:", count, "files");
