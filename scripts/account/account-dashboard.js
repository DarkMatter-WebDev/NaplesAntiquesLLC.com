(function () {
  var ES = (document.documentElement.getAttribute('lang') || '').toLowerCase().indexOf('es') === 0;
  function L(en, es) { return ES ? es : en; }
  var CAT_ES = { 'gold': 'Oro', 'silver': 'Plata', 'bullion': 'Lingotes', 'diamond': 'Diamantes', 'diamonds': 'Diamantes', 'watch': 'Relojes', 'watches': 'Relojes', 'antique': 'Antigüedades', 'antiques': 'Antigüedades', 'jewelry': 'Joyería', 'coins': 'Monedas', 'coin': 'Monedas' };
  function catLabel(cat) { if (!ES || !cat) return cat; return CAT_ES[String(cat).toLowerCase()] || cat; }
  function titleOf(product) { return (ES && product.title_es) ? product.title_es : product.title; }
  var profileSaveTimer = null;

  function setMessage(text, isError) {
    var el = document.getElementById('account-message');
    if (!el) return;
    el.textContent = text || '';
    el.className = isError ? 'text-red-600 text-sm mb-6' : 'text-on-surface-variant text-sm mb-6';
  }

  function setProfileStatus(text, isError) {
    var el = document.getElementById('profile-save-status');
    if (!el) return;
    el.textContent = text || '';
    el.className = isError ? 'text-red-600 text-sm mb-4' : 'text-on-surface-variant text-sm mb-4';
  }

  var DEFAULT_COUNTRY = ES ? 'Estados Unidos' : 'United States';

  function getProfilePayload() {
    return {
      full_name: document.getElementById('field-full-name').value.trim(),
      phone: document.getElementById('field-phone').value.trim(),
      address_line1: document.getElementById('field-address-line1').value.trim(),
      address_line2: document.getElementById('field-address-line2').value.trim(),
      city: document.getElementById('field-city').value.trim(),
      state: document.getElementById('field-state').value.trim(),
      postal_code: document.getElementById('field-postal-code').value.trim(),
      country: document.getElementById('field-country').value.trim() || DEFAULT_COUNTRY,
      marketing_opt_in: document.getElementById('field-marketing-opt-in').checked,
      interests: document.getElementById('field-interests').value.split(',').map(function (value) {
        return value.trim();
      }).filter(Boolean)
    };
  }

  function profileLooksIncomplete(profile) {
    return !profile ||
      !profile.full_name ||
      !profile.phone ||
      !profile.address_line1 ||
      !profile.city ||
      !profile.state ||
      !profile.postal_code;
  }

  function productsById() {
    var map = {};
    (window.SHOP_PRODUCTS || []).forEach(function (product) {
      map[product.id] = product;
    });
    return map;
  }

  function showSignedOut() {
    document.getElementById('dashboard-loading').hidden = true;
    document.getElementById('dashboard-content').hidden = true;
    document.getElementById('dashboard-signed-out').hidden = false;
  }

  function showDashboard() {
    document.getElementById('dashboard-loading').hidden = true;
    document.getElementById('dashboard-signed-out').hidden = true;
    document.getElementById('dashboard-content').hidden = false;
  }

  async function renderFavorites() {
    var list = document.getElementById('account-favorites');
    if (!list) return;
    list.innerHTML = '';

    var favorites = [];
    try {
      favorites = await window.NaplesAuth.listFavorites();
    } catch (error) {
      console.warn('Favorites unavailable:', error.message);
      list.innerHTML = '<p class="text-on-surface-variant text-sm">' + L('Saved favorites are temporarily unavailable.', 'Los favoritos guardados no están disponibles temporalmente.') + '</p>';
      return;
    }

    if (!favorites.length) {
      list.innerHTML = '<p class="text-on-surface-variant text-sm">' + L('No saved favorites yet.', 'Aún no hay favoritos guardados.') + '</p>';
      return;
    }

    var byId = productsById();
    favorites.forEach(function (favorite) {
      var product = byId[favorite.product_id];
      var row = document.createElement('div');
      row.className = 'border border-white/10 rounded-sm p-4';
      row.innerHTML = product
        ? '<a class="text-primary font-label text-xs uppercase tracking-widest" href="product.html?id=' + encodeURIComponent(product.id) + '">' + catLabel(product.category) + '</a><p class="text-on-surface font-headline text-lg mt-2">' + titleOf(product) + '</p>'
        : '<p class="text-sm text-on-surface-variant">' + L('Saved item: ', 'Artículo guardado: ') + favorite.product_id + '</p>';
      list.appendChild(row);
    });
  }

  function renderCart() {
    var list = document.getElementById('account-cart');
    if (!list) return;
    list.innerHTML = '';

    var ids = window.ShopCart ? window.ShopCart.read() : [];
    if (!ids.length) {
      list.innerHTML = '<p class="text-on-surface-variant text-sm">' + L('Your cart is empty.', 'Su carrito está vacío.') + '</p>';
      return;
    }

    var byId = productsById();
    ids.forEach(function (id) {
      var product = byId[id];
      var row = document.createElement(product ? 'a' : 'div');
      row.className = 'flex items-center gap-3 border border-white/10 rounded-sm px-2 py-2 hover:border-primary/50 hover:bg-white/5 transition-colors';
      if (product) {
        row.href = 'product.html?id=' + encodeURIComponent(product.id);
      }
      var image = product && product.images && product.images.length ? product.images[0] : '';
      var price = product && product.priceLabel ? product.priceLabel : '';
      row.innerHTML = product
        ? '<img src="' + image + '" alt="" class="w-12 h-12 object-cover rounded-sm bg-surface-container-low flex-shrink-0" loading="lazy" />' +
          '<span class="min-w-0 flex-1">' +
            '<span class="text-primary font-label text-[0.55rem] uppercase tracking-widest">' + catLabel(product.category) + '</span>' +
            '<span class="block text-on-surface font-headline text-xs leading-snug truncate">' + titleOf(product) + '</span>' +
            '<span class="block text-on-surface-variant text-[0.68rem] mt-0.5">' + price + '</span>' +
          '</span>'
        : '<p class="text-sm text-on-surface-variant">' + L('Cart item: ', 'Artículo del carrito: ') + id + '</p>';
      list.appendChild(row);
    });
  }

  async function refreshDashboard() {
    var session = window.NaplesAuth.getSession();
    if (!session) {
      showSignedOut();
      return;
    }

    document.getElementById('account-email').textContent = session.user.email || '';
    var profile = window.NaplesAuth.getProfile();
    var fullNameEl = document.getElementById('field-full-name');
    var phoneEl = document.getElementById('field-phone');
    var addressLine1El = document.getElementById('field-address-line1');
    var addressLine2El = document.getElementById('field-address-line2');
    var cityEl = document.getElementById('field-city');
    var stateEl = document.getElementById('field-state');
    var postalCodeEl = document.getElementById('field-postal-code');
    var countryEl = document.getElementById('field-country');
    var marketingOptInEl = document.getElementById('field-marketing-opt-in');
    var interestsEl = document.getElementById('field-interests');
    if (profile) {
      fullNameEl.value = profile.full_name || '';
      phoneEl.value = profile.phone || '';
      addressLine1El.value = profile.address_line1 || profile.address || '';
      addressLine2El.value = profile.address_line2 || '';
      cityEl.value = profile.city || '';
      stateEl.value = profile.state || '';
      postalCodeEl.value = profile.postal_code || '';
      countryEl.value = profile.country || DEFAULT_COUNTRY;
      marketingOptInEl.checked = Boolean(profile.marketing_opt_in);
      interestsEl.value = (profile.interests || []).join(', ');
    } else {
      var meta = session.user.user_metadata || {};
      fullNameEl.value = meta.full_name || '';
      phoneEl.value = '';
      addressLine1El.value = '';
      addressLine2El.value = '';
      cityEl.value = '';
      stateEl.value = '';
      postalCodeEl.value = '';
      countryEl.value = DEFAULT_COUNTRY;
      marketingOptInEl.checked = false;
      interestsEl.value = '';
    }

    var params = new URLSearchParams(window.location.search);
    if (params.get('welcome') === '1') {
      setMessage(L('Welcome. Please complete your profile below. Changes save automatically.', 'Bienvenido. Por favor complete su perfil a continuación. Los cambios se guardan automáticamente.'));
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (profileLooksIncomplete(profile)) {
      setMessage(L('Complete your profile so we can contact you about saved items and purchases.', 'Complete su perfil para que podamos contactarlo sobre artículos guardados y compras.'));
    } else {
      setMessage('');
    }

    var vipBadge = document.getElementById('account-vip-badge');
    if (vipBadge) {
      vipBadge.hidden = !window.NaplesAuth.isVip();
    }

    showDashboard();
    await renderFavorites();
    renderCart();
  }

  function saveProfile() {
    setProfileStatus(L('Saving profile...', 'Guardando perfil...'));
    return window.NaplesAuth.updateProfile(getProfilePayload())
      .then(function () {
        setProfileStatus(L('Profile saved automatically.', 'Perfil guardado automáticamente.'));
      })
      .catch(function (error) {
        var hint = error.message && (
          error.message.indexOf('permission denied') !== -1 ||
          error.message.indexOf('address') !== -1 ||
          error.message.indexOf('marketing_opt_in') !== -1
        )
          ? L(' Run supabase/fix-permissions.sql in Supabase SQL Editor, then try again.', ' Ejecute supabase/fix-permissions.sql en el Editor SQL de Supabase y vuelva a intentarlo.')
          : '';
        setProfileStatus(error.message + hint, true);
      });
  }

  function queueProfileSave() {
    window.clearTimeout(profileSaveTimer);
    setProfileStatus(L('Unsaved changes...', 'Cambios sin guardar...'));
    profileSaveTimer = window.setTimeout(saveProfile, 900);
  }

  function bindEvents() {
    document.getElementById('account-sign-out').addEventListener('click', function () {
      window.NaplesAuth.signOut().then(function () {
        window.location.href = 'account.html';
      });
    });

    [
      'field-full-name',
      'field-phone',
      'field-address-line1',
      'field-address-line2',
      'field-city',
      'field-state',
      'field-postal-code',
      'field-country',
      'field-interests',
      'field-marketing-opt-in'
    ].forEach(function (id) {
      var field = document.getElementById(id);
      if (field) {
        field.addEventListener('input', queueProfileSave);
        field.addEventListener('change', queueProfileSave);
      }
    });
  }

  async function init() {
    if (!window.NaplesAuth || !window.NaplesAuth.isConfigured()) {
      showSignedOut();
      setMessage(L('Customer accounts are not configured yet.', 'Las cuentas de cliente aún no están configuradas.'), true);
      return;
    }

    bindEvents();
    await window.NaplesAuth.init();
    if (window.ShopCart && window.ShopCart.syncFromAccount) {
      await window.ShopCart.syncFromAccount();
    }
    if (window.ShopPricing && window.ShopPricing.onReady) {
      window.ShopPricing.onReady(renderCart);
    }
    await refreshDashboard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
