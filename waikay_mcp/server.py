#!/usr/bin/env python3
"""Waikay Brand Visibility MCP Server"""
import os
import httpx
from mcp.server.fastmcp import FastMCP

BASE_URL = "https://app.waikay.io"

mcp = FastMCP("waikay")


def _key() -> str:
    key = os.environ.get("WAIKAY_API_KEY", "")
    if not key:
        raise ValueError("WAIKAY_API_KEY environment variable is not set")
    return key


async def _request(method: str, path: str, params: dict, body: dict | None = None) -> dict:
    key = _key()
    params["key"] = key
    # Use header-based auth for write operations (recommended by Waikay for POST/PATCH/DELETE)
    headers = {"X-API-Key": key} if method != "GET" else {}
    async with httpx.AsyncClient() as client:
        resp = await client.request(
            method, f"{BASE_URL}{path}", params=params, json=body, headers=headers, timeout=30
        )
        resp.raise_for_status()
        return resp.json()


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

@mcp.tool()
async def list_projects() -> dict:
    """List all Waikay tracked projects, returning project IDs and URLs."""
    return await _request("GET", "/api/projects", {})


# ---------------------------------------------------------------------------
# Tracking / analytics
# ---------------------------------------------------------------------------

@mcp.tool()
async def get_overview(project_id: int, prompt_id: int | None = None) -> dict:
    """
    Get brand mention counts by AI model (ChatGPT, Claude, Gemini, Sonar) over a 7-day window.
    Omit prompt_id for project-level aggregation, or supply it for a specific prompt.
    """
    params: dict = {"project": project_id, "source": "overview"}
    if prompt_id is not None:
        params["prompt"] = prompt_id
    return await _request("GET", "/api/track", params)


@mcp.tool()
async def get_rankings(project_id: int, prompt_id: int | None = None) -> dict:
    """
    Get share-of-voice and competitive positioning over a 30-day rolling window.
    Omit prompt_id for project-level aggregation, or supply it for a specific prompt.
    """
    params: dict = {"project": project_id, "source": "rankings"}
    if prompt_id is not None:
        params["prompt"] = prompt_id
    return await _request("GET", "/api/track", params)


@mcp.tool()
async def get_sources(project_id: int, prompt_id: int | None = None) -> dict:
    """
    Get citation and URL analysis across AI models over a 30-day rolling window.
    Omit prompt_id for project-level aggregation, or supply it for a specific prompt.
    """
    params: dict = {"project": project_id, "source": "sources"}
    if prompt_id is not None:
        params["prompt"] = prompt_id
    return await _request("GET", "/api/track", params)


@mcp.tool()
async def get_scores(project_id: int) -> dict:
    """
    Get AI knowledge scores by model and date over a 365-day window (project level only).
    """
    return await _request("GET", "/api/track", {"project": project_id, "source": "scores"})


# ---------------------------------------------------------------------------
# Prompt management
# ---------------------------------------------------------------------------

@mcp.tool()
async def list_prompts(
    project_id: int,
    include_inactive: bool = True,
    include_deleted: bool = False,
) -> dict:
    """
    List all tracked prompts for a project, including their models, frequency, and active status.
    include_inactive defaults to True (matches API default). Set include_deleted to see deleted prompts.
    """
    params: dict = {
        "project": project_id,
        "include_inactive": 1 if include_inactive else 0,
        "include_deleted": 1 if include_deleted else 0,
    }
    return await _request("GET", "/api/prompts", params)


@mcp.tool()
async def create_prompt(
    project_id: int,
    prompt_string: str,
    models: list[int],
    frequency: int,
    audience: int = 0,
) -> dict:
    """
    Create a new tracked prompt for a project.
    - models: list of model IDs to track. Options:
        1=Sonar, 3=ChatGPT, 5=Claude, 100=Gemini,
        101=AI Mode (scraped), 102=ChatGPT (scraped), 103=Gemini (scraped), 104=Copilot (scraped)
    - frequency: 1=daily, 2=twice weekly, 7=weekly
    - audience: audience identifier integer (default 0)
    - prompt_string: max 500 characters; cannot be changed after creation
    Returns the new prompt_id, or 402 if the account has insufficient credits.
    """
    body: dict = {
        "prompt_string": prompt_string,
        "models": models,
        "frequency": frequency,
        "audience": audience,
    }
    return await _request("POST", "/api/prompts", {"project": project_id}, body)


@mcp.tool()
async def update_prompt(
    project_id: int,
    prompt_id: int,
    models: list[int] | None = None,
    frequency: int | None = None,
    audience: int | None = None,
    active: int | None = None,
) -> dict:
    """
    Update an existing prompt. The prompt_string cannot be changed after creation.
    Only supply the fields you want to update.
    - frequency: 1=daily, 2=twice weekly, 7=weekly
    - active: 1=running, 0=paused, 2=deleted
    """
    body: dict = {}
    if models is not None:
        body["models"] = models
    if frequency is not None:
        body["frequency"] = frequency
    if audience is not None:
        body["audience"] = audience
    if active is not None:
        body["active"] = active
    return await _request("PATCH", "/api/prompts", {"project": project_id, "prompt": prompt_id}, body)


@mcp.tool()
async def delete_prompt(project_id: int, prompt_id: int) -> dict:
    """
    Soft-delete a tracked prompt. This operation is idempotent.
    """
    return await _request("DELETE", "/api/prompts", {"project": project_id, "prompt": prompt_id})


def main():
    mcp.run()
