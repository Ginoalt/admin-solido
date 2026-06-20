// Edge Function: equipo-miembros
//
// El dueño de un workspace (rol 'cliente') suma o quita miembros de SU equipo.
// Cada miembro entra con su propio login, atado al MISMO profesional (comparten todo).
// El admin también puede gestionar el equipo de cualquier cliente.
//
// Desplegar con "Verify JWT" ACTIVADO (como invitar-cliente / asistente-ia).
// Autorización (defensa además del RLS):
//  - invitar: el nuevo miembro queda con el profesional_id del que llama (un cliente NO puede
//    meter gente en otro workspace); el admin elige el profesional_id.
//  - quitar: solo dentro del propio workspace; no se puede quitar a uno mismo ni a un admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Método no permitido" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1) Identificar a quién llama
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!token) return json({ ok: false, error: "No autorizado" }, 401);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return json({ ok: false, error: "No autorizado" }, 401);
  const callerId = userData.user.id;

  const { data: perfil } = await admin
    .from("perfiles")
    .select("rol, profesional_id")
    .eq("id", callerId)
    .maybeSingle();
  // Un token válido sin perfil (cuenta huérfana) no es un miembro legítimo: lo rechazamos.
  if (!perfil) return json({ ok: false, error: "Tu usuario no tiene un perfil válido" });
  const esAdmin = perfil.rol === "admin";
  const callerProf = (perfil.profesional_id as string | null) ?? null;

  // 2) Entrada
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "JSON inválido" }, 400);
  }
  const action = String(body?.action ?? "");

  // ---- INVITAR ----
  if (action === "invitar") {
    if (!esAdmin && perfil?.rol !== "cliente")
      return json({ ok: false, error: "Sin permiso" }, 403);

    const profId = esAdmin ? (body?.profesional_id ?? null) : callerProf;
    if (!profId) return json({ ok: false, error: "No tenés un workspace asignado" }, 400);

    const email = String(body?.email ?? "").trim();
    const password = String(body?.password ?? "");
    const nombre = body?.nombre ? String(body.nombre).trim() : null;
    if (!email || !password) return json({ ok: false, error: "Faltan email y contraseña" }, 400);
    if (password.length < 6)
      return json({ ok: false, error: "La contraseña debe tener al menos 6 caracteres" }, 400);

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created.user)
      return json({ ok: false, error: createErr?.message ?? "No se pudo crear el usuario" }, 400);

    const { error: perfilErr } = await admin.from("perfiles").insert({
      id: created.user.id,
      profesional_id: profId,
      rol: "cliente",
      nombre,
      email,
    });
    if (perfilErr) {
      await admin.auth.admin.deleteUser(created.user.id); // no dejar basura
      return json({ ok: false, error: perfilErr.message }, 400);
    }
    return json({ ok: true, user_id: created.user.id }, 200);
  }

  // ---- QUITAR ----
  if (action === "quitar") {
    const memberId = String(body?.member_id ?? "");
    if (!memberId) return json({ ok: false, error: "Falta el miembro" }, 400);
    if (memberId === callerId)
      return json({ ok: false, error: "No te podés quitar a vos mismo" }, 400);

    const { data: target } = await admin
      .from("perfiles")
      .select("id, profesional_id, rol")
      .eq("id", memberId)
      .maybeSingle();
    if (!target) return json({ ok: false, error: "Ese miembro no existe" }, 404);
    if (target.rol === "admin")
      return json({ ok: false, error: "No se puede quitar a un administrador" }, 403);
    if (!esAdmin && (!callerProf || target.profesional_id !== callerProf))
      return json({ ok: false, error: "Sin permiso sobre ese miembro" }, 403);

    await admin.from("perfiles").delete().eq("id", memberId);
    await admin.auth.admin.deleteUser(memberId);
    return json({ ok: true }, 200);
  }

  return json({ ok: false, error: "Acción inválida" }, 400);

  // Siempre 200 con { ok, error } en el body (como invitar-cliente): el front lee data.ok.
  function json(obj: unknown, _status?: number) {
    return new Response(JSON.stringify(obj), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
