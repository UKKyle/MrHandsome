interface Env {
  ASSETS: Fetcher;
  GOOGLE_PLACES_API_KEY?: string;
}

const SEARCH_QUERY = "Mr Handsome, 25 The Green, King's Norton, Birmingham B38 8SD";
const CACHE_SECONDS = 60 * 60 * 6;

async function getGoogleProfile(request: Request, env: Env) {
  const cache = caches.default;
  const cacheKey = new Request(new URL('/api/google-profile', request.url), { method: 'GET' });

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  if (!env.GOOGLE_PLACES_API_KEY) {
    return Response.json(
      { rating: 4.9, reviews: 290, source: 'fallback' },
      { headers: { 'Cache-Control': 'public, max-age=300' } },
    );
  }

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount',
    },
    body: JSON.stringify({ textQuery: SEARCH_QUERY }),
  });

  if (!response.ok) {
    return Response.json(
      { rating: 4.9, reviews: 290, source: 'fallback' },
      { headers: { 'Cache-Control': 'public, max-age=300' } },
    );
  }

  const data = await response.json() as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      rating?: number;
      userRatingCount?: number;
    }>;
  };

  const place = data.places?.[0];

  if (!place || typeof place.rating !== 'number' || typeof place.userRatingCount !== 'number') {
    return Response.json(
      { rating: 4.9, reviews: 290, source: 'fallback' },
      { headers: { 'Cache-Control': 'public, max-age=300' } },
    );
  }

  const body = JSON.stringify({
    rating: place.rating,
    reviews: place.userRatingCount,
    placeId: place.id,
    name: place.displayName?.text,
    address: place.formattedAddress,
    source: 'google',
    fetchedAt: new Date().toISOString(),
  });

  const result = new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
    },
  });

  await cache.put(cacheKey, result.clone());
  return result;
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/google-profile') {
      return getGoogleProfile(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
