addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

const CACHE_TTL = 300; // seconds

async function handleRequest(request) {
  const url = new URL(request.url);

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...headers,
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  if (url.pathname === "/location") {
    try {
      const resp = await fetch(`https://api.ipdata.co?api-key=${IPDATA_KEY}`);
      const data = await resp.json();
      return new Response(
        JSON.stringify({ latitude: data.latitude, longitude: data.longitude }),
        { headers }
      );
    } catch (err) {
      return new Response(JSON.stringify({ error: "Failed to get location" }), {
        status: 500,
        headers,
      });
    }
  }

  if (url.pathname === "/weather") {
    const q = url.searchParams.get("q");
    if (!q)
      return new Response(JSON.stringify({ error: "Missing query param 'q'" }), {
        status: 400,
        headers,
      });

    const cache = caches.default;
    const cacheKey = new Request(
      new URL(`/__cache/weather?q=${encodeURIComponent(q)}`, url.origin)
    );

    try {
      const cached = await cache.match(cacheKey);
      if (cached) {
        const cachedBody = await cached.text();
        return new Response(cachedBody, { status: cached.status, headers });
      }

      const upstream = await fetch(
        `https://api.weatherapi.com/v1/forecast.json?key=${WEATHERAPI_KEY}&q=${encodeURIComponent(
          q
        )}&days=3&aqi=yes&alerts=yes`
      );
      const payload = await upstream.json();
      const response = new Response(JSON.stringify(payload), {
        status: upstream.ok ? 200 : upstream.status,
        headers: { ...headers, "Cache-Control": `public, max-age=${CACHE_TTL}` },
      });

      event.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    } catch (err) {
      return new Response(JSON.stringify({ error: "Failed to get weather" }), {
        status: 500,
        headers,
      });
    }
  }

  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers,
  });
}
