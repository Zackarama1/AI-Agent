-- Behavioural tests for the Collabify schema: run as real users through RLS.
-- Usage (against a disposable database with the migration applied):
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/rules.test.sql
\set ON_ERROR_STOP 1

-- Users (auth.users is managed by Supabase Auth in production)
insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'sam@student.leeds.ac.uk'),
  ('00000000-0000-0000-0000-00000000000b', 'founder@startup.io'),
  ('00000000-0000-0000-0000-00000000000c', 'other@student.ucl.ac.uk'),
  ('00000000-0000-0000-0000-00000000000d', 'notastudent@gmail.com'),
  ('00000000-0000-0000-0000-00000000000e', 'admin@collabify.co.uk');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid::text, false),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'email', (select email from auth.users where id = uid))::text, false);
$$;
create function pg_temp.expect_error(stmt text, label text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'EXPECTED FAILURE DID NOT HAPPEN: %', label;
exception when others then
  if sqlerrm like 'EXPECTED FAILURE%' then raise; end if;
  raise notice 'ok (blocked): % -> %', label, sqlerrm;
end $$;
create function pg_temp.check(cond boolean, label text) returns void language plpgsql as $$
begin
  if not cond then raise exception 'CHECK FAILED: %', label; end if;
  raise notice 'ok: %', label;
end $$;
grant execute on all functions in schema pg_temp to authenticated;

-- Onboarding
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
set role authenticated;
select pg_temp.expect_error($$select complete_onboarding('student', 'Not A Student')$$, 'student sign-up with a non-.ac.uk email');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select complete_onboarding('student', 'Sam Student', 'Leeds', 'CS', 'Year 2', array['React', 'Figma']);
select pg_temp.check((select verified_at is not null from student_private), 'student verified by .ac.uk sign-in');
select pg_temp.expect_error($$update student_private set payouts_enabled = true$$, 'student cannot flip payouts_enabled');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
set role authenticated;
select complete_onboarding('student', 'Other Student', 'UCL');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select complete_onboarding('business', 'Fay Founder', p_company_name => 'Startup Ltd');
select pg_temp.expect_error($$update businesses set plan = 'scale'$$, 'business cannot change its own plan');

-- Minimum rate: 10 hours needs >= £127.10
select pg_temp.expect_error($$insert into projects (business_id, title, category, brief, budget_pence, estimated_hours, skills)
  values (auth.uid(), 'Cheap logo', 'Design', 'A logo for our startup with a couple of concepts please.', 12000, 10, '{}')$$, 'budget below £12.71/hour');
insert into projects (business_id, title, category, brief, budget_pence, estimated_hours, skills)
  values (auth.uid(), 'Logo and brand kit', 'Design', 'A logo for our startup with a couple of concepts please.', 45000, 20, array['Figma']);
select pg_temp.expect_error($$insert into projects (business_id, title, category, brief, budget_pence, estimated_hours, featured)
  values (auth.uid(), 'Free featured', 'Design', 'Trying to feature a project without paying for it at all.', 45000, 20, true)$$, 'featured without paying');
reset role;

-- Students apply; applications are private
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
set role authenticated;
insert into applications (project_id, student_id, pitch) select id, auth.uid(), 'I design brands for societies and work in Figma.' from projects;
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
set role authenticated;
insert into applications (project_id, student_id, pitch) select id, auth.uid(), 'I would love to work on this project with you.' from projects;
select pg_temp.check((select count(*) from applications) = 1, 'students only see their own applications');
reset role;

-- Hire: fee by plan (Free = 12%) on top of the price
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select pg_temp.check((select count(*) from applications) = 2, 'business sees applicants to its project');
select hire_student((select id from applications where student_id = '00000000-0000-0000-0000-00000000000a'));
select pg_temp.check((select amount_pence = 45000 and fee_pence = 5400 and total_pence = 50400 from contracts), '£450 on Free: business pays £504, student gets £450');
select pg_temp.check((select status from applications where student_id = '00000000-0000-0000-0000-00000000000c') = 'declined', 'other applicants declined on hire');
select pg_temp.expect_error($$update contracts set status = 'released'$$, 'business cannot mark itself paid');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.expect_error($$select deliver_contract((select id from contracts), 'Here it is!', '{}')$$, 'deliver before payment is held');
reset role;

-- Stripe webhook (service role) marks it funded
update contracts set status = 'funded', funded_at = now();

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select deliver_contract((select id from contracts), 'Logo files attached, brand guide in the folder.', array['contract/logo.zip']);
select pg_temp.check((select auto_release_at between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour' from contracts), 'auto-release set 7 days after delivery');
insert into messages (contract_id, sender_id, body) select id, auth.uid(), 'Delivered!' from contracts;
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
set role authenticated;
select pg_temp.check((select count(*) from messages) = 0 and (select count(*) from contracts) = 0, 'non-parties cannot see the contract or its messages');
reset role;

-- release-payment (service role)
update contracts set status = 'released', released_at = now();

-- Blind reviews
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select submit_review((select id from contracts), 5::smallint, 'Great work');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.check((select count(*) from reviews) = 0, 'student cannot see the business review before submitting their own');
select submit_review((select id from contracts), 4::smallint, 'Clear brief');
select pg_temp.check((select count(*) from reviews) = 2, 'both reviews visible once both are in');
select pg_temp.check((select average from user_rating('00000000-0000-0000-0000-00000000000a')) = 5, 'rating counts revealed reviews');
reset role;

-- Admin
insert into profiles (id, role, full_name) values ('00000000-0000-0000-0000-00000000000e', 'admin', 'Admin');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e');
set role authenticated;
select pg_temp.check((admin_metrics() ->> 'fillRate')::numeric = 1, 'admin metrics: fill rate');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.expect_error($$select admin_metrics()$$, 'non-admins cannot read metrics');
reset role;
