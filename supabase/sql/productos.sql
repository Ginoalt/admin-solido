-- Módulo Productos / Stock (para comercios): catálogo + inventario por cliente.
-- Correr en el SQL Editor del proyecto. Seguro de correr de nuevo (idempotente).

create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  profesional_id uuid not null references public.profesionales(id) on delete cascade,
  nombre text not null,
  categoria text,
  sku text,
  precio numeric(12, 2) not null default 0,
  stock integer not null default 0,
  stock_minimo integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_productos_prof on public.productos (profesional_id);

-- RLS: el admin accede a todo; el cliente, solo a lo suyo Y solo si tiene el módulo
-- premium "productos" prendido (mismo patrón blindado que automatizaciones).
alter table public.productos enable row level security;
drop policy if exists acceso_productos on public.productos;
create policy acceso_productos on public.productos
  for all
  using (
    es_admin() or (
      profesional_id = mi_profesional_id()
      and coalesce((select (modulos ->> 'productos')::boolean
                    from public.profesionales where id = profesional_id), false)
    )
  )
  with check (
    es_admin() or (
      profesional_id = mi_profesional_id()
      and coalesce((select (modulos ->> 'productos')::boolean
                    from public.profesionales where id = profesional_id), false)
    )
  );
