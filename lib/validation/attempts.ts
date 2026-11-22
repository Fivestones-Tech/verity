import { z } from "zod";

export const answerItemSchema = z.object({
  question_id: z.uuid(),
  selected_option_id: z.uuid().nullable(),
  seq: z.number().int().min(1).max(1_000_000),
  answered_at: z.iso.datetime({ offset: true }),
  time_spent_seconds: z.number().int().min(0).max(86_400).nullable().optional(),
});

export const saveAnswersSchema = z.object({
  answers: z.array(answerItemSchema).min(1).max(500),
});

export const submitSchema = z.object({
  submission_key: z.string().min(8).max(100),
  answers: z.array(answerItemSchema).max(500).default([]),
  reason: z.enum(["student", "timer"]).default("student"),
});

export type AnswerItem = z.infer<typeof answerItemSchema>;
