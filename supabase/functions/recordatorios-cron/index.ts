// Edge Function: recordatorios-cron
//
// La dispara un cron cada ~15 min. Busca turnos (citas) que arrancan dentro de las
// proximas 2 hs, que estan "agendada" y que TODAVIA no tienen recordatorio enviado,
// y le manda al lead por WhatsApp un recordatorio (plantilla aprobada) pidiendo
// confirmacion. Multi-cliente: cada turno usa el numero/token de SU profesional.
//
// DESPLEGAR con "Verify JWT" DESACTIVADO. Se protege con el header x-cron-secret.
// SECRETS: CRON_SECRET (un string que inventamos; el mismo que manda el cron).
// REQUIERE una PLANTILLA aprobada en Meta llamada "recordatorio_turno" (idioma "es")
// con 4 variables: {{1}} nombre, {{2}} negocio, {{3}} fecha, {{4}} hora.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GRAPH = "https://graph.facebook.com/v21.0";
const TEMPLATE = "recordatorio_turno";
const TEMPLATE_LANG = "es";
const TZ = "America/Argentina/Buenos_Aires";

Deno.serve(async (req) => {
  // Proteccion simple por secret (si esta cargado).
  const secret = Deno.env.get("CRON_SECRET");
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return new Response("Forbidden", { status: 403 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const ahora = new Date();
  const limite = new Date(ahora.getTime() + 2 * 60 * 60 * 1000); // +2 hs

  const { data: citas } = await admin
    .from("citas")
    .select("id, profesional_id, lead_id, fecha_hora")
    .eq("estado", "agendada")
    .is("recordatorio_enviado_at", null)
    .gt("fecha_hora", ahora.toISOString())
    .lte("fecha_hora", limite.toISOString());

  let enviados = 0;
  for (const cita of asArray(citas)) {
    try {
      if (await procesarCita(admin, cita)) enviados++;
    } catch (e) {
      console.error("recordatorio cita", cita?.id, ":", e instanceof Error ? e.message : String(e));
    }
  }

  return new Response(
    JSON.stringify({ ok: true, enviados, evaluados: asArray(citas).length }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});

async function procesarCita(admin: any, cita: any): Promise<boolean> {
  const pid = cita?.profesional_id;
  if (!pid || !cita?.lead_id) return false;

  const { data: canal } = await admin
    .from("canales_whatsapp")
    .select("phone_number_id, access_token")
    .eq("profesional_id", pid)
    .maybeSingle();
  if (!canal?.phone_number_id || !canal?.access_token) return false;

  const { data: lead } = await admin
    .from("leads")
    .select("nombre, telefono")
    .eq("id", cita.lead_id)
    .maybeSingle();
  if (!lead?.telefono) return false;

  const { data: prof } = await admin
    .from("profesionales")
    .select("nombre")
    .eq("id", pid)
    .maybeSingle();

  const { fecha, hora } = formatearFechaHora(cita.fecha_hora);
  const params = [lead.nombre || "", prof?.nombre || "tu turno", fecha, hora];

  const ok = await enviarPlantilla(canal.phone_number_id, canal.access_token, lead.telefono, params);

  // Solo marcamos como enviado si SALIO bien (si falla, reintenta en el proximo tick).
  if (ok) {
    await admin
      .from("citas")
      .update({ recordatorio_enviado_at: new Date().toISOString() })
      .eq("id", cita.id);
  }
  return ok;
}

function formatearFechaHora(iso: string): { fecha: string; hora: string } {
  const d = new Date(iso);
  const fecha = d.toLocaleDateString("es-AR", {
    timeZone: TZ,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
  const hora = d.toLocaleTimeString("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  return { fecha, hora };
}

async function enviarPlantilla(
  phoneNumberId: string,
  token: string,
  to: string,
  params: string[],
): Promise<boolean> {
  const destino = normalizarDestino(to);
  try {
    const resp = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: destino,
        type: "template",
        template: {
          name: TEMPLATE,
          language: { code: TEMPLATE_LANG },
          components: [
            { type: "body", parameters: params.map((p) => ({ type: "text", text: String(p) })) },
          ],
        },
      }),
    });
    if (!resp.ok) {
      console.error(`Recordatorio send (destino ${destino}):`, await resp.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("Recordatorio exception:", e);
    return false;
  }
}

// Argentina: el `from` llega como 549XXXXXXXXXX pero hay que ENVIAR a 54XXXXXXXXXX (sin el 9).
function normalizarDestino(to: string): string {
  const limpio = String(to).replace(/\D/g, "");
  if (limpio.startsWith("549") && limpio.length === 13) return "54" + limpio.slice(3);
  return limpio;
}

function asArray(x: unknown): any[] {
  return Array.isArray(x) ? x : [];
}
