/* Quick verification for live gold pricing math and fallbacks. */
var GRAMS_PER_TROY_OZ = 31.1034768;
var FALLBACK_GOLD_SPOT_PER_TROY_OZ = 5500;

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

function calculatePublicPrice(product, spotPerTroyOz) {
  var spotPerGram24k = spotPerTroyOz / GRAMS_PER_TROY_OZ;
  var meltValue = spotPerGram24k * (product.purity / 24) * product.weightGrams;
  var rawPrice = meltValue * product.pricingMultiplier;
  return roundToRetail(rawPrice);
}

var products = [
  { id: '10k-cuban-link-chain-01', purity: 10, weightGrams: 119.41, pricingMultiplier: 1.25 },
  { id: '18k-heraldic-cross-band-ring-01', purity: 18, weightGrams: 16, pricingMultiplier: 1.25 },
  { id: '14k-mens-curb-link-bracelet-01', purity: 14, weightGrams: 22.75, pricingMultiplier: 1.25 },
  { id: '14k-infinity-rope-chain-necklace-01', purity: 14, weightGrams: 55.9, pricingMultiplier: 1.25 },
  { id: '14k-diamond-cut-figaro-chain-necklace-01', purity: 14, weightGrams: 23.3, pricingMultiplier: 1.25 }
];

var spot = FALLBACK_GOLD_SPOT_PER_TROY_OZ;
var total = 0;
var failures = [];

console.log('Testing pricing at fallback spot $' + spot + '/troy oz\n');

products.forEach(function (product) {
  var price = calculatePublicPrice(product, spot);
  total += price;
  var ok = price > 0;
  console.log(product.id + ': $' + price + ' ' + (ok ? 'OK' : 'WARN'));
  if (!ok) failures.push(product.id);
});

console.log('\nCart subtotal: $' + total.toLocaleString('en-US'));

console.log('\nRounding checks:');
[
  [2487, 2475],
  [10780, 10800],
  [5955, 5950],
  [1498, 1500]
].forEach(function (pair) {
  var result = roundToRetail(pair[0]);
  var ok = result === pair[1];
  console.log('roundToRetail(' + pair[0] + ') = ' + result + ' expected ' + pair[1] + ' ' + (ok ? 'OK' : 'FAIL'));
  if (!ok) failures.push('round-' + pair[0]);
});

if (failures.length) {
  console.error('\nFailures:', failures.join(', '));
  process.exit(1);
}

console.log('\nAll pricing checks passed.');
