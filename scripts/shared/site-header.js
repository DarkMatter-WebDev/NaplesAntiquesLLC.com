(function () {
  var btn = document.getElementById("mobile-menu-toggle");
  var menu = document.getElementById("mobile-menu");
  var icon = document.getElementById("mobile-menu-icon");
  var currentPage = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (!currentPage || currentPage === "es") {
    currentPage = "index.html";
  }
  var activePage = currentPage;
  var ES =
    (document.documentElement.getAttribute("lang") || "").toLowerCase().indexOf("es") === 0 ||
    /^\/es(\/|$)/.test(window.location.pathname || "");

  var navPrefix = ES ? "/es/" : "";

  if (currentPage === "product.html") {
    activePage = "shop.html";
  }
  if (currentPage === "account-dashboard.html") {
    activePage = "account.html";
  }
  if (
    currentPage === "estate-jewelry.html" ||
    currentPage === "gold-services.html" ||
    currentPage === "silver-services.html" ||
    currentPage === "bullion.html"
  ) {
    activePage = "what-we-buy.html";
  }

  function readCartCount() {
    try {
      var items = JSON.parse(window.localStorage.getItem("naplesShopCart") || "[]");
      return Array.isArray(items) ? items.filter(Boolean).length : 0;
    } catch (error) {
      return 0;
    }
  }

  function updateHeaderCartCounts() {
    var count = readCartCount();
    document.querySelectorAll("[data-header-cart-count]").forEach(function (el) {
      el.textContent = String(count);
    });
  }

  function isAccountNavLink(link) {
    var href = (link.getAttribute("href") || "").split("#")[0].toLowerCase();
    return href === "account.html" || href.endsWith("/account.html");
  }

  /** Remove duplicate cart rows if HTML + legacy scripts both added them. */
  function dedupeHeaderCartLinks() {
    document.querySelectorAll(".site-header-nav, #mobile-menu > div").forEach(function (container) {
      var cartLinks = Array.from(container.querySelectorAll("a[href]")).filter(function (link) {
        return link.querySelector("[data-header-cart-count]");
      });
      for (var i = 1; i < cartLinks.length; i++) {
        cartLinks[i].remove();
      }
    });
  }

  /** Remove duplicate My Account / Mi Cuenta rows (same root cause as cart). */
  function dedupeHeaderAccountLinks() {
    document.querySelectorAll(".site-header-nav, #mobile-menu > div").forEach(function (container) {
      var accountLinks = Array.from(container.querySelectorAll("a[href]")).filter(isAccountNavLink);
      for (var i = 1; i < accountLinks.length; i++) {
        accountLinks[i].remove();
      }
    });
  }

  /** Nav account/cart links are baked into HTML via sync-site-headers; only sync counts + dedupe. */
  function ensureHeaderNavLinks() {
    dedupeHeaderCartLinks();
    dedupeHeaderAccountLinks();
    updateHeaderCartCounts();
  }

  function getLanguageTwin() {
    var path = window.location.pathname;
    var isEs = /^\/es(\/|$)/.test(path);
    var twin;
    if (isEs) {
      twin = path.replace(/^\/es(?=\/|$)/, "");
      if (!twin || twin === "/") twin = "/index.html";
    } else {
      if (!path || path === "/") twin = "/es/index.html";
      else twin = "/es" + path;
    }
    return { isEs: isEs, twin: twin };
  }

  function addLanguageToggle() {
    var info = getLanguageTwin();
    var self = window.location.pathname || "/";
    var enUrl = info.isEs ? info.twin : self;
    var esUrl = info.isEs ? self : info.twin;

    var actions = document.querySelector(".site-header-actions");
    if (actions && !actions.querySelector("[data-lang-toggle]")) {
      var wrap = document.createElement("span");
      wrap.setAttribute("data-lang-toggle", "");
      wrap.className = "lang-toggle inline-flex items-center gap-1 font-label-md text-label-md uppercase tracking-widest px-2 py-2";
      wrap.setAttribute("aria-label", info.isEs ? "Cambiar idioma" : "Switch language");

      var globe = '<span class="material-symbols-outlined" style="font-size:18px;line-height:1;">language</span>';
      var en = '<a class="lang-opt' + (info.isEs ? "" : " is-current") + '" href="' + enUrl + '" title="View this page in English"' + (info.isEs ? "" : ' aria-current="true"') + ">EN</a>";
      var sep = '<span class="lang-sep" aria-hidden="true">/</span>';
      var es = '<a class="lang-opt' + (info.isEs ? " is-current" : "") + '" href="' + esUrl + '" title="Ver esta página en español"' + (info.isEs ? ' aria-current="true"' : "") + ">ES</a>";
      wrap.innerHTML = globe + en + sep + es;
      actions.insertBefore(wrap, actions.firstChild);
    }

    var mobileInner = document.querySelector("#mobile-menu > div");
    if (mobileInner && !mobileInner.querySelector("[data-lang-toggle-mobile]")) {
      var mlink = document.createElement("a");
      mlink.setAttribute("data-lang-toggle-mobile", "");
      mlink.href = info.twin;
      mlink.className = "text-[#735c00] font-label-md py-3 border-b border-[#d8d0c2]";
      mlink.textContent = info.isEs ? "English" : "Español";
      mobileInner.appendChild(mlink);
    }
  }

  function rewireBrandLogo() {
    var brandLink = document.querySelector('a.site-brand-link');
    if (!brandLink) return;
    var logo = brandLink.querySelector('img.site-brand-logo');
    var brandText = brandLink.querySelector('.site-brand-text');
    if (!logo || !brandText) return;

    var wrapper = document.createElement('div');
    wrapper.className = brandLink.className;

    var logoAnchor = document.createElement('a');
    logoAnchor.href = 'https://naplesjewelrybuyers.com';
    logoAnchor.target = '_blank';
    logoAnchor.rel = 'noopener noreferrer';
    logoAnchor.setAttribute('aria-label', 'Visit Naples Jewelry Buyers');
    logoAnchor.appendChild(logo);

    var textAnchor = document.createElement('a');
    textAnchor.href = brandLink.getAttribute('href') || '/';
    textAnchor.className = 'flex items-center min-w-0';
    textAnchor.appendChild(brandText);

    wrapper.appendChild(logoAnchor);
    wrapper.appendChild(textAnchor);
    brandLink.parentNode.replaceChild(wrapper, brandLink);
  }

  function initMobileSubmenus() {
    var mobileInner = document.querySelector('#mobile-menu > div');
    if (!mobileInner) return;

    var allLinks = Array.from(mobileInner.querySelectorAll('a'));
    allLinks.forEach(function (link) {
      if (link.classList.contains('mobile-subitem')) return;

      var group = [];
      var next = link.nextElementSibling;
      while (next && next.classList.contains('mobile-subitem')) {
        group.push(next);
        next = next.nextElementSibling;
      }
      if (!group.length) return;

      group.forEach(function (item) { item.style.display = 'none'; });

      var wrapper = document.createElement('div');
      wrapper.style.cssText = 'display:flex;align-items:center;border-bottom:1px solid #d8d0c2;';
      link.style.borderBottom = 'none';
      link.style.flex = '1';

      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Expand submenu');
      toggle.style.cssText = 'background:none;border:none;padding:0.75rem 0.5rem;cursor:pointer;color:#735c00;display:flex;align-items:center;flex-shrink:0;';
      toggle.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px;line-height:1;transition:transform 0.2s;">expand_more</span>';

      link.parentNode.insertBefore(wrapper, link);
      wrapper.appendChild(link);
      wrapper.appendChild(toggle);

      var expanded = false;
      toggle.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        expanded = !expanded;
        toggle.setAttribute('aria-expanded', String(expanded));
        var chevron = toggle.querySelector('.material-symbols-outlined');
        if (chevron) chevron.style.transform = expanded ? 'rotate(180deg)' : '';
        group.forEach(function (item) { item.style.display = expanded ? '' : 'none'; });
      });
    });
  }

  ensureHeaderNavLinks();
  addLanguageToggle();
  rewireBrandLogo();
  initMobileSubmenus();

  document.querySelectorAll(".site-header a[href]").forEach(function (link) {
    if (link.closest("[data-lang-toggle]")) return;
    var hrefPage = (link.getAttribute("href") || "").split("#")[0].split("/").pop().toLowerCase();
    if (hrefPage === activePage) {
      link.classList.add("is-current-page");
    }
  });

  if (!btn || !menu) return;

  function setMenuOpen(open) {
    menu.classList.toggle("hidden", !open);
    var label = open ? "Close" : "Menu";
    if (icon) {
      icon.textContent = label;
    } else {
      var labelEl = btn.querySelector(".menu-toggle-label");
      if (labelEl) labelEl.textContent = label;
      else btn.textContent = label;
    }
    btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  btn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(menu.classList.contains("hidden"));
  });

  menu.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      setMenuOpen(false);
    });
  });

  window.addEventListener("storage", function (event) {
    if (event.key === "naplesShopCart") {
      updateHeaderCartCounts();
    }
  });
  window.addEventListener("shopcart:updated", updateHeaderCartCounts);
})();
