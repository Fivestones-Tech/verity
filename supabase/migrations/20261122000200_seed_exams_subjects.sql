-- Reference data: examinations and launch subjects.
-- Launch subjects (founder decision 2026-11-22, supersedes the O3 default in docs/23):
-- the pilot centre has Science, Commercial and Arts students, so v1 covers 11 subjects.
-- Subjects are data: add more with a new migration, no code change needed.
-- Topics are NOT seeded: docs/18 requires them to come from the official syllabus,
-- entered by a subject specialist (or added by a centre and marked pending_verification).

insert into public.examinations (name, code) values
  ('JAMB/UTME', 'JAMB'),
  ('WAEC/WASSCE', 'WAEC')
on conflict (code) do nothing;

insert into public.subjects (examination_id, name, code)
select e.id, s.name, s.code
from public.examinations e
cross join (values
  ('Use of English', 'ENG'),
  ('Mathematics', 'MTH'),
  ('Physics', 'PHY'),
  ('Chemistry', 'CHM'),
  ('Biology', 'BIO'),
  ('Economics', 'ECO'),
  ('Government', 'GOV'),
  ('Commerce', 'COM'),
  ('Principles of Accounts', 'ACC'),
  ('Literature in English', 'LIT'),
  ('Christian Religious Studies', 'CRS')
) as s(name, code)
where e.code = 'JAMB'
on conflict (examination_id, code) do nothing;

insert into public.subjects (examination_id, name, code)
select e.id, s.name, s.code
from public.examinations e
cross join (values
  ('English Language', 'ENG'),
  ('Mathematics', 'MTH'),
  ('Physics', 'PHY'),
  ('Chemistry', 'CHM'),
  ('Biology', 'BIO'),
  ('Economics', 'ECO'),
  ('Government', 'GOV'),
  ('Commerce', 'COM'),
  ('Financial Accounting', 'ACC'),
  ('Literature-in-English', 'LIT'),
  ('Christian Religious Studies', 'CRS')
) as s(name, code)
where e.code = 'WAEC'
on conflict (examination_id, code) do nothing;
