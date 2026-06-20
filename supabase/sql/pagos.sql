-- Módulo Pagos & Forecast: cada lead puede tener un monto estimado de venta.
-- Correr en el SQL Editor del proyecto. Idempotente.
-- (No necesita RLS nueva: la columna vive en leads, que ya está protegida por su RLS.)

alter table public.leads
  add column if not exists valor numeric(12, 2) not null default 0;
