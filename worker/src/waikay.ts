export const BASE_URL = "https://app.waikay.io";

export interface WaikayResult {
  ok: boolean;
  status: number;
  body: unknown;
}

/** Call the Waikay API on behalf of one user. Mirrors the auth behaviour of the Python package. */
export async function waikay(
  apiKey: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  params: Record<string, string | number>,
  body?: unknown,
): Promise<WaikayResult> {
  const url = new URL(path, BASE_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set("key", apiKey);

  const headers: Record<string, string> = {};
  if (method !== "GET") headers["X-API-Key"] = apiKey;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const resp = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await resp.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* keep raw text */
  }
  return { ok: resp.ok, status: resp.status, body: parsed };
}
