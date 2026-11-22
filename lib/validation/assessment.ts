import { z } from "zod";

export const createAssessmentSchema = z.object({
  kind: z.enum(["topic_test", "mock"]).default("topic_test"),
  name: z.string().trim().min(3).max(120),
  subject_id: z.uuid(),
  // a mock uses the whole syllabus, so the server ignores topic_ids for it
  topic_ids: z.array(z.uuid()).max(30).default([]),
  question_count: z.coerce.number().int().min(1).max(200),
  duration_minutes: z.coerce.number().int().min(1).max(240),
  difficulties: z.array(z.enum(["easy", "moderate", "difficult"])).default([]),
  assign_to: z.array(z.string()).min(1), // "all" or class ids
  open_now: z.boolean().default(true),
  end_at: z.string().optional(),
  instructions: z.string().trim().max(2000).optional(),
}).refine((v) => v.kind === "mock" || v.topic_ids.length > 0, { path: ["topic_ids"], message: "Choose at least one topic." });

/** Full JAMB sitting: English + each student's 3 subjects. Sizes default to the real exam. */
export const createSittingSchema = z.object({
  name: z.string().trim().min(3).max(120),
  english_questions: z.coerce.number().int().min(1).max(60),
  other_questions: z.coerce.number().int().min(1).max(40),
  duration_minutes: z.coerce.number().int().min(1).max(240),
  assign_to: z.array(z.string()).min(1),
  open_now: z.boolean().default(true),
  end_at: z.string().optional(),
  instructions: z.string().trim().max(2000).optional(),
});
