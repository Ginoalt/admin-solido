-- Tabla de tareas / seguimientos por lead.
-- Correr una vez en el SQL Editor del proyecto "Software".
create table if not exists public.tareas (
  id uuid primary key default gen_random_uuid(),
  profesional_id uuid not null references public.profesionales(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  titulo text not null,
  vence date,
  hecha boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.tareas enable row level security;

drop policy if exists acceso_tareas on public.tareas;
create policy acceso_tareas on public.tareas
  for all
  using (es_admin() or profesional_id = mi_profesional_id())
  with check (es_admin() or profesional_id = mi_profesional_id());
