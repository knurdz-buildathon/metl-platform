/**
 * Metl AI Router — Control-plane multi-provider fallback chain.
 *
 * Primary:    Microsoft AI Foundry (Azure OpenAI compatible endpoints)
 * Fallback 1: Gemini REST API
 * Fallback 2: OpenAI API
 *
 * Reads env:
 *   AI_FOUNDRY_ENDPOINT_*, AI_FOUNDRY_KEY_*, AI_FOUNDRY_MODEL_*
 *   GEMINI_API_KEY
 *   OPENAI_API_KEY, OPENAI_BASE_URL
 */

import { logger } from "@metl/logger";
import OpenAI from "openai";

export interface AiResult {
  content: string;
  provider: string;
  modelUsed: string;
}

interface FoundryConfig {
  endpoint: string;
  key: string;
  model: string;
}

function discoverFoundryConfigs(): FoundryConfig[] {
  const configs: FoundryConfig[] = [];
  for (let i = 1; i <= 10; i++) {
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
  cfg: FoundryConfig
): Promise<AiResult> {
  const client = new OpenAI({
    apiKey: cfg.key,
    baseURL: `${cfg.endpoint}/openai/deployments/${cfg.model}`,
    defaultHeaders: { "api-key": cfg.key },
  });
  const res = await client.chat.completions.create({
    model: cfg.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
  });
  return {
    content: res.choices[0]?.message?.content || "",
    provider: "ai-foundry",
    modelUsed: cfg.model,
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

export async function generate(
  prompt: string,
  systemPrompt?: string
): Promise<AiResult> {
  const sp =
    systemPrompt ||
    "You are an expert software engineer. Be concise and helpful.";

  const foundry = discoverFoundryConfigs();
  for (const cfg of foundry) {
    try {
      logger.info({ endpoint: cfg.endpoint, model: cfg.model }, "Trying AI Foundry");
      return await callFoundry(prompt, sp, cfg);
    } catch (err: any) {
      logger.warn({ err: err.message, endpoint: cfg.endpoint }, "AI Foundry failed");
    }
  }

  try {
    logger.info("Trying Gemini fallback");
    return await callGemini(prompt, sp);
  } catch (err: any) {
    logger.warn({ err: err.message }, "Gemini fallback failed");
  }

  logger.info("Trying OpenAI last-resort fallback");
  return await callOpenAI(prompt, sp);
}

export async function* streamGenerate(
  prompt: string,
  systemPrompt?: string
): AsyncGenerator<AiResult> {
  const sp =
    systemPrompt ||
    "You are an expert software engineer. Be concise and helpful.";

  const foundry = discoverFoundryConfigs();

  for (const cfg of foundry) {
    try {
      logger.info({ endpoint: cfg.endpoint, model: cfg.model }, "Trying AI Foundry stream");
      const client = new OpenAI({
        apiKey: cfg.key,
        baseURL: `${cfg.endpoint}/openai/deployments/${cfg.model}`,
        defaultHeaders: { "api-key": cfg.key },
      });
      const stream = await client.chat.completions.create({
        model: cfg.model,
        messages: [
          { role: "system", content: sp },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        stream: true,
      });
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) yield { content: delta, provider: "ai-foundry", modelUsed: cfg.model };
      }
      return;
    } catch (err: any) {
      logger.warn({ err: err.message, endpoint: cfg.endpoint }, "AI Foundry stream failed");
    }
  }

  try {
    logger.info("Trying Gemini fallback stream");
    // Gemini does not support true server-side streaming easily; yield full response
    const result = await callGemini(prompt, sp);
    yield result;
    return;
  } catch (err: any) {
    logger.warn({ err: err.message }, "Gemini stream fallback failed");
  }

  logger.info("Trying OpenAI last-resort stream fallback");
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error("OPENAI_API_KEY not set");
  const client = new OpenAI({
    apiKey: openaiKey,
    baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  });
  const stream = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: sp },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    stream: true,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || "";
    if (delta) yield { content: delta, provider: "openai", modelUsed: "gpt-4o" };
  }
}
