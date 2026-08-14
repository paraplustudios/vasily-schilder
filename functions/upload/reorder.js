const COOKIE_NAME = 'upload_auth';
const VALID_CATEGORIES = ['buiten', 'binnen', 'voor-na', 'portfolio'];

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

async function getOrder(bucket, category) {
  const obj = await bucket.get(`_order/${category}.json`);
  if (!obj) return [];
  try {
    return await obj.json();
  } catch {
    return [];
  }
}

async function saveOrder(bucket, category, order) {
  await bucket.put(`_order/${category}.json`, JSON.stringify(order), {
    httpMetadata: { contentType: 'application/json' },
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

  const { category, key, direction } = await request.json();
  if (!VALID_CATEGORIES.includes(category) || !key || (direction !== 'up' && direction !== 'down')) {
    return new Response(JSON.stringify({ error: 'Ongeldig verzoek' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const bucket = env.PHOTOS_BUCKET;
  const order = await getOrder(bucket, category);
  const index = order.indexOf(key);
  if (index === -1) {
    return new Response(JSON.stringify({ error: 'Niet gevonden in volgorde' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const swapWith = direction === 'up' ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= order.length) {
    return new Response(JSON.stringify({ ok: true })); // al aan het begin/einde
  }

  [order[index], order[swapWith]] = [order[swapWith], order[index]];
  await saveOrder(bucket, category, order);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
