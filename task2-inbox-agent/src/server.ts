import express, { Request, Response } from "express";
import { classifyEmail, ClassificationSchema } from "./email/classifier";
import { FeedbackLearner, ReviewAction } from "./feedback/learner";
import { z } from "zod";

const app = express();
app.use(express.json());

const learner = new FeedbackLearner();
const ReviewRequestSchema = z.object({
  category: ClassificationSchema.shape.category,
  action: z.enum(["approved", "edited", "rejected"]),
  risk: ClassificationSchema.shape.risk,
  subject: z.string().optional(),
  body: z.string().optional(),
});

app.post("/review", (request: Request, response: Response) => {
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

app.get("/stats", (_request: Request, response: Response) => {
  response.json({ categories: learner.all() });
});

app.post("/classify", (request: Request, response: Response) => {
  const subject =
    typeof request.body?.subject === "string" ? request.body.subject : "";
  const body = typeof request.body?.body === "string" ? request.body.body : "";
  response.json(classifyEmail(subject, body));
});

const port = Number(process.env.PORT ?? 3000);
if (require.main === module) {
  app.listen(port, () =>
    console.log(`Inbox Agent listening on http://127.0.0.1:${port}`),
  );
}

export { app, learner };
