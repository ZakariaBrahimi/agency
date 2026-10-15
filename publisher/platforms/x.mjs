// X (Twitter) post with image via API v2.
// Env: X_ACCESS_TOKEN: OAuth 2.0 *user* token with tweet.write, users.read, media.write.
// Note: X's free tier allows very few posts per month. Check your plan's limits.
import { api, loadImage, renderCaption } from '../lib.mjs';

export const name = 'x';
export const required = ['X_ACCESS_TOKEN'];
export const mentionFor = (p) => (p.x_handle ? `@${p.x_handle}` : p.name);

export const caption = (post, products) => renderCaption(post, name, products, mentionFor);

export async function publish(post, products) {
  const auth = { Authorization: `Bearer ${process.env.X_ACCESS_TOKEN}` };
  const img = await loadImage(post.image);

  const form = new FormData();
  form.append('media', new Blob([img.buf], { type: img.type }), img.name);
  form.append('media_category', 'tweet_image');
  const { body: media } = await api('https://api.x.com/2/media/upload', { method: 'POST', headers: auth, body: form });
  const mediaId = media.data?.id ?? media.media_id_string;

  if (post.alt) {
    await api('https://api.x.com/2/media/metadata', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: mediaId, metadata: { alt_text: { text: post.alt.slice(0, 1000) } } }),
    }).catch((e) => console.warn('  (alt text skipped)', e.message));
  }

  const text = caption(post, products);
  if ([...text].length > 280) throw new Error(`X caption is ${[...text].length} chars; add a shorter "captions.x"`);
  const { body } = await api('https://api.x.com/2/tweets', {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, media: { media_ids: [mediaId] } }),
  });
  return { id: body.data.id };
}
