-- "Telón": qué módulos/secciones ve cada cliente.
-- jsonb tipo { "chats": false, "agenda": true }. Si una clave falta, el módulo está ACTIVO
-- (por defecto se ve todo; apagar es opt-out). Correr una vez en el SQL Editor.
alter table public.profesionales
  add column if not exists modulos jsonb not null default '{}'::jsonb;
