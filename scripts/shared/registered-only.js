(function () {
  var ES = (document.documentElement.getAttribute('lang') || '').toLowerCase().indexOf('es') === 0;
  function L(en, es) { return ES ? es : en; }

  function showGate(message) {
    var protectedContent = document.querySelector('[data-registered-content]');
    var gate = document.querySelector('[data-registered-gate]');

    if (protectedContent) protectedContent.hidden = true;
    if (gate) {
      gate.hidden = false;
      var messageEl = gate.querySelector('[data-registered-message]');
      if (messageEl) {
        messageEl.textContent = message || L('Sign in to access this page.', 'Inicie sesión para acceder a esta página.');
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
      showGate(L('Customer accounts are not configured yet.', 'Las cuentas de cliente aún no están configuradas.'));
      return;
    }

    await window.NaplesAuth.init();
    if (window.NaplesAuth.getSession()) {
      showContent();
      return;
    }

    showGate(L('Sign in to access this registered-user page.', 'Inicie sesión para acceder a esta página de usuarios registrados.'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
