create extension if not exists vector;

alter table public.treinamento_bloco
  add column if not exists descritivo jsonb not null default '[]'::jsonb;

create table if not exists public.kb_chunk (
  id uuid primary key default gen_random_uuid(),
  origem_tipo text not null,
  modulo_id uuid not null references public.treinamento_modulo(id) on delete cascade,
  aula_id uuid references public.treinamento_aula(id) on delete cascade,
  bloco_id uuid references public.treinamento_bloco(id) on delete cascade,
  texto text not null,
  timestamp_video text,
  embedding vector(1536),
  atualizado_em timestamptz not null default now()
);

grant select on public.kb_chunk to authenticated;
grant all on public.kb_chunk to service_role;

alter table public.kb_chunk enable row level security;

create policy "kb_chunk leitura conforme visibilidade"
on public.kb_chunk for select to authenticated
using (
  exists (
    select 1 from public.treinamento_modulo m
    where m.id = kb_chunk.modulo_id
      and m.status = 'publicado'
      and (m.visibilidade = 'todos' or not public.is_representante(auth.uid()))
  )
);

create or replace function public.match_kb_chunks(
  p_embedding vector(1536),
  p_limit int default 8,
  p_ver_interno boolean default false
)
returns table (
  id uuid,
  origem_tipo text,
  modulo_id uuid,
  aula_id uuid,
  bloco_id uuid,
  texto text,
  timestamp_video text,
  similaridade float
)
language sql stable security definer set search_path = public as $$
  select c.id, c.origem_tipo, c.modulo_id, c.aula_id, c.bloco_id, c.texto,
         c.timestamp_video,
         1 - (c.embedding <=> p_embedding) as similaridade
  from public.kb_chunk c
  join public.treinamento_modulo m on m.id = c.modulo_id
  where c.embedding is not null
    and m.status = 'publicado'
    and (p_ver_interno or m.visibilidade = 'todos')
  order by c.embedding <=> p_embedding
  limit p_limit;
$$;

create table if not exists public.faq_pergunta (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  pergunta text not null,
  resposta text,
  fontes jsonb not null default '[]'::jsonb,
  encontrou_resposta boolean not null default false,
  criado_em timestamptz not null default now()
);

grant select, insert on public.faq_pergunta to authenticated;
grant all on public.faq_pergunta to service_role;

alter table public.faq_pergunta enable row level security;

create policy "usuario ve proprias perguntas e admin ve todas"
on public.faq_pergunta for select to authenticated
using (user_id = auth.uid() or public.is_admin_or_master(auth.uid()));

create policy "usuario registra propria pergunta"
on public.faq_pergunta for insert to authenticated
with check (user_id = auth.uid());