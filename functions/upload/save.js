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

function sanitizeFilename(name) {
  return name.toLowerCase().replace(/[^a-z0-9.\-]/g, '-').replace(/-+/g, '-');
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

  const formData = await request.formData();
  const category = formData.get('category');
  if (!VALID_CATEGORIES.includes(category)) {
    return new Response(JSON.stringify({ error: 'Ongeldige categorie' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const files = formData.getAll('photos');
  if (!files.length) {
    return new Response(JSON.stringify({ error: 'Geen bestanden ontvangen' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const bucket = env.PHOTOS_BUCKET;
  const order = await getOrder(bucket, category);
  let count = 0;
  const errors = [];

  for (const file of files) {
    try {
      const safeName = sanitizeFilename(file.name);
      const key = `${category}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safeName}`;
      await bucket.put(key, file.stream(), {
        httpMetadata: { contentType: file.type || 'image/jpeg' },
      });
      order.push(key);
      count++;
    } catch (err) {
      errors.push(`${file.name}: ${err.message}`);
    }
  }

  if (count > 0) {
    await saveOrder(bucket, category, order);
  }

  if (count === 0) {
    return new Response(JSON.stringify({ error: errors.join('; ') || 'Upload mislukt' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ count, errors }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
