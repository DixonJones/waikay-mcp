# waikay-mcp

An MCP (Model Context Protocol) server for the [Waikay](https://waikay.io) brand visibility API. Built by [DixonJones](https://github.com/DixonJones). Lets Claude and other MCP-compatible AI assistants query your brand's visibility across ChatGPT, Claude, Gemini, and Sonar (Perplexity) directly in conversation.

## Requirements

- Python 3.10+
- A Waikay account on Level 2 or above ($69.95/month)
- Your Waikay API key (from account settings)

## Installation

```bash
pip install waikay-mcp
```

## Configuration

Add to your Claude Code `settings.json` (`~/.claude/settings.json`):

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

## Available Tools

| Tool | Description |
|------|-------------|
| `list_projects` | List all tracked projects with their IDs |
| `get_overview` | Brand mention counts by AI model — 7-day window |
| `get_rankings` | Share of voice and competitive positioning — 30-day window |
| `get_sources` | Citation and URL analysis across AI models — 30-day window |
| `get_scores` | AI knowledge scores by model and date — 365-day window |

All tools except `get_scores` accept an optional `prompt_id` to drill down to a specific prompt rather than project-level aggregates.

## Example usage

Once configured, ask Claude things like:

- *"List my Waikay projects"*
- *"What's my brand's share of voice on ChatGPT vs Claude this month?"*
- *"Which URLs are being cited for my brand in Gemini?"*
- *"Show me my AI knowledge scores over the past year"*

## License

MIT
