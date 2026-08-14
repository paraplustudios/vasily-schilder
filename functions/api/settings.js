const COOKIE_NAME = 'upload_auth';
const KEY = 'site-settings';

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

export async function onRequestGet(context) {
  const { env } = context;
  const val = await env.REVIEWS_KV.get(KEY);
  return new Response(JSON.stringify({ settings: val ? JSON.parse(val) : null }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=30',
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const cookieVal = getCookie(request, COOKIE_NAME);
  const expected = await sha256(env.UPLOAD_PASSWORD);
  if (cookieVal !== expected) {
    return new Response(JSON.stringify({ error: 'Niet ingelogd' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Ongeldig verzoek' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await env.REVIEWS_KV.put(KEY, JSON.stringify(data));

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
