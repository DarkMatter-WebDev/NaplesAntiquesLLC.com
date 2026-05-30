(function () {
  function showGate(message) {
    var protectedContent = document.querySelector('[data-registered-content]');
    var gate = document.querySelector('[data-registered-gate]');

    if (protectedContent) protectedContent.hidden = true;
    if (gate) {
      gate.hidden = false;
      var messageEl = gate.querySelector('[data-registered-message]');
      if (messageEl) {
        messageEl.textContent = message || 'Sign in to access this page.';
      }
    }
  }

  function showContent() {
    var protectedContent = document.querySelector('[data-registered-content]');
    var gate = document.querySelector('[data-registered-gate]');

    if (gate) gate.hidden = true;
    if (protectedContent) protectedContent.hidden = false;
  }

  async function init() {
    if (!window.NaplesAuth || !window.NaplesAuth.isConfigured()) {
      showGate('Customer accounts are not configured yet.');
      return;
    }

    await window.NaplesAuth.init();
    if (window.NaplesAuth.getSession()) {
      showContent();
      return;
    }

    showGate('Sign in to access this registered-user page.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
