-- Módulo Automatizaciones: reglas que se disparan SOLAS.
-- v1: cuando entra un lead nuevo, o cuando un lead llega a una etapa, crea una tarea de seguimiento.
-- Correr en el SQL Editor del proyecto. Seguro de correr de nuevo (idempotente).

-- 1) Las reglas que define cada cliente.
create table if not exists public.reglas_automatizacion (
  id uuid primary key default gen_random_uuid(),
  profesional_id uuid not null references public.profesionales(id) on delete cascade,
  nombre text not null,
  activa boolean not null default true,
  -- Cuándo se dispara:
  evento text not null check (evento in ('lead_nuevo', 'lead_en_etapa')),
  etapa_id uuid references public.etapas_pipeline(id) on delete cascade, -- solo para 'lead_en_etapa'
  -- Qué hace (v1: crear una tarea de seguimiento):
  accion text not null default 'crear_tarea' check (accion in ('crear_tarea')),
  tarea_titulo text,                        -- título de la tarea (si vacío, se arma uno solo)
  tarea_dias integer not null default 1,    -- la tarea vence en N días
  created_at timestamptz not null default now()
);

create index if not exists idx_reglas_prof on public.reglas_automatizacion (profesional_id);

-- 2) RLS: cada cliente ve/edita sus reglas; el admin, todas. (Mismo patrón que tareas.)
alter table public.reglas_automatizacion enable row level security;
drop policy if exists acceso_reglas on public.reglas_automatizacion;
-- El admin accede a todo; el cliente, solo a lo suyo Y solo si tiene el módulo premium prendido.
create policy acceso_reglas on public.reglas_automatizacion
  for all
  using (
    es_admin() or (
      profesional_id = mi_profesional_id()
      and coalesce((select (modulos ->> 'automatizaciones')::boolean
                    from public.profesionales where id = profesional_id), false)
    )
  )
  with check (
    es_admin() or (
      profesional_id = mi_profesional_id()
      and coalesce((select (modulos ->> 'automatizaciones')::boolean
                    from public.profesionales where id = profesional_id), false)
    )
  );

-- 3) El motor: corre cuando se inserta un lead (lead_nuevo) o cuando cambia de etapa
--    (lead_en_etapa), y crea las tareas de las reglas activas que correspondan.
--    SECURITY DEFINER para poder escribir en tareas sin importar quién disparó el cambio
--    (el webhook, el typebot o el CRM). No toca leads => no se puede re-disparar en loop.
create or replace function public.fn_reglas_automatizacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_evento text;
begin
  if (tg_op = 'INSERT') then
    v_evento := 'lead_nuevo';
  elsif (tg_op = 'UPDATE' and new.etapa_id is distinct from old.etapa_id) then
    v_evento := 'lead_en_etapa';
  else
    return new;
  end if;

  -- Respetar el telón premium: si el cliente NO tiene el módulo prendido, no se ejecuta nada
  -- (aunque queden reglas viejas cargadas). Apagar el módulo frena las automatizaciones al toque.
  if not coalesce(
    (select (modulos ->> 'automatizaciones')::boolean
       from public.profesionales where id = new.profesional_id),
    false
  ) then
    return new;
  end if;

  for r in
    select * from public.reglas_automatizacion
    where profesional_id = new.profesional_id
      and activa = true
      and accion = 'crear_tarea'
      and evento = v_evento
      and (v_evento = 'lead_nuevo' or etapa_id = new.etapa_id)
  loop
    insert into public.tareas (profesional_id, lead_id, titulo, vence)
    values (
      new.profesional_id,
      new.id,
      coalesce(nullif(btrim(r.tarea_titulo), ''), 'Seguimiento de ' || coalesce(new.nombre, 'lead')),
      (now() + (r.tarea_dias || ' days')::interval)::date
    );
  end loop;

  return new;
end;
$$;

-- 4) Enganchar el motor a la tabla leads.
drop trigger if exists trg_reglas_lead_insert on public.leads;
create trigger trg_reglas_lead_insert
  after insert on public.leads
  for each row execute function public.fn_reglas_automatizacion();

drop trigger if exists trg_reglas_lead_update on public.leads;
create trigger trg_reglas_lead_update
  after update of etapa_id on public.leads
  for each row execute function public.fn_reglas_automatizacion();
