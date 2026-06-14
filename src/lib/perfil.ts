import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// El perfil del usuario logueado: su rol (admin = Gino/equipo, cliente = el profesional)
// y a qué profesional está atado (los clientes apuntan a su propia ficha).
export type MiPerfil = {
  rol: string;
  profesional_id: string | null;
};

// Cache en memoria para no re-consultar en cada pantalla durante la sesión.
let cache: MiPerfil | null = null;

export function clearPerfilCache() {
  cache = null;
}

export function useMiPerfil() {
  const [perfil, setPerfil] = useState<MiPerfil | null>(cache);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) {
      setPerfil(cache);
      setLoading(false);
      return;
    }
    let activo = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        if (activo) setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("perfiles")
        .select("rol, profesional_id")
        .eq("id", user.id)
        .maybeSingle();
      // Si no hay perfil cargado, por las dudas lo tratamos como cliente sin ficha
      // (no ve nada de admin). El admin se define explícitamente con rol = 'admin'.
      cache = (data as MiPerfil) ?? { rol: "cliente", profesional_id: null };
      if (activo) {
        setPerfil(cache);
        setLoading(false);
      }
    })();
    return () => {
      activo = false;
    };
  }, []);

  return { perfil, loading, esAdmin: perfil?.rol === "admin" };
}
