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


async def _get(path: str, params: dict) -> dict:
    params["key"] = _key()
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{BASE_URL}{path}", params=params, timeout=30)
        resp.raise_for_status()
        return resp.json()


@mcp.tool()
async def list_projects() -> dict:
    """List all Waikay tracked projects, returning project IDs and URLs."""
    return await _get("/api/projects", {})


@mcp.tool()
async def get_overview(project_id: int, prompt_id: int | None = None) -> dict:
    """
    Get brand mention counts by AI model (ChatGPT, Claude, Gemini, Sonar) over a 7-day window.
    Omit prompt_id for project-level aggregation, or supply it for a specific prompt.
    """
    params: dict = {"project": project_id, "source": "overview"}
    if prompt_id is not None:
        params["prompt"] = prompt_id
    return await _get("/api/track", params)


@mcp.tool()
async def get_rankings(project_id: int, prompt_id: int | None = None) -> dict:
    """
    Get share-of-voice and competitive positioning over a 30-day rolling window.
    Omit prompt_id for project-level aggregation, or supply it for a specific prompt.
    """
    params: dict = {"project": project_id, "source": "rankings"}
    if prompt_id is not None:
        params["prompt"] = prompt_id
    return await _get("/api/track", params)


@mcp.tool()
async def get_sources(project_id: int, prompt_id: int | None = None) -> dict:
    """
    Get citation and URL analysis across AI models over a 30-day rolling window.
    Omit prompt_id for project-level aggregation, or supply it for a specific prompt.
    """
    params: dict = {"project": project_id, "source": "sources"}
    if prompt_id is not None:
        params["prompt"] = prompt_id
    return await _get("/api/track", params)


@mcp.tool()
async def get_scores(project_id: int) -> dict:
    """
    Get AI knowledge scores by model and date over a 365-day window (project level only).
    """
    return await _get("/api/track", {"project": project_id, "source": "scores"})


def main():
    mcp.run()
