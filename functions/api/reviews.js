export async function onRequestGet(context) {
  const { env } = context;
  const list = await env.REVIEWS_KV.list({ prefix: 'review:' });

  const reviews = [];
  for (const k of list.keys) {
    const val = await env.REVIEWS_KV.get(k.name);
    if (val) {
      try {
        reviews.push(JSON.parse(val));
      } catch {
        // corrupte entry overslaan
      }
    }
  }

  reviews.sort((a, b) => b.timestamp - a.timestamp);

  return new Response(JSON.stringify({ reviews }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=30',
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Ongeldig verzoek' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Honeypot: als dit veld is ingevuld, is het een bot.
  // We doen alsof het gelukt is, zodat de bot niets doorheeft.
  if (body.website) {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const name = String(body.name || '').trim().slice(0, 100);
  const text = String(body.review || '').trim().slice(0, 1000);
  const rating = Math.min(5, Math.max(1, parseInt(body.rating) || 5));

  if (!name || !text) {
    return new Response(JSON.stringify({ error: 'Naam en tekst zijn verplicht' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Simpele rate limit per IP: max 1 recensie per minuut
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateLimitKey = `ratelimit:${ip}`;
  const lastSubmit = await env.REVIEWS_KV.get(rateLimitKey);
  if (lastSubmit) {
    return new Response(JSON.stringify({ error: 'Even geduld, probeer het over een minuut opnieuw' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const timestamp = Date.now();
  const key = `review:${timestamp}-${Math.random().toString(36).slice(2, 7)}`;
  const review = { name, text, rating, timestamp };

  await env.REVIEWS_KV.put(key, JSON.stringify(review));
  await env.REVIEWS_KV.put(rateLimitKey, '1', { expirationTtl: 60 });

  return new Response(JSON.stringify({ ok: true, review }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
