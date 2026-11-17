// Gemini client that runs in the browser. The API key is sent only to Google's
// Generative Language API, in a request header, never in a URL.

import { abortError, isAbort, sleep } from "./util";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export class LlmError extends Error {
  status?: number;
  /** Fatal errors stop the whole run (bad key, missing model, exhausted quota). */
  fatal: boolean;
  retryAfterMs?: number;
  constructor(message: string, opts: { status?: number; fatal?: boolean; retryAfterMs?: number } = {}) {
    super(message);
    this.name = "LlmError";
    this.status = opts.status;
    this.fatal = opts.fatal ?? false;
    this.retryAfterMs = opts.retryAfterMs;
  }
}

export interface ModelInfo {
  id: string;
  displayName: string;
}

interface GeminiErrorBody {
  error?: { code?: number; message?: string; status?: string; details?: { "@type"?: string; retryDelay?: string }[] };
}

async function readError(res: Response): Promise<LlmError> {
  let body: GeminiErrorBody = {};
  try {
    body = (await res.json()) as GeminiErrorBody;
  } catch {
    /* not JSON */
  }
  const raw = body.error?.message ?? `Request failed with status ${res.status}`;
  const retryDelay = body.error?.details?.find((d) => d.retryDelay)?.retryDelay;
  const retryAfterMs = retryDelay ? Math.ceil(parseFloat(retryDelay) * 1000) : undefined;
  const status = res.status;
  if (status === 400 && /api key/i.test(raw)) {
    return new LlmError("Google rejected this API key as not valid. Check that it was copied in full.", { status, fatal: true });
  }
  if (status === 401 || status === 403) {
    return new LlmError(`The API key was rejected: ${raw}`, { status, fatal: true });
  }
  if (status === 404) {
    return new LlmError("That model is not available for this key. Pick another model in Settings.", { status, fatal: true });
  }
  if (status === 429) {
    return new LlmError(`Rate limit or quota reached: ${raw}`, { status, retryAfterMs });
  }
  if (status === 400) {
    return new LlmError(`The model rejected the request: ${raw}`, { status, fatal: true });
  }
  return new LlmError(raw, { status, retryAfterMs });
}

function toNetworkError(e: unknown): Error {
  if (isAbort(e)) return abortError();
  return new LlmError("Could not reach the Gemini API. Check your internet connection.", {});
}

/** Lists the models this key can use for text generation. Also serves as the key check. */
export async function listModels(apiKey: string, signal?: AbortSignal): Promise<ModelInfo[]> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/models?pageSize=200`, { headers: { "x-goog-api-key": apiKey }, signal });
  } catch (e) {
    throw toNetworkError(e);
  }
  if (!res.ok) throw await readError(res);
  const data = (await res.json()) as {
    models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[];
  };
  const skip = /(embedding|tts|image|audio|live|robotics|computer-use|aqa|learnlm|gemma)/i;
  return (data.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .filter((m) => m.name.startsWith("models/gemini") && !skip.test(m.name))
    .map((m) => ({ id: m.name.replace(/^models\//, ""), displayName: m.displayName ?? m.name }))
    .sort((a, b) => scoreModel(b.id) - scoreModel(a.id));
}

/** Prefers fast, low-cost stable models, newest first. */
export function scoreModel(id: string): number {
  const version = parseFloat(id.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? "0");
  let score = version * 10;
  if (/flash-lite/.test(id)) score += 6;
  else if (/flash/.test(id)) score += 4;
  if (/(preview|exp|latest)/.test(id) || /-\d{3,}$/.test(id)) score -= 5;
  return score;
}

export function pickDefaultModel(models: ModelInfo[]): string | undefined {
  return models[0]?.id;
}

/** Limits both how many calls run at once and how many start per minute. */
export class Limiter {
  private active = 0;
  private waiting: { resume: () => void; reject: (e: Error) => void; signal?: AbortSignal; onAbort?: () => void }[] = [];
  private nextSlot = 0;
  constructor(
    private concurrency: number,
    private minIntervalMs: number,
  ) {}

  private acquire(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.reject(abortError());
    if (this.active < this.concurrency) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const entry: (typeof this.waiting)[number] = { resume: resolve, reject, signal };
      entry.onAbort = () => {
        this.waiting = this.waiting.filter((w) => w !== entry);
        reject(abortError());
      };
      signal?.addEventListener("abort", entry.onAbort, { once: true });
      this.waiting.push(entry);
    });
  }

  private release() {
    const next = this.waiting.shift();
    if (next) {
      if (next.onAbort) next.signal?.removeEventListener("abort", next.onAbort);
      next.resume();
    } else {
      this.active--;
    }
  }

  async run<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    await this.acquire(signal);
    try {
      const now = Date.now();
      const wait = Math.max(0, this.nextSlot - now);
      this.nextSlot = Math.max(now, this.nextSlot) + this.minIntervalMs;
      if (wait > 0) await sleep(wait, signal);
      return await fn();
    } finally {
      this.release();
    }
  }
}

/** Pulls a JSON value out of a model reply, tolerating code fences and stray text. */
export function parseJsonReply<T>(text: string): T {
  const cleaned = text.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.search(/[\[{]/);
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new LlmError("The model did not return valid JSON.");
  }
}

export interface GeminiOptions {
  apiKey: string;
  model: string;
  temperature: number;
  requestsPerMinute: number;
  concurrency: number;
  onRequest?: () => void;
}

export class GeminiClient {
  private limiter: Limiter;
  constructor(private opts: GeminiOptions) {
    this.limiter = new Limiter(Math.max(1, opts.concurrency), Math.ceil(60000 / Math.max(1, opts.requestsPerMinute)));
  }

  /** One JSON-mode call with rate limiting, retries and backoff. */
  async json<T>(system: string, user: string, signal?: AbortSignal, temperature?: number): Promise<T> {
    const maxAttempts = 4;
    let lastError: Error = new LlmError("Request failed.");
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const text = await this.limiter.run(() => this.call(system, user, signal, temperature), signal);
        return parseJsonReply<T>(text);
      } catch (e) {
        if (isAbort(e)) throw e;
        const err = e instanceof LlmError ? e : new LlmError(e instanceof Error ? e.message : String(e));
        if (err.fatal) throw err;
        lastError = err;
        if (attempt === maxAttempts - 1) break;
        const backoff = err.retryAfterMs ?? Math.min(30000, 2000 * 2 ** attempt);
        await sleep(Math.min(backoff, 60000), signal);
      }
    }
    if (lastError instanceof LlmError && lastError.status === 429) {
      throw new LlmError(
        `${lastError.message} The run stopped after several retries. Lower "Requests per minute" in Settings, wait for the quota to reset, or use a different model.`,
        { status: 429, fatal: true },
      );
    }
    throw lastError;
  }

  private async call(system: string, user: string, signal?: AbortSignal, temperature?: number): Promise<string> {
    this.opts.onRequest?.();
    let res: Response;
    try {
      res = await fetch(`${BASE}/models/${encodeURIComponent(this.opts.model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.opts.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            temperature: temperature ?? this.opts.temperature,
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
          },
        }),
        signal,
      });
    } catch (e) {
      throw toNetworkError(e);
    }
    if (!res.ok) throw await readError(res);
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
    };
    if (data.promptFeedback?.blockReason) {
      throw new LlmError(`The prompt was blocked (${data.promptFeedback.blockReason}).`);
    }
    const candidate = data.candidates?.[0];
    const text = (candidate?.content?.parts ?? [])
      .filter((p) => !p.thought && typeof p.text === "string")
      .map((p) => p.text)
      .join("");
    if (!text.trim()) {
      throw new LlmError(`The model returned no text (finish reason: ${candidate?.finishReason ?? "unknown"}).`);
    }
    return text;
  }
}
