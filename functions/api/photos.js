const VALID_CATEGORIES = ['buiten', 'binnen', 'voor-na', 'portfolio'];

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

  const listed = await bucket.list({ prefix: `${category}/` });
  const existingKeys = new Set(listed.objects.map((o) => o.key));

  const orderedKeys = order.filter((k) => existingKeys.has(k));
  for (const key of existingKeys) {
    if (!orderedKeys.includes(key)) orderedKeys.push(key);
  }

  const photos = orderedKeys.map((key) => ({ key, url: `/photos/${key}` }));

  return new Response(JSON.stringify({ photos }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
    },
  });
}
