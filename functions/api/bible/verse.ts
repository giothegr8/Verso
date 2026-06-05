export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  const { request, env } = context;
  
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, api-key"
      }
    });
  }

  const url = new URL(request.url);
  const verseId = url.searchParams.get("verseId");
  const bibleId = url.searchParams.get("bibleId") || env.DEFAULT_BIBLE_ID || "7142879509583d59-01";

  if (!verseId) {
    return new Response(JSON.stringify({ error: "Missing verseId parameter" }), {
      status: 400,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  const apiKey = env.API_BIBLE_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing API_BIBLE_KEY" }), {
      status: 400,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  const kv = (env as any).BIBLE_CACHE_KV;
  const cacheKey = `verse:${bibleId}:${verseId}`.toLowerCase();

  // Try fetching from KV Cache
  if (kv && typeof kv.get === "function") {
    try {
      const cachedString = await kv.get(cacheKey);
      if (cachedString) {
        const parsed = JSON.parse(cachedString);
        if (parsed && parsed.data) {
          const content = parsed.data.content || "";
          const textExcerpt = content.replace(/<[^>]*>/g, "").trim();
          
          if (textExcerpt && 
              !textExcerpt.toLowerCase().includes("verse text coming soon") && 
              !textExcerpt.toLowerCase().includes("coming soon")) {
            return new Response(JSON.stringify(parsed), {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "X-Cache": "HIT",
                "X-Cache-Store": "KV"
              }
            });
          }
        }
      }
    } catch (e) {
      console.error("KV read error:", e);
    }
  }

  const baseUrl = env.API_BIBLE_BASE_URL || "https://api.scripture.api.bible/v1";
  const fetchUrl = `${baseUrl}/bibles/${bibleId}/verses/${verseId}`;

  try {
    const apiResponse = await fetch(fetchUrl, {
      headers: {
        "api-key": apiKey,
        "Accept": "application/json"
      }
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      try {
        const errorJson = JSON.parse(errorText);
        return new Response(JSON.stringify(errorJson), {
          status: apiResponse.status,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "X-Cache": kv ? "MISS" : "BYPASS",
            "X-Cache-Store": "KV"
          }
        });
      } catch {
        return new Response(JSON.stringify({ 
          error: `API.Bible returned status ${apiResponse.status}`,
          details: errorText 
        }), {
          status: apiResponse.status,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "X-Cache": kv ? "MISS" : "BYPASS",
            "X-Cache-Store": "KV"
          }
        });
      }
    }

    const data = await apiResponse.json();

    // Cache successful and valid response
    if (data && data.data) {
      const content = data.data.content || "";
      const textExcerpt = content.replace(/<[^>]*>/g, "").trim();
      
      if (textExcerpt && 
          !textExcerpt.toLowerCase().includes("verse text coming soon") && 
          !textExcerpt.toLowerCase().includes("coming soon")) {
        if (kv && typeof kv.put === "function") {
          try {
            const dataToCache = {
              ...data,
              cachedAt: Date.now()
            };
            await kv.put(cacheKey, JSON.stringify(dataToCache), { expirationTtl: 2592000 });
          } catch (e) {
            console.error("KV write error:", e);
          }
        }
      }
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "X-Cache": kv ? "MISS" : "BYPASS",
        "X-Cache-Store": "KV"
      }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Failed to fetch from API.Bible" }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "X-Cache": kv ? "MISS" : "BYPASS",
        "X-Cache-Store": "KV"
      }
    });
  }
}
