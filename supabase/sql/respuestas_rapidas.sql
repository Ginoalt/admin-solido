-- Respuestas rápidas de la Bandeja: frases pre-armadas para contestar con un clic.
-- NO es premium: es una ayuda del inbox. Correr en el SQL Editor. Idempotente.

create table if not exists public.respuestas_rapidas (
  id uuid primary key default gen_random_uuid(),
  profesional_id uuid not null references public.profesionales(id) on delete cascade,
  texto text not null,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_respuestas_prof on public.respuestas_rapidas (profesional_id, orden);

alter table public.respuestas_rapidas enable row level security;
drop policy if exists acceso_respuestas on public.respuestas_rapidas;
create policy acceso_respuestas on public.respuestas_rapidas
  for all
  using (es_admin() or profesional_id = mi_profesional_id())
  with check (es_admin() or profesional_id = mi_profesional_id());
