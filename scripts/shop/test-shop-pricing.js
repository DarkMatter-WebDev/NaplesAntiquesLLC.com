/* Quick verification for live gold pricing math and fallbacks. */
var GRAMS_PER_TROY_OZ = 31.1034768;
var FALLBACK_GOLD_SPOT_PER_TROY_OZ = 5500;

function roundToCents(amount) {
  var value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 100) / 100;
}

function calculatePublicPrice(product, spotPerTroyOz) {
  var spotPerGram24k = spotPerTroyOz / GRAMS_PER_TROY_OZ;
  var meltValue = spotPerGram24k * (product.purity / 24) * product.weightGrams;
  var rawPrice = meltValue * product.pricingMultiplier;
  return roundToCents(rawPrice);
}

var products = [
  { id: '10k-cuban-link-chain-01', purity: 10, weightGrams: 119.41, pricingMultiplier: 1.25 },
  { id: '18k-heraldic-cross-band-ring-01', purity: 18, weightGrams: 16, pricingMultiplier: 1.25 },
  { id: '14k-mens-curb-link-bracelet-01', purity: 14, weightGrams: 22.75, pricingMultiplier: 1.25 },
  { id: '14k-infinity-rope-chain-necklace-01', purity: 14, weightGrams: 55.9, pricingMultiplier: 1.25 },];

var spot = FALLBACK_GOLD_SPOT_PER_TROY_OZ;
var total = 0;
var failures = [];

console.log('Testing pricing at fallback spot $' + spot + '/troy oz\n');

products.forEach(function (product) {
  var price = calculatePublicPrice(product, spot);
  total += price;
  var ok = price > 0;
  console.log(product.id + ': $' + price.toFixed(2) + ' ' + (ok ? 'OK' : 'WARN'));
  if (!ok) failures.push(product.id);
});

console.log('\nCart subtotal: $' + total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

console.log('\nCent accuracy checks:');
[
  [2487.129, 2487.13],
  [10780.555, 10780.56],
  [5955.004, 5955],
  [1498.1, 1498.1]
].forEach(function (pair) {
  var result = roundToCents(pair[0]);
  var ok = result === pair[1];
  console.log('roundToCents(' + pair[0] + ') = ' + result.toFixed(2) + ' expected ' + pair[1].toFixed(2) + ' ' + (ok ? 'OK' : 'FAIL'));
  if (!ok) failures.push('cents-' + pair[0]);
});

if (failures.length) {
  console.error('\nFailures:', failures.join(', '));
  process.exit(1);
}

console.log('\nAll pricing checks passed.');
