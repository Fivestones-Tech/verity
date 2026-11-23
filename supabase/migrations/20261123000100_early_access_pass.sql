-- Early Access pass (founder decisions 2026-11-23, docs/09 "Early Access", D25–D29).
--
-- One pass = a full year of JAMB + WAEC practice for one student.
--   * Through a tutorial centre: ₦500. During early access the centre collects cash and
--     pays Verity offline; a Verity platform admin then turns passes on (source 'centre_cash').
--   * On their own: ₦1,000, paid online with Paystack (source 'online_payment'). This is
--     the price for anyone who pays online, with or without a centre (D30).
-- Students can sign up themselves: without a centre code they join Verity's online
-- centre; with a centre code they wait for that centre to approve them (join request).
-- Without a pass a student gets a free trial of one single-subject test (enforced in
-- server code, lib/entitlements/pass.ts).
--
-- Security model is the same as the pilot core: RLS on, SELECT-only policies for
-- `authenticated`, every write through server code with the service role.
-- Money is integer kobo.

create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.students(id) on delete cascade,
  institution_id  uuid references public.institutions(id) on delete set null,
  provider        text not null check (provider in ('paystack')),
  -- our reference, sent to the provider and echoed back by its webhook
  reference       text not null unique,
  plan_key        text not null check (plan_key in ('early_access_centre','early_access_solo')),
  amount_kobo     integer not null check (amount_kobo > 0),
  currency        text not null default 'NGN' check (currency = 'NGN'),
  status          text not null default 'pending' check (status in ('pending','success','failed','abandoned')),
  paid_at         timestamptz,
  verified_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.payments (student_id);
create index on public.payments (institution_id);

create table public.student_passes (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.students(id) on delete cascade,
  institution_id  uuid references public.institutions(id) on delete set null,
  plan_key        text not null check (plan_key in ('early_access_centre','early_access_solo')),
  exam_scope      text not null default 'both' check (exam_scope in ('jamb','waec','both')),
  source          text not null check (source in ('centre_cash','online_payment','free_pilot')),
  amount_kobo     integer not null check (amount_kobo >= 0),
  -- set for online payments; unique so one payment can never grant two passes
  payment_id      uuid unique references public.payments(id) on delete set null,
  starts_at       timestamptz not null default now(),
  ends_at         timestamptz not null,
  status          text not null default 'active' check (status in ('active','revoked')),
  granted_by      uuid references public.profiles(id) on delete set null,
  note            text,
  created_at      timestamptz not null default now(),
  check (ends_at > starts_at),
  check (source <> 'online_payment' or payment_id is not null)
);
create index on public.student_passes (student_id, ends_at desc);
create index on public.student_passes (institution_id);

-- Join request: a self-registered student who typed a centre code. Until the centre
-- approves, institution_id stays null, so RLS shows them none of that centre's data.
alter table public.students
  add column requested_institution_id uuid references public.institutions(id) on delete cascade;
alter table public.students
  add constraint students_request_or_member check (requested_institution_id is null or institution_id is null);
create index on public.students (requested_institution_id) where requested_institution_id is not null;

alter table public.payments       enable row level security;
alter table public.student_passes enable row level security;

-- A student sees their own payments. Centre staff don't need payment rows; platform admins do.
create policy payments_select on public.payments for select to authenticated using (
  student_id in (select app.my_student_ids())
  or app.is_platform_admin()
);

-- A student sees their own pass; centre staff see passes of students they can see.
create policy student_passes_select on public.student_passes for select to authenticated using (
  student_id in (select app.my_student_ids())
  or student_id in (select app.visible_student_ids())
  or app.is_platform_admin()
);

-- Turn an online payment into a pass, once. Server code calls this only after it has
-- verified the transaction with Paystack (signature-checked webhook or the verify API)
-- and checked the amount. Returns false if the payment was already activated or the
-- amount doesn't match what we asked for, so webhook retries and the return page racing
-- each other are safe.
create or replace function public.activate_online_pass(
  p_payment_id uuid, p_amount_kobo integer, p_paid_at timestamptz, p_ends_at timestamptz)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v public.payments%rowtype;
begin
  update public.payments
     set status = 'success', paid_at = p_paid_at, verified_at = now(), updated_at = now()
   where id = p_payment_id and status <> 'success' and amount_kobo = p_amount_kobo
  returning * into v;
  if v.id is null then
    return false;
  end if;

  insert into public.student_passes (student_id, institution_id, plan_key, source, amount_kobo, payment_id, starts_at, ends_at)
  values (v.student_id, v.institution_id, v.plan_key, 'online_payment', v.amount_kobo, v.id, now(), p_ends_at);
  return true;
end $$;

revoke execute on function public.activate_online_pass(uuid, integer, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.activate_online_pass(uuid, integer, timestamptz, timestamptz) to service_role;

revoke insert, update, delete on public.payments, public.student_passes from anon, authenticated;
