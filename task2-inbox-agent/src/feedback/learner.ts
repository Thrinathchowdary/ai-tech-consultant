import { EmailCategory, RiskLevel } from "../email/classifier";

export type ReviewAction = "approved" | "edited" | "rejected";

export interface ReviewEvent {
  category: EmailCategory;
  action: ReviewAction;
  risk: RiskLevel;
}

export interface CategoryStats {
  category: EmailCategory;
  consecutiveUneditedApprovals: number;
  eligibleForAutonomousSending: boolean;
  totalApproved: number;
  totalEdited: number;
  totalRejected: number;
}

const categories: EmailCategory[] = [
  "how-to",
  "troubleshooting",
  "project-request",
  "refund-cancellation",
  "complaint",
  "quote",
  "follow-up",
];

export class FeedbackLearner {
  private readonly stats = new Map<EmailCategory, CategoryStats>();

  public constructor() {
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

  public record(event: ReviewEvent): CategoryStats {
    const current = this.get(event.category);
    if (event.action === "approved" && event.risk === "low") {
      current.totalApproved += 1;
      current.consecutiveUneditedApprovals += 1;
      current.eligibleForAutonomousSending =
        current.consecutiveUneditedApprovals >= 20;
    } else {
      if (event.action === "edited") current.totalEdited += 1;
      if (event.action === "rejected") current.totalRejected += 1;
      current.consecutiveUneditedApprovals = 0;
      current.eligibleForAutonomousSending = false;
    }
    return { ...current };
  }

  public get(category: EmailCategory): CategoryStats {
    const stats = this.stats.get(category);
    if (!stats) throw new Error(`Unknown category: ${category}`);
    return stats;
  }

  public all(): CategoryStats[] {
    return Array.from(this.stats.values()).map((stats) => ({ ...stats }));
  }
}
