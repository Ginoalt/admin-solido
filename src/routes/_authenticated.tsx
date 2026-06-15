import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useMiPerfil, clearPerfilCache } from "@/lib/perfil";
import { LayoutDashboard, Users, Workflow, CalendarDays, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthLayout,
});

const nav = [
  { to: "/inicio", label: "Inicio", icon: LayoutDashboard, adminOnly: false },
  { to: "/clientes", label: "Clientes", icon: Users, adminOnly: true },
  { to: "/crm", label: "CRM", icon: Workflow, adminOnly: false },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, adminOnly: false },
  { to: "/configuracion", label: "Configuración", icon: Settings, adminOnly: true },
];

// Secciones que solo puede ver el admin (Gino). Si un cliente las pide, lo mandamos al inicio.
const RUTAS_ADMIN = ["/clientes", "/configuracion", "/alta-cliente"];

function AuthLayout() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { perfil, loading: perfilLoading, esAdmin } = useMiPerfil();
  const pausado = !esAdmin && perfil?.estado === "pausado";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/login" });
      else setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) {
        clearPerfilCache();
        navigate({ to: "/login" });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  // Candado de navegación: un cliente no entra a las secciones de admin.
  useEffect(() => {
    if (perfilLoading) return;
    if (!esAdmin && RUTAS_ADMIN.some((p) => pathname.startsWith(p))) {
      navigate({ to: "/inicio" });
    }
  }, [perfilLoading, esAdmin, pathname, navigate]);

  async function handleLogout() {
    clearPerfilCache();
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  if (checking || perfilLoading)
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Cargando...
      </div>
    );

  // Cuenta en pausa: el cliente no entra hasta que el admin la reactive.
  if (pausado)
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-sm rounded-lg border bg-card p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight">Cuenta en pausa</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu cuenta está pausada temporalmente. Contactá a soporte para reactivarla.
          </p>
          <Button variant="outline" className="mt-6" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </div>
    );

  const items = nav.filter((item) => esAdmin || !item.adminOnly);

  return (
    <div className="min-h-screen flex bg-muted/20">
      <aside className="w-60 border-r bg-card flex flex-col">
        <div className="px-5 py-5 border-b">
          <h2 className="font-semibold tracking-tight">Panel</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {esAdmin ? "Administrador" : "Mi panel"}
          </p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.to);
            const base =
              "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors";
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`${base} ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t">
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
