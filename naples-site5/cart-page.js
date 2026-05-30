(function () {
  var products = window.SHOP_PRODUCTS || [];
  var list = document.getElementById('cart-items');
  var empty = document.getElementById('cart-empty');
  var summary = document.getElementById('cart-summary');
  var clearBtn = document.getElementById('cart-clear');
  var totals = document.getElementById('cart-totals');
  var subtotal = document.getElementById('cart-subtotal');
  var total = document.getElementById('cart-total');

  function productById(id) {
    return products.find(function (item) { return item.id === id; });
  }

  function getProductPrice(product) {
    if (window.ShopPricing) {
      return window.ShopPricing.getDisplayPrice(product).amount;
    }
    return Number(String(product.manualPriceLabel || product.priceLabel || '').replace(/[^0-9.]/g, '')) || 0;
  }

  function getProductPriceLabel(product) {
    if (window.ShopPricing) {
      return window.ShopPricing.getDisplayPrice(product).label;
    }
    return product.manualPriceLabel || product.priceLabel || '';
  }

  function formatMoney(amount) {
    if (window.ShopPricing) {
      return window.ShopPricing.formatMoney(amount);
    }
    return '$' + amount.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }

  function render() {
    var ids = window.ShopCart ? window.ShopCart.read() : [];
    var items = ids.map(productById).filter(Boolean);

    if (empty) empty.hidden = items.length > 0;
    if (summary) summary.hidden = items.length === 0;
    if (totals) totals.hidden = items.length === 0;
    if (list) list.innerHTML = '';

    var subtotalAmount = items.reduce(function (sum, product) {
      return sum + getProductPrice(product);
    }, 0);

    if (summary) {
      summary.textContent = items.length + ' item' + (items.length === 1 ? '' : 's') + ' saved for inquiry.';
    }
    if (subtotal) subtotal.textContent = formatMoney(subtotalAmount);
    if (total) total.textContent = formatMoney(subtotalAmount);

    items.forEach(function (product) {
      var priceLabel = getProductPriceLabel(product);
      var row = document.createElement('article');
      row.className = 'cart-item bg-surface-container-high border border-white/5 rounded-sm overflow-hidden';
      row.innerHTML = [
        '<a class="cart-item-media" href="product.html?id=' + encodeURIComponent(product.id) + '">',
        '  <img src="' + product.images[0] + '" alt="' + product.title + '" />',
        '</a>',
        '<div class="cart-item-body">',
        '  <span class="cart-item-category text-primary uppercase font-label">' + product.category + '</span>',
        '  <p class="cart-item-title text-on-surface font-label font-bold">' + product.title + '</p>',
        '  <p class="cart-item-price text-primary font-label font-bold">' + priceLabel + '</p>',
        '  <div class="cart-item-actions flex flex-wrap items-center">',
        '    <a class="cart-item-action border border-primary/50 text-primary rounded-md font-label font-bold uppercase hover:bg-primary hover:text-on-primary transition-colors" href="product.html?id=' + encodeURIComponent(product.id) + '">View</a>',
        '    <button type="button" class="cart-remove text-on-surface-variant hover:text-primary font-label text-[0.62rem] uppercase tracking-widest transition-colors" data-remove-id="' + product.id + '">Remove</button>',
        '  </div>',
        '</div>'
      ].join('');
      list.appendChild(row);
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-remove-id]'), function (btn) {
      btn.addEventListener('click', function () {
        window.ShopCart.remove(btn.getAttribute('data-remove-id'));
        render();
      });
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      window.ShopCart.clear();
      render();
    });
  }

  if (window.ShopPricing) {
    window.ShopPricing.onReady(render);
  } else {
    render();
  }
})();
