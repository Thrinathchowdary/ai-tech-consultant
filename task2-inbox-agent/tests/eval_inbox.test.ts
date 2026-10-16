import fs from "node:fs";
import path from "node:path";
import { AxiosInstance } from "axios";
import { DraftingEngine } from "../src/drafting/engine";
import { classifyEmail, ClassificationSchema } from "../src/email/classifier";
import { FeedbackLearner } from "../src/feedback/learner";
import {
  KnowledgeClient,
  KnowledgeClientError,
} from "../src/knowledge-client/client";

type CorpusEmail = {
  id: number;
  category: string;
  subject: string;
  body: string;
};
const corpus = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../src/data/emails.json"), "utf8"),
) as CorpusEmail[];

describe("Inbox Agent evaluation", () => {
  test("1: corpus contains exactly 50 emails", () =>
    expect(corpus).toHaveLength(50));
  test("2: corpus has the required category distribution", () => {
    const counts = corpus.reduce<Record<string, number>>((result, email) => {
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
  test("3: classifies a setup question as how-to", () =>
    expect(
      classifyEmail("How do I add a user?", "Please show me the steps.")
        .category,
    ).toBe("how-to"));
  test("4: classifies a broken export as troubleshooting", () =>
    expect(
      classifyEmail("Export error", "The CSV export is not working.").category,
    ).toBe("troubleshooting"));
  test("5: classifies a custom integration as project request", () =>
    expect(
      classifyEmail("CRM integration project", "We need a custom integration.")
        .category,
    ).toBe("project-request"));
  test("6: classifies a refund request as high risk", () =>
    expect(
      classifyEmail("Refund please", "Please refund the duplicate charge."),
    ).toMatchObject({ category: "refund-cancellation", risk: "high" }));
  test("7: classifies legal complaint as high urgency and high risk", () =>
    expect(
      classifyEmail(
        "Formal complaint",
        "We are considering legal action immediately.",
      ),
    ).toMatchObject({ category: "complaint", urgency: "high", risk: "high" }));
  test("8: classifies pricing as quote and medium risk", () =>
    expect(
      classifyEmail("Pricing request", "Please send a quote for 20 seats."),
    ).toMatchObject({ category: "quote", risk: "medium" }));
  test("9: classifies an update request as follow-up", () =>
    expect(
      classifyEmail("Checking in", "Any update on our ticket?").category,
    ).toBe("follow-up"));
  test("10: classifier output passes its Zod schema", () =>
    expect(() =>
      ClassificationSchema.parse(classifyEmail("Help", "How can I export?")),
    ).not.toThrow());
  test("11: nineteen clean approvals remain ineligible", () => {
    const learner = new FeedbackLearner();
    for (let index = 0; index < 19; index += 1)
      learner.record({ category: "how-to", action: "approved", risk: "low" });
    expect(learner.get("how-to")).toMatchObject({
      consecutiveUneditedApprovals: 19,
      eligibleForAutonomousSending: false,
    });
  });
  test("12: twenty clean approvals make a category eligible", () => {
    const learner = new FeedbackLearner();
    for (let index = 0; index < 20; index += 1)
      learner.record({ category: "how-to", action: "approved", risk: "low" });
    expect(learner.get("how-to")).toMatchObject({
      consecutiveUneditedApprovals: 20,
      eligibleForAutonomousSending: true,
    });
  });
  test("13: an edit immediately resets eligibility progress", () => {
    const learner = new FeedbackLearner();
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
    const learner = new FeedbackLearner();
    learner.record({ category: "how-to", action: "approved", risk: "low" });
    learner.record({ category: "how-to", action: "rejected", risk: "low" });
    expect(learner.get("how-to").consecutiveUneditedApprovals).toBe(0);
  });
  test("15: a high-risk approval never advances the counter", () => {
    const learner = new FeedbackLearner();
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
    } as unknown as AxiosInstance;
    const result = await new KnowledgeClient({ http }).query(
      "How do I use Settings?",
    );
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
    } as unknown as AxiosInstance;
    await expect(
      new KnowledgeClient({ http }).query("How do I use Settings?"),
    ).rejects.toBeInstanceOf(KnowledgeClientError);
  });
  test("18: knowledge client rejects malformed Task 1 responses", async () => {
    const http = {
      post: jest.fn().mockResolvedValue({ data: { answer: "missing fields" } }),
    } as unknown as AxiosInstance;
    await expect(
      new KnowledgeClient({ http }).query("How do I use Settings?"),
    ).rejects.toBeInstanceOf(KnowledgeClientError);
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
    } as unknown as KnowledgeClient;
    const classification = classifyEmail(
      "How do I change settings?",
      "Please help.",
    );
    const draft = await new DraftingEngine(knowledgeClient).draft({
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
    } as unknown as KnowledgeClient;
    const classification = classifyEmail(
      "Refund request",
      "Please refund this charge.",
    );
    const draft = await new DraftingEngine(knowledgeClient).draft({
      subject: "Refund request",
      body: "Please refund this charge.",
      classification,
    });
    expect(draft).toMatchObject({ escalationRequired: true, risk: "high" });
    expect(draft.reviewFlags.length).toBeGreaterThan(0);
  });
});
