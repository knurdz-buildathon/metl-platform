from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import json

from ai_client import generate as ai_generate, AiResult

app = FastAPI(title="Metl Vibe Coder", version="2.0.0")


class GenerateRequest(BaseModel):
    prompt: str
    language: str = "typescript"
    framework: str = "nextjs"
    tenant_id: str


class GenerateResponse(BaseModel):
    code: str
    files: Dict[str, Any]
    explanation: str
    provider: str = ""
    model_used: str = ""


class RepairRequest(BaseModel):
    code: str
    error: str
    tenant_id: str


class ReviewRequest(BaseModel):
    code: str
    tenant_id: str


def _build_system_prompt(language: str, framework: str) -> str:
    return (
        f"You are an expert software engineer. Generate production-ready code based on the user's request.\n"
        f"Language: {language}\n"
        f"Framework: {framework}\n\n"
        f"Respond with a JSON object containing:\n"
        f'\u201c code\u201d: A brief main code snippet\n'
        f'\u201c files\u201d: A dictionary of filename -> content for all generated files\n'
        f'\u201c explanation\u201d: A brief explanation of the generated code\n'
        f"Return ONLY valid JSON."
    )


@app.get("/health")
async def health():
    return {"status": "ok", "ai_client": "loaded"}


@app.post("/generate", response_model=GenerateResponse)
async def generate(req: GenerateRequest):
    system_prompt = _build_system_prompt(req.language, req.framework)

    try:
        result: AiResult = ai_generate(
            f"User request: {req.prompt}", system_prompt
        )

        # Attempt to parse JSON from the response
        try:
            parsed = json.loads(result.content)
            return GenerateResponse(
                code=parsed.get("code", result.content[:2000]),
                files=parsed.get("files", {"app.tsx": result.content[:1500]}),
                explanation=parsed.get("explanation", "Generated based on your prompt."),
                provider=result.provider,
                model_used=result.model_used,
            )
        except json.JSONDecodeError:
            # Fallback if model didn't return valid JSON
            return GenerateResponse(
                code=result.content[:2000],
                files={"generated.txt": result.content[:3000]},
                explanation="Generated based on your prompt.",
                provider=result.provider,
                model_used=result.model_used,
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/repair")
async def repair(req: RepairRequest):
    system_prompt = (
        "You are an expert software engineer. Fix the following code that has an error.\n"
        "Provide ONLY the fixed code. No explanations."
    )
    prompt = f"Error: {req.error}\n\nCode:\n```\n{req.code}\n```\n"

    try:
        result: AiResult = ai_generate(prompt, system_prompt)
        return {
            "fixed_code": result.content,
            "provider": result.provider,
            "model_used": result.model_used,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/review")
async def review(req: ReviewRequest):
    system_prompt = (
        "You are a senior code reviewer. Review the following code and provide:\n"
        "1. A quality score (1-10)\n"
        "2. Key issues found\n"
        "3. Suggestions for improvement\n"
    )
    prompt = f"Code:\n```\n{req.code}\n```\n"

    try:
        result: AiResult = ai_generate(prompt, system_prompt)
        return {
            "review": result.content,
            "provider": result.provider,
            "model_used": result.model_used,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tasks/codegen")
async def handle_codegen_task(task: dict):
    """Handle NATS codegen task via HTTP adapter."""
    payload = task.get("payload", {})
    req = GenerateRequest(
        prompt=payload.get("message", ""),
        tenant_id=task.get("tenantId", ""),
    )
    result = await generate(req)
    return {
        "taskId": task.get("id"),
        "result": result.model_dump(),
    }
