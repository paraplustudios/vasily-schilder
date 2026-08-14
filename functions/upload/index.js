const COOKIE_NAME = 'upload_auth';
const CATEGORIES = [
  { key: 'buiten', label: 'Buiten' },
  { key: 'binnen', label: 'Binnen' },
  { key: 'voor-na', label: 'Voor & Na' },
  { key: 'portfolio', label: 'Portfolio' },
];

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
<html lang="nl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Foto's beheren</title>
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
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
    max-width: 480px;
    margin: 20px auto;
  }
  h1 { font-size: 20px; margin: 0 0 20px; }
  input[type=password] {
    width: 100%;
    padding: 14px;
    margin-bottom: 14px;
    border: 1px solid #ddd;
    border-radius: 10px;
    font-size: 16px;
  }
  .tabs { display: flex; gap: 6px; margin-bottom: 18px; flex-wrap: wrap; }
  .tab {
    flex: 1 1 auto;
    padding: 10px 12px;
    border-radius: 8px;
    background: #f0f0f0;
    color: #555;
    font-size: 13px;
    font-weight: 600;
    text-align: center;
    cursor: pointer;
    border: none;
    white-space: nowrap;
  }
  .tab.active { background: #1a1a1a; color: #fff; }
  .dropzone {
    border: 2px dashed #ccc;
    border-radius: 10px;
    padding: 28px 16px;
    text-align: center;
    color: #888;
    margin-bottom: 14px;
    cursor: pointer;
    font-size: 14px;
  }
  .dropzone.dragover { border-color: #1a1a1a; color: #1a1a1a; background: #fafafa; }
  input[type=file] { display: none; }
  button.primary {
    width: 100%;
    padding: 14px;
    border: none;
    border-radius: 10px;
    background: #1a1a1a;
    color: #fff;
    font-size: 16px;
    cursor: pointer;
  }
  button.primary:disabled { opacity: 0.4; cursor: default; }
  .msg { margin-top: 12px; font-size: 13px; }
  .msg.error { color: #c0392b; }
  .msg.success { color: #27ae60; }
  .progress { font-size: 13px; color: #888; margin-top: 6px; min-height: 18px; }
  .picked-thumbs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 14px; }
  .picked-thumbs img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; }

  .gallery-title { font-size: 14px; font-weight: 600; margin: 24px 0 10px; color: #555; }
  .gallery { display: flex; flex-direction: column; gap: 8px; }
  .gallery-empty { font-size: 13px; color: #999; padding: 12px 0; }
  .gallery-item {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #fafafa;
    border-radius: 10px;
    padding: 8px;
  }
  .gallery-item img { width: 56px; height: 56px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
  .gallery-item .name { flex: 1; font-size: 12px; color: #777; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gallery-item .actions { display: flex; gap: 4px; flex-shrink: 0; }
  .icon-btn {
    width: 34px; height: 34px;
    border: none; border-radius: 8px;
    background: #eee; color: #333;
    font-size: 15px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }
  .icon-btn.danger { background: #fdeaea; color: #c0392b; }
  .icon-btn:disabled { opacity: 0.3; }
  .loading { text-align: center; padding: 20px; color: #999; font-size: 13px; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const authed = await isAuthenticated(request, env);

  if (!authed) {
    return new Response(
      pageShell(`
      <div class="card">
        <h1>Inloggen</h1>
        <form method="POST" action="/upload">
          <input type="password" name="password" placeholder="Wachtwoord" required autofocus>
          <button class="primary" type="submit">Inloggen</button>
        </form>
      </div>
    `),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  const tabsHtml = CATEGORIES.map(
    (c, i) => `<button class="tab${i === 0 ? ' active' : ''}" data-cat="${c.key}">${c.label}</button>`
  ).join('');

  return new Response(
    pageShell(`
    <div class="card">
      <h1 style="font-size:16px">Hoofdfoto's website</h1>
      <p style="font-size:12px;color:#888;margin-bottom:16px">Deze twee foto's staan altijd bovenaan de site — kies er zelf twee uit.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div>
          <div style="font-size:12px;font-weight:600;margin-bottom:6px">Buiten (bovenaan)</div>
          <img id="showcaseHero" src="/photos/showcase/hero.jpg?t=${Date.now()}" onerror="this.style.display='none'" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;margin-bottom:6px;display:block">
          <input type="file" id="heroInput" accept="image/*" style="display:none">
          <button class="primary" style="padding:10px;font-size:13px" onclick="document.getElementById('heroInput').click()">Wijzigen</button>
        </div>
        <div>
          <div style="font-size:12px;font-weight:600;margin-bottom:6px">Binnen (over mij)</div>
          <img id="showcaseAbout" src="/photos/showcase/about.jpg?t=${Date.now()}" onerror="this.style.display='none'" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;margin-bottom:6px;display:block">
          <input type="file" id="aboutInput" accept="image/*" style="display:none">
          <button class="primary" style="padding:10px;font-size:13px" onclick="document.getElementById('aboutInput').click()">Wijzigen</button>
        </div>
      </div>
      <div class="msg" id="showcaseMsg"></div>
    </div>

    <div class="card">
      <h1>Foto's beheren</h1>
      <a href="/upload/contacts" style="display:inline-block;font-size:12px;color:#777;margin:-12px 0 4px;text-decoration:none">→ Contactaanvragen bekijken</a>
      <a href="/upload/settings" style="display:inline-block;font-size:12px;color:#777;margin:0 0 18px;text-decoration:none">→ Site settings bewerken</a>
      <div class="tabs">${tabsHtml}</div>

      <div class="dropzone" id="dropzone">
        Klik hier of sleep foto's hierheen
        <input type="file" id="fileInput" accept="image/*" multiple>
      </div>
      <div class="picked-thumbs" id="pickedThumbs"></div>
      <button class="primary" id="uploadBtn" disabled>Uploaden</button>
      <div class="progress" id="progress"></div>
      <div class="msg" id="msg"></div>

      <div class="gallery-title" id="galleryTitle">Geüploade foto's</div>
      <div class="gallery" id="gallery"><div class="loading">Laden...</div></div>
    </div>

    <script>
      async function uploadShowcase(slot, file) {
        const showcaseMsg = document.getElementById('showcaseMsg');
        showcaseMsg.textContent = 'Uploaden...';
        showcaseMsg.className = 'msg';
        const fd = new FormData();
        fd.append('slot', slot);
        fd.append('photo', file);
        try {
          const res = await fetch('/upload/showcase', { method: 'POST', body: fd });
          const data = await res.json();
          if (res.ok) {
            document.getElementById(slot === 'hero' ? 'showcaseHero' : 'showcaseAbout').src = data.url;
            document.getElementById(slot === 'hero' ? 'showcaseHero' : 'showcaseAbout').style.display = 'block';
            showcaseMsg.textContent = 'Opgeslagen!';
            showcaseMsg.className = 'msg success';
          } else {
            showcaseMsg.textContent = 'Fout: ' + (data.error || 'onbekend');
            showcaseMsg.className = 'msg error';
          }
        } catch (err) {
          showcaseMsg.textContent = 'Fout: ' + err.message;
          showcaseMsg.className = 'msg error';
        }
      }
      document.getElementById('heroInput').addEventListener('change', (e) => {
        if (e.target.files[0]) uploadShowcase('hero', e.target.files[0]);
      });
      document.getElementById('aboutInput').addEventListener('change', (e) => {
        if (e.target.files[0]) uploadShowcase('about', e.target.files[0]);
      });
    </script>

    <script>
      const CATEGORIES = ${JSON.stringify(CATEGORIES)};
      let currentCategory = CATEGORIES[0].key;
      let selectedFiles = [];

      const dropzone = document.getElementById('dropzone');
      const fileInput = document.getElementById('fileInput');
      const uploadBtn = document.getElementById('uploadBtn');
      const msg = document.getElementById('msg');
      const progress = document.getElementById('progress');
      const pickedThumbs = document.getElementById('pickedThumbs');
      const gallery = document.getElementById('gallery');
      const galleryTitle = document.getElementById('galleryTitle');
      const tabs = document.querySelectorAll('.tab');

      tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
          tabs.forEach((t) => t.classList.remove('active'));
          tab.classList.add('active');
          currentCategory = tab.dataset.cat;
          resetPicker();
          loadGallery();
        });
      });

      dropzone.addEventListener('click', () => fileInput.click());
      dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
      });
      fileInput.addEventListener('change', () => handleFiles(fileInput.files));

      function resetPicker() {
        selectedFiles = [];
        pickedThumbs.innerHTML = '';
        uploadBtn.disabled = true;
        fileInput.value = '';
        msg.textContent = '';
      }

      function handleFiles(fileList) {
        selectedFiles = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
        uploadBtn.disabled = selectedFiles.length === 0;
        pickedThumbs.innerHTML = '';
        selectedFiles.forEach((f) => {
          const img = document.createElement('img');
          img.src = URL.createObjectURL(f);
          pickedThumbs.appendChild(img);
        });
        msg.textContent = '';
      }

      uploadBtn.addEventListener('click', async () => {
        if (!selectedFiles.length) return;
        uploadBtn.disabled = true;
        msg.textContent = '';
        msg.className = 'msg';

        const fd = new FormData();
        fd.append('category', currentCategory);
        selectedFiles.forEach((f) => fd.append('photos', f));

        progress.textContent = 'Uploaden...';
        try {
          const res = await fetch('/upload/save', { method: 'POST', body: fd });
          const data = await res.json();
          if (res.ok) {
            msg.textContent = data.count + " foto('s) succesvol geüpload!";
            msg.className = 'msg success';
            resetPicker();
            loadGallery();
          } else {
            msg.textContent = 'Fout: ' + (data.error || 'onbekende fout');
            msg.className = 'msg error';
          }
        } catch (err) {
          msg.textContent = 'Fout: ' + err.message;
          msg.className = 'msg error';
        }
        progress.textContent = '';
        uploadBtn.disabled = selectedFiles.length === 0;
      });

      async function loadGallery() {
        const catLabel = CATEGORIES.find((c) => c.key === currentCategory).label;
        galleryTitle.textContent = "Geüploade foto's — " + catLabel;
        gallery.innerHTML = '<div class="loading">Laden...</div>';
        try {
          const res = await fetch('/upload/list?category=' + encodeURIComponent(currentCategory));
          const data = await res.json();
          renderGallery(data.photos || []);
        } catch (err) {
          gallery.innerHTML = '<div class="gallery-empty">Kon foto\\'s niet laden.</div>';
        }
      }

      function renderGallery(photos) {
        if (!photos.length) {
          gallery.innerHTML = '<div class="gallery-empty">Nog geen foto\\'s in deze categorie.</div>';
          return;
        }
        gallery.innerHTML = '';
        photos.forEach((p, i) => {
          const row = document.createElement('div');
          row.className = 'gallery-item';
          row.innerHTML =
            '<img src="' + p.url + '" loading="lazy">' +
            '<div class="name">' + p.key.split('/').pop() + '</div>' +
            '<div class="actions">' +
            '<button class="icon-btn up" ' + (i === 0 ? 'disabled' : '') + '>↑</button>' +
            '<button class="icon-btn down" ' + (i === photos.length - 1 ? 'disabled' : '') + '>↓</button>' +
            '<button class="icon-btn danger del">✕</button>' +
            '</div>';
          row.querySelector('.up').addEventListener('click', () => reorder(p.key, 'up'));
          row.querySelector('.down').addEventListener('click', () => reorder(p.key, 'down'));
          row.querySelector('.del').addEventListener('click', () => deletePhoto(p.key));
          gallery.appendChild(row);
        });
      }

      async function reorder(key, direction) {
        await fetch('/upload/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: currentCategory, key, direction }),
        });
        loadGallery();
      }

      async function deletePhoto(key) {
        if (!confirm('Deze foto verwijderen?')) return;
        await fetch('/upload/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: currentCategory, key }),
        });
        loadGallery();
      }

      loadGallery();
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
        <h1>Inloggen</h1>
        <form method="POST" action="/upload">
          <input type="password" name="password" placeholder="Wachtwoord" required autofocus>
          <button class="primary" type="submit">Inloggen</button>
        </form>
        <div class="msg error">Onjuist wachtwoord</div>
      </div>
    `),
      { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  const cookieVal = await sha256(env.UPLOAD_PASSWORD);
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/upload',
      'Set-Cookie': `${COOKIE_NAME}=${cookieVal}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}
