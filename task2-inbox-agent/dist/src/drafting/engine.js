"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DraftingEngine = exports.DraftSchema = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const zod_1 = require("zod");
exports.DraftSchema = zod_1.z.object({
    subject: zod_1.z.string().min(1),
    body: zod_1.z.string().min(1),
    citations: zod_1.z.array(zod_1.z.string().url()),
    escalationRequired: zod_1.z.boolean(),
    risk: zod_1.z.enum(["low", "medium", "high"]),
    reviewFlags: zod_1.z.array(zod_1.z.string()),
});
class DraftingEngine {
    knowledgeClient;
    anthropic;
    constructor(knowledgeClient, anthropic) {
        this.knowledgeClient = knowledgeClient;
        this.anthropic =
            anthropic ??
                (process.env.ANTHROPIC_API_KEY ? new sdk_1.default() : undefined);
    }
    async draft(request) {
        const knowledge = await this.knowledgeClient.query(`${request.subject}\n${request.body}`);
        const risk = this.resolveRisk(request.classification.risk, knowledge.needs_human);
        const reviewFlags = this.flagsFor(risk, request.classification);
        const body = this.anthropic
            ? await this.generateWithClaude(request, knowledge, reviewFlags)
            : this.fallbackBody(request, knowledge);
        return exports.DraftSchema.parse({
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
    resolveRisk(classified, needsHuman) {
        if (needsHuman || classified === "high")
            return "high";
        return classified;
    }
    flagsFor(risk, classification) {
        const flags = [];
        if (risk === "high")
            flags.push("Human review required before sending");
        if (classification.category === "refund-cancellation")
            flags.push("Do not promise a refund or cancellation without authorization");
        if (classification.category === "complaint")
            flags.push("Review complaint and legal language carefully");
        return flags;
    }
    fallbackBody(request, knowledge) {
        return `Hello,\n\nThank you for contacting us about ${request.subject.toLowerCase()}.\n\n${knowledge.answer}\n\nPlease reply with any additional details and we will be glad to help.\n\nBest,\nThe Support Team`;
    }
    async generateWithClaude(request, knowledge, reviewFlags) {
        const response = await this.anthropic.messages.create({
            model: process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-latest",
            max_tokens: 700,
            system: "You write concise, professional customer support replies. Use only the supplied knowledge. Never invent policies, prices, refunds, or timelines. Do not mention internal review flags or the knowledge system.",
            messages: [
                {
                    role: "user",
                    content: JSON.stringify({
                        email: request,
                        knowledge,
                        reviewFlags,
                        instruction: "Return only the email body, with greeting and sign-off.",
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
exports.DraftingEngine = DraftingEngine;
