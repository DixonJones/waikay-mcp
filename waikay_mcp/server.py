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
    params["key"] = _key()
    async with httpx.AsyncClient() as client:
        resp = await client.request(
            method, f"{BASE_URL}{path}", params=params, json=body, timeout=30
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
    include_inactive: bool = False,
    include_deleted: bool = False,
) -> dict:
    """
    List all tracked prompts for a project, including their models, frequency, and active status.
    Use include_inactive or include_deleted to widen the results.
    """
    params: dict = {"project": project_id}
    if include_inactive:
        params["include_inactive"] = "true"
    if include_deleted:
        params["include_deleted"] = "true"
    return await _request("GET", "/api/prompts", params)


@mcp.tool()
async def create_prompt(
    project_id: int,
    prompt_string: str,
    models: list[str],
    frequency: str,
    audience: str | None = None,
) -> dict:
    """
    Create a new tracked prompt for a project.
    - models: list of AI models to track, e.g. ["chatgpt", "claude", "gemini", "sonar"]
    - frequency: how often to run, e.g. "daily" or "weekly"
    - audience: optional target audience description
    Returns the new prompt_id, or a 402 error if the account has insufficient credits.
    """
    body: dict = {"prompt_string": prompt_string, "models": models, "frequency": frequency}
    if audience is not None:
        body["audience"] = audience
    return await _request("POST", "/api/prompts", {"project": project_id}, body)


@mcp.tool()
async def update_prompt(
    project_id: int,
    prompt_id: int,
    models: list[str] | None = None,
    frequency: str | None = None,
    audience: str | None = None,
    active: bool | None = None,
) -> dict:
    """
    Update an existing prompt. The prompt_string itself cannot be changed.
    Only supply the fields you want to update.
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
