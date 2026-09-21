import * as z from "zod";

export const ApiErrorSchema = z.strictObject({
  code: z.string(),
  message: z.string(),
});
