/**
 * Scroll #live-prices to the metal ticker (below fixed header) on bullion page load.
 */
(function () {
  if (location.hash !== "#live-prices") return;

  var target = document.getElementById("live-prices");
  if (!target) return;

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  function scrollToTicker() {
    var header = document.querySelector("header.site-header");
    var offset = header ? header.getBoundingClientRect().height : 80;
    var top =
      target.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scrollToTicker);
  } else {
    scrollToTicker();
  }

  window.addEventListener("load", function () {
    scrollToTicker();
    setTimeout(scrollToTicker, 350);
  });
})();
