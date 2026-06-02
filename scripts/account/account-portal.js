(function () {
  var ES = (document.documentElement.getAttribute('lang') || '').toLowerCase().indexOf('es') === 0;
  function L(en, es) { return ES ? es : en; }

  function setMessage(text, isError) {
    var el = document.getElementById('account-message');
    if (!el) return;
    el.textContent = text || '';
    el.className = isError ? 'text-red-600 text-sm mt-3' : 'text-on-surface-variant text-sm mt-3';
  }

  function setCreateMessage(text, isError) {
    var el = document.getElementById('account-create-message');
    if (!el) return;
    el.textContent = text || '';
    el.className = isError
      ? 'text-red-600 text-sm mt-6 border border-red-500/30 bg-red-500/10 rounded-sm p-3 min-h-[2.75rem]'
      : 'text-on-surface-variant text-sm mt-6 border border-white/10 bg-white/5 rounded-sm p-3 min-h-[2.75rem]';
    setMessage(text, isError);
  }

  function goToDashboard(isNewAccount) {
    window.location.href = isNewAccount ? 'account-dashboard.html?welcome=1' : 'account-dashboard.html';
  }

  function goToShopAfterSignIn() {
    window.location.href = 'shop.html?account=signin';
  }

  function goToConfirmationSent(email) {
    var params = new URLSearchParams();
    params.set('signup', 'success');
    if (email) params.set('email', email);
    window.location.href = 'account.html?' + params.toString();
  }

  function showSignedOut() {
    document.getElementById('account-signed-out').hidden = false;
    document.getElementById('account-signed-in').hidden = true;
  }

  function showSignedIn() {
    document.getElementById('account-signed-out').hidden = true;
    document.getElementById('account-signed-in').hidden = false;
  }

  function showCreateMode() {
    var signInCard = document.getElementById('account-sign-in-card');
    var newCard = document.getElementById('account-new-card');
    var createPanel = document.getElementById('account-create-panel');

    if (signInCard) signInCard.hidden = true;
    if (newCard) newCard.hidden = true;
    if (createPanel) {
      createPanel.hidden = false;
      createPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function showSignInMode() {
    var signInCard = document.getElementById('account-sign-in-card');
    var newCard = document.getElementById('account-new-card');
    var createPanel = document.getElementById('account-create-panel');

    if (signInCard) signInCard.hidden = false;
    if (newCard) newCard.hidden = false;
    if (createPanel) createPanel.hidden = true;
  }

  function showConfirmationSent() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('signup') !== 'success') return;

    var panel = document.getElementById('account-confirmation-sent');
    var emailEl = document.getElementById('account-confirmation-email');
    var email = params.get('email') || '';
    if (panel) panel.hidden = false;
    if (emailEl && email) emailEl.textContent = email;

    showSignInMode();
    setMessage(L('After confirming your email, sign in below.', 'Después de confirmar su correo electrónico, inicie sesión a continuación.'));
  }

  function getConfirmationReturnState() {
    var params = new URLSearchParams(window.location.search);
    var hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
    var error = params.get('error_description') || hashParams.get('error_description') || '';

    return {
      hasError: Boolean(error),
      error: error,
      isConfirmationReturn: Boolean(
        params.get('confirmed') === '1' ||
        params.get('code') ||
        params.get('token_hash') ||
        hashParams.get('access_token') ||
        hashParams.get('type') === 'signup'
      )
    };
  }

  function cleanConfirmationUrl() {
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  function showEmailConfirmed() {
    var panel = document.getElementById('account-email-confirmed');
    var sentPanel = document.getElementById('account-confirmation-sent');
    if (sentPanel) sentPanel.hidden = true;
    if (panel) panel.hidden = false;
    showSignInMode();
    setMessage(L('Email confirmed. Sign in below to continue.', 'Correo electrónico confirmado. Inicie sesión a continuación para continuar.'));
  }

  function bindEvents() {
    if (!window.NaplesAuth.isConfigured()) {
      setMessage(L('Customer accounts are not configured yet. Add your Supabase URL and anon key to scripts/shared/supabase-config.js.', 'Las cuentas de cliente aún no están configuradas. Agregue su URL de Supabase y la clave anon en scripts/shared/supabase-config.js.'), true);
      showSignedOut();
      return;
    }

    document.getElementById('account-show-create').addEventListener('click', function () {
      showCreateMode();
    });

    document.getElementById('account-cancel-create').addEventListener('click', function () {
      showSignInMode();
      setMessage('');
      setCreateMessage('');
    });

    document.getElementById('account-sign-in').addEventListener('click', function () {
      var email = document.getElementById('auth-email').value.trim();
      var password = document.getElementById('auth-password').value;
      if (!email || !password) {
        setMessage(L('Enter your email and password to sign in.', 'Ingrese su correo electrónico y contraseña para iniciar sesión.'), true);
        return;
      }
      setMessage(L('Signing in...', 'Iniciando sesión...'));
      window.NaplesAuth.signIn(email, password)
        .then(function () {
          return window.ShopCart && window.ShopCart.syncFromAccount ? window.ShopCart.syncFromAccount() : Promise.resolve();
        })
        .then(function () {
          setMessage(L('Signed in. Returning to the shop...', 'Sesión iniciada. Regresando a la tienda...'));
          goToShopAfterSignIn();
        })
        .catch(function (error) {
          var msg = error.message || L('Sign in failed.', 'Error al iniciar sesión.');
          if (/email not confirmed/i.test(msg)) {
            msg = L('Please confirm your email first. Check your inbox for the confirmation link, then sign in.', 'Por favor confirme su correo electrónico primero. Revise su bandeja de entrada para el enlace de confirmación y luego inicie sesión.');
          }
          setMessage(msg, true);
        });
    });

    document.getElementById('account-sign-up').addEventListener('click', function () {
      var email = document.getElementById('create-email').value.trim();
      var password = document.getElementById('create-password').value;
      var confirmPassword = document.getElementById('create-password-confirm').value;
      var fullName = document.getElementById('create-full-name').value.trim();
      if (!email || !password || !confirmPassword) {
        setCreateMessage(L('Enter an email, password, and confirmation password to create an account.', 'Ingrese un correo electrónico, una contraseña y la confirmación de la contraseña para crear una cuenta.'), true);
        return;
      }
      if (password !== confirmPassword) {
        setCreateMessage(L('Passwords do not match.', 'Las contraseñas no coinciden.'), true);
        return;
      }
      setCreateMessage(L('Creating account...', 'Creando cuenta...'));
      window.NaplesAuth.signUp(email, password, fullName)
        .then(function (data) {
          setCreateMessage('');
          if (data && data.session) {
            return window.ShopCart && window.ShopCart.syncFromAccount ? window.ShopCart.syncFromAccount() : Promise.resolve();
          }
          return data;
        })
        .then(function () {
          showSignInMode();
          if (window.NaplesAuth.getSession()) {
            setMessage(L('Account created successfully. Opening account management...', 'Cuenta creada con éxito. Abriendo la gestión de la cuenta...'));
            goToDashboard(true);
            return null;
          }
          showSignedOut();
          goToConfirmationSent(email);
          return null;
        })
        .catch(function (error) { setCreateMessage(error.message, true); });
    });
  }

  async function init() {
    bindEvents();
    if (!window.NaplesAuth.isConfigured()) return;
    var confirmationReturn = getConfirmationReturnState();
    await window.NaplesAuth.init();
    if (confirmationReturn.hasError) {
      showSignedOut();
      showSignInMode();
      setMessage(confirmationReturn.error, true);
      cleanConfirmationUrl();
      return;
    }
    if (confirmationReturn.isConfirmationReturn && !window.NaplesAuth.getSession()) {
      showSignedOut();
      showEmailConfirmed();
      cleanConfirmationUrl();
      return;
    }
    if (window.NaplesAuth.getSession()) {
      if (confirmationReturn.isConfirmationReturn) {
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        setMessage(L('Email confirmed. Opening your account...', 'Correo electrónico confirmado. Abriendo su cuenta...'));
      }
      goToDashboard();
      return;
    }
    showSignedOut();
    showConfirmationSent();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
