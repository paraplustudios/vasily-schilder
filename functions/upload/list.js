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

export async function onRequestGet(context) {
  const { request, env } = context;

  const cookieVal = getCookie(request, COOKIE_NAME);
  const expected = await sha256(env.UPLOAD_PASSWORD);
  if (cookieVal !== expected) {
    return new Response(JSON.stringify({ error: 'Niet ingelogd' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  if (!VALID_CATEGORIES.includes(category)) {
    return new Response(JSON.stringify({ error: 'Ongeldige categorie' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const bucket = env.PHOTOS_BUCKET;
  const order = await getOrder(bucket, category);

  // Alle bestaande objecten in deze categorie ophalen (bron van waarheid)
  const listed = await bucket.list({ prefix: `${category}/` });
  const existingKeys = new Set(listed.objects.map((o) => o.key));

  // Volgorde toepassen, alleen bestaande bestanden behouden
  const orderedKeys = order.filter((k) => existingKeys.has(k));
  // Eventuele nieuwe bestanden die nog niet in de volgorde staan, achteraan toevoegen
  for (const key of existingKeys) {
    if (!orderedKeys.includes(key)) orderedKeys.push(key);
  }

  const photos = orderedKeys.map((key) => ({ key, url: `/photos/${key}` }));

  return new Response(JSON.stringify({ photos }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
