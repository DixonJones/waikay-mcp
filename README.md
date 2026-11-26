# waikay-mcp

An MCP (Model Context Protocol) server for the [Waikay](https://waikay.io) brand visibility API. Gives Claude and other MCP-compatible AI assistants full interactive access to your Waikay account — query brand visibility across AI models, manage tracked prompts, and analyse citations, all in conversation.

Built by [Dixon Jones](https://github.com/DixonJones).

---

## What you can do

- *"List my Waikay projects"*
- *"How many times was Dixon Jones mentioned by ChatGPT this week?"*
- *"Show me the share of voice for dixonjones.com vs competitors"*
- *"Which URLs are being cited for my brand in Gemini?"*
- *"Create a new prompt tracking 'best SEO consultants' across ChatGPT and Claude, running daily"*
- *"Pause the prompt about entity-based SEO"*
- *"Add Copilot scraped to all my active prompts"*

---

## Two ways to use it

| | Hosted | Local |
|---|---|---|
| Install anything | No | Yes (Python) |
| Works in | Claude, ChatGPT and any client that supports remote MCP servers | Claude Desktop, Claude Code and other local MCP clients |
| Your API key | Pasted once on a sign-in page | Stored in your own config file |

Both need a Waikay account on **Level 2 or above** ($69.95/month) and your Waikay API key (from [account settings](https://app.waikay.io)). Both offer the same nine tools, described below.

---

## Hosted version

The hosted server runs at:

```
https://mcp.waikay.io/mcp
```

### Connecting

1. In your AI assistant, add a custom connector (remote MCP server) and enter the URL above. In Claude this is under Customize, then Connectors, then Add custom connector.
2. When the Waikay page opens, paste your Waikay API key and click **Allow**. The key is checked against the Waikay API before the connection is made.
3. Ask for something, for example *"List my Waikay projects"*.

There is nothing to install and no config file to edit.

### How your key is handled

- Your key is stored encrypted and is only used to call the Waikay API on your behalf.
- Stored keys are deleted automatically after 90 days without use, and one year after you connect at most. After that the assistant asks you to reconnect and you paste the key again.
- The service keeps no request logs.
- To disconnect, remove the connector in your assistant. To make a stored key useless straight away, regenerate it in your Waikay dashboard.
- Questions or deletion requests: contact@waikay.io.

### How it works

The hosted server is a Cloudflare Worker, in [`worker/`](worker/). It uses OAuth 2.1 with PKCE and dynamic client registration, so each user connects with their own key and never shares one. It speaks stateless streamable HTTP and calls the same Waikay API as the local version. To run it locally for development:

```bash
cd worker
npm install
npx wrangler dev --local
```

This needs Node 22.12 or newer. Deploying needs a Cloudflare account and a KV namespace bound as `OAUTH_KV` in `worker/wrangler.jsonc`.

---

## Local version

### Requirements

- Python 3.10+
- Your Waikay API key

### Installation

```bash
pip install waikay-mcp
```

### Configuration

#### Claude Desktop app

Add to `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac):

```json
{
  "mcpServers": {
    "waikay": {
      "command": "python",
      "args": ["-m", "waikay_mcp"],
      "env": {
        "WAIKAY_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

#### Claude Code (CLI)

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "waikay": {
      "command": "python",
      "args": ["-m", "waikay_mcp"],
      "env": {
        "WAIKAY_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

After editing the config, **fully quit and relaunch** the app — MCP servers load at startup.

---

## Available tools

### `list_projects`
Returns all projects in your Waikay account with their IDs and URLs.

```
list_projects()
```

---

### `get_overview`
Brand mention counts by AI model over the current and previous 7-day window, with a delta.

```
get_overview(project_id, prompt_id?)
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | int | Yes | From `list_projects` |
| `prompt_id` | int | No | Omit for project-wide totals; supply for a single prompt |

---

### `get_rankings`
Share of voice and competitive positioning over a 30-day rolling window.

```
get_rankings(project_id, prompt_id?)
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | int | Yes | From `list_projects` |
| `prompt_id` | int | No | Omit for project-wide; supply for a single prompt |

---

### `get_sources`
Citation and URL analysis — which domains and pages AI models reference when mentioning your brand.

```
get_sources(project_id, prompt_id?)
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | int | Yes | From `list_projects` |
| `prompt_id` | int | No | Omit for project-wide; supply for a single prompt |

---

### `get_scores`
AI knowledge scores by model and date over a 365-day window. Project level only.

```
get_scores(project_id)
```

---

### `list_prompts`
List all tracked prompts for a project, with their models, frequency, and active status.

```
list_prompts(project_id, include_inactive?, include_deleted?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `project_id` | int | — | From `list_projects` |
| `include_inactive` | bool | `true` | Include paused prompts |
| `include_deleted` | bool | `false` | Include deleted prompts |

---

### `create_prompt`
Create a new tracked prompt for a project.

```
create_prompt(project_id, prompt_string, models, frequency, audience?)
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | int | Yes | From `list_projects` |
| `prompt_string` | str | Yes | Max 500 characters; cannot be changed after creation |
| `models` | list[int] | Yes | Model IDs to track — see table below |
| `frequency` | int | Yes | `1`=daily, `2`=twice weekly, `7`=weekly |
| `audience` | int | No | Audience identifier (default `0`) |

Returns the new `prompt_id`, or a 402 error if your account has insufficient credits.

---

### `update_prompt`
Update an existing prompt. The `prompt_string` cannot be changed after creation.

```
update_prompt(project_id, prompt_id, models?, frequency?, audience?, active?)
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | int | Yes | From `list_projects` |
| `prompt_id` | int | Yes | From `list_prompts` |
| `models` | list[int] | No | Replace the tracked model list |
| `frequency` | int | No | `1`=daily, `2`=twice weekly, `7`=weekly |
| `audience` | int | No | Update audience identifier |
| `active` | int | No | `1`=running, `0`=paused, `2`=deleted |

---

### `delete_prompt`
Soft-delete a tracked prompt. Idempotent.

```
delete_prompt(project_id, prompt_id)
```

---

## Model IDs

| ID | Model |
|----|-------|
| `1` | Sonar (Perplexity) API |
| `3` | ChatGPT API |
| `5` | Claude API |
| `100` | Gemini API |
| `101` | AI Mode — scraped |
| `102` | ChatGPT — scraped |
| `103` | Gemini — scraped |
| `104` | Copilot — scraped |

---

## License

GPL-3.0
