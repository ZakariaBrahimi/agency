// Calls to the existing Vercel functions (site/api). Errors carry the server's code (e.g. "bad_code").
export class ApiError extends Error {
  code: string; status: number; msg: string;
  constructor(code: string, status = 0, msg = "") { super(code); this.code = code; this.status = status; this.msg = msg; }
}

export async function request(url: string, { method = "GET", body }: { method?: string; body?: any } = {}) {
  const r = await fetch(url, {
    method, credentials: "same-origin",
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && !url.includes("action=me") && !url.includes("otp-")) window.dispatchEvent(new Event("nawa:signed-out"));
  if (!r.ok || d.ok === false) throw new ApiError(d.error || "error", r.status, d.message || "");
  return d;
}

/** The portal API: GET without a body, POST with one. */
export const portal = (action: string, body?: any) =>
  request(`/api/portal?action=${action}`, body !== undefined ? { method: "POST", body } : {});
