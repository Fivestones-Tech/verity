# 22 — Glossary

Plain-language definitions so humans and agents use the same words.

| Term | Meaning |
|---|---|
| **Verity** | The product. A Lumio product. |
| **Lumio** | The company that builds Verity. |
| **JAMB / UTME** | Joint Admissions and Matriculation Board / Unified Tertiary Matriculation Examination — university entrance exam, computer-based. |
| **WAEC / WASSCE** | West African Examinations Council / West African Senior School Certificate Examination — secondary school leaving exam. |
| **CBT** | Computer-Based Test. |
| **Institution** | A school or tutorial centre using Verity. Also called a tenant. |
| **Tenant** | One institution's isolated slice of data. |
| **Tutorial centre** | A private exam-preparation centre (often JAMB-focused). |
| **Cohort / class / batch** | A group of students. Schools say class; tutorial centres say batch. |
| **Exam focus** | An institution's choice: `waec_only`, `jamb_only`, or `both`. |
| **Assessment** | A defined set of questions with rules (time, attempts). Types: diagnostic, practice, topic test, mock, institutional. |
| **Diagnostic** | First assessment that sets a student's starting point. |
| **Mock** | Full, timed, exam-condition simulation. |
| **Attempt** | One student's sitting of an assessment. Immutable once submitted. |
| **Response** | One answer to one question within an attempt. |
| **Topic performance** | Accuracy on a topic within one attempt. |
| **Mastery** | Estimate of how well a student understands a topic over time, with an evidence count. |
| **Evidence count** | How many questions a mastery/readiness figure is based on. |
| **Readiness** | Evidence-based 0–100 indicator of preparation, with a label and confidence. Never a prediction or guarantee. |
| **Confidence** | How much evidence supports the readiness figure: low / moderate / high. |
| **Coverage** | Share of the syllabus topics that have meaningful evidence. |
| **Consistency** | How stable a student's recent scores are. |
| **Recommendation / Next Best Action** | The single top suggested next step for a student. |
| **Intervention** | A teacher's targeted response to a weak topic or struggling students. |
| **Entitlement** | A feature a plan grants (e.g. `assessments.mock.unlimited`). Code checks entitlements, not plan names. |
| **Plan / Subscription / Payment** | What is sold / the active access period / the money transaction. Kept separate. |
| **RLS** | Row Level Security — database rules that stop users reading rows they shouldn't. |
| **Service role key** | Supabase key that bypasses RLS. Server-only, never in the browser. |
| **Webhook** | A server-to-server message from the payment provider confirming a payment. |
| **Idempotent** | Doing it twice has the same effect as doing it once (no duplicate attempts or charges). |
| **Outbox** | Local queue of answers waiting to sync to the server. |
| **Algorithm version** | Label on a readiness score saying which formula produced it (e.g. `v1.0`). |
| **Provenance** | Where a question came from (original, licensed, institution, expert_created). |
| **Out of scope** | Deliberately not built in v1 (`docs/03-mvp-scope.md`). |
