// Facebook Page photo post via the Graph API.
// Env: FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN (long-lived Page token with pages_manage_posts)
import { api, loadImage, renderCaption } from '../lib.mjs';

const V = process.env.META_GRAPH_VERSION || 'v23.0';

export const name = 'facebook';
export const required = ['FB_PAGE_ID', 'FB_PAGE_ACCESS_TOKEN'];

// "@[page-id]" tags a Page in a Page post; fall back to the product name if no id is set.
export const mentionFor = (p) => (p.facebook_page_id ? `@[${p.facebook_page_id}]` : p.name);

export const caption = (post, products) => renderCaption(post, name, products, mentionFor);

export async function publish(post, products) {
  const img = await loadImage(post.image);
  const form = new FormData();
  form.append('source', new Blob([img.buf], { type: img.type }), img.name);
  form.append('message', caption(post, products));
  form.append('access_token', process.env.FB_PAGE_ACCESS_TOKEN);
  const { body } = await api(`https://graph.facebook.com/${V}/${process.env.FB_PAGE_ID}/photos`, { method: 'POST', body: form });
  return { id: body.post_id || body.id };
}
