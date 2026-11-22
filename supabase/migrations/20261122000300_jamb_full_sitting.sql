-- Full JAMB UTME sitting (docs/08 mock, founder decision 2026-11-22):
-- English plus each student's 3 subjects in one timed sitting.
--  1. student_subjects: each student's exam subject combination, set by the centre.
--  2. assessments.format: 'single_subject' (every test so far) or 'jamb_utme'.
--     A jamb_utme sitting has no single subject; each attempt draws its questions
--     from the sitting's pool using the student's own subjects.

create table public.student_subjects (
  student_id      uuid not null references public.students(id) on delete cascade,
  subject_id      uuid not null references public.subjects(id),
  institution_id  uuid not null references public.institutions(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (student_id, subject_id)
);
create index on public.student_subjects (subject_id);
create index on public.student_subjects (institution_id);

alter table public.student_subjects enable row level security;

-- Read-only for signed-in users: the student themself, or staff who can see the student.
-- All writes go through server code with the service role after authorizeStaff().
create policy student_subjects_select on public.student_subjects for select to authenticated using (
  student_id in (select app.my_student_ids())
  or student_id in (select app.visible_student_ids())
);

alter table public.assessments
  add column format text not null default 'single_subject'
    check (format in ('single_subject', 'jamb_utme'));

alter table public.assessments alter column subject_id drop not null;

alter table public.assessments
  add constraint assessments_subject_required
    check (format = 'jamb_utme' or subject_id is not null);
