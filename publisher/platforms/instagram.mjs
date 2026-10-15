// Instagram (Business/Creator account linked to the Facebook Page) via the Graph API.
// Env: IG_USER_ID, FB_PAGE_ACCESS_TOKEN, PUBLIC_ASSET_BASE_URL
// Instagram fetches the image from a PUBLIC URL; it cannot take an upload. PUBLIC_ASSET_BASE_URL
// must point at a public copy of this repo's files (e.g. GitHub Pages or a CDN).
import { api, renderCaption, sleep } from '../lib.mjs';

const V = process.env.META_GRAPH_VERSION || 'v23.0';
const G = `https://graph.facebook.com/${V}`;

export const name = 'instagram';
export const required = ['IG_USER_ID', 'FB_PAGE_ACCESS_TOKEN', 'PUBLIC_ASSET_BASE_URL'];
export const mentionFor = (p) => (p.instagram_username ? `@${p.instagram_username}` : p.name);

export const caption = (post, products) => renderCaption(post, name, products, mentionFor);

export async function publish(post, products) {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  const ig = process.env.IG_USER_ID;
  const image_url = process.env.PUBLIC_ASSET_BASE_URL.replace(/\/$/, '') + '/' + post.image;
  const params = new URLSearchParams({ image_url, caption: caption(post, products), access_token: token });
  if (post.alt) params.set('alt_text', post.alt);

  // Also photo-tag the product account on the image itself.
  const product = post.mention && products[post.mention];
  if (product?.instagram_username) {
    params.set('user_tags', JSON.stringify([{ username: product.instagram_username, x: 0.5, y: 0.85 }]));
  }

  const { body: container } = await api(`${G}/${ig}/media`, { method: 'POST', body: params });

  // Wait for Instagram to finish fetching/processing the image.
  for (let i = 0; i < 20; i++) {
    const { body } = await api(`${G}/${container.id}?fields=status_code&access_token=${token}`);
    if (body.status_code === 'FINISHED') break;
    if (body.status_code === 'ERROR') throw new Error(`Instagram could not process ${image_url}`);
    await sleep(3000);
  }

  const { body } = await api(`${G}/${ig}/media_publish`, {
    method: 'POST',
    body: new URLSearchParams({ creation_id: container.id, access_token: token }),
  });
  return { id: body.id };
}
