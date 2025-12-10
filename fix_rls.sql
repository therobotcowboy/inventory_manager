-- RLS FIX: Explicitly enable INSERTs
-- Sometimes "using (true)" isn't enough for INSERT checks.

drop policy if exists "Enable all access for anon" on audit_logs;
drop policy if exists "Enable all access for anon" on items;
drop policy if exists "Enable all access for anon" on locations;

create policy "Enable all access for anon" on audit_logs for all using (true) with check (true);
create policy "Enable all access for anon" on items for all using (true) with check (true);
create policy "Enable all access for anon" on locations for all using (true) with check (true);
