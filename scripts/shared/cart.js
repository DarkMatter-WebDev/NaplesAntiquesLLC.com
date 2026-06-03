(function () {
  var CART_KEY = 'naplesShopCart';
  var isSyncing = false;

  function filterValid(items) {
    var unique = uniqueItems(items || []);
    if (!window.SHOP_PRODUCTS) return unique;

    var valid = {};
    window.SHOP_PRODUCTS.forEach(function (product) {
      valid[product.id] = true;
    });

    return unique.filter(function (id) {
      return valid[id];
    });
  }

  function readLocalCart() {
    try {
      return JSON.parse(window.localStorage.getItem(CART_KEY) || '[]');
    } catch (error) {
      return [];
    }
  }

  function readCart() {
    var items = filterValid(readLocalCart());
    window.localStorage.setItem(CART_KEY, JSON.stringify(items));
    return items;
  }

  function writeLocalCart(items) {
    var cleanItems = filterValid(items);
    window.localStorage.setItem(CART_KEY, JSON.stringify(cleanItems));
    updateCartCounts();
    window.dispatchEvent(new CustomEvent('shopcart:updated', { detail: { items: cleanItems } }));
    return cleanItems;
  }

  function writeCart(items, options) {
    var cleanItems = writeLocalCart(items);
    if (!(options && options.skipRemoteSync)) {
      saveRemoteCart(cleanItems);
    }
    return cleanItems;
  }

  function uniqueItems(items) {
    var seen = {};
    return items.filter(function (id) {
      if (!id || seen[id]) return false;
      seen[id] = true;
      return true;
    });
  }

  function add(id) {
    return writeCart(readCart().concat(id));
  }

  function remove(id) {
    return writeCart(readCart().filter(function (itemId) { return itemId !== id; }));
  }

  function clear() {
    return writeCart([]);
  }

  function count() {
    return readCart().length;
  }

  function has(id) {
    return readCart().indexOf(id) !== -1;
  }

  function updateCartCounts() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-cart-count]'), function (el) {
      el.textContent = String(readCart().length);
    });
  }

  function saveRemoteCart(items) {
    if (
      isSyncing ||
      !window.NaplesAuth ||
      !window.NaplesAuth.isConfigured ||
      !window.NaplesAuth.isConfigured() ||
      !window.NaplesAuth.getSession ||
      !window.NaplesAuth.getSession()
    ) {
      return Promise.resolve(items);
    }

    return window.NaplesAuth.saveCart(items).catch(function (error) {
      console.warn('Unable to save account cart:', error.message);
      return items;
    });
  }

  async function syncFromAccount() {
    if (
      !window.NaplesAuth ||
      !window.NaplesAuth.isConfigured ||
      !window.NaplesAuth.isConfigured() ||
      !window.NaplesAuth.getSession ||
      !window.NaplesAuth.getSession()
    ) {
      updateCartCounts();
      return readCart();
    }

    isSyncing = true;
    try {
      var localItems = readCart();
      var remoteItems = await window.NaplesAuth.loadCart();
      var merged = filterValid(remoteItems.concat(localItems));
      writeLocalCart(merged);
      await window.NaplesAuth.saveCart(merged);
      return merged;
    } catch (error) {
      console.warn('Unable to sync account cart:', error.message);
      return readCart();
    } finally {
      isSyncing = false;
    }
  }

  window.ShopCart = {
    add: add,
    remove: remove,
    has: has,
    clear: clear,
    read: readCart,
    count: count,
    updateCartCounts: updateCartCounts,
    syncFromAccount: syncFromAccount
  };

  function init() {
    updateCartCounts();
    if (window.NaplesAuth && window.NaplesAuth.isConfigured && window.NaplesAuth.isConfigured()) {
      window.NaplesAuth.init().then(syncFromAccount);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
