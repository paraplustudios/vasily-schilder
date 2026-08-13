export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubAuthUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
    githubAuthUrl.searchParams.set('scope', 'repo,user');
    githubAuthUrl.searchParams.set('redirect_uri', `${url.origin}/admin/auth`);
    return Response.redirect(githubAuthUrl.toString(), 302);
  }

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
    return new Response('Auth failed: ' + JSON.stringify(tokenData), { status: 400 });
  }

  const html = `<!DOCTYPE html>
<html>
<head><title>Authorizing...</title></head>
<body>
<script>
(function() {
  const token = ${JSON.stringify(token)};
  const provider = 'github';
  const message = 'authorization:' + provider + ':success:' + JSON.stringify({token: token, provider: provider});
  
  // Try postMessage to opener (popup flow)
  if (window.opener) {
    window.opener.postMessage(message, '*');
    window.close();
  } else {
    // Fallback: store in sessionStorage and redirect
    sessionStorage.setItem('netlify-cms-github-token', token);
    window.location.href = '/admin/#token=' + encodeURIComponent(token);
  }
})();
</script>
<p>Authorizing... please wait.</p>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
