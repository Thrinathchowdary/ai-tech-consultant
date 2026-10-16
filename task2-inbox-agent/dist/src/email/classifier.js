"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClassificationSchema = exports.RiskLevelSchema = exports.UrgencySchema = exports.EmailCategorySchema = void 0;
exports.classifyEmail = classifyEmail;
const zod_1 = require("zod");
exports.EmailCategorySchema = zod_1.z.enum([
    "how-to",
    "troubleshooting",
    "project-request",
    "refund-cancellation",
    "complaint",
    "quote",
    "follow-up",
]);
exports.UrgencySchema = zod_1.z.enum(["low", "medium", "high"]);
exports.RiskLevelSchema = zod_1.z.enum(["low", "medium", "high"]);
exports.ClassificationSchema = zod_1.z.object({
    category: exports.EmailCategorySchema,
    urgency: exports.UrgencySchema,
    risk: exports.RiskLevelSchema,
    reasons: zod_1.z.array(zod_1.z.string()).min(1),
});
const categoryRules = [
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
function classifyEmail(subject, body) {
    const text = `${subject} ${body}`.toLowerCase();
    const matched = categoryRules.find((rule) => rule.terms.some((term) => text.includes(term)));
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
    const highRisk = category === "refund-cancellation" ||
        category === "complaint" ||
        [
            "legal",
            "lawsuit",
            "chargeback",
            "unauthorized",
            "compliance",
            "contract",
        ].some((term) => text.includes(term));
    const mediumRisk = category === "quote" || category === "project-request" || mediumUrgency;
    return exports.ClassificationSchema.parse({
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
