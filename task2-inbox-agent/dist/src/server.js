"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.learner = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const classifier_1 = require("./email/classifier");
const learner_1 = require("./feedback/learner");
const zod_1 = require("zod");
const app = (0, express_1.default)();
exports.app = app;
app.use(express_1.default.json());
const learner = new learner_1.FeedbackLearner();
exports.learner = learner;
const ReviewRequestSchema = zod_1.z.object({
    category: classifier_1.ClassificationSchema.shape.category,
    action: zod_1.z.enum(["approved", "edited", "rejected"]),
    risk: classifier_1.ClassificationSchema.shape.risk,
    subject: zod_1.z.string().optional(),
    body: zod_1.z.string().optional(),
});
app.post("/review", (request, response) => {
    const parsed = ReviewRequestSchema.safeParse(request.body);
    if (!parsed.success) {
        response
            .status(400)
            .json({
            error: "Invalid review payload",
            details: parsed.error.flatten(),
        });
        return;
    }
    const stats = learner.record(parsed.data);
    response.json({ accepted: true, stats });
});
app.get("/stats", (_request, response) => {
    response.json({ categories: learner.all() });
});
app.post("/classify", (request, response) => {
    const subject = typeof request.body?.subject === "string" ? request.body.subject : "";
    const body = typeof request.body?.body === "string" ? request.body.body : "";
    response.json((0, classifier_1.classifyEmail)(subject, body));
});
const port = Number(process.env.PORT ?? 3000);
if (require.main === module) {
    app.listen(port, () => console.log(`Inbox Agent listening on http://127.0.0.1:${port}`));
}
