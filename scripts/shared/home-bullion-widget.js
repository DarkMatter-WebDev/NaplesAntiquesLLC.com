/**
 * Homepage bullion charts floater — tracks visits; respects reduced motion via CSS.
 */
(function () {
  var widget = document.querySelector(".bullion-charts-widget");
  if (!widget) return;

  widget.addEventListener("click", function () {
    try {
      sessionStorage.setItem("naplesBullionChartsVisit", "1");
    } catch (e) {
      /* ignore */
    }
  });
})();
