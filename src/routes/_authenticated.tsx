import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useMiPerfil, clearPerfilCache } from "@/lib/perfil";
import { MARCA, MARCA_INICIAL } from "@/lib/brand";
import { LayoutDashboard, TrendingUp, Users, Workflow, CalendarDays, MessageSquare, Settings, LogOut, Zap, Package, UsersRound, BarChart3, DollarSign, ChevronsLeft, ChevronsRight } from "lucide-react";
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
  { to: "/reportes", label: "Reportes", icon: BarChart3, adminOnly: false, modulo: "reportes", premium: true, seccion: "principal" },
  { to: "/pagos", label: "Pagos", icon: DollarSign, adminOnly: false, modulo: "pagos", premium: true, seccion: "principal" },
  { to: "/clientes", label: "Clientes", icon: Users, adminOnly: true, seccion: "admin" },
  { to: "/configuracion", label: "Configuración", icon: Settings, adminOnly: true, seccion: "admin" },
];

function NavGroup({
  items,
  label,
  pathname,
  badges,
  collapsed,
}: {
  items: NavItem[];
  label: string;
  pathname: string;
  badges: Record<string, number>;
  collapsed: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      {!collapsed && (
        <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          {label}
        </p>
      )}
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname.startsWith(item.to);
        const badge = badges[item.to] ?? 0;
        return (
          <Link
            key={item.to}
            to={item.to}
            title={collapsed ? item.label : undefined}
            className={`relative flex items-center rounded-lg text-sm transition-colors ${
              collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
            } ${
              active
                ? "bg-foreground text-background font-medium"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && item.label}
            {badge > 0 &&
              (collapsed ? (
                <span
                  className={`absolute right-2 top-1.5 h-2 w-2 rounded-full ${
                    active ? "bg-background" : "bg-foreground"
                  }`}
                />
              ) : (
                <span
                  className={`ml-auto min-w-[1.25rem] rounded-full px-1.5 text-center text-[10px] font-semibold ${
                    active ? "bg-background text-foreground" : "bg-foreground text-background"
                  }`}
                >
                  {badge}
                </span>
              ))}
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
  const [marcaNombre, setMarcaNombre] = useState<string | null>(null);
  const [marcaLogo, setMarcaLogo] = useState<string | null>(null);
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebar-collapsed") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("sidebar-collapsed", collapsed ? "1" : "0");
    } catch {
      /* localStorage no disponible */
    }
  }, [collapsed]);

  // Marca propia del cliente (white-label). Se lee aparte para NO tocar la consulta del perfil.
  useEffect(() => {
    if (esAdmin || !perfil?.profesional_id) return;
    supabase
      .from("profesionales")
      .select("marca_nombre, marca_logo_url")
      .eq("id", perfil.profesional_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setMarcaNombre((data.marca_nombre as string) || null);
        setMarcaLogo((data.marca_logo_url as string) || null);
      });
  }, [esAdmin, perfil?.profesional_id]);

  // Avisos: leads nuevos (24h) en CRM y conversaciones que estás atendiendo a mano en Chats.
  useEffect(() => {
    if (esAdmin || !perfil?.profesional_id) return;
    let activo = true;
    async function cargar() {
      const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [nuevos, atender] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", desde),
        supabase
          .from("conversaciones")
          .select("id", { count: "exact", head: true })
          .eq("bot_activo", false)
          .eq("estado", "abierta"),
      ]);
      if (activo) setBadges({ "/crm": nuevos.count ?? 0, "/chats": atender.count ?? 0 });
    }
    cargar();
    const t = setInterval(cargar, 30000);
    return () => {
      activo = false;
      clearInterval(t);
    };
  }, [esAdmin, perfil?.profesional_id]);

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

  const dispNombre = esAdmin ? MARCA : marcaNombre || MARCA;
  const dispInicial = (dispNombre.charAt(0) || MARCA_INICIAL).toUpperCase();
  const dispLogo = esAdmin ? null : marcaLogo;

  return (
    <div className="min-h-screen flex bg-muted/30">
      <aside
        className={`shrink-0 border-r bg-sidebar flex flex-col transition-[width] duration-200 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        <div
          className={`flex items-center h-16 border-b ${
            collapsed ? "justify-center px-0" : "gap-2.5 px-5"
          }`}
        >
          {dispLogo ? (
            <img src={dispLogo} alt={dispNombre} className="h-8 w-8 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="h-8 w-8 shrink-0 rounded-lg bg-foreground text-background flex items-center justify-center text-sm font-bold">
              {dispInicial}
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight leading-none truncate">{dispNombre}</p>
              <p className="text-[11px] text-muted-foreground mt-1 truncate">
                {esAdmin ? "Administrador" : "Mi panel"}
              </p>
            </div>
          )}
        </div>
        <nav className={`flex-1 overflow-y-auto py-4 space-y-5 ${collapsed ? "px-2" : "px-3"}`}>
          <NavGroup items={principal} label="Principal" pathname={pathname} badges={badges} collapsed={collapsed} />
          <NavGroup items={admin} label="Administración" pathname={pathname} badges={badges} collapsed={collapsed} />
        </nav>
        <div className="border-t p-3 space-y-1">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expandir menú" : "Contraer menú"}
            className={`flex items-center rounded-lg py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors ${
              collapsed ? "w-full justify-center px-0" : "w-full gap-3 px-3"
            }`}
          >
            {collapsed ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronsLeft className="h-4 w-4" />
                Contraer
              </>
            )}
          </button>
          {!collapsed && (
            <div className="flex items-center gap-2.5 px-2 py-1.5">
              <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-foreground">
                {esAdmin ? "A" : "C"}
              </div>
              <span className="text-xs text-muted-foreground truncate">
                {esAdmin ? "Administrador" : "Mi cuenta"}
              </span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            title="Cerrar sesión"
            className={
              collapsed
                ? "w-full justify-center px-0 text-muted-foreground"
                : "w-full justify-start text-muted-foreground"
            }
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && "Cerrar sesión"}
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
