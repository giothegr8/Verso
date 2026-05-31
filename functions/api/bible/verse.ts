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

  const baseUrl = env.API_BIBLE_BASE_URL || "https://api.scripture.api.bible/v1";
  const defaultBibleId = env.DEFAULT_BIBLE_ID || "7142879509583d59-01";
  const fetchUrl = `${baseUrl}/bibles/${defaultBibleId}/verses/${verseId}`;

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
            "Access-Control-Allow-Origin": "*"
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
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
    }

    const data = await apiResponse.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Failed to fetch from API.Bible" }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
