import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useMiPerfil, clearPerfilCache } from "@/lib/perfil";
import { MARCA, MARCA_INICIAL } from "@/lib/brand";
import { LayoutDashboard, TrendingUp, Users, Workflow, CalendarDays, MessageSquare, Settings, LogOut, Zap, Package, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthLayout,
});

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly: boolean;
  modulo?: string;
  premium?: boolean;
  seccion: "principal" | "admin";
};

const nav: NavItem[] = [
  { to: "/inicio", label: "Inicio", icon: LayoutDashboard, adminOnly: false, seccion: "principal" },
  { to: "/crm", label: "CRM", icon: Workflow, adminOnly: false, modulo: "crm", seccion: "principal" },
  { to: "/chats", label: "Chats", icon: MessageSquare, adminOnly: false, modulo: "chats", seccion: "principal" },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, adminOnly: false, modulo: "agenda", seccion: "principal" },
  { to: "/resumen", label: "Resumen", icon: TrendingUp, adminOnly: false, modulo: "resumen", seccion: "principal" },
  { to: "/automatizaciones", label: "Automatizaciones", icon: Zap, adminOnly: false, modulo: "automatizaciones", premium: true, seccion: "principal" },
  { to: "/productos", label: "Productos", icon: Package, adminOnly: false, modulo: "productos", premium: true, seccion: "principal" },
  { to: "/equipo", label: "Equipo", icon: UsersRound, adminOnly: false, modulo: "equipo", premium: true, seccion: "principal" },
  { to: "/clientes", label: "Clientes", icon: Users, adminOnly: true, seccion: "admin" },
  { to: "/configuracion", label: "Configuración", icon: Settings, adminOnly: true, seccion: "admin" },
];

function NavGroup({ items, label, pathname }: { items: NavItem[]; label: string; pathname: string }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        {label}
      </p>
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-foreground text-background font-medium"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

// Secciones que solo puede ver el admin (Gino). Si un cliente las pide, lo mandamos al inicio.
const RUTAS_ADMIN = ["/clientes", "/configuracion", "/alta-cliente"];

// El "telón": un módulo base se ve salvo que el admin lo apague para ese cliente. Un módulo
// PREMIUM (para vender) está APAGADO por defecto y solo se ve si el admin lo prende.
function moduloVisible(modulos: Record<string, boolean> | undefined, item: NavItem) {
  if (!item.modulo) return true;
  if (item.premium) return modulos?.[item.modulo] === true;
  return modulos?.[item.modulo] !== false;
}

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

  // Candado de navegación: un cliente no entra a secciones de admin ni a módulos apagados.
  useEffect(() => {
    if (perfilLoading || esAdmin) return;
    const bloqueadaAdmin = RUTAS_ADMIN.some((p) => pathname.startsWith(p));
    const moduloApagado = nav.some(
      (i) => i.modulo && !moduloVisible(perfil?.modulos, i) && pathname.startsWith(i.to),
    );
    if (bloqueadaAdmin || moduloApagado) navigate({ to: "/inicio" });
  }, [perfilLoading, esAdmin, pathname, perfil, navigate]);

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

  const items = nav.filter((item) => {
    if (esAdmin) return true;
    if (item.adminOnly) return false;
    return moduloVisible(perfil?.modulos, item);
  });
  const principal = items.filter((i) => i.seccion === "principal");
  const admin = items.filter((i) => i.seccion === "admin");

  return (
    <div className="min-h-screen flex bg-muted/30">
      <aside className="w-64 shrink-0 border-r bg-sidebar flex flex-col">
        <div className="flex items-center gap-2.5 h-16 px-5 border-b">
          <div className="h-8 w-8 rounded-lg bg-foreground text-background flex items-center justify-center text-sm font-bold">
            {MARCA_INICIAL}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight leading-none truncate">{MARCA}</p>
            <p className="text-[11px] text-muted-foreground mt-1 truncate">
              {esAdmin ? "Administrador" : "Mi panel"}
            </p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          <NavGroup items={principal} label="Principal" pathname={pathname} />
          <NavGroup items={admin} label="Administración" pathname={pathname} />
        </nav>
        <div className="border-t p-3">
          <div className="flex items-center gap-2.5 px-2 py-1.5 mb-1">
            <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-foreground">
              {esAdmin ? "A" : "C"}
            </div>
            <span className="text-xs text-muted-foreground truncate">
              {esAdmin ? "Administrador" : "Mi cuenta"}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={handleLogout}
          >
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
