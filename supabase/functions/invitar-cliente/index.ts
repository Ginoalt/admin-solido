// Edge Function: invitar-cliente
// Crea el usuario (login) de un cliente y su perfil atado a un profesional.
// Solo la puede ejecutar un usuario con rol 'admin'.
// Desplegar con "Verify JWT" ACTIVADO (default): solo entran requests autenticados.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Método no permitido" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. Identificar a quién llama, por su token de sesión
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!token) return json({ ok: false, error: "No autorizado" });
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return json({ ok: false, error: "No autorizado" });

  // 2. Verificar que es admin (defensa extra, además de RLS)
  const { data: perfil } = await admin
    .from("perfiles")
    .select("rol")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (perfil?.rol !== "admin")
    return json({ ok: false, error: "Solo un administrador puede invitar clientes" });

  // 3. Leer datos
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "JSON inválido" });
  }
  const { email, password, nombre = null, profesional_id } = body ?? {};
  if (!email || !password || !profesional_id)
    return json({ ok: false, error: "Faltan datos (email, contraseña y profesional)" });
  if (String(password).length < 6)
    return json({ ok: false, error: "La contraseña debe tener al menos 6 caracteres" });

  // 4. Crear el usuario (login)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user)
    return json({ ok: false, error: createErr?.message ?? "No se pudo crear el usuario" });

  // 5. Crear el perfil atado al profesional
  const { error: perfilErr } = await admin.from("perfiles").insert({
    id: created.user.id,
    profesional_id,
    rol: "cliente",
    nombre,
    email,
  });
  if (perfilErr) {
    // Deshacer el usuario para no dejar basura si falla el perfil
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ ok: false, error: perfilErr.message });
  }

  return json({ ok: true, user_id: created.user.id });

  function json(obj: unknown) {
    return new Response(JSON.stringify(obj), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
