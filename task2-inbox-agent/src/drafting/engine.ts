import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { Classification, RiskLevel } from "../email/classifier";
import { KnowledgeClient, KnowledgeResponse } from "../knowledge-client/client";

export const DraftSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  citations: z.array(z.string().url()),
  escalationRequired: z.boolean(),
  risk: z.enum(["low", "medium", "high"]),
  reviewFlags: z.array(z.string()),
});
export type Draft = z.infer<typeof DraftSchema>;

export interface DraftRequest {
  subject: string;
  body: string;
  classification: Classification;
}

export class DraftingEngine {
  private readonly anthropic?: Anthropic;

  public constructor(
    private readonly knowledgeClient: KnowledgeClient,
    anthropic?: Anthropic,
  ) {
    this.anthropic =
      anthropic ??
      (process.env.ANTHROPIC_API_KEY ? new Anthropic() : undefined);
  }

  public async draft(request: DraftRequest): Promise<Draft> {
    const knowledge = await this.knowledgeClient.query(
      `${request.subject}\n${request.body}`,
    );
    const risk = this.resolveRisk(
      request.classification.risk,
      knowledge.needs_human,
    );
    const reviewFlags = this.flagsFor(risk, request.classification);
    const body = this.anthropic
      ? await this.generateWithClaude(request, knowledge, reviewFlags)
      : this.fallbackBody(request, knowledge);

    return DraftSchema.parse({
      subject: request.subject.startsWith("Re:")
        ? request.subject
        : `Re: ${request.subject}`,
      body,
      citations: knowledge.source_urls,
      escalationRequired: knowledge.needs_human || risk === "high",
      risk,
      reviewFlags,
    });
  }

  private resolveRisk(classified: RiskLevel, needsHuman: boolean): RiskLevel {
    if (needsHuman || classified === "high") return "high";
    return classified;
  }

  private flagsFor(risk: RiskLevel, classification: Classification): string[] {
    const flags: string[] = [];
    if (risk === "high") flags.push("Human review required before sending");
    if (classification.category === "refund-cancellation")
      flags.push(
        "Do not promise a refund or cancellation without authorization",
      );
    if (classification.category === "complaint")
      flags.push("Review complaint and legal language carefully");
    return flags;
  }

  private fallbackBody(
    request: DraftRequest,
    knowledge: KnowledgeResponse,
  ): string {
    return `Hello,\n\nThank you for contacting us about ${request.subject.toLowerCase()}.\n\n${knowledge.answer}\n\nPlease reply with any additional details and we will be glad to help.\n\nBest,\nThe Support Team`;
  }

  private async generateWithClaude(
    request: DraftRequest,
    knowledge: KnowledgeResponse,
    reviewFlags: string[],
  ): Promise<string> {
    const response = await this.anthropic!.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-latest",
      max_tokens: 700,
      system:
        "You write concise, professional customer support replies. Use only the supplied knowledge. Never invent policies, prices, refunds, or timelines. Do not mention internal review flags or the knowledge system.",
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            email: request,
            knowledge,
            reviewFlags,
            instruction:
              "Return only the email body, with greeting and sign-off.",
          }),
        },
      ],
    });
    const text = response.content.find((block) => block.type === "text");
    return text?.type === "text"
      ? text.text
      : this.fallbackBody(request, knowledge);
  }
}
