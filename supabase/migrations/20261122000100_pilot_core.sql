-- Verity pilot core schema (Phase: tutorial-centre pilot, Jan 2027)
-- Implements the v1 slice of docs/05-database-schema.md needed for timed topic tests:
-- identity, institutions, classes, students, curriculum, question bank, assessments,
-- attempts, responses, topic performance and audit log.
--
-- Security model (docs/06):
--   * RLS is enabled on every table.
--   * Authenticated users get SELECT policies only. There are no INSERT/UPDATE/DELETE
--     policies for `authenticated`, so the browser can never write directly.
--   * All writes go through server code that first verifies the caller (auth.getUser)
--     and their membership, then uses the service role.
--   * Scope is always derived from auth.uid() + institution_memberships, never from a
--     client-supplied institution_id.
--   * Correct answers (question_options.is_correct) are readable by institution staff
--     only. Students receive questions through a server route that strips the key.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Identity & institutions
-- ---------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  phone       text,
  status      text not null default 'active' check (status in ('active','suspended','deactivated')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.platform_admins (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.institutions (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  -- short code students type at login, e.g. "BRIGHTSTAR"
  code           text not null unique check (code ~ '^[A-Z0-9]{3,12}$'),
  type           text not null check (type in ('school','tutorial_centre')),
  exam_focus     text not null default 'both' check (exam_focus in ('waec_only','jamb_only','both')),
  contact_email  text,
  contact_phone  text,
  location       text,
  status         text not null default 'trial' check (status in ('trial','active','payment_pending','suspended','cancelled')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.institution_memberships (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references public.institutions(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  role            text not null check (role in ('owner','admin','teacher','tutor','staff')),
  status          text not null default 'active' check (status in ('invited','active','suspended','removed')),
  created_at      timestamptz not null default now(),
  unique (institution_id, user_id, role)
);
create index on public.institution_memberships (user_id);
create index on public.institution_memberships (institution_id);

-- ---------------------------------------------------------------------------
-- Students & classes
-- ---------------------------------------------------------------------------

create table public.classes (
  id                uuid primary key default gen_random_uuid(),
  institution_id    uuid not null references public.institutions(id) on delete cascade,
  name              text not null,
  academic_session  text,
  status            text not null default 'active' check (status in ('active','archived')),
  created_at        timestamptz not null default now(),
  unique (institution_id, name)
);
create index on public.classes (institution_id);

create table public.class_teachers (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (class_id, user_id)
);
create index on public.class_teachers (user_id);

create table public.students (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid references public.profiles(id) on delete set null,
  institution_id   uuid references public.institutions(id) on delete cascade,
  full_name        text not null,
  student_number   text,
  class_id         uuid references public.classes(id) on delete set null,
  status           text not null default 'active' check (status in ('active','inactive','graduated','withdrawn','transferred')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (institution_id, student_number)
);
create index on public.students (profile_id);
create index on public.students (institution_id);
create index on public.students (class_id);

-- ---------------------------------------------------------------------------
-- Examination & curriculum
-- ---------------------------------------------------------------------------

create table public.examinations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text not null unique,
  status      text not null default 'active' check (status in ('active','inactive')),
  created_at  timestamptz not null default now()
);

create table public.subjects (
  id               uuid primary key default gen_random_uuid(),
  examination_id   uuid not null references public.examinations(id) on delete cascade,
  name             text not null,
  code             text not null,
  status           text not null default 'active' check (status in ('active','inactive')),
  created_at       timestamptz not null default now(),
  unique (examination_id, code)
);

create table public.topics (
  id                uuid primary key default gen_random_uuid(),
  subject_id        uuid not null references public.subjects(id) on delete cascade,
  parent_topic_id   uuid references public.topics(id) on delete cascade,
  -- null = platform topic (verified against the official syllabus, docs/18).
  -- set = a topic a centre added for its own questions; private to that centre.
  institution_id    uuid references public.institutions(id) on delete cascade,
  name              text not null,
  status            text not null default 'pending_verification'
                    check (status in ('active','pending_verification','inactive')),
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);
create unique index topics_unique_name on public.topics (
  subject_id,
  coalesce(institution_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(parent_topic_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(name));
create index on public.topics (institution_id);

-- ---------------------------------------------------------------------------
-- Question bank
-- ---------------------------------------------------------------------------

create table public.questions (
  id               uuid primary key default gen_random_uuid(),
  subject_id       uuid not null references public.subjects(id),
  topic_id         uuid not null references public.topics(id),
  examination_id   uuid not null references public.examinations(id),
  institution_id   uuid references public.institutions(id) on delete cascade, -- null = platform content
  question_type    text not null default 'mcq' check (question_type in ('mcq')),
  question_text    text not null,
  difficulty       text not null check (difficulty in ('easy','moderate','difficult')),
  explanation      text,
  source           text not null check (source in ('original','licensed','institution','expert_created')),
  year_reference   text,
  status           text not null default 'draft'
                   check (status in ('draft','review','approved','published','archived','flagged')),
  review_note      text,
  created_by       uuid references public.profiles(id) on delete set null,
  reviewed_by      uuid references public.profiles(id) on delete set null,
  reviewed_at      timestamptz,
  version          integer not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- docs/18: a person must not approve their own question
  constraint questions_no_self_review check (reviewed_by is null or created_by is null or reviewed_by <> created_by)
);
create index on public.questions (institution_id, status);
create index on public.questions (topic_id);
create index on public.questions (subject_id);

create table public.question_options (
  id            uuid primary key default gen_random_uuid(),
  question_id   uuid not null references public.questions(id) on delete cascade,
  option_key    text not null check (option_key in ('A','B','C','D')),
  option_text   text not null,
  is_correct    boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (question_id, option_key)
);
-- exactly one correct option per question is enforced at write time by server code
create unique index question_options_one_correct on public.question_options (question_id) where is_correct;

-- ---------------------------------------------------------------------------
-- Assessments
-- ---------------------------------------------------------------------------

create table public.assessments (
  id                uuid primary key default gen_random_uuid(),
  institution_id    uuid references public.institutions(id) on delete cascade,
  created_by        uuid references public.profiles(id) on delete set null,
  examination_id    uuid not null references public.examinations(id),
  subject_id        uuid not null references public.subjects(id),
  name              text not null,
  assessment_type   text not null check (assessment_type in ('diagnostic','practice','topic_test','mock','institutional')),
  duration_seconds  integer not null check (duration_seconds between 60 and 14400),
  -- denormalised so students can see it (assessment_questions is staff-only)
  question_count    integer not null default 0,
  attempt_limit     integer not null default 1 check (attempt_limit between 1 and 10),
  shuffle_questions boolean not null default true,
  shuffle_options   boolean not null default true,
  status            text not null default 'draft' check (status in ('draft','scheduled','active','completed','archived')),
  instructions      text,
  start_at          timestamptz,
  end_at            timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on public.assessments (institution_id, status);

create table public.assessment_questions (
  id              uuid primary key default gen_random_uuid(),
  assessment_id   uuid not null references public.assessments(id) on delete cascade,
  question_id     uuid not null references public.questions(id),
  position        integer not null,
  points          numeric not null default 1,
  created_at      timestamptz not null default now(),
  unique (assessment_id, question_id),
  unique (assessment_id, position)
);

-- An assignment row targets one class, one student, or (both null) every student in
-- the assessment's institution.
create table public.assessment_assignments (
  id              uuid primary key default gen_random_uuid(),
  assessment_id   uuid not null references public.assessments(id) on delete cascade,
  student_id      uuid references public.students(id) on delete cascade,
  class_id        uuid references public.classes(id) on delete cascade,
  assigned_by     uuid references public.profiles(id) on delete set null,
  due_at          timestamptz,
  created_at      timestamptz not null default now(),
  check (student_id is null or class_id is null)
);
create index on public.assessment_assignments (assessment_id);

-- ---------------------------------------------------------------------------
-- Attempts & responses
-- ---------------------------------------------------------------------------

create table public.assessment_attempts (
  id                  uuid primary key default gen_random_uuid(),
  assessment_id       uuid not null references public.assessments(id) on delete cascade,
  student_id          uuid not null references public.students(id) on delete cascade,
  attempt_number      integer not null default 1,
  started_at          timestamptz not null default now(),
  expires_at          timestamptz not null,
  submitted_at        timestamptz,
  status              text not null default 'in_progress'
                      check (status in ('in_progress','submitted','auto_submitted','abandoned')),
  -- per-attempt randomisation, fixed at start so resume shows the same order
  question_order      uuid[] not null,
  option_order        jsonb not null default '{}'::jsonb,
  submission_key      text,
  -- true when answers reached the server after time ran out (saved offline before expiry)
  synced_late         boolean not null default false,
  score               numeric,
  max_score           numeric,
  percentage          numeric,
  correct_count       integer,
  incorrect_count     integer,
  unanswered_count    integer,
  time_used_seconds   integer,
  created_at          timestamptz not null default now(),
  unique (assessment_id, student_id, attempt_number)
);
create index on public.assessment_attempts (student_id);
create index on public.assessment_attempts (assessment_id);

create table public.responses (
  id                    uuid primary key default gen_random_uuid(),
  attempt_id            uuid not null references public.assessment_attempts(id) on delete cascade,
  question_id           uuid not null references public.questions(id),
  selected_option_id    uuid references public.question_options(id),
  seq                   integer not null default 0,
  is_correct            boolean,
  points_awarded        numeric,
  time_spent_seconds    integer,
  answered_at           timestamptz,
  updated_at            timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create table public.topic_performance (
  id                    uuid primary key default gen_random_uuid(),
  student_id            uuid not null references public.students(id) on delete cascade,
  topic_id              uuid not null references public.topics(id),
  attempt_id            uuid not null references public.assessment_attempts(id) on delete cascade,
  questions_attempted   integer not null,
  questions_total       integer not null,
  correct_answers       integer not null,
  percentage            numeric not null,
  created_at            timestamptz not null default now(),
  unique (attempt_id, topic_id)
);
create index on public.topic_performance (student_id);

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id                uuid primary key default gen_random_uuid(),
  actor_user_id     uuid references public.profiles(id) on delete set null,
  institution_id    uuid references public.institutions(id) on delete set null,
  action            text not null,
  resource_type     text,
  resource_id       uuid,
  metadata          jsonb,
  created_at        timestamptz not null default now()
);
create index on public.audit_logs (institution_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Profile row for every auth user
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS helper functions (security definer to avoid policy recursion)
-- ---------------------------------------------------------------------------

create schema if not exists app;
grant usage on schema app to authenticated, anon;

create or replace function app.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

-- institutions where the caller is active staff (any role, or the given roles)
create or replace function app.staff_institutions(roles text[] default null) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select institution_id from public.institution_memberships
  where user_id = auth.uid() and status = 'active'
    and (roles is null or role = any(roles));
$$;

create or replace function app.my_student_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select id from public.students where profile_id = auth.uid();
$$;

-- student rows the caller may see as staff:
--   owner/admin: every student in their institution
--   teacher/tutor/staff: students in classes they teach
create or replace function app.visible_student_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select s.id from public.students s
  where s.institution_id in (
    select institution_id from public.institution_memberships
    where user_id = auth.uid() and status = 'active' and role in ('owner','admin'))
  union
  select s.id from public.students s
  join public.class_teachers ct on ct.class_id = s.class_id
  join public.institution_memberships m
    on m.institution_id = s.institution_id and m.user_id = auth.uid() and m.status = 'active'
  where ct.user_id = auth.uid();
$$;

-- assessments the caller (as a student) has been assigned
create or replace function app.my_assigned_assessment_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select aa.assessment_id
  from public.assessment_assignments aa
  join public.assessments a on a.id = aa.assessment_id
  join public.students s on s.profile_id = auth.uid() and s.institution_id = a.institution_id
  where a.status in ('active','completed')
    and (aa.student_id = s.id
         or aa.class_id = s.class_id
         or (aa.student_id is null and aa.class_id is null));
$$;

grant execute on function app.is_platform_admin(), app.staff_institutions(text[]), app.my_student_ids(), app.visible_student_ids(), app.my_assigned_assessment_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------

alter table public.profiles                enable row level security;
alter table public.platform_admins         enable row level security;
alter table public.institutions            enable row level security;
alter table public.institution_memberships enable row level security;
alter table public.classes                 enable row level security;
alter table public.class_teachers          enable row level security;
alter table public.students                enable row level security;
alter table public.examinations            enable row level security;
alter table public.subjects                enable row level security;
alter table public.topics                  enable row level security;
alter table public.questions               enable row level security;
alter table public.question_options        enable row level security;
alter table public.assessments             enable row level security;
alter table public.assessment_questions    enable row level security;
alter table public.assessment_assignments  enable row level security;
alter table public.assessment_attempts     enable row level security;
alter table public.responses               enable row level security;
alter table public.topic_performance       enable row level security;
alter table public.audit_logs              enable row level security;

-- ---------------------------------------------------------------------------
-- SELECT policies (no write policies: writes are server-only)
-- ---------------------------------------------------------------------------

create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or id in (select user_id from public.institution_memberships
            where institution_id in (select app.staff_institutions()))
  or id in (select profile_id from public.students where id in (select app.visible_student_ids()))
  or app.is_platform_admin()
);

create policy platform_admins_select on public.platform_admins for select to authenticated using (
  user_id = auth.uid()
);

create policy institutions_select on public.institutions for select to authenticated using (
  id in (select app.staff_institutions())
  or id in (select institution_id from public.students where profile_id = auth.uid())
  or app.is_platform_admin()
);

create policy memberships_select on public.institution_memberships for select to authenticated using (
  user_id = auth.uid()
  or institution_id in (select app.staff_institutions())
  or app.is_platform_admin()
);

create policy classes_select on public.classes for select to authenticated using (
  institution_id in (select app.staff_institutions())
  or id in (select class_id from public.students where profile_id = auth.uid())
);

create policy class_teachers_select on public.class_teachers for select to authenticated using (
  class_id in (select id from public.classes where institution_id in (select app.staff_institutions()))
);

create policy students_select on public.students for select to authenticated using (
  profile_id = auth.uid()
  or id in (select app.visible_student_ids())
);

create policy examinations_select on public.examinations for select to authenticated using (true);
create policy subjects_select on public.subjects for select to authenticated using (true);
create policy topics_select on public.topics for select to authenticated using (
  institution_id is null
  or institution_id in (select app.staff_institutions())
  or institution_id in (select institution_id from public.students where profile_id = auth.uid())
);

-- Questions: staff see their own institution's bank (any status) and published platform
-- content. Students never read the bank directly.
create policy questions_select on public.questions for select to authenticated using (
  institution_id in (select app.staff_institutions())
  or (institution_id is null and status = 'published' and exists (select app.staff_institutions()))
  or app.is_platform_admin()
);

-- Options carry the answer key: staff of the owning institution (or platform admins) only.
create policy question_options_select on public.question_options for select to authenticated using (
  question_id in (select id from public.questions
                  where institution_id in (select app.staff_institutions()))
  or (question_id in (select id from public.questions where institution_id is null and status = 'published')
      and exists (select app.staff_institutions()))
  or app.is_platform_admin()
);

create policy assessments_select on public.assessments for select to authenticated using (
  institution_id in (select app.staff_institutions())
  or id in (select app.my_assigned_assessment_ids())
);

-- assessment_questions reveal which questions are in a test; staff only.
create policy assessment_questions_select on public.assessment_questions for select to authenticated using (
  assessment_id in (select id from public.assessments where institution_id in (select app.staff_institutions()))
);

create policy assessment_assignments_select on public.assessment_assignments for select to authenticated using (
  assessment_id in (select id from public.assessments where institution_id in (select app.staff_institutions()))
);

create policy attempts_select on public.assessment_attempts for select to authenticated using (
  student_id in (select app.my_student_ids())
  or student_id in (select app.visible_student_ids())
);

create policy responses_select on public.responses for select to authenticated using (
  attempt_id in (select id from public.assessment_attempts
                 where student_id in (select app.my_student_ids())
                    or student_id in (select app.visible_student_ids()))
);

create policy topic_performance_select on public.topic_performance for select to authenticated using (
  student_id in (select app.my_student_ids())
  or student_id in (select app.visible_student_ids())
);

create policy audit_logs_select on public.audit_logs for select to authenticated using (
  institution_id in (select app.staff_institutions(array['owner','admin']))
  or app.is_platform_admin()
);

-- ---------------------------------------------------------------------------
-- Server-only write functions (service role). Atomic, so retries are safe.
-- ---------------------------------------------------------------------------

-- Upsert a batch of answers. Last write wins by client sequence number, never by
-- timestamp (docs/17). items: [{question_id, selected_option_id|null, seq, answered_at, time_spent_seconds}]
-- Caller (server code) has already checked ownership, attempt status, timing and
-- that each option belongs to its question.
create or replace function public.save_responses(p_attempt_id uuid, p_items jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into public.responses (attempt_id, question_id, selected_option_id, seq, answered_at, time_spent_seconds, updated_at)
  select p_attempt_id,
         (i->>'question_id')::uuid,
         nullif(i->>'selected_option_id','')::uuid,
         (i->>'seq')::integer,
         (i->>'answered_at')::timestamptz,
         nullif(i->>'time_spent_seconds','')::integer,
         now()
  from jsonb_array_elements(p_items) as i
  on conflict (attempt_id, question_id) do update
    set selected_option_id = excluded.selected_option_id,
        seq = excluded.seq,
        answered_at = excluded.answered_at,
        time_spent_seconds = excluded.time_spent_seconds,
        updated_at = now()
    where public.responses.seq < excluded.seq;
  get diagnostics n = row_count;
  return n;
end $$;

-- Close an attempt and store its server-computed result in one transaction.
-- Returns false if the attempt was already closed (idempotent submit).
create or replace function public.finalize_attempt(
  p_attempt_id uuid, p_status text, p_submitted_at timestamptz, p_submission_key text,
  p_score numeric, p_max_score numeric, p_percentage numeric,
  p_correct integer, p_incorrect integer, p_unanswered integer, p_time_used integer,
  p_questions jsonb, p_topics jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_student uuid;
begin
  if p_status not in ('submitted','auto_submitted') then
    raise exception 'invalid status %', p_status;
  end if;

  update public.assessment_attempts
     set status = p_status, submitted_at = p_submitted_at, submission_key = p_submission_key,
         score = p_score, max_score = p_max_score, percentage = p_percentage,
         correct_count = p_correct, incorrect_count = p_incorrect, unanswered_count = p_unanswered,
         time_used_seconds = p_time_used
   where id = p_attempt_id and status = 'in_progress'
  returning student_id into v_student;

  if v_student is null then
    return false;
  end if;

  -- every question gets a response row, including unanswered ones
  insert into public.responses (attempt_id, question_id, selected_option_id, seq, is_correct, points_awarded, updated_at)
  select p_attempt_id, (q->>'question_id')::uuid, nullif(q->>'selected_option_id','')::uuid, 0,
         (q->>'is_correct')::boolean, (q->>'points_awarded')::numeric, now()
  from jsonb_array_elements(p_questions) q
  on conflict (attempt_id, question_id) do update
    set is_correct = excluded.is_correct,
        points_awarded = excluded.points_awarded,
        selected_option_id = excluded.selected_option_id,
        updated_at = now();

  insert into public.topic_performance (student_id, topic_id, attempt_id, questions_attempted, questions_total, correct_answers, percentage)
  select v_student, (t->>'topic_id')::uuid, p_attempt_id, (t->>'questions_attempted')::integer,
         (t->>'questions_total')::integer, (t->>'correct_answers')::integer, (t->>'percentage')::numeric
  from jsonb_array_elements(p_topics) t;

  return true;
end $$;

revoke execute on function public.save_responses(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.finalize_attempt(uuid, text, timestamptz, text, numeric, numeric, numeric, integer, integer, integer, integer, jsonb, jsonb) from public, anon, authenticated;
grant usage on schema app to service_role;
grant execute on function public.save_responses(uuid, jsonb) to service_role;
grant execute on function public.finalize_attempt(uuid, text, timestamptz, text, numeric, numeric, numeric, integer, integer, integer, integer, jsonb, jsonb) to service_role;

-- Anonymous users get nothing. Make the default explicit for the API roles.
revoke insert, update, delete on all tables in schema public from anon, authenticated;
