-- Recordatorios automáticos de turnos. Correr en el SQL Editor.
-- (Seguro de correr de nuevo: usa "if not exists".)

-- 1) Marca para no enviar dos veces el mismo recordatorio.
alter table public.citas
  add column if not exists recordatorio_enviado_at timestamptz;

-- 2) Extensiones que usa el cron (en Supabase ya suelen estar disponibles).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 3) Programar el "reloj": cada 15 min llama a la Edge Function recordatorios-cron.
--    ⚠️ REEMPLAZÁ  PEGA_TU_CRON_SECRET  por el MISMO valor que cargues en Secrets (CRON_SECRET).
select cron.schedule(
  'recordatorios-turnos',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://goygizqyithyqzctiljk.supabase.co/functions/v1/recordatorios-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'PEGA_TU_CRON_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Para VER los crons programados:   select * from cron.job;
-- Para BORRAR este cron si hiciera falta:   select cron.unschedule('recordatorios-turnos');
