// GET /api/admin/google/callback: Google sends people back here after sign-in.
// - the owner connecting Nawa's Drive and Calendar (purpose 'admin', back to /admin)
// - a client signing in to /portal with Google (purpose 'client', matched on the verified email)
// The admin cookie is SameSite=Strict, so it isn't sent on this cross-site redirect; the signed
// state (matched to a cookie set when sign-in started) proves the request came from this browser.
import { checkState, clearState, exchangeCode, exchangeLogin, saveConnection } from '../../_lib/google.js';
import { findUserByEmail, getClient, signedIn } from '../../_lib/clients.js';

function back(res, location) {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  const code = url.searchParams.get('code');
  const state = checkState(req, url.searchParams.get('state'));
  clearState(res);
  if (state?.p === 'client') {
    if (url.searchParams.get('error') || !code) return back(res, '/portal#google-denied');
    try {
      const email = await exchangeLogin(code);
      const user = email && await findUserByEmail(email);
      const client = user && await getClient(user.client_id);
      if (!user || !client?.active) return back(res, '/portal#google-unknown');
      await signedIn(res, user);
      return back(res, '/portal');
    } catch (e) {
      console.error('client login', e.message);
      return back(res, '/portal#google-failed');
    }
  }
  if (url.searchParams.get('error')) return back(res, '/admin#content/google-denied');
  if (!code || !state) return back(res, '/admin#content/google-failed');
  try {
    const t = await exchangeCode(code);
    saveConnection(res, { refresh: t.refresh, email: t.email });
    return back(res, '/admin#content/google-connected');
  } catch (e) {
    console.error(e.message);
    return back(res, '/admin#content/google-failed');
  }
}
