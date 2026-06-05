# waikay-mcp

An MCP (Model Context Protocol) server for the [Waikay](https://waikay.io) brand visibility API. Lets Claude and other MCP-compatible AI assistants query and manage your brand's visibility across ChatGPT, Claude, Gemini, and Sonar (Perplexity) — directly in conversation.

Built by [Dixon Jones](https://github.com/DixonJones).

---

## What you can do

Once installed, you can ask Claude things like:

- *"List my Waikay projects"*
- *"How many times was Dixon Jones mentioned by ChatGPT this week?"*
- *"Show me the share of voice for dixonjones.com vs competitors"*
- *"Which URLs are being cited for my brand in Gemini?"*
- *"Create a new prompt tracking 'best SEO consultants' across all models"*
- *"Pause the prompt about entity-based SEO"*

---

## Requirements

- Python 3.10+
- A Waikay account on **Level 2 or above** ($69.95/month)
- Your Waikay API key (from [account settings](https://app.waikay.io))

---

## Installation

```bash
pip install waikay-mcp
```

---

## Configuration

### Claude Desktop app

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

### Claude Code (CLI)

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

**Example response:**
```json
{
  "code": "200",
  "customer_id": 137,
  "projects": [
    { "project_id": 20273, "project_url": "dixonjones.com" },
    { "project_id": 22597, "project_url": "waikay.io" }
  ]
}
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

**Example response (per prompt):**
```json
{
  "prompt": "Suggest an SEO Speaker",
  "current_week": {
    "total": 3,
    "per_model": [
      { "name": "Gemini",  "count": 0 },
      { "name": "chatGPT", "count": 2 },
      { "name": "Sonar",   "count": 0 },
      { "name": "Claude",  "count": 1 }
    ]
  },
  "previous_week": { "total": 5 },
  "delta": -2
}
```

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
Citation and URL analysis — which domains and pages are being referenced by AI models when your brand is mentioned.

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

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | int | Yes | From `list_projects` |

---

### `list_prompts`
List all tracked prompts for a project, with their models, frequency, and active status.

```
list_prompts(project_id, include_inactive?, include_deleted?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `project_id` | int | — | From `list_projects` |
| `include_inactive` | bool | `false` | Include paused prompts |
| `include_deleted` | bool | `false` | Include deleted prompts |

**Example response:**
```json
{
  "count": 2,
  "prompts": [
    {
      "prompt_id": 689,
      "prompt_string": "I need a knowledgeable speaker to explain entity-based SEO at my company event",
      "models": [100, 3, 1, 5],
      "frequency": 2,
      "active": 1,
      "created_at": "2025-08-12 12:26:46"
    }
  ]
}
```

---

### `create_prompt`
Create a new tracked prompt.

```
create_prompt(project_id, prompt_string, models, frequency, audience?)
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | int | Yes | From `list_projects` |
| `prompt_string` | str | Yes | The query to track (cannot be changed after creation) |
| `models` | list | Yes | AI models to track — see model IDs below |
| `frequency` | str | Yes | How often to run, e.g. `"daily"` or `"weekly"` |
| `audience` | str | No | Optional target audience description |

Returns the new `prompt_id`, or a 402 error if your account has insufficient credits.

**Model IDs:**

| ID | Model |
|----|-------|
| `1` | Sonar (Perplexity) |
| `3` | ChatGPT |
| `5` | Claude |
| `100` | Gemini |

---

### `update_prompt`
Update an existing prompt. The `prompt_string` itself cannot be changed after creation.

```
update_prompt(project_id, prompt_id, models?, frequency?, audience?, active?)
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | int | Yes | From `list_projects` |
| `prompt_id` | int | Yes | From `list_prompts` |
| `models` | list | No | Replace the tracked model list |
| `frequency` | str | No | Update run frequency |
| `audience` | str | No | Update audience description |
| `active` | bool | No | `false` to pause, `true` to resume |

---

### `delete_prompt`
Soft-delete a tracked prompt. This operation is idempotent.

```
delete_prompt(project_id, prompt_id)
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | int | Yes | From `list_projects` |
| `prompt_id` | int | Yes | From `list_prompts` |

---

## License

GPL-3.0
