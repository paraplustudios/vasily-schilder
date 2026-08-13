export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    // Redirect to GitHub OAuth
    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubAuthUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
    githubAuthUrl.searchParams.set('scope', 'repo');
    githubAuthUrl.searchParams.set('redirect_uri', `${url.origin}/admin/auth`);
    return Response.redirect(githubAuthUrl.toString(), 302);
  }

  // Exchange code for token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;

  if (!token) {
    return new Response('Auth failed', { status: 400 });
  }

  // Return token to CMS via postMessage
  const html = `<!DOCTYPE html>
<html>
<body>
<script>
  const token = ${JSON.stringify(token)};
  const message = JSON.stringify({
    token,
    provider: 'github'
  });
  window.opener && window.opener.postMessage('authorization:github:success:' + JSON.stringify({token, provider:'github'}), '*');
  window.close();
</script>
<p>Authorizing...</p>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
