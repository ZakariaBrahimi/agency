// GET /api/admin/google/callback: Google sends the owner back here after sign-in.
// The admin cookie is SameSite=Strict, so it isn't sent on this cross-site redirect; the signed
// state (matched to a cookie set when sign-in started) proves the request came from this browser.
import { checkState, clearState, exchangeCode, saveConnection } from '../../_lib/google.js';

function back(res, hash) {
  res.statusCode = 302;
  res.setHeader('Location', `/admin#${hash}`);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  clearState(res);
  if (url.searchParams.get('error')) return back(res, 'content/google-denied');
  if (!code || !checkState(req, state)) return back(res, 'content/google-failed');
  try {
    const t = await exchangeCode(code);
    saveConnection(res, { refresh: t.refresh, email: t.email });
    return back(res, 'content/google-connected');
  } catch (e) {
    console.error(e.message);
    return back(res, 'content/google-failed');
  }
}
