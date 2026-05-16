"""
Metl Universal AI Client — Multi-provider fallback chain.

Primary:    Microsoft AI Foundry (Azure OpenAI compatible endpoints)
            Supports GPT-4o, GLM-4, KimiK, DeepSeek, Grok via env vars
Fallback 1: Gemini API
Fallback 2: OpenAI API
"""

import os
import json
import requests
from typing import Optional, List, Dict, Any
from dataclasses import dataclass

import google.generativeai as genai


def _log(level: str, msg: str, **kwargs) -> None:
    print(json.dumps({"level": level, "msg": msg, **kwargs}), flush=True)


@dataclass
class AiResult:
    content: str
    provider: str
    model_used: str


@dataclass
class FoundryConfig:
    endpoint: str
    key: str
    model: str


def _discover_foundry_configs() -> List[FoundryConfig]:
    configs: List[FoundryConfig] = []
    for i in range(1, 11):
        endpoint = os.getenv(f"AI_FOUNDRY_ENDPOINT_{i}", "").strip()
        key = os.getenv(f"AI_FOUNDRY_KEY_{i}", "").strip()
        model = os.getenv(f"AI_FOUNDRY_MODEL_{i}", "gpt-4o").strip()
        if endpoint and key:
            configs.append(FoundryConfig(endpoint, key, model))
    return configs


def _call_foundry(
    prompt: str,
    system_prompt: str,
    cfg: FoundryConfig,
) -> AiResult:
    url = f"{cfg.endpoint}/openai/deployments/{cfg.model}/chat/completions?api-version=2024-06-01"
    headers = {
        "Content-Type": "application/json",
        "api-key": cfg.key,
    }
    body = {
        "model": cfg.model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
    }
    resp = requests.post(url, headers=headers, json=body, timeout=60)
    resp.raise_for_status()
    data = resp.json()
    text = data["choices"][0]["message"]["content"] if data.get("choices") else ""
    return AiResult(content=text, provider="ai-foundry", model_used=cfg.model)


def _call_gemini(prompt: str, system_prompt: str) -> AiResult:
    key = os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        raise RuntimeError("GEMINI_API_KEY not set")

    genai.configure(api_key=key)
    model = genai.GenerativeModel("gemini-1.5-pro")
    full_prompt = f"{system_prompt}\n\n{prompt}"
    response = model.generate_content(full_prompt)
    return AiResult(
        content=response.text,
        provider="gemini",
        model_used="gemini-1.5-pro",
    )


def _call_openai(prompt: str, system_prompt: str) -> AiResult:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        raise RuntimeError("OPENAI_API_KEY not set")

    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    url = f"{base_url}/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {key}",
    }
    body = {
        "model": "gpt-4o",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
    }
    resp = requests.post(url, headers=headers, json=body, timeout=60)
    resp.raise_for_status()
    data = resp.json()
    text = data["choices"][0]["message"]["content"] if data.get("choices") else ""
    return AiResult(content=text, provider="openai", model_used="gpt-4o")


def generate(prompt: str, system_prompt: Optional[str] = None) -> AiResult:
    """
    Generate text using the full fallback chain:
    AI Foundry configs (in order) -> Gemini -> OpenAI
    """
    sp = system_prompt or (
        "You are an expert software engineer. Generate production-ready code "
        "based on the user's request."
    )

    foundry = _discover_foundry_configs()
    for cfg in foundry:
        try:
            _log("info", "Trying AI Foundry", endpoint=cfg.endpoint, model=cfg.model)
            return _call_foundry(prompt, sp, cfg)
        except Exception as e:
            _log("warn", "AI Foundry failed", endpoint=cfg.endpoint, error=str(e))

    try:
        _log("info", "Trying Gemini fallback")
        return _call_gemini(prompt, sp)
    except Exception as e:
        _log("warn", "Gemini failed", error=str(e))

    _log("info", "Trying OpenAI last-resort fallback")
    return _call_openai(prompt, sp)


class MetlAiClient:
    """Async-capable wrapper for the universal AI client."""

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
    ) -> AiResult:
        import asyncio
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, generate, prompt, system_prompt)
