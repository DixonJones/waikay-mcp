import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { waikay } from "./waikay";

const MODELS =
  "1=Sonar, 3=ChatGPT, 5=Claude, 100=Gemini, 101=AI Mode (scraped), 102=ChatGPT (scraped), 103=Gemini (scraped), 104=Copilot (scraped)";

type Method = "GET" | "POST" | "PATCH" | "DELETE";
type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

function buildServer(apiKey: string): McpServer {
  const server = new McpServer({ name: "waikay", version: "0.1.0" });

  const run = async (
    method: Method,
    path: string,
    params: Record<string, string | number>,
    body?: unknown,
  ): Promise<ToolResult> => {
    try {
      const r = await waikay(apiKey, method, path, params, body);
      const text = typeof r.body === "string" ? r.body : JSON.stringify(r.body, null, 2);
      return r.ok
        ? { content: [{ type: "text", text }] }
        : { isError: true, content: [{ type: "text", text: `Waikay API returned ${r.status}: ${text}` }] };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: `Request to Waikay failed: ${String(e)}` }] };
    }
  };

  const readOnly = { readOnlyHint: true, openWorldHint: false } as const;
  const project_id = z.number().int().describe("Waikay project ID (from list_projects)");
  const prompt_id = z.number().int().optional().describe("Omit for project-level aggregation, or supply a prompt ID");

  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description: "List all Waikay tracked projects, returning project IDs and URLs.",
      inputSchema: {},
      annotations: readOnly,
    },
    () => run("GET", "/api/projects", {}),
  );

  const tracking = (name: string, title: string, source: string, description: string) =>
    server.registerTool(
      name,
      { title, description, inputSchema: { project_id, prompt_id }, annotations: readOnly },
      ({ project_id, prompt_id }) =>
        run("GET", "/api/track", {
          project: project_id,
          source,
          ...(prompt_id !== undefined ? { prompt: prompt_id } : {}),
        }),
    );

  tracking(
    "get_overview",
    "Brand mention overview",
    "overview",
    "Get brand mention counts by AI model (ChatGPT, Claude, Gemini, Sonar) over a 7-day window. Omit prompt_id for project-level aggregation, or supply it for a specific prompt.",
  );
  tracking(
    "get_rankings",
    "Share of voice rankings",
    "rankings",
    "Get share-of-voice and competitive positioning over a 30-day rolling window. Omit prompt_id for project-level aggregation, or supply it for a specific prompt.",
  );
  tracking(
    "get_sources",
    "Citation sources",
    "sources",
    "Get citation and URL analysis across AI models over a 30-day rolling window. Omit prompt_id for project-level aggregation, or supply it for a specific prompt.",
  );

  server.registerTool(
    "get_scores",
    {
      title: "AI knowledge scores",
      description: "Get AI knowledge scores by model and date over a 365-day window (project level only).",
      inputSchema: { project_id },
      annotations: readOnly,
    },
    ({ project_id }) => run("GET", "/api/track", { project: project_id, source: "scores" }),
  );

  server.registerTool(
    "list_prompts",
    {
      title: "List prompts",
      description:
        "List all tracked prompts for a project, including their models, frequency, and active status. include_inactive defaults to true. Set include_deleted to see deleted prompts.",
      inputSchema: {
        project_id,
        include_inactive: z.boolean().default(true),
        include_deleted: z.boolean().default(false),
      },
      annotations: readOnly,
    },
    ({ project_id, include_inactive, include_deleted }) =>
      run("GET", "/api/prompts", {
        project: project_id,
        include_inactive: include_inactive ? 1 : 0,
        include_deleted: include_deleted ? 1 : 0,
      }),
  );

  server.registerTool(
    "create_prompt",
    {
      title: "Create prompt",
      description: `Create a new tracked prompt for a project. This uses account credits and returns 402 if credits are insufficient. models: list of model IDs (${MODELS}). frequency: 1=daily, 2=twice weekly, 7=weekly. prompt_string: max 500 characters and cannot be changed after creation. Returns the new prompt_id.`,
      inputSchema: {
        project_id,
        prompt_string: z.string().min(1).max(500),
        models: z.array(z.number().int()).min(1).describe(`Model IDs: ${MODELS}`),
        frequency: z.number().int().describe("1=daily, 2=twice weekly, 7=weekly"),
        audience: z.number().int().default(0).describe("Audience identifier integer (default 0)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    ({ project_id, prompt_string, models, frequency, audience }) =>
      run("POST", "/api/prompts", { project: project_id }, { prompt_string, models, frequency, audience }),
  );

  server.registerTool(
    "update_prompt",
    {
      title: "Update prompt",
      description:
        "Update an existing prompt. The prompt_string cannot be changed after creation. Only supply the fields you want to update. frequency: 1=daily, 2=twice weekly, 7=weekly. active: 1=running, 0=paused, 2=deleted.",
      inputSchema: {
        project_id,
        prompt_id: z.number().int(),
        models: z.array(z.number().int()).optional().describe(`Model IDs: ${MODELS}`),
        frequency: z.number().int().optional(),
        audience: z.number().int().optional(),
        active: z.number().int().optional().describe("1=running, 0=paused, 2=deleted"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    ({ project_id, prompt_id, models, frequency, audience, active }) => {
      const body: Record<string, unknown> = {};
      if (models !== undefined) body.models = models;
      if (frequency !== undefined) body.frequency = frequency;
      if (audience !== undefined) body.audience = audience;
      if (active !== undefined) body.active = active;
      return run("PATCH", "/api/prompts", { project: project_id, prompt: prompt_id }, body);
    },
  );

  server.registerTool(
    "delete_prompt",
    {
      title: "Delete prompt",
      description: "Soft-delete a tracked prompt. This operation is idempotent.",
      inputSchema: { project_id, prompt_id: z.number().int() },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    ({ project_id, prompt_id }) => run("DELETE", "/api/prompts", { project: project_id, prompt: prompt_id }),
  );

  return server;
}

/** Stateless streamable-HTTP MCP endpoint: a fresh server per request, scoped to the caller's API key. */
export async function handleMcp(request: Request, apiKey: string): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await buildServer(apiKey).connect(transport);
  return transport.handleRequest(request);
}
