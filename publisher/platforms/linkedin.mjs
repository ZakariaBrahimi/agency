// LinkedIn Company Page post via the versioned REST API (Images API + Posts API).
// Env: LINKEDIN_ACCESS_TOKEN (w_organization_social), LINKEDIN_ORG_ID
// Optional: LINKEDIN_VERSION (YYYYMM). Defaults to two months ago, because LinkedIn retires versions after ~1 year.
import { api, loadImage, renderCaption } from '../lib.mjs';

export const name = 'linkedin';
export const required = ['LINKEDIN_ACCESS_TOKEN', 'LINKEDIN_ORG_ID'];

// LinkedIn "little text": reserved characters must be backslash-escaped, except in a mention token.
const escape = (s) => s.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => '\\' + c);
const MENTION = '\u0000MENTION\u0000';

/** Final commentary: caption escaped for little text, hashtags kept clickable, {{mention}} as an organization mention. */
export function caption(post, products) {
  const product = post.mention && products[post.mention];
  const tag = product?.linkedin_org_id
    ? `@[${escape(product.name)}](urn:li:organization:${product.linkedin_org_id})`
    : escape(product?.name ?? '');
  return escape(renderCaption(post, name, products, () => MENTION))
    .replace(/\\#(\w+)/g, '{hashtag|\\#|$1}')
    .replaceAll(MENTION, tag);
}

function version() {
  if (process.env.LINKEDIN_VERSION) return process.env.LINKEDIN_VERSION;
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - 2);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function publish(post, products) {
  const owner = `urn:li:organization:${process.env.LINKEDIN_ORG_ID}`;
  const headers = {
    Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
    'LinkedIn-Version': version(),
    'X-Restli-Protocol-Version': '2.0.0',
    'Content-Type': 'application/json',
  };

  // 1. Upload the image
  const { body: init } = await api('https://api.linkedin.com/rest/images?action=initializeUpload', {
    method: 'POST', headers, body: JSON.stringify({ initializeUploadRequest: { owner } }),
  });
  const img = await loadImage(post.image);
  const up = await fetch(init.value.uploadUrl, {
    method: 'PUT', headers: { Authorization: headers.Authorization, 'Content-Type': img.type }, body: img.buf,
  });
  if (!up.ok) throw new Error(`LinkedIn image upload failed: ${up.status} ${await up.text()}`);

  // 2. Create the post
  const { headers: h } = await api('https://api.linkedin.com/rest/posts', {
    method: 'POST', headers,
    body: JSON.stringify({
      author: owner,
      commentary: caption(post, products),
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { media: { id: init.value.image, altText: post.alt || '' } },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  });
  return { id: h.get('x-restli-id') };
}
