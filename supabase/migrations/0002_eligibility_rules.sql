alter table public.scholarships add column if not exists academic_year text;

alter table public.scholarship_eligibility_rules
  add column if not exists criterion_type text,
  add column if not exists criterion_value jsonb,
  add column if not exists is_mandatory boolean,
  add column if not exists condition_group text not null default 'default',
  add column if not exists condition_operator text not null default 'AND',
  add column if not exists group_operator text not null default 'AND',
  add column if not exists academic_year text,
  add column if not exists source_url text,
  add column if not exists verification_status text not null default 'needs_verification',
  add column if not exists last_verified_at timestamptz;

update public.scholarship_eligibility_rules
set criterion_type = coalesce(criterion_type, field_name),
    criterion_value = coalesce(criterion_value, expected_value),
    is_mandatory = coalesce(is_mandatory, is_required, true)
where criterion_type is null or criterion_value is null or is_mandatory is null;

alter table public.scholarship_eligibility_rules
  alter column is_mandatory set default true;

create index if not exists scholarship_rules_year_idx
  on public.scholarship_eligibility_rules(scholarship_id, academic_year, condition_group);
