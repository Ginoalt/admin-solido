// Edge Function: whatsapp-send  (la "boca" para respuestas MANUALES)
//
// Cuando el humano apaga el bot y contesta desde la Bandeja, este endpoint manda
// ese mensaje por WhatsApp (Cloud API) con el numero/token del cliente y lo guarda
// con el estado real (enviado/fallido). Reusa la normalizacion del numero argentino.
//
// Lo llama el front autenticado -> Desplegar con "Verify JWT" ACTIVADO (como asistente-ia).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GRAPH = "https://graph.facebook.com/v21.0";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1) Identificar al usuario que escribe
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!token) return json({ error: "No autorizado" }, 401);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return json({ error: "No autorizado" }, 401);

  const { data: perfil } = await admin
    .from("perfiles")
    .select("rol, profesional_id")
    .eq("id", userData.user.id)
    .maybeSingle();
  const esAdmin = perfil?.rol === "admin";

  // 2) Entrada
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  const conversacionId = String(body?.conversacion_id ?? "");
  const texto = String(body?.texto ?? "").trim();
  if (!conversacionId || !texto) return json({ error: "Falta conversacion_id o texto" }, 400);

  // 3) Conversación + permiso (admin ve todo; cliente solo lo suyo)
  const { data: conv } = await admin
    .from("conversaciones")
    .select("id, profesional_id, lead_id")
    .eq("id", conversacionId)
    .maybeSingle();
  if (!conv) return json({ error: "Conversación no encontrada" }, 404);
  if (!esAdmin && perfil?.profesional_id !== conv.profesional_id)
    return json({ error: "Sin acceso a esta conversación" }, 403);

  const pid = conv.profesional_id as string;

  // 4) Canal de WhatsApp del cliente
  const { data: canal } = await admin
    .from("canales_whatsapp")
    .select("phone_number_id, access_token")
    .eq("profesional_id", pid)
    .maybeSingle();
  if (!canal?.phone_number_id || !canal?.access_token)
    return json({ error: "Este cliente no tiene WhatsApp configurado" }, 400);

  // 5) Teléfono del lead
  const { data: lead } = await admin
    .from("leads")
    .select("telefono")
    .eq("id", conv.lead_id)
    .maybeSingle();
  if (!lead?.telefono) return json({ error: "El lead no tiene teléfono" }, 400);

  // 6) Enviar por WhatsApp
  const enviado = await enviarTexto(
    canal.phone_number_id as string,
    canal.access_token as string,
    lead.telefono as string,
    texto,
  );

  // 7) Guardar el mensaje con el estado REAL
  await admin.from("mensajes").insert({
    profesional_id: pid,
    conversacion_id: conv.id,
    lead_id: conv.lead_id,
    direccion: "saliente",
    autor: "humano",
    tipo: "texto",
    contenido: texto,
    estado: enviado ? "enviado" : "fallido",
  });
  await admin
    .from("conversaciones")
    .update({ ultimo_mensaje_at: new Date().toISOString() })
    .eq("id", conv.id);

  if (!enviado)
    return json(
      { error: "El mensaje se guardó pero WhatsApp no lo entregó (¿pasaron 24 hs desde el último mensaje del lead?)" },
      502,
    );
  return json({ ok: true }, 200);

  function json(obj: unknown, status: number) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

async function enviarTexto(
  phoneNumberId: string,
  token: string,
  to: string,
  texto: string,
): Promise<boolean> {
  const destino = normalizarDestino(to);
  try {
    const resp = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: destino,
        type: "text",
        text: { body: texto },
      }),
    });
    if (!resp.ok) {
      console.error(`WhatsApp send (destino ${destino}):`, await resp.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("WhatsApp send exception:", e);
    return false;
  }
}

// Argentina: el `from` llega como 549XXXXXXXXXX pero hay que ENVIAR a 54XXXXXXXXXX (sin el 9).
function normalizarDestino(to: string): string {
  const limpio = String(to).replace(/\D/g, "");
  if (limpio.startsWith("549") && limpio.length === 13) {
    return "54" + limpio.slice(3);
  }
  return limpio;
}
