addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

const CACHE_TTL = 300; 

async function handleRequest(request) {
  const url = new URL(request.url);
  const headers = {
    "Access-Control-Allow-Origin": `${domain}`, 
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers });
  }
  if (url.pathname === "/location") {
    try {
      const resp = await fetch(`https://api.ipdata.co?api-key=${IPDATA_KEY}`);
      const data = await resp.json();
      return new Response(JSON.stringify({
        latitude: data.latitude,
        longitude: data.longitude
      }), { headers });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Failed to get location" }), { status: 500, headers });
    }
  }

  if (url.pathname === "/weather") {
    const q = url.searchParams.get("q");
    if (!q) return new Response(JSON.stringify({ error: "Missing query param 'q'" }), { status: 400, headers });
    const cacheKey = `weather-${q}`;
    const cache = caches.default;
    let cachedResp = await cache.match(cacheKey);
    if (cachedResp) return cachedResp;

    try {
      const resp = await fetch(`https://api.weatherapi.com/v1/forecast.json?key=${WEATHERAPI_KEY}&q=${encodeURIComponent(q)}&days=3&aqi=yes&alerts=yes`);
      const data = await resp.json();

      const response = new Response(JSON.stringify(data), { headers });
      response.headers.append("Cache-Control", `max-age=${CACHE_TTL}`);
      event.waitUntil(cache.put(cacheKey, response.clone()));

      return response;
    } catch (err) {
      return new Response(JSON.stringify({ error: "Failed to get weather" }), { status: 500, headers });
    }
  }

  return new Response("Not found", { status: 404, headers });
}
