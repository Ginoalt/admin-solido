-- White-label: marca propia por cliente (nombre + logo) que se ve en su panel.
-- Correr en el SQL Editor del proyecto. Idempotente.
-- ⚠️ Corré esto ANTES de mergear el PR: el panel lee estas columnas para mostrar la marca
--    (si faltan, igual NO rompe: la lectura va aparte y cae a la marca por defecto).

alter table public.profesionales add column if not exists marca_nombre text;
alter table public.profesionales add column if not exists marca_logo_url text;
