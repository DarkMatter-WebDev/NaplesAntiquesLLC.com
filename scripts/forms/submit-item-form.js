/**
 * Submit-your-item form (contact.html#submit-item)
 *
 * Netlify Forms handles delivery and photo uploads from the static HTML form.
 * This script only improves the selected-photo label.
 */
(function () {
  var forms = document.querySelectorAll(".submit-item-form");
  if (!forms.length) return;

  forms.forEach(function (form) {
    var fileInput = form.querySelector('input[type="file"][name="photos"]');
    var fileNamesEl = form.querySelector(".submit-item-form__file-names");
    var modal = form.querySelector("[data-submit-item-modal]");
    var closeButton = form.querySelector("[data-submit-item-close]");
    var modalFileNamesEl = form.querySelector(".submit-item-form__modal-file-names");
    var firstDetailField = form.querySelector("[data-submit-item-modal] textarea, [data-submit-item-modal] input:not([type='hidden'])");
    var phoneInput = form.querySelector('input[name="phone"]');

    function openDetailsModal() {
      if (!modal) return;

      if (typeof modal.showModal === "function") {
        if (!modal.open) modal.showModal();
      } else {
        modal.setAttribute("open", "open");
      }

      if (firstDetailField && typeof firstDetailField.focus === "function") {
        firstDetailField.focus();
      }
    }

    function closeDetailsModal() {
      if (!modal) return;

      if (typeof modal.close === "function" && modal.open) {
        modal.close();
      } else {
        modal.removeAttribute("open");
      }

      if (fileInput && typeof fileInput.focus === "function") {
        fileInput.focus();
      }
    }

    function selectedPhotoText(files) {
      var names = [];
      for (var i = 0; i < files.length; i++) {
        names.push(files[i].name);
      }

      var isSpanish = document.documentElement.lang === "es";
      return (isSpanish ? "Seleccionado: " : "Selected: ") + names[0];
    }

    if (fileInput) {
      fileInput.addEventListener("change", function () {
        if (!fileInput.files || !fileInput.files.length) {
          if (fileNamesEl) fileNamesEl.textContent = "";
          if (modalFileNamesEl) modalFileNamesEl.textContent = "";
          return;
        }

        var text = selectedPhotoText(fileInput.files);
        if (fileNamesEl) fileNamesEl.textContent = text;
        if (modalFileNamesEl) modalFileNamesEl.textContent = text;
        openDetailsModal();
      });
    }

    if (closeButton) {
      closeButton.addEventListener("click", closeDetailsModal);
    }

    form.addEventListener("submit", function (event) {
      if (!phoneInput || phoneInput.value.trim()) return;

      event.preventDefault();
      openDetailsModal();
      phoneInput.focus();

      if (typeof phoneInput.reportValidity === "function") {
        phoneInput.reportValidity();
      }
    });
  });
})();
