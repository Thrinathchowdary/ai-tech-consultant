"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedbackLearner = void 0;
const categories = [
    "how-to",
    "troubleshooting",
    "project-request",
    "refund-cancellation",
    "complaint",
    "quote",
    "follow-up",
];
class FeedbackLearner {
    stats = new Map();
    constructor() {
        for (const category of categories) {
            this.stats.set(category, {
                category,
                consecutiveUneditedApprovals: 0,
                eligibleForAutonomousSending: false,
                totalApproved: 0,
                totalEdited: 0,
                totalRejected: 0,
            });
        }
    }
    record(event) {
        const current = this.get(event.category);
        if (event.action === "approved" && event.risk === "low") {
            current.totalApproved += 1;
            current.consecutiveUneditedApprovals += 1;
            current.eligibleForAutonomousSending =
                current.consecutiveUneditedApprovals >= 20;
        }
        else {
            if (event.action === "edited")
                current.totalEdited += 1;
            if (event.action === "rejected")
                current.totalRejected += 1;
            current.consecutiveUneditedApprovals = 0;
            current.eligibleForAutonomousSending = false;
        }
        return { ...current };
    }
    get(category) {
        const stats = this.stats.get(category);
        if (!stats)
            throw new Error(`Unknown category: ${category}`);
        return stats;
    }
    all() {
        return Array.from(this.stats.values()).map((stats) => ({ ...stats }));
    }
}
exports.FeedbackLearner = FeedbackLearner;
