const GRAMS_PER_TROY_OZ = 31.1034768;
const CACHE_TTL_MS = 5 * 60 * 1000;
const FALLBACK_GOLD_SPOT_PER_TROY_OZ = 5500;
const GOLD_API_URL = 'https://api.gold-api.com/price/XAU';

let cache = {
  payload: null,
  expiresAt: 0
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };
}

function normalizeSpotPrice(value) {
  var spot = Number(value);
  if (!Number.isFinite(spot) || spot <= 0) {
    return null;
  }
  return spot;
}

function buildPayload(spotPerTroyOz, source, fetchedAt) {
  var normalized = normalizeSpotPrice(spotPerTroyOz);
  if (!normalized) {
    return null;
  }

  return {
    goldSpotPerTroyOz: normalized,
    goldSpotPerGram24k: normalized / GRAMS_PER_TROY_OZ,
    currency: 'USD',
    source: source,
    updatedAt: fetchedAt || new Date().toISOString()
  };
}

function withCacheWindow(payload, expiresAt) {
  return Object.assign({}, payload, {
    nextUpdateAt: new Date(expiresAt).toISOString()
  });
}

function normalizeTimestamp(data) {
  var rawTimestamp = data && (data.updatedAt || data.updated_at || data.timestamp || data.time);
  if (!rawTimestamp) {
    return new Date().toISOString();
  }

  var date = typeof rawTimestamp === 'number'
    ? new Date(rawTimestamp > 10000000000 ? rawTimestamp : rawTimestamp * 1000)
    : new Date(rawTimestamp);

  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

async function fetchFromGoldApi() {
  var response = await fetch(GOLD_API_URL, {
    headers: {
      'Accept': 'application/json'
    }
  });
  if (!response.ok) {
    throw new Error('Gold API request failed with status ' + response.status);
  }

  var data = await response.json();
  var spotPerTroyOz = Number(data && (
    data.price ||
    data.ask ||
    data.bid ||
    data.rate ||
    data.value
  ));

  return buildPayload(spotPerTroyOz, 'gold-api', normalizeTimestamp(data));
}

async function fetchLiveSpot() {
  return fetchFromGoldApi();
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    var now = Date.now();
    if (cache.payload && cache.expiresAt > now) {
      return {
        statusCode: 200,
        headers: Object.assign({}, corsHeaders(), {
          'Cache-Control': 'public, max-age=300'
        }),
        body: JSON.stringify(Object.assign({}, cache.payload, { cached: true }))
      };
    }

    var payload = await fetchLiveSpot();
    if (!payload) {
      throw new Error('Unable to normalize gold spot price');
    }

    cache.expiresAt = now + CACHE_TTL_MS;
    cache.payload = withCacheWindow(payload, cache.expiresAt);

    return {
      statusCode: 200,
      headers: Object.assign({}, corsHeaders(), {
        'Cache-Control': 'public, max-age=300'
      }),
      body: JSON.stringify(cache.payload)
    };
  } catch (error) {
    var fallback = buildPayload(FALLBACK_GOLD_SPOT_PER_TROY_OZ, 'fallback', new Date().toISOString());
    cache.expiresAt = Date.now() + CACHE_TTL_MS;
    cache.payload = withCacheWindow(Object.assign({}, fallback, {
      warning: error && error.message ? error.message : 'Live spot price unavailable'
    }), cache.expiresAt);

    return {
      statusCode: 200,
      headers: Object.assign({}, corsHeaders(), {
        'Cache-Control': 'public, max-age=300'
      }),
      body: JSON.stringify(cache.payload)
    };
  }
};
