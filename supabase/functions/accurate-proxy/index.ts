// Optional CORS relay for Accurate Online API calls.
// Deploy: supabase functions deploy accurate-proxy
// Then set VITE_ACCURATE_PROXY_URL to the function URL.
// The browser client (src/api/functions/accurateClient.js) routes through
// this proxy automatically when the env var is set.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-session-id, content-type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
    });
  }
  const target = new URL(req.url).searchParams.get('url');
  if (!target || !/^https:\/\/([a-z0-9-]+\.)?accurate\.id\//.test(target)) {
    return Response.json({ error: 'Invalid url' }, { status: 400 });
  }
  const headers = new Headers();
  for (const h of ['authorization', 'x-session-id', 'content-type']) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  const init = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.text();
  }
  const upstream = await fetch(target, init);
  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
});
