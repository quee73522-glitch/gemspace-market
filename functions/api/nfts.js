export async function onRequest({ request }) {
  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: "GET" });

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const url = new URL("https://toncenter.com/api/v3/nft/items");
  url.searchParams.set("limit", "60");
  url.searchParams.set("offset", "0");

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      return Response.json({
        ok: false,
        error: "TON API temporarily unavailable",
        code: response.status
      }, { status: response.status });
    }

    const data = await response.json();

    const result = Response.json(data, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=600"
      }
    });

    await cache.put(cacheKey, result.clone());
    return result;

  } catch (error) {
    return Response.json({
      ok: false,
      error: String(error)
    }, { status: 502 });
  }
      }
