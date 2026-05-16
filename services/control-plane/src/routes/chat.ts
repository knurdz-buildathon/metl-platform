import { Router, Request, Response } from "express";
import { bus } from "@metl/bus";
import { prisma } from "@metl/db";
import { logger } from "@metl/logger";
import { v4 as uuidv4 } from "uuid";
import { generate, streamGenerate, AiResult } from "../ai-router";

const router = Router();

const CODEGEN_KEYWORDS = ["build", "create", "generate", "write", "code", "app"];

function looksLikeCodegen(message: string): boolean {
  const lower = message.toLowerCase();
  return CODEGEN_KEYWORDS.some((kw) => lower.includes(kw));
}

// GET /api/chat/history/:tenantId
router.get("/history/:tenantId", async (req: Request, res: Response) => {
  try {
    const messages = await prisma.chatMessage.findMany({
      where: { tenantId: req.params.tenantId },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    res.json({ messages });
  } catch (err: any) {
    logger.error({ err, tenantId: req.params.tenantId }, "Failed to fetch chat history");
    res.status(500).json({
      error: {
        code: "ERR_CHAT_HISTORY",
        message: "Failed to fetch chat history",
        details: err?.message || null,
      },
    });
  }
});

// POST /api/chat
router.post("/", async (req: Request, res: Response) => {
  const { tenantId, message, history } = req.body;
  if (!tenantId || !message) {
    res.status(400).json({ error: "tenantId and message are required" });
    return;
  }

  try {
    // Store user message
    await prisma.chatMessage.create({
      data: { tenantId, role: "user", content: message },
    });

    // If it looks like a codegen request, create a task and return taskId
    if (looksLikeCodegen(message)) {
      const task = await prisma.task.create({
        data: {
          type: "codegen",
          status: "pending",
          tenantId,
          payload: { message, history },
        },
      });

      await bus.publish("tasks.codegen", {
        id: task.id,
        tenantId,
        payload: { message, history },
      });

      res.json({ taskId: task.id, status: "pending", mode: "codegen" });
      return;
    }

    // Otherwise, direct AI chat response
    const result = await generate(message);

    await prisma.chatMessage.create({
      data: {
        tenantId,
        role: "assistant",
        content: result.content,
        metadata: {
          provider: result.provider,
          modelUsed: result.modelUsed,
        },
      },
    });

    res.json({
      content: result.content,
      provider: result.provider,
      modelUsed: result.modelUsed,
      mode: "direct",
    });
  } catch (err: any) {
    logger.error({ err, tenantId }, "Chat error");
    res.status(500).json({
      error: {
        code: "ERR_CHAT_PROCESS",
        message: "Failed to process chat message",
        details: err?.message || null,
      },
    });
  }
});

// POST /api/chat/stream
router.post("/stream", async (req: Request, res: Response) => {
  const { tenantId, message } = req.body;
  if (!tenantId || !message) {
    res.status(400).json({ error: "tenantId and message are required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    await prisma.chatMessage.create({
      data: { tenantId, role: "user", content: message },
    });

    let provider = "";
    let modelUsed = "";
    let fullContent = "";

    for await (const chunk of streamGenerate(message)) {
      if (!provider) provider = chunk.provider;
      if (!modelUsed) modelUsed = chunk.modelUsed;
      fullContent += chunk.content;
      res.write(`data: ${JSON.stringify({ type: "chunk", content: chunk.content, provider, modelUsed })}\n\n`);
    }

    await prisma.chatMessage.create({
      data: {
        tenantId,
        role: "assistant",
        content: fullContent,
        metadata: { provider, modelUsed },
      },
    });

    res.write(`data: ${JSON.stringify({ type: "done", provider, modelUsed })}\n\n`);
    res.end();
  } catch (err: any) {
    logger.error({ err, tenantId }, "Chat stream error");
    res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
    res.end();
  }
});

// GET /api/chat/stream/:taskId — task status stream
router.get("/stream/:taskId", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const { taskId } = req.params;
  const interval = setInterval(async () => {
    try {
      const task = await prisma.task.findUnique({ where: { id: taskId } });
      if (!task) {
        res.write(`data: ${JSON.stringify({ type: "error", message: "Task not found" })}\n\n`);
        clearInterval(interval);
        res.end();
        return;
      }

      res.write(`data: ${JSON.stringify({ type: "status", status: task.status })}\n\n`);

      if (task.status === "completed" || task.status === "failed") {
        res.write(
          `data: ${JSON.stringify({ type: "result", result: task.result, error: task.error })}\n\n`
        );
        clearInterval(interval);
        res.end();
      }
    } catch (err: any) {
      logger.error({ err, taskId }, "Stream error");
      clearInterval(interval);
      res.end();
    }
  }, 1000);

  req.on("close", () => {
    clearInterval(interval);
  });
});

export { router as chatRouter };
