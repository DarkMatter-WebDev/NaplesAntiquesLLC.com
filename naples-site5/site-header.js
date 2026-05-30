(function () {
  var btn = document.getElementById("mobile-menu-toggle");
  var menu = document.getElementById("mobile-menu");
  var icon = document.getElementById("mobile-menu-icon");
  var currentPage = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  var activePage = currentPage;

  if (currentPage === "product.html" || currentPage === "cart.html") {
    activePage = "shop.html";
  }
  if (
    currentPage === "estate-jewelry.html" ||
    currentPage === "gold-services.html" ||
    currentPage === "silver-services.html" ||
    currentPage === "bullion.html"
  ) {
    activePage = "what-we-buy.html";
  }

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
})();
