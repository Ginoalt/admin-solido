-- Token único de webhook por cliente, para conectar SU Typebot a SU CRM.
-- Cada cliente (existente y nuevo) recibe un token distinto automáticamente.
-- Correr una vez en el SQL Editor del proyecto "Software".
alter table public.profesionales
  add column if not exists webhook_token text not null
  default replace(gen_random_uuid()::text, '-', '');
