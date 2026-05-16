"""
Metl Security Hunter — NATS JetStream Consumer
Subscribes to tasks.security.scan, runs DeepSec + SonarQube, publishes results.
"""

import asyncio
import json
import os
import sys
from typing import Any

import nats
from nats.js.api import ConsumerConfig

from main import clone_and_scan

SONARQUBE_URL = os.getenv("SONARQUBE_URL", "http://sonarqube:9000")
SONARQUBE_TOKEN = os.getenv("SONARQUBE_TOKEN", "")
NATS_URL = os.getenv("NATS_URL", "nats://nats:4222")


async def process_scan_task(task: dict) -> dict:
    """Process a single security scan task."""
    tenant_id = task.get("tenantId", "unknown")
    git_url = task.get("payload", {}).get("gitUrl", "")
    project_key = task.get("payload", {}).get("projectKey", f"metl-{tenant_id}")
    task_id = task.get("id", "unknown")

    print(f"[SecurityHunter] Processing scan task {task_id} for {tenant_id}", file=sys.stderr)

    if not git_url:
        return {
            "taskId": task_id,
            "tenantId": tenant_id,
            "status": "failed",
            "error": "gitUrl is required",
        }

    try:
        results = clone_and_scan(git_url, tenant_id)
        return {
            "taskId": task_id,
            "tenantId": tenant_id,
            "status": "completed",
            "gitUrl": git_url,
            "deepsec": results.get("deepsec", {}),
            "sonarqube": results.get("sonarqube", {}),
            "summary": results.get("summary", {}),
        }
    except Exception as e:
        print(f"[SecurityHunter] Scan failed: {e}", file=sys.stderr)
        return {
            "taskId": task_id,
            "tenantId": tenant_id,
            "status": "failed",
            "error": str(e),
        }


async def publish_result(nc: nats.NATS, result: dict) -> None:
    """Publish scan result back to NATS."""
    js = nc.jetstream()
    await js.publish(
        "events.security.scan.complete",
        json.dumps(result).encode("utf-8"),
    )
    print(f"[SecurityHunter] Published result for task {result.get('taskId')}", file=sys.stderr)


async def main() -> None:
    nc = await nats.connect(servers=[NATS_URL])
    js = nc.jetstream()

    # Ensure stream exists
    try:
        await js.add_stream(
            name="tasks",
            subjects=["tasks.*", "tasks.*.*", "tasks.*.*.*"],
        )
    except Exception:
        pass  # Stream may already exist

    # Add durable consumer
    try:
        await js.add_consumer(
            "tasks",
            config=ConsumerConfig(
                durable_name="security-hunter",
                ack_policy=nats.js.api.AckPolicy.EXPLICIT,
            ),
        )
    except Exception:
        pass  # Consumer may already exist

    sub = await js.pull_subscribe("tasks.security.scan", durable="security-hunter", stream="tasks")
    print("[SecurityHunter] Connected to NATS, listening on tasks.security.scan", file=sys.stderr)

    try:
        while True:
            msgs = await sub.fetch(batch=1, timeout=5)
            for msg in msgs:
                try:
                    data = json.loads(msg.data.decode("utf-8"))
                    result = await process_scan_task(data)
                    await publish_result(nc, result)
                    await msg.ack()
                except Exception as e:
                    print(f"[SecurityHunter] Message handler error: {e}", file=sys.stderr)
                    await msg.nak()
    except asyncio.CancelledError:
        print("[SecurityHunter] Shutting down", file=sys.stderr)
    finally:
        await nc.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("[SecurityHunter] Interrupted", file=sys.stderr)
