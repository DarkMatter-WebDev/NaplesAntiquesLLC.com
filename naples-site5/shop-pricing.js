(function () {
  var GRAMS_PER_TROY_OZ = 31.1034768;
  var SPOT_ENDPOINT = '/.netlify/functions/metal-prices';
  var CLIENT_CACHE_KEY = 'naplesGoldSpotCacheV2';
  var CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;
  var FALLBACK_GOLD_SPOT_PER_TROY_OZ = 5500;

  var spotData = null;
  var readyCallbacks = [];
  var isReady = false;

  function runReadyCallbacks() {
    isReady = true;
    readyCallbacks.splice(0).forEach(function (callback) {
      try {
        callback(spotData);
      } catch (error) {
        console.warn('ShopPricing callback failed', error);
      }
    });
  }

  function onReady(callback) {
    if (typeof callback !== 'function') return;
    if (isReady) {
      callback(spotData);
      return;
    }
    readyCallbacks.push(callback);
  }

  function readClientCache() {
    try {
      var raw = window.sessionStorage.getItem(CLIENT_CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.payload || !parsed.expiresAt || parsed.expiresAt <= Date.now()) {
        return null;
      }
      return parsed.payload;
    } catch (error) {
      return null;
    }
  }

  function writeClientCache(payload) {
    try {
      window.sessionStorage.setItem(CLIENT_CACHE_KEY, JSON.stringify({
        payload: payload,
        expiresAt: Date.now() + CLIENT_CACHE_TTL_MS
      }));
    } catch (error) {
      /* ignore storage failures */
    }
  }

  function buildFallbackSpot(source) {
    return {
      goldSpotPerTroyOz: FALLBACK_GOLD_SPOT_PER_TROY_OZ,
      goldSpotPerGram24k: FALLBACK_GOLD_SPOT_PER_TROY_OZ / GRAMS_PER_TROY_OZ,
      currency: 'USD',
      source: source || 'fallback',
      updatedAt: new Date().toISOString()
    };
  }

  function fetchSpot() {
    var cached = readClientCache();
    if (cached) {
      spotData = cached;
      return Promise.resolve(cached);
    }

    return fetch(SPOT_ENDPOINT, { credentials: 'same-origin' })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Spot price request failed');
        }
        return response.json();
      })
      .then(function (payload) {
        if (!payload || !payload.goldSpotPerTroyOz) {
          throw new Error('Spot price payload missing goldSpotPerTroyOz');
        }
        spotData = payload;
        writeClientCache(payload);
        return payload;
      })
      .catch(function () {
        spotData = buildFallbackSpot('fallback');
        return spotData;
      });
  }

  function roundToRetail(amount) {
    var value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return 0;

    var rounded;
    if (value >= 5000) {
      rounded = Math.round(value / 50) * 50;
    } else if (value >= 2000) {
      rounded = Math.round(value / 25) * 25;
    } else {
      rounded = Math.round(value / 5) * 5;
    }

    return Math.max(5, rounded);
  }

  function formatMoney(amount) {
    return '$' + Number(amount).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }

  function priceLabelToNumber(priceLabel) {
    return Number(String(priceLabel || '').replace(/[^0-9.]/g, '')) || 0;
  }

  function usesSpotPricing(product) {
    return product &&
      product.priceMode === 'spot-multiplier' &&
      Number(product.purity) > 0 &&
      Number(product.weightGrams) > 0 &&
      Number(product.pricingMultiplier) > 0;
  }

  function calculatePublicPrice(product, spot) {
    if (!usesSpotPricing(product)) {
      return {
        amount: priceLabelToNumber(product.manualPriceLabel || product.priceLabel),
        label: product.manualPriceLabel || product.priceLabel || '',
        source: 'manual'
      };
    }

    var spotPerGram24k = spot && spot.goldSpotPerGram24k
      ? Number(spot.goldSpotPerGram24k)
      : FALLBACK_GOLD_SPOT_PER_TROY_OZ / GRAMS_PER_TROY_OZ;

    var meltValue = spotPerGram24k * (Number(product.purity) / 24) * Number(product.weightGrams);
    var rawPrice = meltValue * Number(product.pricingMultiplier);
    var amount = roundToRetail(rawPrice);

    return {
      amount: amount,
      label: formatMoney(amount),
      source: 'spot-multiplier',
      meltValue: meltValue,
      spotPerGram24k: spotPerGram24k
    };
  }

  function getDisplayPrice(product) {
    return calculatePublicPrice(product, spotData || buildFallbackSpot('fallback'));
  }

  function applyProductPrices(products) {
    (products || []).forEach(function (product) {
      var priced = getDisplayPrice(product);
      product.calculatedPrice = priced.amount;
      product.priceLabel = priced.label || product.manualPriceLabel || product.priceLabel;
      product.priceSource = priced.source;
    });
  }

  function formatSpotTimestamp(isoString) {
    if (!isoString) return '';
    var date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function applyToShopCards() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-shop-item]'), function (card) {
      var id = card.getAttribute('data-shop-item');
      var product = (window.SHOP_PRODUCTS || []).find(function (item) { return item.id === id; });
      if (!product) return;

      var priceEl = card.querySelector('[data-shop-price]');
      if (priceEl) {
        priceEl.textContent = product.priceLabel;
      }
    });

    var spotMeta = document.getElementById('shop-spot-meta');
    if (spotMeta && spotData) {
      var timeLabel = formatSpotTimestamp(spotData.updatedAt);
      var sourceLabel = spotData.source === 'fallback' ? 'estimated spot' : 'live spot';
      spotMeta.textContent = timeLabel
        ? 'Gold ' + sourceLabel + ' updated ' + timeLabel
        : 'Gold pricing updated from current spot';
      spotMeta.hidden = false;
    }
  }

  function applyToProductPage() {
    var params = new URLSearchParams(window.location.search);
    var id = params.get('id');
    var product = (window.SHOP_PRODUCTS || []).find(function (item) { return item.id === id; });
    if (!product) return;

    var priceEl = document.getElementById('product-price');
    if (priceEl) {
      priceEl.textContent = product.priceLabel;
    }

    var details = document.getElementById('product-details');
    if (details) {
      Array.prototype.forEach.call(details.querySelectorAll('li'), function (item) {
        var text = item.textContent || '';
        if (/^Price:/i.test(text.trim())) {
          item.querySelector('span:last-child').textContent = 'Price: ' + product.priceLabel;
        }
      });
    }

    var spotMeta = document.getElementById('product-spot-meta');
    if (spotMeta && spotData) {
      var timeLabel = formatSpotTimestamp(spotData.updatedAt);
      spotMeta.textContent = timeLabel
        ? 'Price reflects gold spot updated ' + timeLabel + '.'
        : 'Price reflects current gold spot.';
      spotMeta.hidden = false;
    }
  }

  function init() {
    var products = window.SHOP_PRODUCTS || [];

    products.forEach(function (product) {
      if (!product.manualPriceLabel && product.priceLabel) {
        product.manualPriceLabel = product.priceLabel;
      }
    });

    applyProductPrices(products);

    return fetchSpot().then(function (spot) {
      applyProductPrices(products);
      applyToShopCards();
      applyToProductPage();
      runReadyCallbacks();
      return spot;
    });
  }

  window.ShopPricing = {
    GRAMS_PER_TROY_OZ: GRAMS_PER_TROY_OZ,
    onReady: onReady,
    fetchSpot: fetchSpot,
    roundToRetail: roundToRetail,
    formatMoney: formatMoney,
    calculatePublicPrice: calculatePublicPrice,
    getDisplayPrice: getDisplayPrice,
    applyProductPrices: applyProductPrices,
    applyToShopCards: applyToShopCards,
    applyToProductPage: applyToProductPage,
    getSpotData: function () { return spotData; },
    init: init
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
