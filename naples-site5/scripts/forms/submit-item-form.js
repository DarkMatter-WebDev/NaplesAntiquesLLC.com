/**
 * Submit-your-item form (contact.html#submit-item)
 *
 * Before go-live: set FORM_ACTION to your Formspree URL, e.g.
 *   https://formspree.io/f/xxxxxxxx
 * Formspree supports file uploads on paid plans; otherwise use their
 * "link to upload" or collect photos via a follow-up text.
 *
 * Alternative: FormSubmit — https://formsubmit.co/your@email.com
 */
(function () {
  var FORM_ACTION = ""; // e.g. "https://formspree.io/f/your-id"

  var forms = document.querySelectorAll(".submit-item-form");
  if (!forms.length) return;

  forms.forEach(function (form) {
    if (FORM_ACTION) {
      form.setAttribute("action", FORM_ACTION);
      form.setAttribute("method", "POST");
    } else {
      form.removeAttribute("action");
    }

    var fileInput = form.querySelector('input[type="file"][name="photos"]');
    var fileNamesEl = form.querySelector(".submit-item-form__file-names");
    if (fileInput && fileNamesEl) {
      fileInput.addEventListener("change", function () {
        if (!fileInput.files || !fileInput.files.length) {
          fileNamesEl.textContent = "";
          return;
        }
        var names = [];
        for (var i = 0; i < fileInput.files.length; i++) {
          names.push(fileInput.files[i].name);
        }
        fileNamesEl.textContent =
          names.length === 1
            ? "Selected: " + names[0]
            : names.length + " photos selected: " + names.join(", ");
      });
    }

    form.addEventListener("submit", function (e) {
      var hp = form.querySelector('input[name="_gotcha"]');
      if (hp && hp.value) {
        e.preventDefault();
        return;
      }

      if (FORM_ACTION) return;

      e.preventDefault();
      var status = form.querySelector(".submit-item-form__status");
      if (status) {
        status.className =
          "submit-item-form__status submit-item-form__status--error is-visible";
        status.textContent =
          "Form delivery is not configured yet. Please call or text us at (239) 404-8505, or set FORM_ACTION in scripts/forms/submit-item-form.js.";
      }
    });
  });
})();
