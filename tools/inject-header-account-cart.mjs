/**
 * Pre-render Mi Cuenta / Carrito (and EN equivalents) in desktop + mobile nav
 * so site-header.js does not cause layout shift on load.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const DESKTOP_ES = `      <a class="text-[#5e5e5d] hover:text-[#735c00] font-label-md text-label-md transition-colors px-1 py-2" href="/es/account.html">Mi Cuenta</a>
      <a class="text-[#5e5e5d] hover:text-[#735c00] font-label-md text-label-md transition-colors px-1 py-2" href="/es/cart.html">Carrito (<span data-header-cart-count>0</span>)</a>
`;

const DESKTOP_EN = `      <a class="text-[#5e5e5d] hover:text-[#735c00] font-label-md text-label-md transition-colors px-1 py-2" href="account.html">My Account</a>
      <a class="text-[#5e5e5d] hover:text-[#735c00] font-label-md text-label-md transition-colors px-1 py-2" href="cart.html">Cart (<span data-header-cart-count>0</span>)</a>
`;

const MOBILE_ES = `<a class="text-[#735c00] font-label-md py-3 border-b border-[#d8d0c2]" href="/es/cart.html">Carrito (<span data-header-cart-count>0</span>)</a><a class="text-[#735c00] font-label-md py-3 border-b border-[#d8d0c2]" href="/es/account.html">Mi Cuenta</a>`;

const MOBILE_EN = `<a class="text-[#735c00] font-label-md py-3 border-b border-[#d8d0c2]" href="cart.html">Cart (<span data-header-cart-count>0</span>)</a><a class="text-[#735c00] font-label-md py-3 border-b border-[#d8d0c2]" href="account.html">My Account</a>`;

function collectHtmlFiles(dir, base = "") {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.join(base, name);
    if (fs.statSync(full).isDirectory()) {
      if (name === "es") out.push(...collectHtmlFiles(full, rel));
      continue;
    }
    if (name.endsWith(".html")) out.push({ full, rel });
  }
  return out;
}

function patchFile(filePath, isEs) {
  let html = fs.readFileSync(filePath, "utf8");
  if (!html.includes("site-header-nav")) return false;

  const accountHref = isEs ? "/es/account.html" : 'href="account.html"';
  const cartMarker = isEs ? "/es/cart.html" : 'href="cart.html"';
  let changed = false;

  if (!html.includes(accountHref) && html.includes("</nav>")) {
    const desktop = isEs ? DESKTOP_ES : DESKTOP_EN;
    const navClose = html.indexOf("</nav>");
    const navStart = html.lastIndexOf("<nav", navClose);
    if (navStart >= 0 && navStart < navClose) {
      html = html.slice(0, navClose) + "\n" + desktop + html.slice(navClose);
      changed = true;
    }
  }

  const mobileBlock = isEs ? MOBILE_ES : MOBILE_EN;
  if (!html.includes(cartMarker + '">Carrito') && !html.includes(cartMarker + '">Cart')) {
    // mobile: insert before closing </div></div> of #mobile-menu when menu exists
    const menuId = 'id="mobile-menu"';
    if (html.includes(menuId)) {
      const menuIdx = html.indexOf(menuId);
      const afterMenu = html.indexOf(">", menuIdx) + 1;
      const closePattern = "</div></div>";
      let searchFrom = afterMenu;
      let closeIdx = -1;
      // find the closing pair for mobile-menu inner structure
      const menuOpen = html.indexOf("<div", afterMenu);
      if (menuOpen > 0) {
        closeIdx = html.indexOf(closePattern, menuOpen);
        if (closeIdx > 0 && !html.slice(menuOpen, closeIdx).includes("data-header-cart-count")) {
          html = html.slice(0, closeIdx) + mobileBlock + html.slice(closeIdx);
          changed = true;
        } else if (closeIdx > 0 && html.slice(menuOpen, closeIdx).includes(accountHref) === false) {
          html = html.slice(0, closeIdx) + mobileBlock + html.slice(closeIdx);
          changed = true;
        }
      }
    }
  } else if (html.includes(cartMarker) && !html.includes(accountHref)) {
    const menuId = 'id="mobile-menu"';
    if (html.includes(menuId)) {
      const menuIdx = html.indexOf(menuId);
      const closeIdx = html.indexOf("</div></div>", menuIdx);
      if (closeIdx > 0) {
        const accountOnly = isEs
          ? `<a class="text-[#735c00] font-label-md py-3 border-b border-[#d8d0c2]" href="/es/account.html">Mi Cuenta</a>`
          : `<a class="text-[#735c00] font-label-md py-3 border-b border-[#d8d0c2]" href="account.html">My Account</a>`;
        html = html.slice(0, closeIdx) + accountOnly + html.slice(closeIdx);
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, html, "utf8");
    console.log("patched", filePath);
  }
  return changed;
}

let count = 0;
for (const { full, rel } of collectHtmlFiles(root)) {
  if (patchFile(full, rel.startsWith("es" + path.sep) || rel.startsWith("es\\"))) count++;
}

// root-level EN html (not in es/)
for (const name of fs.readdirSync(root)) {
  if (!name.endsWith(".html")) continue;
  if (patchFile(path.join(root, name), false)) count++;
}

console.log("done, files changed:", count);
