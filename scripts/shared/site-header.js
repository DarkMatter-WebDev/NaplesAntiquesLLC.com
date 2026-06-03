(function () {
  var btn = document.getElementById("mobile-menu-toggle");
  var menu = document.getElementById("mobile-menu");
  var icon = document.getElementById("mobile-menu-icon");
  var currentPage = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (!currentPage || currentPage === "es") {
    currentPage = "index.html";
  }
  var activePage = currentPage;
  var ES = (document.documentElement.getAttribute("lang") || "").toLowerCase().indexOf("es") === 0;

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

  function appendDesktopLink(nav, href, label, extraHtml) {
    if (!nav || nav.querySelector('a[href="' + href + '"]')) return;
    var link = document.createElement("a");
    link.className = "text-[#5e5e5d] hover:text-[#735c00] font-label-md text-label-md transition-colors px-1 py-2";
    link.href = href;
    link.innerHTML = label + (extraHtml || "");
    nav.appendChild(link);
  }

  function appendMobileLink(menuInner, href, label, extraHtml) {
    if (!menuInner || menuInner.querySelector('a[href="' + href + '"]')) return;
    var link = document.createElement("a");
    link.className = "text-[#735c00] font-label-md py-3 border-b border-[#d8d0c2]";
    link.href = href;
    link.innerHTML = label + (extraHtml || "");
    menuInner.appendChild(link);
  }

  function addAccountAndCartLinks() {
    var desktopNav = document.querySelector(".site-header-nav");
    var mobileInner = document.querySelector("#mobile-menu > div");
    var cartCount = ' (<span data-header-cart-count>0</span>)';

    var accountLabel = ES ? "Mi Cuenta" : "My Account";
    var cartLabel = ES ? "Carrito" : "Cart";

    appendDesktopLink(desktopNav, navPrefix + "account.html", accountLabel);
    appendDesktopLink(desktopNav, navPrefix + "cart.html", cartLabel, cartCount);
    appendMobileLink(mobileInner, navPrefix + "cart.html", cartLabel, cartCount);
    appendMobileLink(mobileInner, navPrefix + "account.html", accountLabel);
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

  addAccountAndCartLinks();
  addLanguageToggle();

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
