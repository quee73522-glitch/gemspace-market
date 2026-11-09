export async function onRequest(context) {
  const url = new URL(
    "https://toncenter.com/api/v3/nft/items"
  );

  url.searchParams.set("limit", "60");
  url.searchParams.set("offset", "0");

  try {
    const response = await fetch(url);
    return new Response(await response.text(), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60"
      }
    });
  } catch (error) {
    return Response.json({
      error: String(error)
    }, { status: 502 });
  }
}
