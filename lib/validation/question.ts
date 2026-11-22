import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);

export const questionFormSchema = z
  .object({
    subject_id: z.uuid(),
    topic_id: z.uuid().optional().or(z.literal("")),
    new_topic: z.string().trim().max(120).optional().or(z.literal("")),
    question_text: text(4000),
    option_a: text(1000),
    option_b: text(1000),
    option_c: text(1000),
    option_d: text(1000),
    correct_option: z.enum(["A", "B", "C", "D"]),
    difficulty: z.enum(["easy", "moderate", "difficult"]),
    explanation: z.string().trim().max(4000).optional().or(z.literal("")),
    source: z.enum(["original", "licensed", "institution", "expert_created"]),
  })
  .refine((v) => Boolean(v.topic_id) || Boolean(v.new_topic), { message: "Choose a topic or type a new one", path: ["topic_id"] })
  .refine(
    (v) => {
      const o = [v.option_a, v.option_b, v.option_c, v.option_d].map((s) => s.toLowerCase().replace(/\s+/g, " "));
      return new Set(o).size === 4;
    },
    { message: "Two or more options are the same", path: ["option_a"] },
  );

export type QuestionForm = z.infer<typeof questionFormSchema>;

export const reviewSchema = z.object({
  question_id: z.uuid(),
  decision: z.enum(["approve", "send_back"]),
  note: z.string().trim().max(1000).optional(),
});
