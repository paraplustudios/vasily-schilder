const COOKIE_NAME = 'upload_auth';

async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

async function isAuthenticated(request, env) {
  const cookieVal = getCookie(request, COOKIE_NAME);
  if (!cookieVal) return false;
  const expected = await sha256(env.UPLOAD_PASSWORD);
  return cookieVal === expected;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!(await isAuthenticated(request, env))) {
    return new Response(JSON.stringify({ error: 'Niet ingelogd' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const list = await env.REVIEWS_KV.list({ prefix: 'contact:' });
  const contacts = [];
  for (const k of list.keys) {
    const val = await env.REVIEWS_KV.get(k.name);
    if (val) {
      try {
        contacts.push({ key: k.name, ...JSON.parse(val) });
      } catch {
        // corrupte entry overslaan
      }
    }
  }
  contacts.sort((a, b) => b.timestamp - a.timestamp);

  return new Response(JSON.stringify({ contacts }), {
    headers: { 'Content-Type': 'application/json' },
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

  // Verwijderen (alleen ingelogd)
  if (body.action === 'delete') {
    if (!(await isAuthenticated(request, env))) {
      return new Response(JSON.stringify({ error: 'Niet ingelogd' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (body.key) await env.REVIEWS_KV.delete(body.key);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Honeypot: bot doet alsof het gelukt is
  if (body.website) {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const name = String(body.name || '').trim().slice(0, 100);
  const email = String(body.email || '').trim().slice(0, 150);
  const phone = String(body.phone || '').trim().slice(0, 40);
  const message = String(body.message || '').trim().slice(0, 2000);

  if (!name || !email || !message) {
    return new Response(JSON.stringify({ error: 'Naam, e-mail en bericht zijn verplicht' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Simpele rate limit per IP: max 1 bericht per minuut
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateLimitKey = `ratelimit-contact:${ip}`;
  const lastSubmit = await env.REVIEWS_KV.get(rateLimitKey);
  if (lastSubmit) {
    return new Response(JSON.stringify({ error: 'Even geduld, probeer het over een minuut opnieuw' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const timestamp = Date.now();
  const key = `contact:${timestamp}-${Math.random().toString(36).slice(2, 7)}`;
  const contact = { name, email, phone, message, timestamp };

  await env.REVIEWS_KV.put(key, JSON.stringify(contact));
  await env.REVIEWS_KV.put(rateLimitKey, '1', { expirationTtl: 60 });

  // E-mailmelding sturen (mislukking hiervan mag de aanvraag niet blokkeren —
  // de aanvraag staat sowieso al veilig opgeslagen hierboven)
  if (env.RESEND_API_KEY && env.NOTIFY_EMAIL) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Website <onboarding@resend.dev>',
          to: [env.NOTIFY_EMAIL],
          reply_to: email,
          subject: `Nieuwe aanvraag van ${name}`,
          text: `Naam: ${name}\nE-mail: ${email}\nTelefoon: ${phone || '-'}\n\nBericht:\n${message}`,
        }),
      });
    } catch {
      // e-mail mislukt, aanvraag is al opgeslagen — geen actie nodig
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
