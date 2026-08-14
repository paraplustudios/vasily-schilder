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

function pageShell(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Site settings</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #f5f5f5;
    margin: 0;
    padding: 20px;
    color: #1a1a1a;
  }
  .card {
    background: #fff;
    padding: 24px;
    border-radius: 14px;
    box-shadow: 0 2px 16px rgba(0,0,0,0.06);
    width: 100%;
    max-width: 560px;
    margin: 20px auto;
  }
  h1 { font-size: 20px; margin: 0 0 6px; }
  .back { display: inline-block; margin-bottom: 14px; font-size: 13px; color: #777; text-decoration: none; }
  input[type=password] {
    width: 100%; padding: 14px; margin-bottom: 14px;
    border: 1px solid #ddd; border-radius: 10px; font-size: 16px;
  }
  button.primary {
    width: 100%; padding: 14px; border: none; border-radius: 10px;
    background: #1a1a1a; color: #fff; font-size: 16px; cursor: pointer;
  }
  button.primary:disabled { opacity: 0.5; }
  .msg { margin-top: 12px; font-size: 13px; }
  .msg.error { color: #c0392b; }
  .msg.success { color: #27ae60; }

  .section { margin-top: 22px; }
  .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #555; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
  .field { margin-bottom: 10px; }
  .field label { display: block; font-size: 12px; color: #777; margin-bottom: 4px; }
  .field input, .field textarea {
    width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 8px;
    font-size: 14px; font-family: inherit; box-sizing: border-box;
  }
  .field textarea { resize: vertical; min-height: 60px; }
  .lang-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .lang-row .field label span { color: #aaa; font-weight: 600; }
  .service-block { border: 1px solid #eee; border-radius: 10px; padding: 12px; margin-bottom: 10px; }
  .service-block .service-title { font-size: 12px; font-weight: 700; color: #444; margin-bottom: 8px; }
  .save-bar { position: sticky; bottom: 0; background: #fff; padding-top: 14px; margin-top: 20px; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

const FIELD_DEFS = [
  { section: 'Contact info', fields: [
    { id: 'name', label: 'Business name', type: 'text' },
    { id: 'area', label: 'Area (e.g. Hilversum)', type: 'text' },
    { id: 'phone', label: 'Phone', type: 'text' },
    { id: 'email', label: 'Email', type: 'text' },
    { id: 'address', label: 'Address', type: 'text' },
    { id: 'kvk', label: 'KvK number', type: 'text' },
  ]},
];

export async function onRequestGet(context) {
  const { request, env } = context;
  const authed = await isAuthenticated(request, env);

  if (!authed) {
    return new Response(
      pageShell(`
      <div class="card">
        <h1>Login</h1>
        <form method="POST" action="/upload/settings">
          <input type="password" name="password" placeholder="Password" required autofocus>
          <button class="primary" type="submit">Login</button>
        </form>
      </div>
    `),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  const contactFieldsHtml = FIELD_DEFS[0].fields.map(
    (f) => `<div class="field"><label>${f.label}</label><input type="text" id="f_${f.id}"></div>`
  ).join('');

  return new Response(
    pageShell(`
    <div class="card">
      <a href="/upload" class="back">&larr; Photos</a>
      <h1>Site settings</h1>
      <div id="loading" style="font-size:13px;color:#999">Loading...</div>
      <div id="formWrap" style="display:none">

        <div class="section">
          <div class="section-title">Contact info</div>
          ${contactFieldsHtml}
        </div>

        <div class="section">
          <div class="section-title">Hero (top of homepage)</div>
          <div class="lang-row">
            <div class="field"><label><span>NL</span> Title</label><textarea id="f_heroTitleNl"></textarea></div>
            <div class="field"><label><span>EN</span> Title</label><textarea id="f_heroTitleEn"></textarea></div>
          </div>
          <div class="lang-row">
            <div class="field"><label><span>NL</span> Description</label><textarea id="f_heroDescNl"></textarea></div>
            <div class="field"><label><span>EN</span> Description</label><textarea id="f_heroDescEn"></textarea></div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">About me text</div>
          <div class="lang-row">
            <div class="field"><label><span>NL</span> Bio</label><textarea id="f_bioNl" style="min-height:100px"></textarea></div>
            <div class="field"><label><span>EN</span> Bio</label><textarea id="f_bioEn" style="min-height:100px"></textarea></div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Services (4)</div>
          <div id="servicesWrap"></div>
        </div>

        <div class="save-bar">
          <button class="primary" id="saveBtn">Save changes</button>
          <div class="msg" id="msg"></div>
        </div>
      </div>
    </div>

    <script>
      let current = null;

      const DEFAULTS = {
        name: 'Naam Schilder',
        area: 'Hilversum',
        phone: '+31 6 00 000 000',
        email: 'info@example.nl',
        address: 'Hilversum, Noord-Holland',
        kvk: '00000000',
        heroTitleNl: 'Uw woning<br>in <em>goede</em><br>handen.',
        heroTitleEn: 'Your home<br>in <em>good</em><br>hands.',
        heroDescNl: 'Vakkundig schilderwerk voor binnen en buiten. Nauwkeurig, netjes en met volle toewijding aan elk project.',
        heroDescEn: 'Expert painting for interiors and exteriors. Precise, neat and fully dedicated to every project.',
        bioNl: 'Ik ben [Naam], een zelfstandig schilder gevestigd in Hilversum. Al meer dan tien jaar breng ik woningen en panden tot leven met vakkundig schilderwerk.<br><br>Van kozijnen en gevels tot muren en plafonds — elk project krijgt dezelfde zorg en vakmanschap.',
        bioEn: 'I am [Name], an independent painter based in Hilversum. For over ten years I have been bringing homes to life with skilled paintwork.<br><br>From frames and facades to walls and ceilings — every project gets the same care and craftsmanship.',
        services: [
          { titleNl: 'Buitenschilderwerk', titleEn: 'Exterior Painting', descNl: 'Kozijnen, gevels, deuren en hekken', descEn: 'Frames, facades, doors and fences' },
          { titleNl: 'Binnenschilderwerk', titleEn: 'Interior Painting', descNl: 'Muren, plafonds en houtwerk', descEn: 'Walls, ceilings and woodwork' },
          { titleNl: 'Lakken & afwerking', titleEn: 'Lacquering', descNl: 'Hoge glans, mat of zijdemat', descEn: 'High gloss, matte or satin' },
          { titleNl: 'Kleuradvies', titleEn: 'Color Advice', descNl: 'De perfecte kleur voor uw ruimte', descEn: 'The perfect color for your space' },
        ],
      };

      function serviceBlock(i, s) {
        s = s || { titleNl:'', titleEn:'', descNl:'', descEn:'' };
        return \`
          <div class="service-block">
            <div class="service-title">Service \${i + 1}</div>
            <div class="lang-row">
              <div class="field"><label><span>NL</span> Title</label><input type="text" id="svc_\${i}_titleNl" value="\${escapeAttr(s.titleNl)}"></div>
              <div class="field"><label><span>EN</span> Title</label><input type="text" id="svc_\${i}_titleEn" value="\${escapeAttr(s.titleEn)}"></div>
            </div>
            <div class="lang-row">
              <div class="field"><label><span>NL</span> Description</label><input type="text" id="svc_\${i}_descNl" value="\${escapeAttr(s.descNl)}"></div>
              <div class="field"><label><span>EN</span> Description</label><input type="text" id="svc_\${i}_descEn" value="\${escapeAttr(s.descEn)}"></div>
            </div>
          </div>
        \`;
      }
      function escapeAttr(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML.replace(/"/g, '&quot;');
      }

      async function load() {
        const res = await fetch('/api/settings');
        const data = await res.json();
        current = data.settings || DEFAULTS;

        ${FIELD_DEFS[0].fields.map((f) => `document.getElementById('f_${f.id}').value = current.${f.id} || '';`).join('\n        ')}
        document.getElementById('f_heroTitleNl').value = current.heroTitleNl || '';
        document.getElementById('f_heroTitleEn').value = current.heroTitleEn || '';
        document.getElementById('f_heroDescNl').value = current.heroDescNl || '';
        document.getElementById('f_heroDescEn').value = current.heroDescEn || '';
        document.getElementById('f_bioNl').value = current.bioNl || '';
        document.getElementById('f_bioEn').value = current.bioEn || '';

        const services = current.services || [];
        const wrap = document.getElementById('servicesWrap');
        wrap.innerHTML = '';
        for (let i = 0; i < 4; i++) {
          wrap.insertAdjacentHTML('beforeend', serviceBlock(i, services[i]));
        }

        document.getElementById('loading').style.display = 'none';
        document.getElementById('formWrap').style.display = 'block';
      }

      document.getElementById('saveBtn').addEventListener('click', async () => {
        const btn = document.getElementById('saveBtn');
        const msg = document.getElementById('msg');
        btn.disabled = true;
        msg.textContent = '';

        const payload = {};
        ${FIELD_DEFS[0].fields.map((f) => `payload.${f.id} = document.getElementById('f_${f.id}').value.trim();`).join('\n        ')}
        payload.heroTitleNl = document.getElementById('f_heroTitleNl').value;
        payload.heroTitleEn = document.getElementById('f_heroTitleEn').value;
        payload.heroDescNl = document.getElementById('f_heroDescNl').value.trim();
        payload.heroDescEn = document.getElementById('f_heroDescEn').value.trim();
        payload.bioNl = document.getElementById('f_bioNl').value.trim();
        payload.bioEn = document.getElementById('f_bioEn').value.trim();
        payload.services = [];
        for (let i = 0; i < 4; i++) {
          payload.services.push({
            titleNl: document.getElementById('svc_' + i + '_titleNl').value.trim(),
            titleEn: document.getElementById('svc_' + i + '_titleEn').value.trim(),
            descNl: document.getElementById('svc_' + i + '_descNl').value.trim(),
            descEn: document.getElementById('svc_' + i + '_descEn').value.trim(),
          });
        }

        try {
          const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (res.ok) {
            msg.textContent = 'Saved!';
            msg.className = 'msg success';
          } else {
            msg.textContent = 'Error: ' + (data.error || 'unknown');
            msg.className = 'msg error';
          }
        } catch (err) {
          msg.textContent = 'Error: ' + err.message;
          msg.className = 'msg error';
        }
        btn.disabled = false;
      });

      load();
    </script>
  `),
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const formData = await request.formData();
  const password = formData.get('password');

  if (password !== env.UPLOAD_PASSWORD) {
    return new Response(
      pageShell(`
      <div class="card">
        <h1>Login</h1>
        <form method="POST" action="/upload/settings">
          <input type="password" name="password" placeholder="Password" required autofocus>
          <button class="primary" type="submit">Login</button>
        </form>
        <div class="msg error">Wrong password</div>
      </div>
    `),
      { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  const cookieVal = await sha256(env.UPLOAD_PASSWORD);
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/upload/settings',
      'Set-Cookie': `${COOKIE_NAME}=${cookieVal}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}
