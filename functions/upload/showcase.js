const COOKIE_NAME = 'upload_auth';
const VALID_SLOTS = ['hero', 'about'];

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

  const formData = await request.formData();
  const slot = formData.get('slot');
  const file = formData.get('photo');

  if (!VALID_SLOTS.includes(slot) || !file) {
    return new Response(JSON.stringify({ error: 'Ongeldig verzoek' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const key = `showcase/${slot}.jpg`;
  await env.PHOTOS_BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || 'image/jpeg' },
  });

  return new Response(JSON.stringify({ ok: true, url: `/photos/${key}?t=${Date.now()}` }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
