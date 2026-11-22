import { beforeAll, describe, expect, it } from "vitest";
import { admin, makeCentre, type Centre } from "../support/fixtures";
import { createAssessment } from "@/lib/assessments/service";

/** One-subject mocks: the server picks topics from the whole syllabus, never from the form. */
let C: Centre;
let Other: Centre;
let geometryId: string;

beforeAll(async () => {
  C = await makeCentre("MOCKA");
  Other = await makeCentre("MOCKB");
  // a second topic in centre C with 3 published questions
  const { data: t } = await admin.from("topics").insert({ subject_id: C.subject.id, name: "Geometry MOCKA", institution_id: C.institution.id }).select().single();
  geometryId = t!.id;
  for (let i = 0; i < 3; i++) {
    await admin.from("questions").insert({
      subject_id: C.subject.id, topic_id: geometryId, examination_id: C.subject.examination_id, institution_id: C.institution.id,
      question_text: `Geo Q${i}`, difficulty: "easy", source: "original", status: "published", created_by: C.teacher.id, reviewed_by: C.owner.id,
    });
  }
});

const mock = (centre: Centre, extra: Partial<Parameters<typeof createAssessment>[1]> = {}) =>
  createAssessment(centre.staffCtx(centre.teacher, ["teacher"]), {
    kind: "mock", name: `Maths mock ${Math.random()}`, subject_id: centre.subject.id, topic_ids: [], question_count: 8, duration_minutes: 30,
    difficulties: [], assign_to: ["all"], open_now: true, ...extra,
  });

describe("weekly mocks", () => {
  it("draws from every topic of the subject and is saved as a mock", async () => {
    const id = await mock(C);
    const { data: a } = await admin.from("assessments").select("assessment_type, question_count").eq("id", id).single();
    expect(a).toMatchObject({ assessment_type: "mock", question_count: 8 });
    const { data: aq } = await admin.from("assessment_questions").select("question:questions(topic_id)").eq("assessment_id", id);
    const topics = new Set((aq ?? []).map((r) => (r.question as unknown as { topic_id: string }).topic_id));
    expect(topics).toEqual(new Set([C.topic.id, geometryId]));
  });

  it("ignores topic ids sent by the form, including another centre's", async () => {
    const id = await mock(C, { topic_ids: [Other.topic.id] });
    const { data: aq } = await admin.from("assessment_questions").select("question:questions(institution_id)").eq("assessment_id", id);
    expect((aq ?? []).every((r) => (r.question as unknown as { institution_id: string }).institution_id === C.institution.id)).toBe(true);
  });

  it("refuses a mock bigger than the published questions", async () => {
    await expect(mock(C, { question_count: 50 })).rejects.toMatchObject({ code: "not_enough_questions" });
  });
});
