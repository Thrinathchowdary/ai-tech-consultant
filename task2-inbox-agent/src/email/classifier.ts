import { z } from "zod";

export const EmailCategorySchema = z.enum([
  "how-to",
  "troubleshooting",
  "project-request",
  "refund-cancellation",
  "complaint",
  "quote",
  "follow-up",
]);
export const UrgencySchema = z.enum(["low", "medium", "high"]);
export const RiskLevelSchema = z.enum(["low", "medium", "high"]);

export const ClassificationSchema = z.object({
  category: EmailCategorySchema,
  urgency: UrgencySchema,
  risk: RiskLevelSchema,
  reasons: z.array(z.string()).min(1),
});

export type EmailCategory = z.infer<typeof EmailCategorySchema>;
export type Urgency = z.infer<typeof UrgencySchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type Classification = z.infer<typeof ClassificationSchema>;

const categoryRules: Array<{ category: EmailCategory; terms: string[] }> = [
  {
    category: "refund-cancellation",
    terms: ["refund", "cancel", "cancellation", "chargeback", "money back"],
  },
  {
    category: "complaint",
    terms: [
      "complaint",
      "unacceptable",
      "disappointed",
      "terrible",
      "fraud",
      "lawyer",
      "lawsuit",
    ],
  },
  {
    category: "quote",
    terms: ["quote", "pricing", "price", "estimate", "cost", "budget"],
  },
  {
    category: "project-request",
    terms: [
      "project",
      "integration",
      "custom",
      "migration",
      "implementation",
      "build",
    ],
  },
  {
    category: "troubleshooting",
    terms: [
      "error",
      "failed",
      "failure",
      "broken",
      "not working",
      "issue",
      "bug",
      "cannot",
    ],
  },
  {
    category: "follow-up",
    terms: [
      "following up",
      "follow-up",
      "checking in",
      "any update",
      "status update",
      "as discussed",
    ],
  },
  {
    category: "how-to",
    terms: [
      "how do i",
      "how can i",
      "where do i",
      "help me",
      "steps",
      "enable",
      "set up",
      "setup",
    ],
  },
];

export function classifyEmail(subject: string, body: string): Classification {
  const text = `${subject} ${body}`.toLowerCase();
  const matched = categoryRules.find((rule) =>
    rule.terms.some((term) => text.includes(term)),
  );
  const category = matched?.category ?? "how-to";
  const highUrgency = [
    "urgent",
    "asap",
    "immediately",
    "down today",
    "outage",
    "legal",
    "lawsuit",
    "chargeback",
  ].some((term) => text.includes(term));
  const mediumUrgency = [
    "soon",
    "deadline",
    "blocked",
    "cannot",
    "not working",
    "disappointed",
  ].some((term) => text.includes(term));
  const highRisk =
    category === "refund-cancellation" ||
    category === "complaint" ||
    [
      "legal",
      "lawsuit",
      "chargeback",
      "unauthorized",
      "compliance",
      "contract",
    ].some((term) => text.includes(term));
  const mediumRisk =
    category === "quote" || category === "project-request" || mediumUrgency;

  return ClassificationSchema.parse({
    category,
    urgency: highUrgency ? "high" : mediumUrgency ? "medium" : "low",
    risk: highRisk ? "high" : mediumRisk ? "medium" : "low",
    reasons: [
      `Matched ${category} language`,
      highUrgency
        ? "Contains urgent language"
        : "No immediate outage or deadline detected",
      highRisk
        ? "Requires policy or human review"
        : mediumRisk
          ? "May need commercial review"
          : "Suitable for routine handling",
    ],
  });
}
