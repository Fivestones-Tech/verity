import { z } from "zod";

export const createAssessmentSchema = z.object({
  name: z.string().trim().min(3).max(120),
  subject_id: z.uuid(),
  topic_ids: z.array(z.uuid()).min(1).max(30),
  question_count: z.coerce.number().int().min(1).max(200),
  duration_minutes: z.coerce.number().int().min(1).max(240),
  difficulties: z.array(z.enum(["easy", "moderate", "difficult"])).default([]),
  assign_to: z.array(z.string()).min(1), // "all" or class ids
  open_now: z.boolean().default(true),
  end_at: z.string().optional(),
  instructions: z.string().trim().max(2000).optional(),
});
