-- WhatsApp con DOS proveedores por cliente:
--   'meta'      -> Meta Cloud API (oficial, lo que ya funciona).  [POR DEFECTO]
--   'evolution' -> Evolution API (no oficial, servidor propio con QR).
-- Correr en el SQL Editor del proyecto. Seguro de correr de nuevo: usa "if not exists".

-- Que proveedor usa ESTE cliente. Por defecto 'meta' => los clientes de hoy NO cambian en nada.
alter table public.canales_whatsapp
  add column if not exists proveedor text not null default 'meta';

-- Datos del servidor Evolution. Se completan cuando tengas el servidor; pueden quedar vacios.
alter table public.canales_whatsapp
  add column if not exists evolution_url text;        -- ej: https://evo.tudominio.com
alter table public.canales_whatsapp
  add column if not exists evolution_instance text;   -- nombre de la instancia (un numero = una instancia)
alter table public.canales_whatsapp
  add column if not exists evolution_api_key text;    -- apikey de esa instancia/servidor

-- El webhook de Evolution ubica al cliente por el nombre de instancia: que la busqueda sea rapida.
create index if not exists idx_canales_whatsapp_evo_instance
  on public.canales_whatsapp (evolution_instance);

-- Solo permitimos valores conocidos (evita que un valor raro rutee mal el envio). Idempotente.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'canales_whatsapp_proveedor_chk') then
    alter table public.canales_whatsapp
      add constraint canales_whatsapp_proveedor_chk check (proveedor in ('meta', 'evolution'));
  end if;
end $$;
