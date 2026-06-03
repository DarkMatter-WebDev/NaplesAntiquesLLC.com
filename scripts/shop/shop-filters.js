/**
 * Shop catalog: category filters + keyword search (client-side).
 * Product metadata lives on each .shop-product-card via data-* attributes.
 */
(function () {
  var grid = document.getElementById('shop-product-grid');
  if (!grid) return;

  var ES = (document.documentElement.getAttribute('lang') || '').toLowerCase().indexOf('es') === 0;

  var cards = Array.prototype.slice.call(grid.querySelectorAll('.shop-product-card'));
  var searchInput = document.getElementById('shop-search');
  var clearBtn = document.getElementById('shop-clear-filters');
  var resultEl = document.getElementById('shop-result-count');
  var emptyEl = document.getElementById('shop-empty');
  var filterSelects = Array.prototype.slice.call(document.querySelectorAll('[data-shop-filter-select]'));

  var activeFilters = {};
  var total = cards.length;

  function listingUrl(card) {
    return 'product.html?id=' + encodeURIComponent(card.getAttribute('data-shop-item') || '');
  }

  function isInteractiveTarget(target) {
    return !!(target && target.closest('a, button, input, select, textarea'));
  }

  function normalize(str) {
    return (str || '').toLowerCase().trim();
  }

  function getQuery() {
    return searchInput ? normalize(searchInput.value) : '';
  }

  function getCardFilterValue(card, key) {
    return normalize(card.getAttribute('data-filter-' + key) || '');
  }

  function cardHasFilterValue(card, key, value) {
    var values = getCardFilterValue(card, key).split(/\s+/).filter(Boolean);
    return values.indexOf(value) !== -1;
  }

  function cardMatches(card) {
    var q = getQuery();
    var haystack = normalize([
      card.getAttribute('data-search') || '',
      card.getAttribute('data-tags') || '',
      card.getAttribute('data-filter-metal') || '',
      card.getAttribute('data-filter-purity') || '',
      card.getAttribute('data-filter-chain-type') || '',
      card.getAttribute('data-filter-length') || ''
    ].join(' '));

    if (activeFilters.metal && activeFilters.metal !== 'all' && !cardHasFilterValue(card, 'metal', activeFilters.metal)) {
      return false;
    }
    if (activeFilters.purity && activeFilters.purity !== 'all' && !cardHasFilterValue(card, 'purity', activeFilters.purity)) {
      return false;
    }
    if (activeFilters.chainType && activeFilters.chainType !== 'all' && !cardHasFilterValue(card, 'chain-type', activeFilters.chainType)) {
      return false;
    }
    if (activeFilters.length && activeFilters.length !== 'all' && !cardHasFilterValue(card, 'length', activeFilters.length)) {
      return false;
    }
    if (!q) return true;
    return haystack.indexOf(q) !== -1;
  }

  function applyFilters() {
    var visible = 0;
    cards.forEach(function (card) {
      var show = cardMatches(card);
      card.classList.toggle('is-hidden', !show);
      card.hidden = !show;
      if (show) visible += 1;
    });

    if (resultEl) {
      if (ES) {
        resultEl.textContent = 'Mostrando ' + visible + ' de ' + total + ' pieza' + (total === 1 ? '' : 's');
      } else {
        resultEl.textContent = 'Showing ' + visible + ' of ' + total + ' piece' + (total === 1 ? '' : 's');
      }
    }
    if (emptyEl) {
      emptyEl.classList.toggle('hidden', visible > 0);
    }
  }

  filterSelects.forEach(function (select) {
    var key = select.getAttribute('data-shop-filter-select');
    activeFilters[key] = select.value || 'all';
    select.addEventListener('change', function () {
      activeFilters[key] = select.value || 'all';
      applyFilters();
    });
  });

  var viewLabel = ES ? 'Ver artículo' : 'View listing';
  var addLabel = ES ? 'Agregar al Carrito' : 'Add to Cart';
  var inCartLabel = ES ? 'En el Carrito' : 'In Cart';
  var addAria = ES ? 'Agregar artículo al carrito' : 'Add item to cart';
  var removeAria = ES ? 'Quitar artículo del carrito' : 'Remove item from cart';

  function cartHas(id) {
    if (!window.ShopCart) return false;
    if (typeof window.ShopCart.has === 'function') return window.ShopCart.has(id);
    if (typeof window.ShopCart.read === 'function') return window.ShopCart.read().indexOf(id) !== -1;
    return false;
  }

  function syncCartBtn(btn, itemId) {
    var inCart = cartHas(itemId);
    btn.classList.toggle('is-in-cart', inCart);
    btn.setAttribute('aria-pressed', inCart ? 'true' : 'false');
    btn.setAttribute('aria-label', inCart ? removeAria : addAria);
    btn.querySelector('.shop-media-cart-label').textContent = inCart ? inCartLabel : addLabel;
  }

  cards.forEach(function (card) {
    var media = card.querySelector('.shop-product-media');
    if (!media) return;
    var itemId = card.getAttribute('data-shop-item') || '';

    card.setAttribute('role', 'link');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', viewLabel);
    card.title = viewLabel;
    media.title = viewLabel;

    if (!media.querySelector('.shop-media-cart-btn')) {
      var cartBtn = document.createElement('button');
      cartBtn.type = 'button';
      cartBtn.className = 'shop-media-cart-btn';
      var icon = document.createElement('span');
      icon.className = 'shop-media-cart-check material-symbols-outlined';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = 'check';
      var label = document.createElement('span');
      label.className = 'shop-media-cart-label';
      cartBtn.appendChild(icon);
      cartBtn.appendChild(label);
      cartBtn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (!window.ShopCart) return;
        if (cartHas(itemId)) {
          window.ShopCart.remove(itemId);
        } else {
          window.ShopCart.add(itemId);
        }
        syncCartBtn(cartBtn, itemId);
      });
      media.appendChild(cartBtn);
      syncCartBtn(cartBtn, itemId);
    }

    card.addEventListener('click', function (event) {
      if (isInteractiveTarget(event.target)) return;
      window.location.href = listingUrl(card);
    });
    card.addEventListener('keydown', function (event) {
      if (isInteractiveTarget(event.target)) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        window.location.href = listingUrl(card);
      }
    });
  });

  window.addEventListener('shopcart:updated', function () {
    cards.forEach(function (card) {
      var btn = card.querySelector('.shop-media-cart-btn');
      if (btn) syncCartBtn(btn, card.getAttribute('data-shop-item') || '');
    });
  });

  if (searchInput) {
    var debounceTimer;
    searchInput.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(applyFilters, 120);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      if (searchInput) searchInput.value = '';
      filterSelects.forEach(function (select) {
        select.value = 'all';
        activeFilters[select.getAttribute('data-shop-filter-select')] = 'all';
      });
      applyFilters();
      if (searchInput) searchInput.focus();
    });
  }

  applyFilters();
})();
