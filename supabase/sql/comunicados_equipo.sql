-- Módulo Equipo + Comunicados (premium): el equipo de un cliente se comunica adentro del CRM.
-- Correr en el SQL Editor del proyecto. Seguro de correr de nuevo (idempotente).

-- 1) El muro de comunicados del workspace.
create table if not exists public.comunicados (
  id uuid primary key default gen_random_uuid(),
  profesional_id uuid not null references public.profesionales(id) on delete cascade,
  autor_id uuid,
  autor_nombre text,
  contenido text not null,
  fijado boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_comunicados_prof on public.comunicados (profesional_id, created_at desc);

-- RLS: el admin todo; el equipo del workspace, lo suyo Y solo si tiene el módulo premium "equipo".
alter table public.comunicados enable row level security;
drop policy if exists acceso_comunicados on public.comunicados;
create policy acceso_comunicados on public.comunicados
  for all
  using (
    es_admin() or (
      profesional_id = mi_profesional_id()
      and coalesce((select (modulos ->> 'equipo')::boolean
                    from public.profesionales where id = profesional_id), false)
    )
  )
  with check (
    es_admin() or (
      profesional_id = mi_profesional_id()
      and coalesce((select (modulos ->> 'equipo')::boolean
                    from public.profesionales where id = profesional_id), false)
    )
  );

-- 2) Listar los miembros del equipo SIN tocar el RLS de perfiles (evita riesgo sobre el login).
--    SECURITY DEFINER: corre con permisos del dueño y filtra por el workspace del que llama.
--    El admin puede pasar un profesional_id para ver el equipo de un cliente puntual.
create or replace function public.miembros_equipo(p_profesional_id uuid default null)
returns table (id uuid, nombre text, email text, rol text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.nombre, p.email, p.rol
  from public.perfiles p
  where p.profesional_id = case
    when es_admin() and p_profesional_id is not null then p_profesional_id
    else mi_profesional_id()
  end
  order by p.nombre nulls last;
$$;

grant execute on function public.miembros_equipo(uuid) to authenticated;
