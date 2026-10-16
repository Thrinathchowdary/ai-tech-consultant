import axios, { AxiosError, AxiosInstance } from "axios";
import { z } from "zod";

export const KnowledgeResponseSchema = z.object({
  answer: z.string(),
  source_urls: z.array(z.string().url()),
  confidence: z.number().min(0).max(1),
  needs_human: z.boolean(),
});

export type KnowledgeResponse = z.infer<typeof KnowledgeResponseSchema>;

export class KnowledgeClientError extends Error {
  public readonly cause?: unknown;

  public constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "KnowledgeClientError";
    this.cause = cause;
  }
}

export interface KnowledgeClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  http?: AxiosInstance;
}

export class KnowledgeClient {
  private readonly http: AxiosInstance;
  private readonly baseUrl: string;

  public constructor(options: KnowledgeClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? "http://127.0.0.1:8000";
    this.http =
      options.http ??
      axios.create({
        baseURL: this.baseUrl,
        timeout: options.timeoutMs ?? 5000,
        headers: { "Content-Type": "application/json" },
      });
  }

  public async query(question: string, topK = 5): Promise<KnowledgeResponse> {
    if (question.trim().length < 3) {
      throw new KnowledgeClientError(
        "Knowledge questions must contain at least three characters",
      );
    }

    try {
      const response = await this.http.post("/query", {
        question,
        top_k: topK,
      });
      return KnowledgeResponseSchema.parse(response.data);
    } catch (error: unknown) {
      if (error instanceof KnowledgeClientError) {
        throw error;
      }
      const detail =
        error instanceof AxiosError
          ? error.code === "ECONNABORTED"
            ? "request timed out"
            : error.message
          : "unexpected client failure";
      throw new KnowledgeClientError(
        `Knowledge Brain query failed: ${detail}`,
        error,
      );
    }
  }
}
