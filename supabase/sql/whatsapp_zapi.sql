-- Z-API como TERCER proveedor de WhatsApp (hosteado, no oficial; pagás por número).
-- Correr en el SQL Editor del proyecto. Idempotente.

alter table public.canales_whatsapp add column if not exists zapi_instance text;     -- ID de la instancia
alter table public.canales_whatsapp add column if not exists zapi_token text;          -- token de la instancia
alter table public.canales_whatsapp add column if not exists zapi_client_token text;   -- Client-Token (seguridad de la cuenta)

create index if not exists idx_canales_whatsapp_zapi_instance
  on public.canales_whatsapp (zapi_instance);

-- Ampliar el CHECK de proveedor para aceptar 'zapi'.
alter table public.canales_whatsapp drop constraint if exists canales_whatsapp_proveedor_chk;
alter table public.canales_whatsapp
  add constraint canales_whatsapp_proveedor_chk check (proveedor in ('meta', 'evolution', 'zapi'));
