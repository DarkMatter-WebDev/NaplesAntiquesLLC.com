(function () {
  var GRAMS_PER_TROY_OZ = 31.1034768;
  var SPOT_ENDPOINT = '/.netlify/functions/metal-prices';
  var CLIENT_CACHE_KEY = 'naplesGoldSpotCacheV2';
  var CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;
  var FALLBACK_GOLD_SPOT_PER_TROY_OZ = 5500;

  var spotData = null;
  var readyCallbacks = [];
  var isReady = false;
  var refreshTimer = null;

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
      return withClientCacheWindow(parsed.payload, parsed.expiresAt);
    } catch (error) {
      return null;
    }
  }

  function writeClientCache(payload) {
    try {
      var expiresAt = Date.now() + CLIENT_CACHE_TTL_MS;
      var normalizedPayload = withClientCacheWindow(payload, expiresAt);
      window.sessionStorage.setItem(CLIENT_CACHE_KEY, JSON.stringify({
        payload: normalizedPayload,
        expiresAt: expiresAt
      }));
      return normalizedPayload;
    } catch (error) {
      /* ignore storage failures */
    }

    return payload;
  }

  function withClientCacheWindow(payload, expiresAt) {
    return Object.assign({}, payload, {
      clientNextUpdateAt: new Date(expiresAt).toISOString()
    });
  }

  function buildFallbackSpot(source) {
    return {
      goldSpotPerTroyOz: FALLBACK_GOLD_SPOT_PER_TROY_OZ,
      goldSpotPerGram24k: FALLBACK_GOLD_SPOT_PER_TROY_OZ / GRAMS_PER_TROY_OZ,
      currency: 'USD',
      source: source || 'fallback',
      updatedAt: new Date().toISOString(),
      marketStatus: getLocalMarketStatus(),
      clientNextUpdateAt: new Date(Date.now() + CLIENT_CACHE_TTL_MS).toISOString()
    };
  }

  function getLocalMarketStatus() {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    }).formatToParts(new Date()).reduce(function (values, part) {
      values[part.type] = part.value;
      return values;
    }, {});

    var weekday = parts.weekday;
    var hour = Number(parts.hour);
    var minute = Number(parts.minute);
    var minutesAfterMidnight = hour * 60 + minute;
    var isWeekendClose =
      weekday === 'Sat' ||
      (weekday === 'Fri' && minutesAfterMidnight >= 17 * 60) ||
      (weekday === 'Sun' && minutesAfterMidnight < 18 * 60);

    return {
      market: 'gold',
      timeZone: 'America/New_York',
      isClosed: isWeekendClose,
      reason: isWeekendClose ? 'weekend' : 'open'
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
        spotData = writeClientCache(payload);
        return payload;
      })
      .catch(function () {
        spotData = writeClientCache(buildFallbackSpot('fallback'));
        return spotData;
      });
  }

  function formatMoney(amount) {
    return '$' + Number(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function roundToCents(amount) {
    var value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.round(value * 100) / 100;
  }

  function formatMultiplier(multiplier) {
    var value = Number(multiplier);
    if (!Number.isFinite(value) || value <= 0) return '';
    return value.toFixed(2).replace(/\.?0+$/, '') + 'x';
  }

  function formatSpotPrice(spot) {
    var value = spot && Number(spot.goldSpotPerTroyOz);
    if (!Number.isFinite(value) || value <= 0) return '';
    return formatMoney(value) + '/oz';
  }

  function buildPriceContext(product) {
    if (!usesSpotPricing(product)) {
      return 'Manual price';
    }

    var multiplier = formatMultiplier(product.pricingMultiplier);
    var countdown = formatNextUpdateCountdown();
    var label = multiplier
      ? 'Live price - ' + multiplier + ' spot multiplier'
      : 'Live price';

    return countdown ? label + '\n' + countdown : label;
  }

  function isMarketClosed() {
    var status = spotData && spotData.marketStatus;
    if (status && typeof status.isClosed === 'boolean') {
      return status.isClosed;
    }
    return getLocalMarketStatus().isClosed;
  }

  function formatMarketClosedMessage() {
    return 'Market closed - updates resume when trading reopens';
  }

  function getNextUpdateTime() {
    if (!spotData) return null;
    var raw = spotData.nextUpdateAt || spotData.clientNextUpdateAt;
    if (!raw) return null;
    var date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function getMsUntilNextUpdate() {
    var nextUpdate = getNextUpdateTime();
    if (!nextUpdate) return null;
    return nextUpdate.getTime() - Date.now();
  }

  function formatNextUpdateCountdown() {
    if (isMarketClosed()) {
      return formatMarketClosedMessage();
    }

    var ms = getMsUntilNextUpdate();
    if (ms === null) return '';
    if (ms <= 0) return 'Next update: soon';
    var minutes = Math.max(1, Math.ceil(ms / 60000));
    return 'Next update: ' + minutes + ' min';
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
    var amount = roundToCents(rawPrice);

    return {
      amount: amount,
      label: formatMoney(amount),
      source: 'spot-multiplier',
      meltValue: meltValue,
      spotPerGram24k: spotPerGram24k
    };
  }

  function getDisplayPrice(product) {
    if (
      window.NaplesAuth &&
      window.NaplesAuth.isVip &&
      window.NaplesAuth.isVip() &&
      product.privatePriceLabel
    ) {
      return {
        amount: priceLabelToNumber(product.privatePriceLabel),
        label: product.privatePriceLabel,
        source: 'private'
      };
    }

    return calculatePublicPrice(product, spotData || buildFallbackSpot('fallback'));
  }

  function applyProductPrices(products) {
    (products || []).forEach(function (product) {
      var priced = getDisplayPrice(product);
      var publicPriced = calculatePublicPrice(product, spotData || buildFallbackSpot('fallback'));
      product.calculatedPrice = priced.amount;
      product.priceLabel = priced.label || product.manualPriceLabel || product.priceLabel;
      product.priceSource = priced.source;
      product.scrapValue = publicPriced && publicPriced.meltValue ? roundToCents(publicPriced.meltValue) : 0;
      product.scrapValueLabel = product.scrapValue ? formatMoney(product.scrapValue) : '';
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

      var contextEl = card.querySelector('[data-shop-price-context]');
      if (contextEl) {
        contextEl.textContent = buildPriceContext(product);
      }
    });

    var spotMeta = document.getElementById('shop-spot-meta');
    if (spotMeta && spotData) {
      var timeLabel = formatSpotTimestamp(spotData.updatedAt);
      var sourceLabel = spotData.source === 'fallback' ? 'estimated spot' : 'live spot';
      var spotLabel = formatSpotPrice(spotData);
      var countdown = formatNextUpdateCountdown();
      if (isMarketClosed()) {
        spotMeta.textContent = timeLabel
          ? 'Gold market closed - last ' + sourceLabel + ' update ' + timeLabel + (spotLabel ? ' - spot ' + spotLabel : '')
          : 'Gold market closed - pricing will refresh when trading reopens' + (spotLabel ? ' - spot ' + spotLabel : '');
      } else {
        spotMeta.textContent = timeLabel
          ? 'Gold ' + sourceLabel + ' updated ' + timeLabel + (spotLabel ? ' - spot ' + spotLabel : '') + (countdown ? ' - ' + countdown : '')
          : 'Gold pricing updated from current spot' + (spotLabel ? ' - spot ' + spotLabel : '') + (countdown ? ' - ' + countdown : '');
      }
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

    var scrapEl = document.getElementById('product-scrap-value');
    if (scrapEl) {
      if (product.scrapValueLabel) {
        scrapEl.textContent = 'Exact gold scrap value: ' + product.scrapValueLabel;
        scrapEl.hidden = false;
      } else {
        scrapEl.textContent = '';
        scrapEl.hidden = true;
      }
    }

    var contextEl = document.getElementById('product-price-context');
    if (contextEl) {
      contextEl.textContent = buildPriceContext(product);
      contextEl.hidden = false;
    }

    var details = document.getElementById('product-details');
    if (details) {
      Array.prototype.forEach.call(details.querySelectorAll('li'), function (item) {
        var text = item.textContent || '';
        if (/^(Price|Your price):/i.test(text.trim())) {
          item.querySelector('span:last-child').textContent = 'Your price: ' + product.priceLabel;
        }
      });
    }

    var spotMeta = document.getElementById('product-spot-meta');
    if (spotMeta && spotData) {
      var timeLabel = formatSpotTimestamp(spotData.updatedAt);
      var spotLabel = formatSpotPrice(spotData);
      var countdown = formatNextUpdateCountdown();
      if (isMarketClosed()) {
        spotMeta.textContent = timeLabel
          ? 'Price reflects last gold spot update ' + timeLabel + (spotLabel ? ' at ' + spotLabel : '') + '. Market closed; updates resume when trading reopens.'
          : 'Market closed; pricing will refresh when trading reopens' + (spotLabel ? ' from spot ' + spotLabel : '') + '.';
      } else {
        spotMeta.textContent = timeLabel
          ? 'Price reflects gold spot updated ' + timeLabel + (spotLabel ? ' at ' + spotLabel : '') + (countdown ? ' - ' + countdown : '') + '.'
          : 'Price reflects current gold spot' + (spotLabel ? ' at ' + spotLabel : '') + (countdown ? ' - ' + countdown : '') + '.';
      }
      spotMeta.hidden = false;
    }
  }

  function refreshDisplays() {
    applyProductPrices(window.SHOP_PRODUCTS || []);
    applyToShopCards();
    applyToProductPage();
  }

  function startRefreshTimer() {
    if (refreshTimer) {
      window.clearInterval(refreshTimer);
    }

    refreshTimer = window.setInterval(function () {
      var ms = getMsUntilNextUpdate();
      if (ms !== null && ms <= 0) {
        fetchSpot().then(function () {
          refreshDisplays();
        });
        return;
      }

      refreshDisplays();
    }, 30000);
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
      startRefreshTimer();
      runReadyCallbacks();
      return spot;
    });
  }

  window.ShopPricing = {
    GRAMS_PER_TROY_OZ: GRAMS_PER_TROY_OZ,
    onReady: onReady,
    fetchSpot: fetchSpot,
    roundToCents: roundToCents,
    formatMoney: formatMoney,
    calculatePublicPrice: calculatePublicPrice,
    getDisplayPrice: getDisplayPrice,
    applyProductPrices: applyProductPrices,
    applyToShopCards: applyToShopCards,
    applyToProductPage: applyToProductPage,
    formatNextUpdateCountdown: formatNextUpdateCountdown,
    getSpotData: function () { return spotData; },
    init: init
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
