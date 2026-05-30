(function () {
  var CART_KEY = 'naplesShopCart';

  function readCart() {
    try {
      var items = JSON.parse(window.localStorage.getItem(CART_KEY) || '[]');
      if (window.SHOP_PRODUCTS) {
        var valid = {};
        window.SHOP_PRODUCTS.forEach(function (product) { valid[product.id] = true; });
        items = items.filter(function (id) { return valid[id]; });
        window.localStorage.setItem(CART_KEY, JSON.stringify(items));
      }
      return items;
    } catch (error) {
      return [];
    }
  }

  function writeCart(items) {
    window.localStorage.setItem(CART_KEY, JSON.stringify(items));
    updateCartCounts();
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
    var items = uniqueItems(readCart().concat(id));
    writeCart(items);
    return items;
  }

  function remove(id) {
    var items = readCart().filter(function (itemId) { return itemId !== id; });
    writeCart(items);
    return items;
  }

  function clear() {
    writeCart([]);
  }

  function count() {
    return readCart().length;
  }

  function updateCartCounts() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-cart-count]'), function (el) {
      el.textContent = String(count());
    });
  }

  window.ShopCart = {
    add: add,
    remove: remove,
    clear: clear,
    read: readCart,
    count: count,
    updateCartCounts: updateCartCounts
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateCartCounts);
  } else {
    updateCartCounts();
  }
})();
