import * as z from "zod";

export const ScoreCategorySchema = z.enum([
  "dependencies",
  "security",
  "maintainability",
  "testing",
  "tooling",
]);

export type ScoreCategory = z.infer<typeof ScoreCategorySchema>;
