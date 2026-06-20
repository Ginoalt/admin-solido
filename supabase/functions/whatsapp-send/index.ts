// Edge Function: whatsapp-send  (la "boca" para respuestas MANUALES)
//
// Cuando el humano apaga el bot y contesta desde la Bandeja, este endpoint manda
// ese mensaje por WhatsApp con el canal del cliente y lo guarda con el estado real.
//
// SOPORTA DOS PROVEEDORES (canales_whatsapp.proveedor): 'meta' (Cloud API) o 'evolution'.
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

  // 4) Canal de WhatsApp del cliente (cualquier proveedor)
  const { data: canal } = await admin
    .from("canales_whatsapp")
    .select(
      "proveedor, phone_number_id, access_token, evolution_url, evolution_instance, evolution_api_key, zapi_instance, zapi_token, zapi_client_token",
    )
    .eq("profesional_id", pid)
    .maybeSingle();
  if (!canalConfigurado(canal))
    return json({ error: "Este cliente no tiene WhatsApp configurado" }, 400);

  // 5) Teléfono del lead
  const { data: lead } = await admin
    .from("leads")
    .select("telefono")
    .eq("id", conv.lead_id)
    .maybeSingle();
  if (!lead?.telefono) return json({ error: "El lead no tiene teléfono" }, 400);

  // 6) Enviar por WhatsApp con el proveedor del canal
  const enviado = await enviarTexto(canal, lead.telefono as string, texto);

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

function canalConfigurado(canal: any): boolean {
  if (!canal) return false;
  if (canal.proveedor === "evolution") {
    return !!(canal.evolution_url && canal.evolution_instance && canal.evolution_api_key);
  }
  if (canal.proveedor === "zapi") {
    return !!(canal.zapi_instance && canal.zapi_token);
  }
  return !!(canal.phone_number_id && canal.access_token);
}

// ---- ENVIO: elige el proveedor del canal ---------------------------------------------
async function enviarTexto(canal: any, to: string, texto: string): Promise<boolean> {
  if (canal?.proveedor === "evolution") {
    return await enviarEvolution(canal, to, texto);
  }
  if (canal?.proveedor === "zapi") {
    return await enviarZapi(canal, to, texto);
  }
  return await enviarMeta(canal?.phone_number_id, canal?.access_token, to, texto);
}

// Z-API: envia al numero con el 9; el Client-Token va como header de seguridad (si esta configurado).
async function enviarZapi(canal: any, to: string, texto: string): Promise<boolean> {
  const instancia = String(canal?.zapi_instance ?? "").trim();
  const token = String(canal?.zapi_token ?? "").trim();
  const clientToken = String(canal?.zapi_client_token ?? "").trim();
  if (!instancia || !token) {
    console.error("Z-API mal configurado (falta instancia o token).");
    return false;
  }
  const phone = String(to).replace(/\D/g, "");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (clientToken) headers["Client-Token"] = clientToken;
  try {
    const resp = await fetch(
      `https://api.z-api.io/instances/${encodeURIComponent(instancia)}/token/${encodeURIComponent(token)}/send-text`,
      { method: "POST", headers, body: JSON.stringify({ phone, message: texto }) },
    );
    if (!resp.ok) {
      console.error(`Z-API send (phone ${phone}):`, await resp.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("Z-API send exception:", e);
    return false;
  }
}

async function enviarMeta(
  phoneNumberId: string,
  token: string,
  to: string,
  texto: string,
): Promise<boolean> {
  const destino = normalizarDestinoMeta(to);
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
      console.error(`Meta send (destino ${destino}):`, await resp.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("Meta send exception:", e);
    return false;
  }
}

// Evolution: se le envia al numero TAL CUAL (con el 9 en Argentina); el servidor rutea.
async function enviarEvolution(canal: any, to: string, texto: string): Promise<boolean> {
  const base = String(canal?.evolution_url ?? "").trim().replace(/\/+$/, "");
  const instancia = String(canal?.evolution_instance ?? "").trim();
  const apikey = String(canal?.evolution_api_key ?? "").trim();
  if (!base || !instancia || !apikey) {
    console.error("Evolution mal configurado (falta url, instancia o api key).");
    return false;
  }
  const number = String(to).replace(/\D/g, "");
  try {
    const resp = await fetch(`${base}/message/sendText/${encodeURIComponent(instancia)}`, {
      method: "POST",
      headers: { apikey, "content-type": "application/json" },
      body: JSON.stringify({ number, text: texto }),
    });
    if (!resp.ok) {
      console.error(`Evolution send (number ${number}):`, await resp.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("Evolution send exception:", e);
    return false;
  }
}

// Argentina (SOLO Meta): el `from` llega como 549XXXXXXXXXX pero hay que ENVIAR a 54XXXXXXXXXX.
function normalizarDestinoMeta(to: string): string {
  const limpio = String(to).replace(/\D/g, "");
  if (limpio.startsWith("549") && limpio.length === 13) {
    return "54" + limpio.slice(3);
  }
  return limpio;
}
