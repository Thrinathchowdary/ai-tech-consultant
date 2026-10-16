"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const engine_1 = require("../src/drafting/engine");
const classifier_1 = require("../src/email/classifier");
const learner_1 = require("../src/feedback/learner");
const client_1 = require("../src/knowledge-client/client");
const corpus = JSON.parse(node_fs_1.default.readFileSync(node_path_1.default.join(__dirname, "../src/data/emails.json"), "utf8"));
describe("Inbox Agent evaluation", () => {
    test("1: corpus contains exactly 50 emails", () => expect(corpus).toHaveLength(50));
    test("2: corpus has the required category distribution", () => {
        const counts = corpus.reduce((result, email) => {
            result[email.category] = (result[email.category] ?? 0) + 1;
            return result;
        }, {});
        expect(counts).toEqual({
            "how-to": 12,
            troubleshooting: 10,
            "project-request": 6,
            "refund-cancellation": 6,
            complaint: 6,
            quote: 5,
            "follow-up": 5,
        });
    });
    test("3: classifies a setup question as how-to", () => expect((0, classifier_1.classifyEmail)("How do I add a user?", "Please show me the steps.")
        .category).toBe("how-to"));
    test("4: classifies a broken export as troubleshooting", () => expect((0, classifier_1.classifyEmail)("Export error", "The CSV export is not working.").category).toBe("troubleshooting"));
    test("5: classifies a custom integration as project request", () => expect((0, classifier_1.classifyEmail)("CRM integration project", "We need a custom integration.")
        .category).toBe("project-request"));
    test("6: classifies a refund request as high risk", () => expect((0, classifier_1.classifyEmail)("Refund please", "Please refund the duplicate charge.")).toMatchObject({ category: "refund-cancellation", risk: "high" }));
    test("7: classifies legal complaint as high urgency and high risk", () => expect((0, classifier_1.classifyEmail)("Formal complaint", "We are considering legal action immediately.")).toMatchObject({ category: "complaint", urgency: "high", risk: "high" }));
    test("8: classifies pricing as quote and medium risk", () => expect((0, classifier_1.classifyEmail)("Pricing request", "Please send a quote for 20 seats.")).toMatchObject({ category: "quote", risk: "medium" }));
    test("9: classifies an update request as follow-up", () => expect((0, classifier_1.classifyEmail)("Checking in", "Any update on our ticket?").category).toBe("follow-up"));
    test("10: classifier output passes its Zod schema", () => expect(() => classifier_1.ClassificationSchema.parse((0, classifier_1.classifyEmail)("Help", "How can I export?"))).not.toThrow());
    test("11: nineteen clean approvals remain ineligible", () => {
        const learner = new learner_1.FeedbackLearner();
        for (let index = 0; index < 19; index += 1)
            learner.record({ category: "how-to", action: "approved", risk: "low" });
        expect(learner.get("how-to")).toMatchObject({
            consecutiveUneditedApprovals: 19,
            eligibleForAutonomousSending: false,
        });
    });
    test("12: twenty clean approvals make a category eligible", () => {
        const learner = new learner_1.FeedbackLearner();
        for (let index = 0; index < 20; index += 1)
            learner.record({ category: "how-to", action: "approved", risk: "low" });
        expect(learner.get("how-to")).toMatchObject({
            consecutiveUneditedApprovals: 20,
            eligibleForAutonomousSending: true,
        });
    });
    test("13: an edit immediately resets eligibility progress", () => {
        const learner = new learner_1.FeedbackLearner();
        for (let index = 0; index < 20; index += 1)
            learner.record({ category: "how-to", action: "approved", risk: "low" });
        learner.record({ category: "how-to", action: "edited", risk: "low" });
        expect(learner.get("how-to")).toMatchObject({
            consecutiveUneditedApprovals: 0,
            eligibleForAutonomousSending: false,
            totalEdited: 1,
        });
    });
    test("14: a rejection immediately resets eligibility progress", () => {
        const learner = new learner_1.FeedbackLearner();
        learner.record({ category: "how-to", action: "approved", risk: "low" });
        learner.record({ category: "how-to", action: "rejected", risk: "low" });
        expect(learner.get("how-to").consecutiveUneditedApprovals).toBe(0);
    });
    test("15: a high-risk approval never advances the counter", () => {
        const learner = new learner_1.FeedbackLearner();
        learner.record({ category: "how-to", action: "approved", risk: "high" });
        expect(learner.get("how-to")).toMatchObject({
            consecutiveUneditedApprovals: 0,
            eligibleForAutonomousSending: false,
        });
    });
    test("16: knowledge client preserves citations and escalation state", async () => {
        const http = {
            post: jest
                .fn()
                .mockResolvedValue({
                data: {
                    answer: "Use Settings.",
                    source_urls: ["https://example.com/help"],
                    confidence: 0.9,
                    needs_human: true,
                },
            }),
        };
        const result = await new client_1.KnowledgeClient({ http }).query("How do I use Settings?");
        expect(result).toEqual({
            answer: "Use Settings.",
            source_urls: ["https://example.com/help"],
            confidence: 0.9,
            needs_human: true,
        });
    });
    test("17: knowledge client wraps connection errors", async () => {
        const http = {
            post: jest.fn().mockRejectedValue(new Error("ECONNREFUSED")),
        };
        await expect(new client_1.KnowledgeClient({ http }).query("How do I use Settings?")).rejects.toBeInstanceOf(client_1.KnowledgeClientError);
    });
    test("18: knowledge client rejects malformed Task 1 responses", async () => {
        const http = {
            post: jest.fn().mockResolvedValue({ data: { answer: "missing fields" } }),
        };
        await expect(new client_1.KnowledgeClient({ http }).query("How do I use Settings?")).rejects.toBeInstanceOf(client_1.KnowledgeClientError);
    });
    test("19: drafting fallback includes Task 1 citations", async () => {
        const knowledgeClient = {
            query: jest
                .fn()
                .mockResolvedValue({
                answer: "Open Settings.",
                source_urls: ["https://example.com/settings"],
                confidence: 0.8,
                needs_human: false,
            }),
        };
        const classification = (0, classifier_1.classifyEmail)("How do I change settings?", "Please help.");
        const draft = await new engine_1.DraftingEngine(knowledgeClient).draft({
            subject: "How do I change settings?",
            body: "Please help.",
            classification,
        });
        expect(draft).toMatchObject({
            citations: ["https://example.com/settings"],
            escalationRequired: false,
            risk: "low",
        });
    });
    test("20: drafting flags Task 1 escalation and high-risk categories", async () => {
        const knowledgeClient = {
            query: jest
                .fn()
                .mockResolvedValue({
                answer: "A specialist will review this.",
                source_urls: [],
                confidence: 0.2,
                needs_human: true,
            }),
        };
        const classification = (0, classifier_1.classifyEmail)("Refund request", "Please refund this charge.");
        const draft = await new engine_1.DraftingEngine(knowledgeClient).draft({
            subject: "Refund request",
            body: "Please refund this charge.",
            classification,
        });
        expect(draft).toMatchObject({ escalationRequired: true, risk: "high" });
        expect(draft.reviewFlags.length).toBeGreaterThan(0);
    });
});
