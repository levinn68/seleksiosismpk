-- Jalankan sekali di Supabase Dashboard → SQL Editor → New query → Run.
-- Menyimpan peserta aktif agar pilihan Owner tersinkron dan tetap ada saat perangkat reconnect.
alter table public.judging_rooms
  add column if not exists active_participant_id text;

-- Realtime untuk UPDATE judging_rooms harus aktif agar perangkat kedua menerima perubahan.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'judging_rooms'
  ) then
    alter publication supabase_realtime add table public.judging_rooms;
  end if;
exception
  when duplicate_object then null;
end $$;
