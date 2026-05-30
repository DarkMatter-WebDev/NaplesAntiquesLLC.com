/**
 * Shop catalog: category filters + keyword search (client-side).
 * Product metadata lives on each .shop-product-card via data-* attributes.
 */
(function () {
  var grid = document.getElementById('shop-product-grid');
  if (!grid) return;

  var cards = Array.prototype.slice.call(grid.querySelectorAll('.shop-product-card'));
  var searchInput = document.getElementById('shop-search');
  var clearBtn = document.getElementById('shop-clear-filters');
  var resultEl = document.getElementById('shop-result-count');
  var emptyEl = document.getElementById('shop-empty');
  var filterBtns = Array.prototype.slice.call(document.querySelectorAll('[data-shop-filter]'));

  var activeCategory = 'all';
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

  function cardMatches(card) {
    var category = card.getAttribute('data-category') || '';
    var q = getQuery();
    var haystack = normalize(card.getAttribute('data-search') || '');

    if (activeCategory !== 'all' && category !== activeCategory) {
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
      resultEl.textContent = 'Showing ' + visible + ' of ' + total + ' piece' + (total === 1 ? '' : 's');
    }
    if (emptyEl) {
      emptyEl.classList.toggle('hidden', visible > 0);
    }
  }

  function setCategory(slug) {
    activeCategory = slug || 'all';
    filterBtns.forEach(function (btn) {
      var isActive = (btn.getAttribute('data-shop-filter') || 'all') === activeCategory;
      btn.classList.toggle('shop-filter-btn--active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    applyFilters();
  }

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      setCategory(btn.getAttribute('data-shop-filter') || 'all');
    });
  });

  cards.forEach(function (card) {
    var media = card.querySelector('.shop-product-media');
    if (!media) return;
    var itemId = card.getAttribute('data-shop-item') || '';

    card.setAttribute('role', 'link');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', 'View listing');
    card.title = 'View listing';
    media.title = 'View listing';

    if (!media.querySelector('.shop-media-cart-btn')) {
      var cartBtn = document.createElement('button');
      cartBtn.type = 'button';
      cartBtn.className = 'shop-media-cart-btn';
      cartBtn.textContent = 'Add to Cart';
      cartBtn.setAttribute('aria-label', 'Add item to cart');
      cartBtn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (window.ShopCart) {
          window.ShopCart.add(itemId);
          cartBtn.textContent = 'Added';
          setTimeout(function () {
            cartBtn.textContent = 'Add to Cart';
          }, 1400);
        }
      });
      media.appendChild(cartBtn);
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
      setCategory('all');
      if (searchInput) searchInput.focus();
    });
  }

  setCategory('all');
})();
