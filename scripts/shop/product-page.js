(function () {
  function start() {
    var products = window.SHOP_PRODUCTS || [];
    var params = new URLSearchParams(window.location.search);
    var id = params.get('id');
    var product = products.find(function (item) { return item.id === id; });

    var ES = (document.documentElement.getAttribute('lang') || '').toLowerCase().indexOf('es') === 0;
    var CAT_ES = { 'gold': 'Oro', 'silver': 'Plata', 'bullion': 'Lingotes', 'diamond': 'Diamantes', 'diamonds': 'Diamantes', 'watch': 'Relojes', 'watches': 'Relojes', 'antique': 'Antigüedades', 'antiques': 'Antigüedades', 'jewelry': 'Joyería', 'coins': 'Monedas', 'coin': 'Monedas' };
    var STATUS_ES = { 'available': 'Disponible', 'sold': 'Vendido', 'reserved': 'Reservado', 'on hold': 'En espera', 'pending': 'Pendiente' };
    function L(en, es) { return (ES && es) ? es : en; }
    function catLabel(cat) { if (!ES || !cat) return cat; return CAT_ES[String(cat).toLowerCase()] || cat; }
    function statusLabel(s) { if (!ES || !s) return s; return STATUS_ES[String(s).toLowerCase()] || s; }
    function pTitle() { return (ES && product && product.title_es) ? product.title_es : (product ? product.title : ''); }
    function pDescription() { return (ES && product && product.description_es) ? product.description_es : (product ? product.description : ''); }
    function pDetails() { return (ES && product && product.details_es) ? product.details_es : ((product && product.details) || []); }

    var found = document.getElementById('product-found');
    var missing = document.getElementById('product-missing');

    if (!product) {
      if (found) found.hidden = true;
      if (missing) missing.hidden = false;
      document.title = L('Listing Not Found', 'Artículo No Encontrado') + ' | Naples Estate Jewelry';
      return;
    }

    document.title = pTitle() + ' | Naples Estate Jewelry';

    var title = document.getElementById('product-title');
    var category = document.getElementById('product-category');
    var status = document.getElementById('product-status');
    var price = document.getElementById('product-price');
    var scrapValue = document.getElementById('product-scrap-value');
    var description = document.getElementById('product-description');
    var mainImage = document.getElementById('product-main-image');
    var thumbs = document.getElementById('product-thumbnails');
    var details = document.getElementById('product-details');
    var inquiry = document.getElementById('product-inquiry-link');
    var addToCart = document.getElementById('product-add-to-cart');
    var saveFavorite = document.getElementById('product-save-favorite');
    var cartMessage = document.getElementById('product-cart-message');
    var selectedImageIndex = 0;

    function getDisplayPriceLabel() {
      if (window.ShopPricing) {
        return window.ShopPricing.getDisplayPrice(product).label;
      }
      return product.manualPriceLabel || product.priceLabel;
    }

    function getScrapValueLabel() {
      if (!window.ShopPricing || !window.ShopPricing.calculatePublicPrice) return '';
      var priced = window.ShopPricing.calculatePublicPrice(product, window.ShopPricing.getSpotData && window.ShopPricing.getSpotData());
      return priced && priced.meltValue ? window.ShopPricing.formatMoney(window.ShopPricing.roundToCents(priced.meltValue)) : '';
    }

    function updatePriceDisplay() {
      var label = getDisplayPriceLabel();
      if (price) price.textContent = label;
      if (scrapValue) {
        var scrapLabel = getScrapValueLabel();
        if (scrapLabel) {
          scrapValue.textContent = L('Exact gold scrap value: ', 'Valor exacto de fundición del oro: ') + scrapLabel;
          scrapValue.hidden = false;
        } else {
          scrapValue.textContent = '';
          scrapValue.hidden = true;
        }
      }
      if (details) {
        Array.prototype.forEach.call(details.querySelectorAll('li'), function (item) {
          var text = (item.textContent || '').trim();
          if (/^(Price|Your price|Precio|Su precio):/i.test(text)) {
            var valueSpan = item.querySelector('span:last-child');
            if (valueSpan) valueSpan.textContent = L('Your price: ', 'Su precio: ') + label;
          }
        });
      }
      if (window.ShopPricing) {
        window.ShopPricing.applyToProductPage();
      }
    }

    function setupImageZoom() {
      if (!mainImage || !window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

      var frame = mainImage.closest('.product-main-frame');
      if (!frame) return;

      var zoom = document.createElement('div');
      zoom.className = 'product-zoom-popover';
      frame.appendChild(zoom);
      var zoomFactor = 3;
      var zoomImage = new Image();
      var zoomNaturalWidth = 0;
      var zoomNaturalHeight = 0;
      var currentZoomSrc = '';

      function getZoomImageSrc() {
        var zoomImages = product.zoomImages || [];
        return zoomImages[selectedImageIndex] ||
          product.zoomImage ||
          mainImage.currentSrc ||
          mainImage.src;
      }

      function updateZoomImage() {
        var src = getZoomImageSrc();
        if (!src || src === currentZoomSrc) return;

        currentZoomSrc = src;
        zoomNaturalWidth = 0;
        zoomNaturalHeight = 0;
        zoom.style.backgroundImage = 'url("' + src + '")';

        zoomImage = new Image();
        zoomImage.onload = function () {
          if (zoomImage.src.indexOf(currentZoomSrc) === -1 && zoomImage.currentSrc !== currentZoomSrc) return;
          zoomNaturalWidth = zoomImage.naturalWidth;
          zoomNaturalHeight = zoomImage.naturalHeight;
        };
        zoomImage.src = src;
      }

      function moveZoom(event) {
        var rect = mainImage.getBoundingClientRect();
        var frameRect = frame.getBoundingClientRect();
        var zoomRect = zoom.getBoundingClientRect();
        var x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        var y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
        var left = event.clientX - frameRect.left;
        var top = event.clientY - frameRect.top;
        var bgWidth = zoomNaturalWidth || (rect.width * zoomFactor);
        var bgHeight = zoomNaturalHeight || (rect.height * zoomFactor);
        var bgX = (x * bgWidth) - (zoomRect.width / 2);
        var bgY = (y * bgHeight) - (zoomRect.height / 2);

        zoom.style.left = left + 'px';
        zoom.style.top = top + 'px';
        zoom.style.backgroundSize = bgWidth + 'px ' + bgHeight + 'px';
        zoom.style.backgroundPosition = '-' + bgX + 'px -' + bgY + 'px';
      }

      mainImage.addEventListener('load', updateZoomImage);
      frame.addEventListener('mouseenter', function (event) {
        updateZoomImage();
        moveZoom(event);
        zoom.classList.add('is-visible');
      });
      frame.addEventListener('mousemove', moveZoom);
      frame.addEventListener('mouseleave', function () {
        zoom.classList.remove('is-visible');
      });
    }

    async function updateFavoriteButton() {
      if (!saveFavorite) return;
      if (!window.NaplesAuth || !window.NaplesAuth.isConfigured()) {
        saveFavorite.textContent = L('Sign in to save favorites', 'Inicie sesión para guardar favoritos');
        saveFavorite.onclick = function () {
          window.location.href = 'account.html';
        };
        return;
      }

      var session = window.NaplesAuth.getSession();
      if (!session) {
        saveFavorite.textContent = L('Sign in to save favorites', 'Inicie sesión para guardar favoritos');
        saveFavorite.onclick = function () {
          window.location.href = 'account.html';
        };
        return;
      }

      var saved = await window.NaplesAuth.isFavorite(product.id);
      saveFavorite.textContent = saved ? L('Saved to favorites', 'Guardado en favoritos') : L('Save to favorites', 'Guardar en favoritos');
      saveFavorite.onclick = async function () {
        try {
          var nowSaved = await window.NaplesAuth.toggleFavorite(product.id);
          saveFavorite.textContent = nowSaved ? L('Saved to favorites', 'Guardado en favoritos') : L('Save to favorites', 'Guardar en favoritos');
        } catch (error) {
          if (cartMessage) cartMessage.textContent = error.message;
        }
      };
    }

    if (title) title.textContent = pTitle();
    if (category) category.textContent = catLabel(product.category);
    if (status) status.textContent = statusLabel(product.status);
    updatePriceDisplay();
    if (description) description.textContent = pDescription();
    if (mainImage) {
      mainImage.src = product.images[0];
      mainImage.alt = pTitle();
      setupImageZoom();
    }
    if (inquiry) {
      inquiry.href = 'contact.html#submit-item';
    }
    if (addToCart) {
      addToCart.addEventListener('click', function () {
        if (!window.ShopCart) return;
        window.ShopCart.add(product.id);
        if (cartMessage) {
          cartMessage.innerHTML = L('Added to cart. <a class="text-primary underline underline-offset-4 decoration-primary/30 hover:decoration-primary" href="cart.html">View cart</a>.', 'Agregado al carrito. <a class="text-primary underline underline-offset-4 decoration-primary/30 hover:decoration-primary" href="cart.html">Ver carrito</a>.');
        }
      });
    }

    if (details) {
      details.innerHTML = '';
      pDetails().forEach(function (line) {
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
          button.setAttribute('aria-label', L('View image ', 'Ver imagen ') + (index + 1));
          button.innerHTML = '<img alt="" src="' + src + '" />';
          button.addEventListener('click', function () {
            selectedImageIndex = index;
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

    var authReady = window.NaplesAuth && window.NaplesAuth.isConfigured()
      ? window.NaplesAuth.init()
      : Promise.resolve();
    authReady.then(updateFavoriteButton);
  }

  start();
})();
