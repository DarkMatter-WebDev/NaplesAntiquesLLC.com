(function () {
  function setMessage(text, isError) {
    var el = document.getElementById('account-message');
    if (!el) return;
    el.textContent = text || '';
    el.className = isError ? 'text-red-600 text-sm mt-3' : 'text-on-surface-variant text-sm mt-3';
  }

  function showSignedOut() {
    document.getElementById('account-signed-out').hidden = false;
    document.getElementById('account-signed-in').hidden = true;
  }

  function showSignedIn() {
    document.getElementById('account-signed-out').hidden = true;
    document.getElementById('account-signed-in').hidden = false;
  }

  function productsById() {
    var map = {};
    (window.SHOP_PRODUCTS || []).forEach(function (product) {
      map[product.id] = product;
    });
    return map;
  }

  async function renderFavorites() {
    var list = document.getElementById('account-favorites');
    if (!list) return;
    list.innerHTML = '';

    var favorites = await window.NaplesAuth.listFavorites();
    if (!favorites.length) {
      list.innerHTML = '<p class="text-on-surface-variant text-sm">No saved favorites yet.</p>';
      return;
    }

    var byId = productsById();
    favorites.forEach(function (favorite) {
      var product = byId[favorite.product_id];
      var row = document.createElement('div');
      row.className = 'border border-white/10 rounded-sm p-4';
      row.innerHTML = product
        ? '<a class="text-primary font-label text-xs uppercase tracking-widest" href="product.html?id=' + encodeURIComponent(product.id) + '">' + product.category + '</a><p class="text-on-surface font-headline text-lg mt-2">' + product.title + '</p>'
        : '<p class="text-sm text-on-surface-variant">Saved item: ' + favorite.product_id + '</p>';
      list.appendChild(row);
    });
  }

  function renderCart() {
    var list = document.getElementById('account-cart');
    if (!list) return;
    list.innerHTML = '';

    var ids = window.ShopCart ? window.ShopCart.read() : [];
    if (!ids.length) {
      list.innerHTML = '<p class="text-on-surface-variant text-sm">Your cart is empty.</p>';
      return;
    }

    var byId = productsById();
    ids.forEach(function (id) {
      var product = byId[id];
      var row = document.createElement('div');
      row.className = 'border border-white/10 rounded-sm p-4';
      row.innerHTML = product
        ? '<a class="text-primary font-label text-xs uppercase tracking-widest" href="product.html?id=' + encodeURIComponent(product.id) + '">' + product.category + '</a><p class="text-on-surface font-headline text-lg mt-2">' + product.title + '</p>'
        : '<p class="text-sm text-on-surface-variant">Cart item: ' + id + '</p>';
      list.appendChild(row);
    });
  }

  async function refreshSignedInView() {
    var profile = window.NaplesAuth.getProfile();
    var session = window.NaplesAuth.getSession();
    if (!session) {
      showSignedOut();
      return;
    }

    showSignedIn();
    document.getElementById('account-email').textContent = session.user.email || '';
    document.getElementById('field-full-name').value = (profile && profile.full_name) || '';
    document.getElementById('field-phone').value = (profile && profile.phone) || '';
    document.getElementById('field-budget').value = (profile && profile.budget_range) || '';
    document.getElementById('field-interests').value = (profile && profile.interests || []).join(', ');

    var vipBadge = document.getElementById('account-vip-badge');
    if (vipBadge) {
      vipBadge.hidden = !window.NaplesAuth.isVip();
    }

    await renderFavorites();
    renderCart();
  }

  function bindEvents() {
    if (!window.NaplesAuth.isConfigured()) {
      setMessage('Customer accounts are not configured yet. Add your Supabase URL and anon key to supabase-config.js.', true);
      showSignedOut();
      return;
    }

    document.getElementById('account-sign-in').addEventListener('click', function () {
      var email = document.getElementById('auth-email').value.trim();
      var password = document.getElementById('auth-password').value;
      window.NaplesAuth.signIn(email, password)
        .then(function () {
          return window.ShopCart && window.ShopCart.syncFromAccount ? window.ShopCart.syncFromAccount() : Promise.resolve();
        })
        .then(refreshSignedInView)
        .then(function () { setMessage('Signed in'); })
        .catch(function (error) { setMessage(error.message, true); });
    });

    document.getElementById('account-sign-up').addEventListener('click', function () {
      var email = document.getElementById('auth-email').value.trim();
      var password = document.getElementById('auth-password').value;
      var fullName = document.getElementById('auth-full-name').value.trim();
      window.NaplesAuth.signUp(email, password, fullName)
        .then(function () {
          return window.ShopCart && window.ShopCart.syncFromAccount ? window.ShopCart.syncFromAccount() : Promise.resolve();
        })
        .then(refreshSignedInView)
        .then(function () { setMessage('Account created. Check email if confirmation is required.'); })
        .catch(function (error) { setMessage(error.message, true); });
    });

    document.getElementById('account-sign-out').addEventListener('click', function () {
      window.NaplesAuth.signOut().then(function () {
        showSignedOut();
        setMessage('Signed out');
      });
    });

    document.getElementById('account-save-profile').addEventListener('click', function () {
      window.NaplesAuth.updateProfile({
        full_name: document.getElementById('field-full-name').value.trim(),
        phone: document.getElementById('field-phone').value.trim(),
        budget_range: document.getElementById('field-budget').value.trim(),
        interests: document.getElementById('field-interests').value.split(',').map(function (value) {
          return value.trim();
        }).filter(Boolean)
      })
        .then(function () { setMessage('Profile saved'); })
        .catch(function (error) { setMessage(error.message, true); });
    });
  }

  async function init() {
    bindEvents();
    if (!window.NaplesAuth.isConfigured()) return;
    await window.NaplesAuth.init();
    if (window.ShopCart && window.ShopCart.syncFromAccount) {
      await window.ShopCart.syncFromAccount();
    }
    await refreshSignedInView();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
