/**
 * Submit-your-item form (contact.html#submit-item)
 *
 * Netlify Forms handles delivery and photo uploads from the static HTML form.
 * This script only improves the selected-photo labels and details modal.
 */
(function () {
  var forms = document.querySelectorAll(".submit-item-form");
  if (!forms.length) return;

  forms.forEach(function (form) {
    var fileInputs = form.querySelectorAll('input[type="file"]');
    var primaryFileInput = form.querySelector('input[type="file"][required]');
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

      if (primaryFileInput && typeof primaryFileInput.focus === "function") {
        primaryFileInput.focus();
      }
    }

    function selectedPhotoNames() {
      var names = [];

      fileInputs.forEach(function (input) {
        if (input.files && input.files.length) {
          names.push(input.files[0].name);
        }
      });

      return names;
    }

    function selectedPhotoText() {
      var names = selectedPhotoNames();
      if (!names.length) {
        return "";
      }

      var isSpanish = document.documentElement.lang === "es";
      var label = isSpanish
        ? (names.length === 1 ? "1 foto seleccionada: " : names.length + " fotos seleccionadas: ")
        : (names.length === 1 ? "1 photo selected: " : names.length + " photos selected: ");

      return label + names.join(", ");
    }

    function updateSelectedPhotoText() {
      var text = selectedPhotoText();
      if (fileNamesEl) fileNamesEl.textContent = text;
      if (modalFileNamesEl) modalFileNamesEl.textContent = text;
    }

    fileInputs.forEach(function (fileInput) {
      fileInput.addEventListener("change", function () {
        updateSelectedPhotoText();
        if (fileInput === primaryFileInput && fileInput.files && fileInput.files.length) {
          openDetailsModal();
        }
      });
    });

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
