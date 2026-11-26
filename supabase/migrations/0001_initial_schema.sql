create extension if not exists pgcrypto;
create extension if not exists vector with schema extensions;
do $$ begin create type government_level as enum ('central','state','ut','private'); exception when duplicate_object then null; end $$;
do $$ begin create type verification_status as enum ('pending','verified','rejected','outdated'); exception when duplicate_object then null; end $$;
do $$ begin create type application_status as enum ('open','upcoming','closed','unknown'); exception when duplicate_object then null; end $$;
create table if not exists profiles(id uuid primary key references auth.users(id) on delete cascade, full_name text, email text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists student_profiles(user_id uuid primary key references profiles(id) on delete cascade, date_of_birth date, gender text, region_name text, district text, residence_type text, education_level text, course text, stream text, academic_year text, institution_name text, institution_type text, institution_state text, percentage numeric(5,2), family_income numeric(14,2), income_certificate_available boolean, social_categories text[] not null default '{}', disability boolean, orphan boolean, first_generation boolean, parent_occupation text, residence_mode text, previous_scholarship boolean, consent_fields text[] not null default '{}', updated_at timestamptz not null default now());
create table if not exists source_registry(id uuid primary key default gen_random_uuid(), name text not null, government_level government_level not null, region_name text, department text, source_url text not null unique, source_type text not null default 'official_website', is_official boolean not null default true, is_active boolean not null default true, crawl_permitted boolean not null default false, check_interval_days integer not null default 30 check(check_interval_days>0), last_checked_at timestamptz, last_success_at timestamptz, last_content_hash text, last_status text, notes text, created_at timestamptz not null default now());
create table if not exists scholarships(id uuid primary key default gen_random_uuid(), external_identifier text, name text not null, summary text, description text, category text, government_level government_level not null, state_name text, department text, target_categories text[] not null default '{}', education_levels text[] not null default '{}', eligible_courses text[] not null default '{}', min_age integer, max_age integer, annual_income_limit numeric(14,2), min_percentage numeric(5,2), gender_requirements text, caste_requirements text, disability_requirement text, institution_requirements text, other_conditions text, amount_min numeric(14,2), amount_max numeric(14,2), benefits text, application_start date, application_end date, required_documents text[] not null default '{}', application_procedure text, renewal_conditions text, official_url text, information_source_url text, source_id uuid references source_registry(id), last_verified_at timestamptz, application_status application_status not null default 'unknown', verification_status verification_status not null default 'pending', verified_by uuid references profiles(id), updated_at timestamptz not null default now(), created_at timestamptz not null default now(), search_document tsvector not null default ''::tsvector);
create or replace function public.set_scholarship_search_document() returns trigger language plpgsql set search_path=public as $$
begin
 new.search_document := to_tsvector('english'::regconfig, coalesce(new.name,'') || ' ' || coalesce(new.summary,'') || ' ' || coalesce(new.description,'') || ' ' || coalesce(new.state_name,'') || ' ' || coalesce(new.department,'') || ' ' || coalesce(new.category,'') || ' ' || coalesce(array_to_string(new.education_levels,' '),'') || ' ' || coalesce(array_to_string(new.eligible_courses,' '),'') || ' ' || coalesce(array_to_string(new.target_categories,' '),''));
 return new;
end; $$;
drop trigger if exists scholarships_search_document_trigger on public.scholarships;
create trigger scholarships_search_document_trigger before insert or update on public.scholarships for each row execute function public.set_scholarship_search_document();
create table if not exists scholarship_eligibility_rules(id uuid primary key default gen_random_uuid(), scholarship_id uuid not null references scholarships(id) on delete cascade, field_name text not null, operator text not null, expected_value jsonb, is_required boolean not null default true, source_note text, created_at timestamptz not null default now());
create table if not exists scholarship_documents(id uuid primary key default gen_random_uuid(), scholarship_id uuid not null references scholarships(id) on delete cascade, document_name text not null, requirement_type text not null check(requirement_type in ('required','optional','conditional')), format_requirements text, validity_requirements text, condition_text text, source_note text);
create table if not exists scholarship_sources(scholarship_id uuid not null references scholarships(id) on delete cascade, source_id uuid not null references source_registry(id), source_url text not null, source_type text not null, is_primary boolean not null default false, last_seen_at timestamptz, primary key(scholarship_id,source_id,source_url));
create table if not exists scholarship_updates(id uuid primary key default gen_random_uuid(), scholarship_id uuid not null references scholarships(id) on delete cascade, source_id uuid references source_registry(id), changed_fields jsonb not null default '{}', captured_at timestamptz not null default now(), reviewed_by uuid references profiles(id));
create table if not exists student_documents(id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id) on delete cascade, document_type text not null, storage_path text not null, masked_fields jsonb not null default '{}', uploaded_at timestamptz not null default now(), expires_at date, analysis_status text not null default 'pending');
create table if not exists saved_scholarships(user_id uuid not null references profiles(id) on delete cascade, scholarship_id uuid not null references scholarships(id) on delete cascade, created_at timestamptz not null default now(), primary key(user_id,scholarship_id));
create table if not exists applications(id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id) on delete cascade, scholarship_id uuid not null references scholarships(id) on delete cascade, status text not null default 'interested' check(status in ('interested','preparing_documents','ready_to_apply','applied','under_review','approved','rejected')), notes text, updated_at timestamptz not null default now(), unique(user_id,scholarship_id));
create table if not exists user_notification_preferences(user_id uuid primary key references profiles(id) on delete cascade, email_enabled boolean not null default true, push_enabled boolean not null default false, reminder_days integer[] not null default '{30,15,7,3,1}', new_scholarship_alerts boolean not null default true);
create table if not exists notifications(id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id) on delete cascade, scholarship_id uuid references scholarships(id) on delete cascade, notification_type text not null, scheduled_for timestamptz, sent_at timestamptz, dedupe_key text not null unique, payload jsonb not null default '{}', created_at timestamptz not null default now());
create table if not exists document_analysis(id uuid primary key default gen_random_uuid(), document_id uuid not null references student_documents(id) on delete cascade, extracted_fields jsonb not null default '{}', missing_fields text[] not null default '{}', warnings text[] not null default '{}', ocr_provider text, created_at timestamptz not null default now());
create table if not exists chatbot_conversations(id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id) on delete cascade, title text, created_at timestamptz not null default now());
create table if not exists chatbot_messages(id uuid primary key default gen_random_uuid(), conversation_id uuid not null references chatbot_conversations(id) on delete cascade, role text not null check(role in ('user','assistant')), content text not null, citations jsonb not null default '[]', created_at timestamptz not null default now());
create table if not exists scheme_embeddings(id uuid primary key default gen_random_uuid(), scholarship_id uuid not null references scholarships(id) on delete cascade, content text not null, embedding extensions.vector(768), source_url text, updated_at timestamptz not null default now());
create table if not exists admin_users(user_id uuid primary key references profiles(id) on delete cascade, role text not null default 'reviewer', created_at timestamptz not null default now());
create table if not exists ingestion_jobs(id uuid primary key default gen_random_uuid(), source_id uuid references source_registry(id), status text not null default 'queued', started_at timestamptz, finished_at timestamptz, records_seen integer not null default 0, records_added integer not null default 0, records_updated integer not null default 0, error_summary text, created_at timestamptz not null default now());
create unique index if not exists scholarships_external_identifier_unique on scholarships(external_identifier,government_level,coalesce(state_name,'')) where external_identifier is not null;
create index if not exists scholarships_search_idx on scholarships using gin(search_document);
create index if not exists scholarships_filter_idx on scholarships(government_level,state_name,application_status,verification_status,application_end);
create index if not exists scholarships_category_idx on scholarships using gin(target_categories);
create index if not exists scholarship_rules_scheme_idx on scholarship_eligibility_rules(scholarship_id);
create index if not exists ingestion_source_idx on ingestion_jobs(source_id,created_at desc);
create index if not exists notifications_due_idx on notifications(scheduled_for) where sent_at is null;
create index if not exists embeddings_hnsw_idx on scheme_embeddings using hnsw(embedding extensions.vector_cosine_ops);
create or replace function public.is_admin() returns boolean language sql security definer set search_path=public stable as $$ select exists(select 1 from admin_users where user_id=auth.uid()); $$;
alter table profiles enable row level security; alter table student_profiles enable row level security; alter table student_documents enable row level security; alter table saved_scholarships enable row level security; alter table applications enable row level security; alter table user_notification_preferences enable row level security; alter table notifications enable row level security; alter table chatbot_conversations enable row level security; alter table chatbot_messages enable row level security; alter table document_analysis enable row level security; alter table admin_users enable row level security;
alter table scholarships enable row level security; alter table scholarship_eligibility_rules enable row level security; alter table scholarship_documents enable row level security; alter table scholarship_sources enable row level security; alter table scholarship_updates enable row level security; alter table source_registry enable row level security; alter table ingestion_jobs enable row level security;
create policy "read public verified scholarships" on scholarships for select using(verification_status in ('verified','outdated') or public.is_admin()); create policy "admin manages scholarships" on scholarships for all using(public.is_admin()) with check(public.is_admin());
create policy "read scholarship rules" on scholarship_eligibility_rules for select using(exists(select 1 from scholarships s where s.id=scholarship_id and s.verification_status in ('verified','outdated')) or public.is_admin()); create policy "admin manages rules" on scholarship_eligibility_rules for all using(public.is_admin()) with check(public.is_admin());
create policy "read scholarship docs" on scholarship_documents for select using(exists(select 1 from scholarships s where s.id=scholarship_id and s.verification_status in ('verified','outdated')) or public.is_admin()); create policy "admin manages docs" on scholarship_documents for all using(public.is_admin()) with check(public.is_admin());
create policy "read own profile" on profiles for select using(id=auth.uid() or public.is_admin()); create policy "insert own profile" on profiles for insert with check(id=auth.uid()); create policy "update own profile" on profiles for update using(id=auth.uid()) with check(id=auth.uid());
create policy "manage own student profile" on student_profiles for all using(user_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or public.is_admin());
create policy "manage own documents" on student_documents for all using(user_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or public.is_admin());
create policy "manage own saved" on saved_scholarships for all using(user_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or public.is_admin());
create policy "manage own applications" on applications for all using(user_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or public.is_admin());
create policy "manage own notification preferences" on user_notification_preferences for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "read own notifications" on notifications for select using(user_id=auth.uid() or public.is_admin());
create policy "manage own conversations" on chatbot_conversations for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "messages in own conversations" on chatbot_messages for all using(exists(select 1 from chatbot_conversations c where c.id=conversation_id and c.user_id=auth.uid()) or public.is_admin()) with check(exists(select 1 from chatbot_conversations c where c.id=conversation_id and c.user_id=auth.uid()) or public.is_admin());
create policy "analysis for own documents" on document_analysis for all using(exists(select 1 from student_documents d where d.id=document_id and d.user_id=auth.uid()) or public.is_admin()) with check(exists(select 1 from student_documents d where d.id=document_id and d.user_id=auth.uid()) or public.is_admin());
create policy "admin registry access" on source_registry for all using(public.is_admin()) with check(public.is_admin()); create policy "admin ingestion access" on ingestion_jobs for all using(public.is_admin()) with check(public.is_admin());
create policy "admin access source links" on scholarship_sources for all using(public.is_admin()) with check(public.is_admin()); create policy "admin access updates" on scholarship_updates for all using(public.is_admin()) with check(public.is_admin()); create policy "admin table private" on admin_users for all using(user_id=auth.uid() or public.is_admin()) with check(public.is_admin());

alter table scheme_embeddings enable row level security;
create policy "admin manages embeddings" on scheme_embeddings for all using(public.is_admin()) with check(public.is_admin());

create or replace function public.handle_new_auth_user() returns trigger language plpgsql security definer set search_path=public,extensions as $$
begin insert into public.profiles(id,email,full_name) values(new.id,new.email,new.raw_user_meta_data->>'full_name') on conflict(id) do update set email=excluded.email; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_auth_user();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('student-documents','student-documents',false,8388608,array['application/pdf','image/png','image/jpeg']) on conflict(id) do update set public=false,file_size_limit=8388608,allowed_mime_types=array['application/pdf','image/png','image/jpeg'];
create policy "read own private student documents" on storage.objects for select to authenticated using(bucket_id='student-documents' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "upload own private student documents" on storage.objects for insert to authenticated with check(bucket_id='student-documents' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "delete own private student documents" on storage.objects for delete to authenticated using(bucket_id='student-documents' and (storage.foldername(name))[1]=auth.uid()::text);

alter table notifications add column if not exists read_at timestamptz;
create table if not exists web_push_subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles(id) on delete cascade,endpoint text not null unique,p256dh text not null,auth text not null,created_at timestamptz not null default now());
alter table web_push_subscriptions enable row level security;
create policy "manage own push subscriptions" on web_push_subscriptions for all using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table student_profiles add column if not exists nationality text; alter table student_profiles add column if not exists academic_status text;




create unique index if not exists scheme_embeddings_one_per_scheme on scheme_embeddings(scholarship_id);
create or replace function public.match_scheme_embeddings(query_embedding extensions.vector(768), match_count integer default 6)
returns table(scholarship_id uuid,scheme_name text,content text,source_url text,similarity double precision)
language sql stable security definer set search_path=public,extensions as $$
 select s.id,s.name,e.content,coalesce(s.information_source_url,s.official_url),1-(e.embedding <=> query_embedding)
 from public.scheme_embeddings e join public.scholarships s on s.id=e.scholarship_id
 where s.verification_status='verified' and e.embedding is not null
 order by e.embedding <=> query_embedding
 limit greatest(1,least(match_count,10));
$$;
revoke all on function public.match_scheme_embeddings(extensions.vector,integer) from public;
grant execute on function public.match_scheme_embeddings(extensions.vector,integer) to anon,authenticated,service_role;

insert into source_registry(name,government_level,region_name,department,source_url,source_type,is_official,is_active,crawl_permitted,notes) values
('myScheme national scheme directory','central',null,'Government of India','https://www.myscheme.gov.in/','official_portal',true,true,false,'Listed in the project brief; enable checking only after an admin reviews robots.txt and access terms.'),
('National Scholarship Portal','central',null,'Government of India','https://scholarships.gov.in/','official_portal',true,true,false,'Listed in the project brief; scholarship data not imported automatically.'),
('Karnataka State Scholarship Portal','state','Karnataka','Government of Karnataka','https://ssp.postmatric.karnataka.gov.in/','official_portal',true,true,false,'Listed in the project brief; regional source registry remains incomplete.'),
('All India Council for Technical Education','central',null,'AICTE','https://www.aicte-india.org/','official_website',true,true,false,'Listed in the project brief; scheme-specific extraction is not configured.'),
('University Grants Commission','central',null,'UGC','https://www.ugc.gov.in/','official_website',true,true,false,'Listed in the project brief; scheme-specific extraction is not configured.')
on conflict(source_url) do nothing;

-- Data API permissions are required in addition to the row-level security policies above.
grant usage on schema public to anon, authenticated, service_role;
grant select on public.scholarships, public.scholarship_eligibility_rules, public.scholarship_documents to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.student_profiles, public.saved_scholarships, public.applications, public.user_notification_preferences, public.chatbot_conversations, public.chatbot_messages, public.student_documents, public.document_analysis, public.admin_users, public.web_push_subscriptions to authenticated;
grant select on public.notifications to authenticated;
grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;



