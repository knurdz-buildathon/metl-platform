import dotenv from "dotenv";
import { bus } from "@metl/bus";
import { prisma } from "@metl/db";
import { logger, initTelemetry } from "@metl/logger";
import { generateWithFallback } from "./cursor-client";

dotenv.config();
initTelemetry();

interface CodegenTask {
  id: string;
  tenantId: string;
  payload: {
    message: string;
    history?: any[];
    repoUrl?: string;
    branch?: string;
    autoCreatePR?: boolean;
  };
}

async function handleCodegenTask(task: CodegenTask): Promise<void> {
  const { id, tenantId, payload } = task;
  logger.info({ taskId: id, tenantId }, "VibeCoderSDK: received codegen task");

  try {
    await prisma.task.update({
      where: { id },
      data: { status: "running" },
    });

    const repoUrl = payload.repoUrl || `https://github.com/metl/${tenantId}`;
    const result = await generateWithFallback({
      prompt: payload.message,
      repoUrl,
      branch: payload.branch,
      tenantId,
      taskId: id,
      autoCreatePR: payload.autoCreatePR,
    });

    await prisma.task.update({
      where: { id },
      data: {
        status: "completed",
        result: result as any,
      },
    });

    await prisma.chatMessage.create({
      data: {
        tenantId,
        role: "assistant",
        content: result.content,
        metadata: {
          provider: result.provider,
          modelUsed: result.modelUsed,
          agentId: result.agentId,
          runId: result.runId,
          prUrl: result.prUrl,
        },
      },
    });

    await bus.publish("events.codegen.complete", {
      eventType: "CODEGEN_COMPLETE",
      taskId: id,
      tenantId,
      provider: result.provider,
      modelUsed: result.modelUsed,
      agentId: result.agentId,
      runId: result.runId,
      prUrl: result.prUrl,
      timestamp: new Date().toISOString(),
    });

    logger.info({ taskId: id, provider: result.provider }, "VibeCoderSDK: codegen complete");
  } catch (err: any) {
    logger.error({ err, taskId: id }, "VibeCoderSDK: codegen failed");

    await prisma.task.update({
      where: { id },
      data: { status: "failed", error: err.message },
    });

    await bus.publish("events.codegen.complete", {
      eventType: "CODEGEN_FAILED",
      taskId: id,
      tenantId,
      error: err.message,
      timestamp: new Date().toISOString(),
    });

    throw err;
  }
}

async function main() {
  await bus.connect();
  logger.info("VibeCoderSDK connected to NATS");

  await bus.subscribe("tasks.codegen", "vibe-coder-sdk", handleCodegenTask);

  logger.info("VibeCoderSDK listening on tasks.codegen");
}

function shutdown(signal: string) {
  logger.info({ signal }, "VibeCoderSDK shutting down gracefully");
  bus.close().catch(() => null);
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

main().catch((err) => {
  logger.error({ err }, "VibeCoderSDK failed to start");
  process.exit(1);
});
