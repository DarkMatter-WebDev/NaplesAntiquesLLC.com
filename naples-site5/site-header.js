(function () {
  var btn = document.getElementById("mobile-menu-toggle");
  var menu = document.getElementById("mobile-menu");
  var icon = document.getElementById("mobile-menu-icon");
  var currentPage = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  var activePage = currentPage;

  document.querySelectorAll(".site-header-actions .header-cta-call").forEach(function (link) {
    link.remove();
  });

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

    appendDesktopLink(desktopNav, "cart.html", "Cart", cartCount);
    appendDesktopLink(desktopNav, "account.html", "My Account");
    appendMobileLink(mobileInner, "cart.html", "Cart", cartCount);
    appendMobileLink(mobileInner, "account.html", "My Account");
    updateHeaderCartCounts();
  }

  addAccountAndCartLinks();

  document.querySelectorAll(".site-header a[href]").forEach(function (link) {
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
