-- Panel de Clientes y pagos: precio mensual y hasta cuándo está pago cada cliente.
-- Correr en el SQL Editor del proyecto. Idempotente.

alter table public.profesionales add column if not exists precio_mensual numeric(12, 2) not null default 0;
alter table public.profesionales add column if not exists pagado_hasta date;
