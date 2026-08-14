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

  if (category === 'voor-na') {
    const listed = await bucket.list({ prefix: 'voor-na/' });
    const pairMap = {};
    for (const obj of listed.objects) {
      const m = obj.key.match(/^voor-na\/(.+)-(voor|na)\.jpg$/);
      if (!m) continue;
      const [, pid, type] = m;
      pairMap[pid] = pairMap[pid] || {};
      pairMap[pid][type] = `/photos/voor-na/${pid}-${type}.jpg`;
    }
    const validPairIds = Object.keys(pairMap).filter((pid) => pairMap[pid].voor && pairMap[pid].na);
    const orderedIds = order.filter((pid) => validPairIds.includes(pid));
    for (const pid of validPairIds) {
      if (!orderedIds.includes(pid)) orderedIds.push(pid);
    }
    const photos = orderedIds.map((pid) => ({
      pairId: pid,
      voorUrl: pairMap[pid].voor,
      naUrl: pairMap[pid].na,
    }));
    return new Response(JSON.stringify({ photos }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    });
  }

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
