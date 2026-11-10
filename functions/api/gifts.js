export async function onRequest({ request, env }) {
  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  if (!env.TONAPI_KEY) {
    return Response.json({ ok: false, error: "TONAPI_KEY is missing" }, { status: 500 });
  }

  const headers = {
    Authorization: `Bearer ${env.TONAPI_KEY}`,
    Accept: "application/json"
  };

  async function tonapi(path) {
    const response = await fetch(`https://tonapi.io${path}`, {
      headers,
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`TonAPI error: ${response.status}`);
    return response.json();
  }

  const giftNames = [
    "Santa Hat","Signet Ring","Precious Peach","Plush Pepe","Spiced Wine","Jelly Bunny","Durov's Cap","Perfume Bottle","Eternal Rose","Berry Box","Vintage Cigar","Magic Potion","Kissed Frog","Hex Pot","Evil Eye","Sharp Tongue","Trapped Heart","Skull Flower","Scared Cat","Spy Agaric","Homemade Cake","Genie Lamp","Lunar Snake","Party Sparkler","Jester Hat","Witch Hat","Hanging Star","Love Candle","Cookie Heart","Desk Calendar","Jingle Bells","Snow Mittens","Voodoo Doll","Mad Pumpkin","Hypno Lollipop","B-Day Candle","Bunny Muffin","Astral Shard","Flying Broom","Crystal Ball","Eternal Candle","Swiss Watch","Ginger Cookie","Mini Oscar","Lol Pop","Ion Gem","Star Notepad","Loot Bag","Love Potion","Toy Bear","Diamond Ring","Sakura Flower","Sleigh Bell","Top Hat","Record Player","Winter Wreath","Snow Globe","Electric Skull","Tama Gadget","Candy Cane","Neko Helmet","Jack-in-the-Box","Easter Egg","Bonded Ring","Pet Snake","Snake Box","Xmas Stocking","Big Year","Holiday Drink","Gem Signet","Light Sword","Restless Jar","Nail Bracelet","Heroic Helmet","Bow Tie","Heart Locket","Lush Bouquet","Whip Cupcake","Joyful Bundle","Cupid Charm","Valentine Box","Snoop Dogg","Swag Bag","Snoop Cigar","Low Rider","Westside Sign","Stellar Rocket","Jolly Chimp","Moon Pendant","Ionic Dryer","Input Key","Mighty Arm","Artisan Brick","Clover Pin","Sky Stilettos","Fresh Socks","Happy Brownie","Ice Cream","Spring Basket","Instant Ramen","Faith Amulet","Mousse Cake","Bling Binky","Money Pot","Pretty Posy","Khabib's Papakha","UFC Strike"
  ];

  const normalize = value => String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/s$/, "");

  try {
    const known = new Map(giftNames.map(name => [normalize(name), name]));
    const collections = [];
    // Scan a few pages of on-chain collections; cache prevents repeated scans.
    for (const offset of [0, 100, 200]) {
      const page = await tonapi(`/v2/nfts/collections?limit=100&offset=${offset}`);
      collections.push(...(page.nft_collections || []));
    }

    const matched = collections
      .map(collection => {
        const metadata = collection.metadata || {};
        const rawName = metadata.name || collection.name || "";
        const giftName = known.get(normalize(rawName));
        return giftName ? { collection, giftName, rawName } : null;
      })
      .filter(Boolean)
      .slice(0, 20);

    const items = [];
    for (const match of matched) {
      const address = match.collection.address;
      if (!address) continue;
      const page = await tonapi(
        `/v2/nfts/collections/${encodeURIComponent(address)}/items?limit=15&offset=0`
      );

      for (const nft of page.nft_items || []) {
        if (nft.trust === "blacklist") continue;
        const metadata = nft.metadata || {};
        const previews = nft.previews || [];
        const preview = previews.find(p => p.resolution === "500x500")
          || previews.find(p => p.resolution === "1500x1500")
          || previews[0];

        items.push({
          address: nft.address,
          name: metadata.name || match.giftName,
          image: preview?.url || metadata.image || "",
          collection: match.giftName,
          collectionAddress: address,
          owner: nft.owner?.address || "",
          verified: Boolean(nft.verified),
          trust: nft.trust || "unknown",
          attributes: Array.isArray(metadata.attributes) ? metadata.attributes : [],
          sale: nft.sale || null,
          index: nft.index ?? null
        });
      }
    }

    const response = Response.json(
      {
        ok: true,
        source: "TONAPI",
        scannedCollections: collections.length,
        matchedCollections: matched.length,
        total: items.length,
        nft_items: items
      },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=600" } }
    );
    await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    return Response.json(
      { ok: false, error: error.message },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
