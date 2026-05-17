"""
Metl Vibe Coder — NATS JetStream Consumer
Subscribes to tasks.codegen, generates code via the universal AI client, publishes results.
"""

import asyncio
import json
import os
import sys
from typing import Any

import nats
import nats.errors
from nats.js.api import ConsumerConfig

from ai_client import generate, AiResult

NATS_URL = os.getenv("NATS_URL", "nats://nats:4222")


async def publish_result(nc: nats.NATS, subject: str, data: dict) -> None:
    js = nc.jetstream()
    await js.publish(subject, json.dumps(data).encode("utf-8"))


async def process_codegen_task(task: dict) -> dict:
    """Process a single codegen task."""
    tenant_id = task.get("tenantId", "unknown")
    payload = task.get("payload", {})
    message = payload.get("message", "")
    history = payload.get("history", [])
    task_id = task.get("id", "unknown")

    print(f"[VibeCoder] Processing codegen task {task_id} for {tenant_id}", file=sys.stderr)

    if not message:
        return {
            "taskId": task_id,
            "tenantId": tenant_id,
            "status": "failed",
            "error": "message is required",
        }

    system_prompt = (
        "You are an expert software engineer. Generate production-ready code based on the user's request.\n"
        f"Language: {payload.get('language', 'typescript')}\n"
        f"Framework: {payload.get('framework', 'nextjs')}\n"
    )

    try:
        result: AiResult = generate(message, system_prompt)
        return {
            "taskId": task_id,
            "tenantId": tenant_id,
            "status": "completed",
            "content": result.content,
            "provider": result.provider,
            "modelUsed": result.model_used,
        }
    except Exception as e:
        print(f"[VibeCoder] Codegen failed: {e}", file=sys.stderr)
        return {
            "taskId": task_id,
            "tenantId": tenant_id,
            "status": "failed",
            "error": str(e),
        }


async def main() -> None:
    nc = await nats.connect(servers=[NATS_URL])
    js = nc.jetstream()

    try:
        await js.add_stream(
            name="tasks",
            subjects=["tasks.*", "tasks.*.*", "tasks.*.*.*"],
        )
    except Exception:
        pass

    try:
        await js.add_consumer(
            "tasks",
            config=ConsumerConfig(
                durable_name="vibe-coder",
                ack_policy=nats.js.api.AckPolicy.EXPLICIT,
            ),
        )
    except Exception:
        pass

    sub = await js.pull_subscribe("tasks.codegen", durable="vibe-coder", stream="tasks")
    print("[VibeCoder] Connected to NATS, listening on tasks.codegen", file=sys.stderr)

    try:
        while True:
            try:
                msgs = await sub.fetch(batch=1, timeout=5)
            except (nats.errors.TimeoutError, asyncio.TimeoutError):
                continue
            for msg in msgs:
                try:
                    data = json.loads(msg.data.decode("utf-8"))
                    result = await process_codegen_task(data)
                    await publish_result(nc, "events.codegen.complete", result)
                    await msg.ack()
                except Exception as e:
                    print(f"[VibeCoder] Message handler error: {e}", file=sys.stderr)
                    await msg.nak()
    except asyncio.CancelledError:
        print("[VibeCoder] Shutting down", file=sys.stderr)
    finally:
        await nc.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("[VibeCoder] Interrupted", file=sys.stderr)
