import OAuthProvider, { type OAuthHelpers, type ConsentDescription } from "@cloudflare/workers-oauth-provider";
import { handleMcp } from "./mcp";
import { waikay } from "./waikay";

interface Env {
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
}

interface Props extends Record<string, unknown> {
  apiKey: string;
}

const SCOPES = ["mcp:read", "mcp:write"];

const escapeHtml = (v: string) => v.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function page(details: ConsentDescription, handle: string, error?: string): string {
  const name = escapeHtml(details.clientName);
  const host = escapeHtml(details.redirectHost);
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect Waikay</title>
<style>
  body{font:16px/1.5 system-ui,sans-serif;max-width:30rem;margin:3rem auto;padding:0 1rem;color:#1a1a1a}
  input[type=password],input[type=text]{width:100%;padding:.6rem;font:inherit;box-sizing:border-box}
  button{padding:.6rem 1.2rem;font:inherit;cursor:pointer}
  .err{color:#b00020}.muted{color:#555;font-size:.9rem}
</style></head><body>
<h1>Connect Waikay</h1>
<p><strong>${name}</strong> wants to read and manage your Waikay projects and tracked prompts. Access will be sent to <strong>${host}</strong>.</p>
${details.redirectIsLoopback ? "<p><strong>This sends access to an app on your own computer.</strong> Continue only if you just started signing in from it.</p>" : ""}
${error ? `<p class="err">${escapeHtml(error)}</p>` : ""}
<form method="post">
  <input type="hidden" name="handle" value="${escapeHtml(handle)}">
  <p><label for="k">Your Waikay API key</label><br>
  <input id="k" name="api_key" type="password" autocomplete="off" required placeholder="wk_live_..."></p>
  <p class="muted">Find it in your Waikay dashboard under account settings. It is stored encrypted and only used to call Waikay for you.</p>
  <p><button name="decision" value="approve">Allow</button> <button name="decision" value="deny" formnovalidate>Deny</button></p>
</form>
</body></html>`;
}

function html(body: string, status = 200, extra?: Headers): Response {
  const headers = new Headers(extra);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Cache-Control", "no-store");
  return new Response(body, { status, headers });
}

async function authorize(req: Request, env: Env): Promise<Response> {
  const oauth = env.OAUTH_PROVIDER;

  if (req.method === "GET") {
    const authReq = await oauth.parseAuthRequest(req);
    const details = await oauth.describeConsent(authReq);
    const consent = await oauth.beginConsent(authReq);
    return html(page(details, consent.handle), 200, consent.headers);
  }

  const form = await req.formData();
  const handle = String(form.get("handle") ?? "");

  if (form.get("decision") !== "approve") {
    const denied = await oauth.denyConsent(req, handle);
    return new Response(null, { status: 302, headers: denied.headers });
  }

  const apiKey = String(form.get("api_key") ?? "").trim();
  const redisplay = async (message: string) => {
    // Handle is only consumed by approve/deny, so the same page can be shown again.
    const authReq = await oauth.parseAuthRequest(new Request(req.url));
    return html(page(await oauth.describeConsent(authReq), handle, message), 400);
  };

  if (!apiKey) return redisplay("Please paste your Waikay API key.");
  let valid = false;
  try {
    valid = (await waikay(apiKey, "GET", "/api/projects", {})).ok;
  } catch {
    return redisplay("Could not reach Waikay to check the key. Please try again.");
  }
  if (!valid) return redisplay("Waikay did not accept that API key. Check it and try again.");

  const approved = await oauth.approveConsent(req, handle, { scope: SCOPES });
  const { redirectTo } = await oauth.completeAuthorization({
    request: approved.request,
    userId: await keyId(apiKey),
    metadata: {},
    scope: SCOPES,
    props: { apiKey } satisfies Props,
  });
  approved.headers.set("Location", redirectTo);
  return new Response(null, { status: 302, headers: approved.headers });
}

/** Stable, non-reversible id so repeat sign-ins by the same key replace the earlier grant. */
async function keyId(apiKey: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(apiKey));
  return [...new Uint8Array(digest)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const apiHandler = {
  async fetch(request: Request, _env: Env, ctx: ExecutionContext & { props: Props }): Promise<Response> {
    return handleMcp(request, ctx.props.apiKey);
  },
};

const defaultHandler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/authorize") return authorize(request, env);
    if (pathname === "/" || pathname === "/health") {
      return new Response("Waikay MCP server. Connect at /mcp.", { headers: { "Content-Type": "text/plain" } });
    }
    return new Response("Not found", { status: 404 });
  },
};

export default new OAuthProvider<Env>({
  apiRoute: "/mcp",
  apiHandler: apiHandler as never,
  defaultHandler: defaultHandler as never,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/oauth/token",
  clientRegistrationEndpoint: "/oauth/register",
  scopesSupported: SCOPES,
  requiredScopes: ["mcp:read"],
  resourceMetadata: {
    resource: "https://mcp.waikay.io/mcp",
    authorization_servers: ["https://mcp.waikay.io"],
  },
  clientIdMetadataDocumentEnabled: true,
});
