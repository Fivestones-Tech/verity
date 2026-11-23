// End-to-end check of the pilot flow against a running app (default http://127.0.0.1:3000)
// and the local Supabase stack. Run: npm run build && npx next start, then npm run test:e2e
//
//  owner registers centre -> adds a teacher -> imports students (gets sign-in slips)
//  teacher imports questions -> owner reviews & publishes -> teacher builds a topic test
//  student (phone) signs in -> takes the test -> connection drops mid-test -> page reloads
//  offline -> answers kept -> reconnects -> submits -> result with topic breakdown -> mistakes
//  teacher sees the result.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require("playwright");
} catch {
  playwright = require("/opt/node-tools/node_modules/playwright");
}
const { chromium, devices } = playwright;

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const OUT = path.resolve(import.meta.dirname, "artifacts");
mkdirSync(OUT, { recursive: true });
const tag = Date.now().toString(36).toUpperCase().slice(-5);
const centreCode = `BRIGHT${tag}`.slice(0, 12);
const owner = { email: `owner.${tag.toLowerCase()}@example.test`, password: "Owner-pass-123" };
const teacherEmail = `teacher.${tag.toLowerCase()}@example.test`;

const log = (...a) => console.log("•", ...a);
function check(cond, msg) {
  if (!cond) throw new Error(`CHECK FAILED: ${msg}`);
  log("ok -", msg);
}

const browser = await chromium.launch();
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });

try {
  // ---------------- owner ----------------
  const ownerCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const o = await ownerCtx.newPage();
  await o.goto(`${BASE}/register/institution`);
  await o.waitForLoadState("networkidle");
  await o.fill("#centre_name", "Brightstar Tutorial Centre");
  await o.fill("#centre_code", centreCode);
  await o.selectOption("#exam_focus", "jamb_only");
  await o.fill("#full_name", "Mrs Funmi Adeyemi");
  await o.fill("#email", owner.email);
  await o.fill("#password", owner.password);
  await o.click("button[type=submit]");
  await o.waitForURL(`${BASE}/inst`);
  check(await o.getByText("Getting started").isVisible(), "owner lands on the centre overview");
  await shot(o, "01-centre-overview");

  await o.goto(`${BASE}/inst/staff`);
  await o.fill("#full_name", "Mr Chidi Nwosu");
  await o.fill("#email", teacherEmail);
  await o.getByRole("button", { name: "Add" }).click();
  const notice = o.getByText("Their first password is");
  await notice.waitFor();
  const teacherPassword = (await notice.locator("span.num").textContent()).trim();
  check(teacherPassword.length === 10, "teacher account created with a one-time password");

  await o.goto(`${BASE}/inst/students/import`);
  await o.setInputFiles("#file", path.join(import.meta.dirname, "fixtures/students.csv"));
  await o.getByRole("button", { name: "Check file" }).click();
  await o.getByText("students are ready to add").waitFor();
  await o.getByRole("button", { name: /Add 3 students/ }).click();
  await o.getByRole("button", { name: "Print sign-in slips" }).waitFor();
  await shot(o, "02-student-sign-in-slips");
  const slip = o.locator("div.break-inside-avoid").filter({ hasText: "Adaeze Okafor" });
  const studentPassword = (await slip.locator("dd").nth(2).textContent()).trim();
  check(/^[A-Z2-9]{8}$/.test(studentPassword), "student sign-in slip shows a password");

  // owner puts the teacher on JAMB Batch A so they can see those students' results
  await o.goto(`${BASE}/inst/classes`);
  await o.locator("section").filter({ hasText: "JAMB Batch A" }).getByRole("button", { name: /Mr Chidi Nwosu/ }).click();
  await o.waitForLoadState("networkidle");
  check(await o.locator("section").filter({ hasText: "JAMB Batch A" }).getByRole("button", { name: /✓ Mr Chidi Nwosu/ }).isVisible(), "teacher assigned to JAMB Batch A");

  // ---------------- teacher imports questions ----------------
  const teacherCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const t = await teacherCtx.newPage();
  await t.goto(`${BASE}/login`);
  await t.waitForLoadState("networkidle"); // wait for the form to hydrate
  await t.getByRole("tab", { name: "Teacher / admin" }).click();
  await t.fill("#email", teacherEmail);
  await t.fill("#password", teacherPassword);
  await t.getByRole("button", { name: "Sign in" }).click();
  await t.waitForURL(`${BASE}/inst`);
  await t.goto(`${BASE}/inst/questions/import`);
  await t.setInputFiles("#file", path.join(import.meta.dirname, "fixtures/maths-questions.csv"));
  await t.getByRole("button", { name: "Check file" }).click();
  await t.getByText("rows are ready to import").waitFor();
  const previewText = await t.locator("main").innerText();
  check(previewText.includes("12 of 14 rows are ready"), "preview: 12 good rows of 14");
  check(previewText.includes("correct_option must be A, B, C or D"), "preview explains the bad answer key");
  check(previewText.includes("duplicate of row 2 in this file"), "preview catches the duplicate");
  check(/new topics/i.test(previewText), "preview lists new topics before creating them");
  await shot(t, "03-question-import-preview");
  await t.getByLabel(/Yes, add these/).check();
  await t.getByRole("button", { name: /Import 12 questions/ }).click();
  await t.getByText("questions are waiting for review").waitFor();
  // teacher cannot review their own questions
  await t.goto(`${BASE}/inst/questions/review`);
  check(await t.getByText("Another teacher at your centre needs to review those").isVisible(), "author can't approve their own questions");

  // ---------------- owner reviews ----------------
  await o.goto(`${BASE}/inst/questions/review`);
  await shot(o, "04-review-question");
  for (let left = 12; left > 0; left--) {
    await o.getByText(`${left} waiting for you`).waitFor();
    await o.getByRole("button", { name: "Approve and publish" }).click();
    await (left > 1 ? o.getByText(`${left - 1} waiting for you`) : o.getByText("Nothing to review")).waitFor();
  }
  check(await o.getByText("Nothing to review").isVisible(), "owner approved all 12 questions");

  // ---------------- teacher builds a test ----------------
  await t.goto(`${BASE}/inst/assessments/new`);
  await t.getByLabel(/^Algebra/).check();
  await t.getByLabel(/^Statistics/).check();
  await t.fill("#question_count", "10");
  await t.fill("#duration_minutes", "15");
  await t.fill("#name", "Maths topic test 1");
  await shot(t, "05-test-builder");
  await t.getByRole("button", { name: "Create and open now" }).click();
  await t.waitForURL(/\/inst\/assessments\/[0-9a-f-]+\?created=1/);
  const testUrl = t.url().split("?")[0];
  const testId = testUrl.split("/").pop();
  check(await t.getByText("The test is open").isVisible(), "test created and opened");

  // ---------------- student on a phone ----------------
  const phone = await browser.newContext({
    ...devices["Pixel 7"],
    recordVideo: { dir: OUT, size: { width: 412, height: 915 } },
  });
  const s = await phone.newPage();
  await s.goto(`${BASE}/login`);
  await s.waitForLoadState("networkidle");
  await s.fill("#centre", centreCode.toLowerCase());
  await s.fill("#number", "vb001");
  await s.fill("#password", studentPassword);
  await s.getByRole("button", { name: "Sign in" }).click();
  await s.waitForURL(`${BASE}/app`);
  await shot(s, "06-student-home");
  await s.getByRole("link", { name: "Start" }).first().click();
  await s.getByRole("link", { name: "Begin" }).click();
  await s.waitForURL(/\/take$/);
  const sync = s.getByTestId("sync-state");
  await s.getByRole("timer").waitFor();

  // answer the first 4 questions online: always option A
  const answerCurrent = async (label) => {
    const opt = s.locator("fieldset label").filter({ has: s.locator(`span.num:text-is("${label}")`) });
    await opt.click();
  };
  for (let i = 0; i < 4; i++) {
    await answerCurrent("A");
    await s.getByRole("button", { name: "Next →" }).click();
  }
  await s.waitForFunction(() => document.querySelector("[data-testid=sync-state]")?.getAttribute("data-state") === "synced");
  check(true, "first answers synced");
  await shot(s, "07-taking-online-synced");

  // ---- connection drops ----
  await phone.setOffline(true);
  for (let i = 0; i < 3; i++) {
    await answerCurrent("B");
    await s.getByRole("button", { name: "Next →" }).click();
  }
  await s.waitForFunction(() => document.querySelector("[data-testid=sync-state]")?.getAttribute("data-state") === "offline");
  check((await sync.innerText()).includes("Offline"), "shows 'Offline — your answers are safe on this device'");
  await shot(s, "08-taking-offline");

  // ---- page reloads with no connection ----
  await s.reload();
  await s.getByRole("timer").waitFor();
  await s.getByRole("button", { name: /Question grid/ }).click();
  const answeredText = await s.getByRole("button", { name: /Question grid/ }).innerText();
  check(answeredText.includes("7/10"), `after an offline reload all 7 answers are still there (${answeredText.trim()})`);
  await shot(s, "09-offline-reload-answers-kept");
  await s.getByRole("button", { name: /Question grid/ }).click();

  // ---- back online ----
  await phone.setOffline(false);
  await s.evaluate(() => window.dispatchEvent(new Event("online")));
  await s.waitForFunction(() => document.querySelector("[data-testid=sync-state]")?.getAttribute("data-state") === "synced", null, { timeout: 40_000 });
  check(true, "reconnected and synced");

  await s.getByRole("button", { name: "Submit" }).click();
  const dialog = s.getByRole("dialog");
  check((await dialog.innerText()).includes("You answered 7 of 10"), "confirm shows 7 of 10 answered");
  check(await s.evaluate(() => document.activeElement?.textContent === "Go back"), "'Go back' has focus by default");
  await shot(s, "10-confirm-submit");
  await dialog.getByRole("button", { name: "Submit" }).click();
  await s.waitForURL(/\/app\/results\//, { timeout: 30_000 });
  await s.getByText("Result slip").waitFor();
  const resultText = await s.locator("main").innerText();
  check(/topics/i.test(resultText) && resultText.includes("Algebra") && resultText.includes("Statistics") && !resultText.includes("Indices"), "result shows a breakdown by main topic (subtopics rolled up)");
  check(/your next step/i.test(resultText), "result shows one next step");
  await shot(s, "11-result");
  await s.getByRole("link", { name: "Review your mistakes" }).click();
  await s.getByText("Correct answer").first().waitFor();
  await shot(s, "12-mistake-review");

  // database cross-check: exactly one attempt, 10 response rows, server-side score
  const { createClient } = require("@supabase/supabase-js");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: attempts } = await db.from("assessment_attempts").select("id, status, correct_count, incorrect_count, unanswered_count").eq("assessment_id", testId);
  check(attempts.length === 1, "exactly one attempt row");
  check(attempts[0].unanswered_count === 3 && attempts[0].correct_count + attempts[0].incorrect_count === 7, "server stored 7 answers and 3 blanks");
  const { count } = await db.from("responses").select("id", { count: "exact", head: true }).eq("attempt_id", attempts[0].id);
  check(count === 10, "no duplicate answer rows (10 questions, 10 rows)");

  // ---------------- teacher sees it ----------------
  await t.goto(testUrl);
  const teacherView = await t.locator("main").innerText();
  check(teacherView.includes("Adaeze Okafor") && teacherView.includes("Submitted"), "teacher sees the submitted result");
  await shot(t, "13-teacher-results");

  // ---------------- teacher sets a weekly mock (whole syllabus) ----------------
  await t.goto(`${BASE}/inst/assessments/new?kind=mock`);
  await t.waitForLoadState("networkidle");
  check((await t.inputValue("#duration_minutes")) === "30", "JAMB maths mock defaults to 30 minutes");
  check((await t.inputValue("#question_count")) === "12", "mock size capped at the 12 published questions");
  check((await t.inputValue("#name")).endsWith("mock"), "mock name suggested");
  await shot(t, "14-mock-builder");
  await t.getByRole("button", { name: "Create and open now" }).click();
  await t.waitForURL(/\/inst\/assessments\/[0-9a-f-]+\?created=1/);
  check((await t.locator("main").innerText()).toLowerCase().includes("· mock"), "mock created and labelled");
  await s.goto(`${BASE}/app`);
  await s.waitForLoadState("networkidle");
  check((await s.locator("main").innerText()).includes("· mock"), "student sees the mock on the home screen");
  await shot(s, "15-student-home-with-mock");

  // ---------------- full JAMB mock: English + the student's 3 subjects ----------------
  // Adaeze's subjects came from the spreadsheet (Mathematics; Physics; Chemistry).
  // Seed a few published English/Physics/Chemistry questions directly (maths came through the UI above).
  const { data: inst } = await db.from("institutions").select("id").eq("code", centreCode).single();
  const { data: staffRows } = await db.from("institution_memberships").select("user_id, role").eq("institution_id", inst.id);
  const ownerId = staffRows.find((r) => r.role === "owner").user_id;
  const teacherId = staffRows.find((r) => r.role !== "owner").user_id;
  const { data: jambSubs } = await db.from("subjects").select("id, code, examination_id, exam:examinations!inner(code)").eq("exam.code", "JAMB").in("code", ["ENG", "PHY", "CHM"]);
  for (const sub of jambSubs) {
    const { data: tp } = await db.from("topics").insert({ subject_id: sub.id, name: `${sub.code} basics`, institution_id: inst.id }).select().single();
    for (let i = 0; i < 2; i++) {
      const { data: q } = await db.from("questions").insert({ subject_id: sub.id, topic_id: tp.id, examination_id: sub.examination_id, institution_id: inst.id, question_text: `${sub.code} question ${i + 1}`, difficulty: "easy", source: "original", status: "published", created_by: teacherId, reviewed_by: ownerId }).select().single();
      await db.from("question_options").insert(["A", "B", "C", "D"].map((k) => ({ question_id: q.id, option_key: k, option_text: `${sub.code} option ${k}`, is_correct: k === "A" })));
    }
  }
  await t.goto(`${BASE}/inst/students`);
  await t.waitForLoadState("networkidle");
  check((await t.getByRole("row", { name: /Adaeze Okafor/ }).innerText()).includes("Chemistry, Mathematics, Physics"), "subjects from the spreadsheet show on the Students page");
  await t.goto(`${BASE}/inst/assessments/new?kind=jamb_full`);
  await t.waitForLoadState("networkidle");
  check((await t.inputValue("#english_questions")) === "60" && (await t.inputValue("#duration_minutes")) === "120", "full mock defaults to the real exam (60 English, 2 hours)");
  await t.fill("#english_questions", "2");
  await t.fill("#other_questions", "2");
  await shot(t, "16-full-jamb-builder");
  await t.getByRole("button", { name: "Create and open now" }).click();
  await t.waitForURL(/\/inst\/assessments\/[0-9a-f-]+\?created=1/);
  const sittingUrl = t.url().split("?")[0];
  check((await t.locator("main").innerText()).toLowerCase().includes("full jamb mock"), "full JAMB mock created");

  await s.goto(`${BASE}/app`);
  await s.waitForLoadState("networkidle");
  await s.getByRole("link", { name: "Start" }).first().click();
  await s.getByRole("link", { name: "Begin" }).click();
  await s.waitForURL(/\/take$/);
  const tabs = s.getByRole("navigation", { name: "Subjects" });
  await tabs.waitFor();
  const tabText = await tabs.innerText();
  check(/English/.test(tabText) && tabText.includes("Mathematics") && tabText.includes("Physics") && tabText.includes("Chemistry"), "test screen shows English + the student's 3 subjects");
  // answer the first English question correctly (option text ends in "A" for seeded ones)
  await s.getByText(/ENG option A/).first().click();
  await tabs.getByRole("button", { name: /Physics/ }).click();
  check((await s.locator("header.sticky").innerText()).includes("Physics · Q 1"), "subject tab jumps to that paper");
  await shot(s, "17-full-jamb-taking");
  await s.waitForFunction(() => document.querySelector("[data-testid=sync-state]")?.getAttribute("data-state") === "synced", null, { timeout: 40_000 });
  await s.getByRole("button", { name: "Submit" }).click();
  await s.getByRole("dialog").getByRole("button", { name: "Submit" }).click();
  await s.waitForURL(/\/app\/results\//, { timeout: 30_000 });
  await s.getByText("Result slip").waitFor();
  const sittingResult = await s.locator("main").innerText();
  check(sittingResult.includes("/ 400") && /JAMB-style score/.test(sittingResult), "result shows a JAMB score out of 400");
  await shot(s, "18-full-jamb-result");
  await t.goto(sittingUrl);
  check(/jamb score \/400/i.test(await t.locator("main").innerText()), "teacher sees JAMB scores");
  await shot(t, "19-full-jamb-teacher");

  await phone.close(); // flushes the video
  await ownerCtx.close();
  await teacherCtx.close();
  console.log("\nE2E PASSED. Screenshots and video in", OUT);
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
