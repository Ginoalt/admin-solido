-- Índices para el webhook de WhatsApp (que resuelva rápido a quién pertenece cada mensaje).
-- Seguro de correr varias veces: usa "if not exists". Correr en el SQL Editor del proyecto.

create index if not exists idx_canales_whatsapp_phone
  on public.canales_whatsapp (phone_number_id);

create index if not exists idx_leads_prof_tel
  on public.leads (profesional_id, telefono);
