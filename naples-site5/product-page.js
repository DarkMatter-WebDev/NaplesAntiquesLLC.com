(function () {
  var products = window.SHOP_PRODUCTS || [];
  var params = new URLSearchParams(window.location.search);
  var id = params.get('id');
  var product = products.find(function (item) { return item.id === id; });

  var found = document.getElementById('product-found');
  var missing = document.getElementById('product-missing');

  if (!product) {
    if (found) found.hidden = true;
    if (missing) missing.hidden = false;
    document.title = 'Listing Not Found | Naples Estate Jewelry & Antiques';
    return;
  }

  document.title = product.title + ' | Naples Estate Jewelry & Antiques';

  var title = document.getElementById('product-title');
  var category = document.getElementById('product-category');
  var status = document.getElementById('product-status');
  var price = document.getElementById('product-price');
  var description = document.getElementById('product-description');
  var mainImage = document.getElementById('product-main-image');
  var thumbs = document.getElementById('product-thumbnails');
  var details = document.getElementById('product-details');
  var inquiry = document.getElementById('product-inquiry-link');
  var addToCart = document.getElementById('product-add-to-cart');
  var cartMessage = document.getElementById('product-cart-message');

  function getDisplayPriceLabel() {
    if (window.ShopPricing) {
      return window.ShopPricing.getDisplayPrice(product).label;
    }
    return product.manualPriceLabel || product.priceLabel;
  }

  function updatePriceDisplay() {
    var label = getDisplayPriceLabel();
    if (price) price.textContent = label;
    if (details) {
      Array.prototype.forEach.call(details.querySelectorAll('li'), function (item) {
        var text = (item.textContent || '').trim();
        if (/^Price:/i.test(text)) {
          var valueSpan = item.querySelector('span:last-child');
          if (valueSpan) valueSpan.textContent = 'Price: ' + label;
        }
      });
    }
    if (window.ShopPricing) {
      window.ShopPricing.applyToProductPage();
    }
  }

  if (title) title.textContent = product.title;
  if (category) category.textContent = product.category;
  if (status) status.textContent = product.status;
  updatePriceDisplay();
  if (description) description.textContent = product.description;
  if (mainImage) {
    mainImage.src = product.images[0];
    mainImage.alt = product.title;
  }
  if (inquiry) {
    inquiry.href = 'contact.html#submit-item';
  }
  if (addToCart) {
    addToCart.addEventListener('click', function () {
      if (!window.ShopCart) return;
      window.ShopCart.add(product.id);
      if (cartMessage) {
        cartMessage.innerHTML = 'Added to cart. <a class="text-primary underline underline-offset-4 decoration-primary/30 hover:decoration-primary" href="cart.html">View cart</a>.';
      }
    });
  }

  if (details) {
    details.innerHTML = '';
    (product.details || []).forEach(function (line) {
      var li = document.createElement('li');
      li.className = 'flex gap-3';
      li.innerHTML = '<span class="material-symbols-outlined text-primary text-base mt-0.5 flex-shrink-0">check</span><span></span>';
      li.querySelector('span:last-child').textContent = line;
      details.appendChild(li);
    });
    updatePriceDisplay();
  }

  if (thumbs) {
    thumbs.innerHTML = '';
    if ((product.images || []).length > 1) {
      product.images.forEach(function (src, index) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'product-thumb' + (index === 0 ? ' product-thumb--active' : '');
        button.setAttribute('aria-label', 'View image ' + (index + 1));
        button.innerHTML = '<img alt="" src="' + src + '" />';
        button.addEventListener('click', function () {
          if (mainImage) mainImage.src = src;
          Array.prototype.forEach.call(thumbs.querySelectorAll('.product-thumb'), function (thumb) {
            thumb.classList.remove('product-thumb--active');
          });
          button.classList.add('product-thumb--active');
        });
        thumbs.appendChild(button);
      });
    }
  }

  if (window.ShopPricing) {
    window.ShopPricing.onReady(function () {
      updatePriceDisplay();
    });
  }
})();
