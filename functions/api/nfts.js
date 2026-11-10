async function getMetadata(uri) {
  if (!uri || !uri.startsWith("https://")) return {};

  try {
    const response = await fetch(uri, {
      signal: AbortSignal.timeout(6000)
    });

    if (!response.ok) return {};

    const data = await response.json();

    return {
      ...data,
      image: data.image || data.image_url || data.preview || ""
    };
  } catch {
    return {};
  }
}

export async function onRequest({ request }) {
  const cache = caches.default;
  const cacheKey = new Request(request.url);

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const url = new URL("https://toncenter.com/api/v3/nft/items");
    url.searchParams.set("limit", "24");
    url.searchParams.set("offset", "0");

    const response = await fetch(url.toString());

    if (!response.ok) {
      return Response.json({
        ok: false,
        error: "TON API unavailable",
        code: response.status
      }, { status: response.status });
    }

    const data = await response.json();
    const items = data.nft_items || [];

    for (let i = 0; i < items.length; i += 6) {
      const batch = items.slice(i, i + 6);

      await Promise.all(batch.map(async (nft) => {
        const uri = nft.content?.uri;
        const metadata = await getMetadata(uri);

        nft.content = {
          ...nft.content,
          ...metadata
        };
      }));
    }

    const result = Response.json({
      ...data,
      nft_items: items
    }, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300"
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
