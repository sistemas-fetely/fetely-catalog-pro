create table if not exists public.frete_uf (
  uf text primary key,
  percentual numeric not null default 0,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);

grant select on public.frete_uf to authenticated;
grant insert, update, delete on public.frete_uf to authenticated;
grant all on public.frete_uf to service_role;

alter table public.frete_uf enable row level security;

create policy "frete_uf_select_auth" on public.frete_uf for select to authenticated using (true);
create policy "frete_uf_insert_admin" on public.frete_uf for insert to authenticated with check (public.is_admin_or_master(auth.uid()));
create policy "frete_uf_update_admin" on public.frete_uf for update to authenticated using (public.is_admin_or_master(auth.uid())) with check (public.is_admin_or_master(auth.uid()));
create policy "frete_uf_delete_admin" on public.frete_uf for delete to authenticated using (public.is_admin_or_master(auth.uid()));

insert into public.frete_uf (uf, percentual, ativo, atualizado_por) values
  ('SP', 7, true, 'seed-v20'), ('RJ', 7, true, 'seed-v20'),
  ('PR', 10, true, 'seed-v20'), ('RS', 10, true, 'seed-v20'),
  ('SC', 5, true, 'seed-v20'), ('DF', 9, true, 'seed-v20'),
  ('MT', 10, true, 'seed-v20'), ('AM', 21, true, 'seed-v20'),
  ('TO', 19, true, 'seed-v20'), ('AP', 19, true, 'seed-v20'),
  ('PE', 26, true, 'seed-v20'), ('PB', 26, true, 'seed-v20'),
  ('CE', 26, true, 'seed-v20'), ('MA', 26, true, 'seed-v20'),
  ('RN', 26, true, 'seed-v20'), ('AL', 26, true, 'seed-v20')
on conflict (uf) do nothing;

alter table public.regras_gerais add column if not exists frete_fallback_percent numeric not null default 5;