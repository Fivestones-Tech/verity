# 05 — Database Schema

> This is a reference schema, not a final migration file. Field names and types are intentionally concrete so an agent can generate real migrations from it — but use judgment on exact PostgreSQL types/constraints during implementation. Treat every `institution_id` foreign key as an RLS enforcement point.

## Conventions

- Primary keys: `uuid`, default `gen_random_uuid()`
- Every table: `created_at timestamptz default now()`, and `updated_at timestamptz` where the row is mutable
- Soft-delete via `status` enum columns where history matters (e.g., students, questions) — avoid hard deletes on anything tied to historical assessment results
- Money stored as integer (kobo/lowest unit), never floating point

---

## Identity & Institutions

```sql
-- Supabase auth.users is the source of truth for login credentials.
-- profiles extends it with application-level data.

profiles
  id            uuid primary key references auth.users(id)
  full_name     text
  email         text
  phone         text
  avatar_url    text
  status        text  -- 'active' | 'suspended' | 'deactivated'
  created_at    timestamptz
  updated_at    timestamptz

institutions
  id                uuid primary key
  name              text not null
  type              text not null  -- 'school' | 'tutorial_centre'
  exam_focus        text not null default 'both'  -- 'waec_only' | 'jamb_only' | 'both'
  contact_email     text
  contact_phone     text
  location          text
  status            text  -- 'trial' | 'active' | 'payment_pending' | 'suspended' | 'cancelled'
  created_at        timestamptz
  updated_at        timestamptz

institution_memberships
  id                uuid primary key
  institution_id    uuid references institutions(id)
  user_id           uuid references profiles(id)
  role              text not null  -- 'owner' | 'admin' | 'teacher' | 'tutor' | 'staff'
  status            text  -- 'invited' | 'active' | 'suspended' | 'removed'
  created_at        timestamptz
  -- unique(institution_id, user_id, role) to prevent duplicate grants
```

## Students & Academic Structure

```sql
students
  id                uuid primary key
  profile_id        uuid references profiles(id)  -- nullable if institution-created before account claim
  institution_id    uuid references institutions(id)  -- nullable: independent students have no institution
  student_number    text  -- institution's own ID, distinct from platform id
  class_id          uuid references classes(id)
  status            text  -- 'active' | 'inactive' | 'graduated' | 'withdrawn' | 'transferred'
  created_at        timestamptz
  updated_at        timestamptz

classes
  id                uuid primary key
  institution_id    uuid references institutions(id)
  name              text not null      -- e.g. "SS3A", "JAMB Batch A"
  academic_session  text
  status            text
  created_at        timestamptz

class_memberships
  id          uuid primary key
  class_id    uuid references classes(id)
  student_id  uuid references students(id)
  created_at  timestamptz

class_teachers
  id          uuid primary key
  class_id    uuid references classes(id)
  user_id     uuid references profiles(id)
  created_at  timestamptz

-- Parent linking (v1 minimal — see docs/03-mvp-scope.md)
parent_links
  id            uuid primary key
  parent_id     uuid references profiles(id)
  student_id    uuid references students(id)
  status        text  -- 'pending' | 'active' | 'revoked'
  created_at    timestamptz
```

## Examination & Curriculum

```sql
examinations
  id          uuid primary key
  name        text not null   -- 'JAMB/UTME', 'WAEC/WASSCE'
  code        text unique
  status      text  -- 'active' | 'inactive'
  created_at  timestamptz

subjects
  id                uuid primary key
  examination_id    uuid references examinations(id)
  name              text not null
  code              text
  status            text
  created_at        timestamptz

topics
  id                uuid primary key
  subject_id        uuid references subjects(id)
  parent_topic_id   uuid references topics(id)  -- nullable, enables subtopic hierarchy
  name              text not null
  status            text
  created_at        timestamptz
```

## Question Bank

```sql
questions
  id                uuid primary key
  subject_id        uuid references subjects(id)
  topic_id          uuid references topics(id)
  examination_id    uuid references examinations(id)
  institution_id    uuid references institutions(id)  -- null = platform-owned content
  question_type     text  -- 'mcq' | 'true_false'  (v1 scope — see docs/03)
  question_text     text not null
  difficulty        text  -- 'easy' | 'moderate' | 'difficult'
  explanation        text
  source            text
  status            text  -- 'draft' | 'review' | 'approved' | 'published' | 'archived'
  created_by        uuid references profiles(id)
  reviewed_by       uuid references profiles(id)
  version           integer default 1
  created_at        timestamptz
  updated_at        timestamptz

question_options
  id            uuid primary key
  question_id   uuid references questions(id)
  option_key    text not null  -- 'A' | 'B' | 'C' | 'D'
  option_text   text not null
  is_correct    boolean not null default false
  created_at    timestamptz
```

## Assessments

```sql
assessments
  id                uuid primary key
  institution_id    uuid references institutions(id)  -- null = platform assessment, available to independent students
  created_by        uuid references profiles(id)
  examination_id    uuid references examinations(id)
  subject_id        uuid references subjects(id)
  name              text not null
  assessment_type   text  -- 'diagnostic' | 'practice' | 'topic_test' | 'mock' | 'institutional'
  duration_seconds  integer
  attempt_limit     integer default 1
  status            text  -- 'draft' | 'scheduled' | 'active' | 'completed' | 'archived'
  instructions      text
  start_at          timestamptz
  end_at            timestamptz
  created_at        timestamptz
  updated_at        timestamptz

assessment_questions
  id              uuid primary key
  assessment_id   uuid references assessments(id)
  question_id     uuid references questions(id)
  position        integer
  points          numeric default 1
  created_at      timestamptz

assessment_assignments
  id              uuid primary key
  assessment_id   uuid references assessments(id)
  student_id      uuid references students(id)  -- nullable if assigned to whole class
  class_id        uuid references classes(id)   -- nullable if assigned to individual student
  assigned_by     uuid references profiles(id)
  due_at          timestamptz
  created_at      timestamptz
```

## Attempts & Responses

```sql
assessment_attempts
  id                  uuid primary key
  assessment_id       uuid references assessments(id)
  student_id          uuid references students(id)
  started_at          timestamptz
  submitted_at        timestamptz
  status              text  -- 'in_progress' | 'submitted' | 'auto_submitted' | 'abandoned'
  score               numeric
  percentage          numeric
  time_used_seconds   integer
  created_at          timestamptz

responses
  id                    uuid primary key
  attempt_id            uuid references assessment_attempts(id)
  question_id           uuid references questions(id)
  selected_option_id    uuid references question_options(id)
  is_correct            boolean
  points_awarded        numeric
  time_spent_seconds    integer
  answered_at           timestamptz
```

## Intelligence Layer (see `docs/07-readiness-engine.md` for the calculation logic)

```sql
topic_performance
  id                    uuid primary key
  student_id            uuid references students(id)
  topic_id              uuid references topics(id)
  attempt_id            uuid references assessment_attempts(id)
  questions_attempted   integer
  correct_answers       integer
  percentage            numeric
  created_at            timestamptz

student_mastery
  id              uuid primary key
  student_id      uuid references students(id)
  topic_id        uuid references topics(id)
  mastery_score   numeric        -- 0-100
  mastery_label   text           -- 'needs_attention' | 'developing' | 'good' | 'strong'
  confidence      text           -- 'low' | 'moderate' | 'high'
  evidence_count  integer        -- number of questions this is based on — required for confidence calc
  last_assessed_at timestamptz
  updated_at       timestamptz

readiness_scores
  id                uuid primary key
  student_id        uuid references students(id)
  examination_id    uuid references examinations(id)
  score             numeric      -- 0-100
  label             text         -- see docs/07 for exact bands
  confidence        text         -- 'low' | 'moderate' | 'high'
  algorithm_version text         -- e.g. 'v1.0' — never silently recompute history with a new formula
  breakdown         jsonb        -- stores the component scores that produced this number, for explainability
  calculated_at     timestamptz
  -- NEVER overwrite old rows — this table is append-only, powering the readiness timeline

recommendations
  id            uuid primary key
  student_id    uuid references students(id)
  topic_id      uuid references topics(id)
  type          text    -- 'practice' | 'review' | 'diagnostic' | 'mock' | 'timed_practice'
  title         text
  reason        text    -- human-readable evidence, e.g. "Probability mastery is 46%"
  priority      text    -- 'high' | 'medium' | 'low'
  status        text    -- 'pending' | 'completed' | 'dismissed'
  created_at    timestamptz
  completed_at  timestamptz
```

## Billing

```sql
plans
  id                 uuid primary key
  name               text not null
  scope              text  -- 'individual' | 'institution'
  price_kobo         integer not null
  billing_interval   text  -- 'one_time' | 'annual'
  exam_scope         text  -- 'single_subject' | 'jamb' | 'waec' | 'both' | null (institutional flat plans)
  status             text
  created_at         timestamptz

subscriptions
  id                    uuid primary key
  user_id               uuid references profiles(id)      -- individual subscriptions
  institution_id        uuid references institutions(id)  -- institutional subscriptions
  plan_id               uuid references plans(id)
  status                text  -- 'active' | 'expired' | 'cancelled' | 'payment_pending' | 'payment_failed'
  starts_at             timestamptz
  ends_at               timestamptz
  provider              text
  provider_reference    text
  created_at            timestamptz
  updated_at            timestamptz

payments
  id                    uuid primary key
  subscription_id       uuid references subscriptions(id)
  user_id               uuid references profiles(id)
  institution_id        uuid references institutions(id)
  provider              text
  provider_reference    text unique  -- used for webhook idempotency
  amount_kobo           integer not null
  currency              text default 'NGN'
  status                text  -- 'pending' | 'success' | 'failed'
  paid_at               timestamptz
  created_at             timestamptz

feature_entitlements
  id            uuid primary key
  plan_id       uuid references plans(id)
  feature_key   text not null   -- see docs/09 for the canonical key list
  enabled       boolean default true
  limit_value   integer          -- nullable, for capped features
```

## Notifications & Audit

```sql
notifications
  id            uuid primary key
  user_id       uuid references profiles(id)
  type          text
  title         text
  message       text
  read_at       timestamptz
  created_at    timestamptz

audit_logs
  id                uuid primary key
  actor_user_id     uuid references profiles(id)
  institution_id    uuid references institutions(id)
  action            text        -- e.g. 'assessment.created', 'result.modified', 'role.changed'
  resource_type     text
  resource_id       uuid
  metadata          jsonb
  created_at        timestamptz
```

---

## RLS pattern — apply this shape to every institution-scoped table

Example for `students`:

```sql
-- A user can see a student row if:
-- (a) it's their own student profile, OR
-- (b) they hold an active membership in the student's institution with an authorized role

create policy "students_select" on students
for select using (
  profile_id = auth.uid()
  or institution_id in (
    select institution_id from institution_memberships
    where user_id = auth.uid() and status = 'active'
  )
);
```

Example for `assessment_attempts` (student sees own; teacher sees their class's students):

```sql
create policy "attempts_select" on assessment_attempts
for select using (
  student_id in (select id from students where profile_id = auth.uid())
  or exists (
    select 1 from students s
    join class_teachers ct on ct.class_id = s.class_id
    where s.id = assessment_attempts.student_id
    and ct.user_id = auth.uid()
  )
);
```

Replicate this pattern — direct ownership OR verified institutional relationship — for every table above that carries an `institution_id` or `student_id`. Never write a policy that trusts a client-supplied `institution_id`; always derive scope from `auth.uid()` and the membership tables.

## Migration discipline

- Every schema change is a versioned migration file, committed to version control
- Never run manual, undocumented changes against production
- When the readiness algorithm changes, bump `algorithm_version` in `readiness_scores` — never recalculate and overwrite historical rows silently (see `docs/07-readiness-engine.md`)
