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
select pg_temp.expect_error($$insert into projects (business_id, title, category, brief, budget_pence, estimated_hours, featured_until)
  values (auth.uid(), 'Free featured', 'Design', 'Trying to feature a project without paying for it at all.', 45000, 20, now() + interval '30 days')$$, 'featured without paying (insert)');
select pg_temp.expect_error($$update projects set featured_until = now() + interval '30 days'$$, 'featured without paying (update)');
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

-- ===== Revisions, cancellations, withdrawals, featured listings =====
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
set role authenticated;
insert into projects (business_id, title, category, brief, budget_pence, estimated_hours, skills)
  values (auth.uid(), 'Landing page build', 'Development', 'A fast landing page with a waitlist form for our launch.', 60000, 30, array['React']);
insert into projects (business_id, title, category, brief, budget_pence, estimated_hours, skills)
  values (auth.uid(), 'Competitor research', 'Research', 'Map ten competitors and summarise their pricing for us.', 20000, 12, array['Research']);
select pg_temp.expect_error($$select extend_featured((select id from projects where title = 'Landing page build'), 7)$$, 'businesses cannot feature for free');
reset role;
select id as p2 from projects where title = 'Landing page build' \gset
select id as p3 from projects where title = 'Competitor research' \gset

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
set role authenticated;
insert into applications (project_id, student_id, pitch) values (:'p2', auth.uid(), 'I build landing pages in React every week.');
insert into applications (project_id, student_id, pitch) values (:'p3', auth.uid(), 'Research is my favourite kind of project.');
delete from applications where project_id = :'p3';
select pg_temp.check((select count(*) from applications where project_id = :'p3') = 0, 'student withdraws an application');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
set role authenticated;
insert into applications (project_id, student_id, pitch) values (:'p2', auth.uid(), 'I would love to build this page for you.');
reset role;

-- Hire Sam, then cancel before paying: project reopens, Other comes back
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select hire_student((select id from applications where project_id = :'p2' and student_id = '00000000-0000-0000-0000-00000000000a'));
select cancel_contract((select id from contracts where project_id = :'p2' and cancelled_at is null));
select pg_temp.check((select status from projects where id = :'p2') = 'open', 'cancelled hire reopens the project');
select pg_temp.check((select status from applications where project_id = :'p2' and student_id = '00000000-0000-0000-0000-00000000000c') = 'applied', 'auto-declined applicant restored');
select pg_temp.check((select status from applications where project_id = :'p2' and student_id = '00000000-0000-0000-0000-00000000000a') = 'shortlisted', 'cancelled student returns to the shortlist');
-- Hire Other instead: a second live contract on the same project is allowed after cancellation
select hire_student((select id from applications where project_id = :'p2' and student_id = '00000000-0000-0000-0000-00000000000c'));
select pg_temp.check((select count(*) from contracts where project_id = :'p2' and cancelled_at is null) = 1, 'one live contract per project');
select cancel_project(:'p3');
select pg_temp.check((select status from projects where id = :'p3') = 'cancelled', 'business cancels an open project');
reset role;

update contracts set status = 'funded', funded_at = now() where project_id = :'p2' and cancelled_at is null;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
set role authenticated;
select deliver_contract((select id from contracts where project_id = :'p2' and cancelled_at is null), 'First version is live on the preview link.', '{}');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select pg_temp.expect_error($$select cancel_contract((select id from contracts where project_id = (select id from projects where title = 'Landing page build') and cancelled_at is null))$$, 'cannot cancel a paid project');
select request_changes((select id from contracts where project_id = :'p2' and cancelled_at is null), 'Please make the hero image bigger and fix the form.');
select pg_temp.check((select status = 'funded' and auto_release_at is null and revision_count = 1 from contracts where project_id = :'p2' and cancelled_at is null), 'changes requested: payment held, auto-release paused');
select raise_issue((select id from contracts where project_id = :'p2' and cancelled_at is null), 'They have stopped replying to messages.');
select pg_temp.check((select issue_reason is not null and issue_raised_by = auth.uid() from contracts where project_id = :'p2' and cancelled_at is null), 'issue reason recorded');
reset role;

-- ===== Account deletion =====
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.expect_error($$select anonymise_user(auth.uid())$$, 'users cannot call anonymise_user directly');
reset role;
-- (as the service role, like the delete-account function)
select pg_temp.check(account_deletion_blocker('00000000-0000-0000-0000-00000000000c') is not null, 'deletion blocked while payment is held');
select pg_temp.expect_error($$select anonymise_user('00000000-0000-0000-0000-00000000000c')$$, 'cannot anonymise with payment held');
select anonymise_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select full_name = 'Deleted user' and deleted_at is not null from profiles where id = '00000000-0000-0000-0000-00000000000a'), 'deleted student anonymised');
select pg_temp.check(not exists (select 1 from student_private where id = '00000000-0000-0000-0000-00000000000a'), 'university email removed');
select pg_temp.check((select count(*) from contracts where student_id = '00000000-0000-0000-0000-00000000000a' and status = 'released') = 1, 'completed contracts kept for the business');
select pg_temp.check((select count(*) from reviews where reviewer_id = '00000000-0000-0000-0000-00000000000a') = 1, 'reviews kept');

-- ===== Notifications (run after the flows above, which fired the triggers) =====
-- Fay (business) got applicants, deliveries, completion; Other (student c) got hired, payment held, changes requested...
select pg_temp.check((select count(*) from notifications where user_id = '00000000-0000-0000-0000-00000000000b' and kind = 'application') >= 2, 'business told about new applicants');
select pg_temp.check(exists (select 1 from notifications where user_id = '00000000-0000-0000-0000-00000000000c' and kind = 'hired'), 'student told they are hired');
select pg_temp.check(exists (select 1 from notifications where user_id = '00000000-0000-0000-0000-00000000000c' and kind = 'funded' and title = 'Payment held: start work'), 'student told payment is held');
select pg_temp.check(exists (select 1 from notifications where user_id = '00000000-0000-0000-0000-00000000000c' and kind = 'changes'), 'student told changes were requested');
select pg_temp.check(exists (select 1 from notifications where user_id = '00000000-0000-0000-0000-00000000000c' and kind = 'filled'), 'auto-declined student told the project was filled');
select pg_temp.check(exists (select 1 from notifications where user_id = '00000000-0000-0000-0000-00000000000b' and kind = 'delivered'), 'business told work was delivered');
select pg_temp.check(exists (select 1 from notifications where kind = 'problem' and user_id = '00000000-0000-0000-0000-00000000000c'), 'other side told about a reported problem');
select pg_temp.check(exists (select 1 from notifications where kind = 'reviews'), 'both told when reviews are revealed');
select pg_temp.check(not exists (select 1 from notifications where user_id = '00000000-0000-0000-0000-00000000000a' and created_at > (select deleted_at from profiles where id = '00000000-0000-0000-0000-00000000000a')), 'deleted users get no new notifications');
select pg_temp.check((select title from notifications where kind = 'paid' limit 1) = 'You''ve been paid £450', 'paid notification shows the amount');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
set role authenticated;
select pg_temp.check((select bool_and(user_id = auth.uid()) from notifications), 'users only see their own notifications');
update notifications set read_at = now();
select pg_temp.check((select count(*) from notifications where read_at is null) = 0, 'users mark their notifications read');
select pg_temp.expect_error($$update notifications set title = 'hacked'$$, 'users cannot edit notification text');
select pg_temp.expect_error($$insert into notifications (user_id, kind, title) values (auth.uid(), 'x', 'fake')$$, 'users cannot create notifications');
insert into push_tokens (token, user_id, platform) values ('ExponentPushToken[test]', auth.uid(), 'ios');
reset role;
select pg_temp.check((select count(*) from net.calls) = 0, 'no push sent before go-live configures it');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select claim_push_token('ExponentPushToken[shared-phone]', 'ios');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
set role authenticated;
select claim_push_token('ExponentPushToken[shared-phone]', 'ios');
reset role;
select pg_temp.check((select user_id from push_tokens where token = 'ExponentPushToken[shared-phone]') = '00000000-0000-0000-0000-00000000000c', 'a shared phone belongs to the latest sign-in');
delete from push_tokens where token = 'ExponentPushToken[shared-phone]';
select configure_push('https://example.supabase.co/functions/v1/send-push', 'push-secret');
select notify('00000000-0000-0000-0000-00000000000c', 'test', 'Test push', '', '');
select notify('00000000-0000-0000-0000-00000000000b', 'test', 'No device', '', '');
select pg_temp.check((select count(*) from net.calls) = 1, 'push sent only for users with a device');
select pg_temp.check((select headers ->> 'x-push-secret' = 'push-secret' and body ? 'notification_id' from net.calls), 'push call carries the secret and notification id');

-- ===== Guard: no table-wide write access for app users beyond this allowlist =====
-- Supabase grants ALL on new tables by default; every migration that creates a table must revoke it.
select pg_temp.check(
  coalesce((select string_agg(table_name || ':' || privilege_type, ', ' order by table_name, privilege_type)
   from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('anon', 'authenticated')
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
     and (table_name, privilege_type) not in (('push_tokens', 'INSERT'), ('push_tokens', 'DELETE'), ('applications', 'DELETE'))), '') = '',
  'no unexpected table-wide write grants');
