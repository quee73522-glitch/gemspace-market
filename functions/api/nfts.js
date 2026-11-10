
export async function onRequest({ request, env }) {
  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: "GET" });

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  if (!env.TONAPI_KEY) {
    return Response.json(
      { ok: false, error: "TONAPI_KEY is missing" },
      { status: 500 }
    );
  }

  const headers = {
    Authorization: `Bearer ${env.TONAPI_KEY}`,
    Accept: "application/json"
  };

  async function api(path) {
    const response = await fetch(`https://tonapi.io${path}`, {
      headers,
      signal: AbortSignal.timeout(12000)
    });

    if (!response.ok) {
      throw new Error(`TonAPI error: ${response.status}`);
    }

    return response.json();
  }

  try {
    const collectionsData = await api(
      "/v2/nfts/collections?limit=4&offset=0"
    );

    const collections = collectionsData.nft_collections || [];
    const items = [];

    for (const collection of collections) {
      if (!collection.address) continue;

      const data = await api(
        `/v2/nfts/collections/${encodeURIComponent(collection.address)}/items?limit=15&offset=0`
      );

      for (const nft of data.nft_items || []) {
        const metadata = nft.metadata || {};
        const preview = nft.previews?.find(
          p => p.resolution === "500x500"
        ) || nft.previews?.[0];

        items.push({
          ...nft,
          name: metadata.name || "TON NFT",
          image: preview?.url || metadata.image || "",
          content: {
            ...metadata,
            name: metadata.name || "TON NFT",
            image: preview?.url || metadata.image || ""
          }
        });
      }
    }

    const result = Response.json(
      { ok: true, nft_items: items },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=300"
        }
      }
    );

    await cache.put(cacheKey, result.clone());
    return result;

  } catch (error) {
    return Response.json(
      { ok: false, error: error.message },
      { status: 502 }
    );
  }
}
