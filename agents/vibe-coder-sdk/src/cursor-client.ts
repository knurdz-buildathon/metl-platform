/**
 * Metl Cursor SDK Client — Multi-key fallback chain for cloud vibe coding.
 *
 * Primary:    Cursor SDK cloud agents (multiple API keys for failover)
 * Fallback:   AI Foundry → Gemini → OpenAI (via the universal fallback chain)
 *
 * Reads env:
 *   CURSOR_API_KEY_1, CURSOR_API_KEY_2, ... CURSOR_API_KEY_N
 *   AI_FOUNDRY_ENDPOINT_*, AI_FOUNDRY_KEY_*, AI_FOUNDRY_MODEL_*
 *   GEMINI_API_KEY
 *   OPENAI_API_KEY, OPENAI_BASE_URL
 */

import { Agent, CursorAgentError } from "@cursor/sdk";
import { logger } from "@metl/logger";
import OpenAI from "openai";

// ---------- Types ----------

interface CursorKeyConfig {
  key: string;
  index: number;
}

export interface AiResult {
  content: string;
  provider: string;
  modelUsed: string;
  agentId?: string;
  runId?: string;
  prUrl?: string;
}

interface CursorTaskPayload {
  prompt: string;
  repoUrl: string;
  branch?: string;
  tenantId: string;
  taskId: string;
  autoCreatePR?: boolean;
}

// ---------- Cursor Key Discovery ----------

function discoverCursorKeys(): CursorKeyConfig[] {
  const keys: CursorKeyConfig[] = [];
  const max = 10;
  for (let i = 1; i <= max; i++) {
    const key = process.env[`CURSOR_API_KEY_${i}`]?.trim();
    if (key) keys.push({ key, index: i });
  }
  return keys;
}

// ---------- AI Foundry / OpenAI Fallback ----------

interface FoundryConfig {
  endpoint: string;
  key: string;
  model: string;
}

function discoverFoundryConfigs(): FoundryConfig[] {
  const configs: FoundryConfig[] = [];
  const max = 10;
  for (let i = 1; i <= max; i++) {
    const endpoint = process.env[`AI_FOUNDRY_ENDPOINT_${i}`]?.trim();
    const key = process.env[`AI_FOUNDRY_KEY_${i}`]?.trim();
    const model = process.env[`AI_FOUNDRY_MODEL_${i}`]?.trim() || "gpt-4o";
    if (endpoint && key) configs.push({ endpoint, key, model });
  }
  return configs;
}

async function callFoundry(
  prompt: string,
  systemPrompt: string,
  endpoint: string,
  apiKey: string,
  model: string
): Promise<AiResult> {
  const client = new OpenAI({
    apiKey,
    baseURL: `${endpoint}/openai/deployments/${model}`,
    defaultHeaders: { "api-key": apiKey },
  });
  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
  });
  return {
    content: res.choices[0]?.message?.content || "",
    provider: "ai-foundry",
    modelUsed: model,
  };
}

async function callGemini(
  prompt: string,
  systemPrompt: string
): Promise<AiResult> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new Error("GEMINI_API_KEY not set");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiKey}`;
  const body = {
    contents: [
      { role: "user", parts: [{ text: `${systemPrompt}\n\n${prompt}` }] },
    ],
    generationConfig: { temperature: 0.2 },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const data = (await res.json()) as any;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return { content: text, provider: "gemini", modelUsed: "gemini-1.5-pro" };
}

async function callOpenAI(
  prompt: string,
  systemPrompt: string
): Promise<AiResult> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error("OPENAI_API_KEY not set");

  const client = new OpenAI({
    apiKey: openaiKey,
    baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  });
  const res = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
  });
  return {
    content: res.choices[0]?.message?.content || "",
    provider: "openai",
    modelUsed: "gpt-4o",
  };
}

async function fallbackGenerate(
  prompt: string,
  systemPrompt: string
): Promise<AiResult> {
  const foundry = discoverFoundryConfigs();

  for (const cfg of foundry) {
    try {
      logger.info(
        { endpoint: cfg.endpoint, model: cfg.model },
        "Trying AI Foundry fallback"
      );
      return await callFoundry(
        prompt,
        systemPrompt,
        cfg.endpoint,
        cfg.key,
        cfg.model
      );
    } catch (err: any) {
      logger.warn(
        { err: err.message, endpoint: cfg.endpoint },
        "AI Foundry fallback failed"
      );
    }
  }

  try {
    logger.info("Trying Gemini fallback");
    return await callGemini(prompt, systemPrompt);
  } catch (err: any) {
    logger.warn({ err: err.message }, "Gemini fallback failed");
  }

  logger.info("Trying OpenAI last-resort fallback");
  return await callOpenAI(prompt, systemPrompt);
}

// ---------- Cursor Cloud Agent Runner ----------

async function runCursorCloud(
  payload: CursorTaskPayload,
  apiKey: string,
  keyIndex: number
): Promise<AiResult> {
  const agent = Agent.create({
    apiKey,
    model: { id: "composer-2" },
    cloud: {
      repos: [
        {
          url: payload.repoUrl,
          branch: payload.branch || "main",
        },
      ],
      autoCreatePR: payload.autoCreatePR ?? false,
      skipReviewerRequest: true,
    },
  });

  try {
    const run = await agent.send(payload.prompt);
    logger.info({ runId: run.id, agentId: agent.agentId, keyIndex }, "Cursor cloud run started");

    const result = await run.wait();
    logger.info({ status: result.status, runId: run.id }, "Cursor cloud run finished");

    if (result.status === "error") {
      throw new Error(`Cursor run failed: ${result.id}`);
    }

    return {
      content: result.result || "Cursor agent completed successfully.",
      provider: "cursor-sdk",
      modelUsed: "composer-2",
      agentId: agent.agentId,
      runId: run.id,
      prUrl: (result as any).prUrl,
    };
  } catch (err) {
    if (err instanceof CursorAgentError) {
      throw new Error(`Cursor startup failed (key ${keyIndex}): ${err.message}, retryable=${err.isRetryable}`);
    }
    throw err;
  } finally {
    await (agent as any)[Symbol.asyncDispose]?.().catch(() => null);
  }
}

// ---------- Public API ----------

export async function generateWithFallback(
  payload: CursorTaskPayload
): Promise<AiResult> {
  const cursorKeys = discoverCursorKeys();

  for (const cfg of cursorKeys) {
    try {
      logger.info({ keyIndex: cfg.index }, "Trying Cursor SDK cloud agent");
      return await runCursorCloud(payload, cfg.key, cfg.index);
    } catch (err: any) {
      logger.warn(
        { err: err.message, keyIndex: cfg.index },
        "Cursor SDK key failed, trying next"
      );
    }
  }

  logger.info("All Cursor SDK keys exhausted, falling back to Foundry/Gemini/OpenAI");
  const systemPrompt =
    "You are an expert software engineer. Generate production-ready code based on the user's request.";
  return await fallbackGenerate(payload.prompt, systemPrompt);
}

export function isCursorAvailable(): boolean {
  return discoverCursorKeys().length > 0;
}
